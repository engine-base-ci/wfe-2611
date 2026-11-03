-- 0071 チケットの本体の表（KN-38・D-125.27・D-125.38・D-125.53・D-125.67・D-125.68・D-128.95・D-128.115）
--   tickets（本文は区画 ticket_sections に分け、区画ごとに版 ticket_section_versions）・種別と区画の並び（ticket_kinds・kind_sections）・
--   作業の段（ticket_stages）・分類の軸と値（class_axes・class_values・ticket_class_values）・渡すときに一緒に切り替えるもの（handover_rules）。
--   行の守りは policies/0071_tickets.sql（gen_rls.py ← 05_flow/rls_policies.py）。ここは表・番号・上限・読める／書けるの関数・ワークスペースの初めの行。
--   前の tasks は後のフェーズのものとして残す（置き換えるだけで消さない・D-127.1）。

-- ---------------------------------------------------------------- 番号の頭（グループ）
alter table scopes add column if not exists ticket_prefix text;
alter table scopes add column if not exists next_ticket_no int not null default 1;

-- ---------------------------------------------------------------- 種別と区画の並び
create table if not exists ticket_kinds (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  name text not null check (length(name) between 1 and 40),
  color text,
  description text,
  position int not null default 0,
  is_builtin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists ticket_kinds_tenant_idx on ticket_kinds (tenant_id);

create table if not exists kind_sections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  kind_id uuid not null references ticket_kinds(id),
  section_key text not null,
  label text not null,
  mode text not null default 'show' check (mode in ('required', 'show', 'hidden')),   -- 必須・出す・外す
  position int not null default 0,
  content_type text not null default 'text' check (content_type in ('text', 'bullets', 'table', 'checklist', 'date')),
  hint text,
  client_visible boolean not null default false,       -- 先方に見せられる区画
  used_for_acceptance boolean not null default false,  -- 完了の条件の確かめに使う
  default_test_specs jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  unique (kind_id, section_key)
);
create index if not exists kind_sections_tenant_idx on kind_sections (tenant_id);

-- ---------------------------------------------------------------- 作業の段（仕組みの段は製品が固定・会社が直せる段は 8 まで）
create table if not exists ticket_stages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  key text,                                  -- 仕組みの段の印（checking・awaiting_approval・running）と、初めの段（todo・doing・hold・done）
  name text not null check (length(name) between 1 and 20),
  position int not null default 0,
  is_fixed boolean not null default false,   -- 確認中・承認待ち・実行中（製品が固定・名前も変えない）
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  unique (tenant_id, key)
);
create index if not exists ticket_stages_tenant_idx on ticket_stages (tenant_id);

-- ---------------------------------------------------------------- 分類の軸と値（会社が足す軸は 5 まで）
create table if not exists class_axes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  key text not null,
  name text not null check (length(name) between 1 and 20),
  is_builtin boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  unique (tenant_id, key)
);
create index if not exists class_axes_tenant_idx on class_axes (tenant_id);

create table if not exists class_values (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  axis_id uuid not null references class_axes(id),
  label text not null check (length(label) between 1 and 30),
  color text,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists class_values_tenant_idx on class_values (tenant_id);
create index if not exists class_values_axis_idx on class_values (axis_id);

-- ---------------------------------------------------------------- チケット
create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  scope_id uuid not null references scopes(id),               -- グループ
  number text not null,                                       -- 例 EG-128。横渡しで変えない（D-128.115）
  kind_id uuid not null references ticket_kinds(id),
  stage_id uuid not null references ticket_stages(id),
  title text not null check (length(title) between 1 and 200),
  assignee_member_id uuid references members(id),            -- 担当者（D-128.25）
  delegated_to_clone boolean not null default false,          -- 分身に任せている（実行者の列は持たない・D-128.26）
  client_id uuid,                                             -- 取引先（clients は KN-41 で作り、そこで外部キーを付ける）
  parent_ticket_id uuid references tickets(id),               -- 3 段まで（下の関数で守る）
  derived_from_ticket_id uuid references tickets(id),
  start_on date,
  due_on date,
  priority text not null default 'mid' check (priority in ('mid', 'high')),
  priority_reason text,
  estimate_minutes int check (estimate_minutes is null or estimate_minutes >= 0),
  actual_minutes int check (actual_minutes is null or actual_minutes >= 0),
  work_type_id uuid references skills(id),
  work_type_version int,
  hold_reason text,
  resume_condition text,
  client_share jsonb not null default '{}'::jsonb,           -- 先方に見せるもの（既定は社内だけ・D-128.100）
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  deleted_by uuid references members(id),                    -- 戻せるのは消した本人とマネージャー・管理者（D-128.84）
  check (priority <> 'high' or coalesce(length(trim(priority_reason)), 0) > 0),   -- 高は理由が必須（D-125.33）
  check (due_on is null or start_on is null or start_on <= due_on),
  check (parent_ticket_id is null or parent_ticket_id <> id),
  unique (tenant_id, number)
);
create index if not exists tickets_tenant_idx on tickets (tenant_id);
create index if not exists tickets_scope_idx on tickets (tenant_id, scope_id);
create index if not exists tickets_assignee_idx on tickets (assignee_member_id);
create index if not exists tickets_parent_idx on tickets (parent_ticket_id);
create index if not exists tickets_stage_idx on tickets (stage_id);
create index if not exists tickets_due_idx on tickets (tenant_id, due_on);

create table if not exists ticket_sections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  ticket_id uuid not null references tickets(id),
  section_key text not null,
  position int not null default 0,
  body jsonb not null default '{}'::jsonb,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  unique (ticket_id, section_key)
);
create index if not exists ticket_sections_tenant_idx on ticket_sections (tenant_id);

create table if not exists ticket_section_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  ticket_id uuid not null references tickets(id),             -- 元のチケット（読める人を決める）
  section_id uuid not null references ticket_sections(id),
  version int not null,
  body jsonb not null,
  edited_by uuid references members(id),
  edited_at timestamptz not null default now(),
  edited_by_clone boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  unique (section_id, version)
);
create index if not exists ticket_section_versions_ticket_idx on ticket_section_versions (ticket_id);
-- 版は追記だけ。直す・消すはアプリの役にさせない
revoke update, delete on ticket_section_versions from kaname_app;

create table if not exists ticket_class_values (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  ticket_id uuid not null references tickets(id),
  value_id uuid not null references class_values(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  unique (ticket_id, value_id)
);
create index if not exists ticket_class_values_ticket_idx on ticket_class_values (ticket_id);

-- ---------------------------------------------------------------- 渡すときに一緒に切り替えるもの（初めは全部「毎回聞く」・D-125.71）
create table if not exists handover_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  target text not null check (target in ('children', 'links', 'group', 'axis')),   -- 子・孫／派生・関連／所属グループ／会社が足した軸の値（D-125.70）
  axis_id uuid references class_axes(id),
  mode text not null default 'ask' check (mode in ('ask', 'always', 'never')),      -- 毎回聞く・いつも・しない
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  check ((target = 'axis') = (axis_id is not null))
);
create index if not exists handover_rules_tenant_idx on handover_rules (tenant_id);
create unique index if not exists handover_rules_target_uq on handover_rules (tenant_id, target, coalesce(axis_id, '00000000-0000-0000-0000-000000000000'::uuid)) where deleted_at is null;

-- ---------------------------------------------------------------- 更新の印
do $$ declare t text; begin
  foreach t in array array['ticket_kinds','kind_sections','ticket_stages','class_axes','class_values','tickets','ticket_sections','ticket_section_versions','ticket_class_values','handover_rules'] loop
    execute format('drop trigger if exists %I_updated_at on %I', t, t);
    execute format('create trigger %I_updated_at before update on %I for each row execute function app.set_updated_at()', t, t);
    execute format('insert into target_kinds (key, label) values (%L, %L) on conflict do nothing', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------- 番号（グループの頭＋連番。作るときに 1 回だけ付け、あとで変えない）
create or replace function app.ticket_number() returns trigger language plpgsql security definer set search_path = public, app as $$
declare p text; n int;
begin
  -- 番号はいつもサーバーが付ける（入ってきた値は使わない）
  update scopes set next_ticket_no = next_ticket_no + 1
    where id = new.scope_id and tenant_id = new.tenant_id
    returning coalesce(nullif(ticket_prefix, ''), 'T'), next_ticket_no - 1 into p, n;
  if n is null then raise exception 'グループがこの会社に無い' using errcode = '23503'; end if;
  new.number := p || '-' || n;
  return new;
end $$;
drop trigger if exists tickets_number on tickets;
create trigger tickets_number before insert on tickets for each row execute function app.ticket_number();

create or replace function app.ticket_number_fixed() returns trigger language plpgsql as $$
begin
  if new.number is distinct from old.number then raise exception 'チケットの番号は変えない（D-128.115）' using errcode = '22023'; end if;
  if new.tenant_id is distinct from old.tenant_id then raise exception 'チケットの会社は変えない' using errcode = '22023'; end if;
  return new;
end $$;
drop trigger if exists tickets_number_fixed on tickets;
create trigger tickets_number_fixed before update on tickets for each row execute function app.ticket_number_fixed();

-- ---------------------------------------------------------------- 親子は 3 段まで・輪にしない（D-125.51）
create or replace function app.ticket_depth_check() returns trigger language plpgsql security definer set search_path = public, app as $$
declare d int := 1; cur uuid := new.parent_ticket_id; below int;
begin
  if new.parent_ticket_id is null then return new; end if;
  while cur is not null loop
    if cur = new.id then raise exception 'チケットの親子が輪になる' using errcode = '22023'; end if;
    d := d + 1;
    if d > 3 then raise exception 'チケットの親子は 3 段まで' using errcode = '22023'; end if;
    select parent_ticket_id into cur from tickets where id = cur and tenant_id = new.tenant_id;
  end loop;
  -- 自分の下にある段も数える（子を持つチケットを、深い所へ移せない）
  with recursive down as (select id, 1 as lv from tickets where parent_ticket_id = new.id union all select t.id, down.lv + 1 from tickets t join down on t.parent_ticket_id = down.id where down.lv < 5)
  select coalesce(max(lv), 0) into below from down;
  if d + below > 3 then raise exception 'チケットの親子は 3 段まで（子を含めて）' using errcode = '22023'; end if;
  if exists (select 1 from tickets where id = new.parent_ticket_id and tenant_id <> new.tenant_id) then raise exception '親は同じ会社のチケット' using errcode = '22023'; end if;
  return new;
end $$;
drop trigger if exists tickets_depth on tickets;
create trigger tickets_depth before insert or update of parent_ticket_id on tickets for each row execute function app.ticket_depth_check();

-- ---------------------------------------------------------------- 上限（種別 10・会社が直せる段 8・会社が足す軸 5・区画は種別ごとに 20・D-125.68・D-128.95）
create or replace function app.ticket_limits() returns trigger language plpgsql security definer set search_path = public, app as $$
declare n int; j jsonb := to_jsonb(new);
begin
  if j->>'deleted_at' is not null then return new; end if;
  -- 列の有無が表ごとに違うので、行を jsonb にして読む（plpgsql は and を途中で打ち切らない）
  if tg_table_name = 'ticket_kinds' then
    select count(*) into n from ticket_kinds where tenant_id = (j->>'tenant_id')::uuid and deleted_at is null and id <> (j->>'id')::uuid;
    if n >= 10 then raise exception '種別は 10 まで' using errcode = '23514'; end if;
  elsif tg_table_name = 'ticket_stages' then
    if not (j->>'is_fixed')::boolean then
      select count(*) into n from ticket_stages where tenant_id = (j->>'tenant_id')::uuid and deleted_at is null and not is_fixed and id <> (j->>'id')::uuid;
      if n >= 8 then raise exception '作業の段は 8 まで' using errcode = '23514'; end if;
    end if;
  elsif tg_table_name = 'class_axes' then
    if not (j->>'is_builtin')::boolean then
      select count(*) into n from class_axes where tenant_id = (j->>'tenant_id')::uuid and deleted_at is null and not is_builtin and id <> (j->>'id')::uuid;
      if n >= 5 then raise exception '足す軸は 5 まで' using errcode = '23514'; end if;
    end if;
  elsif tg_table_name = 'kind_sections' then
    select count(*) into n from kind_sections where kind_id = (j->>'kind_id')::uuid and deleted_at is null and id <> (j->>'id')::uuid;
    if n >= 20 then raise exception '区画は種別ごとに 20 まで' using errcode = '23514'; end if;
  end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['ticket_kinds','ticket_stages','class_axes','kind_sections'] loop
    execute format('drop trigger if exists %I_limits on %I', t, t);
    execute format('create trigger %I_limits before insert or update on %I for each row execute function app.ticket_limits()', t, t);
  end loop;
end $$;

-- 仕組みの段（確認中・承認待ち・実行中）は名前も変えない・消さない（D-125.38）
create or replace function app.ticket_stage_fixed() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.is_fixed then raise exception '仕組みの段は消せない' using errcode = '22023'; end if;
    return old;
  end if;
  if old.is_fixed and (new.name is distinct from old.name or new.key is distinct from old.key or new.deleted_at is not null or not new.is_fixed) then
    raise exception '仕組みの段は変えられない' using errcode = '22023';
  end if;
  if not old.is_fixed and new.is_fixed then raise exception '仕組みの段は増やせない' using errcode = '22023'; end if;
  return new;
end $$;
drop trigger if exists ticket_stages_fixed on ticket_stages;
create trigger ticket_stages_fixed before update or delete on ticket_stages for each row execute function app.ticket_stage_fixed();
create or replace function app.ticket_stage_insert() returns trigger language plpgsql as $$
begin
  -- 仕組みの段はワークスペースの初めの行を作る関数（security definer）だけが足す
  if new.is_fixed and current_user = 'kaname_app' then raise exception '仕組みの段は増やせない' using errcode = '22023'; end if;
  return new;
end $$;
drop trigger if exists ticket_stages_insert on ticket_stages;
create trigger ticket_stages_insert before insert on ticket_stages for each row execute function app.ticket_stage_insert();

-- ---------------------------------------------------------------- 読める・書ける（行の守りの述語から呼ぶ。policy から tickets を直接引くと自分に再帰するので security definer に寄せる）
-- 関わっている人：承認する人（KN-44 で approvals.ticket_id）・渡された／判断を仰がれた相手（KN-39 で ticket_handovers）。表ができたらこの関数を作り直す
create or replace function app.ticket_involved(tid uuid, uid uuid) returns boolean language sql stable security definer set search_path = public, app as $$
  select false
$$;
create or replace function app.ticket_visible(tid uuid) returns boolean language sql stable security definer set search_path = public, app as $$
  select exists (
    select 1 from tickets t
    where t.id = tid and t.tenant_id = app.tenant_id()
      and (t.scope_id = any(visible_scopes(app.user_id())) or t.assignee_member_id = app.user_id() or app.ticket_involved(t.id, app.user_id()))
  )
$$;
create or replace function app.ticket_writable(tid uuid) returns boolean language sql stable security definer set search_path = public, app as $$
  select exists (
    select 1 from tickets t
    where t.id = tid and t.tenant_id = app.tenant_id()
      and (has_permission(app.user_id(), 'tickets', t.scope_id, 'edit') or t.assignee_member_id = app.user_id())
  )
$$;
-- 版・本文・分類の行は、元のチケットと同じ会社（別の会社のチケットにつなげない）
create or replace function app.ticket_child_same_tenant() returns trigger language plpgsql security definer set search_path = public, app as $$
begin
  if not exists (select 1 from tickets where id = new.ticket_id and tenant_id = new.tenant_id) then
    raise exception '元のチケットと同じ会社の行だけ' using errcode = '22023';
  end if;
  if tg_table_name = 'ticket_section_versions' then
    if not exists (select 1 from ticket_sections where id = (to_jsonb(new)->>'section_id')::uuid and ticket_id = new.ticket_id) then
      raise exception '版は元のチケットの区画の版' using errcode = '22023';
    end if;
  elsif tg_table_name = 'ticket_class_values' then
    if not exists (select 1 from class_values where id = (to_jsonb(new)->>'value_id')::uuid and tenant_id = new.tenant_id) then
      raise exception '分類の値は同じ会社の値' using errcode = '22023';
    end if;
  end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['ticket_sections','ticket_section_versions','ticket_class_values'] loop
    execute format('drop trigger if exists %I_same_tenant on %I', t, t);
    execute format('create trigger %I_same_tenant before insert or update on %I for each row execute function app.ticket_child_same_tenant()', t, t);
  end loop;
end $$;
grant execute on function app.ticket_visible(uuid), app.ticket_writable(uuid), app.ticket_involved(uuid, uuid) to kaname_app;

-- ---------------------------------------------------------------- ワークスペースの初めの行（仕組みの段・初めの作業の段・優先度の軸・渡すときの決まり・種別「タスク」と区画）
--   課題・QA・会議などほかの種別は、運営のひな形から入れる（KN-16）。ここは製品が必ず持つものだけ
create or replace function app.ticket_basics(t uuid) returns void language plpgsql security definer set search_path = public, app as $$
declare k uuid; ax uuid;
begin
  insert into ticket_stages (tenant_id, key, name, position, is_fixed) values
    (t, 'todo', '未着手', 10, false), (t, 'doing', '作業中', 20, false), (t, 'hold', '保留', 30, false),
    (t, 'checking', '確認中', 40, true), (t, 'awaiting_approval', '承認待ち', 50, true), (t, 'running', '実行中', 60, true),
    (t, 'done', '完了', 70, false)
  on conflict (tenant_id, key) do nothing;
  insert into class_axes (tenant_id, key, name, is_builtin, position) values (t, 'priority', '優先度', true, 0)
  on conflict (tenant_id, key) do nothing;
  insert into handover_rules (tenant_id, target, mode)
    select t, x, 'ask' from unnest(array['children', 'links', 'group']) x
    where not exists (select 1 from handover_rules h where h.tenant_id = t and h.target = x and h.deleted_at is null);
  if not exists (select 1 from ticket_kinds where tenant_id = t and is_builtin and name = 'タスク') then
    insert into ticket_kinds (tenant_id, name, color, position, is_builtin) values (t, 'タスク', '#186F69', 0, true) returning id into k;
    insert into kind_sections (tenant_id, kind_id, section_key, label, mode, position, content_type, hint, used_for_acceptance) values
      (t, k, 'purpose', '目的', 'required', 10, 'text', '何のためにやるか（1〜2 文）', false),
      (t, k, 'done', '完了の条件', 'required', 20, 'checklist', '終わったと言える条件。ここからテスト仕様の案ができる', true),
      (t, k, 'constraints', '前提と制約', 'show', 30, 'bullets', '支払期日・送り方・使ってはいけないもの', false),
      (t, k, 'counterpart', '相手', 'show', 40, 'text', '宛先・CC・先方の担当', false),
      (t, k, 'todo', '実施事項', 'required', 50, 'checklist', 'やることの一覧（チェックつき）', false),
      (t, k, 'tests', 'テスト仕様と確認の結果', 'show', 60, 'table', '① 機械 ② AI ③ 人 の確認', false),
      (t, k, 'artifacts', '成果物', 'show', 70, 'text', '作ったもの（請求書・見積・メール など）', false),
      (t, k, 'decisions', '決定ログ', 'show', 80, 'bullets', '決まったこと', false),
      (t, k, 'risks', 'リスクと懸念', 'show', 90, 'bullets', '気になること', false),
      (t, k, 'free', '自由欄', 'hidden', 100, 'text', null, false);
  end if;
  -- 初めの種別は 4 つ（タスク・課題・QA・会議・D-128.117）。区画の中身は D-128.117 の案
  if not exists (select 1 from ticket_kinds where tenant_id = t and is_builtin and name = '課題') then
    insert into ticket_kinds (tenant_id, name, color, position, is_builtin) values (t, '課題', '#B45309', 10, true) returning id into k;
    insert into kind_sections (tenant_id, kind_id, section_key, label, mode, position, content_type, hint, used_for_acceptance) values
      (t, k, 'happening', '起きていること', 'required', 10, 'text', 'いつ・どこで・何が起きているか', false),
      (t, k, 'impact', '影響', 'required', 20, 'bullets', '誰が・何に困っているか', false),
      (t, k, 'done', '完了の条件', 'required', 30, 'checklist', '直ったと言える条件。ここからテスト仕様の案ができる', true),
      (t, k, 'cause', '原因の見立て', 'show', 40, 'text', '分かっていること・まだ分からないこと', false),
      (t, k, 'fix_plan', '直し方の案', 'show', 50, 'bullets', '案と選んだ理由', false),
      (t, k, 'todo', '実施事項', 'show', 60, 'checklist', 'やることの一覧（チェックつき）', false),
      (t, k, 'tests', 'テスト仕様と確認の結果', 'show', 70, 'table', '① 機械 ② AI ③ 人 の確認', false),
      (t, k, 'decisions', '決定ログ', 'show', 80, 'bullets', '決まったこと', false),
      (t, k, 'handoff', '申し送り', 'show', 90, 'bullets', '次の人に伝えること', false);
  end if;
  if not exists (select 1 from ticket_kinds where tenant_id = t and is_builtin and name = 'QA') then
    insert into ticket_kinds (tenant_id, name, color, position, is_builtin) values (t, 'QA', '#6B5B99', 20, true) returning id into k;
    insert into kind_sections (tenant_id, kind_id, section_key, label, mode, position, content_type, hint, used_for_acceptance) values
      (t, k, 'target', '確かめるもの', 'required', 10, 'text', '確かめる成果物・画面・数字', false),
      (t, k, 'viewpoints', '確かめる観点', 'required', 20, 'checklist', '何を見れば正しいと言えるか', true),
      (t, k, 'method', '判定のしかた', 'required', 30, 'table', '① 機械 ② AI ③ 人 のどれで、何と比べるか', false),
      (t, k, 'result', '結果', 'required', 40, 'table', '観点ごとの 通過・不通過', false),
      (t, k, 'findings', '見つかったこと', 'show', 50, 'bullets', 'ずれ・気になる点', false),
      (t, k, 'evidence', '証拠', 'show', 60, 'text', '確かめた画面・記録・数字', false),
      (t, k, 'fix_tickets', '直すチケット', 'show', 70, 'bullets', '見つかったことを直すチケット', false),
      (t, k, 'handoff', '申し送り', 'show', 80, 'bullets', '次の人に伝えること', false);
  end if;
  if not exists (select 1 from ticket_kinds where tenant_id = t and is_builtin and name = '会議') then
    insert into ticket_kinds (tenant_id, name, color, position, is_builtin) values (t, '会議', '#22345C', 30, true) returning id into k;
    insert into kind_sections (tenant_id, kind_id, section_key, label, mode, position, content_type, hint, used_for_acceptance) values
      (t, k, 'purpose', '目的', 'required', 10, 'text', 'この会議で決めること・分かりたいこと', false),
      (t, k, 'agenda', '議題', 'required', 20, 'checklist', '話すことの一覧', false),
      (t, k, 'attendees', '出る人', 'show', 30, 'bullets', '社内・先方', false),
      (t, k, 'minutes', '議事', 'show', 40, 'text', '話したこと', false),
      (t, k, 'decisions', '決まったこと', 'show', 50, 'bullets', '決定ログに入れること', false),
      (t, k, 'homework', '宿題', 'show', 60, 'checklist', '誰が・何を・いつまでに（チケットにする）', false);
  end if;
end $$;
-- 会社を作ったら初めの行を入れる。前からある会社にも入れる
create or replace function app.ticket_basics_on_tenant() returns trigger language plpgsql security definer set search_path = public, app as $$
begin
  perform app.ticket_basics(new.id);
  return new;
end $$;
drop trigger if exists tenants_ticket_basics on tenants;
create trigger tenants_ticket_basics after insert on tenants for each row execute function app.ticket_basics_on_tenant();
do $$ declare r record; begin
  for r in select id from tenants loop perform app.ticket_basics(r.id); end loop;
end $$;

insert into app.schema_migrations (name) values ('0071_tickets.sql') on conflict do nothing;
