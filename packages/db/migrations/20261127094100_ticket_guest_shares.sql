-- 20261127094100 チケットの見せる相手（ゲストのグループ）（K-881・契約の口 listTicketGuestShares・updateTicketGuestShares・D-155.35・D-155.37・D-155.41・D-155.42・D-155.44・D-155.45・D-155.46・関門 C2・C6）
--   ① ticket_guest_shares：チケット × ゲストのグループ（人ごと・項目ごと・種別の既定の列は持たない）。消していない物は (ticket_id, guest_group_id) で一意
--   ② 引き金 app.ticket_guest_share_same_tenant()：チケットとグループが行の会社と同じでなければ 22023
--   ③ app.guest_sees_ticket(tid) を作り直す（K-878 の橋＝依頼から作ったチケットの枝は外す）：見せる相手に自分のグループが選ばれたチケットだけ
--   ④ app.ticket_guest_share_state(tid)：見せている相手（shared）・選べる相手（choices・書ける人だけ）・can_change
--   ⑤ app.ticket_guest_shares_update(tid, add, remove)：先に外してから足す・全部か無しか（E-GST-040）・20 まで（E-GST-041）・
--      新しく見せたグループの今いるゲストの受け箱に 1 件ずつ（メールは送らない・関門 C6）・変えた 1 つごとに証跡（関門 C2）
--   ⑥ app.ticket_guest_shares_drop_group(グループ)：ゲストのグループを消すとき（K-927）に、そのグループの見せる相手を外す（件数を返す）
--
-- どれも security definer・search_path に pg_temp・public から外し kaname_app にだけ渡す（引き金の関数と中の道具は渡さない）

create table if not exists ticket_guest_shares (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  ticket_id uuid not null references tickets(id),
  guest_group_id uuid not null references guest_groups(id),
  shared_by uuid references members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create unique index if not exists ticket_guest_shares_live_uq on ticket_guest_shares (ticket_id, guest_group_id) where deleted_at is null;
create index if not exists ticket_guest_shares_group_idx on ticket_guest_shares (guest_group_id, ticket_id) where deleted_at is null;
create index if not exists ticket_guest_shares_tenant_idx on ticket_guest_shares (tenant_id);

-- ② 同じ会社の物だけ（K-876 の app.guest_same_tenant() は guest_group_members 用なので使わない）
create or replace function app.ticket_guest_share_same_tenant() returns trigger
language plpgsql security definer set search_path = public, app, pg_temp as $$
begin
  if not exists (select 1 from tickets t where t.id = new.ticket_id and t.tenant_id = new.tenant_id)
     or not exists (select 1 from guest_groups g where g.id = new.guest_group_id and g.tenant_id = new.tenant_id) then
    raise exception 'チケットとゲストのグループは同じ会社のもの' using errcode = '22023';
  end if;
  return new;
end $$;
revoke all on function app.ticket_guest_share_same_tenant() from public;
drop trigger if exists ticket_guest_shares_same_tenant on ticket_guest_shares;
create trigger ticket_guest_shares_same_tenant before insert or update on ticket_guest_shares
  for each row execute function app.ticket_guest_share_same_tenant();
drop trigger if exists ticket_guest_shares_updated_at on ticket_guest_shares;
create trigger ticket_guest_shares_updated_at before update on ticket_guest_shares
  for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('ticket_guest_shares', 'ticket_guest_shares') on conflict do nothing;

-- ③ ゲストに見えるチケット：見せる相手に自分のグループが選ばれた物だけ（依頼から作ったチケットも同じ・特別な枝は持たない）
create or replace function app.guest_sees_ticket(p_ticket uuid) returns boolean
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_group uuid := app.my_guest_group();
begin
  if v_group is null then
    return false;
  end if;
  return exists (
    select 1
    from tickets t
    join ticket_guest_shares s on s.ticket_id = t.id and s.tenant_id = t.tenant_id and s.deleted_at is null
    where t.id = p_ticket and t.tenant_id = app.tenant_id()
      and t.deleted_at is null and t.draft_import_id is null
      and s.guest_group_id = v_group
  );
end $$;

-- グループの人の要約（K-905 の画面がそのまま出す）。今いるゲストの名前を最大 2 人・「 様」・3 人以上は「 ほか」・（N 人・招待中 M）
create or replace function app.guest_group_summary(p_group uuid) returns text
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_names text[];
  v_count int;
  v_invited int;
begin
  select coalesce(array_agg(x.display_name order by x.display_name collate "C", x.id), '{}'), count(*)
    into v_names, v_count
    from (
      select m.id, m.display_name
        from guest_group_members gm
        join members m on m.id = gm.member_id and m.tenant_id = gm.tenant_id and m.deleted_at is null
       where gm.guest_group_id = p_group and gm.deleted_at is null
         and exists (select 1 from tenant_memberships tm
                      where tm.tenant_id = gm.tenant_id and tm.member_id = gm.member_id
                        and tm.role = 'requester' and tm.status = 'active' and tm.deleted_at is null)
    ) x;
  select count(*) into v_invited
    from invitations i
   where i.guest_group_id = p_group and i.role_id = 'requester'
     and i.deleted_at is null and i.revoked_at is null and i.accepted_member_id is null and i.expires_at > now();
  if v_count = 0 and v_invited = 0 then
    return 'まだゲストはいません';
  end if;
  return coalesce((select string_agg(u.n || ' 様', '・' order by u.i) from unnest(v_names[1:2]) with ordinality as u(n, i)), '')
      || case when v_count >= 3 then ' ほか' else '' end
      || '（' || v_count || ' 人'
      || case when v_invited > 0 then '・招待中 ' || v_invited else '' end
      || '）';
end $$;
revoke all on function app.guest_group_summary(uuid) from public;

-- 見せている相手（名前の順）。中の道具（渡さない）
create or replace function app.ticket_guest_shared_json(p_ticket uuid) returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('guest_group_id', g.id, 'name', g.name, 'summary', app.guest_group_summary(g.id))
                            order by g.name collate "C", g.id), '[]'::jsonb)
    from ticket_guest_shares s
    join guest_groups g on g.id = s.guest_group_id and g.tenant_id = s.tenant_id and g.deleted_at is null
   where s.ticket_id = p_ticket and s.tenant_id = app.tenant_id() and s.deleted_at is null
$$;
revoke all on function app.ticket_guest_shared_json(uuid) from public;

-- ④ 読む：見えなければ 42501（入口が先に 404 で止める・防御の 2 層目）
create or replace function app.ticket_guest_share_state(p_ticket uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_can boolean;
begin
  if v_tenant is null or app.user_id() is null or not app.ticket_visible(p_ticket)
     or not exists (select 1 from tickets t where t.id = p_ticket and t.tenant_id = v_tenant and t.deleted_at is null) then
    raise exception 'チケットが見えない' using errcode = 'insufficient_privilege';
  end if;
  v_can := app.ticket_writable(p_ticket);
  return jsonb_build_object(
    'shared', app.ticket_guest_shared_json(p_ticket),
    'choices', case when v_can then coalesce((
      select jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'summary', app.guest_group_summary(g.id))
                       order by g.name collate "C", g.id)
        from guest_groups g
       where g.tenant_id = v_tenant and g.deleted_at is null
         and not exists (select 1 from ticket_guest_shares s
                          where s.ticket_id = p_ticket and s.guest_group_id = g.id and s.deleted_at is null)
    ), '[]'::jsonb) else '[]'::jsonb end,
    'can_change', v_can
  );
end $$;
revoke all on function app.ticket_guest_share_state(uuid) from public;
grant execute on function app.ticket_guest_share_state(uuid) to kaname_app;

-- ⑤ 付け外し：1 つの取引。先に外してから足す（同じ id が両方にあれば足す方が勝つ）。全部か無しか
create or replace function app.ticket_guest_shares_update(p_ticket uuid, p_add uuid[], p_remove uuid[]) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_me uuid := app.user_id();
  v_add uuid[] := coalesce((select array_agg(distinct x) from unnest(coalesce(p_add, '{}')) as x), '{}');
  v_remove uuid[] := coalesce((select array_agg(distinct x) from unnest(coalesce(p_remove, '{}')) as x), '{}');
  r record;
  v_live int;
begin
  if v_tenant is null or v_me is null then
    raise exception 'チケットに書けない' using errcode = 'insufficient_privilege';
  end if;
  select t.id, t.number, t.title into r
    from tickets t
   where t.id = p_ticket and t.tenant_id = v_tenant and t.deleted_at is null
   for update;
  if r.id is null or not app.ticket_writable(p_ticket) then
    raise exception 'チケットに書けない' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from unnest(v_add) as x
              where not exists (select 1 from guest_groups g where g.id = x and g.tenant_id = v_tenant and g.deleted_at is null)) then
    raise exception 'このゲストのグループは見つからない' using errcode = 'insufficient_privilege', hint = 'E-GST-040';
  end if;
  -- 外す（行は消さず deleted_at）。変えた 1 つごとに証跡
  with gone as (
    update ticket_guest_shares s set deleted_at = now(), updated_by = v_me
     where s.ticket_id = p_ticket and s.tenant_id = v_tenant and s.deleted_at is null and s.guest_group_id = any(v_remove)
    returning s.guest_group_id
  )
  insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
  select v_tenant, v_me, 'member', 'ticket.guest_share_removed', 'tickets', p_ticket::text, 'C2',
         jsonb_build_object('ticket_id', p_ticket, 'guest_group_id', gone.guest_group_id), v_me
    from gone;
  -- 足す（もう見せている物は何もしない）。新しく入れた行ごとに証跡と、そのグループの今いるゲストの受け箱に 1 件（メールは送らない）
  with added as (
    insert into ticket_guest_shares (tenant_id, ticket_id, guest_group_id, shared_by, created_by, updated_by)
    select v_tenant, p_ticket, x, v_me, v_me, v_me from unnest(v_add) as x
    on conflict (ticket_id, guest_group_id) where deleted_at is null do nothing
    returning id, guest_group_id
  ), audit as (   -- 書き込みの with は使わなくても必ず流れる
    insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
    select v_tenant, v_me, 'member', 'ticket.guest_share_added', 'tickets', p_ticket::text, 'C2',
           jsonb_build_object('ticket_id', p_ticket, 'guest_group_id', a.guest_group_id), v_me
      from added a
  )
  insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, dedupe_key, created_by)
  select v_tenant, gm.member_id, 'inapp', 'ticket.guest_shared',
         jsonb_build_object('ticket_id', p_ticket, 'number', r.number, 'title', r.title, 'url', '/portal/tickets/' || p_ticket),
         'ticket.guest_shared:' || a.id || ':' || gm.member_id, v_me
    from added a
    join guest_group_members gm on gm.guest_group_id = a.guest_group_id and gm.tenant_id = v_tenant and gm.deleted_at is null
    join members m on m.id = gm.member_id and m.deleted_at is null
   where exists (select 1 from tenant_memberships tm
                  where tm.tenant_id = v_tenant and tm.member_id = gm.member_id
                    and tm.role = 'requester' and tm.status = 'active' and tm.deleted_at is null);
  select count(*) into v_live from ticket_guest_shares s where s.ticket_id = p_ticket and s.deleted_at is null;
  if v_live > 20 then
    raise exception '見せる相手は 20 まで' using errcode = '22023', hint = 'E-GST-041';
  end if;
  return jsonb_build_object('shared', app.ticket_guest_shared_json(p_ticket));
end $$;
revoke all on function app.ticket_guest_shares_update(uuid, uuid[], uuid[]) from public;
grant execute on function app.ticket_guest_shares_update(uuid, uuid[], uuid[]) to kaname_app;

-- ⑥ ゲストのグループを消すとき（K-927 が同じ取引の中で呼ぶ）：そのグループの見せる相手を外す。受け箱には入れない
create or replace function app.ticket_guest_shares_drop_group(p_group uuid) returns int
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_me uuid := app.user_id();
  v_n int;
begin
  if v_tenant is null or v_me is null or not has_permission(v_me, 'members', null, 'edit') then
    raise exception 'メンバーを直す権限が無い' using errcode = 'insufficient_privilege';
  end if;
  with gone as (
    update ticket_guest_shares s set deleted_at = now(), updated_by = v_me
     where s.tenant_id = v_tenant and s.guest_group_id = p_group and s.deleted_at is null
    returning s.ticket_id, s.guest_group_id
  ), audit as (
    insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
    select v_tenant, v_me, 'member', 'ticket.guest_share_removed', 'tickets', gone.ticket_id::text, 'C2',
           jsonb_build_object('ticket_id', gone.ticket_id, 'guest_group_id', gone.guest_group_id), v_me
      from gone
    returning 1
  )
  select count(*) into v_n from audit;
  return v_n;
end $$;
revoke all on function app.ticket_guest_shares_drop_group(uuid) from public;
grant execute on function app.ticket_guest_shares_drop_group(uuid) to kaname_app;

revoke execute on function app.guest_sees_ticket(uuid) from public;
grant execute on function app.guest_sees_ticket(uuid) to kaname_app;
