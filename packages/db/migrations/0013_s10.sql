-- 0013_s10.sql：データ層 10. 口座状態の出来事・失効・サポートアクセス（6 表・migrat（T-D-09）。正本 07_functional/entities.json（ER図）から scripts/ci/gen_ddl.py が生成。手で直さない（直すなら ER図 → build_functional → 再生成）

-- E-048 account_events（10. 口座状態の出来事・失効・サポートアクセス）
create table if not exists account_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  kind_id text,
  subject_type text,
  subject_id uuid,
  requested_by uuid references members(id),
  status_id text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists account_events_tenant_idx on account_events (tenant_id);
create index if not exists account_events_requested_by_idx on account_events (requested_by);
drop trigger if exists account_events_updated_at on account_events; create trigger account_events_updated_at before update on account_events for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('account_events', 'account_events') on conflict do nothing;

-- E-053 erasure_certificates（10. 口座状態の出来事・失効・サポートアクセス）
create table if not exists erasure_certificates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  issued_at timestamptz,
  content_hash text,
  sent_to text,
  storage_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists erasure_certificates_tenant_idx on erasure_certificates (tenant_id);
drop trigger if exists erasure_certificates_updated_at on erasure_certificates; create trigger erasure_certificates_updated_at before update on erasure_certificates for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('erasure_certificates', 'erasure_certificates') on conflict do nothing;

-- E-052 retention_holds（10. 口座状態の出来事・失効・サポートアクセス）
create table if not exists retention_holds (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  record_type text,
  record_ref text,
  retain_until date,
  legal_basis text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists retention_holds_tenant_idx on retention_holds (tenant_id);
drop trigger if exists retention_holds_updated_at on retention_holds; create trigger retention_holds_updated_at before update on retention_holds for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('retention_holds', 'retention_holds') on conflict do nothing;

-- E-049 account_event_items（10. 口座状態の出来事・失効・サポートアクセス）
create table if not exists account_event_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  event_id uuid references account_events(id),
  object_kind text,
  disposition_id text,
  target_ref text,
  decided_by uuid references members(id),
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists account_event_items_tenant_idx on account_event_items (tenant_id);
create index if not exists account_event_items_event_id_idx on account_event_items (event_id);
create index if not exists account_event_items_decided_by_idx on account_event_items (decided_by);
drop trigger if exists account_event_items_updated_at on account_event_items; create trigger account_event_items_updated_at before update on account_event_items for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('account_event_items', 'account_event_items') on conflict do nothing;

grant select, insert, update, delete on account_events, erasure_certificates, retention_holds, account_event_items to kaname_app;
insert into app.schema_migrations (name) values ('0013_s10.sql') on conflict do nothing;
