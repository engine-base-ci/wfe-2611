-- RLS（機械生成：scripts/ci/gen_rls.py ← 07_functional/entities.json の access_control_policies。手で直さない）

alter table client_requests enable row level security;
alter table client_requests force row level security;
do $$ declare r record; begin for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'client_requests' and policyname <> all (array['client_requests_guest_read', 'client_requests_handle_insert', 'client_requests_handle_update', 'client_requests_ops_read_with_grant', 'client_requests_own_edit', 'client_requests_read', 'client_requests_same_client_read', 'client_requests_staff_guest_read', 'client_requests_staff_guest_update', 'client_requests_submit']::name[]) loop execute format('drop policy %I on client_requests', r.policyname); end loop; end $$;
drop policy if exists client_requests_read on client_requests;
create policy client_requests_read on client_requests for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND app.client_visible(client_id)));
drop policy if exists client_requests_handle_insert on client_requests;
create policy client_requests_handle_insert on client_requests for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND app.client_visible(client_id) AND (app.client_editable(client_id) OR has_permission(app.user_id(), 'client_requests', routed_scope_id, 'edit'))));
drop policy if exists client_requests_handle_update on client_requests;
create policy client_requests_handle_update on client_requests for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND app.client_visible(client_id) AND (app.client_editable(client_id) OR has_permission(app.user_id(), 'client_requests', routed_scope_id, 'edit')))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND app.client_visible(client_id) AND (app.client_editable(client_id) OR has_permission(app.user_id(), 'client_requests', routed_scope_id, 'edit'))));
drop policy if exists client_requests_same_client_read on client_requests;
create policy client_requests_same_client_read on client_requests for select using (app.client_ok() AND (tenant_id = app.tenant_id() AND client_id = app.my_client()));
drop policy if exists client_requests_submit on client_requests;
create policy client_requests_submit on client_requests for insert with check (app.client_ok() AND (tenant_id = app.tenant_id() AND client_id = app.my_client() AND contact_id = app.my_contact() AND state = 'new' AND EXISTS (SELECT 1 FROM client_contacts k WHERE k.id = contact_id AND k.role = 'requester')));
drop policy if exists client_requests_own_edit on client_requests;
create policy client_requests_own_edit on client_requests for update using (app.client_ok() AND (tenant_id = app.tenant_id() AND client_id = app.my_client() AND contact_id = app.my_contact() AND state IN ('new', 'asking'))) with check (app.client_ok() AND (tenant_id = app.tenant_id() AND client_id = app.my_client() AND contact_id = app.my_contact() AND state IN ('new', 'asking')));
drop policy if exists client_requests_guest_read on client_requests;
create policy client_requests_guest_read on client_requests for select using (app.client_ok() AND (tenant_id = app.tenant_id() AND guest_group_id = app.my_guest_group()));
drop policy if exists client_requests_staff_guest_read on client_requests;
create policy client_requests_staff_guest_read on client_requests for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND guest_group_id IS NOT NULL AND app.client_request_visible(id)));
drop policy if exists client_requests_staff_guest_update on client_requests;
create policy client_requests_staff_guest_update on client_requests for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND guest_group_id IS NOT NULL AND app.client_request_actable(id))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND guest_group_id IS NOT NULL AND app.client_request_actable(id)));
drop policy if exists client_requests_ops_read_with_grant on client_requests;
create policy client_requests_ops_read_with_grant on client_requests for select using (app.ops_grant_ok(client_requests.tenant_id));

alter table client_request_messages enable row level security;
alter table client_request_messages force row level security;
do $$ declare r record; begin for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'client_request_messages' and policyname <> all (array['client_request_messages_ops_read_with_grant', 'client_request_messages_staff_read', 'client_request_messages_staff_write']::name[]) loop execute format('drop policy %I on client_request_messages', r.policyname); end loop; end $$;
drop policy if exists client_request_messages_staff_read on client_request_messages;
create policy client_request_messages_staff_read on client_request_messages for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND app.client_request_visible(client_request_id)));
drop policy if exists client_request_messages_staff_write on client_request_messages;
create policy client_request_messages_staff_write on client_request_messages for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND app.client_request_actable(client_request_id) AND side = 'company' AND author_member_id = app.user_id()));
drop policy if exists client_request_messages_ops_read_with_grant on client_request_messages;
create policy client_request_messages_ops_read_with_grant on client_request_messages for select using (app.ops_grant_ok(client_request_messages.tenant_id));
