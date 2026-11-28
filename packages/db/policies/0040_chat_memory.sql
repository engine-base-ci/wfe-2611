-- RLS（機械生成：scripts/ci/gen_rls.py ← 07_functional/entities.json の access_control_policies。手で直さない）

alter table permission_rules enable row level security;
alter table permission_rules force row level security;
drop policy if exists permission_rules_self_read on permission_rules;
create policy permission_rules_self_read on permission_rules for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND member_id = app.user_id()));
drop policy if exists permission_rules_self_only_write_insert on permission_rules;
create policy permission_rules_self_only_write_insert on permission_rules for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND member_id = app.user_id()));
drop policy if exists permission_rules_self_only_write_update on permission_rules;
create policy permission_rules_self_only_write_update on permission_rules for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND member_id = app.user_id())) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND member_id = app.user_id()));
drop policy if exists permission_rules_self_only_write_delete on permission_rules;
create policy permission_rules_self_only_write_delete on permission_rules for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND member_id = app.user_id()));

alter table agent_usage_snapshots enable row level security;
alter table agent_usage_snapshots force row level security;
drop policy if exists agent_usage_snapshots_self_read on agent_usage_snapshots;
create policy agent_usage_snapshots_self_read on agent_usage_snapshots for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND member_id = app.user_id()));
drop policy if exists agent_usage_snapshots_self_only_write_insert on agent_usage_snapshots;
create policy agent_usage_snapshots_self_only_write_insert on agent_usage_snapshots for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND member_id = app.user_id()));
drop policy if exists agent_usage_snapshots_self_only_write_update on agent_usage_snapshots;
create policy agent_usage_snapshots_self_only_write_update on agent_usage_snapshots for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND member_id = app.user_id())) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND member_id = app.user_id()));
drop policy if exists agent_usage_snapshots_self_only_write_delete on agent_usage_snapshots;
create policy agent_usage_snapshots_self_only_write_delete on agent_usage_snapshots for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND member_id = app.user_id()));

alter table memory_digests enable row level security;
alter table memory_digests force row level security;
drop policy if exists memory_digests_self_read on memory_digests;
create policy memory_digests_self_read on memory_digests for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND member_id = app.user_id()));
drop policy if exists memory_digests_self_only_write_insert on memory_digests;
create policy memory_digests_self_only_write_insert on memory_digests for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND member_id = app.user_id()));
drop policy if exists memory_digests_self_only_write_update on memory_digests;
create policy memory_digests_self_only_write_update on memory_digests for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND member_id = app.user_id())) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND member_id = app.user_id()));
drop policy if exists memory_digests_self_only_write_delete on memory_digests;
create policy memory_digests_self_only_write_delete on memory_digests for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND member_id = app.user_id()));

alter table memory_proposals enable row level security;
alter table memory_proposals force row level security;
drop policy if exists memory_proposals_tenant_read on memory_proposals;
create policy memory_proposals_tenant_read on memory_proposals for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND scope_id = ANY(visible_scopes(app.user_id()))));
drop policy if exists memory_proposals_permission_write_insert on memory_proposals;
create policy memory_proposals_permission_write_insert on memory_proposals for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'memory_proposals', scope_id, 'edit')));
drop policy if exists memory_proposals_permission_write_update on memory_proposals;
create policy memory_proposals_permission_write_update on memory_proposals for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'memory_proposals', scope_id, 'edit'))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'memory_proposals', scope_id, 'edit')));
drop policy if exists memory_proposals_permission_write_delete on memory_proposals;
create policy memory_proposals_permission_write_delete on memory_proposals for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND has_permission(app.user_id(), 'memory_proposals', scope_id, 'edit')));
drop policy if exists memory_proposals_ops_read_with_grant on memory_proposals;
create policy memory_proposals_ops_read_with_grant on memory_proposals for select using (app.ops_grant_ok(memory_proposals.tenant_id));
