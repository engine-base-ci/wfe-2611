-- 0009_s03.sql：データ層 3. 会社モデル ── 台帳（5 表・migration・RLS・索引（T-D-03）。正本 07_functional/entities.json（ER図）から scripts/ci/gen_ddl.py が生成。手で直さない（直すなら ER図 → build_functional → 再生成）

-- E-017 ledger_definitions（3. 会社モデル ── 台帳）
create table if not exists ledger_definitions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  scope_id uuid not null references scopes(id),
  version int not null default 1,
  kind_id text,
  name text,
  json_schema jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists ledger_definitions_tenant_idx on ledger_definitions (tenant_id);
create index if not exists ledger_definitions_scope_idx on ledger_definitions (tenant_id, scope_id);
drop trigger if exists ledger_definitions_updated_at on ledger_definitions; create trigger ledger_definitions_updated_at before update on ledger_definitions for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('ledger_definitions', 'ledger_definitions') on conflict do nothing;

-- E-018 ledger_fields（3. 会社モデル ── 台帳）
create table if not exists ledger_fields (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  definition_id uuid references ledger_definitions(id),
  key text not null,
  label text not null,
  data_type_id text,
  required boolean,
  options_master_id uuid,
  order_no int,
  is_filterable boolean,
  is_sortable boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  unique (definition_id, key)
);
create index if not exists ledger_fields_tenant_idx on ledger_fields (tenant_id);
create index if not exists ledger_fields_definition_id_idx on ledger_fields (definition_id);
drop trigger if exists ledger_fields_updated_at on ledger_fields; create trigger ledger_fields_updated_at before update on ledger_fields for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('ledger_fields', 'ledger_fields') on conflict do nothing;

-- E-019 ledger_stages（3. 会社モデル ── 台帳）
create table if not exists ledger_stages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  definition_id uuid references ledger_definitions(id),
  key text not null,
  label text not null,
  order_no int,
  rules jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  unique (definition_id, key)
);
create index if not exists ledger_stages_tenant_idx on ledger_stages (tenant_id);
create index if not exists ledger_stages_definition_id_idx on ledger_stages (definition_id);
drop trigger if exists ledger_stages_updated_at on ledger_stages; create trigger ledger_stages_updated_at before update on ledger_stages for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('ledger_stages', 'ledger_stages') on conflict do nothing;

-- E-020 ledger_views（3. 会社モデル ── 台帳）
create table if not exists ledger_views (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  scope_id uuid not null references scopes(id),
  definition_id uuid references ledger_definitions(id),
  kind_id text,
  filters jsonb,
  sorts jsonb,
  columns jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists ledger_views_tenant_idx on ledger_views (tenant_id);
create index if not exists ledger_views_scope_idx on ledger_views (tenant_id, scope_id);
create index if not exists ledger_views_definition_id_idx on ledger_views (definition_id);
drop trigger if exists ledger_views_updated_at on ledger_views; create trigger ledger_views_updated_at before update on ledger_views for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('ledger_views', 'ledger_views') on conflict do nothing;

-- E-021 ledger_records（3. 会社モデル ── 台帳）
create table if not exists ledger_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  scope_id uuid not null references scopes(id),
  definition_id uuid references ledger_definitions(id),
  stage_id uuid references ledger_stages(id),
  amount numeric(18,4),
  occurred_on date,
  assignee_id uuid references members(id),
  goal_id uuid references goals(id),
  measure_id uuid references measures(id),
  data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists ledger_records_tenant_idx on ledger_records (tenant_id);
create index if not exists ledger_records_scope_idx on ledger_records (tenant_id, scope_id);
create index if not exists ledger_records_definition_id_idx on ledger_records (definition_id);
create index if not exists ledger_records_stage_id_idx on ledger_records (stage_id);
create index if not exists ledger_records_assignee_id_idx on ledger_records (assignee_id);
create index if not exists ledger_records_goal_id_idx on ledger_records (goal_id);
create index if not exists ledger_records_measure_id_idx on ledger_records (measure_id);
drop trigger if exists ledger_records_updated_at on ledger_records; create trigger ledger_records_updated_at before update on ledger_records for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('ledger_records', 'ledger_records') on conflict do nothing;

grant select, insert, update, delete on ledger_definitions, ledger_fields, ledger_stages, ledger_views, ledger_records to kaname_app;
insert into app.schema_migrations (name) values ('0009_s03.sql') on conflict do nothing;
