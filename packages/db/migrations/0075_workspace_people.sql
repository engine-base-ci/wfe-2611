-- 0075 ワークスペースと人の表（KN-42・D-125.115・D-125.150・D-125.162・D-128.46・D-128.92・D-128.93・D-128.95〜.97）
--   ワークスペースへの所属（tenant_memberships：管理者・マネージャー・メンバー・閲覧のみ・依頼する側）・グループへの所属（scope_memberships：主の所属と兼務・グループごとの役割）・
--   規約の版（terms_versions：運営の表）と同意（terms_consents）・知らせの設定（notification_settings）・PC の接続コード（bridge_pairing_codes：コードそのものは持たない）。
--   兼務を見える範囲（visible_scopes）に入れる（KN-38 の申し送り）。行の守りは policies/0075_workspace_people.sql。

create table if not exists tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  member_id uuid not null references members(id),
  auth_user_id text,                                         -- ログインの部品の利用者（1 人のアカウントが複数のワークスペースに入る・D-125.150）
  role text not null default 'member' check (role in ('admin', 'manager', 'member', 'viewer', 'requester')),   -- 管理者・マネージャー・メンバー・閲覧のみ・依頼する側
  status text not null default 'active' check (status in ('invited', 'active', 'suspended', 'left')),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  unique (tenant_id, member_id)
);
create index if not exists tenant_memberships_auth_idx on tenant_memberships (auth_user_id);

create table if not exists scope_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  member_id uuid not null references members(id),
  scope_id uuid not null references scopes(id),
  is_primary boolean not null default false,                -- 主の所属か兼ねるか
  role text not null default 'member' check (role in ('manager', 'member', 'viewer')),   -- そのグループでの役割
  since date not null default current_date,
  changed_by uuid references members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  unique (member_id, scope_id)
);
create index if not exists scope_memberships_scope_idx on scope_memberships (tenant_id, scope_id);
create unique index if not exists scope_memberships_primary_uq on scope_memberships (member_id) where is_primary and deleted_at is null;   -- 主の所属は 1 つ

-- 規約の版は運営が出す（tenant_id＝運営）。ログイン済みなら誰でも今の版を読む（同意し直しの画面に出す）
create table if not exists terms_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  kind text not null check (kind in ('terms', 'privacy', 'tokushoho')),   -- 利用規約・プライバシーポリシー・特商法の表示
  version text not null,
  url text not null,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  unique (tenant_id, kind, version)   -- 出すのは運営のテナントだけ
);

-- 同意の記録は追記だけ。どの版に同意したか（規約を変えたら次のログインで同意し直す・D-125.162）
create table if not exists terms_consents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),            -- 同意したときのワークスペース
  member_id uuid not null references members(id),
  auth_user_id text,
  terms_version_id uuid not null references terms_versions(id),
  agreed_at timestamptz not null default now(),
  ip inet,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists terms_consents_member_idx on terms_consents (tenant_id, member_id);
revoke update, delete on terms_consents from kaname_app;

create table if not exists notification_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  member_id uuid not null references members(id),
  email_digest boolean not null default true,                -- 読んでいないものを 30 分ごとにまとめて送る
  quiet_hours jsonb not null default '{}'::jsonb,            -- 平日 20:00〜8:00・土日 など
  paused_until timestamptz,
  urgent_override jsonb not null default '[]'::jsonb,        -- 止めていても知らせる出来事
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  unique (tenant_id, member_id)
);

-- PC の接続コード。コードそのものは持たない（ハッシュだけ）。10 分・1 回だけ。使うのは関門の関数（app.bridge_*）
create table if not exists bridge_pairing_codes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  member_id uuid not null references members(id),
  code_hash text not null,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  used_at timestamptz,
  used_session_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  check (expires_at <= created_at + interval '10 minutes'),
  check (length(code_hash) >= 32)                            -- 平文のコードを入れさせない
);
create index if not exists bridge_pairing_codes_member_idx on bridge_pairing_codes (tenant_id, member_id);
revoke update, delete on bridge_pairing_codes from kaname_app;

-- ---------------------------------------------------------------- 見える範囲に兼務を入れる（D-125.115・KN-38 の申し送り）
create or replace function visible_scopes(uid uuid) returns uuid[] language sql stable security definer set search_path = public, app as $$
  select coalesce(array_agg(distinct x), '{}'::uuid[]) from (
    select app.scope_tree(m.scope_id) as x from members m where m.id = uid and m.tenant_id = app.tenant_id()
    union all
    select app.scope_tree(sm.scope_id) from scope_memberships sm
      where sm.member_id = uid and sm.tenant_id = app.tenant_id() and sm.deleted_at is null
    union all
    select app.scope_tree(coalesce(p.scope_id, (select scope_id from members where id = uid))) from permissions p
      where p.grantee_member_id = uid and p.tenant_id = app.tenant_id() and p.revoked_at is null and p.ability_id in ('view', 'edit')
  ) q
$$;

-- ---------------------------------------------------------------- 同じ会社の行だけ
create or replace function app.people_same_tenant() returns trigger language plpgsql security definer set search_path = public, app as $$
declare j jsonb := to_jsonb(new);
begin
  if (j->>'member_id') is not null and not exists (select 1 from members where id = (j->>'member_id')::uuid and tenant_id = new.tenant_id) then
    raise exception 'その会社のメンバーの行だけ' using errcode = '22023';
  end if;
  if (j->>'scope_id') is not null and not exists (select 1 from scopes where id = (j->>'scope_id')::uuid and tenant_id = new.tenant_id) then
    raise exception 'グループは同じ会社のもの' using errcode = '22023';
  end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['tenant_memberships','scope_memberships','terms_versions','terms_consents','notification_settings','bridge_pairing_codes'] loop
    if t <> 'terms_versions' then
      execute format('drop trigger if exists %I_same_tenant on %I', t, t);
      execute format('create trigger %I_same_tenant before insert or update on %I for each row execute function app.people_same_tenant()', t, t);
    end if;
    execute format('drop trigger if exists %I_updated_at on %I', t, t);
    execute format('create trigger %I_updated_at before update on %I for each row execute function app.set_updated_at()', t, t);
    execute format('insert into target_kinds (key, label) values (%L, %L) on conflict do nothing', t, t);
  end loop;
end $$;

insert into app.schema_migrations (name) values ('0075_workspace_people.sql') on conflict do nothing;
