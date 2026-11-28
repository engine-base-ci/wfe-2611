-- 0012_s06.sql：データ層 6. 会話・成果物・証跡（4 表・migration・RLS・索引・s（T-D-06）。正本 07_functional/entities.json（ER図）から scripts/ci/gen_ddl.py が生成。手で直さない（直すなら ER図 → build_functional → 再生成）

-- E-040 artifacts（6. 会話・成果物・証跡）
create table if not exists artifacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  scope_id uuid not null references scopes(id),
  task_id uuid references tasks(id),
  format_id text,
  storage_ref text,
  template_id uuid,
  approved_by uuid references members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists artifacts_tenant_idx on artifacts (tenant_id);
create index if not exists artifacts_scope_idx on artifacts (tenant_id, scope_id);
create index if not exists artifacts_task_id_idx on artifacts (task_id);
create index if not exists artifacts_approved_by_idx on artifacts (approved_by);
drop trigger if exists artifacts_updated_at on artifacts; create trigger artifacts_updated_at before update on artifacts for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('artifacts', 'artifacts') on conflict do nothing;

-- E-038 conversations（6. 会話・成果物・証跡）
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  scope_id uuid not null references scopes(id),
  title text,
  participant_member_ids uuid[],
  area text,
  subject_type text,
  parent_conversation_id uuid references conversations(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists conversations_tenant_idx on conversations (tenant_id);
create index if not exists conversations_scope_idx on conversations (tenant_id, scope_id);
drop trigger if exists conversations_updated_at on conversations; create trigger conversations_updated_at before update on conversations for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('conversations', 'conversations') on conflict do nothing;

-- E-039 messages（6. 会話・成果物・証跡）
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  conversation_id uuid references conversations(id),
  sender_member_id uuid references members(id),
  body text,
  attachments jsonb,
  action_run_id uuid references action_runs(id),
  kind text,
  options jsonb,
  confidence numeric,
  citations jsonb,
  parent_message_id uuid references messages(id),
  undo_action_run_id uuid references action_runs(id),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists messages_tenant_idx on messages (tenant_id);
create index if not exists messages_conversation_id_idx on messages (conversation_id);
create index if not exists messages_sender_member_id_idx on messages (sender_member_id);
create index if not exists messages_action_run_id_idx on messages (action_run_id);
create index if not exists messages_undo_action_run_id_idx on messages (undo_action_run_id);
drop trigger if exists messages_updated_at on messages; create trigger messages_updated_at before update on messages for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('messages', 'messages') on conflict do nothing;

grant select, insert, update, delete on artifacts, conversations, messages to kaname_app;
insert into app.schema_migrations (name) values ('0012_s06.sql') on conflict do nothing;
