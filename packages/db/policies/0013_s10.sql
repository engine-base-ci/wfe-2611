-- RLS（機械生成：scripts/ci/gen_rls.py ← 07_functional/entities.json の access_control_policies。手で直さない）

alter table account_events enable row level security;
alter table account_events force row level security;
drop policy if exists account_events_tenant_read on account_events;
create policy account_events_tenant_read on account_events for select using (app.member_ok() AND (tenant_id = app.tenant_id()));
drop policy if exists account_events_self_only_write_insert on account_events;
create policy account_events_self_only_write_insert on account_events for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND requested_by = app.user_id()));
drop policy if exists account_events_self_only_write_update on account_events;
create policy account_events_self_only_write_update on account_events for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND requested_by = app.user_id())) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND requested_by = app.user_id()));
drop policy if exists account_events_self_only_write_delete on account_events;
create policy account_events_self_only_write_delete on account_events for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND requested_by = app.user_id()));
drop policy if exists account_events_permission_write_insert on account_events;
create policy account_events_permission_write_insert on account_events for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'account_events', NULL, 'edit')));
drop policy if exists account_events_permission_write_update on account_events;
create policy account_events_permission_write_update on account_events for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'account_events', NULL, 'edit'))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'account_events', NULL, 'edit')));
drop policy if exists account_events_permission_write_delete on account_events;
create policy account_events_permission_write_delete on account_events for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'account_events', NULL, 'edit')));
drop policy if exists account_events_ops_read_with_grant on account_events;
create policy account_events_ops_read_with_grant on account_events for select using (app.ops_grant_ok(account_events.tenant_id));

alter table account_event_items enable row level security;
alter table account_event_items force row level security;
drop policy if exists account_event_items_tenant_read on account_event_items;
create policy account_event_items_tenant_read on account_event_items for select using (app.member_ok() AND (tenant_id = app.tenant_id()));
drop policy if exists account_event_items_permission_write_insert on account_event_items;
create policy account_event_items_permission_write_insert on account_event_items for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'account_event_items', NULL, 'edit')));
drop policy if exists account_event_items_permission_write_update on account_event_items;
create policy account_event_items_permission_write_update on account_event_items for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'account_event_items', NULL, 'edit'))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'account_event_items', NULL, 'edit')));
drop policy if exists account_event_items_permission_write_delete on account_event_items;
create policy account_event_items_permission_write_delete on account_event_items for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'account_event_items', NULL, 'edit')));
drop policy if exists account_event_items_ops_read_with_grant on account_event_items;
create policy account_event_items_ops_read_with_grant on account_event_items for select using (app.ops_grant_ok(account_event_items.tenant_id));

alter table retention_holds enable row level security;
alter table retention_holds force row level security;
drop policy if exists retention_holds_tenant_read on retention_holds;
create policy retention_holds_tenant_read on retention_holds for select using (app.member_ok() AND (tenant_id = app.tenant_id()));
drop policy if exists retention_holds_permission_write_insert on retention_holds;
create policy retention_holds_permission_write_insert on retention_holds for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'retention_holds', NULL, 'edit')));
drop policy if exists retention_holds_permission_write_update on retention_holds;
create policy retention_holds_permission_write_update on retention_holds for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'retention_holds', NULL, 'edit'))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'retention_holds', NULL, 'edit')));
drop policy if exists retention_holds_permission_write_delete on retention_holds;
create policy retention_holds_permission_write_delete on retention_holds for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'retention_holds', NULL, 'edit')));
drop policy if exists retention_holds_ops_read_with_grant on retention_holds;
create policy retention_holds_ops_read_with_grant on retention_holds for select using (app.ops_grant_ok(retention_holds.tenant_id));

alter table erasure_certificates enable row level security;
alter table erasure_certificates force row level security;
drop policy if exists erasure_certificates_tenant_read on erasure_certificates;
create policy erasure_certificates_tenant_read on erasure_certificates for select using (app.member_ok() AND (tenant_id = app.tenant_id()));
drop policy if exists erasure_certificates_permission_write_insert on erasure_certificates;
create policy erasure_certificates_permission_write_insert on erasure_certificates for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'erasure_certificates', NULL, 'edit')));
drop policy if exists erasure_certificates_permission_write_update on erasure_certificates;
create policy erasure_certificates_permission_write_update on erasure_certificates for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'erasure_certificates', NULL, 'edit'))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'erasure_certificates', NULL, 'edit')));
drop policy if exists erasure_certificates_permission_write_delete on erasure_certificates;
create policy erasure_certificates_permission_write_delete on erasure_certificates for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'erasure_certificates', NULL, 'edit')));
drop policy if exists erasure_certificates_ops_read_with_grant on erasure_certificates;
create policy erasure_certificates_ops_read_with_grant on erasure_certificates for select using (app.ops_grant_ok(erasure_certificates.tenant_id));
