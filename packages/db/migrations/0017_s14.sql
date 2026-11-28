-- 0017_s14.sql：データ層 14. スキル（4 表・migration・RLS・索引・seed）（T-D-13）。正本 07_functional/entities.json（ER図）から scripts/ci/gen_ddl.py が生成。手で直さない（直すなら ER図 → build_functional → 再生成）

-- E-082 skills（14. スキル）
create table if not exists skills (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) default app.ops_tenant_id(),
  kind_id text,
  key text not null,
  name text,
  purpose text,
  current_version int,
  plan_ids uuid[],
  visibility_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  unique (tenant_id, key)
);
create index if not exists skills_tenant_idx on skills (tenant_id);
drop trigger if exists skills_updated_at on skills; create trigger skills_updated_at before update on skills for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('skills', 'skills') on conflict do nothing;

-- E-085 skill_attachments（14. スキル）
create table if not exists skill_attachments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  skill_id uuid references skills(id),
  version_in_use int,
  target_type text,
  target_id uuid,
  enabled boolean,
  disabled_by uuid references members(id),
  attached_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists skill_attachments_tenant_idx on skill_attachments (tenant_id);
create index if not exists skill_attachments_skill_id_idx on skill_attachments (skill_id);
create index if not exists skill_attachments_disabled_by_idx on skill_attachments (disabled_by);
drop trigger if exists skill_attachments_updated_at on skill_attachments; create trigger skill_attachments_updated_at before update on skill_attachments for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('skill_attachments', 'skill_attachments') on conflict do nothing;

-- E-083 skill_versions（14. スキル）
create table if not exists skill_versions (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid references skills(id),
  version int not null,
  package_ref text,
  changelog text,
  tested_at timestamptz,
  test_result jsonb,
  released_at timestamptz,
  released_by uuid references members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (skill_id, version)
);
create index if not exists skill_versions_skill_id_idx on skill_versions (skill_id);
create index if not exists skill_versions_released_by_idx on skill_versions (released_by);
drop trigger if exists skill_versions_updated_at on skill_versions; create trigger skill_versions_updated_at before update on skill_versions for each row execute function app.set_updated_at();

-- E-084 skill_test_runs（14. スキル）
create table if not exists skill_test_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  skill_version_id uuid references skill_versions(id),
  ops_member_id uuid references members(id),
  mode text,
  started_at timestamptz,
  finished_at timestamptz,
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists skill_test_runs_tenant_idx on skill_test_runs (tenant_id);
create index if not exists skill_test_runs_skill_version_id_idx on skill_test_runs (skill_version_id);
create index if not exists skill_test_runs_ops_member_id_idx on skill_test_runs (ops_member_id);
drop trigger if exists skill_test_runs_updated_at on skill_test_runs; create trigger skill_test_runs_updated_at before update on skill_test_runs for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('skill_test_runs', 'skill_test_runs') on conflict do nothing;

grant select, insert, update, delete on skills, skill_attachments, skill_versions, skill_test_runs to kaname_app;
insert into app.schema_migrations (name) values ('0017_s14.sql') on conflict do nothing;
