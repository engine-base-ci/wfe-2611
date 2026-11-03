-- 0080 権限の確かめの穴を直し、役割の束を権限の行として持つ（KN-53・D-125.117・D-128.46・D-128.97）
--   ★has_permission の穴：会社全体の確かめ（scope が null）は、1 つのグループだけに付けた権限でも通っていた。
--     グループの edit を持つ人が、会社全体の決まり（種別・取引先・招く など）を直せた。会社全体の確かめは、会社全体に付けた権限だけで通す。
--   役割（管理者・マネージャー・メンバー・閲覧のみ）は権限の束。束の中身は role_bundle_defaults（製品の既定）に持ち、
--   ワークスペースの役割（tenant_memberships.role）とグループの役割（scope_memberships.role）から、権限の行（permissions・bundle_role 付き）を作る。
--   個別に足した行（bundle_role が null）は、役割を変えても消さない。

-- ---------------------------------------------------------------- 会社全体の確かめは、会社全体の権限だけ
create or replace function has_permission(uid uuid, target_kind text, scope uuid, ability text) returns boolean language sql stable security definer set search_path = public, app as $$
  select exists (
    select 1 from permissions p
    where p.grantee_member_id = uid and p.tenant_id = app.tenant_id() and p.revoked_at is null and p.deleted_at is null
      and p.target_kind_id = target_kind
      and (p.ability_id = ability or (ability = 'view' and p.ability_id = 'edit'))
      and (case when scope is null then p.scope_id is null
                else p.scope_id is null or scope in (select app.scope_tree(p.scope_id)) end)
  )
$$;

-- ---------------------------------------------------------------- 役割の束（製品の既定）
--   scope_kind：workspace＝会社全体に付ける ／ group＝その人のグループ（主の所属・兼務）に付ける
create table if not exists role_bundle_defaults (
  role text not null check (role in ('admin', 'manager', 'member', 'viewer')),
  target_kind_id text not null references target_kinds(key),
  ability_id text not null references abilities(key),
  scope_kind text not null check (scope_kind in ('workspace', 'group')),
  primary key (role, target_kind_id, ability_id, scope_kind)
);
grant select on role_bundle_defaults to kaname_app;
alter table role_bundle_defaults enable row level security;
alter table role_bundle_defaults force row level security;

alter table permissions add column if not exists bundle_role text;   -- 束から作った行（null＝個別に足した行）
create index if not exists permissions_bundle_idx on permissions (tenant_id, grantee_member_id) where bundle_role is not null;

-- 束の中身（D-125.117・D-128.97）
--   管理者：全部の表の edit と、招く・書き出す・プランと支払い・ワークスペースを消す（会社全体）
--   マネージャー：配る・承認する・記憶を確かめる（そのグループの中だけ）。招く・役割を変える・外すは入れない
--   メンバー：自分のグループでチケットとナレッジを書く・依頼を受ける ／ 閲覧のみ：自分のグループを見る
create or replace function app.refresh_role_bundle_defaults() returns void language plpgsql security definer set search_path = public, app as $$
begin
  delete from role_bundle_defaults;
  insert into role_bundle_defaults (role, target_kind_id, ability_id, scope_kind)
    select 'admin', key, 'edit', 'workspace' from target_kinds
    union all select 'admin', 'members', a, 'workspace' from unnest(array['invite']) a
    union all select 'admin', 'tenants', a, 'workspace' from unnest(array['billing', 'export', 'delete_workspace']) a
  on conflict do nothing;
  insert into role_bundle_defaults (role, target_kind_id, ability_id, scope_kind)
    select 'manager', t, 'edit', 'group' from unnest(array['tickets', 'ticket_handovers', 'approvals', 'memories', 'learning_candidates', 'saved_views', 'client_requests', 'knowledge_pages', 'test_specs']) t
    where exists (select 1 from target_kinds where key = t)
  on conflict do nothing;
  -- マネージャーは自分のグループの分を書き出せる（既定は管理者とマネージャー・書き出す口が自分のグループに絞る）
  insert into role_bundle_defaults (role, target_kind_id, ability_id, scope_kind) values ('manager', 'tenants', 'export', 'group')
  on conflict do nothing;
  insert into role_bundle_defaults (role, target_kind_id, ability_id, scope_kind)
    select 'member', t, 'edit', 'group' from unnest(array['tickets', 'knowledge_pages', 'client_requests', 'test_specs']) t
    where exists (select 1 from target_kinds where key = t)
  on conflict do nothing;
  insert into role_bundle_defaults (role, target_kind_id, ability_id, scope_kind)
    select 'viewer', t, 'view', 'group' from unnest(array['tickets', 'knowledge_pages']) t
    where exists (select 1 from target_kinds where key = t)
  on conflict do nothing;
end $$;
select app.refresh_role_bundle_defaults();
-- 表を足した migration は、最後に app.refresh_role_bundle_defaults() と全員の app.apply_role_bundles を呼ぶ（管理者の束に新しい表を入れる）

-- 1 人の束の行を作り直す（個別の行は触らない）
create or replace function app.apply_role_bundles(t uuid, mid uuid) returns void language plpgsql security definer set search_path = public, app as $$
declare wrole text; primary_scope uuid;
begin
  perform set_config('app.bundle_apply', 'on', true);   -- 束から作り直す間だけ、束の行の止め札を通す
  delete from permissions where tenant_id = t and grantee_member_id = mid and bundle_role is not null;
  select role into wrole from tenant_memberships where tenant_id = t and member_id = mid and deleted_at is null and status = 'active';
  if wrole is null or wrole = 'requester' then return; end if;
  if wrole = 'admin' then
    insert into permissions (tenant_id, grantee_member_id, target_kind_id, ability_id, scope_id, bundle_role)
      select t, mid, d.target_kind_id, d.ability_id, null, 'admin' from role_bundle_defaults d where d.role = 'admin';
    return;
  end if;
  -- グループごと：兼務の行の役割。主の所属に行が無ければ、ワークスペースの役割で
  select scope_id into primary_scope from members where id = mid and tenant_id = t;
  insert into permissions (tenant_id, grantee_member_id, target_kind_id, ability_id, scope_id, bundle_role)
    select t, mid, d.target_kind_id, d.ability_id, g.scope_id, g.role
    from (
      select sm.scope_id, sm.role from scope_memberships sm where sm.tenant_id = t and sm.member_id = mid and sm.deleted_at is null
      union
      select primary_scope, wrole where primary_scope is not null
        and not exists (select 1 from scope_memberships sm where sm.tenant_id = t and sm.member_id = mid and sm.scope_id = primary_scope and sm.deleted_at is null)
    ) g
    join role_bundle_defaults d on d.role = g.role and d.scope_kind = 'group';
end $$;

create or replace function app.role_bundles_on_change() returns trigger language plpgsql security definer set search_path = public, app as $$
begin
  if tg_op = 'DELETE' then
    perform app.apply_role_bundles(old.tenant_id, old.member_id);
    return old;
  end if;
  perform app.apply_role_bundles(new.tenant_id, new.member_id);
  if tg_op = 'UPDATE' and old.member_id <> new.member_id then perform app.apply_role_bundles(old.tenant_id, old.member_id); end if;
  return new;
end $$;
drop trigger if exists tenant_memberships_bundles on tenant_memberships;
create trigger tenant_memberships_bundles after insert or update or delete on tenant_memberships for each row execute function app.role_bundles_on_change();
drop trigger if exists scope_memberships_bundles on scope_memberships;
create trigger scope_memberships_bundles after insert or update or delete on scope_memberships for each row execute function app.role_bundles_on_change();

-- 束の行は束から作り直すもの。手で直す・消すのは個別の行だけ（束の行は役割を変えて変える）
create or replace function app.permissions_bundle_guard() returns trigger language plpgsql security definer set search_path = public, app as $$
begin
  if coalesce(current_setting('app.bundle_apply', true), '') <> 'on'
     and coalesce(current_setting('app.role', true), '') = 'member' and ((tg_op <> 'INSERT' and old.bundle_role is not null) or (tg_op <> 'DELETE' and new.bundle_role is not null)) then
    raise exception '役割の束の権限は、役割を変えて変える（個別の権限だけを直せる）' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists permissions_bundle_guard on permissions;
create trigger permissions_bundle_guard before insert or update or delete on permissions for each row execute function app.permissions_bundle_guard();

-- 前からあるワークスペースの所属に、束の行を作る
do $$ declare r record; begin
  for r in select tenant_id, member_id from tenant_memberships where deleted_at is null loop
    perform app.apply_role_bundles(r.tenant_id, r.member_id);
  end loop;
end $$;

insert into app.schema_migrations (name) values ('0080_permission_bundles.sql') on conflict do nothing;
