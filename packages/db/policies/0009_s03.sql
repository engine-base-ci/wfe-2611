-- RLS（機械生成：scripts/ci/gen_rls.py ← 07_functional/entities.json の access_control_policies。手で直さない）

alter table ledger_definitions enable row level security;
alter table ledger_definitions force row level security;
drop policy if exists ledger_definitions_tenant_read on ledger_definitions;
create policy ledger_definitions_tenant_read on ledger_definitions for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND scope_id = ANY(visible_scopes(app.user_id()))));
drop policy if exists ledger_definitions_permission_write_insert on ledger_definitions;
create policy ledger_definitions_permission_write_insert on ledger_definitions for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'ledger_definitions', scope_id, 'edit')));
drop policy if exists ledger_definitions_permission_write_update on ledger_definitions;
create policy ledger_definitions_permission_write_update on ledger_definitions for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'ledger_definitions', scope_id, 'edit'))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'ledger_definitions', scope_id, 'edit')));
drop policy if exists ledger_definitions_permission_write_delete on ledger_definitions;
create policy ledger_definitions_permission_write_delete on ledger_definitions for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'ledger_definitions', scope_id, 'edit')));
drop policy if exists ledger_definitions_ops_read_with_grant on ledger_definitions;
create policy ledger_definitions_ops_read_with_grant on ledger_definitions for select using (app.ops_grant_ok(ledger_definitions.tenant_id));

alter table ledger_fields enable row level security;
alter table ledger_fields force row level security;
drop policy if exists ledger_fields_tenant_read on ledger_fields;
create policy ledger_fields_tenant_read on ledger_fields for select using (app.member_ok() AND (tenant_id = app.tenant_id()));
drop policy if exists ledger_fields_permission_write_insert on ledger_fields;
create policy ledger_fields_permission_write_insert on ledger_fields for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'ledger_fields', NULL, 'edit')));
drop policy if exists ledger_fields_permission_write_update on ledger_fields;
create policy ledger_fields_permission_write_update on ledger_fields for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'ledger_fields', NULL, 'edit'))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'ledger_fields', NULL, 'edit')));
drop policy if exists ledger_fields_permission_write_delete on ledger_fields;
create policy ledger_fields_permission_write_delete on ledger_fields for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'ledger_fields', NULL, 'edit')));
drop policy if exists ledger_fields_ops_read_with_grant on ledger_fields;
create policy ledger_fields_ops_read_with_grant on ledger_fields for select using (app.ops_grant_ok(ledger_fields.tenant_id));

alter table ledger_stages enable row level security;
alter table ledger_stages force row level security;
drop policy if exists ledger_stages_tenant_read on ledger_stages;
create policy ledger_stages_tenant_read on ledger_stages for select using (app.member_ok() AND (tenant_id = app.tenant_id()));
drop policy if exists ledger_stages_permission_write_insert on ledger_stages;
create policy ledger_stages_permission_write_insert on ledger_stages for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'ledger_stages', NULL, 'edit')));
drop policy if exists ledger_stages_permission_write_update on ledger_stages;
create policy ledger_stages_permission_write_update on ledger_stages for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'ledger_stages', NULL, 'edit'))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'ledger_stages', NULL, 'edit')));
drop policy if exists ledger_stages_permission_write_delete on ledger_stages;
create policy ledger_stages_permission_write_delete on ledger_stages for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'ledger_stages', NULL, 'edit')));
drop policy if exists ledger_stages_ops_read_with_grant on ledger_stages;
create policy ledger_stages_ops_read_with_grant on ledger_stages for select using (app.ops_grant_ok(ledger_stages.tenant_id));

alter table ledger_views enable row level security;
alter table ledger_views force row level security;
drop policy if exists ledger_views_tenant_read on ledger_views;
create policy ledger_views_tenant_read on ledger_views for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND scope_id = ANY(visible_scopes(app.user_id()))));
drop policy if exists ledger_views_permission_write_insert on ledger_views;
create policy ledger_views_permission_write_insert on ledger_views for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'ledger_views', scope_id, 'edit')));
drop policy if exists ledger_views_permission_write_update on ledger_views;
create policy ledger_views_permission_write_update on ledger_views for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'ledger_views', scope_id, 'edit'))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'ledger_views', scope_id, 'edit')));
drop policy if exists ledger_views_permission_write_delete on ledger_views;
create policy ledger_views_permission_write_delete on ledger_views for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'ledger_views', scope_id, 'edit')));
drop policy if exists ledger_views_ops_read_with_grant on ledger_views;
create policy ledger_views_ops_read_with_grant on ledger_views for select using (app.ops_grant_ok(ledger_views.tenant_id));

alter table ledger_records enable row level security;
alter table ledger_records force row level security;
drop policy if exists ledger_records_tenant_read on ledger_records;
create policy ledger_records_tenant_read on ledger_records for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND scope_id = ANY(visible_scopes(app.user_id()))));
drop policy if exists ledger_records_permission_write_insert on ledger_records;
create policy ledger_records_permission_write_insert on ledger_records for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'ledger_records', scope_id, 'edit')));
drop policy if exists ledger_records_permission_write_update on ledger_records;
create policy ledger_records_permission_write_update on ledger_records for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'ledger_records', scope_id, 'edit'))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'ledger_records', scope_id, 'edit')));
drop policy if exists ledger_records_permission_write_delete on ledger_records;
create policy ledger_records_permission_write_delete on ledger_records for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'ledger_records', scope_id, 'edit')));
drop policy if exists ledger_records_ops_read_with_grant on ledger_records;
create policy ledger_records_ops_read_with_grant on ledger_records for select using (app.ops_grant_ok(ledger_records.tenant_id));
