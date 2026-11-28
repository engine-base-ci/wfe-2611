-- 20261127100700 ゲストが依頼を出す・自分のゲストのグループの依頼を読む（K-907・D-155.7・D-155.25・D-155.33・D-155.37・D-155.40・D-155.43・D-155.44・関門 C2・C6）
--   ① app.portal_request_create(本文, いつまでに, 添付)：1 つの取引で、依頼の行・添付の持ち主替え・証跡・届け先の人の受け箱の行を書く（どれかが落ちれば何も残らない）。
--      メールは口が取引の後に送る（関数は受け箱に入れた人の宛先を返すだけ）。60 秒以内の同じ人・同じ本文・同じ期限は前の依頼の id を返す（何も増やさない）。
--   ② app.portal_request_get(依頼)：自分のゲストのグループの依頼 1 件とやり取り（依頼の本文のあと、種類 message の行だけを古い順）。見えなければ null。
--   どちらも毎回その時の所属を app.guest_ok()（K-878）で見る（G-14）。表・列は足さない。方針は policies/20261127100700_portal_request.sql。

-- ---------------------------------------------------------------- 出す
create or replace function app.portal_request_create(p_body text, p_due date, p_attachments uuid[]) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_t uuid := app.tenant_id();
  v_me uuid := app.user_id();
  v_group uuid;
  v_scope uuid;
  v_atts uuid[] := coalesce(p_attachments, '{}'::uuid[]);
  v_want int;
  v_have int;
  v_title text;
  v_id uuid;
  v_targets uuid[];
  v_emails text[];
begin
  if not app.guest_ok() then
    raise exception 'ゲストでない' using errcode = '42501';
  end if;
  v_group := app.my_guest_group();
  if p_body is null or btrim(p_body, E' \t\r\n　') = '' or length(p_body) > 10000 then
    raise exception '本文の形' using errcode = '22023';
  end if;

  -- 二重に出す：同じ人の出す取引を 1 本ずつにしてから、60 秒以内の同じ物を探す
  perform pg_advisory_xact_lock(hashtextextended('portal_request:' || v_me::text, 0));
  select r.id into v_id
  from client_requests r
  where r.tenant_id = v_t and r.created_by = v_me and r.guest_group_id = v_group and r.deleted_at is null
    and r.body = p_body and r.due_on is not distinct from p_due
    and r.created_at > now() - interval '60 seconds'
  order by r.created_at desc
  limit 1;
  if v_id is not null then
    return jsonb_build_object('id', v_id, 'emails', '[]'::jsonb);
  end if;

  -- 添付：全部が本人の検査済みの下書きでなければ何も作らない（全部か無しか）
  select count(distinct x) into v_want from unnest(v_atts) x;
  select count(*) into v_have
  from (
    select a.id from attachments a
    where a.id = any(v_atts) and a.tenant_id = v_t
      and a.owner_type = 'portal_draft' and a.owner_id = v_me and a.created_by = v_me
      and a.scanned_at is not null and a.deleted_at is null
    for update
  ) ok;
  if v_have <> v_want then
    raise exception '付けられない添付' using errcode = 'P0002', hint = 'E-GST-160';
  end if;

  -- 題は本文の最初の空でない行（前後の空白を取って 60 字まで）
  select left(btrim(l, E' \t\r　'), 60) into v_title
  from regexp_split_to_table(p_body, E'\n') with ordinality as x(l, i)
  where btrim(l, E' \t\r　') <> ''
  order by i
  limit 1;

  insert into client_requests (tenant_id, guest_group_id, client_id, title, body, due_on, state, created_by, updated_by)
    values (v_t, v_group, null, v_title, p_body, p_due, 'new', v_me, v_me)
    returning id into v_id;

  if cardinality(v_atts) > 0 then
    update attachments set owner_type = 'client_request', owner_id = v_id, updated_by = v_me
      where id = any(v_atts) and tenant_id = v_t;
  end if;

  perform app.record_audit('portal.request_created', 'client_request', v_id::text, 'C2', jsonb_build_object('request_id', v_id));

  -- 届け先：ゲストのグループの届け先の社内のグループの人（消していない・active・ゲストでない）。居なければ会社の管理者
  select g.request_scope_id into v_scope from guest_groups g where g.id = v_group and g.tenant_id = v_t;
  select array_agg(distinct sm.member_id) into v_targets
  from scope_memberships sm
  join tenant_memberships tm on tm.tenant_id = sm.tenant_id and tm.member_id = sm.member_id
  join members m on m.id = sm.member_id and m.tenant_id = sm.tenant_id and m.deleted_at is null
  where sm.tenant_id = v_t and sm.scope_id = v_scope and sm.deleted_at is null
    and tm.deleted_at is null and tm.status = 'active' and tm.role <> 'requester'
    and sm.member_id <> v_me;
  if v_targets is null then
    select array_agg(distinct tm.member_id) into v_targets
    from tenant_memberships tm
    join members m on m.id = tm.member_id and m.tenant_id = tm.tenant_id and m.deleted_at is null
    where tm.tenant_id = v_t and tm.role = 'admin' and tm.status = 'active' and tm.deleted_at is null
      and tm.member_id <> v_me;
  end if;

  if v_targets is not null then
    insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, dedupe_key, created_by)
      select v_t, x, 'inapp', 'client_request.created',
             jsonb_build_object('request_id', v_id, 'url', '/requests/' || v_id),
             'client_request.created:' || v_id || ':' || x, v_me
      from unnest(v_targets) x;
    -- 宛先（人に認証の行が無ければ入らない）。kaname_auth は動的に読む（0067 の app.bridge_session_email と同じ形）
    execute 'select array_agg(u.email) from members m join kaname_auth."user" u on u.id = m.auth_user_id '
         || 'where m.id = any($1) and u.email is not null'
      into v_emails using v_targets;
  end if;

  return jsonb_build_object('id', v_id, 'emails', to_jsonb(coalesce(v_emails, '{}'::text[])));
end $$;

-- ---------------------------------------------------------------- 読む
create or replace function app.portal_request_get(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_t uuid := app.tenant_id();
  v_r client_requests%rowtype;
  v_from text;
  v_group text;
  v_state text;
  v_req jsonb;
  v_msgs jsonb;
begin
  if not app.guest_ok() then
    raise exception 'ゲストでない' using errcode = '42501';
  end if;
  select r.* into v_r from client_requests r
  where r.id = p_id and r.tenant_id = v_t and r.guest_group_id = app.my_guest_group() and r.deleted_at is null;
  if not found then
    return null;
  end if;
  select m.display_name into v_from from members m where m.id = v_r.created_by;
  select g.name into v_group from guest_groups g where g.id = v_r.guest_group_id;
  v_state := case v_r.state when 'ticketed' then 'accepted' when 'declined' then 'declined' else 'open' end;
  v_req := jsonb_build_object('id', v_r.id, 'title', v_r.title, 'from_name', v_from, 'group_name', v_group,
                              'created_at', v_r.created_at, 'state', v_state);
  if v_state = 'declined' then
    v_req := v_req || jsonb_build_object('declined_reason', v_r.decline_reason);
  end if;
  select coalesce(jsonb_agg(x.o order by x.at, x.id), '[]'::jsonb) into v_msgs
  from (
    select c.created_at as at, c.id,
           jsonb_build_object('id', c.id, 'side', case c.side when 'guest' then 'they' else 'we' end,
                              'name', m.display_name, 'at', c.created_at, 'text', c.body) as o
    from client_request_messages c
    left join members m on m.id = c.author_member_id
    where c.client_request_id = v_r.id and c.tenant_id = v_t and c.kind = 'message' and c.deleted_at is null
  ) x;
  return jsonb_build_object(
    'request', v_req,
    'messages', jsonb_build_array(jsonb_build_object('id', v_r.id, 'side', 'they', 'name', v_from,
                                                     'at', v_r.created_at, 'text', coalesce(v_r.body, v_r.title))) || v_msgs,
    'can_write', v_state = 'open');
end $$;

-- ---------------------------------------------------------------- 渡す（public から外し kaname_app にだけ）
revoke execute on function app.portal_request_create(text, date, uuid[]), app.portal_request_get(uuid) from public;
grant execute on function app.portal_request_create(text, date, uuid[]), app.portal_request_get(uuid) to kaname_app;
