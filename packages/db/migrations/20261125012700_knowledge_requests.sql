-- 20261125012700 上の棚に上げる：頼みの置き場（K-687・契約の口 requestKnowledgeRaise・withdrawKnowledgeRequest・dismissKnowledgeRequest・
--   D-152.2・D-152.13・関門 C2・C6）。名前の正本は 07_functional/段10-F9/土台-knowledge.md の 1.2 と 11_tickets/K-687.md
--   ① 表 knowledge_requests（上げる・共有の頼み。K-688 の承認・断る、K-689 の共有も同じ表）② 索引・部分一意
--   ③ アプリの役は読むだけ（書くのは下の関数だけ。行の守りは同じ名前の policies・gen_rls.py が作る）④ 関数 6 つ
--   同じ migration をもう 1 度当てても壊れない形にする（if not exists・create or replace）。

-- ---------------------------------------------------------------- ① 頼みの表
create table if not exists knowledge_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  kind text not null check (kind in ('raise', 'share')),                 -- 上げる・共有する
  page_id uuid references knowledge_pages(id),
  folder_id uuid references knowledge_folders(id),                       -- 共有でフォルダのとき（K-689）
  from_scope_id uuid not null,                                           -- 元の棚の scope
  from_is_personal boolean not null default false,
  to_scope_id uuid not null,                                             -- 先（グループか会社のいちばん上。共有は見せる先のグループ）
  to_folder_id uuid references knowledge_folders(id),                    -- 上げた先で入れるフォルダ（空＝棚の直下）
  requested_by uuid not null references members(id),
  message text check (message is null or char_length(message) <= 1000),
  state text not null default 'pending' check (state in ('pending', 'approved', 'declined', 'withdrawn')),
  decided_by uuid references members(id),
  decided_at timestamptz,
  decline_reason text,
  dismissed_at timestamptz,                                              -- 断りの帯を消した
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  constraint knowledge_requests_target check (
    (kind = 'raise' and page_id is not null and folder_id is null)
    or (kind = 'share' and (page_id is null) <> (folder_id is null)))
);
drop trigger if exists knowledge_requests_updated_at on knowledge_requests;
create trigger knowledge_requests_updated_at before update on knowledge_requests for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------- ② 索引・部分一意（同じ物・種類・先の承認待ちは 1 つだけ）
create unique index if not exists knowledge_requests_pending_uq on knowledge_requests (coalesce(page_id, folder_id), kind, to_scope_id)
  where state = 'pending' and deleted_at is null;
create index if not exists knowledge_requests_to_idx on knowledge_requests (tenant_id, to_scope_id, state);
create index if not exists knowledge_requests_page_idx on knowledge_requests (page_id);
create index if not exists knowledge_requests_by_idx on knowledge_requests (requested_by);

-- ---------------------------------------------------------------- ③ 権限と行の守り（読むだけ・書けない）
grant select on knowledge_requests to kaname_app;
-- 既定の権限（0002 の alter default privileges）で付いた書く権限を外す。書く道は下の関数だけ（K687-DB-001）
revoke insert, update, delete, truncate on knowledge_requests from kaname_app;
alter table knowledge_requests enable row level security;
alter table knowledge_requests force row level security;

-- ---------------------------------------------------------------- ④ 関数
-- その棚の承認する人：会社のいちばん上なら会社の管理者・グループならそのグループのマネージャー（どちらも有効なメンバー）。K-688・K-689 も使う
create or replace function app.kn_approvers_of(p_scope uuid) returns setof uuid
language sql stable security definer set search_path = public, app, pg_temp as $$
  select tm.member_id from tenant_memberships tm
    join members m on m.id = tm.member_id and m.deleted_at is null
   where tm.tenant_id = app.tenant_id() and tm.role = 'admin' and tm.status = 'active' and tm.deleted_at is null
     and exists (select 1 from scopes s where s.id = p_scope and s.tenant_id = app.tenant_id() and s.parent_id is null)
  union
  select sm.member_id from scope_memberships sm
    join members m on m.id = sm.member_id and m.deleted_at is null
   where sm.scope_id = p_scope and sm.tenant_id = app.tenant_id() and sm.role = 'manager' and sm.deleted_at is null
     and exists (select 1 from scopes s where s.id = p_scope and s.tenant_id = app.tenant_id() and s.parent_id is not null)
     and app.kn_group_manager(sm.member_id, p_scope)
$$;

-- 今の人がその頼みの承認する人
create or replace function app.kn_request_approver(p_request uuid) returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select exists (
    select 1 from knowledge_requests r
     where r.id = p_request and r.tenant_id = app.tenant_id() and r.deleted_at is null
       and app.user_id() in (select app.kn_approvers_of(r.to_scope_id)))
$$;

-- 頼みが見える：頼んだ人・承認する人（どの状態でも）・承認待ちの頼みは物（ページかフォルダ）が見える人。行の守りが使う
create or replace function app.kn_request_visible(p_request uuid) returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select exists (
    select 1 from knowledge_requests r
     where r.id = p_request and r.tenant_id = app.tenant_id() and r.deleted_at is null
       and (r.requested_by = app.user_id()
            or app.user_id() in (select app.kn_approvers_of(r.to_scope_id))
            or (r.state = 'pending'
                and case when r.page_id is not null then app.kpage_visible(r.page_id)
                         else app.kfolder_visible(r.folder_id) end)))
$$;

-- 頼みのページを先の棚へ移す（K-688 の承認も呼ぶ）。頼みの状態は変えない（呼んだ側が決める）。会社の文脈が無くても頼みの会社で動く
--   必ず守るは外す・入れるフォルダは先の棚のフォルダだけ（ほかは棚の直下）・並びは先の同じフォルダの最後 +10・
--   書いている途中の下書きの版（だれの物でも）は捨てる・公開の版はそのまま。棚・フォルダの合いは引き金 knowledge_same_tenant が最後に守る
create or replace function app.kn_apply_raise(p_request uuid, p_by uuid) returns void
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  r record;
  v_folder uuid;
  v_pos integer;
begin
  select * into r from knowledge_requests where id = p_request and deleted_at is null;
  if not found or r.page_id is null then
    return;
  end if;
  select f.id into v_folder from knowledge_folders f
   where f.id = r.to_folder_id and f.tenant_id = r.tenant_id and f.deleted_at is null
     and f.scope_id = r.to_scope_id and not f.is_personal;
  select coalesce(max(p.position), 0) + 10 into v_pos from knowledge_pages p
   where p.tenant_id = r.tenant_id and p.deleted_at is null and p.id <> r.page_id
     and p.scope_id = r.to_scope_id and not p.is_personal
     and p.folder_id is not distinct from v_folder;
  update knowledge_pages
     set scope_id = r.to_scope_id, is_personal = false, is_must = false, folder_id = v_folder,
         position = v_pos, updated_by = p_by
   where id = r.page_id and tenant_id = r.tenant_id and deleted_at is null;
  update knowledge_page_versions set deleted_at = now(), updated_by = p_by
   where page_id = r.page_id and tenant_id = r.tenant_id and kind = 'draft' and deleted_at is null;
end $$;

-- 上げるのを頼む。答えは jsonb：{ ok: false, reason } ／ { ok: true, state: pending | approved, id, to_name }
--   reason：denied・draft・company・pending・group_required・no_group・no_folder・folder_shelf・no_approver
--   ページの行を for update で読んでから決めるので、同じページを同時に頼んでも 1 つずつ通り 2 つ目は pending
create or replace function app.kn_raise_request(p_page uuid, p_group uuid, p_folder uuid, p_message text) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  pg_row record;
  v_me uuid := app.user_id();
  v_to uuid;
  v_name text;
  v_id uuid;
  v_from_name text;
  f record;
begin
  if not app.kpage_writable(p_page) then
    return jsonb_build_object('ok', false, 'reason', 'denied');
  end if;
  select p.id, p.title, p.state, p.scope_id, p.is_personal into pg_row from knowledge_pages p
   where p.id = p_page and p.tenant_id = app.tenant_id() and p.deleted_at is null
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'denied');
  end if;
  if pg_row.state <> 'published' then
    return jsonb_build_object('ok', false, 'reason', 'draft');
  end if;
  if not pg_row.is_personal and pg_row.scope_id = app.kn_company_scope() then
    return jsonb_build_object('ok', false, 'reason', 'company');
  end if;
  if exists (select 1 from knowledge_requests q
              where q.page_id = p_page and q.tenant_id = app.tenant_id() and q.state = 'pending' and q.deleted_at is null) then
    return jsonb_build_object('ok', false, 'reason', 'pending');
  end if;
  if pg_row.is_personal then
    if p_group is null then
      return jsonb_build_object('ok', false, 'reason', 'group_required');
    end if;
    if not exists (select 1 from scopes s
                    where s.id = p_group and s.tenant_id = app.tenant_id() and s.parent_id is not null and s.deleted_at is null)
       or not app.kn_shelf_readable(p_group, false, null) then
      return jsonb_build_object('ok', false, 'reason', 'no_group');
    end if;
    v_to := p_group;
  else
    v_to := app.kn_company_scope();
  end if;
  if p_folder is not null then
    if not app.kfolder_visible(p_folder) then
      return jsonb_build_object('ok', false, 'reason', 'no_folder');
    end if;
    select x.scope_id, x.is_personal into f from knowledge_folders x where x.id = p_folder;
    if f.scope_id <> v_to or f.is_personal then
      return jsonb_build_object('ok', false, 'reason', 'folder_shelf');
    end if;
  end if;
  v_name := app.kn_shelf_name(v_to, false);
  if app.kn_shelf_writable(v_to, false, null) then
    insert into knowledge_requests (tenant_id, kind, page_id, from_scope_id, from_is_personal, to_scope_id, to_folder_id,
                                    requested_by, message, state, decided_by, decided_at, created_by)
    values (app.tenant_id(), 'raise', p_page, pg_row.scope_id, pg_row.is_personal, v_to, p_folder,
            v_me, p_message, 'approved', v_me, now(), v_me)
    returning id into v_id;
    perform app.kn_apply_raise(v_id, v_me);
    return jsonb_build_object('ok', true, 'state', 'approved', 'id', v_id, 'to_name', v_name);
  end if;
  if not exists (select 1 from app.kn_approvers_of(v_to) a where a <> v_me) then
    return jsonb_build_object('ok', false, 'reason', 'no_approver');
  end if;
  begin
    insert into knowledge_requests (tenant_id, kind, page_id, from_scope_id, from_is_personal, to_scope_id, to_folder_id,
                                    requested_by, message, created_by)
    values (app.tenant_id(), 'raise', p_page, pg_row.scope_id, pg_row.is_personal, v_to, p_folder, v_me, p_message, v_me)
    returning id into v_id;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'pending');
  end;
  select m.display_name into v_from_name from members m where m.id = v_me;
  insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, dedupe_key, created_by)
    select app.tenant_id(), a, 'inapp', 'knowledge.raise_requested',
           jsonb_build_object('title', pg_row.title, 'page_id', p_page, 'request_id', v_id, 'from_name', v_from_name),
           'knowledge.raise_requested:' || v_id::text, v_me
      from app.kn_approvers_of(v_to) a
     where a <> v_me
       and not exists (select 1 from notifications o
                        where o.tenant_id = app.tenant_id() and o.member_id = a
                          and o.dedupe_key = 'knowledge.raise_requested:' || v_id::text);
  return jsonb_build_object('ok', true, 'state', 'pending', 'id', v_id, 'to_name', v_name);
end $$;

-- 頼みを終える：withdraw＝頼んだ人が承認待ちを取り下げる（その頼みのお知らせを全員分消す）／
--   dismiss＝頼んだ人が断られた頼みの帯を消す（その頼みの断りのお知らせを消す）。
--   答えは { ok: true, state } か { ok: false, reason: not_found | forbidden | decided | not_declined }
create or replace function app.kn_request_end(p_request uuid, p_action text) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  r record;
begin
  if not app.kn_request_visible(p_request) then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  select * into r from knowledge_requests
   where id = p_request and tenant_id = app.tenant_id() and deleted_at is null
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if r.requested_by <> app.user_id() then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;
  if p_action = 'withdraw' then
    if r.state <> 'pending' then
      return jsonb_build_object('ok', false, 'reason', 'decided');
    end if;
    update knowledge_requests set state = 'withdrawn', updated_by = app.user_id() where id = r.id;
    update notifications set deleted_at = now(), updated_by = app.user_id()
     where tenant_id = r.tenant_id and dedupe_key = 'knowledge.raise_requested:' || r.id::text and deleted_at is null;
    return jsonb_build_object('ok', true, 'state', 'withdrawn');
  end if;
  if p_action = 'dismiss' then
    if r.state <> 'declined' or r.dismissed_at is not null then
      return jsonb_build_object('ok', false, 'reason', 'not_declined');
    end if;
    update knowledge_requests set dismissed_at = now(), updated_by = app.user_id() where id = r.id;
    update notifications set deleted_at = now(), updated_by = app.user_id()
     where tenant_id = r.tenant_id and dedupe_key like 'knowledge.%\_declined:' || r.id::text and deleted_at is null;
    return jsonb_build_object('ok', true, 'state', 'declined');
  end if;
  return jsonb_build_object('ok', false, 'reason', 'not_found');
end $$;

revoke execute on function app.kn_approvers_of(uuid), app.kn_request_approver(uuid), app.kn_request_visible(uuid),
  app.kn_apply_raise(uuid, uuid), app.kn_raise_request(uuid, uuid, uuid, text), app.kn_request_end(uuid, text) from public;
grant execute on function app.kn_approvers_of(uuid), app.kn_request_approver(uuid), app.kn_request_visible(uuid),
  app.kn_apply_raise(uuid, uuid), app.kn_raise_request(uuid, uuid, uuid, text), app.kn_request_end(uuid, text) to kaname_app;
