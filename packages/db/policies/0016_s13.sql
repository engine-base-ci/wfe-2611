-- RLS（機械生成：scripts/ci/gen_rls.py ← 07_functional/entities.json の access_control_policies。手で直さない）

alter table imports enable row level security;
alter table imports force row level security;
drop policy if exists imports_tenant_read on imports;
create policy imports_tenant_read on imports for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND scope_id = ANY(visible_scopes(app.user_id()))));
drop policy if exists imports_permission_write_insert on imports;
create policy imports_permission_write_insert on imports for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'imports', scope_id, 'edit')));
drop policy if exists imports_permission_write_update on imports;
create policy imports_permission_write_update on imports for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'imports', scope_id, 'edit'))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'imports', scope_id, 'edit')));
drop policy if exists imports_permission_write_delete on imports;
create policy imports_permission_write_delete on imports for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'imports', scope_id, 'edit')));
drop policy if exists imports_ops_read_with_grant on imports;
create policy imports_ops_read_with_grant on imports for select using (app.ops_grant_ok(imports.tenant_id));

alter table integrations enable row level security;
alter table integrations force row level security;
drop policy if exists integrations_tenant_read on integrations;
create policy integrations_tenant_read on integrations for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND scope_id = ANY(visible_scopes(app.user_id()))));
drop policy if exists integrations_permission_write_insert on integrations;
create policy integrations_permission_write_insert on integrations for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'integrations', scope_id, 'edit')));
drop policy if exists integrations_permission_write_update on integrations;
create policy integrations_permission_write_update on integrations for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'integrations', scope_id, 'edit'))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'integrations', scope_id, 'edit')));
drop policy if exists integrations_permission_write_delete on integrations;
create policy integrations_permission_write_delete on integrations for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'integrations', scope_id, 'edit')));
drop policy if exists integrations_ops_read_with_grant on integrations;
create policy integrations_ops_read_with_grant on integrations for select using (app.ops_grant_ok(integrations.tenant_id));

alter table attachments enable row level security;
alter table attachments force row level security;
drop policy if exists attachments_tenant_read on attachments;
create policy attachments_tenant_read on attachments for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND scope_id = ANY(visible_scopes(app.user_id()))));
drop policy if exists attachments_permission_write_insert on attachments;
create policy attachments_permission_write_insert on attachments for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'attachments', scope_id, 'edit')));
drop policy if exists attachments_permission_write_update on attachments;
create policy attachments_permission_write_update on attachments for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'attachments', scope_id, 'edit'))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'attachments', scope_id, 'edit')));
drop policy if exists attachments_permission_write_delete on attachments;
create policy attachments_permission_write_delete on attachments for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'attachments', scope_id, 'edit')));
drop policy if exists attachments_ops_read_with_grant on attachments;
create policy attachments_ops_read_with_grant on attachments for select using (app.ops_grant_ok(attachments.tenant_id));
