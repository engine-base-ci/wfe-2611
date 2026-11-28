-- 0097 差し戻す（K-163・K-63 の孫・D-125.103・D-128.176・D-131.1・D-131.5）
--   app.approval_decide（0096・K-162）に差し戻し（return）を足す。差し戻しは、理由（空なら reason_empty）を承認の行に残し（next_actor clone）、
--   任せた人の AI に理由つきの作り直しの仕事（作る段・許可は manual）を積む。作り直しの実行の created_by は任せた人。新しい表は作らない
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

insert into app.schema_migrations (name) values ('0097_approve_return.sql') on conflict do nothing;
