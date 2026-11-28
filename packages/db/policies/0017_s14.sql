-- RLS（機械生成：scripts/ci/gen_rls.py ← 07_functional/entities.json の access_control_policies。手で直さない）

alter table skills enable row level security;
alter table skills force row level security;
drop policy if exists skills_ops_all on skills;
create policy skills_ops_all on skills for all using (tenant_id = app.ops_tenant_id() AND current_setting('app.role', true) = 'ops') with check (tenant_id = app.ops_tenant_id() AND current_setting('app.role', true) = 'ops');

alter table skill_versions enable row level security;
alter table skill_versions force row level security;
drop policy if exists skill_versions_all_read on skill_versions;
create policy skill_versions_all_read on skill_versions for select using (coalesce(current_setting('app.user_id', true), '') <> '' AND (true));
drop policy if exists skill_versions_ops_write_insert on skill_versions;
create policy skill_versions_ops_write_insert on skill_versions for insert with check (current_setting('app.role', true) = 'ops');
drop policy if exists skill_versions_ops_write_update on skill_versions;
create policy skill_versions_ops_write_update on skill_versions for update using (current_setting('app.role', true) = 'ops') with check (current_setting('app.role', true) = 'ops');
drop policy if exists skill_versions_ops_write_delete on skill_versions;
create policy skill_versions_ops_write_delete on skill_versions for delete using (current_setting('app.role', true) = 'ops');

alter table skill_test_runs enable row level security;
alter table skill_test_runs force row level security;
drop policy if exists skill_test_runs_tenant_read on skill_test_runs;
create policy skill_test_runs_tenant_read on skill_test_runs for select using (app.member_ok() AND (tenant_id = app.tenant_id()));
drop policy if exists skill_test_runs_permission_write_insert on skill_test_runs;
create policy skill_test_runs_permission_write_insert on skill_test_runs for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'skill_test_runs', NULL, 'edit')));
drop policy if exists skill_test_runs_permission_write_update on skill_test_runs;
create policy skill_test_runs_permission_write_update on skill_test_runs for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'skill_test_runs', NULL, 'edit'))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'skill_test_runs', NULL, 'edit')));
drop policy if exists skill_test_runs_permission_write_delete on skill_test_runs;
create policy skill_test_runs_permission_write_delete on skill_test_runs for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'skill_test_runs', NULL, 'edit')));
drop policy if exists skill_test_runs_ops_read_with_grant on skill_test_runs;
create policy skill_test_runs_ops_read_with_grant on skill_test_runs for select using (app.ops_grant_ok(skill_test_runs.tenant_id));

alter table skill_attachments enable row level security;
alter table skill_attachments force row level security;
drop policy if exists skill_attachments_tenant_read on skill_attachments;
create policy skill_attachments_tenant_read on skill_attachments for select using (app.member_ok() AND (tenant_id = app.tenant_id()));
drop policy if exists skill_attachments_permission_write_insert on skill_attachments;
create policy skill_attachments_permission_write_insert on skill_attachments for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'skill_attachments', NULL, 'edit')));
drop policy if exists skill_attachments_permission_write_update on skill_attachments;
create policy skill_attachments_permission_write_update on skill_attachments for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'skill_attachments', NULL, 'edit'))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'skill_attachments', NULL, 'edit')));
drop policy if exists skill_attachments_permission_write_delete on skill_attachments;
create policy skill_attachments_permission_write_delete on skill_attachments for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'skill_attachments', NULL, 'edit')));
drop policy if exists skill_attachments_ops_read_with_grant on skill_attachments;
create policy skill_attachments_ops_read_with_grant on skill_attachments for select using (app.ops_grant_ok(skill_attachments.tenant_id));
