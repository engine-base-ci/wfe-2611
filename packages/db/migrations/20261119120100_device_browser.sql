-- 20261119120100_device_browser AI が使うブラウザを PC ごとに選ぶ（K-364・契約の口 updateMyDevice・一覧 listMyDevices・関門 C2）
--   PC はアカウントのもの（D-128.137・D-128.156）。どのワークスペースの画面からでも自分の PC を選べ、他の人の PC には触れない。
--   持ち主の確かめは口（app.bridge_devices）と、この DB の関数（app.account_members）の 2 重（D-128.166）。
--   新しい表・列は作らない（sessions.browser は 0057 からある・check：chrome／dedicated／off・既定 chrome）。

-- ① 選ぶ：その人のアカウントの、外していない・消していない Bridge の行の browser を 1 つの update で変える。
--   値が 3 つのどれでもない・行が無い（他の人の PC・外した PC・消した PC・無い PC）はどれも null（区別を漏らさない）。
--   走っている仕事（bridge_jobs）は触らない（Bridge が仕事を取るときに決める・次の仕事から効く）
create or replace function app.device_set_browser(p_member uuid, p_session uuid, p_browser text) returns jsonb
language sql security definer set search_path = public, app, pg_temp as $$
  update sessions set browser = p_browser, updated_at = now(), updated_by = p_member
  where p_browser in ('chrome', 'dedicated', 'off')
    and id = p_session and kind_id = 'bridge' and revoked_at is null and deleted_at is null
    and member_id in (select app.account_members(p_member))
  returning jsonb_build_object('id', id, 'browser', browser)
$$;
revoke all on function app.device_set_browser(uuid, uuid, text) from public;
grant execute on function app.device_set_browser(uuid, uuid, text) to kaname_app;

-- ② 一覧：K-360（20261119120000）の形（health_at 込み）のまま、1 行に 'browser', s.browser を 1 つ足す。
--   引数・並び（最後に見えた順）・絞り方（自分のアカウントの PC だけ・外した PC と消した PC は出さない・PC の印もそのハッシュも返さない）は変えない
create or replace function app.bridge_devices(p_member uuid) returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'device_label', s.device_label,
      'state', case when s.alive_at is null then 'waiting' when s.last_seen_at > now() - interval '75 seconds' then 'live' else 'asleep' end,
      'last_seen_at', case when s.alive_at is null then null else s.last_seen_at end,
      'connected_at', s.issued_at, 'version', s.bridge_version,
      'health', coalesce(s.health, '[]'::jsonb), 'health_at', s.health_at, 'browser', s.browser, 'revoke_reason', null
    ) order by s.last_seen_at desc), '[]'::jsonb)
  from sessions s
  where s.kind_id = 'bridge' and s.revoked_at is null and s.deleted_at is null
    and s.member_id in (select app.account_members(p_member))
$$;
revoke all on function app.bridge_devices(uuid) from public;
grant execute on function app.bridge_devices(uuid) to kaname_app;
