-- RLS（機械生成：scripts/ci/gen_rls.py ← 07_functional/entities.json の access_control_policies。手で直さない）

alter table conversations enable row level security;
alter table conversations force row level security;
drop policy if exists conversations_tenant_read on conversations;
create policy conversations_tenant_read on conversations for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND scope_id = ANY(visible_scopes(app.user_id()))));
drop policy if exists conversations_permission_write_insert on conversations;
create policy conversations_permission_write_insert on conversations for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'conversations', scope_id, 'edit')));
drop policy if exists conversations_permission_write_update on conversations;
create policy conversations_permission_write_update on conversations for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'conversations', scope_id, 'edit'))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'conversations', scope_id, 'edit')));
drop policy if exists conversations_permission_write_delete on conversations;
create policy conversations_permission_write_delete on conversations for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'conversations', scope_id, 'edit')));
drop policy if exists conversations_ops_read_with_grant on conversations;
create policy conversations_ops_read_with_grant on conversations for select using (app.ops_grant_ok(conversations.tenant_id));

alter table messages enable row level security;
alter table messages force row level security;
drop policy if exists messages_tenant_read on messages;
create policy messages_tenant_read on messages for select using (app.member_ok() AND (tenant_id = app.tenant_id()));
drop policy if exists messages_permission_write_insert on messages;
create policy messages_permission_write_insert on messages for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'messages', NULL, 'edit')));
drop policy if exists messages_permission_write_update on messages;
create policy messages_permission_write_update on messages for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'messages', NULL, 'edit'))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'messages', NULL, 'edit')));
drop policy if exists messages_permission_write_delete on messages;
create policy messages_permission_write_delete on messages for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'messages', NULL, 'edit')));
drop policy if exists messages_ops_read_with_grant on messages;
create policy messages_ops_read_with_grant on messages for select using (app.ops_grant_ok(messages.tenant_id));

alter table artifacts enable row level security;
alter table artifacts force row level security;
drop policy if exists artifacts_tenant_read on artifacts;
create policy artifacts_tenant_read on artifacts for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND scope_id = ANY(visible_scopes(app.user_id()))));
drop policy if exists artifacts_permission_write_insert on artifacts;
create policy artifacts_permission_write_insert on artifacts for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'artifacts', scope_id, 'edit')));
drop policy if exists artifacts_permission_write_update on artifacts;
create policy artifacts_permission_write_update on artifacts for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'artifacts', scope_id, 'edit'))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'artifacts', scope_id, 'edit')));
drop policy if exists artifacts_permission_write_delete on artifacts;
create policy artifacts_permission_write_delete on artifacts for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'artifacts', scope_id, 'edit')));
drop policy if exists artifacts_ops_read_with_grant on artifacts;
create policy artifacts_ops_read_with_grant on artifacts for select using (app.ops_grant_ok(artifacts.tenant_id));
