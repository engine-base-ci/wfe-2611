-- RLS（機械生成：scripts/ci/gen_rls.py ← 07_functional/entities.json の access_control_policies。手で直さない）

alter table credentials enable row level security;
alter table credentials force row level security;
do $$ declare r record; begin for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'credentials' and policyname <> all (array['credentials_ops_read_with_grant', 'credentials_personal_write_delete', 'credentials_personal_write_insert', 'credentials_personal_write_update', 'credentials_read', 'credentials_workspace_write_delete', 'credentials_workspace_write_insert', 'credentials_workspace_write_update']::name[]) loop execute format('drop policy %I on credentials', r.policyname); end loop; end $$;
drop policy if exists credentials_read on credentials;
create policy credentials_read on credentials for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND (layer = 'workspace' OR owner_member_id = app.user_id())));
drop policy if exists credentials_personal_write_insert on credentials;
create policy credentials_personal_write_insert on credentials for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND layer = 'personal' AND owner_member_id = app.user_id()));
drop policy if exists credentials_personal_write_update on credentials;
create policy credentials_personal_write_update on credentials for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND layer = 'personal' AND owner_member_id = app.user_id())) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND layer = 'personal' AND owner_member_id = app.user_id()));
drop policy if exists credentials_personal_write_delete on credentials;
create policy credentials_personal_write_delete on credentials for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND layer = 'personal' AND owner_member_id = app.user_id()));
drop policy if exists credentials_workspace_write_insert on credentials;
create policy credentials_workspace_write_insert on credentials for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND layer = 'workspace' AND has_permission(app.user_id(), 'credentials', NULL, 'edit')));
drop policy if exists credentials_workspace_write_update on credentials;
create policy credentials_workspace_write_update on credentials for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND layer = 'workspace' AND has_permission(app.user_id(), 'credentials', NULL, 'edit'))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND layer = 'workspace' AND has_permission(app.user_id(), 'credentials', NULL, 'edit')));
drop policy if exists credentials_workspace_write_delete on credentials;
create policy credentials_workspace_write_delete on credentials for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND layer = 'workspace' AND has_permission(app.user_id(), 'credentials', NULL, 'edit')));
drop policy if exists credentials_ops_read_with_grant on credentials;
create policy credentials_ops_read_with_grant on credentials for select using (app.ops_grant_ok(credentials.tenant_id));
