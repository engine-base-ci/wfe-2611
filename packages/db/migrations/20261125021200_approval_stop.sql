-- 20261125021200_approval_stop 承認待ちを使わずに止める（K-732・契約の口 stopApproval・関門 C2・D-128.25・D-128.171・D-153.7・D-153.26）
--   列も表も足さない（approvals.decision の 'stop' と status_id の自由な文字はもう在る・approvals_decision_ck）。足すのは関数 1 本（app.approval_stop）。
--   守りは app.approval_decide（0100）と同じ：今のメンバー・今の担当者（承認する人）・チケットを書ける。判定の例外は guard_failed（何も書かない）。
--   成果物（区画 artifacts の版）は消さず変えない。お知らせ（受け箱）は書かない（止められるのは今の担当者だけ＝止めた本人あては出さない・D-153.7）。
--   security definer・search_path に pg_temp・public から外す（D-128.171）。

create or replace function app.approval_stop(p_approval uuid) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_tenant uuid := app.tenant_id(); v_me uuid := app.user_id(); a approvals%rowtype; t tickets%rowtype;
        v_err text; v_ver int;
begin
  if v_tenant is null or v_me is null then return jsonb_build_object('error', 'not_member'); end if;
  -- 同じ承認の同時の 2 本（止める × 止める・承認 × 止める）は承認の行で待ち合わせる。後の 1 本は決まった後の行を見る
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
  if a.decision is not null or a.withdrawn_at is not null or a.resolved_at is not null then
    return jsonb_build_object('error', 'decided');
  end if;

  -- 決める（承認する人は決めた時点の担当者に書き直す）。成果物は使わない・消さない
  update approvals set decision = 'stop', decided_at = now(), resolved_at = now(), status_id = 'stopped',
         approver_member_id = v_me, updated_by = v_me
   where id = a.id returning * into a;
  perform app.ticket_stage_to(t.id, 'doing', v_me);
  update tickets set delegated_to_clone = false where id = t.id;
  select s.version into v_ver from ticket_sections s
   where s.ticket_id = t.id and s.section_key = 'artifacts' and s.deleted_at is null;
  perform app.ticket_system_line(t.id, v_me,
    app.member_name(v_me) || 'が承認待ちを止めました（成果物の版 ' || coalesce(v_ver, 0) || ' は残っています）');
  insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
    values (t.tenant_id, v_me, 'member', 'approval.stop', 'approvals', a.id::text, 'C2',
            jsonb_build_object('decision', 'stop', 'ticket_id', t.id), v_me);
  return jsonb_build_object('id', a.id, 'decision', a.decision, 'decided_at', a.decided_at, 'status_id', a.status_id,
                            'ticket_id', t.id);
end $$;
revoke all on function app.approval_stop(uuid) from public;
grant execute on function app.approval_stop(uuid) to kaname_app;
