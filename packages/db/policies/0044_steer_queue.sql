-- 会話は本人のもの（D-104.1：人が「新しく話す」で分け、一覧から戻る）。ER図で owner_member_id を持たせたので本人は権限なしで作れて直せる（D-073.1）
-- RLS（機械生成：scripts/ci/gen_rls.py ← 07_functional/entities.json の access_control_policies。手で直さない）

alter table conversations enable row level security;
alter table conversations force row level security;
drop policy if exists conversations_tenant_read on conversations;
create policy conversations_tenant_read on conversations for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND scope_id = ANY(visible_scopes(app.user_id()))));
drop policy if exists conversations_self_only_write_insert on conversations;
create policy conversations_self_only_write_insert on conversations for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND owner_member_id = app.user_id()));
drop policy if exists conversations_self_only_write_update on conversations;
create policy conversations_self_only_write_update on conversations for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND owner_member_id = app.user_id())) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND owner_member_id = app.user_id()));
drop policy if exists conversations_self_only_write_delete on conversations;
create policy conversations_self_only_write_delete on conversations for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND owner_member_id = app.user_id()));
drop policy if exists conversations_permission_write_insert on conversations;
create policy conversations_permission_write_insert on conversations for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'conversations', scope_id, 'edit')));
drop policy if exists conversations_permission_write_update on conversations;
create policy conversations_permission_write_update on conversations for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'conversations', scope_id, 'edit'))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'conversations', scope_id, 'edit')));
drop policy if exists conversations_permission_write_delete on conversations;
create policy conversations_permission_write_delete on conversations for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'conversations', scope_id, 'edit')));
drop policy if exists conversations_ops_read_with_grant on conversations;
create policy conversations_ops_read_with_grant on conversations for select using (app.ops_grant_ok(conversations.tenant_id));
