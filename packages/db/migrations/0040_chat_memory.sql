-- 0040_chat_memory.sql。正本 07_functional/entities.json（ER図）から scripts/ci/gen_ddl.py が生成。手で直さない（直すなら ER図 → build_functional → 再生成）

-- E-048 agent_usage_snapshots（6. 会話・成果物・証跡）
create table if not exists agent_usage_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  member_id uuid references members(id),
  window_id text,
  utilization numeric(5,2),
  resets_at timestamptz,
  observed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists agent_usage_snapshots_tenant_idx on agent_usage_snapshots (tenant_id);
create index if not exists agent_usage_snapshots_member_id_idx on agent_usage_snapshots (member_id);
drop trigger if exists agent_usage_snapshots_updated_at on agent_usage_snapshots; create trigger agent_usage_snapshots_updated_at before update on agent_usage_snapshots for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('agent_usage_snapshots', 'agent_usage_snapshots') on conflict do nothing;

-- E-029 memory_digests（4. 会社モデル ── 担当業務・記憶）
create table if not exists memory_digests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  member_id uuid references members(id),
  from_on date,
  to_on date,
  conversation_count int,
  state_id text,
  result jsonb,
  bridge_job_id uuid references bridge_jobs(id),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists memory_digests_tenant_idx on memory_digests (tenant_id);
create index if not exists memory_digests_member_id_idx on memory_digests (member_id);
create index if not exists memory_digests_bridge_job_id_idx on memory_digests (bridge_job_id);
drop trigger if exists memory_digests_updated_at on memory_digests; create trigger memory_digests_updated_at before update on memory_digests for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('memory_digests', 'memory_digests') on conflict do nothing;

-- E-030 memory_proposals（4. 会社モデル ── 担当業務・記憶）
create table if not exists memory_proposals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  scope_id uuid not null references scopes(id),
  memory_id uuid references memories(id),
  target_scope_id uuid references scopes(id),
  proposer_member_id uuid references members(id),
  reviewer_member_id uuid references members(id),
  state_id text,
  conflict_group_id uuid,
  evidence jsonb,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists memory_proposals_tenant_idx on memory_proposals (tenant_id);
create index if not exists memory_proposals_scope_idx on memory_proposals (tenant_id, scope_id);
create index if not exists memory_proposals_memory_id_idx on memory_proposals (memory_id);
create index if not exists memory_proposals_target_scope_id_idx on memory_proposals (target_scope_id);
create index if not exists memory_proposals_proposer_member_id_idx on memory_proposals (proposer_member_id);
create index if not exists memory_proposals_reviewer_member_id_idx on memory_proposals (reviewer_member_id);
drop trigger if exists memory_proposals_updated_at on memory_proposals; create trigger memory_proposals_updated_at before update on memory_proposals for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('memory_proposals', 'memory_proposals') on conflict do nothing;

-- E-047 permission_rules（6. 会話・成果物・証跡）
create table if not exists permission_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  scope_id uuid not null references scopes(id),
  member_id uuid references members(id),
  tool text,
  target_pattern text,
  decision_id text,
  bridge_job_event_id uuid references bridge_job_events(id),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists permission_rules_tenant_idx on permission_rules (tenant_id);
create index if not exists permission_rules_scope_idx on permission_rules (tenant_id, scope_id);
create index if not exists permission_rules_member_id_idx on permission_rules (member_id);
create index if not exists permission_rules_bridge_job_event_id_idx on permission_rules (bridge_job_event_id);
drop trigger if exists permission_rules_updated_at on permission_rules; create trigger permission_rules_updated_at before update on permission_rules for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('permission_rules', 'permission_rules') on conflict do nothing;

-- 先に作った表から今回の表への FK
do $$ begin if not exists (select 1 from pg_constraint where conname = 'memories_digest_id_fkey') and exists (select 1 from information_schema.columns where table_name = 'memories' and column_name = 'digest_id' and data_type = 'uuid') then alter table memories add constraint memories_digest_id_fkey foreign key (digest_id) references memory_digests(id); end if; end $$;

grant select, insert, update, delete on agent_usage_snapshots, memory_digests, memory_proposals, permission_rules to kaname_app;
insert into app.schema_migrations (name) values ('0040_chat_memory.sql') on conflict do nothing;
