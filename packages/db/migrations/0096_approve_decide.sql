-- 0096 承認する（K-162・K-63 の孫・D-012・D-125.19・D-125.102・D-125.107・D-127.9・D-128.25・D-128.36・D-128.98・D-128.138・D-128.156・D-128.171・D-128.176・D-128.177・D-128.178・D-131.3・D-131.5・D-131.11・D-131.14）
--   番号は取り込む順の次の空き番号（K-161 の 0095 の次・付け替え済み）。新しい表は作らない。足すのは列 bridge_jobs.resume_session_id と関数。
--   確定の時点：承認の行に決めたこと（approve）・時刻（decided_at）・状態（approved）・解いた時刻（resolved_at）を、
--     実行の記録と仕事・チケットの段・やり取りの 1 行・証跡と一緒に 1 つの処理で書いた時点（app.approval_decide）。決まった承認は変えられない（0063 の approvals_once）。
--   差し戻し（return）は K-163 が app.approval_decide を create or replace で足す。この孫では approve 以外は bad_decision。
--   どの関数も p_member を受けず、呼んだ人を app.user_id() で引く。security definer・search_path に pg_temp・public から外し kaname_app だけに渡す（D-128.171）。
--   中だけで使う関数は誰にも execute を渡さない。

-- ⓪ 制約と列
-- 承認では本人確認を取り直さない（D-128.177 が D-125.139 の承認の分を改めた）。承認は全部「取り消せない」で記録するので、
--   取り消せない承認に step_up_at を求める制約（0077）を外す（外さないと承認が 1 つも書けない）
-- squawk-ignore ban-drop-constraint
alter table approvals drop constraint if exists approvals_step_up_ck;
-- その仕事の agent_session_id の記録を持つ PC（前の作る段の仕事を取った PC）。取りに来た PC と同じときだけ続きを渡す（D-131.3）
alter table bridge_jobs add column if not exists resume_session_id uuid references sessions(id);

-- ---------------------------------------------------------------- 中だけで使う関数（誰にも execute を渡さない）
-- 呼んだ人が、この会社の今のメンバーか（抜けた・止められた人は通さない）
create or replace function app.approval_member_now() returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select app.member_ok()
     and exists (select 1 from members m where m.id = app.user_id() and m.tenant_id = app.tenant_id()
                   and m.deleted_at is null and m.suspended_at is null)
$$;
revoke all on function app.approval_member_now() from public;

-- 任せた人（作る段の仕事を動かした人）が実行に使えるか。使えなければ止める理由の文（D-128.176）。使えれば null
create or replace function app.ticket_delegator_stop(p_ticket uuid, p_member uuid) returns text
language sql stable security definer set search_path = public, app, pg_temp as $$
  select case
    when p_member is null
      or not exists (select 1 from members m join tickets t on t.tenant_id = m.tenant_id
                      where m.id = p_member and t.id = p_ticket and m.deleted_at is null and m.suspended_at is null)
      then 'AI に任せた人がこのワークスペースにいないので、実行を止めました'
    when not app.ticket_writable_for(p_ticket, p_member)
      then 'AI に任せた人がこのチケットを直せなくなったので、実行を止めました'
    when not exists (select 1 from sessions s where s.member_id in (select app.account_members(p_member)) and s.kind_id = 'bridge'
                        and s.revoked_at is null and s.deleted_at is null)
      then 'AI に任せた人の PC がつながっていない（外した）ので、実行を止めました'
  end
$$;
revoke all on function app.ticket_delegator_stop(uuid, uuid) from public;

-- ---------------------------------------------------------------- 承認する（確定の時点）
--   答えは {id, decision, decided_at, status_id, ticket_id, run_id, pc} か {error}。だめなときは何も書かない。
--   承認する人＝今のチケットの担当者（担当者がいなければ誰も承認できない）。その判定は p_decision より先に見る（K63-API-051）。
--   守りの判定（今のメンバーか・承認する人か・書けるか）の所で例外になったら、外に投げずに guard_failed（fail-closed・口は 503・K63-API-059）。
--   書く所の失敗は例外のまま外に出す（1 つの処理なので何も残らない・口は 500・K63-API-042）
create or replace function app.approval_decide(p_approval uuid, p_decision text, p_reason text) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_tenant uuid := app.tenant_id(); v_me uuid := app.user_id(); a approvals%rowtype; t tickets%rowtype;
        v_err text; v_by uuid; v_ctx jsonb; v_sess text; v_resume uuid; v_why text; v_job uuid; v_run uuid;
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
  if p_decision is distinct from 'approve' then return jsonb_build_object('error', 'bad_decision'); end if;   -- return は K-163
  if a.decision is not null or a.withdrawn_at is not null or a.resolved_at is not null then
    return jsonb_build_object('error', 'decided');
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
  update approvals set decision = 'approve', decided_at = now(), resolved_at = now(), status_id = 'approved',
         irreversible = true, approver_member_id = v_me, updated_by = v_me
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
              || E'\n\n## 承認されました\n承認された成果物を実行してください。上の「外には何も出さず」は、この実行には当てはまりません。'
              || 'チケットの区画「成果物」の中身を、そのとおりに外へ出してください（送る・応募する など）。'
              || '終わったら、何をしたか（宛先・時刻）を最後の返事の本文で返してください。',
            v_sess, v_resume, 'ticket', 'auto',   -- 承認の後の実行は auto（D-128.177）
            v_why, case when v_why is not null then now() end, v_me)
    returning id into v_job;
  insert into action_runs (tenant_id, scope_id, ticket_id, phase, status_id, bridge_job_id, approval_id, error_summary, finished_at,
                           created_by, updated_by)
    values (t.tenant_id, t.scope_id, t.id, 'execute', case when v_why is null then 'queued' else 'stopped' end, v_job, a.id,
            v_why, case when v_why is not null then now() end, v_me, v_me)
    returning id into v_run;
  -- 任せた人が使えなければ、承認は記録し、実行はすぐ止めてチケットは作業中（M3）
  perform app.ticket_stage_to(t.id, case when v_why is null then 'running' else 'doing' end, v_me);
  perform app.ticket_system_line(t.id, v_me,
    app.member_name(v_me) || 'が承認しました' || case when v_why is not null then '。' || v_why else '' end);
  insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
    values (t.tenant_id, v_me, 'member', 'approval.approve', 'approvals', a.id::text, 'C2',
            jsonb_build_object('decision', 'approve', 'ticket_id', t.id, 'run_id', v_run, 'stopped', v_why is not null), v_me);
  return jsonb_build_object('id', a.id, 'decision', a.decision, 'decided_at', a.decided_at, 'status_id', a.status_id,
                            'ticket_id', t.id, 'run_id', v_run,
                            'pc', case when app.account_pc_live(v_by) then 'live' else 'asleep' end);   -- 75 秒の式（0092 と同じ）
end $$;
revoke all on function app.approval_decide(uuid, text, text) from public;
grant execute on function app.approval_decide(uuid, text, text) to kaname_app;

-- ---------------------------------------------------------------- チケットの詳細の帯（getTicket の approval）
--   決まっていない成果物の承認待ち 1 つ（{ id, can_decide, irreversible, note, approver_name }）か null と、段の鍵。
--   can_decide は呼んだ人が今のメンバー・今の担当者・書ける とき。担当者がいなければ approver_name は null で can_decide は偽。
--   チケットが見えなければ null（呼ぶ側の getTicket が先に見えるかを確かめる）。読むだけで書き換えない
create or replace function app.ticket_band(p_ticket uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare t tickets%rowtype; a approvals%rowtype; v_stage text; v_can boolean;
begin
  select * into t from tickets where id = p_ticket and tenant_id = app.tenant_id() and deleted_at is null;
  if t.id is null or not app.member_ok() or not app.ticket_visible(p_ticket) then return null; end if;
  select s.key into v_stage from ticket_stages s where s.id = t.stage_id;
  select * into a from approvals x
   where x.ticket_id = t.id and x.kind = 'artifact' and x.decision is null and x.withdrawn_at is null and x.deleted_at is null
   order by x.created_at desc limit 1;
  if a.id is null then return jsonb_build_object('approval', null, 'stage_key', v_stage); end if;
  v_can := app.approval_member_now() and t.assignee_member_id = app.user_id() and app.ticket_writable(t.id);
  return jsonb_build_object(
    'approval', jsonb_build_object('id', a.id, 'can_decide', coalesce(v_can, false), 'irreversible', a.irreversible,
                                   'note', a.note,
                                   'approver_name', case when t.assignee_member_id is not null then app.member_name(t.assignee_member_id) end),
    'stage_key', v_stage);
end $$;
revoke all on function app.ticket_band(uuid) from public;
grant execute on function app.ticket_band(uuid) to kaname_app;

-- ---------------------------------------------------------------- 守りの 2 層目：仕事を 1 件渡す（K-62 の 0092 の本体を写し、条件を足す）
--   足すのは 2 つだけ：① 承認の後の実行（phase execute）の仕事は、許した承認が approve で decided_at から 24 時間以内、チケットが消されていないものだけ渡す（D-128.98）
--                    ② 続きの記録を持つ PC（resume_session_id）がある仕事は、取りに来た PC が同じときだけ agent_session_id を渡し、違えば空で渡す（行は消さない・D-131.3）。
--                       resume_session_id が無い行は 0092 のまま（K62-API-049：行の agent_session_id をそのまま渡す）
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
     -- ① 承認の後の実行は、24 時間以内に許され、チケットが消されていないものだけ
     and not exists (select 1 from action_runs ar
                      where ar.bridge_job_id = x.id and ar.phase = 'execute'
                        and not exists (select 1 from approvals ap join tickets tk on tk.id = ar.ticket_id
                                         where ap.id = ar.approval_id and ap.decision = 'approve'
                                           and ap.decided_at > now() - interval '24 hours' and tk.deleted_at is null))
   order by x.created_at limit 1 for update skip locked;
  if v_job is null then return; end if;
  update bridge_jobs j set state_id = 'running', started_at = now(), taken_session_id = p_session,
         agent_session_id = coalesce(j.agent_session_id, (select c.agent_session_id from conversations c where c.id = j.conversation_id))
   where j.id = v_job;
  -- チケットの仕事の会話の続きは、同じ人が同じ PC で任せたときだけ（D-129.46）。その番号を出した前の仕事を受け取った PC が違えば、新しい会話で始める
  update bridge_jobs j set agent_session_id = null
   where j.id = v_job and j.kind = 'ticket' and j.agent_session_id is not null and j.resume_session_id is null
     and (select ar.phase from action_runs ar where ar.bridge_job_id = j.id order by ar.created_at desc limit 1) = 'make'   -- 承認の後の実行（K-63 が積む）は行のまま渡す（D-128.176・K62-API-049）
     and not exists (select 1 from bridge_jobs j2
                      where j2.id <> j.id and j2.kind = 'ticket' and j2.agent_session_id = j.agent_session_id
                        and j2.taken_session_id = p_session);
  update action_runs r set status_id = 'running', started_at = coalesce(r.started_at, now())
   where r.bridge_job_id = v_job and r.status_id = 'queued';
  update credentials c set login_check_state = 'running', login_check_at = now()
   where c.id = (select j.credential_id from bridge_jobs j where j.id = v_job and j.kind = 'login_check') and c.login_check_state = 'pending';
  return query
    select j.id, j.prompt,
           -- ② 続きの記録を持つ PC が決まっている仕事は、その PC が取ったときだけ続きを渡す（行の値は残す）
           case when j.resume_session_id is null or j.resume_session_id = p_session then j.agent_session_id end,
           j.conversation_id, j.permission_mode, j.model, j.effort, j.tools,
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

insert into app.schema_migrations (name) values ('0096_approve_decide.sql') on conflict do nothing;
