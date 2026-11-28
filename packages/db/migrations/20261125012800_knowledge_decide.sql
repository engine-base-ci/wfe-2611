-- 20261125012800_knowledge_decide 承認待ちを読む・承認する・断る（K-688・契約の口 listKnowledgeApprovals・approveKnowledgeRequest・
--   declineKnowledgeRequest・関門 C2・C6・D-152.2・D-152.13・D-152.26）。表は作らない（K-687 の knowledge_requests を使う）。
--   関数 5 つ：app.kn_can_approve（今の人が承認できる人か）・app.kn_approval_rows（今の人が承認する承認待ち・新しい順に 50 行・
--   承認する人が読めない棚のページでも本文を渡す）・app.kn_apply_share（共有の承認の器・K-689 が中身を入れる）・
--   app.kn_request_decide（承認する・断る：確かめ → 移す → 頼みの状態 → 頼まれたお知らせを消す → 頼んだ人へのお知らせ）。
--   どれも security definer・search_path に pg_temp・public から外し kaname_app に渡す（D-128.171）。メールは出さない

-- ---------------------------------------------------------------- ① 今の人が承認できる人か（管理者か、どれかのグループのマネージャー・有効なメンバー）
create or replace function app.kn_can_approve() returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select coalesce(
    app.tenant_id() is not null and app.user_id() is not null
    and exists (select 1 from members m where m.id = app.user_id() and m.tenant_id = app.tenant_id() and m.deleted_at is null)
    and (exists (select 1 from tenant_memberships tm
                  where tm.tenant_id = app.tenant_id() and tm.member_id = app.user_id()
                    and tm.role = 'admin' and tm.status = 'active' and tm.deleted_at is null)
         or exists (select 1 from scope_memberships sm
                     join scopes s on s.id = sm.scope_id and s.tenant_id = sm.tenant_id
                    where sm.tenant_id = app.tenant_id() and sm.member_id = app.user_id()
                      and sm.role = 'manager' and sm.deleted_at is null
                      and s.parent_id is not null and s.deleted_at is null
                      and app.kn_group_manager(sm.member_id, sm.scope_id))),
    false)
$$;

-- ---------------------------------------------------------------- ② 今の人が承認する承認待ち（新しい順・50 行）
--   消したページ・消したフォルダの頼みは除く。body はページの公開済みの最新の版の本文（フォルダ・公開の版が無ければ null）
create or replace function app.kn_approval_rows()
returns table (id uuid, kind text, from_name text, from_shelf_name text, to_shelf_name text, title text, summary text,
               message text, requested_at timestamptz, page_id uuid, folder_id uuid, body jsonb)
language sql stable security definer set search_path = public, app, pg_temp as $$
  select r.id, r.kind,
         case when r.kind = 'share' then fs.name || '（' || m.display_name || '）' else m.display_name end,
         case when r.from_is_personal then m.display_name || 'さんの「自分」' else fs.name end,
         case when r.kind = 'share' then ts.name || 'にも見せる' else app.kn_shelf_name(r.to_scope_id, false) end,
         coalesce(p.title, f.name),
         case when p.id is not null then coalesce(p.summary, '') else '' end,
         r.message, r.created_at, r.page_id, r.folder_id,
         (select v.body from knowledge_page_versions v
           where p.id is not null and v.page_id = p.id and v.tenant_id = r.tenant_id
             and v.kind = 'published' and v.deleted_at is null
           order by v.version desc limit 1)
    from knowledge_requests r
    join members m on m.id = r.requested_by
    left join scopes fs on fs.id = r.from_scope_id
    left join scopes ts on ts.id = r.to_scope_id
    left join knowledge_pages p on p.id = r.page_id and p.tenant_id = r.tenant_id
    left join knowledge_folders f on f.id = r.folder_id and f.tenant_id = r.tenant_id
   where r.tenant_id = app.tenant_id() and r.state = 'pending' and r.deleted_at is null
     and (r.page_id is null or (p.id is not null and p.deleted_at is null))
     and (r.folder_id is null or (f.id is not null and f.deleted_at is null))
     and app.kn_request_approver(r.id)
   order by r.created_at desc, r.id desc
   limit 50
$$;

-- ---------------------------------------------------------------- ③ 共有の承認の器（中身が無い。K-689 が create or replace で中身を入れる）
create or replace function app.kn_apply_share(p_request uuid) returns void
language plpgsql security definer set search_path = public, app, pg_temp as $$
begin
  raise exception 'KNW_SHARE_NOT_READY' using errcode = '0A000';
end $$;

-- ---------------------------------------------------------------- ④ 承認する・断る
--   答えは { ok: true, state, kind, page_id, folder_id } か { ok: false, reason }。
--   reason：not_found（見えない）・forbidden（承認する人でない）・reason_required（断る理由が空）・decided（もう決まった）・
--   requester_gone（自分の棚のページを上げる頼みで、頼んだ人が先のグループにもういない）。確かめで断るときは何も書かない
create or replace function app.kn_request_decide(p_request uuid, p_action text, p_reason text) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  r knowledge_requests%rowtype;
  v_me uuid := app.user_id();
  v_reason text;
  v_state text;
  v_title text;
  v_folder uuid;
  v_name text;
  v_payload jsonb;
begin
  if p_request is null or not app.kn_request_visible(p_request) then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  -- 同じ頼みを同時に決める・取り下げる 2 本は頼みの行で待ち合わせる（後の 1 本は決まった後の行を見る）
  select * into r from knowledge_requests
   where id = p_request and tenant_id = app.tenant_id() and deleted_at is null
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if not app.kn_request_approver(r.id) then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;
  if p_action is null or p_action not in ('approve', 'decline') then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if p_action = 'decline' then
    v_reason := btrim(coalesce(p_reason, ''), E' \t\r\n　');
    if v_reason = '' then
      return jsonb_build_object('ok', false, 'reason', 'reason_required');
    end if;
  end if;
  if r.state <> 'pending' then
    return jsonb_build_object('ok', false, 'reason', 'decided');
  end if;
  if p_action = 'approve' and r.kind = 'raise' and r.from_is_personal
     and not app.kn_in_group(r.requested_by, r.to_scope_id) then
    return jsonb_build_object('ok', false, 'reason', 'requester_gone');
  end if;

  if p_action = 'approve' then
    if r.kind = 'raise' then
      perform app.kn_apply_raise(r.id, v_me);
    else
      perform app.kn_apply_share(r.id);
    end if;
    v_state := 'approved';
  else
    v_state := 'declined';
  end if;

  update knowledge_requests
     set state = v_state, decided_by = v_me, decided_at = now(),
         decline_reason = case when v_state = 'declined' then v_reason else decline_reason end,
         updated_by = v_me
   where id = r.id;

  -- もう要らない「頼まれた」お知らせを全員分消す
  update notifications set deleted_at = now(), updated_by = v_me
   where tenant_id = r.tenant_id and dedupe_key = 'knowledge.' || r.kind || '_requested:' || r.id::text and deleted_at is null;

  if r.page_id is not null then
    select p.title, p.folder_id into v_title, v_folder from knowledge_pages p where p.id = r.page_id;
  else
    select f.name into v_title from knowledge_folders f where f.id = r.folder_id;
  end if;
  select m.display_name into v_name from members m where m.id = v_me;

  -- 頼んだ人（今のメンバーのとき）に受け箱の 1 行。種類は 'inapp', 'knowledge.raise_approved' などの字（K461-API-016 が照らす）
  if exists (select 1 from members m where m.id = r.requested_by and m.tenant_id = r.tenant_id and m.deleted_at is null) then
    v_payload := jsonb_build_object('title', v_title, 'page_id', r.page_id, 'request_id', r.id, 'from_name', v_name);
    if v_state = 'declined' then
      v_payload := v_payload || jsonb_build_object('reason', v_reason);
    end if;
    insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, dedupe_key, created_by)
    select r.tenant_id, r.requested_by, k.channel, k.event_kind, v_payload,
           'knowledge.' || r.kind || '_' || v_state || ':' || r.id::text, v_me
      from (values ('raise', 'approved', 'inapp', 'knowledge.raise_approved'),
                   ('raise', 'declined', 'inapp', 'knowledge.raise_declined'),
                   ('share', 'approved', 'inapp', 'knowledge.share_approved'),
                   ('share', 'declined', 'inapp', 'knowledge.share_declined')) as k(req_kind, req_state, channel, event_kind)
     where k.req_kind = r.kind and k.req_state = v_state;
  end if;

  return jsonb_build_object('ok', true, 'state', v_state, 'kind', r.kind, 'page_id', r.page_id,
                            'folder_id', case when r.kind = 'raise' and v_state = 'approved' then v_folder else r.folder_id end);
end $$;

revoke execute on function app.kn_can_approve(), app.kn_approval_rows(), app.kn_apply_share(uuid),
  app.kn_request_decide(uuid, text, text) from public;
grant execute on function app.kn_can_approve(), app.kn_approval_rows(), app.kn_apply_share(uuid),
  app.kn_request_decide(uuid, text, text) to kaname_app;
