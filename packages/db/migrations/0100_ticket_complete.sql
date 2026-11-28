-- 0100 完了にする（K-165・K-63 の孫・D-125.55・D-128.49・D-128.92・D-128.138・D-128.171・D-131.8）
--   番号は取り込む順の次の空き番号（別の枝が 0099 を使うので 0100）。新しい表は作らない。足すのは列 tickets.completed_at・completed_by と関数。
--   確定の時点：チケットが完了の段（done）になり、完了の時刻（completed_at）と押した人（completed_by）が入った時点（app.ticket_complete）。
--     実施事項の新しい版・やり取りの 1 行・証跡と一緒に 1 つの処理で書く。
--   あわせて「AI に任せている」印（tickets.delegated_to_clone）を、承認の後の実行の結末で外し、承認・差し戻しで AI がまた動くなら付け直す
--     （決める人の答え b01eda354e6c ①・5f6abe0aec7b）。前の migration の関数 2 つ（0097 の app.approval_decide・0098 の app.ticket_execute_job_end）を
--     create or replace で写し、足した所だけに「★ K-165 が足した所」の印を付けた。
--   どの関数も p_member を受けず、呼んだ人を app.user_id() で引く。security definer・search_path に pg_temp・public から外し kaname_app だけに渡す（D-128.171）。
--   中だけで使う関数は誰にも execute を渡さない。

-- ⓪ 列
alter table tickets add column if not exists completed_at timestamptz;
alter table tickets add column if not exists completed_by uuid references members(id);

-- ---------------------------------------------------------------- 中だけで使う関数（誰にも execute を渡さない）
-- 完了の知らせの宛先：担当者と作った人のうち、完了にした人でない人（D-128.92）。宛先を選ぶのはこの 1 か所
create or replace function app.ticket_completed_recipients(p_ticket uuid) returns setof uuid
language sql stable security definer set search_path = public, app, pg_temp as $$
  select m.id from tickets t join members m on m.tenant_id = t.tenant_id and m.id in (t.assignee_member_id, t.created_by)
   where t.id = p_ticket and t.completed_by is not null and m.id <> t.completed_by
   order by m.id
$$;
revoke all on function app.ticket_completed_recipients(uuid) from public;

-- ---------------------------------------------------------------- ⑤ 完了にする（確定の時点）
--   答えは {ticket_id, number, completed_at, completed_by, notify_member_ids} か {error[, left][, out, out_total][, children]}。だめなときは何も書かない。
--     範囲の外の番号（out）は小さい順の先頭 20 個までと、その総数（out_total）を返す（送られた数だけ答えを大きくしない）。
--   守りの 2 層目：呼んだ人が今のメンバーで、そのチケットを直せる（app.ticket_writable）こと（口の入口の行の決まり write と同じ判定）。
--   見る順：完了済み（done）→ 段と走っている実行・決まっていない承認待ち（stage）→ 実施事項の版（todo_changed）→
--     範囲の外の番号（todo_out_of_range・D-131.8）→ 残っている項目（todo_left）→ 確かめ（not_confirmed）→ 終わっていない子（children_left）。
--   実施事項：todo の区画の本文の「- 」で始まる行が項目（0 から数える）。「- [x]」は済みで、送られた番号に無くても済みのまま数える
--     （済みは外せない・決める人の答え bf373f5b265a）。通れば全部の項目を「- [x]」にした新しい版を書く（変わるときだけ。
--     済みの行はそのまま・本文が無い（null）区画は書き換えない）。
--   書く所の失敗は例外のまま外に出す（1 つの処理なので何も残らない・口は 500）
create or replace function app.ticket_complete(p_ticket uuid, p_todo_checked integer[], p_todo_version integer, p_confirmed boolean)
returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_tenant uuid := app.tenant_id(); v_me uuid := app.user_id(); t tickets%rowtype; v_stage text;
        v_checked integer[] := coalesce(p_todo_checked, '{}');
        v_sec uuid; v_ver integer; v_text text; v_line text; v_lines text[] := '{}'; v_idx integer := 0;
        v_left text[] := '{}'; v_out integer[]; v_new text; v_body jsonb; v_kids jsonb; v_rest text;
        c_out_max constant integer := 20;   -- 答えに載せる範囲の外の番号の数の上限
begin
  if v_tenant is null or v_me is null then return jsonb_build_object('error', 'not_member'); end if;
  -- 同じチケットの同時の 2 本は 1 本にする（チケットの行で待ち合わせる。後の 1 本は完了の後の行を見る）
  select * into t from tickets where id = p_ticket and tenant_id = v_tenant for update;
  if t.id is null or t.deleted_at is not null then return jsonb_build_object('error', 'not_found'); end if;
  if not app.approval_member_now() then return jsonb_build_object('error', 'not_member'); end if;
  if not app.ticket_writable(t.id) then return jsonb_build_object('error', 'not_writable'); end if;
  select s.key into v_stage from ticket_stages s where s.id = t.stage_id;
  if v_stage = 'done' then return jsonb_build_object('error', 'done'); end if;
  -- 承認待ち・実行中・確認中、走っている実行、決まっていない承認待ちがあるうちは完了にできない（D-128.49）
  if v_stage in ('awaiting_approval', 'running', 'checking')
     or exists (select 1 from action_runs r
                 where r.ticket_id = t.id and r.status_id in ('queued', 'running', 'asking') and r.deleted_at is null)
     or exists (select 1 from approvals a
                 where a.ticket_id = t.id and a.decision is null and a.withdrawn_at is null and a.deleted_at is null) then
    return jsonb_build_object('error', 'stage');
  end if;
  -- 画面が読んだ実施事項の版と同じか（区画が無ければ 0）
  select s.id, s.version, s.body->>'text' into v_sec, v_ver, v_text
    from ticket_sections s where s.ticket_id = t.id and s.section_key = 'todo' and s.deleted_at is null for update;
  if coalesce(v_ver, 0) <> coalesce(p_todo_version, -1) then return jsonb_build_object('error', 'todo_changed'); end if;
  if v_text is not null then
    foreach v_line in array regexp_split_to_array(v_text, E'\n') loop
      if v_line ~ '^\s*- ' then
        if v_line ~ '^\s*- \[[xX]\](\s|$)' then
          v_lines := v_lines || v_line;   -- 済みの行はそのまま（外さない・書き換えない）
        else
          v_rest := regexp_replace(v_line, '^\s*- (\[ ?\]\s*)?', '');   -- 項目の文（頭の「- 」と空の印を除く）
          if not (v_idx = any(v_checked)) then v_left := v_left || v_rest; end if;
          v_lines := v_lines || (substring(v_line from '^\s*') || '- [x]' || case when v_rest = '' then '' else ' ' || v_rest end);
        end if;
        v_idx := v_idx + 1;
      else
        v_lines := v_lines || v_line;
      end if;
    end loop;
  end if;
  -- 範囲の外の番号（負・項目の数を超える）があれば、ほかが全部済みでも断る（D-131.8）。残っている項目も一緒に返す
  select array_agg(distinct x order by x) into v_out from unnest(v_checked) x where x is not null and (x < 0 or x >= v_idx);
  if v_out is not null then
    return jsonb_build_object('error', 'todo_out_of_range', 'left', to_jsonb(v_left),
                              'out', to_jsonb(v_out[1:c_out_max]), 'out_total', cardinality(v_out));
  end if;
  if cardinality(v_left) > 0 then return jsonb_build_object('error', 'todo_left', 'left', to_jsonb(v_left)); end if;
  if p_confirmed is distinct from true then return jsonb_build_object('error', 'not_confirmed'); end if;
  -- 終わっていない子（消されていない・段が完了でない）。番号と題名を返す（D-128.138）
  select jsonb_agg(jsonb_build_object('id', c.id, 'label', c.number || ' ' || c.title) order by c.number, c.id) into v_kids
    from tickets c left join ticket_stages s on s.id = c.stage_id
   where c.parent_ticket_id = t.id and c.tenant_id = t.tenant_id and c.deleted_at is null and coalesce(s.key, '') <> 'done';
  if v_kids is not null then return jsonb_build_object('error', 'children_left', 'children', v_kids); end if;

  -- 書く（1 回の書き込み）：実施事項を全部「- [x]」にした新しい版（変わるときだけ）・段・完了の時刻と押した人・やり取りの 1 行・証跡
  if v_sec is not null and v_text is not null then
    v_new := array_to_string(v_lines, E'\n');
    if v_new is distinct from v_text then
      v_ver := v_ver + 1;
      v_body := jsonb_build_object('text', v_new);
      update ticket_sections set body = v_body, version = v_ver, updated_by = v_me where id = v_sec;
      insert into ticket_section_versions (tenant_id, ticket_id, section_id, version, body, edited_by, edited_by_clone, created_by)
        values (t.tenant_id, t.id, v_sec, v_ver, v_body, v_me, false, v_me);
    end if;
  end if;
  perform app.ticket_stage_to(t.id, 'done', v_me);
  update tickets set completed_at = now(), completed_by = v_me where id = t.id returning * into t;
  perform app.ticket_system_line(t.id, v_me, app.member_name(v_me) || 'が完了にしました');
  -- ナレッジの候補は骨格では出さない（「候補はまだ出していません」・D-128.138）ので、候補の数は 0 と記録する
  insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
    values (t.tenant_id, v_me, 'member', 'ticket.complete', 'tickets', t.id::text, 'C2',
            jsonb_build_object('number', t.number, 'knowledge_candidates', 0), v_me);
  return jsonb_build_object('ticket_id', t.id, 'number', t.number, 'completed_at', t.completed_at, 'completed_by', v_me,
                            'notify_member_ids', coalesce((select jsonb_agg(x) from app.ticket_completed_recipients(t.id) x), '[]'::jsonb));
end $$;
revoke all on function app.ticket_complete(uuid, integer[], integer, boolean) from public;
grant execute on function app.ticket_complete(uuid, integer[], integer, boolean) to kaname_app;

-- ---------------------------------------------------------------- 完了の知らせを受け箱に書く（関門 C6 の NotifyGateway の受け箱の書き手だけが呼ぶ）
--   他人宛ての受け箱の行は、行の守りでは書けない（notifications は本人宛てだけ）ので、この関数が書く。守りは関数の中（2 層目・宛先を口に任せない）：
--     呼んだ人がそのチケットを完了にした人で（completed_by）、段が完了のときだけ。宛先は関数の中で選ぶ（担当者と作った人のうち呼んだ人でない人）。
--     同じチケットの完了の知らせは 1 人に 1 つ（dedupe_key は ticket.completed:<チケットの id>）。本文はチケットの id・番号・リンクだけ。
--   答えは書いた行の数（もう書いてあれば 0）
create or replace function app.ticket_completed_notice(p_ticket uuid) returns integer
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare t tickets%rowtype; v_me uuid := app.user_id(); v_key text; n integer := 0;
begin
  if v_me is null then return 0; end if;
  -- チケットの行で待ち合わせる（同時の 2 本が同じ人に 2 つ書かない）
  select x.* into t from tickets x
   where x.id = p_ticket and x.tenant_id = app.tenant_id() and x.deleted_at is null and x.completed_by = v_me
     and exists (select 1 from ticket_stages s where s.id = x.stage_id and s.key = 'done')
     for update;
  if t.id is null then return 0; end if;
  v_key := 'ticket.completed:' || t.id::text;
  insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, dedupe_key, sent_at, created_by)
    select t.tenant_id, r, 'inapp', 'ticket.completed',
           jsonb_build_object('ticket_id', t.id, 'number', t.number, 'url', '/tickets/' || t.id::text), v_key, now(), v_me
      from app.ticket_completed_recipients(t.id) r
     where not exists (select 1 from notifications o
                        where o.tenant_id = t.tenant_id and o.member_id = r and o.dedupe_key = v_key);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function app.ticket_completed_notice(uuid) from public;
grant execute on function app.ticket_completed_notice(uuid) to kaname_app;

-- ---------------------------------------------------------------- チケットの詳細の帯（K-162 の 0096 の本体を写し、完了の 3 つを足す）
--   足すのは 3 つ：can_complete（呼んだ人が今のメンバーで直せる・段が承認待ち／実行中／確認中／完了でない・走っている実行も決まっていない承認待ちも無い
--     ＝ app.ticket_complete の守りと段の判定と同じ）・completed_at・completed_by（押した人の id と、画面に出す名前 completed_by_name）。
--   ほかは 0096 のまま（読むだけで書き換えない）
create or replace function app.ticket_band(p_ticket uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare t tickets%rowtype; a approvals%rowtype; v_stage text; v_can boolean;
        v_done jsonb;   -- ★ K-165 が足した所：完了の 3 つ（can_complete・completed_at・completed_by と名前）
begin
  select * into t from tickets where id = p_ticket and tenant_id = app.tenant_id() and deleted_at is null;
  if t.id is null or not app.member_ok() or not app.ticket_visible(p_ticket) then return null; end if;
  select s.key into v_stage from ticket_stages s where s.id = t.stage_id;
  select * into a from approvals x
   where x.ticket_id = t.id and x.kind = 'artifact' and x.decision is null and x.withdrawn_at is null and x.deleted_at is null
   order by x.created_at desc limit 1;
  -- ★ K-165 が足した所（ここから v_done の式の終わりまで）
  v_done := jsonb_build_object(
    'can_complete', coalesce(
      app.approval_member_now() and app.ticket_writable(t.id)
      and coalesce(v_stage, '') not in ('awaiting_approval', 'running', 'checking', 'done')
      and not exists (select 1 from action_runs r
                       where r.ticket_id = t.id and r.status_id in ('queued', 'running', 'asking') and r.deleted_at is null)
      and not exists (select 1 from approvals x
                       where x.ticket_id = t.id and x.decision is null and x.withdrawn_at is null and x.deleted_at is null), false),
    'completed_at', t.completed_at,
    'completed_by', t.completed_by,
    'completed_by_name', case when t.completed_by is not null then app.member_name(t.completed_by) end);
  if a.id is null then return jsonb_build_object('approval', null, 'stage_key', v_stage) || v_done; end if;   -- ★ || v_done を足した
  v_can := app.approval_member_now() and t.assignee_member_id = app.user_id() and app.ticket_writable(t.id);
  return jsonb_build_object(
    'approval', jsonb_build_object('id', a.id, 'can_decide', coalesce(v_can, false), 'irreversible', a.irreversible,
                                   'note', a.note,
                                   'approver_name', case when t.assignee_member_id is not null then app.member_name(t.assignee_member_id) end),
    'stage_key', v_stage) || v_done;   -- ★ || v_done を足した
end $$;
revoke all on function app.ticket_band(uuid) from public;
grant execute on function app.ticket_band(uuid) to kaname_app;

-- ---------------------------------------------------------------- 承認・差し戻し（K-163 の 0097 の本体を写し、「AI に任せている」印の所だけを足す）
--   足すのは 1 か所（★ の印）：仕事と実行の記録を積んでチケットの段を変える所の隣で、承認・差し戻しのどちらでも、
--     仕事を待ちで積んだ（AI がまた動く）なら印を付け直し（K63-API-093・094。立っていればそのまま）、
--     任せた人が使えず、はじめから止まった形で積んだなら印を外す（K63-API-090・092）。ほかは 0097 のまま
create or replace function app.approval_decide(p_approval uuid, p_decision text, p_reason text) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_tenant uuid := app.tenant_id(); v_me uuid := app.user_id(); a approvals%rowtype; t tickets%rowtype;
        v_err text; v_reason text; v_by uuid; v_ctx jsonb; v_sess text; v_resume uuid; v_why text; v_job uuid; v_run uuid;
begin
  if v_tenant is null or v_me is null then return jsonb_build_object('error', 'not_member'); end if;
  -- 同じ承認の同時の 2 本は 1 本にする（承認の行で待ち合わせる。後の 1 本は決まった後の行を見る）
  select * into a from approvals where id = p_approval and tenant_id = v_tenant for update;
  if a.id is null or a.deleted_at is not null or a.ticket_id is null or a.kind is distinct from 'artifact' then
    return jsonb_build_object('error', 'not_found');   -- 成果物でない承認も見つからない（D-131.11）
  end if;
  select * into t from tickets where id = a.ticket_id and tenant_id = v_tenant for update;
  if t.id is null or t.deleted_at is not null then return jsonb_build_object('error', 'not_found'); end if;
  begin
    if not app.approval_member_now() then v_err := 'not_member';
    elsif t.assignee_member_id is null or t.assignee_member_id <> v_me then v_err := 'not_approver';
    elsif not app.ticket_writable(t.id) then v_err := 'not_writable';
    end if;
  exception when others then
    return jsonb_build_object('error', 'guard_failed');
  end;
  if v_err is not null then return jsonb_build_object('error', v_err); end if;
  if p_decision is null or p_decision not in ('approve', 'return') then return jsonb_build_object('error', 'bad_decision'); end if;
  if a.decision is not null or a.withdrawn_at is not null or a.resolved_at is not null then
    return jsonb_build_object('error', 'decided');
  end if;
  -- 差し戻しの理由：前後の空白（全角の空白も）を除いて空なら reason_empty（422・E-VAL-020・何も書かない）。
  --   制御文字（タブ・改行・復帰を除く）は取り除く。文字数の上限は置かない（D-131.1）。HTML は文のまま
  if p_decision = 'return' then
    v_reason := btrim(regexp_replace(coalesce(p_reason, ''), E'[\\x01-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]', '', 'g'), E' \t\r\n　');
    if v_reason = '' then return jsonb_build_object('error', 'reason_empty'); end if;
  end if;

  -- 実行するのは、作る段の仕事を動かした人（任せた人）の AI・その人の PC（D-128.176）。
  --   承認の行の作る段の実行 → そのチケットの最新の作る段の実行 → 承認の requested_by（作る段の実行が無い承認）の順に引く。
  --   任せた人の状態の確かめも守りの判定なので、書き込みの前に、例外なら guard_failed（503・何も書かない・K63-API-059）
  begin
    select r.created_by into v_by from action_runs r where r.id = a.action_run_id and r.phase = 'make';
    if v_by is null then
      select r.created_by into v_by from action_runs r
       where r.ticket_id = t.id and r.phase = 'make' and r.deleted_at is null order by r.created_at desc limit 1;
    end if;
    v_by := coalesce(v_by, a.requested_by);
    v_why := app.ticket_delegator_stop(t.id, v_by);
  exception when others then
    return jsonb_build_object('error', 'guard_failed');
  end;

  -- 決める（1 回の書き込み。承認する人は決めた時点の担当者に書き直す。承認は全部「取り消せない」の印・D-128.177）
  update approvals set decision = p_decision, decided_at = now(), resolved_at = now(),
         status_id = case when p_decision = 'approve' then 'approved' else 'returned' end,
         return_reason = case when p_decision = 'return' then v_reason end,
         next_actor = case when p_decision = 'return' then 'clone' end,
         irreversible = case when p_decision = 'approve' then true else irreversible end,   -- 取り消せないの印は承認だけ（D-128.177）
         approver_member_id = v_me, updated_by = v_me
   where id = a.id returning * into a;

  -- 仕事の中身は K-62 の 1 か所（app.ticket_job_context）で組み、足し書きを付ける。続きの id は同じ人のときだけ（D-129.46）
  v_ctx := app.ticket_job_context(t.id);
  v_sess := case when (v_ctx->>'agent_member_id')::uuid = v_by then v_ctx->>'agent_session_id' end;
  -- その続きの記録を持つ PC（その作る段の仕事を取った PC）。取りに来た PC が同じときだけ続きを渡す（D-131.3）
  if v_sess is not null then
    select j.taken_session_id into v_resume
      from action_runs r join bridge_jobs j on j.id = r.bridge_job_id
     where r.ticket_id = t.id and r.phase = 'make' and j.agent_session_id = v_sess
     order by r.created_at desc limit 1;
  end if;
  insert into bridge_jobs (tenant_id, scope_id, member_id, state_id, prompt, agent_session_id, resume_session_id, kind,
                           permission_mode, stopped_reason, finished_at, created_by)
    values (t.tenant_id, t.scope_id, v_by, case when v_why is null then 'queued' else 'stopped' end,
            coalesce(v_ctx->>'prompt', '')
              || case when p_decision = 'approve'
                   then E'\n\n## 承認されました\n承認された成果物を実行してください。上の「外には何も出さず」は、この実行には当てはまりません。'
                        || 'チケットの区画「成果物」の中身を、そのとおりに外へ出してください（送る・応募する など）。'
                        || '終わったら、何をしたか（宛先・時刻）を最後の返事の本文で返してください。'
                   else E'\n\n## 差し戻し\n差し戻されました。理由：' || v_reason
                        || E'\nこの理由に合わせて成果物を作り直し、作ったものを最後の返事の本文で返してください。' end,
            v_sess, v_resume, 'ticket',
            case when p_decision = 'approve' then 'auto' else 'manual' end,   -- 承認の後の実行は auto（D-128.177）・作り直しは manual（D-131.5）
            v_why, case when v_why is not null then now() end, v_me)
    returning id into v_job;
  insert into action_runs (tenant_id, scope_id, ticket_id, phase, status_id, bridge_job_id, approval_id, error_summary, finished_at,
                           created_by, updated_by)
    values (t.tenant_id, t.scope_id, t.id, case when p_decision = 'approve' then 'execute' else 'make' end,
            case when v_why is null then 'queued' else 'stopped' end, v_job, a.id,
            v_why, case when v_why is not null then now() end,
            case when p_decision = 'approve' then v_me else v_by end, v_me)   -- 作り直しの実行は任せた人（鎖を保つ・K63-API-077）
    returning id into v_run;
  -- 任せた人が使えなければ、承認は記録し、実行はすぐ止めてチケットは作業中（M3）
  perform app.ticket_stage_to(t.id, case when v_why is null then 'running' else 'doing' end, v_me);
  -- ★ K-165 が足した所（ここから end if; まで）：AI がまた動く（仕事を待ちで積んだ）なら「AI に任せている」印を付け直し（決める人の答え 5f6abe0aec7b）、
  --   任せた人が使えず、はじめから止まった形で積んだなら印を外す（仕事は insert なので、仕事の終わりの引き金は動かない）。承認も差し戻しも同じ
  if v_why is null then
    update tickets set delegated_to_clone = true where id = t.id;
  else
    update tickets set delegated_to_clone = false where id = t.id;
  end if;
  perform app.ticket_system_line(t.id, v_me,
    app.member_name(v_me) || case when p_decision = 'approve' then 'が承認しました' else 'が差し戻しました：' || v_reason end
    || case when v_why is not null then '。' || v_why else '' end);
  insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
    values (t.tenant_id, v_me, 'member', 'approval.' || p_decision, 'approvals', a.id::text, 'C2',
            jsonb_build_object('decision', p_decision, 'ticket_id', t.id, 'run_id', v_run, 'stopped', v_why is not null), v_me);
  return jsonb_build_object('id', a.id, 'decision', a.decision, 'decided_at', a.decided_at, 'status_id', a.status_id,
                            'ticket_id', t.id, 'run_id', v_run,
                            'pc', case when app.account_pc_live(v_by) then 'live' else 'asleep' end);   -- 75 秒の式（0092 と同じ）
end $$;
revoke all on function app.approval_decide(uuid, text, text) from public;
grant execute on function app.approval_decide(uuid, text, text) to kaname_app;

-- ---------------------------------------------------------------- 承認の後の仕事の終わり（K-164 の 0098 の本体を写し、「AI に任せている」印を外す 1 行だけを足す）
--   足すのは 1 か所（★ の印）：チケットを作業中に戻す所の隣。PC が終わった／止まった／やめたと返す・つながり直したときの後始末・
--     任せた人を止めた／外した・片付け（消された・任せた人が使えない・24 時間の聞き直し）のどこから閉じてもここを通る。
--     作る段の仕事の終わりでは印に触らない（この引き金は承認の後の実行だけを見る）。引き金そのもの（0098）は作り直さない
create or replace function app.ticket_execute_job_end() returns trigger
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare r action_runs%rowtype; v_ok boolean; v_state text; v_why text; v_name text;
begin
  select * into r from action_runs where bridge_job_id = new.id order by created_at desc limit 1 for update;
  if r.id is null or r.phase is distinct from 'execute' or r.status_id not in ('queued', 'running', 'asking') then return null; end if;
  v_ok := new.state_id = 'done' and coalesce(new.result, '') ~ '\S';
  v_state := case when v_ok then 'done' when new.state_id = 'cancelled' then 'cancelled' else 'stopped' end;
  v_why := case when v_ok then null
                when new.state_id = 'done' then '自分のAI が結果を返さずに終わりました。完了とは見なしていません'
                when new.state_id = 'cancelled'
                  then coalesce(nullif(btrim(new.stopped_reason), ''), 'PC でこの実行をやめました。もう一度「AI に任せる」を押せます')
                when coalesce(new.stopped_reason, '') ~ '\S' then new.stopped_reason
                else 'AI が途中で止まりました（理由は届いていません）。もう一度「AI に任せる」を押せます' end;
  update action_runs set status_id = v_state, error_summary = v_why, finished_at = now() where id = r.id;
  perform app.ticket_stage_to(r.ticket_id, 'doing', null);
  -- ★ K-165 が足した所（この 2 行）：承認の後の実行が終わった・止まった・やめた・24 時間の聞き直しになったら「AI に任せている」印を外す（決める人の答え b01eda354e6c ①）
  update tickets set delegated_to_clone = false where id = r.ticket_id;
  v_name := app.member_name(new.member_id);
  perform app.ticket_system_line(r.ticket_id, null,
    case when v_ok then v_name || 'のAI が実行しました：' || left(btrim(new.result, E' \t\r\n　'), 200)
         else v_name || 'のAI の実行が止まりました：' || v_why end);
  return null;
end $$;
revoke all on function app.ticket_execute_job_end() from public;

insert into app.schema_migrations (name) values ('0100_ticket_complete.sql') on conflict do nothing;
