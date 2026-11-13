-- 0101 完了の知らせと続きの絞り・守りの例外・見えない子・完了は作業中だけ（K-166・K-63 の孫・D-125.155・D-128.49・D-128.92・D-128.138・D-131.7・D-131.12）
--   番号は取り込む順の次の空き番号（0100 の次）。新しい表・列は作らない。足す関数は app.member_left の 1 つ。
--   ほかは前の migration の関数を create or replace で写し、変えた所だけに「★ K-166」の印を付けた：
--     0100 の app.ticket_completed_recipients・app.ticket_complete・app.ticket_completed_notice・app.ticket_band、0092 の app.ticket_job_context。
--   このチケットは新しい確定の時点を足さない（完了の確定は 0100 の app.ticket_complete のまま）。
--   どの関数も p_member を受けず、呼んだ人を app.user_id() で引く。security definer・search_path に pg_temp・public から外し、
--   口が呼ぶ関数だけを kaname_app に渡す（D-128.171）。中だけで使う関数は誰にも execute を渡さない。

-- ---------------------------------------------------------------- 会社から抜けた人か（口の共通の入口が見る・D-131.7 ②・K63-API-084）
--   呼んだ人のメンバーの行があり、消されている（deleted_at）。行の守りの外で members を引く（抜けた人は自分の行も読めない）。
--   止められた人（suspended_at）はここでは見ない（今までどおり各関数が 403）。メンバーの行が無い人（運営・取引先・PC の印）は false
create or replace function app.member_left() returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select exists (select 1 from members m where m.id = app.user_id() and m.tenant_id = app.tenant_id() and m.deleted_at is not null)
$$;
revoke all on function app.member_left() from public;
grant execute on function app.member_left() to kaname_app;

-- ---------------------------------------------------------------- 中だけで使う関数（誰にも execute を渡さない）
-- 完了の知らせの宛先：担当者と作った人のうち、完了にした人でない人（D-128.92）。宛先を選ぶのはこの 1 か所
--   ★ K-166 が足した所：会社から抜けた（deleted_at）・止められた（suspended_at）人を除く（D-131.12・K63-API-069・082）
create or replace function app.ticket_completed_recipients(p_ticket uuid) returns setof uuid
language sql stable security definer set search_path = public, app, pg_temp as $$
  select m.id from tickets t join members m on m.tenant_id = t.tenant_id and m.id in (t.assignee_member_id, t.created_by)
   where t.id = p_ticket and t.completed_by is not null and m.id <> t.completed_by
     and m.deleted_at is null and m.suspended_at is null
   order by m.id
$$;
revoke all on function app.ticket_completed_recipients(uuid) from public;

-- ---------------------------------------------------------------- 完了にする（0100 の本体を写し、★ の 4 か所を変えた）
--   ① 守りの判定の例外は guard_failed（何も書かない）② 段が作業中でなければ not_doing ③ 終わっていない子は見える子だけを children に、
--   見えない子は数だけを children_hidden に ④ 宣言に v_err・v_hidden。ほかは 0100 のまま（見る順：完了済み → 段と走っている実行・承認待ち →
--   作業中か → 実施事項の版 → 範囲の外の番号 → 残っている項目 → 確かめ → 終わっていない子）
create or replace function app.ticket_complete(p_ticket uuid, p_todo_checked integer[], p_todo_version integer, p_confirmed boolean)
returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_tenant uuid := app.tenant_id(); v_me uuid := app.user_id(); t tickets%rowtype; v_stage text;
        v_checked integer[] := coalesce(p_todo_checked, '{}');
        v_sec uuid; v_ver integer; v_text text; v_line text; v_lines text[] := '{}'; v_idx integer := 0;
        v_left text[] := '{}'; v_out integer[]; v_new text; v_body jsonb; v_kids jsonb; v_rest text;
        c_out_max constant integer := 20;   -- 答えに載せる範囲の外の番号の数の上限
        v_err text; v_hidden integer := 0;   -- ★ K-166 が足した所：守りの判定の言葉・押した人に見えない終わっていない子の数
begin
  if v_tenant is null or v_me is null then return jsonb_build_object('error', 'not_member'); end if;
  -- 同じチケットの同時の 2 本は 1 本にする（チケットの行で待ち合わせる。後の 1 本は完了の後の行を見る）
  select * into t from tickets where id = p_ticket and tenant_id = v_tenant for update;
  if t.id is null or t.deleted_at is not null then return jsonb_build_object('error', 'not_found'); end if;
  -- ★ K-166 が直した所（ここから v_err の if の終わりまで）：守りの判定（今のメンバーか・書けるか）の所で例外になったら、
  --   外に投げずに guard_failed を返して何も書かない（fail-closed・口は 503・K63-API-063）。判定の中身と順は 0100 のまま
  begin
    if not app.approval_member_now() then v_err := 'not_member';
    elsif not app.ticket_writable(t.id) then v_err := 'not_writable';
    end if;
  exception when others then
    return jsonb_build_object('error', 'guard_failed');
  end;
  if v_err is not null then return jsonb_build_object('error', v_err); end if;
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
  -- ★ K-166 が足した所（この 1 行）：完了にできるのは作業中だけ。未着手・保留は not_doing（409・E-CONF-019・決める人の答え db67f3cde899 ②・83361b2157fd）
  if coalesce(v_stage, '') <> 'doing' then return jsonb_build_object('error', 'not_doing'); end if;
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
  -- ★ K-166 が直した所（ここから children_left の if の終わりまで）：押した人に見える子（app.ticket_visible）だけを children に入れ、
  --   見えない子は数だけを children_hidden で返す（id・番号・題名を出さない・決める人の答え db67f3cde899 ①）。
  --   見える子が 0 でも見えない子が 1 つでもあれば断る（K63-API-096・097）
  select jsonb_agg(jsonb_build_object('id', c.id, 'label', c.number || ' ' || c.title) order by c.number, c.id) filter (where k.seen),
         count(*) filter (where not k.seen)
    into v_kids, v_hidden
    from tickets c left join ticket_stages s on s.id = c.stage_id
         cross join lateral (select coalesce(app.ticket_visible(c.id), false) as seen) k
   where c.parent_ticket_id = t.id and c.tenant_id = t.tenant_id and c.deleted_at is null and coalesce(s.key, '') <> 'done';
  if v_kids is not null or v_hidden > 0 then
    return jsonb_build_object('error', 'children_left', 'children', coalesce(v_kids, '[]'::jsonb), 'children_hidden', v_hidden);
  end if;

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

-- ---------------------------------------------------------------- 完了の知らせを受け箱に書く（0100 の本体を写し、「送れなかった」の印の引数を足した）
--   ★ K-166 が足した所：2 つ目の引数 p_failed（既定 false）。true のときは、送れなかった記録（sent_at は空・failed_at・retry_count 1）を書く
--     （送れたとは言わない・K63-API-044。retry_count の 1 は関門 C6 の送り直し 1 回＝apps/api の complete.ts の maxAttempts 2 と対）。
--     守り（完了にした人か・段が完了か）と宛先の選び方・1 人に 1 つは、どちらの印でも同じ所を通る（本人宛てだけの行の守りをすり抜けない・2 層目）。
--   引数を足すので前の形（uuid だけ）を消してから作る（残すと 1 引数の呼び出しがどちらか決まらない）。1 引数でも今までどおり呼べる
drop function if exists app.ticket_completed_notice(uuid);
create or replace function app.ticket_completed_notice(p_ticket uuid, p_failed boolean default false) returns integer
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare t tickets%rowtype; v_me uuid := app.user_id(); v_key text; n integer := 0;
        v_failed boolean := coalesce(p_failed, false);   -- ★ K-166 が足した所
begin
  if v_me is null then return 0; end if;
  -- チケットの行で待ち合わせる（同時の 2 本が同じ人に 2 つ書かない）
  select x.* into t from tickets x
   where x.id = p_ticket and x.tenant_id = app.tenant_id() and x.deleted_at is null and x.completed_by = v_me
     and exists (select 1 from ticket_stages s where s.id = x.stage_id and s.key = 'done')
     for update;
  if t.id is null then return 0; end if;
  v_key := 'ticket.completed:' || t.id::text;
  -- ★ K-166 が直した所：sent_at を印で分け、failed_at・retry_count を足した（0100 は sent_at に now() だけ）
  insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, dedupe_key, sent_at, failed_at, retry_count, created_by)
    select t.tenant_id, r, 'inapp', 'ticket.completed',
           jsonb_build_object('ticket_id', t.id, 'number', t.number, 'url', '/tickets/' || t.id::text), v_key,
           case when v_failed then null else now() end, case when v_failed then now() end, case when v_failed then 1 end, v_me
      from app.ticket_completed_recipients(t.id) r
     where not exists (select 1 from notifications o
                        where o.tenant_id = t.tenant_id and o.member_id = r and o.dedupe_key = v_key);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function app.ticket_completed_notice(uuid, boolean) from public;
grant execute on function app.ticket_completed_notice(uuid, boolean) to kaname_app;

-- ---------------------------------------------------------------- チケットの詳細の帯（0100 の本体を写し、can_complete の段の条件だけを変えた）
--   ★ の 1 行：can_complete は段が作業中（doing）のときだけ（未着手・保留では false・K63-API-099）。ほかは 0100 のまま
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
      and coalesce(v_stage, '') = 'doing'   -- ★ K-166 が直した所：完了にできるのは作業中だけ（未着手・保留でも false・app.ticket_complete の not_doing と同じ判定）
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

-- ---------------------------------------------------------------- 仕事の中身を組む（0092 の本体を写し、続きの id の絞りだけを足した）
--   ★ の 1 行：続きの id（agent_session_id）は、完了（completed_at）より後の作る実行のものだけ。任せ直しと承認の後の実行の両方に効く（D-125.155）
create or replace function app.ticket_job_context(p_ticket uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare t tickets%rowtype; v_prompt text; v_sess text; v_sess_member uuid; sec record; rec record;
        v_lines text[] := '{}'; v_total int := 0; v_head text; v_summary text;
begin
  select * into t from tickets where id = p_ticket;
  if t.id is null then return null; end if;
  v_prompt := 'Kaname のチケット「' || t.number || ' ' || t.title || '」の成果物を作ってください。'
              || '外（メール・送信・応募など）には何も出さず、作ったものを最後の返事の本文で返してください。'
              || 'チケットの区画は Kaname の道具 ticket_read で読めます。';
  -- 区画は切らずに全文（D-130.3・PM の判断 2026-11-08）
  for sec in select coalesce(ks.label, s.section_key) as label, s.body->>'text' as body
               from ticket_sections s
               left join kind_sections ks on ks.kind_id = t.kind_id and ks.section_key = s.section_key and ks.deleted_at is null
              where s.ticket_id = t.id and s.deleted_at is null
                and s.section_key in ('purpose', 'done', 'constraints', 'counterpart', 'todo')
                and coalesce(btrim(s.body->>'text'), '') <> ''
              order by array_position(array['purpose', 'done', 'constraints', 'counterpart', 'todo'], s.section_key) loop
    v_prompt := v_prompt || E'\n\n## ' || sec.label || E'\n' || sec.body;
  end loop;
  -- チケットの記録の要約（D-129.46・G-16）：やり取りの書き込み 新しい 10 件・1 件 400 字／決定 新しい 20 件・1 件 200 字／前の実行の記録 新しい 10 件・1 件 200 字。
  --   古い順に並べ、合わせて 8000 字を越えたら古いものから落とす。区画は切らない。前の会話の番号（agent_session_id）は入れない
  for rec in
    select x.line from (
      (select m.created_at as ts,
              '[やり取り] ' || to_char(m.created_at at time zone 'Asia/Tokyo', 'MM/DD HH24:MI') || ' ' || coalesce(app.member_name(m.author_member_id), '') || ': '
              || left(regexp_replace(coalesce(m.body, ''), E'[\\r\\n]+', ' ', 'g'), 400) as line
         from ticket_messages m where m.ticket_id = t.id and m.kind <> 'system' and m.deleted_at is null
        order by m.created_at desc limit 10)
      union all
      (select d.decided_at,
              '[決定] ' || to_char(d.decided_at at time zone 'Asia/Tokyo', 'MM/DD') || ' ' || left(regexp_replace(coalesce(d.text, ''), E'[\\r\\n]+', ' ', 'g'), 200)
         from ticket_decisions d where d.ticket_id = t.id and d.deleted_at is null
        order by d.decided_at desc limit 20)
      union all
      (select coalesce(r.finished_at, r.created_at),
              '[前の実行] ' || to_char(coalesce(r.finished_at, r.created_at) at time zone 'Asia/Tokyo', 'MM/DD HH24:MI') || ' ' || coalesce(app.member_name(r.created_by), '') || 'のAI: '
              || case r.status_id when 'done' then '作り終えた' when 'cancelled' then 'やめた' else '止まった' end
              || case when coalesce(r.error_summary, '') = '' then '' else '（' || left(regexp_replace(r.error_summary, E'[\\r\\n]+', ' ', 'g'), 200) || '）' end
         from action_runs r where r.ticket_id = t.id and r.status_id in ('done', 'stopped', 'cancelled') and r.deleted_at is null
        order by coalesce(r.finished_at, r.created_at) desc limit 10)
    ) x order by x.ts
  loop
    v_lines := v_lines || rec.line;
    v_total := v_total + length(rec.line) + 3;   -- 「- 」と改行
  end loop;
  v_head := E'\n\n## チケットの記録（新しいものだけ・古い順）\n';
  while coalesce(array_length(v_lines, 1), 0) > 0 and v_total + length(v_head) > 8000 loop
    v_total := v_total - (length(v_lines[1]) + 3);
    v_lines := v_lines[2:];
  end loop;
  if coalesce(array_length(v_lines, 1), 0) > 0 then
    select string_agg('- ' || u.l, E'\n' order by u.i) into v_summary from unnest(v_lines) with ordinality as u(l, i);
    v_prompt := v_prompt || v_head || v_summary;
  end if;
  -- 前の作る実行の会話の番号と、その実行を任せた人。続きにするかは任せる関数（同じ人）と取る関数（同じ PC）が決める（D-129.46）
  select j.agent_session_id, r.created_by into v_sess, v_sess_member
    from action_runs r join bridge_jobs j on j.id = r.bridge_job_id
   where r.ticket_id = t.id and r.phase = 'make' and j.agent_session_id is not null
     and (t.completed_at is null or r.created_at > t.completed_at)   -- ★ K-166 が足した所：完了の前の作る実行の続きは使わない（D-125.155・K63-API-054・055）
   order by r.created_at desc limit 1;
  return jsonb_build_object('prompt', v_prompt, 'agent_session_id', v_sess, 'agent_member_id', v_sess_member);
end $$;
-- 中だけで使う（任せる関数と K-63 の承認の関数が呼ぶ）。kaname_app にも渡さない（D-128.171・K62-API-046）
revoke all on function app.ticket_job_context(uuid) from public;

insert into app.schema_migrations (name) values ('0101_complete_notify_guard.sql') on conflict do nothing;
