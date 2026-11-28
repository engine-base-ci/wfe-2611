-- RLS（機械生成：scripts/ci/gen_rls.py ← 07_functional/entities.json の access_control_policies。手で直さない）

alter table audit_events enable row level security;
alter table audit_events force row level security;
drop policy if exists audit_events_tenant_read on audit_events;
create policy audit_events_tenant_read on audit_events for select using (app.member_ok() AND (tenant_id = app.tenant_id()));
drop policy if exists audit_events_ops_read_with_grant on audit_events;
create policy audit_events_ops_read_with_grant on audit_events for select using (app.ops_grant_ok(audit_events.tenant_id));
-- audit_events_append_only: 追記専用。書き込みは関門の関数 app.record_*（security definer）だけ。UPDATE/DELETE は誰にも無い
revoke update, delete on audit_events from kaname_app;

alter table ops_audit_events enable row level security;
alter table ops_audit_events force row level security;
drop policy if exists ops_audit_events_ops_all on ops_audit_events;
create policy ops_audit_events_ops_all on ops_audit_events for select using (tenant_id = app.ops_tenant_id() AND current_setting('app.role', true) = 'ops');
-- ops_audit_events_append_only: 追記専用。書き込みは関門の関数 app.record_*（security definer）だけ。UPDATE/DELETE は誰にも無い
revoke update, delete on ops_audit_events from kaname_app;

alter table security_events enable row level security;
alter table security_events force row level security;
drop policy if exists security_events_tenant_read on security_events;
create policy security_events_tenant_read on security_events for select using (app.member_ok() AND (tenant_id = app.tenant_id()));
drop policy if exists security_events_ops_read_with_grant on security_events;
create policy security_events_ops_read_with_grant on security_events for select using (app.ops_grant_ok(security_events.tenant_id));
-- security_events_append_only: 追記専用。書き込みは関門の関数 app.record_*（security definer）だけ。UPDATE/DELETE は誰にも無い
revoke update, delete on security_events from kaname_app;

alter table export_jobs enable row level security;
alter table export_jobs force row level security;
drop policy if exists export_jobs_tenant_read on export_jobs;
create policy export_jobs_tenant_read on export_jobs for select using (app.member_ok() AND (tenant_id = app.tenant_id()));
drop policy if exists export_jobs_self_only_write_insert on export_jobs;
create policy export_jobs_self_only_write_insert on export_jobs for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND requested_by = app.user_id()));
drop policy if exists export_jobs_self_only_write_update on export_jobs;
create policy export_jobs_self_only_write_update on export_jobs for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND requested_by = app.user_id())) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND requested_by = app.user_id()));
drop policy if exists export_jobs_self_only_write_delete on export_jobs;
create policy export_jobs_self_only_write_delete on export_jobs for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND requested_by = app.user_id()));
drop policy if exists export_jobs_permission_write_insert on export_jobs;
create policy export_jobs_permission_write_insert on export_jobs for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'export_jobs', NULL, 'edit')));
drop policy if exists export_jobs_permission_write_update on export_jobs;
create policy export_jobs_permission_write_update on export_jobs for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'export_jobs', NULL, 'edit'))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'export_jobs', NULL, 'edit')));
drop policy if exists export_jobs_permission_write_delete on export_jobs;
create policy export_jobs_permission_write_delete on export_jobs for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'export_jobs', NULL, 'edit')));
drop policy if exists export_jobs_ops_read_with_grant on export_jobs;
create policy export_jobs_ops_read_with_grant on export_jobs for select using (app.ops_grant_ok(export_jobs.tenant_id));
