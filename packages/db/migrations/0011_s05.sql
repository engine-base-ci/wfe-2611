-- 0011_s05.sql：データ層 5. 実行・統制（10 表・migration・RLS・索引・seed（T-D-05）。正本 07_functional/entities.json（ER図）から scripts/ci/gen_ddl.py が生成。手で直さない（直すなら ER図 → build_functional → 再生成）

-- E-036 credential_kinds（5. 実行・統制）
create table if not exists credential_kinds (
  key text primary key,
  label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- E-030 daily_plans（5. 実行・統制）
create table if not exists daily_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  member_id uuid references members(id),
  plan_date date,
  capacity_minutes int,
  committed_at timestamptz,
  closed_at timestamptz,
  carry_over jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists daily_plans_tenant_idx on daily_plans (tenant_id);
create index if not exists daily_plans_member_id_idx on daily_plans (member_id);
drop trigger if exists daily_plans_updated_at on daily_plans; create trigger daily_plans_updated_at before update on daily_plans for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('daily_plans', 'daily_plans') on conflict do nothing;

-- E-032 policies（5. 実行・統制）
create table if not exists policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  scope_id uuid not null references scopes(id),
  subject_kind_id text,
  action_kind_id text,
  mode_id text,
  params jsonb,
  is_locked boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists policies_tenant_idx on policies (tenant_id);
create index if not exists policies_scope_idx on policies (tenant_id, scope_id);
drop trigger if exists policies_updated_at on policies; create trigger policies_updated_at before update on policies for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('policies', 'policies') on conflict do nothing;

-- E-035 service_registry（5. 実行・統制）
create table if not exists service_registry (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  name text,
  domain text,
  automation_verdict_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists service_registry_tenant_idx on service_registry (tenant_id);
drop trigger if exists service_registry_updated_at on service_registry; create trigger service_registry_updated_at before update on service_registry for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('service_registry', 'service_registry') on conflict do nothing;

-- E-028 tasks（5. 実行・統制）
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  scope_id uuid not null references scopes(id),
  goal_id uuid references goals(id),
  measure_id uuid references measures(id),
  assignee_member_id uuid references members(id),
  status_id text,
  due_on date,
  title text,
  origin_id uuid,
  goal_changed_at timestamptz,
  next_action text,
  estimate_minutes int,
  actual_minutes int,
  planned_for date,
  blocked_reason_id text,
  blocked_since timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists tasks_tenant_idx on tasks (tenant_id);
create index if not exists tasks_scope_idx on tasks (tenant_id, scope_id);
create index if not exists tasks_goal_id_idx on tasks (goal_id);
create index if not exists tasks_measure_id_idx on tasks (measure_id);
create index if not exists tasks_assignee_member_id_idx on tasks (assignee_member_id);
drop trigger if exists tasks_updated_at on tasks; create trigger tasks_updated_at before update on tasks for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('tasks', 'tasks') on conflict do nothing;

-- E-031 triggers（5. 実行・統制）
create table if not exists triggers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  scope_id uuid not null references scopes(id),
  kind_id text,
  cron_expr text,
  timezone text,
  on_missed_id text,
  ttl_minutes int,
  enabled boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists triggers_tenant_idx on triggers (tenant_id);
create index if not exists triggers_scope_idx on triggers (tenant_id, scope_id);
drop trigger if exists triggers_updated_at on triggers; create trigger triggers_updated_at before update on triggers for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('triggers', 'triggers') on conflict do nothing;

-- E-034 action_runs（5. 実行・統制）
create table if not exists action_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  scope_id uuid not null references scopes(id),
  task_id uuid references tasks(id),
  action_kind_id text,
  choke_point_id text,
  service_id uuid references service_registry(id),
  procedure_id uuid references learned_procedures(id),
  status_id text,
  started_at timestamptz,
  finished_at timestamptz,
  tokens_in int,
  tokens_out int,
  cost numeric,
  error_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists action_runs_tenant_idx on action_runs (tenant_id);
create index if not exists action_runs_scope_idx on action_runs (tenant_id, scope_id);
create index if not exists action_runs_task_id_idx on action_runs (task_id);
create index if not exists action_runs_service_id_idx on action_runs (service_id);
create index if not exists action_runs_procedure_id_idx on action_runs (procedure_id);
drop trigger if exists action_runs_updated_at on action_runs; create trigger action_runs_updated_at before update on action_runs for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('action_runs', 'action_runs') on conflict do nothing;

-- E-037 credentials（5. 実行・統制）
create table if not exists credentials (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  scope_id uuid not null references scopes(id),
  service_id uuid references service_registry(id),
  kind_id text references credential_kinds(key),
  vault_ref text,
  owner_member_id uuid references members(id),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists credentials_tenant_idx on credentials (tenant_id);
create index if not exists credentials_scope_idx on credentials (tenant_id, scope_id);
create index if not exists credentials_service_id_idx on credentials (service_id);
create index if not exists credentials_owner_member_id_idx on credentials (owner_member_id);
drop trigger if exists credentials_updated_at on credentials; create trigger credentials_updated_at before update on credentials for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('credentials', 'credentials') on conflict do nothing;

-- E-029 task_handovers（5. 実行・統制）
create table if not exists task_handovers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  task_id uuid references tasks(id),
  from_member_id uuid references members(id),
  to_member_id uuid references members(id),
  mode_id text,
  agreement_status_id text,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists task_handovers_tenant_idx on task_handovers (tenant_id);
create index if not exists task_handovers_task_id_idx on task_handovers (task_id);
create index if not exists task_handovers_from_member_id_idx on task_handovers (from_member_id);
create index if not exists task_handovers_to_member_id_idx on task_handovers (to_member_id);
drop trigger if exists task_handovers_updated_at on task_handovers; create trigger task_handovers_updated_at before update on task_handovers for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('task_handovers', 'task_handovers') on conflict do nothing;

-- E-033 approvals（5. 実行・統制）
create table if not exists approvals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  scope_id uuid not null references scopes(id),
  action_run_id uuid references action_runs(id),
  requested_by uuid references members(id),
  approver_member_id uuid references members(id),
  status_id text,
  resolved_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists approvals_tenant_idx on approvals (tenant_id);
create index if not exists approvals_scope_idx on approvals (tenant_id, scope_id);
create index if not exists approvals_action_run_id_idx on approvals (action_run_id);
create index if not exists approvals_requested_by_idx on approvals (requested_by);
create index if not exists approvals_approver_member_id_idx on approvals (approver_member_id);
drop trigger if exists approvals_updated_at on approvals; create trigger approvals_updated_at before update on approvals for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('approvals', 'approvals') on conflict do nothing;

-- 先に作った表から今回の表への FK
do $$ begin if not exists (select 1 from pg_constraint where conname = 'learned_procedures_target_service_id_fkey') and exists (select 1 from information_schema.columns where table_name = 'learned_procedures' and column_name = 'target_service_id' and data_type = 'uuid') then alter table learned_procedures add constraint learned_procedures_target_service_id_fkey foreign key (target_service_id) references service_registry(id); end if; end $$;

grant select, insert, update, delete on credential_kinds, daily_plans, policies, service_registry, tasks, triggers, action_runs, credentials, task_handovers, approvals to kaname_app;
insert into app.schema_migrations (name) values ('0011_s05.sql') on conflict do nothing;
