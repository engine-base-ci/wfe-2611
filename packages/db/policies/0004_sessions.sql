-- RLS（機械生成：scripts/ci/gen_rls.py ← 07_functional/entities.json の access_control_policies。手で直さない）

alter table sessions enable row level security;
alter table sessions force row level security;
drop policy if exists sessions_tenant_read on sessions;
create policy sessions_tenant_read on sessions for select using (app.member_ok() AND (tenant_id = app.tenant_id()));
drop policy if exists sessions_permission_write_insert on sessions;
create policy sessions_permission_write_insert on sessions for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'sessions', NULL, 'edit')));
drop policy if exists sessions_permission_write_update on sessions;
create policy sessions_permission_write_update on sessions for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'sessions', NULL, 'edit'))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'sessions', NULL, 'edit')));
drop policy if exists sessions_permission_write_delete on sessions;
create policy sessions_permission_write_delete on sessions for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'sessions', NULL, 'edit')));
drop policy if exists sessions_ops_read_with_grant on sessions;
create policy sessions_ops_read_with_grant on sessions for select using (app.ops_grant_ok(sessions.tenant_id));

alter table invitations enable row level security;
alter table invitations force row level security;
drop policy if exists invitations_tenant_read on invitations;
create policy invitations_tenant_read on invitations for select using (app.member_ok() AND (tenant_id = app.tenant_id()));
drop policy if exists invitations_permission_write_insert on invitations;
create policy invitations_permission_write_insert on invitations for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'invitations', NULL, 'edit')));
drop policy if exists invitations_permission_write_update on invitations;
create policy invitations_permission_write_update on invitations for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'invitations', NULL, 'edit'))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'invitations', NULL, 'edit')));
drop policy if exists invitations_permission_write_delete on invitations;
create policy invitations_permission_write_delete on invitations for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'invitations', NULL, 'edit')));
drop policy if exists invitations_ops_read_with_grant on invitations;
create policy invitations_ops_read_with_grant on invitations for select using (app.ops_grant_ok(invitations.tenant_id));

alter table session_kinds enable row level security;
alter table session_kinds force row level security;
drop policy if exists session_kinds_all_read on session_kinds;
create policy session_kinds_all_read on session_kinds for select using (coalesce(current_setting('app.user_id', true), '') <> '' AND (true));
drop policy if exists session_kinds_ops_write_insert on session_kinds;
create policy session_kinds_ops_write_insert on session_kinds for insert with check (current_setting('app.role', true) = 'ops');
drop policy if exists session_kinds_ops_write_update on session_kinds;
create policy session_kinds_ops_write_update on session_kinds for update using (current_setting('app.role', true) = 'ops') with check (current_setting('app.role', true) = 'ops');
drop policy if exists session_kinds_ops_write_delete on session_kinds;
create policy session_kinds_ops_write_delete on session_kinds for delete using (current_setting('app.role', true) = 'ops');

alter table revoke_reasons enable row level security;
alter table revoke_reasons force row level security;
drop policy if exists revoke_reasons_all_read on revoke_reasons;
create policy revoke_reasons_all_read on revoke_reasons for select using (coalesce(current_setting('app.user_id', true), '') <> '' AND (true));
drop policy if exists revoke_reasons_ops_write_insert on revoke_reasons;
create policy revoke_reasons_ops_write_insert on revoke_reasons for insert with check (current_setting('app.role', true) = 'ops');
drop policy if exists revoke_reasons_ops_write_update on revoke_reasons;
create policy revoke_reasons_ops_write_update on revoke_reasons for update using (current_setting('app.role', true) = 'ops') with check (current_setting('app.role', true) = 'ops');
drop policy if exists revoke_reasons_ops_write_delete on revoke_reasons;
create policy revoke_reasons_ops_write_delete on revoke_reasons for delete using (current_setting('app.role', true) = 'ops');
