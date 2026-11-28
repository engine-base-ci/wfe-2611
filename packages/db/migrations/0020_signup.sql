-- 0020_signup.sql：登録・招待・ログインの裏側（W11 T-U-01〜05）。app schema の関数と内部表（ER図のオブジェクトではない）
-- 会社を作る（登録の直後：Better Auth の user.create hook が呼ぶ）。会社・根の層・代表のメンバー・全権限・自分のAI を 1 トランザクションで
create or replace function app.create_company(p_auth_user_id text, p_company text, p_display_name text) returns uuid
language plpgsql security definer set search_path = public, app as $$
declare v_tenant uuid; v_scope uuid; v_member uuid;
begin
  if exists (select 1 from members where auth_user_id = p_auth_user_id and deleted_at is null) then
    raise exception 'この利用者は既に会社に属している' using errcode = 'unique_violation';
  end if;
  insert into tenants (id, tenant_id, name) select u, u, left(trim(p_company), 120) from gen_random_uuid() u returning id into v_tenant;
  insert into scopes (tenant_id, name) values (v_tenant, '会社') returning id into v_scope;
  insert into members (tenant_id, scope_id, kind_id, display_name, auth_user_id) values (v_tenant, v_scope, 'human', left(trim(p_display_name), 80), p_auth_user_id) returning id into v_member;
  update members set created_by = v_member where id = v_member;
  insert into permissions (tenant_id, grantee_member_id, target_kind_id, ability_id, granted_by)
    select v_tenant, v_member, tk.key, a.key, v_member from target_kinds tk cross join (values ('view'), ('edit')) as a(key);
  insert into clones (tenant_id, owner_member_id, persona, created_by) values (v_tenant, v_member, null, v_member);
  perform app.record_security_event(v_tenant, 'company_created', v_member, null, jsonb_build_object('auth_user_id', p_auth_user_id));
  return v_tenant;
end $$;
grant execute on function app.create_company(text, text, text) to kaname_app, kaname_auth;

-- 招待の下見（リンクを押した人が、受ける前に見るもの）。会社名・役割・期限・取り消し。トークンは hash で引く
create or replace function app.invitation_preview(p_token_hash text)
returns table (tenant_name text, role_id text, email text, expires_at timestamptz, revoked boolean, accepted boolean, expired boolean)
language sql security definer set search_path = public, app as $$
  select t.name, i.role_id, i.email, i.expires_at, i.revoked_at is not null or i.deleted_at is not null, i.accepted_member_id is not null, i.expires_at < now()
  from invitations i join tenants t on t.id = i.tenant_id where i.token_hash = p_token_hash
$$;
grant execute on function app.invitation_preview(text) to kaname_app, kaname_auth;

-- ログインの連続失敗（E-AUTH-001／002）：5 回で 15 分ロック。メールは hash で持つ（登録の有無を漏らさない・値を残さない）
create table if not exists app.login_attempts (
  email_hash text primary key,
  fails int not null default 0,
  first_failed_at timestamptz,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on app.login_attempts to kaname_app, kaname_auth;
-- 失敗を 1 回足す。戻り：残り回数（0 ならロック）と locked_until
create or replace function app.login_failed(p_email_hash text, p_max int default 5, p_lock_minutes int default 15)
returns table (remaining int, locked_until timestamptz)
language plpgsql security definer set search_path = app, public as $$
declare r app.login_attempts%rowtype;
begin
  insert into app.login_attempts (email_hash, fails, first_failed_at) values (p_email_hash, 0, now())
    on conflict (email_hash) do nothing;
  select * into r from app.login_attempts where email_hash = p_email_hash for update;
  if r.locked_until is not null and r.locked_until > now() then
    return query select 0, r.locked_until; return;
  end if;
  if r.first_failed_at is null or r.first_failed_at < now() - make_interval(mins => p_lock_minutes) then
    r.fails := 0; r.first_failed_at := now();
  end if;
  r.fails := r.fails + 1;
  if r.fails >= p_max then
    update app.login_attempts set fails = r.fails, first_failed_at = r.first_failed_at, locked_until = now() + make_interval(mins => p_lock_minutes), updated_at = now() where email_hash = p_email_hash;
    return query select 0, now() + make_interval(mins => p_lock_minutes); return;
  end if;
  update app.login_attempts set fails = r.fails, first_failed_at = r.first_failed_at, locked_until = null, updated_at = now() where email_hash = p_email_hash;
  return query select p_max - r.fails, null::timestamptz;
end $$;
-- いまロック中か（ログインの前に見る）
create or replace function app.login_locked_until(p_email_hash text) returns timestamptz
language sql security definer set search_path = app, public as $$
  select locked_until from app.login_attempts where email_hash = p_email_hash and locked_until > now()
$$;
-- 成功したら消す
create or replace function app.login_ok(p_email_hash text) returns void
language sql security definer set search_path = app, public as $$
  delete from app.login_attempts where email_hash = p_email_hash
$$;
grant execute on function app.login_failed(text, int, int), app.login_locked_until(text), app.login_ok(text) to kaname_app, kaname_auth;

-- Bridge の接続コード（自分の PC をつなぐ：T-U-09）。画面が発行し、Bridge が入れて claim する（claim は T-I-*）
create table if not exists app.bridge_pairings (
  code text primary key,
  tenant_id uuid not null,
  member_id uuid not null,
  expires_at timestamptz not null,
  claimed_at timestamptz,
  device_label text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on app.bridge_pairings to kaname_app;
create or replace function app.bridge_pair_new(p_tenant uuid, p_member uuid) returns text
language plpgsql security definer set search_path = app, public as $$
declare v_code text;
begin
  v_code := 'KNM-' || lpad((floor(random() * 10000))::int::text, 4, '0');
  delete from app.bridge_pairings where member_id = p_member and claimed_at is null;
  insert into app.bridge_pairings (code, tenant_id, member_id, expires_at) values (v_code, p_tenant, p_member, now() + interval '10 minutes')
    on conflict (code) do update set tenant_id = excluded.tenant_id, member_id = excluded.member_id, expires_at = excluded.expires_at, claimed_at = null;
  return v_code;
end $$;
grant execute on function app.bridge_pair_new(uuid, uuid) to kaname_app;

-- 資格情報の種類（ER図 E15 のマスタ。gen_ddl は表だけを作るので値はここで）
insert into credential_kinds (key, label) values ('password_totp', 'ID・パスワード（＋認証アプリ）'), ('oauth2', '正規連携（OAuth）'), ('api_key', 'API キー'), ('basic', 'ID・パスワード'), ('email_otp', 'メールのワンタイムコード'), ('saml', 'SAML') on conflict do nothing;

insert into app.schema_migrations (name) values ('0020_signup.sql') on conflict do nothing;
