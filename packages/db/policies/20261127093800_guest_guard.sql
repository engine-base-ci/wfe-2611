-- RLS（機械生成：scripts/ci/gen_rls.py ← 07_functional/entities.json の access_control_policies。手で直さない）

alter table tickets enable row level security;
alter table tickets force row level security;
do $$ declare r record; begin for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'tickets' and policyname <> all (array['tickets_client_read', 'tickets_create', 'tickets_guest_read', 'tickets_ops_read_with_grant', 'tickets_read', 'tickets_update']::name[]) loop execute format('drop policy %I on tickets', r.policyname); end loop; end $$;
drop policy if exists tickets_read on tickets;
create policy tickets_read on tickets for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND deleted_at IS NULL AND app.ticket_draft_ok(draft_import_id, app.user_id()) AND (scope_id = ANY(visible_scopes(app.user_id())) OR assignee_member_id = app.user_id() OR app.ticket_involved(id, app.user_id()))));
drop policy if exists tickets_create on tickets;
create policy tickets_create on tickets for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND app.ticket_draft_ok(draft_import_id, app.user_id()) AND has_permission(app.user_id(), 'tickets', scope_id, 'edit')));
drop policy if exists tickets_update on tickets;
create policy tickets_update on tickets for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND app.ticket_draft_ok(draft_import_id, app.user_id()) AND (has_permission(app.user_id(), 'tickets', scope_id, 'edit') OR assignee_member_id = app.user_id()))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND app.ticket_draft_ok(draft_import_id, app.user_id()) AND (has_permission(app.user_id(), 'tickets', scope_id, 'edit') OR assignee_member_id = app.user_id())));
drop policy if exists tickets_client_read on tickets;
create policy tickets_client_read on tickets for select using (app.client_ok() AND (tenant_id = app.tenant_id() AND client_id = app.my_client() AND deleted_at IS NULL AND draft_import_id IS NULL AND client_share <> '{}'::jsonb));
drop policy if exists tickets_guest_read on tickets;
create policy tickets_guest_read on tickets for select using (app.client_ok() AND (tenant_id = app.tenant_id() AND app.guest_sees_ticket(id)));
drop policy if exists tickets_ops_read_with_grant on tickets;
create policy tickets_ops_read_with_grant on tickets for select using (app.ops_grant_ok(tickets.tenant_id));

alter table guest_groups enable row level security;
alter table guest_groups force row level security;
do $$ declare r record; begin for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'guest_groups' and policyname <> all (array['guest_groups_guest_read', 'guest_groups_members_read', 'guest_groups_members_write_delete', 'guest_groups_members_write_insert', 'guest_groups_members_write_update', 'guest_groups_ops_read_with_grant']::name[]) loop execute format('drop policy %I on guest_groups', r.policyname); end loop; end $$;
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
drop policy if exists guest_groups_guest_read on guest_groups;
create policy guest_groups_guest_read on guest_groups for select using (app.client_ok() AND (tenant_id = app.tenant_id() AND id = app.my_guest_group()));
