-- 0076 分身と運営の新しい表（KN-43・D-126.2・D-126.19・D-128.41〜.43・D-128.72・D-128.90）
--   覚えたいこと（learning_candidates：決めるまで使わない・会社のルールとぶつかるものは管理者の OK 待ち）・
--   操作（operations：運営が用意する手足。第1フェーズは汎用のブラウザ操作 1 つ）・値段の案（ops_plan_proposals：作った人と決める人は別）。
--   行の守りは policies/0076_clone_ops.sql。

create table if not exists learning_candidates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  owner_member_id uuid not null references members(id),     -- その人の分身
  trigger text not null check (trigger in ('remember', 'edited', 'returned', 'chat', 'repeated', 'done')),   -- 覚えて・直したところ・差し戻し・話の中で・同じ流れ・完了
  proposed_as text not null check (proposed_as in ('rule', 'way', 'memory')),   -- 守ること・やり方・覚えていること
  text text not null check (length(text) between 1 and 2000),
  evidence jsonb not null default '{}'::jsonb,              -- どのチケット・どの話から
  check_result jsonb not null default '{}'::jsonb,          -- 分身の点検：ぶつかる決まり・似ているもの・要る OK
  state text not null default 'waiting' check (state in ('waiting', 'learned', 'rejected', 'later', 'needs_ok')),   -- 待っている・覚えた・覚えない・あとで・例外の OK 待ち
  decided_at timestamptz,
  decided_by uuid references members(id),
  result_type text,
  result_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  check ((state in ('learned', 'rejected')) = (decided_at is not null))
);
create index if not exists learning_candidates_owner_idx on learning_candidates (tenant_id, owner_member_id, state);

create table if not exists operations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default app.ops_tenant_id() references tenants(id),   -- 運営
  key text not null,
  name text not null,
  kind text not null default 'browser' check (kind in ('browser', 'mcp', 'api')),
  current_version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  unique (tenant_id, key)
);

create table if not exists ops_plan_proposals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default app.ops_tenant_id() references tenants(id),   -- 運営
  plan_id uuid not null references plans(id),
  from_version int,
  to_version int,
  changes jsonb not null default '{}'::jsonb,
  existing_policy text not null default 'after_days' check (existing_policy in ('after_days', 'keep')),   -- N 日後から・ずっと今の値段
  notice_days int check (notice_days is null or notice_days >= 0),
  new_from date,
  reason text not null check (length(trim(reason)) > 0),    -- 理由は必須
  proposed_by uuid not null references ops_members(id),
  decided_by uuid references ops_members(id),
  state text not null default 'draft' check (state in ('draft', 'waiting', 'decided', 'returned')),   -- 下書き・決める人を待っている・決めた・差し戻した
  decided_at timestamptz,
  return_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  check ((state in ('decided', 'returned')) = (decided_at is not null and decided_by is not null)),
  check (state <> 'returned' or coalesce(length(trim(return_reason)), 0) > 0)
);
create index if not exists ops_plan_proposals_plan_idx on ops_plan_proposals (plan_id);
revoke delete on ops_plan_proposals from kaname_app;   -- 案・差し戻し・決めた記録は消せない

-- 自分の案は自分で決められない。「値段を決める」ができる人が 1 人しかいない間だけ例外（本人確認の取り直しは API で・D-128.72）
create or replace function app.ops_plan_proposal_guard() returns trigger language plpgsql security definer set search_path = public, app as $$
declare deciders int;
begin
  if new.decided_by is not null and new.decided_by = new.proposed_by then
    select count(*) into deciders from ops_members m
      where m.deleted_at is null and coalesce(to_jsonb(m)->'caps', '[]'::jsonb) ? 'plan_decide';
    if deciders <> 1 then
      raise exception '自分の案は自分で決められない（値段を決められる人が 1 人のときだけ例外）' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists ops_plan_proposals_guard on ops_plan_proposals;
create trigger ops_plan_proposals_guard before insert or update on ops_plan_proposals for each row execute function app.ops_plan_proposal_guard();

-- 覚えたいことの持ち主は同じ会社のメンバー
create or replace function app.learning_same_tenant() returns trigger language plpgsql security definer set search_path = public, app as $$
begin
  if not exists (select 1 from members where id = new.owner_member_id and tenant_id = new.tenant_id) then
    raise exception 'その会社のメンバーの分身だけ' using errcode = '22023';
  end if;
  return new;
end $$;
drop trigger if exists learning_candidates_same_tenant on learning_candidates;
create trigger learning_candidates_same_tenant before insert or update on learning_candidates for each row execute function app.learning_same_tenant();

do $$ declare t text; begin
  foreach t in array array['learning_candidates','operations','ops_plan_proposals'] loop
    execute format('drop trigger if exists %I_updated_at on %I', t, t);
    execute format('create trigger %I_updated_at before update on %I for each row execute function app.set_updated_at()', t, t);
    execute format('insert into target_kinds (key, label) values (%L, %L) on conflict do nothing', t, t);
  end loop;
end $$;

-- 第1フェーズの操作は汎用のブラウザ操作 1 つ（D-126.19）
insert into operations (tenant_id, key, name, kind)
  select app.ops_tenant_id(), 'browser', 'ブラウザで操作する', 'browser' where app.ops_tenant_id() is not null
  on conflict (tenant_id, key) do nothing;

insert into app.schema_migrations (name) values ('0076_clone_ops.sql') on conflict do nothing;
