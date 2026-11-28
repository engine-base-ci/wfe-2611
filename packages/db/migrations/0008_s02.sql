-- 0008_s02.sql：データ層 2. 会社モデル ── 目標（10 表・migration・RLS・索（T-D-02）。正本 07_functional/entities.json（ER図）から scripts/ci/gen_ddl.py が生成。手で直さない（直すなら ER図 → build_functional → 再生成）

-- E-007 goal_kinds（2. 会社モデル ── 目標）
create table if not exists goal_kinds (
  key text primary key,
  label text not null,
  progress_strategy text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- E-009 rollup_kinds（2. 会社モデル ── 目標）
create table if not exists rollup_kinds (
  key text primary key,
  label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- E-008 units（2. 会社モデル ── 目標）
create table if not exists units (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  scope_id uuid not null references scopes(id),
  key text not null,
  label text not null,
  symbol text,
  value_type_id text,
  decimals int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  unique (tenant_id, key)
);
create index if not exists units_tenant_idx on units (tenant_id);
create index if not exists units_scope_idx on units (tenant_id, scope_id);
drop trigger if exists units_updated_at on units; create trigger units_updated_at before update on units for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('units', 'units') on conflict do nothing;

-- E-010 goals（2. 会社モデル ── 目標）
create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  scope_id uuid not null references scopes(id),
  version int not null default 1,
  ended_at timestamptz,
  parent_id uuid references goals(id),
  rollup_kind_id text references rollup_kinds(key),
  rollup_spec jsonb,
  kind_id text references goal_kinds(key),
  period_start date,
  period_end date,
  target_value numeric,
  unit_id uuid references units(id),
  origin_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists goals_tenant_idx on goals (tenant_id);
create index if not exists goals_scope_idx on goals (tenant_id, scope_id);
create index if not exists goals_unit_id_idx on goals (unit_id);
drop trigger if exists goals_updated_at on goals; create trigger goals_updated_at before update on goals for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('goals', 'goals') on conflict do nothing;

-- E-011 goal_allocations（2. 会社モデル ── 目標）
create table if not exists goal_allocations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  goal_id uuid references goals(id),
  assignee_member_id uuid references members(id),
  allocated_value numeric,
  agreement_status_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists goal_allocations_tenant_idx on goal_allocations (tenant_id);
create index if not exists goal_allocations_goal_id_idx on goal_allocations (goal_id);
create index if not exists goal_allocations_assignee_member_id_idx on goal_allocations (assignee_member_id);
drop trigger if exists goal_allocations_updated_at on goal_allocations; create trigger goal_allocations_updated_at before update on goal_allocations for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('goal_allocations', 'goal_allocations') on conflict do nothing;

-- E-013 goal_versions（2. 会社モデル ── 目標）
create table if not exists goal_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  goal_id uuid references goals(id),
  version int not null,
  snapshot jsonb,
  changed_at timestamptz,
  changed_by uuid references members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  unique (goal_id, version)
);
create index if not exists goal_versions_tenant_idx on goal_versions (tenant_id);
create index if not exists goal_versions_goal_id_idx on goal_versions (goal_id);
create index if not exists goal_versions_changed_by_idx on goal_versions (changed_by);
drop trigger if exists goal_versions_updated_at on goal_versions; create trigger goal_versions_updated_at before update on goal_versions for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('goal_versions', 'goal_versions') on conflict do nothing;

-- E-014 hypotheses（2. 会社モデル ── 目標）
create table if not exists hypotheses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  scope_id uuid not null references scopes(id),
  goal_id uuid references goals(id),
  statement text,
  evidence text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists hypotheses_tenant_idx on hypotheses (tenant_id);
create index if not exists hypotheses_scope_idx on hypotheses (tenant_id, scope_id);
create index if not exists hypotheses_goal_id_idx on hypotheses (goal_id);
drop trigger if exists hypotheses_updated_at on hypotheses; create trigger hypotheses_updated_at before update on hypotheses for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('hypotheses', 'hypotheses') on conflict do nothing;

-- E-012 goal_contributions（2. 会社モデル ── 目標）
create table if not exists goal_contributions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  child_goal_id uuid references goals(id),
  parent_goal_id uuid references goals(id),
  hypothesis_id uuid references hypotheses(id),
  verdict_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists goal_contributions_tenant_idx on goal_contributions (tenant_id);
create index if not exists goal_contributions_child_goal_id_idx on goal_contributions (child_goal_id);
create index if not exists goal_contributions_parent_goal_id_idx on goal_contributions (parent_goal_id);
create index if not exists goal_contributions_hypothesis_id_idx on goal_contributions (hypothesis_id);
drop trigger if exists goal_contributions_updated_at on goal_contributions; create trigger goal_contributions_updated_at before update on goal_contributions for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('goal_contributions', 'goal_contributions') on conflict do nothing;

-- E-015 measures（2. 会社モデル ── 目標）
create table if not exists measures (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  scope_id uuid not null references scopes(id),
  hypothesis_id uuid references hypotheses(id),
  statement text,
  expected_effect numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists measures_tenant_idx on measures (tenant_id);
create index if not exists measures_scope_idx on measures (tenant_id, scope_id);
create index if not exists measures_hypothesis_id_idx on measures (hypothesis_id);
drop trigger if exists measures_updated_at on measures; create trigger measures_updated_at before update on measures for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('measures', 'measures') on conflict do nothing;

-- E-016 validations（2. 会社モデル ── 目標）
create table if not exists validations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  measure_id uuid references measures(id),
  measured_value numeric,
  verdict_id text,
  measured_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists validations_tenant_idx on validations (tenant_id);
create index if not exists validations_measure_id_idx on validations (measure_id);
drop trigger if exists validations_updated_at on validations; create trigger validations_updated_at before update on validations for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('validations', 'validations') on conflict do nothing;

grant select, insert, update, delete on goal_kinds, rollup_kinds, units, goals, goal_allocations, goal_versions, hypotheses, goal_contributions, measures, validations to kaname_app;
insert into app.schema_migrations (name) values ('0008_s02.sql') on conflict do nothing;
