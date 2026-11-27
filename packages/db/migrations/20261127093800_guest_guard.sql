-- 20261127093800 ゲストの守り（K-878・D-128.46・D-128.100・D-155.35・D-155.37・D-155.41・D-155.42・D-155.44）
--   ゲスト（tenant_memberships.role = 'requester'）が読めるのは、自分のゲストのグループ（K-876 の guest_groups）の依頼と、その依頼から作ったチケットと、自分のグループの行だけ。
--   守りは 3 層：入口（op.ts・今のまま）／DB の柵（app.client_ok を広げる・app.member_ok は requester を通さない）／DB の行（方針は policies/20261127093800_guest_guard.sql）。
--   関数は毎回その時の所属・グループ・依頼を見る（セッションに持たない・G-14）。
--   app.guest_sees_ticket は plpgsql：K-881 の表 ticket_guest_shares はこの時点で無く、K-881 が「見せる相手」を足して作り直す（依頼から作ったチケットの枝は K-881 までの橋）。
--   古い取引先の形（0074）は消さず・使わない（K-883 の凍結）。

-- ---------------------------------------------------------------- 今の人がゲストか・どのグループか
-- この会社の所属が役割 requester（状態は問わない：止めた・抜けたゲストもゲスト）
create or replace function app.is_guest_member() returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select exists (
    select 1 from tenant_memberships tm
    where tm.tenant_id = app.tenant_id() and tm.member_id = app.user_id()
      and tm.role = 'requester' and tm.deleted_at is null
  )
$$;

-- 今の人が入っている、消していないゲストのグループ（無ければ null）
create or replace function app.my_guest_group() returns uuid
language sql stable security definer set search_path = public, app, pg_temp as $$
  select gm.guest_group_id
  from guest_group_members gm
  join guest_groups g on g.id = gm.guest_group_id and g.tenant_id = gm.tenant_id and g.deleted_at is null
  where gm.tenant_id = app.tenant_id() and gm.member_id = app.user_id() and gm.deleted_at is null
  limit 1
$$;

-- ゲストの文脈：role client・この会社の所属が requester で active・消していないグループに入っている
create or replace function app.guest_ok() returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select coalesce(current_setting('app.role', true), '') = 'client'
     and exists (
       select 1 from tenant_memberships tm
       where tm.tenant_id = app.tenant_id() and tm.member_id = app.user_id()
         and tm.role = 'requester' and tm.status = 'active' and tm.deleted_at is null
     )
     and app.my_guest_group() is not null
$$;

-- ---------------------------------------------------------------- 柵の作り直し
-- 取引先の人の柵を広げる：前の形（取引先の人として登録されている）か、ゲスト。方針の役の言葉は client のまま
create or replace function app.client_ok() returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select coalesce(current_setting('app.role', true), '') = 'client'
     and exists (select 1 from members m where m.id = nullif(current_setting('app.user_id', true), '')::uuid and m.tenant_id = app.tenant_id() and m.deleted_at is null)
     and (app.my_client() is not null or app.guest_ok())
$$;

-- 社内の人の柵：役割 requester の所属を持つ人は、role が member と書かれても通さない（柵の 2 層目）
create or replace function app.member_ok() returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select coalesce(current_setting('app.role', true), '') = 'member'
     and exists (select 1 from members m where m.id = nullif(current_setting('app.user_id', true), '')::uuid and m.tenant_id = app.tenant_id() and m.deleted_at is null)
     and app.my_client() is null
     and not app.is_guest_member()
$$;

-- ---------------------------------------------------------------- ゲストに見えるチケット
-- 自分のグループの（消していない）依頼から作ったチケットで、消していない・下書きでない（K-881 が「見せる相手」を足して作り直す）
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
    join client_requests r on r.ticket_id = t.id and r.tenant_id = t.tenant_id
    where t.id = p_ticket and t.tenant_id = app.tenant_id()
      and t.deleted_at is null and t.draft_import_id is null
      and r.guest_group_id = v_group and r.deleted_at is null
  );
end $$;

-- ---------------------------------------------------------------- 依頼をゲストのグループの物にもできる形に
alter table client_requests alter column client_id drop not null;
alter table client_requests add column if not exists guest_group_id uuid references guest_groups(id);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'client_requests_party_check') then
    alter table client_requests add constraint client_requests_party_check check (client_id is not null or guest_group_id is not null);
  end if;
end $$;
create index if not exists client_requests_guest_group_idx on client_requests (tenant_id, guest_group_id) where guest_group_id is not null;
create index if not exists client_requests_ticket_idx on client_requests (ticket_id) where ticket_id is not null;

-- ゲストのグループは同じ会社の物（K-876 の app.guest_same_tenant は人と届け先を見る別の物なので使い回さない）
create or replace function app.guest_request_same_tenant() returns trigger
language plpgsql security definer set search_path = public, app, pg_temp as $$
begin
  if new.guest_group_id is not null and not exists (
       select 1 from guest_groups g where g.id = new.guest_group_id and g.tenant_id = new.tenant_id) then
    raise exception 'ゲストのグループは同じ会社のもの' using errcode = '22023';
  end if;
  return new;
end $$;
drop trigger if exists client_requests_guest_same_tenant on client_requests;
create trigger client_requests_guest_same_tenant before insert or update on client_requests
  for each row execute function app.guest_request_same_tenant();

-- ---------------------------------------------------------------- 渡す（public から外し kaname_app にだけ。作り直した 2 つは今の grant を保つ）
revoke execute on function app.is_guest_member(), app.my_guest_group(), app.guest_ok(), app.guest_sees_ticket(uuid), app.guest_request_same_tenant() from public;
grant execute on function app.is_guest_member(), app.my_guest_group(), app.guest_ok(), app.guest_sees_ticket(uuid) to kaname_app;
