-- RLS（機械生成：scripts/ci/gen_rls.py ← 07_functional/entities.json の access_control_policies。手で直さない）

alter table approvals enable row level security;
alter table approvals force row level security;
do $$ declare r record; begin for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'approvals' and policyname <> all (array['approvals_decide', 'approvals_ops_read_with_grant', 'approvals_read', 'approvals_request']::name[]) loop execute format('drop policy %I on approvals', r.policyname); end loop; end $$;
drop policy if exists approvals_read on approvals;
create policy approvals_read on approvals for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND (scope_id = ANY(visible_scopes(app.user_id())) OR approver_member_id = app.user_id() OR requested_by = app.user_id() OR (ticket_id IS NOT NULL AND app.ticket_visible(ticket_id)))));
drop policy if exists approvals_request on approvals;
create policy approvals_request on approvals for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND requested_by = app.user_id() AND (ticket_id IS NULL OR app.ticket_writable(ticket_id))));
drop policy if exists approvals_decide on approvals;
create policy approvals_decide on approvals for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND (approver_member_id = app.user_id() OR requested_by = app.user_id() OR has_permission(app.user_id(), 'approvals', scope_id, 'edit')))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND (approver_member_id = app.user_id() OR requested_by = app.user_id() OR has_permission(app.user_id(), 'approvals', scope_id, 'edit'))));
drop policy if exists approvals_ops_read_with_grant on approvals;
create policy approvals_ops_read_with_grant on approvals for select using (app.ops_grant_ok(approvals.tenant_id));

alter table skills enable row level security;
alter table skills force row level security;
do $$ declare r record; begin for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'skills' and policyname <> all (array['skills_catalog_read', 'skills_ops_all']::name[]) loop execute format('drop policy %I on skills', r.policyname); end loop; end $$;
drop policy if exists skills_catalog_read on skills;
create policy skills_catalog_read on skills for select using (coalesce(current_setting('app.user_id', true), '') <> '' AND (tenant_id = app.ops_tenant_id() AND scope_id IS NULL));
drop policy if exists skills_ops_all on skills;
create policy skills_ops_all on skills for all using (tenant_id = app.ops_tenant_id() AND current_setting('app.role', true) = 'ops') with check (tenant_id = app.ops_tenant_id() AND current_setting('app.role', true) = 'ops');

alter table service_registry_versions enable row level security;
alter table service_registry_versions force row level security;
do $$ declare r record; begin for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'service_registry_versions' and policyname <> all (array['service_registry_versions_ops_all']::name[]) loop execute format('drop policy %I on service_registry_versions', r.policyname); end loop; end $$;
drop policy if exists service_registry_versions_ops_all on service_registry_versions;
create policy service_registry_versions_ops_all on service_registry_versions for all using (tenant_id = app.ops_tenant_id() AND current_setting('app.role', true) = 'ops') with check (tenant_id = app.ops_tenant_id() AND current_setting('app.role', true) = 'ops');

alter table skill_test_runs enable row level security;
alter table skill_test_runs force row level security;
do $$ declare r record; begin for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'skill_test_runs' and policyname <> all (array['skill_test_runs_ops_all']::name[]) loop execute format('drop policy %I on skill_test_runs', r.policyname); end loop; end $$;
drop policy if exists skill_test_runs_ops_all on skill_test_runs;
create policy skill_test_runs_ops_all on skill_test_runs for all using (tenant_id = app.ops_tenant_id() AND current_setting('app.role', true) = 'ops') with check (tenant_id = app.ops_tenant_id() AND current_setting('app.role', true) = 'ops');
