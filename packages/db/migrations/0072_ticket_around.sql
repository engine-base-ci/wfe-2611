-- 0072 チケットのまわりの表（KN-39・D-125.17・D-125.29・D-125.40・D-125.63・D-125.70・D-125.79・D-128.80・D-128.83・D-128.85・D-128.115・D-128.119）
--   テスト仕様（test_specs）と検査の結果（checks）・決定（ticket_decisions）・スレッド（ticket_messages）・参照の記録（reference_logs）・
--   つながり（ticket_links：関連・派生元の 2 つだけ）・渡す（ticket_handovers）・保存した検索条件（saved_views）・CSV の取り込み（ticket_imports）。
--   行の守りは policies/0072_ticket_around.sql（gen_rls.py ← 05_flow/rls_policies.py）。
--   渡された相手が答えるまでそのチケットを読めるよう、app.ticket_involved を作り直す（KN-38 の申し送り）。
--   取り込んだ下書きのチケットは、確定するまで取り込んだ人だけが見て直せる（D-128.119）。

-- ---------------------------------------------------------------- テスト仕様と検査（D-125.17・D-125.79）
create table if not exists test_specs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  ticket_id uuid not null references tickets(id),
  check_kind text not null check (check_kind in ('machine', 'ai', 'human')),   -- ① 機械・② AI・③ 人
  title text not null check (length(title) between 1 and 200),
  judge_type text,
  params jsonb not null default '{}'::jsonb,
  version int not null default 1 check (version >= 1),
  off_reason text,                                                             -- OFF にした理由（OFF のときだけ）
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists test_specs_ticket_idx on test_specs (tenant_id, ticket_id);

-- 検査の結果は追記だけ（やり直しは attempt を増やして足す）
create table if not exists checks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  ticket_id uuid not null references tickets(id),          -- 行の守りのため元のチケットを持つ（test_specs と同じチケット）
  test_spec_id uuid not null references test_specs(id),
  spec_version int not null default 1,
  artifact_version_id uuid references artifact_versions(id),
  attempt int not null default 1 check (attempt >= 1),
  result text not null check (result in ('pass', 'fail', 'unsure')),          -- 通過・落ちた・不確か
  evidence jsonb not null default '{}'::jsonb,                                 -- 根拠の引用
  runner text not null check (runner in ('server', 'bridge', 'human')),
  checked_by_member_id uuid references members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  check (runner <> 'human' or checked_by_member_id is not null)               -- 人の確認は誰が見たかを残す
);
create index if not exists checks_ticket_idx on checks (tenant_id, ticket_id);
create index if not exists checks_spec_idx on checks (test_spec_id);
revoke update, delete on checks from kaname_app;

-- ---------------------------------------------------------------- 決定（上書きせず、新しい行で「改めた」とつなぐ・D-125.63）
create table if not exists ticket_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  ticket_id uuid not null references tickets(id),
  author_member_id uuid references members(id),             -- 仕組みの書き込みは null
  kind text not null default 'post' check (kind in ('post', 'change', 'system')),   -- 書き込み・変更・仕組み
  body text,
  mentions uuid[] not null default '{}',
  changes jsonb,                                            -- 期限 11/01 → 11/02 など
  quote_of_id uuid references ticket_messages(id),
  reactions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  check (kind <> 'post' or (author_member_id is not null and coalesce(length(trim(body)), 0) > 0))
);
create index if not exists ticket_messages_ticket_idx on ticket_messages (tenant_id, ticket_id, created_at);

create table if not exists ticket_decisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  ticket_id uuid not null references tickets(id),
  text text not null check (length(text) between 1 and 2000),
  reason text,
  decided_by uuid references members(id),
  decided_at timestamptz not null default now(),
  source_message_id uuid references ticket_messages(id),
  superseded_by_id uuid references ticket_decisions(id),   -- 改めた新しい決定
  promoted_to text not null default 'ticket' check (promoted_to in ('ticket', 'client_rule')),   -- このチケットだけ・取引先のルール
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  check (superseded_by_id is null or superseded_by_id <> id)
);
create index if not exists ticket_decisions_ticket_idx on ticket_decisions (tenant_id, ticket_id);
revoke delete on ticket_decisions from kaname_app;   -- 決定は消さない（改めるだけ）

-- ---------------------------------------------------------------- 参照の記録（外は URL・題名・時刻だけ・D-125.28・D-125.35）
create table if not exists reference_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  ticket_id uuid not null references tickets(id),
  action_run_id uuid references action_runs(id),
  ref_type text not null check (ref_type in ('page', 'memory', 'attachment', 'url')),
  ref_id uuid,
  url text,
  title text,
  seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  check ((ref_type = 'url') = (url is not null))
);
create index if not exists reference_logs_ticket_idx on reference_logs (tenant_id, ticket_id);
revoke update, delete on reference_logs from kaname_app;

-- ---------------------------------------------------------------- つながり（関連・派生元の 2 つだけ。前後と重複は持たない・D-128.80）
create table if not exists ticket_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  from_ticket_id uuid not null references tickets(id),
  to_ticket_id uuid not null references tickets(id),
  kind text not null check (kind in ('related', 'derived_from')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  check (from_ticket_id <> to_ticket_id),
  unique (from_ticket_id, to_ticket_id, kind)
);
create index if not exists ticket_links_from_idx on ticket_links (tenant_id, from_ticket_id);
create index if not exists ticket_links_to_idx on ticket_links (tenant_id, to_ticket_id);

-- ---------------------------------------------------------------- 渡す（渡す・引き取りの申し出・配る・上へ上げる・D-125.70）
create table if not exists ticket_handovers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  ticket_id uuid not null references tickets(id),
  kind text not null check (kind in ('pass', 'offer', 'distribute', 'escalate')),
  from_member_id uuid not null references members(id),
  to_member_id uuid references members(id),
  to_scope_id uuid references scopes(id),
  reason text,
  ask text,
  reply_due timestamptz,
  switch jsonb not null default '{}'::jsonb,               -- 一緒に切り替えるもの（子・関連・グループ・軸）
  state text not null default 'waiting' check (state in ('waiting', 'accepted', 'declined', 'withdrawn')),
  decline_reason text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  check (to_member_id is not null or to_scope_id is not null),
  check (state <> 'declined' or coalesce(length(trim(decline_reason)), 0) > 0),
  check ((state = 'waiting') = (decided_at is null))
);
create index if not exists ticket_handovers_ticket_idx on ticket_handovers (tenant_id, ticket_id);
create index if not exists ticket_handovers_to_idx on ticket_handovers (to_member_id) where state = 'waiting';

-- ---------------------------------------------------------------- 保存した検索条件（自分だけ・グループの全員・D-128.83・D-128.119）
create table if not exists saved_views (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  member_id uuid not null references members(id),
  name text not null check (length(name) between 1 and 60),
  share text not null default 'self' check (share in ('self', 'group')),
  scope_id uuid references scopes(id),
  filters jsonb not null default '{}'::jsonb,
  columns jsonb not null default '[]'::jsonb,
  density text not null default 'normal' check (density in ('normal', 'compact')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  check (share <> 'group' or scope_id is not null)
);
create index if not exists saved_views_member_idx on saved_views (tenant_id, member_id);
create index if not exists saved_views_scope_idx on saved_views (tenant_id, scope_id) where share = 'group';

-- ---------------------------------------------------------------- CSV の取り込み（下書きで入り、確かめてから確定・D-128.85・D-128.119）
create table if not exists ticket_imports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  uploaded_by uuid not null references members(id),
  scope_id uuid not null references scopes(id),            -- 入れるグループ
  source text not null check (source in ('backlog', 'generic')),
  mapping jsonb not null default '{}'::jsonb,
  rows int not null default 0 check (rows >= 0),
  errors jsonb not null default '[]'::jsonb,
  state text not null default 'checking' check (state in ('checking', 'committed', 'cancelled')),   -- 確かめ中・確定・やめた
  committed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  check ((state = 'committed') = (committed_at is not null))
);
create index if not exists ticket_imports_tenant_idx on ticket_imports (tenant_id, uploaded_by);

-- 取り込みの下書きのチケット。確定したら null に戻す（そこからはグループの見え方）
alter table tickets add column if not exists draft_import_id uuid references ticket_imports(id);
create index if not exists tickets_draft_import_idx on tickets (draft_import_id) where draft_import_id is not null;

-- ---------------------------------------------------------------- 同じ会社の行だけ（別の会社のチケット・仕様・グループにつなげない）
create or replace function app.ticket_around_same_tenant() returns trigger language plpgsql security definer set search_path = public, app as $$
declare j jsonb := to_jsonb(new);
begin
  if tg_table_name = 'ticket_links' then
    if (select count(*) from tickets where id in ((j->>'from_ticket_id')::uuid, (j->>'to_ticket_id')::uuid) and tenant_id = new.tenant_id) <> 2 then
      raise exception 'つなぐのは同じ会社のチケットだけ' using errcode = '22023';
    end if;
    return new;
  end if;
  if tg_table_name in ('saved_views', 'ticket_imports') then
    if j->>'scope_id' is not null and not exists (select 1 from scopes where id = (j->>'scope_id')::uuid and tenant_id = new.tenant_id) then
      raise exception 'グループは同じ会社のもの' using errcode = '22023';
    end if;
    return new;
  end if;
  if not exists (select 1 from tickets where id = (j->>'ticket_id')::uuid and tenant_id = new.tenant_id) then
    raise exception '元のチケットと同じ会社の行だけ' using errcode = '22023';
  end if;
  if tg_table_name = 'checks' and not exists (select 1 from test_specs where id = (j->>'test_spec_id')::uuid and ticket_id = (j->>'ticket_id')::uuid) then
    raise exception '検査は元のチケットのテスト仕様の結果' using errcode = '22023';
  end if;
  if tg_table_name = 'ticket_handovers' and j->>'to_scope_id' is not null
     and not exists (select 1 from scopes where id = (j->>'to_scope_id')::uuid and tenant_id = new.tenant_id) then
    raise exception '渡す先のグループは同じ会社のもの' using errcode = '22023';
  end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['test_specs','checks','ticket_messages','ticket_decisions','reference_logs','ticket_links','ticket_handovers','saved_views','ticket_imports'] loop
    execute format('drop trigger if exists %I_same_tenant on %I', t, t);
    execute format('create trigger %I_same_tenant before insert or update on %I for each row execute function app.ticket_around_same_tenant()', t, t);
    execute format('drop trigger if exists %I_updated_at on %I', t, t);
    execute format('create trigger %I_updated_at before update on %I for each row execute function app.set_updated_at()', t, t);
    execute format('insert into target_kinds (key, label) values (%L, %L) on conflict do nothing', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------- 読める・書けるの関数を作り直す
-- 関わっている人：担当者に加え、渡された相手が答えるまで（D-128.115）。承認する人は KN-44 で足す
create or replace function app.ticket_involved(tid uuid, uid uuid) returns boolean language sql stable security definer set search_path = public, app as $$
  select exists (
    select 1 from ticket_handovers h
    where h.ticket_id = tid and h.tenant_id = app.tenant_id() and h.to_member_id = uid and h.state = 'waiting' and h.deleted_at is null
  )
$$;
-- 取り込みの下書きは、確定するまで取り込んだ人だけ（D-128.119）
create or replace function app.ticket_draft_ok(draft uuid, uid uuid) returns boolean language sql stable security definer set search_path = public, app as $$
  select draft is null or exists (select 1 from ticket_imports i where i.id = draft and i.uploaded_by = uid)
$$;
create or replace function app.ticket_visible(tid uuid) returns boolean language sql stable security definer set search_path = public, app as $$
  select exists (
    select 1 from tickets t
    where t.id = tid and t.tenant_id = app.tenant_id()
      and app.ticket_draft_ok(t.draft_import_id, app.user_id())
      and (t.scope_id = any(visible_scopes(app.user_id())) or t.assignee_member_id = app.user_id() or app.ticket_involved(t.id, app.user_id()))
  )
$$;
create or replace function app.ticket_writable(tid uuid) returns boolean language sql stable security definer set search_path = public, app as $$
  select exists (
    select 1 from tickets t
    where t.id = tid and t.tenant_id = app.tenant_id()
      and app.ticket_draft_ok(t.draft_import_id, app.user_id())
      and (has_permission(app.user_id(), 'tickets', t.scope_id, 'edit') or t.assignee_member_id = app.user_id())
  )
$$;
grant execute on function app.ticket_involved(uuid, uuid), app.ticket_draft_ok(uuid, uuid), app.ticket_visible(uuid), app.ticket_writable(uuid) to kaname_app;

insert into app.schema_migrations (name) values ('0072_ticket_around.sql') on conflict do nothing;
