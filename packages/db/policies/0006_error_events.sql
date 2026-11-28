-- RLS（機械生成：scripts/ci/gen_rls.py ← 07_functional/entities.json の access_control_policies。手で直さない）

alter table error_events enable row level security;
alter table error_events force row level security;
drop policy if exists error_events_tenant_read on error_events;
create policy error_events_tenant_read on error_events for select using (app.member_ok() AND (tenant_id = app.tenant_id()));
drop policy if exists error_events_self_only_write_insert on error_events;
create policy error_events_self_only_write_insert on error_events for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND member_id = app.user_id()));
drop policy if exists error_events_self_only_write_update on error_events;
create policy error_events_self_only_write_update on error_events for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND member_id = app.user_id())) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND member_id = app.user_id()));
drop policy if exists error_events_self_only_write_delete on error_events;
create policy error_events_self_only_write_delete on error_events for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND member_id = app.user_id()));
drop policy if exists error_events_permission_write_insert on error_events;
create policy error_events_permission_write_insert on error_events for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'error_events', NULL, 'edit')));
drop policy if exists error_events_permission_write_update on error_events;
create policy error_events_permission_write_update on error_events for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'error_events', NULL, 'edit'))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'error_events', NULL, 'edit')));
drop policy if exists error_events_permission_write_delete on error_events;
create policy error_events_permission_write_delete on error_events for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'error_events', NULL, 'edit')));
drop policy if exists error_events_ops_read_with_grant on error_events;
create policy error_events_ops_read_with_grant on error_events for select using (app.ops_grant_ok(error_events.tenant_id));
