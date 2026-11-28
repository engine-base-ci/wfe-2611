-- 成果物は書き出した本人のもの（D-106.8）。owner_member_id を持たせたので本人は権限なしで直せる（D-073.1）。他の会社からは見えない
-- RLS（機械生成：scripts/ci/gen_rls.py ← 07_functional/entities.json の access_control_policies。手で直さない）

alter table artifacts enable row level security;
alter table artifacts force row level security;
drop policy if exists artifacts_tenant_read on artifacts;
create policy artifacts_tenant_read on artifacts for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND scope_id = ANY(visible_scopes(app.user_id()))));
drop policy if exists artifacts_self_only_write_insert on artifacts;
create policy artifacts_self_only_write_insert on artifacts for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND owner_member_id = app.user_id()));
drop policy if exists artifacts_self_only_write_update on artifacts;
create policy artifacts_self_only_write_update on artifacts for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND owner_member_id = app.user_id())) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND owner_member_id = app.user_id()));
drop policy if exists artifacts_self_only_write_delete on artifacts;
create policy artifacts_self_only_write_delete on artifacts for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND owner_member_id = app.user_id()));
drop policy if exists artifacts_permission_write_insert on artifacts;
create policy artifacts_permission_write_insert on artifacts for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'artifacts', scope_id, 'edit')));
drop policy if exists artifacts_permission_write_update on artifacts;
create policy artifacts_permission_write_update on artifacts for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'artifacts', scope_id, 'edit'))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'artifacts', scope_id, 'edit')));
drop policy if exists artifacts_permission_write_delete on artifacts;
create policy artifacts_permission_write_delete on artifacts for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'artifacts', scope_id, 'edit')));
drop policy if exists artifacts_ops_read_with_grant on artifacts;
create policy artifacts_ops_read_with_grant on artifacts for select using (app.ops_grant_ok(artifacts.tenant_id));

alter table artifact_versions enable row level security;
alter table artifact_versions force row level security;
drop policy if exists artifact_versions_tenant_read on artifact_versions;
create policy artifact_versions_tenant_read on artifact_versions for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND scope_id = ANY(visible_scopes(app.user_id()))));
drop policy if exists artifact_versions_self_only_write_insert on artifact_versions;
create policy artifact_versions_self_only_write_insert on artifact_versions for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND owner_member_id = app.user_id()));
drop policy if exists artifact_versions_self_only_write_update on artifact_versions;
create policy artifact_versions_self_only_write_update on artifact_versions for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND owner_member_id = app.user_id())) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND owner_member_id = app.user_id()));
drop policy if exists artifact_versions_self_only_write_delete on artifact_versions;
create policy artifact_versions_self_only_write_delete on artifact_versions for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND owner_member_id = app.user_id()));
drop policy if exists artifact_versions_permission_write_insert on artifact_versions;
create policy artifact_versions_permission_write_insert on artifact_versions for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'artifact_versions', scope_id, 'edit')));
drop policy if exists artifact_versions_permission_write_update on artifact_versions;
create policy artifact_versions_permission_write_update on artifact_versions for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'artifact_versions', scope_id, 'edit'))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'artifact_versions', scope_id, 'edit')));
drop policy if exists artifact_versions_permission_write_delete on artifact_versions;
create policy artifact_versions_permission_write_delete on artifact_versions for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'artifact_versions', scope_id, 'edit')));
drop policy if exists artifact_versions_ops_read_with_grant on artifact_versions;
create policy artifact_versions_ops_read_with_grant on artifact_versions for select using (app.ops_grant_ok(artifact_versions.tenant_id));
