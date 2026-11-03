-- 0074 取引先の表（KN-41・D-125.43・D-125.121〜.124・D-128.53・D-128.54・D-128.100）
--   取引先（clients：見え方は 全員／担当グループだけ・既定は全員）・担当グループ（client_groups：いくつでも）・先方の人（client_contacts）・
--   届いた依頼（client_requests）・検収（acceptances：OK がそのチケットの完了の条件）。tickets.client_id に外部キーを付ける（KN-38 の申し送り）。
--   取引先の人（クライアントの場所）は app.role='client' の文脈で入り、自分の取引先の中だけ・会社が見せると決めたチケットだけ読める（D-125.122）。
--   ★柵の穴を塞ぐ：app.member_ok() は「運営でなく、その会社のメンバー」なら通していたので、取引先の人・PC の文脈でも会社の人の守りを通れた。
--     会社の人の守りは app.role='member' で、取引先の人として登録されていない人だけにする（ZT2）。

-- ---------------------------------------------------------------- 取引先
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  name text not null check (length(name) between 1 and 120),
  owner_member_id uuid references members(id),               -- 取引先の担当
  visibility text not null default 'all' check (visibility in ('all', 'groups')),   -- 全員・担当グループだけ（既定は全員・D-128.54）
  default_share jsonb not null default '{}'::jsonb,          -- 種別ごとの既定の見せ方（既定は社内だけ・D-128.100）
  routing text,                                              -- 分身が振り分けるときの決まり
  email_domain text,                                         -- 先方のメールのドメイン（招待はドメインが合う人だけ）
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists clients_tenant_idx on clients (tenant_id);
create unique index if not exists clients_name_uq on clients (tenant_id, name) where deleted_at is null;   -- ワークスペースに 1 社 1 つ（D-128.54）

create table if not exists client_groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  client_id uuid not null references clients(id),
  scope_id uuid not null references scopes(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  unique (client_id, scope_id)
);
create index if not exists client_groups_scope_idx on client_groups (tenant_id, scope_id);

create table if not exists client_contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  client_id uuid not null references clients(id),
  name text not null check (length(name) between 1 and 80),
  email text,
  role text not null default 'requester' check (role in ('requester', 'viewer')),   -- 依頼できる・見るだけ
  member_id uuid references members(id),                    -- クライアントの場所に入るとき
  cc_role text not null default 'none' check (cc_role in ('to', 'cc', 'none')),       -- 請求の宛先・CC・使わない
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists client_contacts_client_idx on client_contacts (tenant_id, client_id);
create unique index if not exists client_contacts_member_uq on client_contacts (tenant_id, member_id) where member_id is not null and deleted_at is null;   -- 1 人は 1 つの取引先の人

create table if not exists client_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  client_id uuid not null references clients(id),
  contact_id uuid references client_contacts(id),
  title text not null check (length(title) between 1 and 200),
  body text,
  due_on date,
  state text not null default 'new' check (state in ('new', 'asking', 'ticketed', 'declined')),   -- 新しい・聞いている・チケットに・断った
  ticket_id uuid references tickets(id),
  routed_scope_id uuid references scopes(id),               -- 担当グループが 2 つ以上のとき、分身の案を担当者が確かめた届け先
  questions jsonb not null default '[]'::jsonb,              -- 詳しく聞くこと（分身の案）
  decline_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  check (state <> 'declined' or coalesce(length(trim(decline_reason)), 0) > 0),
  check ((state = 'ticketed') = (ticket_id is not null))
);
create index if not exists client_requests_client_idx on client_requests (tenant_id, client_id, state);

create table if not exists acceptances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  ticket_id uuid not null references tickets(id),
  artifact_version_id uuid references artifact_versions(id),
  contact_id uuid not null references client_contacts(id),
  due_on date,
  message text,
  result text check (result in ('ok', 'fix')),               -- OK・直してほしい
  comment text,
  decided_at timestamptz,
  reminded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  check ((result is null) = (decided_at is null)),
  check (result is distinct from 'fix' or coalesce(length(trim(comment)), 0) > 0)   -- 直してほしいなら何を
);
create index if not exists acceptances_ticket_idx on acceptances (tenant_id, ticket_id);

-- チケットの取引先（KN-38 で列だけ作った）
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tickets_client_id_fkey') then
    alter table tickets add constraint tickets_client_id_fkey foreign key (client_id) references clients(id);
  end if;
end $$;
create index if not exists tickets_client_idx on tickets (tenant_id, client_id) where client_id is not null;

-- ---------------------------------------------------------------- 柵（会社の人／取引先の人）
create or replace function app.my_client() returns uuid language sql stable security definer set search_path = public, app as $$
  select c.client_id from client_contacts c
  where c.member_id = app.user_id() and c.tenant_id = app.tenant_id() and c.deleted_at is null
  limit 1
$$;
create or replace function app.my_contact() returns uuid language sql stable security definer set search_path = public, app as $$
  select c.id from client_contacts c
  where c.member_id = app.user_id() and c.tenant_id = app.tenant_id() and c.deleted_at is null
  limit 1
$$;
-- 会社の人：app.role='member' で、その会社のメンバーで、取引先の人ではない
create or replace function app.member_ok() returns boolean language sql stable security definer set search_path = public, app as $$
  select coalesce(current_setting('app.role', true), '') = 'member'
     and exists (select 1 from members m where m.id = nullif(current_setting('app.user_id', true), '')::uuid and m.tenant_id = app.tenant_id() and m.deleted_at is null)
     and app.my_client() is null
$$;
-- 取引先の人：app.role='client' で、その会社のメンバーで、先方の人として登録されている
create or replace function app.client_ok() returns boolean language sql stable security definer set search_path = public, app as $$
  select coalesce(current_setting('app.role', true), '') = 'client'
     and exists (select 1 from members m where m.id = nullif(current_setting('app.user_id', true), '')::uuid and m.tenant_id = app.tenant_id() and m.deleted_at is null)
     and app.my_client() is not null
$$;
-- 社内でその取引先が見えるか：全員に見える取引先か、取引先の担当か、担当グループが見える人
create or replace function app.client_visible(cid uuid) returns boolean language sql stable security definer set search_path = public, app as $$
  select exists (
    select 1 from clients c
    where c.id = cid and c.tenant_id = app.tenant_id()
      and (c.visibility = 'all' or c.owner_member_id = app.user_id() or has_permission(app.user_id(), 'clients', null, 'edit')
           or exists (select 1 from client_groups g where g.client_id = c.id and g.deleted_at is null and g.scope_id = any(visible_scopes(app.user_id()))))
  )
$$;
-- 担当グループが見える人か（clients の読む守りから使う。clients を id で引かない＝作った行がその場で見える）
create or replace function app.client_in_my_groups(cid uuid) returns boolean language sql stable security definer set search_path = public, app as $$
  select exists (select 1 from client_groups g where g.client_id = cid and g.tenant_id = app.tenant_id() and g.deleted_at is null and g.scope_id = any(visible_scopes(app.user_id())))
$$;
-- 取引先を直せるか：取引先の担当か、取引先の edit を持つ人（既定は管理者）
create or replace function app.client_editable(cid uuid) returns boolean language sql stable security definer set search_path = public, app as $$
  select exists (
    select 1 from clients c
    where c.id = cid and c.tenant_id = app.tenant_id()
      and (c.owner_member_id = app.user_id() or has_permission(app.user_id(), 'clients', null, 'edit'))
  )
$$;
grant execute on function app.client_in_my_groups(uuid), app.my_client(), app.my_contact(), app.member_ok(), app.client_ok(), app.client_visible(uuid), app.client_editable(uuid) to kaname_app;

-- ---------------------------------------------------------------- 同じ会社の行だけ
create or replace function app.client_same_tenant() returns trigger language plpgsql security definer set search_path = public, app as $$
declare j jsonb := to_jsonb(new);
begin
  if (j->>'client_id') is not null and not exists (select 1 from clients where id = (j->>'client_id')::uuid and tenant_id = new.tenant_id) then
    raise exception '取引先は同じ会社のもの' using errcode = '22023';
  end if;
  if (j->>'scope_id') is not null and not exists (select 1 from scopes where id = (j->>'scope_id')::uuid and tenant_id = new.tenant_id) then
    raise exception 'グループは同じ会社のもの' using errcode = '22023';
  end if;
  if (j->>'routed_scope_id') is not null and not exists (select 1 from scopes where id = (j->>'routed_scope_id')::uuid and tenant_id = new.tenant_id) then
    raise exception '届け先のグループは同じ会社のもの' using errcode = '22023';
  end if;
  if (j->>'ticket_id') is not null and not exists (select 1 from tickets where id = (j->>'ticket_id')::uuid and tenant_id = new.tenant_id) then
    raise exception 'チケットは同じ会社のもの' using errcode = '22023';
  end if;
  if (j->>'contact_id') is not null and not exists (
       select 1 from client_contacts k where k.id = (j->>'contact_id')::uuid and k.tenant_id = new.tenant_id
         and (tg_table_name <> 'client_requests' or k.client_id = (j->>'client_id')::uuid)) then
    raise exception '先方の人は同じ会社・同じ取引先の人' using errcode = '22023';
  end if;
  if tg_table_name = 'acceptances' and not exists (
       select 1 from tickets t join client_contacts k on k.id = (j->>'contact_id')::uuid
       where t.id = (j->>'ticket_id')::uuid and t.client_id = k.client_id) then
    raise exception '検収を頼めるのは、そのチケットの取引先の人だけ' using errcode = '22023';
  end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['clients','client_groups','client_contacts','client_requests','acceptances'] loop
    execute format('drop trigger if exists %I_same_tenant on %I', t, t);
    execute format('create trigger %I_same_tenant before insert or update on %I for each row execute function app.client_same_tenant()', t, t);
    execute format('drop trigger if exists %I_updated_at on %I', t, t);
    execute format('create trigger %I_updated_at before update on %I for each row execute function app.set_updated_at()', t, t);
    execute format('insert into target_kinds (key, label) values (%L, %L) on conflict do nothing', t, t);
  end loop;
end $$;

insert into app.schema_migrations (name) values ('0074_clients.sql') on conflict do nothing;
