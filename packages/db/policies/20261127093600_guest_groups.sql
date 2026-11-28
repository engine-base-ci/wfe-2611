-- RLS（機械生成：scripts/ci/gen_rls.py ← 07_functional/entities.json の access_control_policies。手で直さない）

alter table guest_groups enable row level security;
alter table guest_groups force row level security;
do $$ declare r record; begin for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'guest_groups' and policyname <> all (array['guest_groups_members_read', 'guest_groups_members_write_delete', 'guest_groups_members_write_insert', 'guest_groups_members_write_update', 'guest_groups_ops_read_with_grant']::name[]) loop execute format('drop policy %I on guest_groups', r.policyname); end loop; end $$;
drop policy if exists guest_groups_members_read on guest_groups;
create policy guest_groups_members_read on guest_groups for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND (has_permission(app.user_id(), 'members', NULL, 'view') OR has_permission(app.user_id(), 'members', NULL, 'invite'))));
drop policy if exists guest_groups_members_write_insert on guest_groups;
create policy guest_groups_members_write_insert on guest_groups for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'members', NULL, 'edit')));
drop policy if exists guest_groups_members_write_update on guest_groups;
create policy guest_groups_members_write_update on guest_groups for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'members', NULL, 'edit'))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'members', NULL, 'edit')));
drop policy if exists guest_groups_members_write_delete on guest_groups;
create policy guest_groups_members_write_delete on guest_groups for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'members', NULL, 'edit')));
drop policy if exists guest_groups_ops_read_with_grant on guest_groups;
create policy guest_groups_ops_read_with_grant on guest_groups for select using (app.ops_grant_ok(guest_groups.tenant_id));

alter table guest_group_members enable row level security;
alter table guest_group_members force row level security;
do $$ declare r record; begin for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'guest_group_members' and policyname <> all (array['guest_group_members_members_read', 'guest_group_members_members_write_delete', 'guest_group_members_members_write_insert', 'guest_group_members_members_write_update', 'guest_group_members_ops_read_with_grant']::name[]) loop execute format('drop policy %I on guest_group_members', r.policyname); end loop; end $$;
drop policy if exists guest_group_members_members_read on guest_group_members;
create policy guest_group_members_members_read on guest_group_members for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND (has_permission(app.user_id(), 'members', NULL, 'view') OR has_permission(app.user_id(), 'members', NULL, 'invite'))));
drop policy if exists guest_group_members_members_write_insert on guest_group_members;
create policy guest_group_members_members_write_insert on guest_group_members for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'members', NULL, 'edit')));
drop policy if exists guest_group_members_members_write_update on guest_group_members;
create policy guest_group_members_members_write_update on guest_group_members for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'members', NULL, 'edit'))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'members', NULL, 'edit')));
drop policy if exists guest_group_members_members_write_delete on guest_group_members;
create policy guest_group_members_members_write_delete on guest_group_members for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'members', NULL, 'edit')));
drop policy if exists guest_group_members_ops_read_with_grant on guest_group_members;
create policy guest_group_members_ops_read_with_grant on guest_group_members for select using (app.ops_grant_ok(guest_group_members.tenant_id));
