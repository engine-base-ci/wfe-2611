-- 20261125021300_approval_withdraw 承認を取り下げる（K-733・契約の口 withdrawApproval・関門 C2・D-125.105・D-128.25・D-128.98・D-131.14・D-153.7・D-153.21・D-153.27）
--   列も表も足さない（approvals.withdrawn_at は 0077 で在る）。足すのは関数 1 本（app.approval_withdraw）。
--   取り下げられるのは承認した本人（approvals.approver_member_id＝承認を決めたときの担当者）が、PC がまだ仕事を受け取っていない間だけ。
--   決まった承認は変えられない（0063 の approvals_once）ので、決まった行には取り下げの印（withdrawn_at）だけを付け、
--   同じ成果物の新しい承認待ちの行を作る（承認の後の 24 時間の聞き直し〔0098〕と同じ作り）。
--   実行の記録を先に cancelled にしてから仕事を cancelled にする（仕事を閉じた引き金 app.ticket_execute_job_end〔0098〕を空振りさせ、やり取りの行を二重にしない）。
--   仕事の cancelled は人が承認を取り下げたときだけ（D-131.14）。
--   PC の取り（app.bridge_take_job）は仕事の行を for update skip locked で取り、その後に実行の行を書く。ここも仕事 → 実行の順で for update で取り、
--   取った後に状態をもう一度見る（取りと取り下げが同時なら、どちらか一方だけが勝つ・待ち合わせの順も同じなので行き詰まらない）。
--   お知らせ（受け箱）はチケットの今の担当者だけに 1 件。取り下げた本人が担当者なら出さない（任せた人には出さない・D-153.7）。
--   security definer・search_path に pg_temp・public から外す（D-128.171）。

create or replace function app.approval_withdraw(p_approval uuid) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_tenant uuid := app.tenant_id(); v_me uuid := app.user_id(); a approvals%rowtype; t tickets%rowtype;
        r action_runs%rowtype; j bridge_jobs%rowtype; v_run uuid; v_job uuid; v_err text; v_new uuid; v_at timestamptz;
begin
  if v_tenant is null or v_me is null then return jsonb_build_object('error', 'not_member'); end if;
  -- 同じ承認の同時の 2 本（取り下げ × 取り下げ）は承認の行で待ち合わせる。後の 1 本は取り下げた後の行を見る
  select * into a from approvals where id = p_approval and tenant_id = v_tenant for update;
  if a.id is null or a.deleted_at is not null or a.ticket_id is null or a.kind is distinct from 'artifact' then
    return jsonb_build_object('error', 'not_found');   -- 成果物でない承認も見つからない（D-131.11）
  end if;
  select * into t from tickets where id = a.ticket_id and tenant_id = v_tenant for update;
  if t.id is null or t.deleted_at is not null then return jsonb_build_object('error', 'not_found'); end if;
  begin
    if not app.approval_member_now() then v_err := 'not_member';
    elsif a.approver_member_id is null or a.approver_member_id <> v_me then v_err := 'not_approver';
    elsif not app.ticket_writable(t.id) then v_err := 'not_writable';
    end if;
  exception when others then
    return jsonb_build_object('error', 'guard_failed');
  end;
  if v_err is not null then return jsonb_build_object('error', v_err); end if;
  if a.decision is distinct from 'approve' or a.withdrawn_at is not null then
    return jsonb_build_object('error', 'not_withdrawable');
  end if;

  -- 承認の後の実行（一番新しい行）と、その仕事。仕事 → 実行の順で取る（PC の取りと同じ順）
  select ar.id, ar.bridge_job_id into v_run, v_job from action_runs ar
   where ar.approval_id = a.id and ar.phase = 'execute' order by ar.created_at desc limit 1;
  if v_run is null then return jsonb_build_object('error', 'not_withdrawable'); end if;
  if v_job is not null then select * into j from bridge_jobs where id = v_job for update; end if;
  select * into r from action_runs where id = v_run for update;

  -- 間に合ったかを 1 つで決める
  if r.status_id in ('running', 'asking') then return jsonb_build_object('error', 'late'); end if;
  if r.status_id = 'done' then return jsonb_build_object('error', 'ended'); end if;
  if r.status_id in ('stopped', 'cancelled') then
    if j.id is not null and (j.taken_session_id is not null or j.started_at is not null) then
      return jsonb_build_object('error', 'ended');       -- PC が受け取った後に止まった
    end if;
    return jsonb_build_object('error', 'not_withdrawable'); -- PC が受け取る前に片付けられた（24 時間・人が止めた・止められた）
  end if;
  if r.status_id <> 'queued' then return jsonb_build_object('error', 'not_withdrawable'); end if;
  if j.id is null or j.state_id <> 'queued' then return jsonb_build_object('error', 'late'); end if;   -- 取りの途中

  -- 取り下げる。実行の記録を先に閉じ（引き金を空振りさせる）、そのあと仕事を閉じる
  update action_runs set status_id = 'cancelled', error_summary = '承認が取り下げられました', finished_at = now(), updated_by = v_me
   where id = r.id;
  update bridge_jobs set state_id = 'cancelled', stopped_reason = '承認が取り下げられました', finished_at = now(), partial = null
   where id = j.id;
  update approvals set withdrawn_at = now(), updated_by = v_me where id = a.id returning withdrawn_at into v_at;
  insert into approvals (tenant_id, scope_id, ticket_id, kind, action_run_id, requested_by, approver_member_id, status_id,
                         subject_type, subject_id, irreversible, human_checks, created_by)
    values (a.tenant_id, a.scope_id, a.ticket_id, a.kind, a.action_run_id, a.requested_by, t.assignee_member_id, 'pending',
            a.subject_type, a.subject_id, a.irreversible, a.human_checks, a.requested_by)
    returning id into v_new;
  perform app.ticket_stage_to(t.id, 'awaiting_approval', v_me);
  update tickets set delegated_to_clone = false where id = t.id;
  perform app.ticket_system_line(t.id, v_me, app.member_name(v_me) || 'が承認を取り下げました（承認待ちに戻りました）');

  -- お知らせは今の担当者だけ（取り下げた本人なら出さない・今のメンバーでなければ出さない）
  if t.assignee_member_id is not null and t.assignee_member_id <> v_me
     and exists (select 1 from members m where m.id = t.assignee_member_id and m.deleted_at is null and m.suspended_at is null) then
    insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, dedupe_key, sent_at, created_by)
      values (t.tenant_id, t.assignee_member_id, 'inapp', 'approval.withdrawn',
              jsonb_build_object('ticket_id', t.id, 'number', t.number, 'url', '/tickets/' || t.id::text),
              'approval_withdrawn:' || a.id::text, now(), v_me);
  end if;

  insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
    values (t.tenant_id, v_me, 'member', 'approval.withdraw', 'approvals', a.id::text, 'C2',
            jsonb_build_object('ticket_id', t.id, 'new_approval_id', v_new), v_me);
  return jsonb_build_object('id', a.id, 'withdrawn_at', v_at, 'ticket_id', t.id, 'approval_id', v_new);
end $$;
revoke all on function app.approval_withdraw(uuid) from public;
grant execute on function app.approval_withdraw(uuid) to kaname_app;
