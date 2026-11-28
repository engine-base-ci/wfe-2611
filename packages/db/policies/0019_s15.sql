-- RLS（機械生成：scripts/ci/gen_rls.py ← 07_functional/entities.json の access_control_policies。手で直さない）

alter table payment_methods enable row level security;
alter table payment_methods force row level security;
drop policy if exists payment_methods_tenant_read on payment_methods;
create policy payment_methods_tenant_read on payment_methods for select using (app.member_ok() AND (tenant_id = app.tenant_id()));
drop policy if exists payment_methods_permission_write_insert on payment_methods;
create policy payment_methods_permission_write_insert on payment_methods for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'payment_methods', NULL, 'edit')));
drop policy if exists payment_methods_permission_write_update on payment_methods;
create policy payment_methods_permission_write_update on payment_methods for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'payment_methods', NULL, 'edit'))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'payment_methods', NULL, 'edit')));
drop policy if exists payment_methods_permission_write_delete on payment_methods;
create policy payment_methods_permission_write_delete on payment_methods for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'payment_methods', NULL, 'edit')));
drop policy if exists payment_methods_ops_read_with_grant on payment_methods;
create policy payment_methods_ops_read_with_grant on payment_methods for select using (app.ops_grant_ok(payment_methods.tenant_id));

alter table billing_events enable row level security;
alter table billing_events force row level security;
drop policy if exists billing_events_tenant_read on billing_events;
create policy billing_events_tenant_read on billing_events for select using (app.member_ok() AND (tenant_id = app.tenant_id()));
drop policy if exists billing_events_permission_write_insert on billing_events;
create policy billing_events_permission_write_insert on billing_events for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'billing_events', NULL, 'edit')));
drop policy if exists billing_events_permission_write_update on billing_events;
create policy billing_events_permission_write_update on billing_events for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'billing_events', NULL, 'edit'))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'billing_events', NULL, 'edit')));
drop policy if exists billing_events_permission_write_delete on billing_events;
create policy billing_events_permission_write_delete on billing_events for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'billing_events', NULL, 'edit')));
drop policy if exists billing_events_ops_read_with_grant on billing_events;
create policy billing_events_ops_read_with_grant on billing_events for select using (app.ops_grant_ok(billing_events.tenant_id));

alter table llm_routes enable row level security;
alter table llm_routes force row level security;
drop policy if exists llm_routes_tenant_read on llm_routes;
create policy llm_routes_tenant_read on llm_routes for select using (app.member_ok() AND (tenant_id = app.tenant_id()));
drop policy if exists llm_routes_permission_write_insert on llm_routes;
create policy llm_routes_permission_write_insert on llm_routes for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'llm_routes', NULL, 'edit')));
drop policy if exists llm_routes_permission_write_update on llm_routes;
create policy llm_routes_permission_write_update on llm_routes for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'llm_routes', NULL, 'edit'))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'llm_routes', NULL, 'edit')));
drop policy if exists llm_routes_permission_write_delete on llm_routes;
create policy llm_routes_permission_write_delete on llm_routes for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'llm_routes', NULL, 'edit')));
drop policy if exists llm_routes_ops_read_with_grant on llm_routes;
create policy llm_routes_ops_read_with_grant on llm_routes for select using (app.ops_grant_ok(llm_routes.tenant_id));
drop policy if exists llm_routes_ops_write on llm_routes;
create policy llm_routes_ops_write on llm_routes for update using (current_setting('app.role', true) = 'ops' AND tenant_id = app.tenant_id()) with check (current_setting('app.role', true) = 'ops' AND tenant_id = app.tenant_id());

alter table llm_capabilities enable row level security;
alter table llm_capabilities force row level security;
drop policy if exists llm_capabilities_all_read on llm_capabilities;
create policy llm_capabilities_all_read on llm_capabilities for select using (coalesce(current_setting('app.user_id', true), '') <> '' AND (true));
drop policy if exists llm_capabilities_ops_write_insert on llm_capabilities;
create policy llm_capabilities_ops_write_insert on llm_capabilities for insert with check (current_setting('app.role', true) = 'ops');
drop policy if exists llm_capabilities_ops_write_update on llm_capabilities;
create policy llm_capabilities_ops_write_update on llm_capabilities for update using (current_setting('app.role', true) = 'ops') with check (current_setting('app.role', true) = 'ops');
drop policy if exists llm_capabilities_ops_write_delete on llm_capabilities;
create policy llm_capabilities_ops_write_delete on llm_capabilities for delete using (current_setting('app.role', true) = 'ops');

alter table push_devices enable row level security;
alter table push_devices force row level security;
drop policy if exists push_devices_tenant_read on push_devices;
create policy push_devices_tenant_read on push_devices for select using (app.member_ok() AND (tenant_id = app.tenant_id()));
drop policy if exists push_devices_self_only_write_insert on push_devices;
create policy push_devices_self_only_write_insert on push_devices for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND member_id = app.user_id()));
drop policy if exists push_devices_self_only_write_update on push_devices;
create policy push_devices_self_only_write_update on push_devices for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND member_id = app.user_id())) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND member_id = app.user_id()));
drop policy if exists push_devices_self_only_write_delete on push_devices;
create policy push_devices_self_only_write_delete on push_devices for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND member_id = app.user_id()));
drop policy if exists push_devices_permission_write_insert on push_devices;
create policy push_devices_permission_write_insert on push_devices for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'push_devices', NULL, 'edit')));
drop policy if exists push_devices_permission_write_update on push_devices;
create policy push_devices_permission_write_update on push_devices for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'push_devices', NULL, 'edit'))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'push_devices', NULL, 'edit')));
drop policy if exists push_devices_permission_write_delete on push_devices;
create policy push_devices_permission_write_delete on push_devices for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'push_devices', NULL, 'edit')));
drop policy if exists push_devices_ops_read_with_grant on push_devices;
create policy push_devices_ops_read_with_grant on push_devices for select using (app.ops_grant_ok(push_devices.tenant_id));

alter table disclosure_versions enable row level security;
alter table disclosure_versions force row level security;
drop policy if exists disclosure_versions_ops_all on disclosure_versions;
create policy disclosure_versions_ops_all on disclosure_versions for all using (tenant_id = app.ops_tenant_id() AND current_setting('app.role', true) = 'ops') with check (tenant_id = app.ops_tenant_id() AND current_setting('app.role', true) = 'ops');

alter table subprocessors enable row level security;
alter table subprocessors force row level security;
drop policy if exists subprocessors_ops_all on subprocessors;
create policy subprocessors_ops_all on subprocessors for all using (tenant_id = app.ops_tenant_id() AND current_setting('app.role', true) = 'ops') with check (tenant_id = app.ops_tenant_id() AND current_setting('app.role', true) = 'ops');
