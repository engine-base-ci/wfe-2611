-- 0004 sessions（T-F-05）。D-051（トークンベース）・D-076.1・G-14。
-- 認証（Better Auth）の表は schema auth に置き、公開の表とは分ける（RLS の対象は public。auth は kaname_auth ロールだけが触る＝境界 B2）。
-- 失効は public.sessions を全行 revoked にする方式。API・Bridge はトークンの期限ではなくこの表を見る。

create schema if not exists auth;
do $$ begin if not exists (select 1 from pg_roles where rolname = 'kaname_auth') then create role kaname_auth login password 'kaname_auth' nobypassrls; end if; end $$;
grant usage, create on schema auth to kaname_auth;
alter role kaname_auth set search_path = auth, public;
-- 認証の表は migration の実行者（管理者）が作る。作った表を kaname_auth（実行時）と kaname_app が使えるように既定の権限を置く
alter default privileges in schema auth grant select, insert, update, delete on tables to kaname_auth, kaname_app;
alter default privileges in schema auth grant usage, select on sequences to kaname_auth, kaname_app;
grant usage on schema auth to kaname_app;

insert into target_kinds (key, label) values ('sessions', '端末とセッション'), ('invitations', '招待'), ('audit_events', '証跡'), ('export_jobs', '持ち出し') on conflict do nothing;

-- 認証の利用者との対応（AI社員・自分のAI は null）
alter table members add column if not exists auth_user_id text unique;

-- マスタ（enum の代わり）
create table if not exists session_kinds (key text primary key, label text not null);
insert into session_kinds (key, label) values ('web', 'ブラウザ'), ('bridge', '自分の PC（Bridge）'), ('api', 'API・連携') on conflict do nothing;
create table if not exists revoke_reasons (key text primary key, label text not null);
insert into revoke_reasons (key, label) values ('logout', 'ログアウト'), ('password_changed', 'パスワード変更'), ('permission_changed', '権限変更'), ('member_left', '人が抜けた'), ('suspended', '停止'), ('tenant_closed', '退会'), ('invite_revoked', '招待取消'), ('expired', '期限切れ'), ('admin', '管理者の操作') on conflict do nothing;

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id),
  member_id uuid not null references members(id), kind_id text not null references session_kinds(key), auth_session_id text unique,
  device_label text, ip_region text, issued_at timestamptz not null default now(), last_seen_at timestamptz not null default now(),
  revoked_at timestamptz, revoke_reason_id text references revoke_reasons(key),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid, updated_by uuid, deleted_at timestamptz
);
create index if not exists sessions_member_live_idx on sessions (member_id) where revoked_at is null;
drop trigger if exists sessions_updated_at on sessions; create trigger sessions_updated_at before update on sessions for each row execute function app.set_updated_at();

create table if not exists invitations (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id),
  email text not null, scope_id uuid references scopes(id), role_id text, permission_preset jsonb not null default '{}'::jsonb,
  token_hash text not null unique, expires_at timestamptz not null, accepted_member_id uuid references members(id), revoked_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid, updated_by uuid, deleted_at timestamptz
);
drop trigger if exists invitations_updated_at on invitations; create trigger invitations_updated_at before update on invitations for each row execute function app.set_updated_at();

-- 全失効（G-14）：退会・停止・権限変更・パスワード変更・招待取消で、その人の生きているセッションを全部 revoked にし、出来事を残す
create or replace function app.revoke_all_sessions(p_member uuid, p_reason text) returns int
language plpgsql security definer set search_path = public, app as $$
declare n int; v_tenant uuid;
begin
  select tenant_id into v_tenant from members where id = p_member;
  update sessions set revoked_at = now(), revoke_reason_id = p_reason where member_id = p_member and revoked_at is null;
  get diagnostics n = row_count;
  if n > 0 then perform app.record_security_event(v_tenant, 'sessions_revoked', p_member, null, jsonb_build_object('reason', p_reason, 'count', n)); end if;
  return n;
end $$;

-- 生きているセッションか（API・Bridge の要求ごとに見る。トークンの期限に頼らない）
create or replace function app.session_alive(p_auth_session_id text) returns table (session_id uuid, member_id uuid, tenant_id uuid)
language sql security definer set search_path = public, app as $$
  select s.id, s.member_id, s.tenant_id from sessions s join members m on m.id = s.member_id
  where s.auth_session_id = p_auth_session_id and s.revoked_at is null and m.deleted_at is null
$$;

-- 権限が変わったらその人のセッションを全部失効（DB 層で 1 回）
create or replace function app.on_permission_change() returns trigger language plpgsql security definer set search_path = public, app as $$
begin
  perform app.revoke_all_sessions(coalesce(new.grantee_member_id, old.grantee_member_id), 'permission_changed');
  return coalesce(new, old);
end $$;
drop trigger if exists permissions_revoke_sessions on permissions;
create trigger permissions_revoke_sessions after insert or update or delete on permissions for each row execute function app.on_permission_change();

-- 人が抜けた（論理削除）らその人のセッションを全部失効
create or replace function app.on_member_left() returns trigger language plpgsql security definer set search_path = public, app as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then perform app.revoke_all_sessions(new.id, 'member_left'); end if;
  return new;
end $$;
drop trigger if exists members_revoke_sessions on members;
create trigger members_revoke_sessions after update on members for each row execute function app.on_member_left();


-- セッションを開く／閉じる（認証（Better Auth）の hook が呼ぶ。RLS の外＝security definer。誰でも呼べるのではなく kaname_auth／kaname_app だけ）
create or replace function app.open_session(p_auth_session_id text, p_auth_user_id text, p_kind text, p_device text, p_ip_region text) returns uuid
language plpgsql security definer set search_path = public, app as $$
declare v_member uuid; v_tenant uuid; v_id uuid;
begin
  select id, tenant_id into v_member, v_tenant from members where auth_user_id = p_auth_user_id and deleted_at is null;
  if v_member is null then return null; end if;   -- まだ会社に属していない利用者（登録の途中）はセッション表に載せない
  insert into sessions (tenant_id, member_id, kind_id, auth_session_id, device_label, ip_region) values (v_tenant, v_member, coalesce(p_kind, 'web'), p_auth_session_id, p_device, p_ip_region)
  on conflict (auth_session_id) do update set last_seen_at = now() returning id into v_id;
  return v_id;
end $$;

create or replace function app.close_session(p_auth_session_id text, p_reason text) returns int
language plpgsql security definer set search_path = public, app as $$
declare n int;
begin
  update sessions set revoked_at = now(), revoke_reason_id = coalesce(p_reason, 'logout') where auth_session_id = p_auth_session_id and revoked_at is null;
  get diagnostics n = row_count; return n;
end $$;

create or replace function app.touch_session(p_auth_session_id text) returns void language sql security definer set search_path = public, app as $$
  update sessions set last_seen_at = now() where auth_session_id = p_auth_session_id and revoked_at is null
$$;

grant select, insert, update, delete on all tables in schema public to kaname_app;
grant execute on function app.revoke_all_sessions(uuid, text), app.session_alive(text), app.open_session(text, text, text, text, text), app.close_session(text, text), app.touch_session(text) to kaname_app, kaname_auth;

insert into app.schema_migrations (name) values ('0004_sessions.sql') on conflict do nothing;
