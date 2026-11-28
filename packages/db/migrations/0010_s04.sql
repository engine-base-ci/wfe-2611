-- 0010_s04.sql：データ層 4. 会社モデル ── 担当業務・記憶（6 表・migration・R（T-D-04）。正本 07_functional/entities.json（ER図）から scripts/ci/gen_ddl.py が生成。手で直さない（直すなら ER図 → build_functional → 再生成）

-- E-022 duties（4. 会社モデル ── 担当業務・記憶）
create table if not exists duties (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  scope_id uuid not null references scopes(id),
  version int not null default 1,
  ai_employee_id uuid references ai_employees(id),
  name text,
  definition_md text,
  constraints jsonb,
  visibility_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists duties_tenant_idx on duties (tenant_id);
create index if not exists duties_scope_idx on duties (tenant_id, scope_id);
create index if not exists duties_ai_employee_id_idx on duties (ai_employee_id);
drop trigger if exists duties_updated_at on duties; create trigger duties_updated_at before update on duties for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('duties', 'duties') on conflict do nothing;

-- E-026 memory_kinds（4. 会社モデル ── 担当業務・記憶）
create table if not exists memory_kinds (
  key text primary key,
  label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- E-023 duty_versions（4. 会社モデル ── 担当業務・記憶）
create table if not exists duty_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  duty_id uuid references duties(id),
  version int not null,
  snapshot jsonb,
  changed_by uuid references members(id),
  change_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  unique (duty_id, version)
);
create index if not exists duty_versions_tenant_idx on duty_versions (tenant_id);
create index if not exists duty_versions_duty_id_idx on duty_versions (duty_id);
create index if not exists duty_versions_changed_by_idx on duty_versions (changed_by);
drop trigger if exists duty_versions_updated_at on duty_versions; create trigger duty_versions_updated_at before update on duty_versions for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('duty_versions', 'duty_versions') on conflict do nothing;

-- E-024 learned_procedures（4. 会社モデル ── 担当業務・記憶）
create table if not exists learned_procedures (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  scope_id uuid not null references scopes(id),
  duty_id uuid references duties(id),
  target_service_id uuid /* FK → service_registry(id) は service_registry を作る migration で足す */,
  status_id text,
  run_count int,
  avg_ms int,
  fail_count int,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists learned_procedures_tenant_idx on learned_procedures (tenant_id);
create index if not exists learned_procedures_scope_idx on learned_procedures (tenant_id, scope_id);
create index if not exists learned_procedures_duty_id_idx on learned_procedures (duty_id);
create index if not exists learned_procedures_target_service_id_idx on learned_procedures (target_service_id);
drop trigger if exists learned_procedures_updated_at on learned_procedures; create trigger learned_procedures_updated_at before update on learned_procedures for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('learned_procedures', 'learned_procedures') on conflict do nothing;

-- E-027 memories（4. 会社モデル ── 担当業務・記憶）
create table if not exists memories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  scope_id uuid not null references scopes(id),
  kind_id text references memory_kinds(key),
  owner_member_id uuid references members(id),
  title text,
  body text,
  confidence numeric(3,2),
  source_type_id text,
  source_ref_id uuid,
  embedding vector(1536),
  approved_by uuid references members(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists memories_tenant_idx on memories (tenant_id);
create index if not exists memories_scope_idx on memories (tenant_id, scope_id);
create index if not exists memories_owner_member_id_idx on memories (owner_member_id);
create index if not exists memories_approved_by_idx on memories (approved_by);
drop trigger if exists memories_updated_at on memories; create trigger memories_updated_at before update on memories for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('memories', 'memories') on conflict do nothing;

-- E-025 procedure_steps（4. 会社モデル ── 担当業務・記憶）
create table if not exists procedure_steps (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  procedure_id uuid references learned_procedures(id),
  order_no int,
  intent_ja text,
  locator jsonb,
  is_variable boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists procedure_steps_tenant_idx on procedure_steps (tenant_id);
create index if not exists procedure_steps_procedure_id_idx on procedure_steps (procedure_id);
drop trigger if exists procedure_steps_updated_at on procedure_steps; create trigger procedure_steps_updated_at before update on procedure_steps for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('procedure_steps', 'procedure_steps') on conflict do nothing;

grant select, insert, update, delete on duties, memory_kinds, duty_versions, learned_procedures, memories, procedure_steps to kaname_app;
insert into app.schema_migrations (name) values ('0010_s04.sql') on conflict do nothing;
