-- RLS（機械生成：scripts/ci/gen_rls.py ← 07_functional/entities.json の access_control_policies。手で直さない）

alter table bridge_jobs enable row level security;
alter table bridge_jobs force row level security;
do $$ declare r record; begin for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'bridge_jobs' and policyname <> all (array['bridge_jobs_ops_read_with_grant', 'bridge_jobs_self_only_write_insert', 'bridge_jobs_self_only_write_update', 'bridge_jobs_self_read']::name[]) loop execute format('drop policy %I on bridge_jobs', r.policyname); end loop; end $$;
drop policy if exists bridge_jobs_self_read on bridge_jobs;
create policy bridge_jobs_self_read on bridge_jobs for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND member_id = app.user_id()));
drop policy if exists bridge_jobs_self_only_write_insert on bridge_jobs;
create policy bridge_jobs_self_only_write_insert on bridge_jobs for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND member_id = app.user_id()));
drop policy if exists bridge_jobs_self_only_write_update on bridge_jobs;
create policy bridge_jobs_self_only_write_update on bridge_jobs for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND member_id = app.user_id())) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND member_id = app.user_id()));
drop policy if exists bridge_jobs_ops_read_with_grant on bridge_jobs;
create policy bridge_jobs_ops_read_with_grant on bridge_jobs for select using (app.ops_grant_ok(bridge_jobs.tenant_id));

alter table bridge_job_events enable row level security;
alter table bridge_job_events force row level security;
do $$ declare r record; begin for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'bridge_job_events' and policyname <> all (array['bridge_job_events_ops_read_with_grant', 'bridge_job_events_self_only_write', 'bridge_job_events_self_read']::name[]) loop execute format('drop policy %I on bridge_job_events', r.policyname); end loop; end $$;
drop policy if exists bridge_job_events_self_read on bridge_job_events;
create policy bridge_job_events_self_read on bridge_job_events for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND member_id = app.user_id()));
drop policy if exists bridge_job_events_self_only_write on bridge_job_events;
create policy bridge_job_events_self_only_write on bridge_job_events for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND member_id = app.user_id()));
drop policy if exists bridge_job_events_ops_read_with_grant on bridge_job_events;
create policy bridge_job_events_ops_read_with_grant on bridge_job_events for select using (app.ops_grant_ok(bridge_job_events.tenant_id));
