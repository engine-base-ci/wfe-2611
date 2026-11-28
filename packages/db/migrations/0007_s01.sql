-- 0007_s01.sql：データ層 1. テナント・組織・メンバー（6 表・migration・RLS・索（T-D-01）。正本 07_functional/entities.json（ER図）から scripts/ci/gen_ddl.py が生成。手で直さない（直すなら ER図 → build_functional → 再生成）

-- E-006 ai_employees（1. テナント・組織・メンバー）
create table if not exists ai_employees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  scope_id uuid not null references scopes(id),
  member_id uuid references members(id),
  provisioning_id uuid,
  template_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists ai_employees_tenant_idx on ai_employees (tenant_id);
create index if not exists ai_employees_scope_idx on ai_employees (tenant_id, scope_id);
create index if not exists ai_employees_member_id_idx on ai_employees (member_id);
drop trigger if exists ai_employees_updated_at on ai_employees; create trigger ai_employees_updated_at before update on ai_employees for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('ai_employees', 'ai_employees') on conflict do nothing;

-- E-005 clones（1. テナント・組織・メンバー）
create table if not exists clones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  owner_member_id uuid references members(id),
  persona text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists clones_tenant_idx on clones (tenant_id);
create index if not exists clones_owner_member_id_idx on clones (owner_member_id);
drop trigger if exists clones_updated_at on clones; create trigger clones_updated_at before update on clones for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('clones', 'clones') on conflict do nothing;

grant select, insert, update, delete on ai_employees, clones to kaname_app;
insert into app.schema_migrations (name) values ('0007_s01.sql') on conflict do nothing;
