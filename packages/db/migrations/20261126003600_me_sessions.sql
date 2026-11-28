-- 20261126003600 入っている端末（K-836・listMySessions・revokeMySession・revokeOtherSessions・D-125.150・D-128.156・D-154.79）
--   端末の 1 行＝sessions の 1 行（1 つの部品のセッションは 1 つの会社にだけ結ぶ・auth_session_id は一意・0004）。
--   同じログイン（app.account_members＝tenant_memberships.auth_user_id が同じ人・D-125.150）の全部のワークスペースの行を並べる・切る。
--   PC（Bridge）は K-362 の app.device_revoke をそのまま使う（理由 device_removed・受け取って動いている仕事を止める・判定を 2 か所に書かない）。
--   画面・API の端末は理由 self_revoked（この migration が足す・「自分で切った」）。だれの端末かは app.user_id() で引き、引数で人を受けない。
--   どの関数も security definer・public から外し kaname_app に渡す。表・列は足さない（理由を 1 つ足すだけ）
insert into revoke_reasons (key, label) values ('self_revoked', '自分で切った') on conflict (key) do nothing;

-- 時刻を答えの字にする（ミリ秒まで・UTC）
create or replace function app.me_ts(p timestamptz) returns text
language sql stable set search_path = public, app, pg_temp as $$
  select case when p is null then null else to_char(p at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end
$$;
revoke all on function app.me_ts(timestamptz) from public;

-- 一覧：同じログインの全部の会社の生きている端末。今の端末（部品のセッションが p_current_auth_session）を先頭・あとは最後に使った順
create or replace function app.me_sessions_list(p_current_auth_session text) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare v_user uuid := app.user_id(); v_cur text := nullif(p_current_auth_session, ''); r jsonb;
begin
  if v_user is null then raise exception '端末を読むにはログインが要る' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.id, 'kind', s.kind_id, 'name', s.device_label, 'place', s.ip_region,
           'issued_at', app.me_ts(s.issued_at), 'last_seen_at', app.me_ts(s.last_seen_at),
           'current', coalesce(v_cur is not null and s.auth_session_id = v_cur, false))
         order by (v_cur is not null and s.auth_session_id = v_cur) desc, s.last_seen_at desc, s.id), '[]'::jsonb)
    into r
    from sessions s
   where s.member_id in (select app.account_members(v_user))
     and s.revoked_at is null and s.deleted_at is null;
  return r;
end $$;
revoke all on function app.me_sessions_list(text) from public;
grant execute on function app.me_sessions_list(text) to kaname_app;

-- 最近の安全の記録：同じログインの人の security_events（消していない）を新しい順に 10 件（読むだけ・D-154.79）
create or replace function app.me_security_events() returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare v_user uuid := app.user_id(); r jsonb;
begin
  if v_user is null then raise exception '記録を読むにはログインが要る' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', e.id, 'kind', e.kind_id, 'occurred_at', app.me_ts(e.occurred_at),
           'device', coalesce(e.detail->>'device', e.detail->>'to_device'), 'place', e.ip_region)
         order by e.occurred_at desc, e.id), '[]'::jsonb)
    into r
    from (select x.* from security_events x
           where x.member_id in (select app.account_members(v_user)) and x.deleted_at is null
           order by x.occurred_at desc, x.id limit 10) e;
  return r;
end $$;
revoke all on function app.me_security_events() from public;
grant execute on function app.me_security_events() to kaname_app;

-- 1 つ切る：自分のログインの生きている端末でなければ not_found（無い・切ってある・ほかの人・別の会社の人は同じ答え）。
--   今の端末なら current（切らない）。PC は app.device_revoke、ほかはその行を self_revoked で失効し安全の記録を残す。
--   行を for update で取るので、同じ端末を同時に 2 回切ると後の 1 回は not_found
create or replace function app.me_session_revoke(p_session uuid, p_current_auth_session text) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_user uuid := app.user_id(); s sessions%rowtype;
begin
  if v_user is null then raise exception '端末を切るにはログインが要る' using errcode = '42501'; end if;
  select * into s from sessions x
   where x.id = p_session and x.revoked_at is null and x.deleted_at is null
     and x.member_id in (select app.account_members(v_user))
   for update;
  if s.id is null then return jsonb_build_object('error', 'not_found'); end if;
  if nullif(p_current_auth_session, '') is not null and s.auth_session_id = p_current_auth_session then
    return jsonb_build_object('error', 'current');
  end if;
  if s.kind_id = 'bridge' then
    perform app.device_revoke(v_user, s.id);
  else
    update sessions set revoked_at = now(), revoke_reason_id = 'self_revoked', updated_by = v_user where id = s.id;
    perform app.record_security_event(s.tenant_id, 'sessions_revoked', s.member_id, null,
                                      jsonb_build_object('reason', 'self_revoked', 'count', 1, 'session_id', s.id));
  end if;
  return jsonb_build_object('ok', true, 'auth_session_id', s.auth_session_id);
end $$;
revoke all on function app.me_session_revoke(uuid, text) from public;
grant execute on function app.me_session_revoke(uuid, text) to kaname_app;

-- この端末以外をすべて切る：同じログインの、今の端末（p_keep）のほかの生きている端末。PC は 1 台ずつ app.device_revoke、
--   残りは app.revoke_sessions_for_auth_user_except（0113・K-312）。revoked は失効させた行の数（画面・API・PC とも 1 行で 1）。
--   auth_session_ids は切った端末の部品のセッション（口が認証の側の期限を今にする）
create or replace function app.me_sessions_revoke_others(p_auth_user_id text, p_keep text) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_user uuid := app.user_id(); v_ids text[]; v_pc uuid; n_pc int := 0; n_rest int := 0;
begin
  if v_user is null or p_auth_user_id is null or p_auth_user_id = '' then
    raise exception '端末を切るにはログインが要る' using errcode = '42501';
  end if;
  select coalesce(array_agg(s.auth_session_id) filter (where s.auth_session_id is not null), '{}')
    into v_ids
    from sessions s
   where s.member_id in (select app.account_members(v_user)) and s.revoked_at is null and s.deleted_at is null
     and s.auth_session_id is distinct from nullif(p_keep, '');
  for v_pc in
    select s.id from sessions s
     where s.member_id in (select app.account_members(v_user)) and s.kind_id = 'bridge'
       and s.revoked_at is null and s.deleted_at is null
       and s.auth_session_id is distinct from nullif(p_keep, '')
     order by s.id
  loop
    if app.device_revoke(v_user, v_pc) is not null then n_pc := n_pc + 1; end if;
  end loop;
  n_rest := app.revoke_sessions_for_auth_user_except(p_auth_user_id, nullif(p_keep, ''), 'self_revoked');
  return jsonb_build_object('ok', true, 'revoked', n_pc + n_rest, 'auth_session_ids', to_jsonb(v_ids));
end $$;
revoke all on function app.me_sessions_revoke_others(text, text) from public;
grant execute on function app.me_sessions_revoke_others(text, text) to kaname_app;
