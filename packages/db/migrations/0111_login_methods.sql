-- 0111 入り方を数える・「付けるまで進めない」の印・ほかを切る（K-308・D-128.61・D-128.137・D-128.141）
--   ① app.login_methods(auth_user_id)：パスキーの数・パスワードの有無・2 段階の有無。認証の表（kaname_auth）は業務の接続から読めない
--      （D-128.119）ので security definer の中だけで読む。migrate は migrateAuth より先に走るので、表は実行の時に引く（plpgsql の動的な文・
--      表がまだ無ければ 0／false）。パスキーの表は部品（@better-auth/passkey・K-304）が足す
--   ② sessions.mfa_pending：登録の直後でパスキーも 2 段階も無い人のセッションに立てる印（付けるまで先へ進めない・止めるのは入口の別の葉）。
--      人ごとでなくセッションごとに持つ（同意し直しの印 terms_pending・0088 と同じ形）
--   ③ app.mark_session_mfa(auth_session_id)：ログインでできたセッションに印を決める（packages/auth の hook が app.mark_session_terms の次に呼ぶ）。
--      PC（Bridge）のセッションには立てない（D-128.137）。運営のテナントの人にも立てる（同意し直しと違い、運営の人も入り方を付ける）
--   ④ app.settle_mfa_pending(auth_user_id)：入り方がそろった（パスキー 1 本以上か 2 段階あり）ら、その人の全部のワークスペースの
--      生きているセッションの印を下ろし、下ろした数を返す。そろっていなければ 0（印は残す）
--   ⑤ app.session_mfa_pending(session_id)：要求ごとに resolver が読む。Bridge のセッションは常に false
--   ⑥ app.revoke_sessions_for_auth_user_except(auth_user_id, keep_auth_session_id, reason)：パスワードを変えたとき（K-312）に、
--      その人の全部のワークスペースの端末と PC を、今の画面の 1 つのほか切る。人の引き方は 0109 と同じ（members.auth_user_id か
--      所属の行 tenant_memberships.auth_user_id）。切るのは安全な側なので抜けた・招待中の会社の端末も切り、記録（sessions_revoked）は
--      今いる会社にだけ書く（0106 と同じ条件・前の会社の管理者に見せない）
--   どの関数も PUBLIC から外し、アプリの接続（kaname_app）にだけ渡す（kaname_auth には付けない）

create or replace function app.login_methods(p_auth_user_id text)
returns table (passkeys int, has_password boolean, two_factor boolean)
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare v_pk int := 0; v_pw boolean := false; v_2fa boolean := false;
begin
  if p_auth_user_id is null or p_auth_user_id = '' then
    return query select 0, false, false;
    return;
  end if;
  if to_regclass('kaname_auth.passkey') is not null then
    execute 'select count(*)::int from kaname_auth.passkey where "userId" = $1' into v_pk using p_auth_user_id;
  end if;
  if to_regclass('kaname_auth.account') is not null then
    execute 'select exists (select 1 from kaname_auth.account where "userId" = $1 and "providerId" = ''credential''
                              and coalesce(password, '''') <> '''')'
      into v_pw using p_auth_user_id;
  end if;
  if to_regclass('kaname_auth."user"') is not null then
    execute 'select coalesce((select "twoFactorEnabled" from kaname_auth."user" where id = $1), false)'
      into v_2fa using p_auth_user_id;
  end if;
  return query select v_pk, coalesce(v_pw, false), coalesce(v_2fa, false);
end $$;
revoke all on function app.login_methods(text) from public;
grant execute on function app.login_methods(text) to kaname_app;

alter table sessions add column if not exists mfa_pending boolean not null default false;

-- 入り方がそろっていない（パスキー 0 本・2 段階なし）か。パスワードの有無は見ない（パスワードもパスキーも無い人は作れない）
create or replace function app.mfa_missing(p_auth_user_id text) returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select coalesce((select m.passkeys = 0 and not m.two_factor from app.login_methods(p_auth_user_id) m), false)
$$;
revoke all on function app.mfa_missing(text) from public;

-- その人の全部のワークスペースの人（members.auth_user_id か所属の行の auth_user_id・0109 と同じ引き方）
create or replace function app.members_of_auth_user(p_auth_user_id text) returns setof uuid
language sql stable security definer set search_path = public, app, pg_temp as $$
  select m.id from members m
   where m.auth_user_id = p_auth_user_id
      or exists (select 1 from tenant_memberships tm
                  where tm.tenant_id = m.tenant_id and tm.member_id = m.id and tm.auth_user_id = p_auth_user_id)
$$;
revoke all on function app.members_of_auth_user(text) from public;

create or replace function app.mark_session_mfa(p_auth_session_id text) returns boolean
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_id uuid; v_kind text; v_user text; v_pending boolean;
begin
  select s.id, s.kind_id, a."userId" into v_id, v_kind, v_user
    from sessions s join kaname_auth.session a on a.id = s.auth_session_id
   where s.auth_session_id = p_auth_session_id and s.revoked_at is null;
  if v_id is null or v_kind = 'bridge' then return false; end if;
  v_pending := app.mfa_missing(v_user);
  update sessions set mfa_pending = v_pending where id = v_id and mfa_pending is distinct from v_pending;
  return v_pending;
end $$;
revoke all on function app.mark_session_mfa(text) from public;
grant execute on function app.mark_session_mfa(text) to kaname_app;

create or replace function app.settle_mfa_pending(p_auth_user_id text) returns int
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare n int;
begin
  if p_auth_user_id is null or p_auth_user_id = '' or app.mfa_missing(p_auth_user_id) then return 0; end if;
  update sessions s set mfa_pending = false
   where s.member_id in (select app.members_of_auth_user(p_auth_user_id))
     and s.revoked_at is null and s.mfa_pending;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function app.settle_mfa_pending(text) from public;
grant execute on function app.settle_mfa_pending(text) to kaname_app;

create or replace function app.session_mfa_pending(p_session_id uuid) returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select coalesce((select s.mfa_pending and s.kind_id <> 'bridge' from sessions s where s.id = p_session_id), false)
$$;
revoke all on function app.session_mfa_pending(uuid) from public;
grant execute on function app.session_mfa_pending(uuid) to kaname_app;

create or replace function app.revoke_sessions_for_auth_user_except(p_auth_user_id text, p_keep_auth_session_id text, p_reason text)
returns int
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare total int := 0; n int; r record;
begin
  if p_auth_user_id is null or p_auth_user_id = '' then return 0; end if;
  for r in
    select m.id, m.tenant_id,
           m.deleted_at is null and not exists (
             select 1 from tenant_memberships tm
              where tm.tenant_id = m.tenant_id and tm.member_id = m.id
                and (tm.status in ('left', 'invited') or tm.deleted_at is not null)) as present
      from members m
     where m.id in (select app.members_of_auth_user(p_auth_user_id))
  loop
    update sessions set revoked_at = now(), revoke_reason_id = p_reason
     where member_id = r.id and revoked_at is null
       and auth_session_id is distinct from p_keep_auth_session_id;
    get diagnostics n = row_count;
    if n > 0 and r.present then
      perform app.record_security_event(r.tenant_id, 'sessions_revoked', r.id, null,
                                        jsonb_build_object('reason', p_reason, 'count', n));
    end if;
    total := total + n;
  end loop;
  return total;
end $$;
revoke all on function app.revoke_sessions_for_auth_user_except(text, text, text) from public;
grant execute on function app.revoke_sessions_for_auth_user_except(text, text, text) to kaname_app;

insert into app.schema_migrations (name) values ('0111_login_methods.sql') on conflict do nothing;
