-- RLS（機械生成：scripts/ci/gen_rls.py ← 07_functional/entities.json の access_control_policies。手で直さない）

alter table clones enable row level security;
alter table clones force row level security;
drop policy if exists clones_tenant_read on clones;
create policy clones_tenant_read on clones for select using (app.member_ok() AND (tenant_id = app.tenant_id()));
drop policy if exists clones_self_only_write_insert on clones;
create policy clones_self_only_write_insert on clones for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND owner_member_id = app.user_id()));
drop policy if exists clones_self_only_write_update on clones;
create policy clones_self_only_write_update on clones for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND owner_member_id = app.user_id())) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND owner_member_id = app.user_id()));
drop policy if exists clones_self_only_write_delete on clones;
create policy clones_self_only_write_delete on clones for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND owner_member_id = app.user_id()));
drop policy if exists clones_permission_write_insert on clones;
create policy clones_permission_write_insert on clones for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'clones', NULL, 'edit')));
drop policy if exists clones_permission_write_update on clones;
create policy clones_permission_write_update on clones for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'clones', NULL, 'edit'))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'clones', NULL, 'edit')));
drop policy if exists clones_permission_write_delete on clones;
create policy clones_permission_write_delete on clones for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'clones', NULL, 'edit')));
drop policy if exists clones_ops_read_with_grant on clones;
create policy clones_ops_read_with_grant on clones for select using (app.ops_grant_ok(clones.tenant_id));

alter table ai_employees enable row level security;
alter table ai_employees force row level security;
drop policy if exists ai_employees_tenant_read on ai_employees;
create policy ai_employees_tenant_read on ai_employees for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND scope_id = ANY(visible_scopes(app.user_id()))));
drop policy if exists ai_employees_self_only_write_insert on ai_employees;
create policy ai_employees_self_only_write_insert on ai_employees for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND member_id = app.user_id()));
drop policy if exists ai_employees_self_only_write_update on ai_employees;
create policy ai_employees_self_only_write_update on ai_employees for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND member_id = app.user_id())) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND member_id = app.user_id()));
drop policy if exists ai_employees_self_only_write_delete on ai_employees;
create policy ai_employees_self_only_write_delete on ai_employees for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND member_id = app.user_id()));
drop policy if exists ai_employees_permission_write_insert on ai_employees;
create policy ai_employees_permission_write_insert on ai_employees for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'ai_employees', scope_id, 'edit')));
drop policy if exists ai_employees_permission_write_update on ai_employees;
create policy ai_employees_permission_write_update on ai_employees for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'ai_employees', scope_id, 'edit'))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'ai_employees', scope_id, 'edit')));
drop policy if exists ai_employees_permission_write_delete on ai_employees;
create policy ai_employees_permission_write_delete on ai_employees for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'ai_employees', scope_id, 'edit')));
drop policy if exists ai_employees_ops_read_with_grant on ai_employees;
create policy ai_employees_ops_read_with_grant on ai_employees for select using (app.ops_grant_ok(ai_employees.tenant_id));
