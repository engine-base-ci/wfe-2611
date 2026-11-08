-- RLS（機械生成：scripts/ci/gen_rls.py ← 07_functional/entities.json の access_control_policies。手で直さない）

alter table approvals enable row level security;
alter table approvals force row level security;
do $$ declare r record; begin for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'approvals' and policyname <> all (array['approvals_decide', 'approvals_ops_read_with_grant', 'approvals_read', 'approvals_request']::name[]) loop execute format('drop policy %I on approvals', r.policyname); end loop; end $$;
drop policy if exists approvals_read on approvals;
create policy approvals_read on approvals for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND (scope_id = ANY(visible_scopes(app.user_id())) OR approver_member_id = app.user_id() OR requested_by = app.user_id() OR (ticket_id IS NOT NULL AND app.ticket_visible(ticket_id)) OR (ticket_id IS NOT NULL AND app.ticket_assignee_is_me(ticket_id)))));
drop policy if exists approvals_request on approvals;
create policy approvals_request on approvals for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND requested_by = app.user_id() AND (ticket_id IS NULL OR app.ticket_writable(ticket_id))));
drop policy if exists approvals_decide on approvals;
create policy approvals_decide on approvals for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND (approver_member_id = app.user_id() OR requested_by = app.user_id() OR has_permission(app.user_id(), 'approvals', scope_id, 'edit')))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND (approver_member_id = app.user_id() OR requested_by = app.user_id() OR has_permission(app.user_id(), 'approvals', scope_id, 'edit'))));
drop policy if exists approvals_ops_read_with_grant on approvals;
create policy approvals_ops_read_with_grant on approvals for select using (app.ops_grant_ok(approvals.tenant_id));
