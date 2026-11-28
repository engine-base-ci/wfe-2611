-- RLS（機械生成：scripts/ci/gen_rls.py ← 07_functional/entities.json の access_control_policies。手で直さない）

alter table learning_candidates enable row level security;
alter table learning_candidates force row level security;
drop policy if exists learning_candidates_read on learning_candidates;
create policy learning_candidates_read on learning_candidates for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND (owner_member_id = app.user_id() OR ((state = 'needs_ok' OR decided_by = app.user_id()) AND has_permission(app.user_id(), 'learning_candidates', NULL, 'edit')))));
drop policy if exists learning_candidates_self_write_insert on learning_candidates;
create policy learning_candidates_self_write_insert on learning_candidates for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND owner_member_id = app.user_id()));
drop policy if exists learning_candidates_self_write_update on learning_candidates;
create policy learning_candidates_self_write_update on learning_candidates for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND owner_member_id = app.user_id())) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND owner_member_id = app.user_id()));
drop policy if exists learning_candidates_ok on learning_candidates;
create policy learning_candidates_ok on learning_candidates for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND state IN ('needs_ok', 'learned', 'rejected') AND has_permission(app.user_id(), 'learning_candidates', NULL, 'edit'))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND state IN ('needs_ok', 'learned', 'rejected') AND has_permission(app.user_id(), 'learning_candidates', NULL, 'edit')));
drop policy if exists learning_candidates_ops_read_with_grant on learning_candidates;
create policy learning_candidates_ops_read_with_grant on learning_candidates for select using (app.ops_grant_ok(learning_candidates.tenant_id));

alter table operations enable row level security;
alter table operations force row level security;
drop policy if exists operations_ops_all on operations;
create policy operations_ops_all on operations for all using (tenant_id = app.ops_tenant_id() AND current_setting('app.role', true) = 'ops') with check (tenant_id = app.ops_tenant_id() AND current_setting('app.role', true) = 'ops');

alter table ops_plan_proposals enable row level security;
alter table ops_plan_proposals force row level security;
drop policy if exists ops_plan_proposals_ops_all on ops_plan_proposals;
create policy ops_plan_proposals_ops_all on ops_plan_proposals for all using (tenant_id = app.ops_tenant_id() AND current_setting('app.role', true) = 'ops') with check (tenant_id = app.ops_tenant_id() AND current_setting('app.role', true) = 'ops');
