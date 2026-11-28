-- RLS（機械生成：scripts/ci/gen_rls.py ← 07_functional/entities.json の access_control_policies。手で直さない）

alter table tenant_memberships enable row level security;
alter table tenant_memberships force row level security;
drop policy if exists tenant_memberships_read on tenant_memberships;
create policy tenant_memberships_read on tenant_memberships for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND (member_id = app.user_id() OR has_permission(app.user_id(), 'members', NULL, 'edit'))));
drop policy if exists tenant_memberships_admin_write_insert on tenant_memberships;
create policy tenant_memberships_admin_write_insert on tenant_memberships for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'members', NULL, 'edit')));
drop policy if exists tenant_memberships_admin_write_update on tenant_memberships;
create policy tenant_memberships_admin_write_update on tenant_memberships for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'members', NULL, 'edit'))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'members', NULL, 'edit')));
drop policy if exists tenant_memberships_ops_read_with_grant on tenant_memberships;
create policy tenant_memberships_ops_read_with_grant on tenant_memberships for select using (app.ops_grant_ok(tenant_memberships.tenant_id));

alter table scope_memberships enable row level security;
alter table scope_memberships force row level security;
drop policy if exists scope_memberships_read on scope_memberships;
create policy scope_memberships_read on scope_memberships for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND (member_id = app.user_id() OR scope_id = ANY(visible_scopes(app.user_id())))));
drop policy if exists scope_memberships_admin_write_insert on scope_memberships;
create policy scope_memberships_admin_write_insert on scope_memberships for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'members', NULL, 'edit')));
drop policy if exists scope_memberships_admin_write_update on scope_memberships;
create policy scope_memberships_admin_write_update on scope_memberships for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'members', NULL, 'edit'))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'members', NULL, 'edit')));
drop policy if exists scope_memberships_admin_write_delete on scope_memberships;
create policy scope_memberships_admin_write_delete on scope_memberships for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'members', NULL, 'edit')));
drop policy if exists scope_memberships_ops_read_with_grant on scope_memberships;
create policy scope_memberships_ops_read_with_grant on scope_memberships for select using (app.ops_grant_ok(scope_memberships.tenant_id));

alter table terms_versions enable row level security;
alter table terms_versions force row level security;
drop policy if exists terms_versions_all_read on terms_versions;
create policy terms_versions_all_read on terms_versions for select using (coalesce(current_setting('app.user_id', true), '') <> '' AND (true));
drop policy if exists terms_versions_ops_write_insert on terms_versions;
create policy terms_versions_ops_write_insert on terms_versions for insert with check (current_setting('app.role', true) = 'ops');
drop policy if exists terms_versions_ops_write_update on terms_versions;
create policy terms_versions_ops_write_update on terms_versions for update using (current_setting('app.role', true) = 'ops') with check (current_setting('app.role', true) = 'ops');

alter table terms_consents enable row level security;
alter table terms_consents force row level security;
drop policy if exists terms_consents_self_read on terms_consents;
create policy terms_consents_self_read on terms_consents for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND member_id = app.user_id()));
drop policy if exists terms_consents_self_add on terms_consents;
create policy terms_consents_self_add on terms_consents for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND member_id = app.user_id()));
drop policy if exists terms_consents_ops_read_with_grant on terms_consents;
create policy terms_consents_ops_read_with_grant on terms_consents for select using (app.ops_grant_ok(terms_consents.tenant_id));

alter table notification_settings enable row level security;
alter table notification_settings force row level security;
drop policy if exists notification_settings_self_select on notification_settings;
create policy notification_settings_self_select on notification_settings for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND member_id = app.user_id()));
drop policy if exists notification_settings_self_insert on notification_settings;
create policy notification_settings_self_insert on notification_settings for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND member_id = app.user_id()));
drop policy if exists notification_settings_self_update on notification_settings;
create policy notification_settings_self_update on notification_settings for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND member_id = app.user_id())) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND member_id = app.user_id()));
drop policy if exists notification_settings_ops_read_with_grant on notification_settings;
create policy notification_settings_ops_read_with_grant on notification_settings for select using (app.ops_grant_ok(notification_settings.tenant_id));

alter table bridge_pairing_codes enable row level security;
alter table bridge_pairing_codes force row level security;
drop policy if exists bridge_pairing_codes_self_select on bridge_pairing_codes;
create policy bridge_pairing_codes_self_select on bridge_pairing_codes for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND member_id = app.user_id()));
drop policy if exists bridge_pairing_codes_self_insert on bridge_pairing_codes;
create policy bridge_pairing_codes_self_insert on bridge_pairing_codes for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND member_id = app.user_id()));
