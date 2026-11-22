-- RLS（機械生成：scripts/ci/gen_rls.py ← 07_functional/entities.json の access_control_policies。手で直さない）

alter table custom_fields enable row level security;
alter table custom_fields force row level security;
do $$ declare r record; begin for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'custom_fields' and policyname <> all (array['custom_fields_ops_read_with_grant', 'custom_fields_permission_write_delete', 'custom_fields_permission_write_insert', 'custom_fields_permission_write_update', 'custom_fields_tenant_read']::name[]) loop execute format('drop policy %I on custom_fields', r.policyname); end loop; end $$;
drop policy if exists custom_fields_tenant_read on custom_fields;
create policy custom_fields_tenant_read on custom_fields for select using (app.member_ok() AND (tenant_id = app.tenant_id()));
drop policy if exists custom_fields_permission_write_insert on custom_fields;
create policy custom_fields_permission_write_insert on custom_fields for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'custom_fields', NULL, 'edit')));
drop policy if exists custom_fields_permission_write_update on custom_fields;
create policy custom_fields_permission_write_update on custom_fields for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'custom_fields', NULL, 'edit'))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'custom_fields', NULL, 'edit')));
drop policy if exists custom_fields_permission_write_delete on custom_fields;
create policy custom_fields_permission_write_delete on custom_fields for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'custom_fields', NULL, 'edit')));
drop policy if exists custom_fields_ops_read_with_grant on custom_fields;
create policy custom_fields_ops_read_with_grant on custom_fields for select using (app.ops_grant_ok(custom_fields.tenant_id));

alter table custom_field_kinds enable row level security;
alter table custom_field_kinds force row level security;
do $$ declare r record; begin for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'custom_field_kinds' and policyname <> all (array['custom_field_kinds_ops_read_with_grant', 'custom_field_kinds_permission_write_delete', 'custom_field_kinds_permission_write_insert', 'custom_field_kinds_permission_write_update', 'custom_field_kinds_tenant_read']::name[]) loop execute format('drop policy %I on custom_field_kinds', r.policyname); end loop; end $$;
drop policy if exists custom_field_kinds_tenant_read on custom_field_kinds;
create policy custom_field_kinds_tenant_read on custom_field_kinds for select using (app.member_ok() AND (tenant_id = app.tenant_id()));
drop policy if exists custom_field_kinds_permission_write_insert on custom_field_kinds;
create policy custom_field_kinds_permission_write_insert on custom_field_kinds for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'custom_field_kinds', NULL, 'edit')));
drop policy if exists custom_field_kinds_permission_write_update on custom_field_kinds;
create policy custom_field_kinds_permission_write_update on custom_field_kinds for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'custom_field_kinds', NULL, 'edit'))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'custom_field_kinds', NULL, 'edit')));
drop policy if exists custom_field_kinds_permission_write_delete on custom_field_kinds;
create policy custom_field_kinds_permission_write_delete on custom_field_kinds for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'custom_field_kinds', NULL, 'edit')));
drop policy if exists custom_field_kinds_ops_read_with_grant on custom_field_kinds;
create policy custom_field_kinds_ops_read_with_grant on custom_field_kinds for select using (app.ops_grant_ok(custom_field_kinds.tenant_id));

alter table ticket_field_values enable row level security;
alter table ticket_field_values force row level security;
do $$ declare r record; begin for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'ticket_field_values' and policyname <> all (array['ticket_field_values_ops_read_with_grant', 'ticket_field_values_ticket_read', 'ticket_field_values_ticket_write_delete', 'ticket_field_values_ticket_write_insert', 'ticket_field_values_ticket_write_update']::name[]) loop execute format('drop policy %I on ticket_field_values', r.policyname); end loop; end $$;
drop policy if exists ticket_field_values_ticket_read on ticket_field_values;
create policy ticket_field_values_ticket_read on ticket_field_values for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND app.ticket_visible(ticket_id)));
drop policy if exists ticket_field_values_ticket_write_insert on ticket_field_values;
create policy ticket_field_values_ticket_write_insert on ticket_field_values for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND app.ticket_writable(ticket_id)));
drop policy if exists ticket_field_values_ticket_write_update on ticket_field_values;
create policy ticket_field_values_ticket_write_update on ticket_field_values for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND app.ticket_writable(ticket_id))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND app.ticket_writable(ticket_id)));
drop policy if exists ticket_field_values_ticket_write_delete on ticket_field_values;
create policy ticket_field_values_ticket_write_delete on ticket_field_values for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND app.ticket_writable(ticket_id)));
drop policy if exists ticket_field_values_ops_read_with_grant on ticket_field_values;
create policy ticket_field_values_ops_read_with_grant on ticket_field_values for select using (app.ops_grant_ok(ticket_field_values.tenant_id));
