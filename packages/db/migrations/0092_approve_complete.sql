-- 0092 承認して完了する（K-63・D-012・D-090・D-125.19・D-125.55・D-125.102・D-125.103・D-125.155・D-127.9・D-128.25・D-128.36・D-128.49・D-128.92・D-128.98・D-128.138・D-128.171・D-128.176・D-128.177・D-128.178）
--   番号は K-62 の 0091 の次（11_tickets/K-50.md の予約は仮。取り込む順に、その時点の次の空き番号へ付け替える）。新しい表は作らない。
--   確定の時点は 3 つ：① 承認・差し戻し（app.approval_decide が承認の行・実行の記録と仕事・段・やり取り・証跡を 1 つの処理で書く）
--                    ② 実行（PC が承認の後の仕事を中身のある結果で終えた時点。引き金 app.ticket_execute_job_end が実行の記録・段・やり取りを書く）
--                    ③ 完了（app.ticket_complete がチケットの段・完了の時刻と押した人・実施事項の版・やり取り・証跡を 1 つの処理で書く）
--   どの関数も p_member を受けず、呼んだ人を app.user_id() で引く。security definer・search_path に pg_temp・public から外し kaname_app だけに渡す（D-128.171）。
--   中だけで使う関数は誰にも execute を渡さない。

-- ⓪ 制約と列
-- 承認では本人確認を取り直さない（D-128.177 が D-125.139 の承認の分を改めた）。骨格では承認は全部「取り消せない」で記録するので、
--   取り消せない承認に step_up_at を求める制約を外す（外さないと承認が 1 つも書けない）
-- squawk-ignore ban-drop-constraint
alter table approvals drop constraint if exists approvals_step_up_ck;
-- 完了の時刻と押した人（D-128.138）
alter table tickets add column if not exists completed_at timestamptz;
alter table tickets add column if not exists completed_by uuid references members(id);

-- ---------------------------------------------------------------- 中だけで使う関数（誰にも execute を渡さない）
-- 文の定め（画面・試験が同じ文を見る）
create or replace function app.k63_text(p_key text) returns text
language sql immutable security definer set search_path = public, app, pg_temp as $$
  select case p_key
    when 'gone' then 'チケットが消されたので止めました'
    when 'expired' then '承認から 24 時間を過ぎたので、実行の前にもう一度確かめます'
    when 'reask' then '承認から 24 時間を過ぎたので、実行の前にもう一度確かめてください'
    when 'not_member' then 'AI に任せた人がこのワークスペースにいないので、実行を止めました'
    when 'not_writable' then 'AI に任せた人がこのチケットを直せなくなったので、実行を止めました'
    when 'no_pc' then 'AI に任せた人の PC がつながっていない（外した）ので、実行を止めました'
    when 'empty' then '自分のAI が結果を返さずに終わりました。完了とは見なしていません'
    when 'check_none' then '検査なし（まだ流していません）'
  end
$$;
revoke all on function app.k63_text(text) from public;

-- 任せた人（作る段の仕事を動かした人）が実行に使えるか。使えなければ止める理由の文（D-128.176・①の 3 つ）
create or replace function app.ticket_delegator_stop(p_ticket uuid, p_member uuid) returns text
language sql stable security definer set search_path = public, app, pg_temp as $$
  select case
    when p_member is null
      or not exists (select 1 from members m join tickets t on t.tenant_id = m.tenant_id
                      where m.id = p_member and t.id = p_ticket and m.deleted_at is null and m.suspended_at is null)
      then app.k63_text('not_member')
    when not app.ticket_writable_for(p_ticket, p_member) then app.k63_text('not_writable')
    when not exists (select 1 from sessions s where s.member_id in (select app.account_members(p_member)) and s.kind_id = 'bridge'
                        and s.revoked_at is null and s.deleted_at is null)
      then app.k63_text('no_pc')
  end
$$;
revoke all on function app.ticket_delegator_stop(uuid, uuid) from public;

-- 呼んだ人がそのチケットの今の担当者か（承認する人＝今の担当者・行の守り approvals_read が使う・policies/0092）
create or replace function app.ticket_assignee_is_me(p_ticket uuid) returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select exists (select 1 from tickets t where t.id = p_ticket and t.tenant_id = app.tenant_id() and t.assignee_member_id = app.user_id())
$$;
revoke all on function app.ticket_assignee_is_me(uuid) from public;
grant execute on function app.ticket_assignee_is_me(uuid) to kaname_app;

-- 呼んだ人が、この会社の今のメンバーか（抜けた・止められた人は通さない）
create or replace function app.k63_member_now() returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select exists (select 1 from members m where m.id = app.user_id() and m.tenant_id = app.tenant_id()
                   and m.deleted_at is null and m.suspended_at is null)
$$;
revoke all on function app.k63_member_now() from public;

-- 承認の 1 件を読める人：承認する人（今の担当者）・決めた人・マネージャー・チケットの作った人・AI に任せた人（requested_by）（M2・行の決まり・RLS とそろえる）
create or replace function app.approval_readable(p_approval uuid) returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select exists (
    select 1 from approvals a join tickets t on t.id = a.ticket_id
     where a.id = p_approval and a.tenant_id = app.tenant_id() and a.deleted_at is null and t.deleted_at is null
       and (a.approver_member_id = app.user_id() or a.requested_by = app.user_id()
            or t.assignee_member_id = app.user_id() or t.created_by = app.user_id()
            or app.manages_scope(a.scope_id) or app.manages_scope(t.scope_id)))
$$;
revoke all on function app.approval_readable(uuid) from public;

-- ---------------------------------------------------------------- 仕事の中身を組む（K-62 の 1 か所に、完了の後だけの絞りを足す・D-125.155）
--   K-62（0091）の本体を写し、続きの id を「そのチケットの completed_at より後の作る実行」からだけ引く。ticket_delegate は同じ関数を呼ぶので任せ直しにも効く
create or replace function app.ticket_job_context(p_ticket uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare t tickets%rowtype; v_prompt text; v_sess text; sec record;
begin
  select * into t from tickets where id = p_ticket;
  if t.id is null then return null; end if;
  v_prompt := 'Kaname のチケット「' || t.number || ' ' || t.title || '」の成果物を作ってください。'
              || '外（メール・送信・応募など）には何も出さず、作ったものを最後の返事の本文で返してください。'
              || 'チケットの区画は Kaname の道具 ticket_read で読めます。';
  for sec in select coalesce(ks.label, s.section_key) as label, s.body->>'text' as body
               from ticket_sections s
               left join kind_sections ks on ks.kind_id = t.kind_id and ks.section_key = s.section_key and ks.deleted_at is null
              where s.ticket_id = t.id and s.deleted_at is null
                and s.section_key in ('purpose', 'done', 'constraints', 'counterpart', 'todo')
                and coalesce(btrim(s.body->>'text'), '') <> ''
              order by array_position(array['purpose', 'done', 'constraints', 'counterpart', 'todo'], s.section_key) loop
    v_prompt := v_prompt || E'\n\n## ' || sec.label || E'\n' || sec.body;
  end loop;
  select j.agent_session_id into v_sess
    from action_runs r join bridge_jobs j on j.id = r.bridge_job_id
   where r.ticket_id = t.id and r.phase = 'make' and j.agent_session_id is not null
     and (t.completed_at is null or r.created_at > t.completed_at)
   order by r.created_at desc limit 1;
  return jsonb_build_object('prompt', v_prompt, 'agent_session_id', v_sess);
end $$;
revoke all on function app.ticket_job_context(uuid) from public;
grant execute on function app.ticket_job_context(uuid) to kaname_app;

-- ---------------------------------------------------------------- 承認・差し戻し（確定の時点 ①）
--   答えは {id, decision, decided_at, status_id, ticket_id, run_id, pc} か {error}。だめなときは何も書かない。
--   守りの判定（承認する人か・今のメンバーか・書けるか）の所で例外になったら、外に投げずに guard_failed（fail-closed・口は 503）
create or replace function app.approval_decide(p_approval uuid, p_decision text, p_reason text) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_tenant uuid := app.tenant_id(); v_me uuid := app.user_id(); a approvals%rowtype; t tickets%rowtype;
        v_err text; v_reason text; v_by uuid; v_ctx jsonb; v_why text; v_job uuid; v_run uuid; v_add text; v_name text;
        v_phase text;
begin
  if v_tenant is null or v_me is null or p_decision not in ('approve', 'return') then
    return jsonb_build_object('error', 'not_member');
  end if;
  -- 同じ承認の同時の 2 本は 1 本にする（承認の行で待ち合わせる。後の 1 本は決まった後の行を見る）
  select * into a from approvals where id = p_approval and tenant_id = v_tenant for update;
  if a.id is null or a.deleted_at is not null or a.ticket_id is null or a.kind <> 'artifact' then
    return jsonb_build_object('error', 'not_found');
  end if;
  select * into t from tickets where id = a.ticket_id and tenant_id = v_tenant for update;
  if t.id is null or t.deleted_at is not null then return jsonb_build_object('error', 'not_found'); end if;
  begin
    if not app.k63_member_now() then v_err := 'not_member';
    elsif t.assignee_member_id is null or t.assignee_member_id <> v_me then v_err := 'not_approver';   -- 承認する人＝今の担当者（H3）
    elsif not app.ticket_writable(t.id) then v_err := 'not_writable';                                 -- M1
    end if;
  exception when others then
    return jsonb_build_object('error', 'guard_failed');
  end;
  if v_err is not null then return jsonb_build_object('error', v_err); end if;
  if a.decision is not null or a.withdrawn_at is not null or a.resolved_at is not null then
    return jsonb_build_object('error', 'decided');
  end if;
  if p_decision = 'return' then
    v_reason := btrim(coalesce(p_reason, ''), E' \t\r\n　');
    if v_reason = '' then return jsonb_build_object('error', 'reason_empty'); end if;
    if char_length(v_reason) > 2000 then return jsonb_build_object('error', 'reason_long'); end if;
  end if;

  -- 決める（1 回の書き込みで decision・decided_at・status_id・resolved_at。承認する人は決めた時点の担当者に書き直す）
  update approvals set decision = p_decision, decided_at = now(), resolved_at = now(),
         status_id = case when p_decision = 'approve' then 'approved' else 'returned' end,
         return_reason = case when p_decision = 'return' then v_reason end,
         next_actor = case when p_decision = 'return' then 'clone' end,
         irreversible = case when p_decision = 'approve' then true else irreversible end,   -- 取り消せないの印（D-128.177）
         approver_member_id = v_me, updated_by = v_me
   where id = a.id returning * into a;

  -- 実行・作り直しをするのは、作る段の仕事を動かした人（任せた人）の AI・その人の PC（D-128.176）
  select r.created_by into v_by from action_runs r where r.id = a.action_run_id;
  v_by := coalesce(v_by, a.requested_by);
  v_ctx := app.ticket_job_context(t.id);
  v_phase := case when p_decision = 'approve' then 'execute' else 'make' end;
  v_add := case when p_decision = 'approve'
                then E'\n\n## 承認されました\n承認された成果物を実行してください。上の「外には何も出さず」は、この実行には当てはまりません。'
                     || 'チケットの区画「成果物」の中身を、そのとおりに外へ出してください（送る・応募する など）。'
                     || '終わったら、何をしたか（宛先・時刻）を最後の返事の本文で返してください。'
                else E'\n\n## 差し戻し\n差し戻されました。理由：' || v_reason
                     || E'\nこの理由に合わせて成果物を作り直し、作ったものを最後の返事の本文で返してください。' end;
  v_why := app.ticket_delegator_stop(t.id, v_by);
  insert into bridge_jobs (tenant_id, scope_id, member_id, state_id, prompt, agent_session_id, kind, permission_mode,
                           stopped_reason, finished_at, created_by)
    values (t.tenant_id, t.scope_id, v_by, case when v_why is null then 'queued' else 'stopped' end,
            coalesce(v_ctx->>'prompt', '') || v_add, v_ctx->>'agent_session_id', 'ticket',
            case when p_decision = 'approve' then 'auto' else 'manual' end,
            v_why, case when v_why is not null then now() end, v_me)
    returning id into v_job;
  insert into action_runs (tenant_id, scope_id, ticket_id, phase, status_id, bridge_job_id, approval_id, error_summary, finished_at,
                           created_by, updated_by)
    values (t.tenant_id, t.scope_id, t.id, v_phase, case when v_why is null then 'queued' else 'stopped' end, v_job, a.id,
            v_why, case when v_why is not null then now() end,
            case when p_decision = 'approve' then v_me else v_by end, v_me)
    returning id into v_run;
  perform app.ticket_stage_to(t.id, case when v_why is null then 'running' else 'doing' end, v_me);
  v_name := app.member_name(v_me);
  perform app.ticket_system_line(t.id, v_me,
    case when p_decision = 'approve' then v_name || 'が承認しました' else v_name || 'が差し戻しました：' || v_reason end
    || case when v_why is not null then '。' || v_why else '' end);
  insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
    values (t.tenant_id, v_me, 'member', 'approval.' || p_decision, 'approvals', a.id::text, 'C2',
            jsonb_build_object('decision', p_decision, 'ticket_id', t.id, 'run_id', v_run, 'stopped', v_why is not null), v_me);
  return jsonb_build_object('id', a.id, 'decision', a.decision, 'decided_at', a.decided_at, 'status_id', a.status_id,
                            'ticket_id', t.id, 'run_id', v_run,
                            'pc', case when app.account_pc_live(v_by) then 'live' else 'asleep' end);
end $$;
revoke all on function app.approval_decide(uuid, text, text) from public;
grant execute on function app.approval_decide(uuid, text, text) to kaname_app;

-- ---------------------------------------------------------------- 待っている承認の後の仕事の片付け（②・②b）
--   止めるのは queued のものだけ（条件つきで書く）。take は for update skip locked で取るので、同じ仕事は「渡される」か「片付けられる」のどちらか 1 つ。
--   消された → 止めた／任せた人が使えない → 止めた（①の文）／承認から 24 時間を過ぎた → やめた・新しい承認待ちで聞き直す（D-127.9・D-128.98）
create or replace function app.ticket_execute_sweep_jobs(p_jobs uuid[]) returns integer
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_id uuid; j bridge_jobs%rowtype; r action_runs%rowtype; ap approvals%rowtype; t tickets%rowtype;
        v_why text; v_24 boolean; n int := 0;
begin
  for v_id in select x from unnest(coalesce(p_jobs, '{}')) x order by x loop
    select * into j from bridge_jobs where id = v_id for update;
    if j.id is null or j.state_id <> 'queued' or j.kind <> 'ticket' then continue; end if;
    select * into r from action_runs where bridge_job_id = j.id order by created_at desc limit 1;
    if r.id is null or r.phase is distinct from 'execute' or r.status_id <> 'queued' then continue; end if;
    select * into ap from approvals where id = r.approval_id;
    select * into t from tickets where id = r.ticket_id;
    v_why := case when t.deleted_at is not null then app.k63_text('gone') else app.ticket_delegator_stop(t.id, j.member_id) end;
    v_24 := v_why is null and (ap.decided_at is null or ap.decided_at <= now() - interval '24 hours');
    if v_why is null and not v_24 then continue; end if;
    -- 仕事を閉じる（引き金 app.ticket_execute_job_end が実行の記録・段・やり取りを書く）
    update bridge_jobs set state_id = case when v_24 then 'cancelled' else 'stopped' end,
           stopped_reason = coalesce(v_why, app.k63_text('expired')), finished_at = now()
     where id = j.id and state_id = 'queued';
    if not found then continue; end if;
    n := n + 1;
    if v_24 and ap.id is not null then
      -- 決まった承認は変えずに（approvals_once）、新しい承認待ちの行で聞き直す。承認する人は今の担当者
      insert into approvals (tenant_id, scope_id, ticket_id, kind, action_run_id, requested_by, approver_member_id, status_id,
                             subject_type, subject_id, irreversible, human_checks, note, created_by)
        values (ap.tenant_id, ap.scope_id, ap.ticket_id, ap.kind, ap.action_run_id, ap.requested_by, t.assignee_member_id, 'pending',
                'approval', ap.id, true, ap.human_checks, app.k63_text('reask'), ap.requested_by);
      perform app.ticket_stage_to(t.id, 'awaiting_approval', null);
    end if;
  end loop;
  return n;
end $$;
revoke all on function app.ticket_execute_sweep_jobs(uuid[]) from public;

-- ② PC が取りに来る前の片付け（その PC の人の、待っている承認の後の仕事）。PC のセッションの人が呼んだ人（要求の PC と同じ）でなければ何もしない（M4）
create or replace function app.ticket_execute_expire(p_session uuid) returns integer
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_member uuid;
begin
  select s.member_id into v_member from sessions s
   where s.id = p_session and s.kind_id = 'bridge' and s.revoked_at is null and s.deleted_at is null;
  if v_member is null or app.user_id() is null or v_member <> app.user_id() then return 0; end if;
  return app.ticket_execute_sweep_jobs(array(
    select j.id from bridge_jobs j join action_runs r on r.bridge_job_id = j.id
     where j.member_id in (select app.account_members(v_member)) and j.kind = 'ticket' and j.state_id = 'queued'
       and j.deleted_at is null and r.phase = 'execute' and r.status_id = 'queued'));
end $$;
revoke all on function app.ticket_execute_expire(uuid) from public;
grant execute on function app.ticket_execute_expire(uuid) to kaname_app;

-- ②b 読むときの片付け：そのチケット 1 枚（見える人だけ）
create or replace function app.ticket_execute_sweep(p_ticket uuid) returns integer
language plpgsql security definer set search_path = public, app, pg_temp as $$
begin
  if not app.member_ok() or not app.ticket_visible(p_ticket) then return 0; end if;
  return app.ticket_execute_sweep_jobs(array(
    select r.bridge_job_id from action_runs r join bridge_jobs j on j.id = r.bridge_job_id
     where r.ticket_id = p_ticket and r.tenant_id = app.tenant_id() and r.phase = 'execute' and r.status_id = 'queued'
       and j.state_id = 'queued'));
end $$;
revoke all on function app.ticket_execute_sweep(uuid) from public;
grant execute on function app.ticket_execute_sweep(uuid) to kaname_app;

-- ②b 読むときの片付け：呼んだ人が今の担当者のチケットの、待っている承認の後の仕事を全部（承認待ちの一覧）
create or replace function app.ticket_execute_sweep_mine() returns integer
language plpgsql security definer set search_path = public, app, pg_temp as $$
begin
  if not app.member_ok() then return 0; end if;
  return app.ticket_execute_sweep_jobs(array(
    select r.bridge_job_id from action_runs r join tickets t on t.id = r.ticket_id join bridge_jobs j on j.id = r.bridge_job_id
     where t.tenant_id = app.tenant_id() and t.assignee_member_id = app.user_id()
       and r.phase = 'execute' and r.status_id = 'queued' and j.state_id = 'queued'));
end $$;
revoke all on function app.ticket_execute_sweep_mine() from public;
grant execute on function app.ticket_execute_sweep_mine() to kaname_app;

-- ---------------------------------------------------------------- ③ 守りの 2 層目：K-62 の bridge_take_job を写し、承認の後の仕事は
--   「許した承認の decided_at が 24 時間以内で、チケットが消されていないもの」だけを渡す条件を足す（行の prompt と agent_session_id はそのまま渡す）
create or replace function app.bridge_take_job(p_session uuid)
returns table (job_id uuid, prompt text, agent_session_id text, conversation_id uuid,
               permission_mode text, model text, effort text, tools text[], allowed_tools text[], attachments jsonb,
               kind text, credential_id uuid, ticket_id uuid, phase text)
language plpgsql security definer set search_path = public, app, pg_temp as $$
#variable_conflict use_column
declare v_member uuid; v_job uuid;
begin
  select s.member_id into v_member from sessions s where s.id = p_session and s.kind_id = 'bridge' and s.revoked_at is null and s.deleted_at is null;
  if v_member is null then return; end if;
  select x.id into v_job from bridge_jobs x
   where x.member_id in (select app.account_members(v_member)) and x.state_id = 'queued' and x.deleted_at is null
     and not exists (select 1 from bridge_jobs y where y.conversation_id = x.conversation_id and y.state_id in ('running', 'asking') and y.deleted_at is null)
     and not exists (select 1 from action_runs ar
                       left join approvals ap on ap.id = ar.approval_id
                       left join tickets tt on tt.id = ar.ticket_id
                      where ar.bridge_job_id = x.id and ar.phase = 'execute'
                        and (ap.decided_at is null or ap.decided_at <= now() - interval '24 hours' or tt.deleted_at is not null))
   order by x.created_at limit 1 for update skip locked;
  if v_job is null then return; end if;
  update bridge_jobs j set state_id = 'running', started_at = now(), taken_session_id = p_session,
         agent_session_id = coalesce(j.agent_session_id, (select c.agent_session_id from conversations c where c.id = j.conversation_id))
   where j.id = v_job;
  update action_runs r set status_id = 'running', started_at = coalesce(r.started_at, now())
   where r.bridge_job_id = v_job and r.status_id = 'queued';
  update credentials c set login_check_state = 'running', login_check_at = now()
   where c.id = (select j.credential_id from bridge_jobs j where j.id = v_job and j.kind = 'login_check') and c.login_check_state = 'pending';
  return query
    select j.id, j.prompt, j.agent_session_id, j.conversation_id, j.permission_mode, j.model, j.effort, j.tools,
           coalesce((select array_agg(r.tool || case when coalesce(r.target_pattern, '') = '' then '' else '(' || r.target_pattern || ')' end)
                       from permission_rules r where r.member_id = j.member_id and r.decision_id = 'allow' and r.revoked_at is null and r.deleted_at is null), '{}'),
           coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'mime', a.mime, 'size', a.size))
                       from attachments a where a.id = any(coalesce(j.attachment_ids, '{}'))), '[]'::jsonb),
           j.kind, j.credential_id,
           (select ar.ticket_id from action_runs ar where ar.bridge_job_id = j.id order by ar.created_at desc limit 1),
           (select ar.phase from action_runs ar where ar.bridge_job_id = j.id order by ar.created_at desc limit 1)
      from bridge_jobs j where j.id = v_job;
end $$;
revoke all on function app.bridge_take_job(uuid) from public;
grant execute on function app.bridge_take_job(uuid) to kaname_app;

-- ---------------------------------------------------------------- ④ 承認の後の仕事の終わり（finish・後始末・止める・片付けのどこから閉じても同じ）
--   中身のある結果 → done。空 → 止まった（E-SIG-004・G-15）。止まった・やめた → その理由。チケットは作業中に戻す（自動で戻さない・D-090）
create or replace function app.ticket_execute_job_end() returns trigger
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare r action_runs%rowtype; v_state text; v_why text; v_ok boolean; v_name text;
begin
  select * into r from action_runs where bridge_job_id = new.id order by created_at desc limit 1;
  if r.id is null or r.phase is distinct from 'execute' or r.status_id not in ('queued', 'running', 'asking') then return null; end if;
  v_ok := new.state_id = 'done' and coalesce(btrim(new.result), '') <> '';
  v_state := case when v_ok then 'done' when new.state_id = 'cancelled' then 'cancelled' else 'stopped' end;
  v_why := case when v_ok then null
                when new.state_id = 'done' then app.k63_text('empty')
                else coalesce(nullif(btrim(new.stopped_reason), ''), '理由は分かりません') end;
  update action_runs set status_id = v_state, error_summary = left(v_why, 400), finished_at = now(), updated_by = r.created_by
   where id = r.id;
  perform app.ticket_stage_to(r.ticket_id, 'doing', null);
  v_name := app.member_name(new.member_id);
  perform app.ticket_system_line(r.ticket_id, null,
    case when v_ok then v_name || 'のAI が実行しました（' || to_char(now() at time zone 'Asia/Tokyo', 'MM/DD HH24:MI') || '）：'
                        || left(btrim(new.result), 200)
         else v_name || 'のAI の実行が止まりました（' || left(v_why, 400) || '）' end);
  return null;
end $$;
revoke all on function app.ticket_execute_job_end() from public;
drop trigger if exists bridge_jobs_ticket_execute_end on bridge_jobs;
create trigger bridge_jobs_ticket_execute_end after update of state_id on bridge_jobs
  for each row when (new.kind = 'ticket' and new.state_id in ('done', 'stopped', 'cancelled') and old.state_id is distinct from new.state_id)
  execute function app.ticket_execute_job_end();

-- ---------------------------------------------------------------- ⑤ 完了にする（確定の時点 ③）
--   答えは {ticket_id, number, completed_at, completed_by, notify_member_ids} か {error[, left | children]}。だめなときは何も書かない
create or replace function app.ticket_complete(p_ticket uuid, p_todo_checked integer[], p_todo_version integer, p_confirmed boolean)
returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_tenant uuid := app.tenant_id(); v_me uuid := app.user_id(); t tickets%rowtype; v_stage text;
        v_sec uuid; v_ver int; v_text text; v_line text; v_lines text[] := '{}'; v_idx int := 0; v_left text[] := '{}';
        v_new text; v_kids jsonb; v_body jsonb; v_notify uuid[];
begin
  if v_tenant is null or v_me is null then return jsonb_build_object('error', 'not_member'); end if;
  select * into t from tickets where id = p_ticket and tenant_id = v_tenant for update;
  if t.id is null or t.deleted_at is not null then return jsonb_build_object('error', 'not_found'); end if;
  begin
    if not app.k63_member_now() then return jsonb_build_object('error', 'not_member'); end if;
    if not app.ticket_writable(t.id) then return jsonb_build_object('error', 'not_writable'); end if;
  exception when others then
    return jsonb_build_object('error', 'guard_failed');
  end;
  select s.key into v_stage from ticket_stages s where s.id = t.stage_id;
  if v_stage = 'done' then return jsonb_build_object('error', 'done'); end if;
  if v_stage in ('awaiting_approval', 'running', 'checking')
     or exists (select 1 from action_runs r where r.ticket_id = t.id and r.status_id in ('queued', 'running', 'asking') and r.deleted_at is null)
     or exists (select 1 from approvals a where a.ticket_id = t.id and a.decision is null and a.withdrawn_at is null and a.deleted_at is null) then
    return jsonb_build_object('error', 'stage');
  end if;
  select s.id, s.version, s.body->>'text' into v_sec, v_ver, v_text
    from ticket_sections s where s.ticket_id = t.id and s.section_key = 'todo' and s.deleted_at is null for update;
  if coalesce(v_ver, 0) <> coalesce(p_todo_version, -1) then return jsonb_build_object('error', 'todo_changed'); end if;
  -- 実施事項：本文の「- 」の行が項目（0 から数える）。「- [x]」は済み。送られた番号は範囲の外なら数えない
  if v_text is not null then
    foreach v_line in array regexp_split_to_array(v_text, E'\n') loop
      if v_line ~ '^\s*- ' then
        if v_line !~ '^\s*- \[[xX]\](\s|$)' and not (v_idx = any(coalesce(p_todo_checked, '{}'))) then
          v_left := v_left || regexp_replace(v_line, '^\s*- (\[[ xX]?\]\s*)?', '');
        end if;
        v_lines := v_lines || regexp_replace(v_line, '^(\s*)- (\[[ xX]?\]\s*)?', '\1- [x] ');
        v_idx := v_idx + 1;
      else
        v_lines := v_lines || v_line;
      end if;
    end loop;
  end if;
  if cardinality(v_left) > 0 then return jsonb_build_object('error', 'todo_left', 'left', to_jsonb(v_left)); end if;
  if p_confirmed is distinct from true then return jsonb_build_object('error', 'not_confirmed'); end if;
  -- 終わっていない子（番号と題名・その子への道すじに使う id）
  select jsonb_agg(jsonb_build_object('id', c.id, 'label', c.number || ' ' || c.title) order by c.number) into v_kids
    from tickets c left join ticket_stages s on s.id = c.stage_id
   where c.parent_ticket_id = t.id and c.deleted_at is null and coalesce(s.key, '') <> 'done';
  if jsonb_array_length(coalesce(v_kids, '[]'::jsonb)) > 0 then
    return jsonb_build_object('error', 'children_left', 'children', v_kids);
  end if;

  -- 書く：実施事項を全部「- [x]」にした新しい版（変わるときだけ）・段・完了の時刻と押した人・やり取り・証跡
  if v_sec is not null then
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
  insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
    values (t.tenant_id, v_me, 'member', 'ticket.complete', 'tickets', t.id::text, 'C2',
            jsonb_build_object('number', t.number, 'knowledge_candidates', 0), v_me);
  -- 知らせる人：担当者と作った人のうち、押した人でない・今のメンバー（D-128.92）
  select coalesce(array_agg(distinct m.id), '{}') into v_notify from members m
   where m.id in (t.assignee_member_id, t.created_by) and m.id <> v_me and m.tenant_id = t.tenant_id
     and m.deleted_at is null and m.suspended_at is null;
  return jsonb_build_object('ticket_id', t.id, 'number', t.number, 'completed_at', t.completed_at, 'completed_by', v_me,
                            'notify_member_ids', to_jsonb(v_notify));
end $$;
revoke all on function app.ticket_complete(uuid, integer[], integer, boolean) from public;
grant execute on function app.ticket_complete(uuid, integer[], integer, boolean) to kaname_app;

-- 完了の知らせを受け箱に残す（関門 C6 の送り先・NotifyGateway の transport と記録だけが呼ぶ）。
--   書けるのは、呼んだ人が完了にしたチケットの、担当者か作った人への 1 通だけ。本文はチケットの id・番号・リンクだけ（TP-MAIL-03）
create or replace function app.ticket_completed_notice(p_ticket uuid, p_member uuid, p_dedupe text, p_sent boolean, p_attempts integer)
returns boolean
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare t tickets%rowtype;
begin
  select * into t from tickets where id = p_ticket and tenant_id = app.tenant_id() and completed_by = app.user_id() and deleted_at is null;
  if t.id is null or p_member is null or p_member not in (t.assignee_member_id, t.created_by) or p_member = app.user_id()
     or coalesce(p_dedupe, '') !~ ('ticket\.completed:' || p_ticket::text || '$') then
    return false;
  end if;
  update notifications set sent_at = case when p_sent then now() end, failed_at = case when p_sent then null else now() end,
         retry_count = greatest(coalesce(p_attempts, 1), 1)
   where tenant_id = t.tenant_id and dedupe_key = p_dedupe and sent_at is null;
  if not found and not exists (select 1 from notifications where tenant_id = t.tenant_id and dedupe_key = p_dedupe) then
    insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, dedupe_key, sent_at, failed_at, retry_count, created_by)
      values (t.tenant_id, p_member, 'inapp', 'ticket.completed',
              jsonb_build_object('ticket_id', t.id, 'number', t.number, 'url', '/tickets/' || t.id::text), p_dedupe,
              case when p_sent then now() end, case when p_sent then null else now() end,
              case when p_sent then null else greatest(coalesce(p_attempts, 1), 1) end, app.user_id());
  end if;
  return true;
end $$;
revoke all on function app.ticket_completed_notice(uuid, uuid, text, boolean, integer) from public;
grant execute on function app.ticket_completed_notice(uuid, uuid, text, boolean, integer) to kaname_app;

-- ---------------------------------------------------------------- ⑥ 読む関数
-- 承認の行の形（一覧・帯）
create or replace function app.approval_item_json(p_approval uuid) returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  select jsonb_build_object(
           'kind', a.kind, 'id', a.id, 'ticket_id', t.id, 'ticket_number', t.number, 'title', t.title,
           'from_member_id', a.requested_by, 'from_name', app.member_name(a.requested_by),
           'check_summary', app.k63_text('check_none'),
           'due_on', to_char(t.due_on, 'YYYY-MM-DD'),
           'decide_inline', not a.irreversible and coalesce(a.human_checks, '[]'::jsonb) = '[]'::jsonb,
           'irreversible', a.irreversible,
           'primary_action', case when not a.irreversible and coalesce(a.human_checks, '[]'::jsonb) = '[]'::jsonb then 'approve' else 'open' end,
           'secondary_action', 'return', 'note', a.note, 'created_at', a.created_at)
    from approvals a join tickets t on t.id = a.ticket_id where a.id = p_approval
$$;
revoke all on function app.approval_item_json(uuid) from public;

-- 承認待ちの一覧：承認する人＝今の担当者が呼んだ人のもの。期限の早い順（期限なしは最後）・同じなら古い順
create or replace function app.approval_queue() returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  select case when app.member_ok() then
    coalesce((select jsonb_agg(app.approval_item_json(x.id) order by x.due_on asc nulls last, x.created_at asc, x.id)
                from (select a.id, t.due_on, a.created_at from approvals a join tickets t on t.id = a.ticket_id
                       where a.tenant_id = app.tenant_id() and t.tenant_id = app.tenant_id() and t.deleted_at is null
                         and t.assignee_member_id = app.user_id() and a.kind = 'artifact'
                         and a.decision is null and a.withdrawn_at is null and a.deleted_at is null
                         and app.ticket_draft_ok(t.draft_import_id, app.user_id())) x), '[]'::jsonb)
  else '[]'::jsonb end
$$;
revoke all on function app.approval_queue() from public;
grant execute on function app.approval_queue() to kaname_app;

-- 承認の 1 件（読めるのは承認する人・マネージャー・作った人・任せた人）。読めなければ null
create or replace function app.approval_detail(p_approval uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare a approvals%rowtype; t tickets%rowtype; v_stage text; v_ver int; v_text text; v_open boolean; v_approver uuid; v_can boolean;
begin
  if not app.member_ok() or not app.approval_readable(p_approval) then return null; end if;
  select * into a from approvals where id = p_approval;
  select * into t from tickets where id = a.ticket_id;
  select s.key into v_stage from ticket_stages s where s.id = t.stage_id;
  select s.version, s.body->>'text' into v_ver, v_text from ticket_sections s
   where s.ticket_id = t.id and s.section_key = 'artifacts' and s.deleted_at is null;
  v_open := a.decision is null and a.withdrawn_at is null;
  v_approver := case when v_open then t.assignee_member_id else a.approver_member_id end;
  v_can := v_open and t.assignee_member_id = app.user_id() and app.k63_member_now() and app.ticket_writable(t.id);
  return jsonb_build_object(
    'approval', jsonb_build_object('id', a.id, 'kind', a.kind, 'status_id', a.status_id, 'decision', a.decision,
                                   'decided_at', a.decided_at, 'irreversible', a.irreversible, 'note', a.note,
                                   'approver_member_id', v_approver,
                                   'approver_name', case when v_approver is not null then app.member_name(v_approver) end,
                                   'created_at', a.created_at),
    'ticket', jsonb_build_object('id', t.id, 'number', t.number, 'title', t.title, 'stage_key', v_stage),
    'artifact_version', jsonb_build_object('version', coalesce(v_ver, 0), 'text', coalesce(v_text, '')),
    'checks', '[]'::jsonb, 'check_summary', app.k63_text('check_none'),
    'cautions', case when a.irreversible then jsonb_build_array('取り消せません。承認すると、AI が外へ出します（送る・応募する など）')
                     else '[]'::jsonb end
                || case when a.note is not null then jsonb_build_array(a.note) else '[]'::jsonb end,
    'irreversible', a.irreversible, 'can_decide', coalesce(v_can, false), 'chain', '[]'::jsonb);
end $$;
revoke all on function app.approval_detail(uuid) from public;
grant execute on function app.approval_detail(uuid) to kaname_app;

-- チケットの詳細の帯（getTicket が足す）：決まっていない承認待ち 1 つ・完了にできるか・段の鍵。今の実行は返さない（K-62 の口で読む）
create or replace function app.ticket_band(p_ticket uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare t tickets%rowtype; v_stage text; v_app uuid; v_can_decide boolean; v_complete boolean;
begin
  if not app.member_ok() or not app.ticket_visible(p_ticket) then return null; end if;
  select * into t from tickets where id = p_ticket;
  select s.key into v_stage from ticket_stages s where s.id = t.stage_id;
  select a.id into v_app from approvals a
   where a.ticket_id = t.id and a.kind = 'artifact' and a.decision is null and a.withdrawn_at is null and a.deleted_at is null
   order by a.created_at desc limit 1;
  v_can_decide := v_app is not null and t.assignee_member_id = app.user_id() and app.k63_member_now() and app.ticket_writable(t.id);
  v_complete := t.deleted_at is null and app.k63_member_now() and app.ticket_writable(t.id)
                and coalesce(v_stage, '') not in ('awaiting_approval', 'running', 'checking', 'done')
                and v_app is null
                and not exists (select 1 from action_runs r where r.ticket_id = t.id and r.status_id in ('queued', 'running', 'asking') and r.deleted_at is null);
  return jsonb_build_object(
    'approval', case when v_app is not null then
                  app.approval_item_json(v_app) || jsonb_build_object('can_decide', coalesce(v_can_decide, false),
                    'approver_member_id', t.assignee_member_id,
                    'approver_name', case when t.assignee_member_id is not null then app.member_name(t.assignee_member_id) end) end,
    'can_complete', coalesce(v_complete, false),
    'stage_key', v_stage,
    'completed_at', t.completed_at,
    'completed_by', case when t.completed_by is not null then
                      jsonb_build_object('member_id', t.completed_by, 'display_name', app.member_name(t.completed_by)) end);
end $$;
revoke all on function app.ticket_band(uuid) from public;
grant execute on function app.ticket_band(uuid) to kaname_app;

insert into app.schema_migrations (name) values ('0092_approve_complete.sql') on conflict do nothing;
