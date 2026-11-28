-- 20261127101300 ゲストの「初めて」の印はホームを開いたときだけ（K-913・代表の決め answer=b187f0c59dec）
--   K-906 の app.portal_home() を、印（証跡 portal.first_visit）を付けるかを受ける形 app.portal_home(p_mark boolean default true) に作り直す。
--   中身は K-906 のまま。証跡を書くのは「まだ記録が無い」かつ p_mark のときだけ。答えの first_visit は p_mark に関わらず「まだ記録が無いか」。
--   引数なしの呼び方は K-906 と同じ振る舞い（p_mark の既定 true）。ホーム以外の画面の外枠の読み（口の visit=elsewhere）は p_mark false。
--   引数の形が変わるので drop してから作る（同じ名前の 2 つの形を残さない）。権限は新しい形に付け直す。
-- 消す訳：K-913（answer=b187f0c59dec・引数の形を替えるので作り直す。同じ名前の 2 つの形を残さない）
-- squawk-ignore ban-drop-function
drop function if exists app.portal_home();

create function app.portal_home(p_mark boolean default true) returns jsonb
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
  if v_first and p_mark then
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
revoke all on function app.portal_home(boolean) from public;
grant execute on function app.portal_home(boolean) to kaname_app;
