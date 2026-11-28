-- 0077 前からある表に足す列：承認と分身（K-9・D-125.139・D-126.2・D-126.13・D-128.40〜.44・D-128.86・D-128.87・D-128.89・D-128.90）
--   approvals（チケットの承認・上位の承認・決まりの例外・やり方を広げる）・policies（守ること・上に回す）・memories・skills（scoped）・skill_versions（業務の型の欄）・clones（自動で覚える）。
--   足すだけ（消す・名前を変えるはしない）。承認する人を「関わっている人」に入れ、承認する間はグループの外でもチケットを読めるようにする（K-3・K-4 の申し送り）。

-- ---------------------------------------------------------------- 承認（D-128.86・D-128.87・D-128.89）
alter table approvals add column if not exists ticket_id uuid references tickets(id);
alter table approvals add column if not exists kind text not null default 'artifact';
alter table approvals add column if not exists subject_type text;
alter table approvals add column if not exists subject_id uuid;
alter table approvals add column if not exists level int not null default 1;
alter table approvals add column if not exists parent_approval_id uuid references approvals(id);
alter table approvals add column if not exists escalated_by_policy_id uuid references policies(id);
alter table approvals add column if not exists decision text;
alter table approvals add column if not exists decided_at timestamptz;
alter table approvals add column if not exists return_targets jsonb;
alter table approvals add column if not exists return_reason text;
alter table approvals add column if not exists next_actor text;
alter table approvals add column if not exists memory_candidate boolean not null default false;
alter table approvals add column if not exists human_checks jsonb not null default '[]'::jsonb;
alter table approvals add column if not exists irreversible boolean not null default false;
alter table approvals add column if not exists step_up_at timestamptz;
alter table approvals add column if not exists withdrawn_at timestamptz;
alter table approvals add column if not exists bulk_batch_id uuid;
do $$ begin
  alter table approvals add constraint approvals_kind_ck check (kind in ('artifact', 'escalation', 'policy_exception', 'skill_widen'));   -- AI の成果物・上位の承認・決まりの例外・やり方を広げる
  alter table approvals add constraint approvals_decision_ck check (decision is null or decision in ('approve', 'self_edit', 'return', 'stop'));   -- 承認・自分で直す・差し戻し・止める
  alter table approvals add constraint approvals_next_actor_ck check (next_actor is null or next_actor in ('clone', 'self'));
  alter table approvals add constraint approvals_level_ck check (level >= 1);
  alter table approvals add constraint approvals_decided_ck check ((decision is null) = (decided_at is null));
  alter table approvals add constraint approvals_return_reason_ck check (decision is distinct from 'return' or coalesce(length(trim(return_reason)), 0) > 0);   -- 差し戻しは理由が要る
  -- 取り返しのつかない承認は直前の本人確認が要る（D-125.139）
  alter table approvals add constraint approvals_step_up_ck check (decision is distinct from 'approve' or not irreversible or step_up_at is not null);
  -- まとめて承認は 人が見る項目なし・取り消せる操作だけ（D-128.86。サーバーがもう一度確かめる）
  alter table approvals add constraint approvals_bulk_ck check (bulk_batch_id is null or (not irreversible and human_checks = '[]'::jsonb));
  alter table approvals add constraint approvals_parent_ck check (parent_approval_id is null or parent_approval_id <> id);
exception when duplicate_object then null;
end $$;
create index if not exists approvals_ticket_idx on approvals (tenant_id, ticket_id) where ticket_id is not null;
create index if not exists approvals_approver_open_idx on approvals (approver_member_id) where decision is null and withdrawn_at is null;

-- ---------------------------------------------------------------- 守ること・上に回す（D-128.40・D-128.43・D-128.87）
alter table policies add column if not exists text text;
alter table policies add column if not exists applies_to text not null default 'all';
alter table policies add column if not exists client_id uuid references clients(id);
alter table policies add column if not exists kind_id uuid references ticket_kinds(id);          -- 種別に効かせるとき
alter table policies add column if not exists source_ref jsonb;                                -- 元のチケット・話
alter table policies add column if not exists version int not null default 1;
alter table policies add column if not exists paused_at timestamptz;                           -- 一時的に効かせない
alter table policies add column if not exists use_count int not null default 0;
alter table policies add column if not exists last_used_at timestamptz;
alter table policies add column if not exists exception_of_policy_id uuid references policies(id);
alter table policies add column if not exists exception_approval_id uuid references approvals(id);
alter table policies add column if not exists kind text not null default 'rule';               -- 守ること・上に回す
alter table policies add column if not exists escalate_when jsonb;
alter table policies add column if not exists escalate_to text;
do $$ begin
  alter table policies add constraint policies_applies_to_ck check (applies_to in ('all', 'client', 'kind'));   -- 自分の仕事すべて・取引先・種別
  alter table policies add constraint policies_kind_ck check (kind in ('rule', 'escalate'));
  alter table policies add constraint policies_escalate_to_ck check (escalate_to is null or escalate_to in ('group_manager', 'person', 'client_owner'));
  alter table policies add constraint policies_escalate_ck check (kind <> 'escalate' or (escalate_when is not null and escalate_to is not null));
  alter table policies add constraint policies_target_ck check ((applies_to = 'client') = (client_id is not null) and (applies_to = 'kind') = (kind_id is not null));
  alter table policies add constraint policies_exception_ck check (exception_of_policy_id is null or exception_of_policy_id <> id);
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------- 覚えていること（D-128.42・D-128.44）
alter table memories add column if not exists auto boolean not null default false;              -- 自動で覚えた
alter table memories add column if not exists use_count int not null default 0;
alter table memories add column if not exists last_used_at timestamptz;
alter table memories add column if not exists visibility text not null default 'self';
do $$ begin
  alter table memories add constraint memories_visibility_ck check (visibility in ('self', 'recommended'));   -- 自分だけ・勧めた
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------- 業務の型（D-126.2・D-126.4・D-126.13）
--   第1フェーズ（節目①）は運営の全社向け（scope_id が空）だけ。会社・層・個人の型は節目②（KN-21）で入れる
alter table skills add column if not exists scope_id uuid references scopes(id);
alter table skills add column if not exists owner_member_id uuid references members(id);
alter table skill_versions add column if not exists fields jsonb not null default '{}'::jsonb;  -- いつ使う・確かめること・書式と手本・注意と禁止・使う操作
alter table skill_versions add column if not exists state text not null default 'draft';
alter table skill_versions add column if not exists checked jsonb;                              -- 機械の検査の結果
do $$ begin
  alter table skill_versions add constraint skill_versions_state_ck check (state in ('draft', 'active'));   -- 下書き・使っている
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------- 分身（D-128.90：自分だけのことを自動で覚えるのは既定で入）
alter table clones add column if not exists auto_memory boolean not null default true;

-- ---------------------------------------------------------------- 関わっている人に、承認する人を足す（承認するまで・D-128.115）
create or replace function app.ticket_involved(tid uuid, uid uuid) returns boolean language sql stable security definer set search_path = public, app as $$
  select exists (
    select 1 from ticket_handovers h
    where h.ticket_id = tid and h.tenant_id = app.tenant_id() and h.to_member_id = uid and h.state = 'waiting' and h.deleted_at is null
  ) or exists (
    select 1 from approvals a
    where a.ticket_id = tid and a.tenant_id = app.tenant_id() and a.approver_member_id = uid
      and a.decision is null and a.withdrawn_at is null and a.deleted_at is null
  )
$$;

-- 承認・守ることの参照先は同じ会社
create or replace function app.approval_same_tenant() returns trigger language plpgsql security definer set search_path = public, app as $$
declare j jsonb := to_jsonb(new);
begin
  if (j->>'ticket_id') is not null and not exists (select 1 from tickets where id = (j->>'ticket_id')::uuid and tenant_id = new.tenant_id) then
    raise exception 'チケットは同じ会社のもの' using errcode = '22023';
  end if;
  if (j->>'client_id') is not null and not exists (select 1 from clients where id = (j->>'client_id')::uuid and tenant_id = new.tenant_id) then
    raise exception '取引先は同じ会社のもの' using errcode = '22023';
  end if;
  if (j->>'kind_id') is not null and tg_table_name = 'policies' and not exists (select 1 from ticket_kinds where id = (j->>'kind_id')::uuid and tenant_id = new.tenant_id) then
    raise exception '種別は同じ会社のもの' using errcode = '22023';
  end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['approvals','policies'] loop
    execute format('drop trigger if exists %I_around_same_tenant on %I', t, t);
    execute format('create trigger %I_around_same_tenant before insert or update on %I for each row execute function app.approval_same_tenant()', t, t);
  end loop;
end $$;

insert into app.schema_migrations (name) values ('0077_approvals_clone.sql') on conflict do nothing;
