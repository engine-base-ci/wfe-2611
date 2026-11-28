-- 20261125012900 グループを選んで共有：共有の置き場（K-689・契約の口 getKnowledgeShares・setKnowledgeShares・
--   D-152.6・D-152.27・D-152.34・関門 C2・C6）。名前の正本は 07_functional/段10-F9/土台-knowledge.md の 1.2・1.4 と 11_tickets/K-689.md
--   ① 表 knowledge_shares（元は 1 つ・共有先は読むだけ）② 部分一意・索引 ③ アプリの役は読むだけ（行の守りは同じ名前の policies・gen_rls.py が作る）
--   ④ 関数 6 つ：フォルダの鎖・見える関数 2 つ（K-674 の器の中身）・共有を当てる（K-688 の器の中身）・読む・頼む／やめる／取り下げる
--   行の守りと kpage_visible・kfolder_visible は作り直さない（土台 1.4）。同じ migration をもう 1 度当てても壊れない形にする

-- ---------------------------------------------------------------- ① 共有の表
create table if not exists knowledge_shares (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  page_id uuid references knowledge_pages(id),
  folder_id uuid references knowledge_folders(id),
  group_id uuid not null,                                                -- 見せる先のグループの scope
  request_id uuid references knowledge_requests(id),
  shared_by uuid not null references members(id),
  ended_at timestamptz,
  ended_by uuid references members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  constraint knowledge_shares_target check ((page_id is null) <> (folder_id is null))
);
drop trigger if exists knowledge_shares_updated_at on knowledge_shares;
create trigger knowledge_shares_updated_at before update on knowledge_shares for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------- ② 部分一意（同じ物・同じグループの生きている共有は 1 つだけ）・索引
create unique index if not exists knowledge_shares_live_uq on knowledge_shares (coalesce(page_id, folder_id), group_id)
  where ended_at is null and deleted_at is null;
create index if not exists knowledge_shares_group_idx on knowledge_shares (tenant_id, group_id) where ended_at is null;
create index if not exists knowledge_shares_page_idx on knowledge_shares (page_id);
create index if not exists knowledge_shares_folder_idx on knowledge_shares (folder_id);

-- ---------------------------------------------------------------- ③ 権限と行の守り（読むだけ・書けない）
grant select on knowledge_shares to kaname_app;
-- 既定の権限（0002 の alter default privileges）で付いた書く権限を外す。書く道は下の関数だけ（K689-DB-001）
revoke insert, update, delete, truncate on knowledge_shares from kaname_app;
alter table knowledge_shares enable row level security;
alter table knowledge_shares force row level security;

-- ---------------------------------------------------------------- ④ 関数
-- そのフォルダと上のフォルダ（深さ 6 まで・消したフォルダで止める）。空を渡したら 0 行
create or replace function app.kn_folder_chain(p_folder uuid) returns setof uuid
language sql stable security definer set search_path = public, app, pg_temp as $$
  with recursive up(id, parent, depth) as (
    select f.id, f.parent_folder_id, 1 from knowledge_folders f
     where f.id = p_folder and f.tenant_id = app.tenant_id() and f.deleted_at is null
    union all
    select f.id, f.parent_folder_id, up.depth + 1 from knowledge_folders f join up on f.id = up.parent
     where up.depth < 6 and f.tenant_id = app.tenant_id() and f.deleted_at is null
  )
  select id from up
$$;

-- 共有で見えるページ（K-674 の器の中身）：公開済み・消していない・今の会社で、生きている共有がページ自身か上のフォルダにあり、
--   その共有先が今の人の入っているグループ
create or replace function app.kn_shared_visible(pid uuid) returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select exists (
    select 1 from knowledge_pages p
      join knowledge_shares s on s.tenant_id = p.tenant_id and s.ended_at is null and s.deleted_at is null
       and (s.page_id = p.id or s.folder_id in (select app.kn_folder_chain(p.folder_id)))
     where p.id = pid and p.tenant_id = app.tenant_id() and p.deleted_at is null and p.state = 'published'
       and s.group_id = any ((select app.kn_my_groups())::uuid[]))
$$;

-- 共有で見えるフォルダ（K-674 の器の中身）：消していないフォルダで、生きている共有がそのフォルダか上のフォルダにあり、共有先が今の人のグループ
create or replace function app.kn_shared_folder_visible(fid uuid) returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select exists (
    select 1 from knowledge_shares s
     where s.tenant_id = app.tenant_id() and s.ended_at is null and s.deleted_at is null
       and s.folder_id in (select app.kn_folder_chain(fid))
       and s.group_id = any ((select app.kn_my_groups())::uuid[]))
$$;

-- 共有の頼みを当てる（K-688 の器の中身）：頼みの物と見せる先で共有の行を入れる。同じ物・同じグループの生きている共有があれば何もしない。
--   頼みの状態・お知らせは呼ぶ側が書く。会社の文脈が無くても頼みの会社で動く
create or replace function app.kn_apply_share(p_request uuid) returns void
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  r record;
begin
  select * into r from knowledge_requests where id = p_request and kind = 'share' and deleted_at is null;
  if not found then
    return;
  end if;
  insert into knowledge_shares (tenant_id, page_id, folder_id, group_id, request_id, shared_by, created_by)
  values (r.tenant_id, r.page_id, r.folder_id, r.to_scope_id, r.id, r.requested_by, r.requested_by)
  on conflict do nothing;
end $$;

-- 指した物（ページかフォルダのどちらか 1 つ）を読む：見えなければ 0 行。フォルダの state は 'published' として返す
create or replace function app.kn_share_target(p_page uuid, p_folder uuid)
returns table (title text, scope_id uuid, is_personal boolean, state text, writable boolean)
language sql stable security definer set search_path = public, app, pg_temp as $$
  select p.title, p.scope_id, p.is_personal, p.state, app.kpage_writable(p.id)
    from knowledge_pages p
   where p_folder is null and p.id = p_page and p.tenant_id = app.tenant_id() and p.deleted_at is null and app.kpage_visible(p.id)
  union all
  select f.name, f.scope_id, f.is_personal, 'published', app.kfolder_writable(f.id)
    from knowledge_folders f
   where p_page is null and f.id = p_folder and f.tenant_id = app.tenant_id() and f.deleted_at is null and app.kfolder_visible(f.id)
$$;

-- 今の人が、その物の生きている共有を受けているグループのマネージャー
create or replace function app.kn_share_receiver(p_page uuid, p_folder uuid) returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select exists (
    select 1 from knowledge_shares s
     where s.tenant_id = app.tenant_id() and s.ended_at is null and s.deleted_at is null
       and coalesce(s.page_id, s.folder_id) = coalesce(p_page, p_folder)
       and app.kn_group_manager(app.user_id(), s.group_id))
$$;

-- 共有の選びを読む。答えは { ok: false, reason: not_found | denied } ／ { ok: true, target, from_group_name, groups }
create or replace function app.kn_share_view(p_page uuid, p_folder uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  t record;
  v_obj uuid := coalesce(p_page, p_folder);
  v_groups jsonb;
begin
  if (p_page is null) = (p_folder is null) then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  select * into t from app.kn_share_target(p_page, p_folder);
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if not t.writable and not app.kn_share_receiver(p_page, p_folder) then
    return jsonb_build_object('ok', false, 'reason', 'denied');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'group_id', g.id, 'name', g.name, 'manager_name', g.manager_name,
           'checked', g.st in ('shared', 'waiting'), 'state', g.st) order by g.name collate "C", g.id), '[]'::jsonb)
    into v_groups
    from (
      select s.id, s.name,
             coalesce((select string_agg(m.display_name, '・' order by m.display_name collate "C")
                         from app.kn_approvers_of(s.id) a join members m on m.id = a), '') as manager_name,
             case
               when exists (select 1 from knowledge_shares x
                             where x.tenant_id = app.tenant_id() and x.group_id = s.id and x.ended_at is null and x.deleted_at is null
                               and coalesce(x.page_id, x.folder_id) = v_obj) then 'shared'
               when exists (select 1 from knowledge_requests q
                             where q.tenant_id = app.tenant_id() and q.kind = 'share' and q.to_scope_id = s.id
                               and q.state = 'pending' and q.deleted_at is null and coalesce(q.page_id, q.folder_id) = v_obj) then 'waiting'
               when (select q.state = 'declined' and q.dismissed_at is null from knowledge_requests q
                      where q.tenant_id = app.tenant_id() and q.kind = 'share' and q.to_scope_id = s.id
                        and q.deleted_at is null and coalesce(q.page_id, q.folder_id) = v_obj
                      order by q.created_at desc, q.id desc limit 1) then 'declined'
               else null
             end as st
        from scopes s
       where s.tenant_id = app.tenant_id() and s.parent_id is not null and s.deleted_at is null and s.id <> t.scope_id
    ) g;
  return jsonb_build_object('ok', true,
    'target', jsonb_build_object('page_id', p_page, 'folder_id', p_folder, 'title', t.title),
    'from_group_name', app.kn_shelf_name(t.scope_id, t.is_personal),
    'groups', v_groups);
end $$;

-- 受け箱の行を書く（同じ人に同じ dedupe_key は 1 つ・メールは出さない）
create or replace function app.kn_share_notify(p_to uuid[], p_kind text, p_payload jsonb, p_key text) returns void
language plpgsql security definer set search_path = public, app, pg_temp as $$
begin
  if p_kind = 'knowledge.share_requested' then
    insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, dedupe_key, created_by)
      select app.tenant_id(), a, 'inapp', 'knowledge.share_requested', p_payload, p_key, app.user_id()
        from unnest(p_to) a
       where a <> app.user_id()
         and not exists (select 1 from notifications o where o.tenant_id = app.tenant_id() and o.member_id = a and o.dedupe_key = p_key);
  elsif p_kind = 'knowledge.share_ended' then
    insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, dedupe_key, created_by)
      select app.tenant_id(), a, 'inapp', 'knowledge.share_ended', p_payload, p_key, app.user_id()
        from unnest(p_to) a
       where a <> app.user_id()
         and not exists (select 1 from notifications o where o.tenant_id = app.tenant_id() and o.member_id = a and o.dedupe_key = p_key);
  end if;
end $$;

-- 共有を頼む・やめる・取り下げる（送った後の選びの全部）。答えは
--   { ok: true, requested, shared, ended, withdrawn, request_ids, shared_ids, ended_ids, withdrawn_ids } ／ { ok: false, reason }
--   reason：not_found・denied・draft・not_group_shelf・pending・own_group・no_group・no_approver。断る前に何も書かない
create or replace function app.kn_share_set(p_page uuid, p_folder uuid, p_groups uuid[], p_message text) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  t record;
  v_me uuid := app.user_id();
  v_obj uuid := coalesce(p_page, p_folder);
  v_groups uuid[] := '{}';
  v_live uuid[];
  v_wait uuid[];
  v_add uuid[];
  v_end uuid[];
  v_wd uuid[];
  g uuid;
  v_id uuid;
  v_sid uuid;
  v_from text;
  v_by text;
  v_req uuid[] := '{}';
  v_shared uuid[] := '{}';
  v_ended uuid[] := '{}';
  v_withdrawn uuid[] := '{}';
  s record;
begin
  if (p_page is null) = (p_folder is null) then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  -- 物の行を錠で押さえてから決める（同じ物を同時に頼んでも 1 つずつ通る）
  if p_page is not null then
    perform 1 from knowledge_pages where id = p_page and tenant_id = app.tenant_id() and deleted_at is null for update;
  else
    perform 1 from knowledge_folders where id = p_folder and tenant_id = app.tenant_id() and deleted_at is null for update;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('knowledge_share:' || coalesce(v_obj::text, ''), 0));
  select * into t from app.kn_share_target(p_page, p_folder);
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  -- 重なりを除き、送った順を保つ
  select coalesce(array_agg(x order by n), '{}') into v_groups
    from (select x, min(n) as n from unnest(coalesce(p_groups, '{}'::uuid[])) with ordinality u(x, n) group by x) d;
  select coalesce(array_agg(x.group_id), '{}') into v_live from knowledge_shares x
   where x.tenant_id = app.tenant_id() and x.ended_at is null and x.deleted_at is null and coalesce(x.page_id, x.folder_id) = v_obj;
  select coalesce(array_agg(q.to_scope_id), '{}') into v_wait from knowledge_requests q
   where q.tenant_id = app.tenant_id() and q.kind = 'share' and q.state = 'pending' and q.deleted_at is null
     and coalesce(q.page_id, q.folder_id) = v_obj;
  select coalesce(array_agg(x), '{}') into v_add from unnest(v_groups) x where not x = any (v_live) and not x = any (v_wait);
  select coalesce(array_agg(x), '{}') into v_end from unnest(v_live) x where not x = any (v_groups);
  select coalesce(array_agg(x), '{}') into v_wd from unnest(v_wait) x where not x = any (v_groups);

  if not t.writable then
    -- 共有を受けているグループのマネージャー：自分が管理するグループの生きている共有を外すだけ
    if not app.kn_share_receiver(p_page, p_folder) then
      return jsonb_build_object('ok', false, 'reason', 'denied');
    end if;
    if cardinality(v_add) > 0 or cardinality(v_wd) > 0 then
      return jsonb_build_object('ok', false, 'reason', 'denied');
    end if;
    foreach g in array v_end loop
      if not app.kn_group_manager(v_me, g) then
        return jsonb_build_object('ok', false, 'reason', 'denied');
      end if;
    end loop;
    foreach g in array v_end loop
      update knowledge_shares set ended_at = now(), ended_by = v_me, updated_by = v_me
       where tenant_id = app.tenant_id() and group_id = g and ended_at is null and deleted_at is null
         and coalesce(page_id, folder_id) = v_obj
       returning id into v_sid;
      v_ended := v_ended || v_sid;
      perform app.kn_share_notify(array(select app.kn_approvers_of(t.scope_id)), 'knowledge.share_ended',
        jsonb_build_object('title', t.title, 'page_id', p_page, 'share_id', v_sid, 'from_name', app.kn_shelf_name(g, false)),
        'knowledge.share_ended:' || v_sid::text);
    end loop;
    return jsonb_build_object('ok', true, 'requested', 0, 'shared', 0, 'ended', cardinality(v_ended), 'withdrawn', 0,
      'request_ids', '[]'::jsonb, 'shared_ids', '[]'::jsonb, 'ended_ids', to_jsonb(v_ended), 'withdrawn_ids', '[]'::jsonb);
  end if;

  -- 元を書ける人
  if t.state <> 'published' then
    return jsonb_build_object('ok', false, 'reason', 'draft');
  end if;
  if app.kn_shelf_kind(t.scope_id, t.is_personal) <> 'group' then
    return jsonb_build_object('ok', false, 'reason', 'not_group_shelf');
  end if;
  if p_page is not null and exists (select 1 from knowledge_requests q
              where q.page_id = p_page and q.tenant_id = app.tenant_id() and q.kind = 'raise' and q.state = 'pending' and q.deleted_at is null) then
    return jsonb_build_object('ok', false, 'reason', 'pending');
  end if;
  foreach g in array v_groups loop
    if g = t.scope_id then
      return jsonb_build_object('ok', false, 'reason', 'own_group');
    end if;
    if not exists (select 1 from scopes x where x.id = g and x.tenant_id = app.tenant_id() and x.parent_id is not null and x.deleted_at is null) then
      return jsonb_build_object('ok', false, 'reason', 'no_group');
    end if;
  end loop;
  foreach g in array v_add loop
    if not app.kn_group_manager(v_me, g) and not exists (select 1 from app.kn_approvers_of(g) a where a <> v_me) then
      return jsonb_build_object('ok', false, 'reason', 'no_approver');
    end if;
  end loop;

  v_from := app.kn_shelf_name(t.scope_id, t.is_personal);
  select m.display_name into v_by from members m where m.id = v_me;
  foreach g in array v_add loop
    if app.kn_group_manager(v_me, g) then
      insert into knowledge_requests (tenant_id, kind, page_id, folder_id, from_scope_id, from_is_personal, to_scope_id,
                                      requested_by, message, state, decided_by, decided_at, created_by)
      values (app.tenant_id(), 'share', p_page, p_folder, t.scope_id, t.is_personal, g, v_me, p_message, 'approved', v_me, now(), v_me)
      returning id into v_id;
      perform app.kn_apply_share(v_id);
      select x.id into v_sid from knowledge_shares x where x.request_id = v_id and x.ended_at is null;
      if v_sid is not null then
        v_shared := v_shared || v_sid;
      end if;
    else
      begin
        insert into knowledge_requests (tenant_id, kind, page_id, folder_id, from_scope_id, from_is_personal, to_scope_id,
                                        requested_by, message, created_by)
        values (app.tenant_id(), 'share', p_page, p_folder, t.scope_id, t.is_personal, g, v_me, p_message, v_me)
        returning id into v_id;
      exception when unique_violation then
        continue;   -- 同時に同じ頼み（競り負け）：もう承認待ち
      end;
      v_req := v_req || v_id;
      perform app.kn_share_notify(array(select app.kn_approvers_of(g)), 'knowledge.share_requested',
        jsonb_build_object('title', t.title, 'page_id', p_page, 'request_id', v_id, 'from_name', v_from || '（' || coalesce(v_by, '') || '）'),
        'knowledge.share_requested:' || v_id::text);
    end if;
  end loop;
  foreach g in array v_end loop
    update knowledge_shares set ended_at = now(), ended_by = v_me, updated_by = v_me
     where tenant_id = app.tenant_id() and group_id = g and ended_at is null and deleted_at is null
       and coalesce(page_id, folder_id) = v_obj
     returning id into v_sid;
    v_ended := v_ended || v_sid;
    perform app.kn_share_notify(array(select app.kn_approvers_of(g)), 'knowledge.share_ended',
      jsonb_build_object('title', t.title, 'page_id', p_page, 'share_id', v_sid, 'from_name', v_from),
      'knowledge.share_ended:' || v_sid::text);
  end loop;
  for s in select q.id from knowledge_requests q
            where q.tenant_id = app.tenant_id() and q.kind = 'share' and q.state = 'pending' and q.deleted_at is null
              and coalesce(q.page_id, q.folder_id) = v_obj and q.to_scope_id = any (v_wd)
            order by q.created_at, q.id loop
    update knowledge_requests set state = 'withdrawn', updated_by = v_me where id = s.id;
    update notifications set deleted_at = now(), updated_by = v_me
     where tenant_id = app.tenant_id() and dedupe_key = 'knowledge.share_requested:' || s.id::text and deleted_at is null;
    v_withdrawn := v_withdrawn || s.id;
  end loop;
  return jsonb_build_object('ok', true, 'requested', cardinality(v_req), 'shared', cardinality(v_shared),
    'ended', cardinality(v_ended), 'withdrawn', cardinality(v_withdrawn),
    'request_ids', to_jsonb(v_req), 'shared_ids', to_jsonb(v_shared), 'ended_ids', to_jsonb(v_ended), 'withdrawn_ids', to_jsonb(v_withdrawn));
end $$;

revoke execute on function app.kn_folder_chain(uuid), app.kn_shared_visible(uuid), app.kn_shared_folder_visible(uuid),
  app.kn_apply_share(uuid), app.kn_share_target(uuid, uuid), app.kn_share_receiver(uuid, uuid), app.kn_share_view(uuid, uuid),
  app.kn_share_notify(uuid[], text, jsonb, text), app.kn_share_set(uuid, uuid, uuid[], text) from public;
grant execute on function app.kn_folder_chain(uuid), app.kn_shared_visible(uuid), app.kn_shared_folder_visible(uuid),
  app.kn_share_target(uuid, uuid), app.kn_share_receiver(uuid, uuid), app.kn_share_view(uuid, uuid),
  app.kn_share_set(uuid, uuid, uuid[], text) to kaname_app;
