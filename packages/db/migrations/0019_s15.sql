-- 0019_s15.sql：段階 2 で足す表（D-082〜D-085・T-D-14）。正本 07_functional/entities.json（ER図）から scripts/ci/gen_ddl.py が生成。手で直さない（直すなら ER図 → build_functional → 再生成）

-- E-087 billing_events（15. 段階 2 で足す表）
create table if not exists billing_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  stripe_event_ref text,
  kind text,
  payload jsonb,
  received_at timestamptz,
  processed_at timestamptz,
  signature_ok text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists billing_events_tenant_idx on billing_events (tenant_id);
drop trigger if exists billing_events_updated_at on billing_events; create trigger billing_events_updated_at before update on billing_events for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('billing_events', 'billing_events') on conflict do nothing;

-- E-091 disclosure_versions（15. 段階 2 で足す表）
create table if not exists disclosure_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) default app.ops_tenant_id(),
  version int,
  generated_at timestamptz,
  content_hash text,
  pdf_ref text,
  dpa_ref text,
  released_by uuid references members(id),
  notice_id uuid references notices(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  unique (notice_id, version)
);
create index if not exists disclosure_versions_tenant_idx on disclosure_versions (tenant_id);
create index if not exists disclosure_versions_released_by_idx on disclosure_versions (released_by);
create index if not exists disclosure_versions_notice_id_idx on disclosure_versions (notice_id);
drop trigger if exists disclosure_versions_updated_at on disclosure_versions; create trigger disclosure_versions_updated_at before update on disclosure_versions for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('disclosure_versions', 'disclosure_versions') on conflict do nothing;

-- E-089 llm_capabilities（15. 段階 2 で足す表）
create table if not exists llm_capabilities (
  key text primary key,
  label text not null,
  provider_id uuid,
  capability_id text,
  supported text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- E-088 llm_routes（15. 段階 2 で足す表）
create table if not exists llm_routes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  default_kind_id text,
  offline_kind_id text,
  provider_id text,
  credential_id uuid references credentials(id),
  managed_allowed_by_ops_member_id uuid references members(id),
  managed_allowed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists llm_routes_tenant_idx on llm_routes (tenant_id);
create index if not exists llm_routes_credential_id_idx on llm_routes (credential_id);
create index if not exists llm_routes_managed_allowed_by_ops_member_id_idx on llm_routes (managed_allowed_by_ops_member_id);
drop trigger if exists llm_routes_updated_at on llm_routes; create trigger llm_routes_updated_at before update on llm_routes for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('llm_routes', 'llm_routes') on conflict do nothing;

-- E-086 payment_methods（15. 段階 2 で足す表）
create table if not exists payment_methods (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  kind_id text,
  stripe_customer_ref text,
  brand text,
  last4 text,
  expires_on date,
  registered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists payment_methods_tenant_idx on payment_methods (tenant_id);
drop trigger if exists payment_methods_updated_at on payment_methods; create trigger payment_methods_updated_at before update on payment_methods for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('payment_methods', 'payment_methods') on conflict do nothing;

-- E-090 push_devices（15. 段階 2 で足す表）
create table if not exists push_devices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  member_id uuid references members(id),
  platform_id text,
  token_ref text,
  app_version int,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists push_devices_tenant_idx on push_devices (tenant_id);
create index if not exists push_devices_member_id_idx on push_devices (member_id);
drop trigger if exists push_devices_updated_at on push_devices; create trigger push_devices_updated_at before update on push_devices for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('push_devices', 'push_devices') on conflict do nothing;

-- E-092 subprocessors（15. 段階 2 で足す表）
create table if not exists subprocessors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) default app.ops_tenant_id(),
  name text,
  purpose text,
  region text,
  data_kinds text[],
  effective_from text,
  announced_at timestamptz,
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists subprocessors_tenant_idx on subprocessors (tenant_id);
drop trigger if exists subprocessors_updated_at on subprocessors; create trigger subprocessors_updated_at before update on subprocessors for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('subprocessors', 'subprocessors') on conflict do nothing;

grant select, insert, update, delete on billing_events, disclosure_versions, llm_capabilities, llm_routes, payment_methods, push_devices, subprocessors to kaname_app;
insert into app.schema_migrations (name) values ('0019_s15.sql') on conflict do nothing;
