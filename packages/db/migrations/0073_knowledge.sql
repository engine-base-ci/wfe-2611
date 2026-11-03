-- 0073 ナレッジの表（KN-40・D-125.108・D-128.50・D-128.51・D-128.52）
--   ページ（knowledge_pages：置き場・親ページの木・持ち主・下書き／公開／しまった・確かめの期限・話題）・版（knowledge_page_versions：下書き・直す案・公開）・
--   つながり（knowledge_links：ページ・チケット・決まり・取引先へ）。行の守りは policies/0073_knowledge.sql（gen_rls.py ← 05_flow/rls_policies.py）。
--   置き場は ワークスペース全体（根のグループ）・層・グループ・自分（is_personal：持ち主だけ）。下書きは持ち主とその置き場で書ける人だけ（下書きは知らせない・D-128.51）。

create table if not exists knowledge_pages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  scope_id uuid not null references scopes(id),             -- 置き場（自分の置き場は持ち主の主の所属を入れ、is_personal で絞る）
  is_personal boolean not null default false,               -- 自分の置き場（持ち主だけが読む）
  parent_page_id uuid references knowledge_pages(id),       -- 入れ子の木
  title text not null check (length(title) between 1 and 200),
  owner_member_id uuid not null references members(id),
  state text not null default 'draft' check (state in ('draft', 'published', 'archived')),   -- 下書き・公開・しまった
  form text not null default 'blank' check (form in ('procedure', 'rule', 'summary', 'blank')),  -- 手順・決まり・まとめ・白紙
  verify_interval_days int check (verify_interval_days is null or verify_interval_days in (30, 90, 180)),   -- 30 日・90 日・半年・期限なし（null）
  verified_at timestamptz,
  verify_due_on date,
  topics text[] not null default '{}',
  current_version int not null default 0 check (current_version >= 0),
  archived_at timestamptz,
  moved_to_page_id uuid references knowledge_pages(id),     -- しまったときの移し先（あれば案内する）
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  check (parent_page_id is null or parent_page_id <> id),
  check ((state = 'archived') = (archived_at is not null))
);
create index if not exists knowledge_pages_scope_idx on knowledge_pages (tenant_id, scope_id);
create index if not exists knowledge_pages_parent_idx on knowledge_pages (parent_page_id);
create index if not exists knowledge_pages_due_idx on knowledge_pages (tenant_id, verify_due_on) where state = 'published';

create table if not exists knowledge_page_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  page_id uuid not null references knowledge_pages(id),
  version int not null check (version >= 1),
  kind text not null default 'published' check (kind in ('draft', 'proposal', 'published')),   -- 下書き・直す案・公開
  body jsonb not null default '{}'::jsonb,
  note text,                                                -- 公開のたびにひとこと
  source_ticket_id uuid references tickets(id),             -- 直す案の出どころ（チケットの完了）
  decision text check (decision in ('accepted', 'edited', 'rejected')),   -- 入れた・直して入れた・入れない
  reject_reason text,
  published_by uuid references members(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  check (decision is distinct from 'rejected' or coalesce(length(trim(reject_reason)), 0) > 0),   -- 入れないなら理由
  check ((kind = 'published') = (published_at is not null)),
  unique (page_id, kind, version)
);
create index if not exists knowledge_page_versions_page_idx on knowledge_page_versions (tenant_id, page_id);
revoke delete on knowledge_page_versions from kaname_app;   -- 版は消さない

create table if not exists knowledge_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  from_page_id uuid not null references knowledge_pages(id),
  to_type text not null check (to_type in ('page', 'ticket', 'rule', 'client')),
  to_id uuid not null,
  anchor text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  unique (from_page_id, to_type, to_id)
);
create index if not exists knowledge_links_from_idx on knowledge_links (tenant_id, from_page_id);
create index if not exists knowledge_links_to_idx on knowledge_links (tenant_id, to_type, to_id);   -- 被リンク

-- ---------------------------------------------------------------- 読める・書けるの関数
--   読める：その置き場が見えて（自分の置き場は持ち主だけ）、下書きなら持ち主か書ける人
--   書ける：持ち主か、その置き場で knowledge_pages の edit を持つ人（自分の置き場は持ち主だけ）
create or replace function app.kpage_visible(pid uuid) returns boolean language sql stable security definer set search_path = public, app as $$
  select exists (
    select 1 from knowledge_pages p
    where p.id = pid and p.tenant_id = app.tenant_id()
      and (p.owner_member_id = app.user_id()
           or (not p.is_personal and p.scope_id = any(visible_scopes(app.user_id()))
               and (p.state <> 'draft' or has_permission(app.user_id(), 'knowledge_pages', p.scope_id, 'edit'))))
  )
$$;
create or replace function app.kpage_writable(pid uuid) returns boolean language sql stable security definer set search_path = public, app as $$
  select exists (
    select 1 from knowledge_pages p
    where p.id = pid and p.tenant_id = app.tenant_id()
      and (p.owner_member_id = app.user_id() or (not p.is_personal and has_permission(app.user_id(), 'knowledge_pages', p.scope_id, 'edit')))
  )
$$;
grant execute on function app.kpage_visible(uuid), app.kpage_writable(uuid) to kaname_app;

-- ---------------------------------------------------------------- 同じ会社の行だけ・親と移し先も同じ会社
create or replace function app.knowledge_same_tenant() returns trigger language plpgsql security definer set search_path = public, app as $$
declare j jsonb := to_jsonb(new);
begin
  if tg_table_name = 'knowledge_pages' then
    if not exists (select 1 from scopes where id = new.scope_id and tenant_id = new.tenant_id) then
      raise exception '置き場は同じ会社のグループ' using errcode = '22023';
    end if;
    if (j->>'parent_page_id') is not null and not exists (select 1 from knowledge_pages where id = (j->>'parent_page_id')::uuid and tenant_id = new.tenant_id) then
      raise exception '親ページは同じ会社のページ' using errcode = '22023';
    end if;
    if (j->>'moved_to_page_id') is not null and not exists (select 1 from knowledge_pages where id = (j->>'moved_to_page_id')::uuid and tenant_id = new.tenant_id) then
      raise exception '移し先は同じ会社のページ' using errcode = '22023';
    end if;
    return new;
  end if;
  if not exists (select 1 from knowledge_pages where id = coalesce((j->>'page_id')::uuid, (j->>'from_page_id')::uuid) and tenant_id = new.tenant_id) then
    raise exception '元のページと同じ会社の行だけ' using errcode = '22023';
  end if;
  if tg_table_name = 'knowledge_page_versions' and (j->>'source_ticket_id') is not null
     and not exists (select 1 from tickets where id = (j->>'source_ticket_id')::uuid and tenant_id = new.tenant_id) then
    raise exception '直す案の出どころは同じ会社のチケット' using errcode = '22023';
  end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['knowledge_pages','knowledge_page_versions','knowledge_links'] loop
    execute format('drop trigger if exists %I_same_tenant on %I', t, t);
    execute format('create trigger %I_same_tenant before insert or update on %I for each row execute function app.knowledge_same_tenant()', t, t);
    execute format('drop trigger if exists %I_updated_at on %I', t, t);
    execute format('create trigger %I_updated_at before update on %I for each row execute function app.set_updated_at()', t, t);
    execute format('insert into target_kinds (key, label) values (%L, %L) on conflict do nothing', t, t);
  end loop;
end $$;

insert into app.schema_migrations (name) values ('0073_knowledge.sql') on conflict do nothing;
