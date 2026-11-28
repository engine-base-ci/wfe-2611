-- RLS（機械生成：scripts/ci/gen_rls.py ← 07_functional/entities.json の access_control_policies。手で直さない）

alter table support_access_grants enable row level security;
alter table support_access_grants force row level security;
do $$ declare r record; begin for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'support_access_grants' and policyname <> all (array['support_access_grants_ops_open_insert', 'support_access_grants_ops_open_select', 'support_access_grants_ops_open_update', 'support_access_grants_tenant_view']::name[]) loop execute format('drop policy %I on support_access_grants', r.policyname); end loop; end $$;
drop policy if exists support_access_grants_tenant_view on support_access_grants;
create policy support_access_grants_tenant_view on support_access_grants for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'support_access_grants', NULL, 'view')));
drop policy if exists support_access_grants_ops_open_select on support_access_grants;
create policy support_access_grants_ops_open_select on support_access_grants for select using (current_setting('app.role', true) = 'ops' AND EXISTS (SELECT 1 FROM ops_members om WHERE om.id = support_access_grants.ops_member_id AND om.member_id = app.user_id() AND 'peek' = ANY(om.caps) AND om.revoked_at IS NULL AND om.deleted_at IS NULL));
drop policy if exists support_access_grants_ops_open_insert on support_access_grants;
create policy support_access_grants_ops_open_insert on support_access_grants for insert with check (current_setting('app.role', true) = 'ops' AND EXISTS (SELECT 1 FROM ops_members om WHERE om.id = support_access_grants.ops_member_id AND om.member_id = app.user_id() AND 'peek' = ANY(om.caps) AND om.revoked_at IS NULL AND om.deleted_at IS NULL));
drop policy if exists support_access_grants_ops_open_update on support_access_grants;
create policy support_access_grants_ops_open_update on support_access_grants for update using (current_setting('app.role', true) = 'ops' AND EXISTS (SELECT 1 FROM ops_members om WHERE om.id = support_access_grants.ops_member_id AND om.member_id = app.user_id() AND 'peek' = ANY(om.caps) AND om.revoked_at IS NULL AND om.deleted_at IS NULL)) with check (current_setting('app.role', true) = 'ops' AND EXISTS (SELECT 1 FROM ops_members om WHERE om.id = support_access_grants.ops_member_id AND om.member_id = app.user_id() AND 'peek' = ANY(om.caps) AND om.revoked_at IS NULL AND om.deleted_at IS NULL));
