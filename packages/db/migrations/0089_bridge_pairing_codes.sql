-- 0089 PC をつなぐ（K-57・D-055・D-089・D-090・D-128.93・D-128.120・D-128.121・D-128.137）
--   接続コードは英数字 6 けた（見分けにくい 0・O・1・I・L を除く）・10 分・1 回だけ。DB にはハッシュだけ（bridge_pairing_codes・0075）。
--   PC の印（device_token）は引き取りのときに 1 回だけ返し、DB にはハッシュだけ（sessions.device_token_hash）。画面の一覧の番号（sessions.id）とは別の値。
--   つないだ PC はアカウント全体のもの（D-128.137）：同じログインの人（auth_user_id が同じ人）なら、どのワークスペースからも同じ PC として見える。
--   PC の印は時間では切らない（D-128.121）。切れるのは 外す・パスワード・人が抜ける・会社が止められる・国か端末が変わる（D-128.120）。
--   凍結の表 app.bridge_pairings（0020・平文のコード）と app.bridge_pair_new・app.bridge_claim は使うのをやめた（表は凍結のまま残す）。

alter table sessions add column if not exists device_token_hash text;     -- PC の印のハッシュ（sha256）。Bridge の行だけ
alter table sessions add column if not exists alive_at timestamptz;       -- 最初の生きている知らせが届いた時刻。届くまでは「つながっています」と言わない（D-090）
alter table sessions add column if not exists bridge_version text;        -- Bridge の版（生きている知らせが運ぶ）
alter table sessions add column if not exists machine_id uuid;            -- この PC の印（Bridge が入れたときに PC の中で作る UUID・D-128.174）。古い Bridge は送らないので空を許す
create index if not exists sessions_bridge_machine_idx on sessions (machine_id) where machine_id is not null and kind_id = 'bridge' and revoked_at is null;
create unique index if not exists sessions_device_token_uq on sessions (device_token_hash) where device_token_hash is not null;
do $$ begin
  alter table sessions add constraint sessions_device_token_len check (device_token_hash is null or length(device_token_hash) >= 32);
exception when duplicate_object then null;
end $$;
create index if not exists bridge_pairing_codes_hash_idx on bridge_pairing_codes (code_hash) where used_at is null and deleted_at is null;

insert into revoke_reasons (key, label) values ('replaced', '同じ PC でつなぎ直した') on conflict (key) do nothing;

-- 同じアカウント（同じログインの人）のメンバー。PC はアカウント全体のもの（D-128.137）
create or replace function app.account_members(p_member uuid) returns setof uuid
language sql stable security definer set search_path = public, app, pg_temp as $$
  with me as (
    select coalesce(m.auth_user_id, (select tm.auth_user_id from tenant_memberships tm where tm.member_id = m.id and tm.auth_user_id is not null limit 1)) as au
    from members m where m.id = p_member
  )
  select p_member
  union
  select m.id from members m, me where me.au is not null and m.auth_user_id = me.au
  union
  select tm.member_id from tenant_memberships tm, me where me.au is not null and tm.auth_user_id = me.au and tm.deleted_at is null
$$;
-- 中で使うだけ（security definer の関数から呼ぶ）。誰にも execute を渡さない（D-128.171）
revoke all on function app.account_members(uuid) from public;

-- コードを出す。その人（アカウント）の前の使っていないコードは使えなくしてから 1 行足す（10 分・1 回だけ）
create or replace function app.bridge_code_new(p_tenant uuid, p_member uuid, p_code_hash text) returns timestamptz
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_exp timestamptz;
begin
  if p_code_hash is null or length(p_code_hash) < 32 then raise exception 'コードはハッシュで渡す' using errcode = '22023'; end if;
  update bridge_pairing_codes set deleted_at = now()
    where member_id in (select app.account_members(p_member)) and used_at is null and deleted_at is null;
  insert into bridge_pairing_codes (tenant_id, member_id, code_hash, created_by)
    values (p_tenant, p_member, p_code_hash, p_member)
    returning expires_at into v_exp;
  return v_exp;
end $$;
revoke all on function app.bridge_code_new(uuid, uuid, text) from public;
grant execute on function app.bridge_code_new(uuid, uuid, text) to kaname_app;

-- 引き取る。期限内で使っていないコードだけを 1 回だけ使い終わりにし、同じ人（同じアカウント）・同じ PC の印（machine_id）の生きている行だけを切り、PC の行を 1 行作る。
--   名前では見分けない。印が空（古い Bridge）なら何も切らず、印の無い行は印のある Bridge からも切られない（D-128.174）。
-- 受け箱に「PC がつながりました」を 1 件。はじめにやることの「PC をつなぐ」に印。全部 1 つの処理（途中で失敗したら全部戻る）
create or replace function app.bridge_code_claim(p_code_hash text, p_label text, p_token_hash text, p_machine uuid default null)
returns table (session_id uuid, member_id uuid, tenant_id uuid)
language plpgsql security definer set search_path = public, app, pg_temp as $$
#variable_conflict use_column
declare c record; v_sid uuid;
begin
  if p_token_hash is null or length(p_token_hash) < 32 then raise exception 'PC の印はハッシュで渡す' using errcode = '22023'; end if;
  -- 同じコードを同時に 2 つの PC が引き取っても、取れるのは 1 つだけ（もう 1 つは行が錠で飛ばされ「使えません」）
  select x.id, x.tenant_id, x.member_id into c from bridge_pairing_codes x
    where x.code_hash = p_code_hash and x.used_at is null and x.deleted_at is null and x.expires_at > now()
    order by x.created_at desc limit 1 for update skip locked;
  if not found then return; end if;
  if not exists (select 1 from members m where m.id = c.member_id and m.deleted_at is null and m.suspended_at is null) then return; end if;
  if p_machine is not null then
    update sessions s set revoked_at = now(), revoke_reason_id = 'replaced'
      where s.member_id in (select app.account_members(c.member_id)) and s.kind_id = 'bridge' and s.revoked_at is null
        and s.machine_id = p_machine;
  end if;
  insert into sessions (tenant_id, member_id, kind_id, device_label, device_token_hash, machine_id, issued_at, last_seen_at, created_by)
    values (c.tenant_id, c.member_id, 'bridge', p_label, p_token_hash, p_machine, now(), now(), c.member_id)
    returning id into v_sid;
  update bridge_pairing_codes set used_at = now(), used_session_id = v_sid where id = c.id;
  perform app.setup_step_done(c.member_id, 1::smallint);
  insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, dedupe_key)
    values (c.tenant_id, c.member_id, 'inapp', 'bridge.connected', jsonb_build_object('device_id', v_sid, 'device_label', p_label), 'bridge_connected:' || v_sid);
  perform app.record_security_event(c.tenant_id, 'bridge_connected', c.member_id, null, jsonb_build_object('device_id', v_sid));
  session_id := v_sid; member_id := c.member_id; tenant_id := c.tenant_id;
  return next;
end $$;
revoke all on function app.bridge_code_claim(text, text, text, uuid) from public;
grant execute on function app.bridge_code_claim(text, text, text, uuid) to kaname_app;

-- PC の印 → 生きている PC の行。国か端末が変わったら切って理由を残す（app.session_check と同じ判定・D-128.120）。時間では切らない（D-128.121）
create or replace function app.bridge_device_check(p_token_hash text, p_country text, p_device text, p_ip text)
returns table (session_id uuid, member_id uuid, tenant_id uuid)
language plpgsql security definer set search_path = public, app, pg_temp as $$
#variable_conflict use_column
declare s record; why text;
begin
  select x.* into s from sessions x join members m on m.id = x.member_id join tenants t on t.id = x.tenant_id
    where x.device_token_hash = p_token_hash and x.kind_id = 'bridge' and x.revoked_at is null and x.deleted_at is null
      and m.deleted_at is null and m.suspended_at is null and t.deleted_at is null;
  if not found then return; end if;
  if p_country is not null and s.country is not null and upper(p_country) <> s.country then why := 'country_changed';
  elsif p_device is not null and s.device is not null and p_device <> s.device then why := 'device_changed';
  end if;
  if why is not null then
    update sessions set revoked_at = now(), revoke_reason_id = why where id = s.id;
    insert into security_events (tenant_id, kind_id, member_id, ip_region, detail, occurred_at)
    values (s.tenant_id, 'suspicious_connection', s.member_id, p_country,
            jsonb_build_object('reason', why, 'kind', 'bridge', 'from_country', s.country, 'to_country', upper(p_country), 'from_device', s.device, 'to_device', p_device), now());
    return;
  end if;
  update sessions set country = coalesce(country, upper(p_country)), device = coalesce(device, p_device), last_ip = coalesce(p_ip, last_ip)
    where id = s.id;
  session_id := s.id; member_id := s.member_id; tenant_id := s.tenant_id;
  return next;
end $$;
revoke all on function app.bridge_device_check(text, text, text, text) from public;
grant execute on function app.bridge_device_check(text, text, text, text) to kaname_app;

-- 生きている知らせ：最後に見えた時刻と、最初の知らせの時刻・自己診断・版を進める。重なって 2 回届いても行は増えない
create or replace function app.bridge_beat(p_session uuid, p_health jsonb, p_version text) returns boolean
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare n int;
begin
  update sessions set last_seen_at = now(), alive_at = coalesce(alive_at, now()),
         health = coalesce(p_health, health), health_at = case when p_health is null then health_at else now() end,
         bridge_version = coalesce(left(p_version, 40), bridge_version)
    where id = p_session and kind_id = 'bridge' and revoked_at is null;
  get diagnostics n = row_count; return n > 0;
end $$;
revoke all on function app.bridge_beat(uuid, jsonb, text) from public;
grant execute on function app.bridge_beat(uuid, jsonb, text) to kaname_app;

-- 仕事の問い合わせ（0037）も「生きている」の知らせ。最初の知らせの時刻もここで付く
create or replace function app.bridge_poll(p_session uuid) returns boolean
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_member uuid;
begin
  update sessions set last_seen_at = now(), alive_at = coalesce(alive_at, now())
   where id = p_session and kind_id = 'bridge' and revoked_at is null and deleted_at is null
   returning member_id into v_member;
  if v_member is null then return null; end if;
  return exists (select 1 from bridge_jobs j
                  where j.member_id = v_member and j.deleted_at is null
                    and (j.state_id in ('queued', 'running')
                         or j.created_at > now() - interval '5 minutes'
                         or j.finished_at > now() - interval '5 minutes'));
end $$;
revoke all on function app.bridge_poll(uuid) from public;
grant execute on function app.bridge_poll(uuid) to kaname_app;

-- 自分の PC の一覧（アカウント全体・D-128.137）。PC の印もそのハッシュも返さない。生きているのは最後の知らせから 75 秒（0058 と同じ）
create or replace function app.bridge_devices(p_member uuid) returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'device_label', s.device_label,
      'state', case when s.alive_at is null then 'waiting' when s.last_seen_at > now() - interval '75 seconds' then 'live' else 'asleep' end,
      'last_seen_at', case when s.alive_at is null then null else s.last_seen_at end,
      'connected_at', s.issued_at, 'version', s.bridge_version,
      'health', coalesce(s.health, '[]'::jsonb), 'revoke_reason', null
    ) order by s.last_seen_at desc), '[]'::jsonb)
  from sessions s
  where s.kind_id = 'bridge' and s.revoked_at is null and s.deleted_at is null
    and s.member_id in (select app.account_members(p_member))
$$;
revoke all on function app.bridge_devices(uuid) from public;
grant execute on function app.bridge_devices(uuid) to kaname_app;

-- 今の画面（会話など）が読む PC のいま（0058）も、アカウント全体の PC を見る。最初の知らせが届くまでは live にしない
create or replace function app.bridge_state(p_member uuid)
returns jsonb language plpgsql security definer set search_path = public, app, pg_temp as $$
declare s record;
begin
  select id, device_label, last_seen_at, alive_at, health, health_at, browser, cli_model into s from sessions
    where member_id in (select app.account_members(p_member)) and kind_id = 'bridge' and revoked_at is null and deleted_at is null
    order by last_seen_at desc limit 1;
  if s.id is null then return jsonb_build_object('connected', false, 'live', false); end if;
  return jsonb_build_object(
    'connected', true,
    'live', s.alive_at is not null and s.last_seen_at > now() - interval '75 seconds',
    'device_label', s.device_label,
    'last_seen_sec', floor(extract(epoch from (now() - s.last_seen_at)))::int,
    'health', s.health, 'health_at', s.health_at,
    'browser', s.browser,
    'cli_model', s.cli_model);
end $$;
revoke all on function app.bridge_state(uuid) from public;
grant execute on function app.bridge_state(uuid) to kaname_app;

-- 前の形（平文のコード・sessions の id が鍵）は使わせない
revoke execute on function app.bridge_pair_new(uuid, uuid) from kaname_app;
revoke execute on function app.bridge_claim(text, text) from kaname_app;

insert into app.schema_migrations (name) values ('0089_bridge_pairing_codes.sql') on conflict do nothing;
