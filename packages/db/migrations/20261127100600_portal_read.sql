-- 20261127100600 先方の場所を読む関数 3 つ（K-906・契約の口 getPortalHome・getPortalTicket・listPortalNotices・D-155.37・D-155.41・D-155.42・D-155.44・D-155.54）
--   新しい表・列・方針は作らない。読む関数を 3 つ足す（ホームだけは、初めての読みのときに証跡 portal.first_visit を 1 行書く）。
--
--   見えるか見えないかは K-878 の app.guest_ok() と K-881 の app.guest_sees_ticket(tid) だけで決める（この葉は新しい見せ方を持たない）。
--   ゲストでない人（役割 requester でない・グループに入っていない・止めた・抜けた・グループが消えた・社内の文脈）は 42501（口は 403）。
--   関数は security definer：ゲストの文脈では ticket_sections・notices・ticket_messages・client_request_messages を表では読めない（行の守りは足さない）。
--   返す字は関数が欄を決めて組み立てる（行をそのまま返さない）。期限・担当・優先度・確認項目・決定・成果物・分身の記録は返さない。
--   段の札：done → 完了・checking と awaiting_approval → 確認中・ほか（鍵の無い段を含む）→ 作っている。
--   詳細は鍵 detail の区画の字（無ければ空の字・D-155.54 PM の決め）。チャットは K-882 の app.portal_ticket_messages の答えをそのまま入れる。

-- ホーム：グループの名前・会社の名前・届け先の社内のグループの名前・本人・初めてか・グループの依頼（50 件まで）・見せてもらったチケット（100 件まで）
create or replace function app.portal_home() returns jsonb
language plpgsql volatile security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_me uuid := app.user_id();
  v_group uuid;
  v_group_name text;
  v_scope_name text;
  v_tenant_name text;
  v_name text;
  v_first boolean;
  r jsonb;
begin
  if v_tenant is null or not app.guest_ok() then
    raise exception 'ゲストの文脈でだけ読める' using errcode = '42501';
  end if;
  v_group := app.my_guest_group();
  select g.name, s.name into v_group_name, v_scope_name
    from guest_groups g
    left join scopes s on s.id = g.request_scope_id and s.tenant_id = g.tenant_id and s.deleted_at is null
   where g.id = v_group and g.tenant_id = v_tenant;
  select t.name into v_tenant_name from tenants t where t.id = v_tenant;
  select coalesce(m.display_name, '') into v_name from members m where m.id = v_me and m.tenant_id = v_tenant;
  v_name := coalesce(v_name, '');

  v_first := not exists (
    select 1 from audit_events a
     where a.tenant_id = v_tenant and a.actor_member_id = v_me and a.action = 'portal.first_visit');
  if v_first then
    perform app.record_audit('portal.first_visit', 'members', v_me::text, 'C2', '{}'::jsonb);
  end if;

  select jsonb_build_object(
    'group_name', coalesce(v_group_name, ''),
    'tenant_name', coalesce(v_tenant_name, ''),
    'request_scope_name', v_scope_name,
    'me', jsonb_build_object('name', v_name, 'initial', left(v_name, 1)),
    'first_visit', v_first,
    'requests', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', q.id, 'title', q.title, 'from_name', q.from_name, 'created_at', q.created_at, 'badge', q.badge)
             order by q.created_at desc, q.id desc)
        from (
          select cr.id, cr.title, coalesce(m.display_name, '') as from_name, cr.created_at,
                 case
                   when cr.ticket_id is not null or cr.state in ('ticketed', 'declined') then '済み'
                   when (select x.side from client_request_messages x
                          where x.client_request_id = cr.id and x.tenant_id = v_tenant and x.deleted_at is null
                          order by x.created_at desc, x.id desc limit 1) = 'company' then '返事あり'
                   else '受付済み'
                 end as badge
            from client_requests cr
            left join members m on m.id = cr.created_by
           where cr.tenant_id = v_tenant and cr.guest_group_id = v_group and cr.deleted_at is null
           order by cr.created_at desc, cr.id desc
           limit 50
        ) q), '[]'::jsonb),
    'tickets', coalesce((
      select jsonb_agg(
               jsonb_build_object('id', k.id, 'title', k.title, 'stage', k.stage)
                 || case when k.from_request then jsonb_build_object('from_request', true) else '{}'::jsonb end
             order by k.updated_at desc, k.id desc)
        from (
          select t.id, t.title, t.updated_at, case when st.key = 'done' then '完了' when st.key in ('checking', 'awaiting_approval') then '確認中' else '作っている' end as stage,
                 exists (select 1 from client_requests cr
                          where cr.ticket_id = t.id and cr.tenant_id = v_tenant
                            and cr.guest_group_id = v_group and cr.deleted_at is null) as from_request
            from tickets t
            left join ticket_stages st on st.id = t.stage_id
           where t.tenant_id = v_tenant and t.deleted_at is null
             and t.id in (select sh.ticket_id from ticket_guest_shares sh
                           where sh.tenant_id = v_tenant and sh.guest_group_id = v_group and sh.deleted_at is null)
             and app.guest_sees_ticket(t.id)
           order by t.updated_at desc, t.id desc
           limit 100
        ) k), '[]'::jsonb))
    into r;
  if v_scope_name is null then
    r := r - 'request_scope_name';
  end if;
  return r;
end $$;
revoke all on function app.portal_home() from public;
grant execute on function app.portal_home() to kaname_app;

-- 見せてもらったチケット 1 件：見えなければ null（口は 404）
create or replace function app.portal_ticket(p_ticket uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_group uuid;
  r jsonb;
begin
  if v_tenant is null or not app.guest_ok() then
    raise exception 'ゲストの文脈でだけ読める' using errcode = '42501';
  end if;
  if p_ticket is null or not app.guest_sees_ticket(p_ticket) then
    return null;
  end if;
  v_group := app.my_guest_group();
  select jsonb_build_object(
    'ticket', jsonb_build_object(
      'id', t.id,
      'title', t.title,
      'stage', case when st.key = 'done' then '完了' when st.key in ('checking', 'awaiting_approval') then '確認中' else '作っている' end,
      'body', coalesce((select s.body ->> 'text' from ticket_sections s
                         where s.ticket_id = t.id and s.tenant_id = v_tenant and s.section_key = 'body' and s.deleted_at is null), ''),
      'detail', coalesce((select s.body ->> 'text' from ticket_sections s
                           where s.ticket_id = t.id and s.tenant_id = v_tenant and s.section_key = 'detail' and s.deleted_at is null), ''),
      'from_request', exists (select 1 from client_requests cr
                               where cr.ticket_id = t.id and cr.tenant_id = v_tenant
                                 and cr.guest_group_id = v_group and cr.deleted_at is null)),
    'messages', coalesce(app.portal_ticket_messages(t.id), '[]'::jsonb))
    into r
    from tickets t
    left join ticket_stages st on st.id = t.stage_id
   where t.id = p_ticket and t.tenant_id = v_tenant and t.deleted_at is null;
  return r;
end $$;
revoke all on function app.portal_ticket(uuid) from public;
grant execute on function app.portal_ticket(uuid) to kaname_app;

-- お知らせ：公開済み・消していない・全部向け・置き場に banner・保守の終わりが過ぎていない物を新しい順に 3 件まで
create or replace function app.portal_notices() returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
begin
  if app.tenant_id() is null or not app.guest_ok() then
    raise exception 'ゲストの文脈でだけ読める' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', x.id, 'title', x.title, 'body', x.body) order by x.created_at desc, x.id desc)
      from (
        select n.id, n.title, n.body, n.created_at
          from notices n
         where n.state = 'published' and n.deleted_at is null
           and n.target_tenant_id is null
           and (n.target_plan_ids is null or cardinality(n.target_plan_ids) = 0)
           and 'banner' = any (n.placements)
           and (n.maintenance_to is null or n.maintenance_to > now())
         order by n.created_at desc, n.id desc
         limit 3
      ) x), '[]'::jsonb);
end $$;
revoke all on function app.portal_notices() from public;
grant execute on function app.portal_notices() to kaname_app;
