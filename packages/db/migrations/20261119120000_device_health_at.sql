-- 20261119120000_device_health_at 自分の PC の一覧に、自己診断が届いた時刻（health_at）を足す（K-360・契約の口 listMyDevices・関門 C2）
--   画面が PC の行に「〈時刻〉の報告」と出せるようにする（眠っている PC の古い自己診断を、今の報告と見せない）。
--   app.bridge_devices(p_member uuid) → jsonb を置き換える。前の定義（0089）に 'health_at', s.health_at を 1 つ足すだけで、ほかは同じ：
--   引数・返す形（jsonb の並び）・守り（自分のアカウントの PC だけ・外した PC と消した PC は出さない・PC の印もそのハッシュも返さない）は変えない。
--   新しい表・列は作らない（sessions.health_at は 0027 からある・null 可。まだ報告が無い PC は null のまま返す）。行は書かない
create or replace function app.bridge_devices(p_member uuid) returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'device_label', s.device_label,
      'state', case when s.alive_at is null then 'waiting' when s.last_seen_at > now() - interval '75 seconds' then 'live' else 'asleep' end,
      'last_seen_at', case when s.alive_at is null then null else s.last_seen_at end,
      'connected_at', s.issued_at, 'version', s.bridge_version,
      'health', coalesce(s.health, '[]'::jsonb), 'health_at', s.health_at, 'revoke_reason', null
    ) order by s.last_seen_at desc), '[]'::jsonb)
  from sessions s
  where s.kind_id = 'bridge' and s.revoked_at is null and s.deleted_at is null
    and s.member_id in (select app.account_members(p_member))
$$;
revoke all on function app.bridge_devices(uuid) from public;
grant execute on function app.bridge_devices(uuid) to kaname_app;
