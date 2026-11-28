-- 20261127100800 ゲストが自分のゲストのグループの依頼のやり取りに返事・補足を書く（K-908・D-155.10・D-155.25・D-155.33・D-155.37・関門 C2・C6）
--   app.portal_request_post(依頼, 本文)：1 つの取引で、やり取りの行（side guest・kind message）・asking の依頼を new に戻す・証跡・届け先の人の受け箱の行を書く
--   （どれかが落ちれば何も残らない）。メールは口が取引の後に送る（関数は受け箱に入れた人の宛先を返すだけ）。
--   書けるのは state が new・asking の依頼だけ（ticketed・declined は P0001・hint E-GST-170）。30 秒以内の同じ人・同じ依頼・同じ本文は前の行の id を返す（何も増やさない）。
--   毎回その時の所属を app.guest_ok()（K-878）で見る（G-14）。自分のゲストのグループの依頼でなければ null（口が 404）。表・列・方針は足さない。

create or replace function app.portal_request_post(p_id uuid, p_body text) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_t uuid := app.tenant_id();
  v_me uuid := app.user_id();
  v_r client_requests%rowtype;
  v_scope uuid;
  v_id uuid;
  v_targets uuid[];
  v_emails text[];
begin
  if not app.guest_ok() then
    raise exception 'ゲストでない' using errcode = '42501';
  end if;
  -- NUL は Postgres の text に入らない（chr(0) は呼ぶだけで 54000 になる）。NUL を含む体は口（checkMessage）と入口が 422 にする
  if p_body is null or btrim(p_body, E' \t\r\n　') = '' or length(p_body) > 10000 then
    raise exception '本文の形' using errcode = '22023';
  end if;

  -- 自分のゲストのグループの依頼（消していない・この会社）を取り、同じ依頼への書き込みを 1 本ずつにする
  select r.* into v_r from client_requests r
  where r.id = p_id and r.tenant_id = v_t and r.guest_group_id = app.my_guest_group() and r.deleted_at is null
  for update;
  if not found then
    return null;
  end if;
  if v_r.state not in ('new', 'asking') then
    raise exception 'もう書けない依頼' using errcode = 'P0001', hint = 'E-GST-170';
  end if;

  -- 二重に書く：30 秒以内の同じ人・同じ依頼・同じ本文は前の行の id（何も増やさない・メールも送らない）
  select c.id into v_id
  from client_request_messages c
  where c.tenant_id = v_t and c.client_request_id = v_r.id and c.author_member_id = v_me
    and c.side = 'guest' and c.kind = 'message' and c.deleted_at is null
    and c.body = p_body and c.created_at > now() - interval '30 seconds'
  order by c.created_at desc
  limit 1;
  if v_id is not null then
    return jsonb_build_object('id', v_id, 'emails', '[]'::jsonb);
  end if;

  insert into client_request_messages (tenant_id, client_request_id, side, kind, body, author_member_id, created_by, updated_by)
    values (v_t, v_r.id, 'guest', 'message', p_body, v_me, v_me, v_me)
    returning id into v_id;

  -- 聞かれたことに答えた：asking は new に戻す（ほかの欄は変えない）
  if v_r.state = 'asking' then
    update client_requests set state = 'new', updated_by = v_me where id = v_r.id and tenant_id = v_t;
  end if;

  perform app.record_audit('portal.request_message', 'client_request', v_r.id::text, 'C2', jsonb_build_object('request_id', v_r.id));

  -- 届け先：会社が変えた届け先（routed_scope_id）があればそのグループ、無ければゲストのグループの届け先の人（消していない・active・ゲストでない）。居なければ会社の管理者
  select coalesce(v_r.routed_scope_id, g.request_scope_id) into v_scope
  from guest_groups g where g.id = v_r.guest_group_id and g.tenant_id = v_t;
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
    -- 書き込みごとに 1 人 1 件（ゲストの書いた字は載せない）
    insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, dedupe_key, created_by)
      select v_t, x, 'inapp', 'client_request.replied',
             jsonb_build_object('request_id', v_r.id, 'url', '/requests/' || v_r.id),
             'client_request.replied:' || v_id || ':' || x, v_me
      from unnest(v_targets) x;
    -- 宛先（人に認証の行が無ければ入らない）。kaname_auth は動的に読む（0067 の app.bridge_session_email と同じ形）
    execute 'select array_agg(u.email) from members m join kaname_auth."user" u on u.id = m.auth_user_id '
         || 'where m.id = any($1) and u.email is not null'
      into v_emails using v_targets;
  end if;

  return jsonb_build_object('id', v_id, 'emails', to_jsonb(coalesce(v_emails, '{}'::text[])));
end $$;

-- 渡す（public から外し kaname_app にだけ）
revoke execute on function app.portal_request_post(uuid, text) from public;
grant execute on function app.portal_request_post(uuid, text) to kaname_app;
