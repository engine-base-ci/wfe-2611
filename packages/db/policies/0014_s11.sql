-- RLS（機械生成：scripts/ci/gen_rls.py ← 07_functional/entities.json の access_control_policies。手で直さない）

alter table distributions enable row level security;
alter table distributions force row level security;
drop policy if exists distributions_ops_all on distributions;
create policy distributions_ops_all on distributions for all using (tenant_id = app.ops_tenant_id() AND current_setting('app.role', true) = 'ops') with check (tenant_id = app.ops_tenant_id() AND current_setting('app.role', true) = 'ops');

alter table distribution_versions enable row level security;
alter table distribution_versions force row level security;
drop policy if exists distribution_versions_all_read on distribution_versions;
create policy distribution_versions_all_read on distribution_versions for select using (coalesce(current_setting('app.user_id', true), '') <> '' AND (true));
drop policy if exists distribution_versions_ops_write_insert on distribution_versions;
create policy distribution_versions_ops_write_insert on distribution_versions for insert with check (current_setting('app.role', true) = 'ops');
drop policy if exists distribution_versions_ops_write_update on distribution_versions;
create policy distribution_versions_ops_write_update on distribution_versions for update using (current_setting('app.role', true) = 'ops') with check (current_setting('app.role', true) = 'ops');
drop policy if exists distribution_versions_ops_write_delete on distribution_versions;
create policy distribution_versions_ops_write_delete on distribution_versions for delete using (current_setting('app.role', true) = 'ops');

alter table tenant_distributions enable row level security;
alter table tenant_distributions force row level security;
drop policy if exists tenant_distributions_tenant_read on tenant_distributions;
create policy tenant_distributions_tenant_read on tenant_distributions for select using (app.member_ok() AND (tenant_id = app.tenant_id()));
drop policy if exists tenant_distributions_permission_write_insert on tenant_distributions;
create policy tenant_distributions_permission_write_insert on tenant_distributions for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'tenant_distributions', NULL, 'edit')));
drop policy if exists tenant_distributions_permission_write_update on tenant_distributions;
create policy tenant_distributions_permission_write_update on tenant_distributions for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'tenant_distributions', NULL, 'edit'))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'tenant_distributions', NULL, 'edit')));
drop policy if exists tenant_distributions_permission_write_delete on tenant_distributions;
create policy tenant_distributions_permission_write_delete on tenant_distributions for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'tenant_distributions', NULL, 'edit')));
drop policy if exists tenant_distributions_ops_read_with_grant on tenant_distributions;
create policy tenant_distributions_ops_read_with_grant on tenant_distributions for select using (app.ops_grant_ok(tenant_distributions.tenant_id));

alter table service_registry_versions enable row level security;
alter table service_registry_versions force row level security;
drop policy if exists service_registry_versions_tenant_read on service_registry_versions;
create policy service_registry_versions_tenant_read on service_registry_versions for select using (app.member_ok() AND (tenant_id = app.tenant_id()));
drop policy if exists service_registry_versions_permission_write_insert on service_registry_versions;
create policy service_registry_versions_permission_write_insert on service_registry_versions for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'service_registry_versions', NULL, 'edit')));
drop policy if exists service_registry_versions_permission_write_update on service_registry_versions;
create policy service_registry_versions_permission_write_update on service_registry_versions for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'service_registry_versions', NULL, 'edit'))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'service_registry_versions', NULL, 'edit')));
drop policy if exists service_registry_versions_permission_write_delete on service_registry_versions;
create policy service_registry_versions_permission_write_delete on service_registry_versions for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'service_registry_versions', NULL, 'edit')));
drop policy if exists service_registry_versions_ops_read_with_grant on service_registry_versions;
create policy service_registry_versions_ops_read_with_grant on service_registry_versions for select using (app.ops_grant_ok(service_registry_versions.tenant_id));

alter table service_requests enable row level security;
alter table service_requests force row level security;
drop policy if exists service_requests_tenant_read on service_requests;
create policy service_requests_tenant_read on service_requests for select using (app.member_ok() AND (tenant_id = app.tenant_id()));
drop policy if exists service_requests_self_only_write_insert on service_requests;
create policy service_requests_self_only_write_insert on service_requests for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND requested_by = app.user_id()));
drop policy if exists service_requests_self_only_write_update on service_requests;
create policy service_requests_self_only_write_update on service_requests for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND requested_by = app.user_id())) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND requested_by = app.user_id()));
drop policy if exists service_requests_self_only_write_delete on service_requests;
create policy service_requests_self_only_write_delete on service_requests for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND requested_by = app.user_id()));
drop policy if exists service_requests_permission_write_insert on service_requests;
create policy service_requests_permission_write_insert on service_requests for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'service_requests', NULL, 'edit')));
drop policy if exists service_requests_permission_write_update on service_requests;
create policy service_requests_permission_write_update on service_requests for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'service_requests', NULL, 'edit'))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'service_requests', NULL, 'edit')));
drop policy if exists service_requests_permission_write_delete on service_requests;
create policy service_requests_permission_write_delete on service_requests for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'service_requests', NULL, 'edit')));
drop policy if exists service_requests_ops_read_with_grant on service_requests;
create policy service_requests_ops_read_with_grant on service_requests for select using (app.ops_grant_ok(service_requests.tenant_id));

alter table review_requests enable row level security;
alter table review_requests force row level security;
drop policy if exists review_requests_tenant_read on review_requests;
create policy review_requests_tenant_read on review_requests for select using (app.member_ok() AND (tenant_id = app.tenant_id()));
drop policy if exists review_requests_permission_write_insert on review_requests;
create policy review_requests_permission_write_insert on review_requests for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'review_requests', NULL, 'edit')));
drop policy if exists review_requests_permission_write_update on review_requests;
create policy review_requests_permission_write_update on review_requests for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'review_requests', NULL, 'edit'))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'review_requests', NULL, 'edit')));
drop policy if exists review_requests_permission_write_delete on review_requests;
create policy review_requests_permission_write_delete on review_requests for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'review_requests', NULL, 'edit')));
drop policy if exists review_requests_ops_read_with_grant on review_requests;
create policy review_requests_ops_read_with_grant on review_requests for select using (app.ops_grant_ok(review_requests.tenant_id));

alter table ops_members enable row level security;
alter table ops_members force row level security;
drop policy if exists ops_members_ops_all on ops_members;
create policy ops_members_ops_all on ops_members for all using (tenant_id = app.ops_tenant_id() AND current_setting('app.role', true) = 'ops') with check (tenant_id = app.ops_tenant_id() AND current_setting('app.role', true) = 'ops');
