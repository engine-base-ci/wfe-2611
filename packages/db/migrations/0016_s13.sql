-- 0016_s13.sql：データ層 13. 取り込み・正規連携・招待・持ち出し・添付（5 表・migrat（T-D-12）。正本 07_functional/entities.json（ER図）から scripts/ci/gen_ddl.py が生成。手で直さない（直すなら ER図 → build_functional → 再生成）

-- E-081 attachments（13. 取り込み・正規連携・招待・持ち出し・添付）
create table if not exists attachments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  scope_id uuid not null references scopes(id),
  owner_type text,
  owner_id uuid,
  storage_ref text,
  mime text,
  size bigint,
  scanned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists attachments_tenant_idx on attachments (tenant_id);
create index if not exists attachments_scope_idx on attachments (tenant_id, scope_id);
drop trigger if exists attachments_updated_at on attachments; create trigger attachments_updated_at before update on attachments for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('attachments', 'attachments') on conflict do nothing;

-- E-077 imports（13. 取り込み・正規連携・招待・持ち出し・添付）
create table if not exists imports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  scope_id uuid not null references scopes(id),
  file_ref text,
  detected_kind_id text,
  proposal jsonb,
  status_id text,
  applied_at timestamptz,
  applied_by uuid references members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists imports_tenant_idx on imports (tenant_id);
create index if not exists imports_scope_idx on imports (tenant_id, scope_id);
create index if not exists imports_applied_by_idx on imports (applied_by);
drop trigger if exists imports_updated_at on imports; create trigger imports_updated_at before update on imports for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('imports', 'imports') on conflict do nothing;

-- E-078 integrations（13. 取り込み・正規連携・招待・持ち出し・添付）
create table if not exists integrations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  scope_id uuid not null references scopes(id),
  service_id uuid references service_registry(id),
  kind_id text,
  credential_id uuid references credentials(id),
  scopes text[],
  status_id text,
  connected_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists integrations_tenant_idx on integrations (tenant_id);
create index if not exists integrations_scope_idx on integrations (tenant_id, scope_id);
create index if not exists integrations_service_id_idx on integrations (service_id);
create index if not exists integrations_credential_id_idx on integrations (credential_id);
drop trigger if exists integrations_updated_at on integrations; create trigger integrations_updated_at before update on integrations for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('integrations', 'integrations') on conflict do nothing;

grant select, insert, update, delete on attachments, imports, integrations to kaname_app;
insert into app.schema_migrations (name) values ('0016_s13.sql') on conflict do nothing;
