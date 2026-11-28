-- 20261126003500 メールを変える（K-835・契約の口 requestEmailChange・verifyEmailChange・D-154.12・D-154.18・D-154.55・D-154.58・関門 C2）
--
-- ① 表 app.member_email_changes：待っている変更（新しいアドレス・リンクの印のハッシュ・期限 24 時間・使った・取り消した）。
--      app スキーマに置き、アプリの役は直に触れない（読み書きは下の関数だけ・前例 app.ticket_thread_seen）。リンクの印そのものは持たない
-- ② app.me_auth_user_id()：今のログインの人（app.user_id()・今の会社）のログインの id（members.auth_user_id か所属の行の auth_user_id）。
--      止めた人・消えた人・抜けた人・招待中は null。中で使うだけ（誰にも execute を渡さない）
-- ③ app.me_email_change_request(p_new_email, p_token_hash)：同じ宛て（same）・ほかのログインが使っている（taken）・
--      直近 1 時間に 5 回（too_many）を断り、前の待ちを取り消して新しい 1 つを作る。答えは { ok, expires_at }
-- ④ app.me_email_change_revoke(p_token_hash)：送れなかった頼みの待ちを取り消す（本人の物だけ）
-- ⑤ app.me_email_change_verify(p_token_hash)：行を錠で取り、invalid／used／expired／taken の順に確かめ、
--      kaname_auth."user" の email・emailVerified を変え・used_at を入れ・安全の記録 email_changed を全部のワークスペースに残す。
--      答えは { ok, old_email, new_email }（古いアドレスへの知らせは口が送る）
-- ⑥ app.me_email_pending()：K-833 の空の形を本物にする（同じログインの、待っている・期限内の新しいアドレスか null）
-- ⑦ app.record_security_event_for_auth_user：書ける出来事に email_changed を足す（会社の引き方は 0111 のまま）
--
-- 宛ては口が normalizeEmail でそろえてから渡す（小文字）。比べるときは kaname_auth の側を lower() にする。
-- 認証の表 kaname_auth."user" は同じ DB（plpgsql なので migration の時点で無くてよい・20261121091900 と同じ）
-- 中に begin／commit を書かない（migrate.ts が 1 本を 1 つの取引で当てる）。もう一度当てても誤りにならない形

create table if not exists app.member_email_changes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  member_id uuid not null references members(id),
  auth_user_id text not null,
  new_email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  constraint member_email_changes_email_len_ck check (char_length(new_email) between 3 and 254)
);
create index if not exists member_email_changes_user_idx on app.member_email_changes (auth_user_id, created_at desc);
drop trigger if exists member_email_changes_updated_at on app.member_email_changes;
create trigger member_email_changes_updated_at before update on app.member_email_changes
  for each row execute function app.set_updated_at();
-- アプリの役は表に直に触れない（security definer の関数だけが読み書きする）
revoke all on app.member_email_changes from public, kaname_app;

create or replace function app.me_auth_user_id() returns text
language sql stable security definer set search_path = public, app, pg_temp as $$
  select coalesce(m.auth_user_id, tm.auth_user_id)
    from members m
    left join tenant_memberships tm on tm.tenant_id = m.tenant_id and tm.member_id = m.id
   where m.id = app.user_id() and m.tenant_id = app.tenant_id()
     and m.deleted_at is null and m.suspended_at is null
     and (tm.id is null or (tm.status = 'active' and tm.deleted_at is null))
   limit 1
$$;
revoke all on function app.me_auth_user_id() from public;

create or replace function app.me_email_change_request(p_new_email text, p_token_hash text) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_auth text := app.me_auth_user_id();
  v_now_email text;
  v_expires timestamptz := now() + interval '24 hours';
begin
  if v_auth is null then return jsonb_build_object('error', 'forbidden'); end if;
  if p_new_email is null or p_token_hash is null or char_length(p_new_email) not between 3 and 254 then
    return jsonb_build_object('error', 'invalid');
  end if;
  select lower(u.email) into v_now_email from kaname_auth."user" u where u.id = v_auth;
  if v_now_email = lower(p_new_email) then return jsonb_build_object('error', 'same'); end if;
  if exists (select 1 from kaname_auth."user" u where lower(u.email) = lower(p_new_email) and u.id <> v_auth) then
    return jsonb_build_object('error', 'taken');
  end if;
  if (select count(*) from app.member_email_changes c
       where c.auth_user_id = v_auth and c.created_at > now() - interval '1 hour') >= 5 then
    return jsonb_build_object('error', 'too_many');
  end if;
  update app.member_email_changes
     set revoked_at = now(), updated_by = app.user_id()
   where auth_user_id = v_auth and used_at is null and revoked_at is null;
  insert into app.member_email_changes (tenant_id, member_id, auth_user_id, new_email, token_hash, expires_at, created_by, updated_by)
  values (app.tenant_id(), app.user_id(), v_auth, lower(p_new_email), p_token_hash, v_expires, app.user_id(), app.user_id());
  return jsonb_build_object('ok', true, 'expires_at', v_expires);
end $$;
revoke all on function app.me_email_change_request(text, text) from public;
grant execute on function app.me_email_change_request(text, text) to kaname_app;

create or replace function app.me_email_change_revoke(p_token_hash text) returns void
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_auth text := app.me_auth_user_id();
begin
  if v_auth is null or p_token_hash is null then return; end if;
  update app.member_email_changes
     set revoked_at = now(), updated_by = app.user_id()
   where token_hash = p_token_hash and auth_user_id = v_auth and used_at is null and revoked_at is null;
end $$;
revoke all on function app.me_email_change_revoke(text) from public;
grant execute on function app.me_email_change_revoke(text) to kaname_app;

create or replace function app.me_email_change_verify(p_token_hash text) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_auth text := app.me_auth_user_id();
  v_row app.member_email_changes%rowtype;
  v_old text;
begin
  if v_auth is null then return jsonb_build_object('error', 'forbidden'); end if;
  select * into v_row from app.member_email_changes where token_hash = p_token_hash for update;
  -- 無い・取り消した・別のログインの物は同じ答え（在るかを漏らさない）
  if not found or v_row.auth_user_id <> v_auth or v_row.revoked_at is not null or v_row.deleted_at is not null then
    return jsonb_build_object('error', 'invalid');
  end if;
  if v_row.used_at is not null then return jsonb_build_object('error', 'used'); end if;
  if v_row.expires_at <= now() then return jsonb_build_object('error', 'expired'); end if;
  if exists (select 1 from kaname_auth."user" u where lower(u.email) = lower(v_row.new_email) and u.id <> v_auth) then
    return jsonb_build_object('error', 'taken');
  end if;
  select u.email into v_old from kaname_auth."user" u where u.id = v_auth for update;
  update kaname_auth."user" set email = v_row.new_email, "emailVerified" = true, "updatedAt" = now() where id = v_auth;
  update app.member_email_changes set used_at = now(), updated_by = app.user_id() where id = v_row.id;
  perform app.record_security_event_for_auth_user(v_auth, 'email_changed', '{"link": true}'::jsonb);
  return jsonb_build_object('ok', true, 'old_email', v_old, 'new_email', v_row.new_email);
end $$;
revoke all on function app.me_email_change_verify(text) from public;
grant execute on function app.me_email_change_verify(text) to kaname_app;

-- K-833 の空の形（常に null）を本物にする。同じログインの物を見る（別の会社に切り替えても同じ宛てが出る）
create or replace function app.me_email_pending() returns text
language sql stable security definer set search_path = public, app, pg_temp as $$
  select c.new_email
    from app.member_email_changes c
   where c.auth_user_id = app.me_auth_user_id()
     and c.used_at is null and c.revoked_at is null and c.deleted_at is null and c.expires_at > now()
   order by c.created_at desc
   limit 1
$$;
revoke all on function app.me_email_pending() from public;

-- 書ける出来事に email_changed を足す（0116 の 4 つはそのまま・会社の引き方は 0111 の app.current_members_of_auth_user）
create or replace function app.record_security_event_for_auth_user(p_auth_user_id text, p_kind text, p_detail jsonb default '{}'::jsonb)
returns int
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_n int;
begin
  if p_kind not in ('password_reset_requested', 'password_reset_done', 'password_changed', 'password_set', 'email_changed') then
    raise exception 'ログインの出来事でない: %', p_kind using errcode = 'insufficient_privilege';
  end if;
  insert into security_events (tenant_id, kind_id, member_id, detail)
  select c.tenant_id, p_kind, c.member_id, coalesce(p_detail, '{}'::jsonb)
    from app.current_members_of_auth_user(p_auth_user_id) c;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function app.record_security_event_for_auth_user(text, text, jsonb) from public;
grant execute on function app.record_security_event_for_auth_user(text, text, jsonb) to kaname_app, kaname_auth;
