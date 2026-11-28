-- 0002 access control（T-F-02）。D-026・D-073・D-058。
-- 権限＝誰に×何に×どの層で×できること を DB 層で 1 回だけ実装する。RLS は current_setting('app.*') ベース（auth.uid() 不使用）。
-- 主キーは UUID v7 を API 層で生成する（pg16 の既定は gen_random_uuid()。v7 の生成は T-F-03 の関門で統一）。

-- マスタ（enum の代わり）
create table if not exists member_kinds (key text primary key, label text not null);
create table if not exists target_kinds (key text primary key, label text not null);
create table if not exists abilities   (key text primary key, label text not null);
insert into member_kinds (key, label) values ('human', '人'), ('ai_employee', 'AI社員'), ('clone', '自分のAI') on conflict do nothing;
insert into target_kinds (key, label) values
  ('memory', '記憶'), ('rule', 'ルール'), ('goal', '目標'), ('duty', '担当業務'), ('ledger', '台帳'), ('ai_employee', 'AI社員'), ('template', 'テンプレート'),
  ('procedure', '覚えた操作'), ('member', 'メンバー'), ('plan', 'プラン'), ('tenants', '会社'), ('scopes', '層の実体'), ('layers', '層'), ('members', 'メンバー表'), ('permissions', '権限'),
  ('support_access_grants', '運営への許可')
on conflict do nothing;
insert into abilities (key, label) values ('view', '見る'), ('edit', '作る・直す'), ('create', '作る'), ('delete', '消す'), ('allocate', '配る'), ('approve', '承認する'), ('invite', '招く') on conflict do nothing;

-- テナント
create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,                       -- 自分自身（全表 tenant_id NOT NULL の原則）
  name text not null,
  plan_id uuid, status_id uuid,                  -- FK は plans / statuses（§12・マスタ）を作る T-D-* で付ける
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  constraint tenants_self check (tenant_id = id)
);

-- 会社が決めた層（運営／会社／個人は固定。その間は 0〜n）
create table if not exists layers (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id),
  key text not null, label text not null, order_no int not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, key)
);

-- 層の実体（自己参照の木）
create table if not exists scopes (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id),
  parent_id uuid references scopes(id), layer_id uuid references layers(id), name text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid, updated_by uuid, deleted_at timestamptz
);
create index if not exists scopes_parent_idx on scopes (tenant_id, parent_id);

-- メンバー（人と AI が同じ席）
create table if not exists members (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id), scope_id uuid not null references scopes(id),
  kind_id text not null references member_kinds(key), display_name text not null, role_id text, manager_member_id uuid references members(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid, updated_by uuid, deleted_at timestamptz
);
create index if not exists members_scope_idx on members (tenant_id, scope_id);

-- 権限（誰に×何に×どの層で×できること）
create table if not exists permissions (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id),
  grantee_member_id uuid not null references members(id), target_kind_id text not null references target_kinds(key),
  scope_id uuid references scopes(id),           -- NULL＝会社全体
  ability_id text not null references abilities(key), granted_by uuid, revoked_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid, updated_by uuid, deleted_at timestamptz
);
create index if not exists permissions_grantee_idx on permissions (tenant_id, grantee_member_id) where revoked_at is null;

-- 運営への許可（既定で運営は読めない。範囲・期限つきの行があるときだけ）
create table if not exists support_access_grants (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id),
  granted_by_member_id uuid references members(id), scope text not null, expires_at timestamptz not null, revoked_at timestamptz, ops_member_id uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid, updated_by uuid, deleted_at timestamptz
);

-- 文脈（API 層が要求ごとに SET LOCAL する）
create or replace function app.role() returns text language sql stable as $$ select nullif(current_setting('app.role', true), '') $$;

-- 会社の人の柵：app.user_id が app.tenant_id のメンバーで、運営の文脈でないこと。member の policy は全部この柵の中（SET LOCAL を別テナントに向けても 0 行）
create or replace function app.member_ok() returns boolean language sql stable security definer set search_path = public, app as $$
  select coalesce(current_setting('app.role', true), '') <> 'ops'
     and exists (select 1 from members m where m.id = nullif(current_setting('app.user_id', true), '')::uuid and m.tenant_id = app.tenant_id() and m.deleted_at is null)
$$;

-- 運営の柵：運営の文脈で、その会社が範囲・期限つきで許可した行があるときだけ（policy から直接 support_access_grants を引くと再帰するので関数に寄せる）
create or replace function app.ops_grant_ok(t uuid) returns boolean language sql stable security definer set search_path = public, app as $$
  select coalesce(current_setting('app.role', true), '') = 'ops'
     and exists (select 1 from support_access_grants g where g.tenant_id = t and g.expires_at > now() and g.revoked_at is null and g.deleted_at is null)
$$;

-- 層の木：scope とその下（descendants-or-self）
create or replace function app.scope_tree(root uuid) returns setof uuid language sql stable as $$
  with recursive t as (select id from scopes where id = root union all select s.id from scopes s join t on s.parent_id = t.id) select id from t
$$;

-- 見える層：自分の席の層とその下 ＋ view/edit の権限が付いた層とその下
create or replace function visible_scopes(uid uuid) returns uuid[] language sql stable security definer set search_path = public, app as $$
  select coalesce(array_agg(distinct x), '{}'::uuid[]) from (
    select app.scope_tree(m.scope_id) as x from members m where m.id = uid and m.tenant_id = app.tenant_id()
    union all
    select app.scope_tree(coalesce(p.scope_id, (select scope_id from members where id = uid))) from permissions p
      where p.grantee_member_id = uid and p.tenant_id = app.tenant_id() and p.revoked_at is null and p.ability_id in ('view', 'edit')
  ) q
$$;

-- 権限：誰に（uid）× 何に（target_kind）× どの層で（scope。NULL＝会社全体）× できること（ability）。edit は view を含む
create or replace function has_permission(uid uuid, target_kind text, scope uuid, ability text) returns boolean language sql stable security definer set search_path = public, app as $$
  select exists (
    select 1 from permissions p
    where p.grantee_member_id = uid and p.tenant_id = app.tenant_id() and p.revoked_at is null and p.deleted_at is null
      and p.target_kind_id = target_kind
      and (p.ability_id = ability or (ability = 'view' and p.ability_id = 'edit'))
      and (p.scope_id is null or scope is null or scope in (select app.scope_tree(p.scope_id)))
  )
$$;

-- updated_at
do $$ declare t text; begin
  foreach t in array array['tenants','layers','scopes','members','permissions','support_access_grants'] loop
    execute format('drop trigger if exists %I_updated_at on %I', t, t);
    execute format('create trigger %I_updated_at before update on %I for each row execute function app.set_updated_at()', t, t);
  end loop; end $$;

-- アプリの接続ロール（RLS が効く。所有者・superuser では効かない）
do $$ begin if not exists (select 1 from pg_roles where rolname = 'kaname_app') then create role kaname_app login password 'kaname_app' nobypassrls; end if; end $$;
grant usage on schema public, app to kaname_app;
grant select, insert, update, delete on all tables in schema public to kaname_app;
grant select on app.schema_migrations to kaname_app;
alter default privileges in schema public grant select, insert, update, delete on tables to kaname_app;

insert into app.schema_migrations (name) values ('0002_access_control.sql') on conflict do nothing;
