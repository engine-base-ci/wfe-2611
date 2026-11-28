-- 0014_s11.sql：データ層 11. 運営（9 表・migration・RLS・索引・seed）（T-D-10）。正本 07_functional/entities.json（ER図）から scripts/ci/gen_ddl.py が生成。手で直さない（直すなら ER図 → build_functional → 再生成）

-- E-054 distributions（11. 運営）
create table if not exists distributions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) default app.ops_tenant_id(),
  kind_id text,
  key text not null,
  name text,
  current_version int,
  plan_ids uuid[],
  is_locked boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  unique (tenant_id, key)
);
create index if not exists distributions_tenant_idx on distributions (tenant_id);
drop trigger if exists distributions_updated_at on distributions; create trigger distributions_updated_at before update on distributions for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('distributions', 'distributions') on conflict do nothing;

-- E-060 ops_members（11. 運営）
create table if not exists ops_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) default app.ops_tenant_id(),
  member_id uuid references members(id),
  ops_role_id text,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists ops_members_tenant_idx on ops_members (tenant_id);
create index if not exists ops_members_member_id_idx on ops_members (member_id);
drop trigger if exists ops_members_updated_at on ops_members; create trigger ops_members_updated_at before update on ops_members for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('ops_members', 'ops_members') on conflict do nothing;

-- E-059 review_requests（11. 運営）
create table if not exists review_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  subject_type text,
  subject_id uuid,
  anonymization_check jsonb,
  status_id text,
  reviewer_ops_member_id uuid references members(id),
  decided_at timestamptz,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists review_requests_tenant_idx on review_requests (tenant_id);
create index if not exists review_requests_reviewer_ops_member_id_idx on review_requests (reviewer_ops_member_id);
drop trigger if exists review_requests_updated_at on review_requests; create trigger review_requests_updated_at before update on review_requests for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('review_requests', 'review_requests') on conflict do nothing;

-- E-057 service_registry_versions（11. 運営）
create table if not exists service_registry_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  service_id uuid references service_registry(id),
  version int not null,
  automation_verdict_id text,
  reason text,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  unique (service_id, version)
);
create index if not exists service_registry_versions_tenant_idx on service_registry_versions (tenant_id);
create index if not exists service_registry_versions_service_id_idx on service_registry_versions (service_id);
drop trigger if exists service_registry_versions_updated_at on service_registry_versions; create trigger service_registry_versions_updated_at before update on service_registry_versions for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('service_registry_versions', 'service_registry_versions') on conflict do nothing;

-- E-058 service_requests（11. 運営）
create table if not exists service_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  service_name text,
  url text,
  requested_by uuid references members(id),
  verdict_id text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists service_requests_tenant_idx on service_requests (tenant_id);
create index if not exists service_requests_requested_by_idx on service_requests (requested_by);
drop trigger if exists service_requests_updated_at on service_requests; create trigger service_requests_updated_at before update on service_requests for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('service_requests', 'service_requests') on conflict do nothing;

-- E-055 distribution_versions（11. 運営）
create table if not exists distribution_versions (
  id uuid primary key default gen_random_uuid(),
  distribution_id uuid references distributions(id),
  version int not null,
  snapshot jsonb,
  released_at timestamptz,
  released_by uuid references members(id),
  change_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (distribution_id, version)
);
create index if not exists distribution_versions_distribution_id_idx on distribution_versions (distribution_id);
create index if not exists distribution_versions_released_by_idx on distribution_versions (released_by);
drop trigger if exists distribution_versions_updated_at on distribution_versions; create trigger distribution_versions_updated_at before update on distribution_versions for each row execute function app.set_updated_at();

-- E-056 tenant_distributions（11. 運営）
create table if not exists tenant_distributions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  distribution_id uuid references distributions(id),
  version_in_use int,
  enabled boolean,
  override jsonb,
  disabled_by uuid references members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists tenant_distributions_tenant_idx on tenant_distributions (tenant_id);
create index if not exists tenant_distributions_distribution_id_idx on tenant_distributions (distribution_id);
create index if not exists tenant_distributions_disabled_by_idx on tenant_distributions (disabled_by);
drop trigger if exists tenant_distributions_updated_at on tenant_distributions; create trigger tenant_distributions_updated_at before update on tenant_distributions for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('tenant_distributions', 'tenant_distributions') on conflict do nothing;

grant select, insert, update, delete on distributions, ops_members, review_requests, service_registry_versions, service_requests, distribution_versions, tenant_distributions to kaname_app;
insert into app.schema_migrations (name) values ('0014_s11.sql') on conflict do nothing;
