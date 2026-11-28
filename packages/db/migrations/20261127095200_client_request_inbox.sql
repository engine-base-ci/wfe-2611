-- 20261127095200 届いた依頼の置き場と読む関数（K-892・K-71 の葉・D-155.7・D-155.40・D-155.43・D-128.101・関門 C2）
--   ゲストのグループの依頼（client_requests.guest_group_id・K-878）を、届け先の社内のグループが見える人が読めるようにする。
--   書く口（K-893〜K-895）・案を作る仕事（K-896・K-897）・ゲストの口（K-907・K-908）は、ここで作る表・列・関数を使う。
--   どの関数も呼んだ人を app.user_id() で引き、引数で人を受けない。security definer・search_path に pg_temp・public から外す。
--
-- ① client_request_messages：依頼のやり取り（最初の本文は依頼の行の body・ここには 2 つ目から）。会話の表には置かない（D-155.7）
-- ② client_requests の案の列：draft・draft_state（pending・ready・failed）・draft_job_id・draft_at（書くのは K-896・K-897）
-- ③ 届け先・見える・直せる・届け先にできるグループ（方針の式から呼ぶので kaname_app に渡す）
-- ④ 一覧と 1 件（口が呼ぶ・kaname_app）
-- ⑤ 依頼の出し手へのお知らせ（中だけ・誰にも execute を渡さない・D-128.171）

-- ① やり取り
create table if not exists client_request_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  client_request_id uuid not null references client_requests(id),
  side text not null check (side in ('guest', 'company')),                 -- ゲストが書いた・社内が返した
  kind text not null default 'message' check (kind in ('message', 'attachment')),
  body text,
  author_member_id uuid not null references members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  check (kind <> 'message' or coalesce(length(btrim(body)), 0) >= 1)
);
create index if not exists client_request_messages_request_idx on client_request_messages (client_request_id, created_at, id);

-- 依頼と書いた人は行の会社と同じ（違えば 22023）
create or replace function app.client_request_message_same_tenant() returns trigger
language plpgsql security definer set search_path = public, app, pg_temp as $$
begin
  if not exists (select 1 from client_requests where id = new.client_request_id and tenant_id = new.tenant_id) then
    raise exception '依頼は同じ会社のもの' using errcode = '22023';
  end if;
  if not exists (select 1 from members where id = new.author_member_id and tenant_id = new.tenant_id) then
    raise exception '書いた人は同じ会社の人' using errcode = '22023';
  end if;
  return new;
end $$;
revoke all on function app.client_request_message_same_tenant() from public;
drop trigger if exists client_request_messages_same_tenant on client_request_messages;
create trigger client_request_messages_same_tenant before insert or update on client_request_messages
  for each row execute function app.client_request_message_same_tenant();
drop trigger if exists client_request_messages_updated_at on client_request_messages;
create trigger client_request_messages_updated_at before update on client_request_messages
  for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('client_request_messages', 'client_request_messages') on conflict do nothing;

-- ② 案の列
alter table client_requests
  add column if not exists draft jsonb,
  add column if not exists draft_state text check (draft_state in ('pending', 'ready', 'failed')),
  add column if not exists draft_job_id uuid,
  add column if not exists draft_at timestamptz;
create index if not exists client_requests_guest_group_idx on client_requests (tenant_id, guest_group_id, state);

-- ③ 届け先：直した届け先があればそれ、無ければゲストのグループの届け先。そのグループが消えていれば null
create or replace function app.client_request_route(p_req uuid) returns uuid
language sql stable security definer set search_path = public, app, pg_temp as $$
  select s.id
    from client_requests r
    left join guest_groups g on g.id = r.guest_group_id and g.tenant_id = r.tenant_id
    join scopes s on s.id = coalesce(r.routed_scope_id, g.request_scope_id) and s.tenant_id = r.tenant_id and s.deleted_at is null
   where r.id = p_req and r.tenant_id = app.tenant_id()
$$;
revoke all on function app.client_request_route(uuid) from public;
grant execute on function app.client_request_route(uuid) to kaname_app;

-- 見える：ゲストのグループの依頼（消していない・この会社）で、届け先が見える人か、会社全体の edit を持つ人（届け先が無い依頼はこの人だけ）
create or replace function app.client_request_visible(p_req uuid) returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select exists (
    select 1 from client_requests r
     where r.id = p_req and r.tenant_id = app.tenant_id() and r.guest_group_id is not null and r.deleted_at is null
       and (has_permission(app.user_id(), 'client_requests', null, 'edit')
            or app.client_request_route(r.id) = any(visible_scopes(app.user_id()))))
$$;
revoke all on function app.client_request_visible(uuid) from public;
grant execute on function app.client_request_visible(uuid) to kaname_app;

-- 直せる：見えて、届け先で client_requests を edit できる人（届け先が無ければ会社全体の edit）
create or replace function app.client_request_actable(p_req uuid) returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select app.client_request_visible(p_req)
     and has_permission(app.user_id(), 'client_requests', app.client_request_route(p_req), 'edit')
$$;
revoke all on function app.client_request_actable(uuid) from public;
grant execute on function app.client_request_actable(uuid) to kaname_app;

-- 届け先にできるグループ：この会社の消していないグループで、見ている人が client_requests を edit できる物を名前の順（K-893 の入力の確かめも同じ）
create or replace function app.client_request_routes() returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name) order by s.name, s.id), '[]'::jsonb)
    from scopes s
   where s.tenant_id = app.tenant_id() and s.deleted_at is null
     and has_permission(app.user_id(), 'client_requests', s.id, 'edit')
$$;
revoke all on function app.client_request_routes() from public;
grant execute on function app.client_request_routes() to kaname_app;

-- ④ 一覧の 1 件（中だけ）：状態は new・asking のまま、ticketed・declined は done と札。届け先が無ければ route_name の鍵ごと省く
create or replace function app.client_request_item(p_req uuid) returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  select jsonb_build_object(
           'id', r.id, 'title', r.title,
           'from_name', coalesce(m.display_name, ''),
           'group_name', coalesce(g.name, ''),
           'created_at', r.created_at,
           'state', case when r.state in ('new', 'asking') then r.state else 'done' end)
      || case when s.id is not null then jsonb_build_object('route_name', s.name) else '{}'::jsonb end
      || case r.state when 'ticketed' then jsonb_build_object('tag', 'チケットにした')
                      when 'declined' then jsonb_build_object('tag', '断った') else '{}'::jsonb end
    from client_requests r
    left join members m on m.id = r.created_by
    left join guest_groups g on g.id = r.guest_group_id
    left join scopes s on s.id = app.client_request_route(r.id)
   where r.id = p_req
$$;
revoke all on function app.client_request_item(uuid) from public;

-- 一覧：p_state は live（新しい・聞いている）・done（チケットにした・断った）・null（両方）。
--   新しい物を created_at の新しい順、続けてさばいた物を updated_at の新しい順に 50 件まで。counts.live は見える新しい物・聞いている物の数
create or replace function app.client_request_list(p_state text) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare v_tenant uuid := app.tenant_id(); v_live jsonb; v_done jsonb; v_count integer;
begin
  if v_tenant is null or app.user_id() is null then return jsonb_build_object('items', '[]'::jsonb, 'counts', jsonb_build_object('live', 0)); end if;
  select coalesce(jsonb_agg(app.client_request_item(x.id) order by x.created_at desc, x.id), '[]'::jsonb), count(*)
    into v_live, v_count
    from (select r.id, r.created_at from client_requests r
           where r.tenant_id = v_tenant and r.guest_group_id is not null and r.deleted_at is null
             and r.state in ('new', 'asking') and app.client_request_visible(r.id)) x;
  select coalesce(jsonb_agg(app.client_request_item(x.id) order by x.updated_at desc, x.id), '[]'::jsonb)
    into v_done
    from (select r.id, r.updated_at from client_requests r
           where r.tenant_id = v_tenant and r.guest_group_id is not null and r.deleted_at is null
             and r.state in ('ticketed', 'declined') and app.client_request_visible(r.id)
           order by r.updated_at desc, r.id limit 50) x;
  return jsonb_build_object(
    'items', case p_state when 'live' then v_live when 'done' then v_done else v_live || v_done end,
    'counts', jsonb_build_object('live', v_count));
end $$;
revoke all on function app.client_request_list(text) from public;
grant execute on function app.client_request_list(text) to kaname_app;

-- 1 件：見えなければ null（口は 404・E-GST-100）。読むだけで書き換えない（既読の印も updated_at も変えない）
create or replace function app.client_request_get(p_req uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare r client_requests%rowtype; v_item jsonb; v_messages jsonb; v_ready boolean;
begin
  if p_req is null or not app.client_request_visible(p_req) then return null; end if;
  select * into r from client_requests where id = p_req;
  v_item := app.client_request_item(p_req);
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', x.id, 'side', case x.side when 'guest' then 'they' else 'we' end,
           'name', coalesce(m.display_name, ''), 'at', x.created_at, 'text', x.body) order by x.created_at, x.id), '[]'::jsonb)
    into v_messages
    from client_request_messages x
    left join members m on m.id = x.author_member_id
   where x.client_request_id = p_req and x.tenant_id = r.tenant_id and x.deleted_at is null;
  v_ready := r.draft_state = 'ready';
  return jsonb_build_object(
    'request', (v_item - 'tag')
               || jsonb_build_object('body', r.body)
               || case when r.ticket_id is not null then jsonb_build_object('ticket_id', r.ticket_id) else '{}'::jsonb end
               || case when r.decline_reason is not null then jsonb_build_object('declined_reason', r.decline_reason) else '{}'::jsonb end,
    'messages', v_messages,
    'routes', app.client_request_routes(),
    'can_act', app.client_request_actable(p_req),
    'pc_connected', app.account_pc_live(app.user_id()),
    'ticket_draft', case when v_ready then r.draft->'ticket' end,
    'reply_draft', case when v_ready then r.draft->'reply' end,
    'route_suggestion', case when v_ready then r.draft->'route' end,
    'questions', coalesce(r.questions, '[]'::jsonb));
end $$;
revoke all on function app.client_request_get(uuid) from public;
grant execute on function app.client_request_get(uuid) to kaname_app;

-- ⑤ 依頼の出し手へのお知らせ（中だけ・K-893・K-895 の security definer の関数の中から呼ぶ・誰にも execute を渡さない）
--   出し手（created_by）が今も会社に居て・止めていない・役割ゲストで・依頼のグループに入っているときだけ、受け箱に 1 件入れて
--   { member_id, email, notification_id } を返す（宛先が無ければ null）。メールは送らない（送るのは呼んだ口）
create or replace function app.client_request_notify_author(p_req uuid, p_kind text, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare r client_requests%rowtype; v_member uuid; v_email text; v_id uuid; v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
begin
  select * into r from client_requests where id = p_req and deleted_at is null;
  if r.id is null or r.guest_group_id is null or r.created_by is null then return null; end if;
  select m.id into v_member
    from members m
    join tenant_memberships tm on tm.member_id = m.id and tm.tenant_id = r.tenant_id and tm.role = 'requester' and tm.status = 'active'
    join guest_group_members gm on gm.member_id = m.id and gm.tenant_id = r.tenant_id and gm.guest_group_id = r.guest_group_id and gm.deleted_at is null
   where m.id = r.created_by and m.tenant_id = r.tenant_id and m.deleted_at is null
   limit 1;
  if v_member is null then return null; end if;
  insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, dedupe_key, sent_at, created_by)
    values (r.tenant_id, v_member, 'inapp', p_kind, jsonb_build_object('request_id', r.id) || v_payload,
            p_kind || ':' || coalesce(nullif(v_payload->>'ref', ''), gen_random_uuid()::text) || ':' || v_member, now(), app.user_id())
    returning id into v_id;
  execute 'select u.email from members m join kaname_auth."user" u on u.id = m.auth_user_id where m.id = $1' into v_email using v_member;
  return jsonb_build_object('member_id', v_member, 'email', v_email, 'notification_id', v_id);
end $$;
revoke all on function app.client_request_notify_author(uuid, text, jsonb) from public;
