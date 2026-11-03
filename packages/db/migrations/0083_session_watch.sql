-- 0083 セッションの見張りと本人確認の取り直しの記録（KN-57・KN-56・D-125.140・D-128.120・D-128.121・ZT6）
--   操作が無いと 12 時間・最長 7 日で切る（管理者は会社ごとに短くできる。長くはできない）。PC に常駐する Bridge は時間では切らない（D-128.121）。
--   国（配布先 Vercel が付ける x-vercel-ip-country）か端末（ブラウザの種類・OS）が変わったら切って入り直させる。
--   同じ国の中で IP だけ変わったら切らず、セキュリティの出来事（security_events）に記録だけ残す。国の印が無い所（ローカル・Docker）では国では判定しない。
--   要求ごとに app.session_check を呼ぶ（app.session_alive は読むだけの古い形。解決は session_check に替える）。

alter table sessions add column if not exists country text;          -- 国（ISO 3166-1 の 2 文字）。印が無ければ null
alter table sessions add column if not exists device text;           -- 端末（ブラウザの種類・OS。例 chrome/macos）
alter table sessions add column if not exists last_ip text;          -- 最後に見た IP（記録用。切る理由にはしない）

alter table tenants add column if not exists session_idle_hours int not null default 12;
alter table tenants add column if not exists session_max_days int not null default 7;
do $$ begin
  alter table tenants add constraint tenants_session_idle_ck check (session_idle_hours between 1 and 12);
  alter table tenants add constraint tenants_session_max_ck check (session_max_days between 1 and 7);
exception when duplicate_object then null;
end $$;

insert into revoke_reasons (key, label) values
  ('idle', '操作が無い時間が長すぎる'),
  ('max_age', '最長の長さを超えた'),
  ('country_changed', '国が変わった'),
  ('device_changed', '端末が変わった')
on conflict (key) do nothing;

-- 要求ごとの確かめ。生きていれば行を返し（last_seen と IP を進める）、切るときは理由を付けて閉じ、何も返さない
create or replace function app.session_check(p_auth_session_id text, p_country text, p_device text, p_ip text)
returns table (session_id uuid, member_id uuid, tenant_id uuid)
language plpgsql security definer set search_path = public, app as $$
#variable_conflict use_column
declare s record; idle_h int; max_d int; why text;
begin
  select x.*, t.session_idle_hours, t.session_max_days into s
  from sessions x join members m on m.id = x.member_id join tenants t on t.id = x.tenant_id
  where x.auth_session_id = p_auth_session_id and x.revoked_at is null and m.deleted_at is null;
  if not found then return; end if;
  idle_h := coalesce(s.session_idle_hours, 12); max_d := coalesce(s.session_max_days, 7);
  -- 時間で切るのは画面のセッションだけ。PC に常駐する Bridge は時間では切らない（D-128.121）
  if s.kind_id <> 'bridge' and s.last_seen_at < now() - make_interval(hours => idle_h) then why := 'idle';
  elsif s.kind_id <> 'bridge' and s.issued_at < now() - make_interval(days => max_d) then why := 'max_age';
  elsif p_country is not null and s.country is not null and upper(p_country) <> s.country then why := 'country_changed';
  elsif p_device is not null and s.device is not null and p_device <> s.device then why := 'device_changed';
  end if;
  if why is not null then
    update sessions set revoked_at = now(), revoke_reason_id = why where id = s.id;
    if why in ('country_changed', 'device_changed') then
      insert into security_events (tenant_id, kind_id, member_id, ip_region, detail, occurred_at)
      values (s.tenant_id, 'suspicious_connection', s.member_id, p_country,
              jsonb_build_object('reason', why, 'from_country', s.country, 'to_country', upper(p_country), 'from_device', s.device, 'to_device', p_device), now());
    end if;
    return;
  end if;
  if p_ip is not null and s.last_ip is not null and p_ip <> s.last_ip then
    insert into security_events (tenant_id, kind_id, member_id, ip_region, detail, occurred_at)
    values (s.tenant_id, 'ip_changed', s.member_id, coalesce(upper(p_country), s.country), jsonb_build_object('from_ip', s.last_ip, 'to_ip', p_ip), now());
  end if;
  update sessions set last_seen_at = now(),
                      last_ip = coalesce(p_ip, last_ip),
                      country = coalesce(country, upper(p_country)),
                      device = coalesce(device, p_device)
  where id = s.id;
  session_id := s.id; member_id := s.member_id; tenant_id := s.tenant_id;
  return next;
end $$;
grant execute on function app.session_check(text, text, text, text) to kaname_app;

-- 新しい端末か（この人がこの端末で前にログインしたことが無い）。ログインのときに 1 回見て、本人に知らせる
create or replace function app.session_first_on_device(p_auth_session_id text, p_country text, p_device text, p_ip text)
returns table (member_id uuid, tenant_id uuid, is_new boolean)
language plpgsql security definer set search_path = public, app as $$
#variable_conflict use_column
declare s record;
begin
  update sessions set country = coalesce(country, upper(p_country)), device = coalesce(device, p_device), last_ip = coalesce(last_ip, p_ip)
  where auth_session_id = p_auth_session_id returning id, sessions.member_id, sessions.tenant_id, sessions.device into s;
  if not found then return; end if;
  member_id := s.member_id; tenant_id := s.tenant_id;
  is_new := s.device is not null and not exists (
    select 1 from sessions o where o.member_id = s.member_id and o.id <> s.id and o.device = s.device
  );
  if is_new then
    insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, dedupe_key)
    values (s.tenant_id, s.member_id, 'inapp', 'security.new_device', jsonb_build_object('device', s.device, 'session_id', s.id), 'new_device:' || s.id);
  end if;
  return next;
end $$;
grant execute on function app.session_first_on_device(text, text, text, text) to kaname_app;

-- 本人確認の取り直しの結果を残す（KN-56）。通ったらセッションに時刻を付ける（app.mark_step_up と同じ）。成功も失敗も security_events に
create or replace function app.record_step_up(p_auth_session_id text, p_ok boolean, p_detail jsonb) returns boolean
language plpgsql security definer set search_path = public, app as $$
#variable_conflict use_column
declare s record;
begin
  select id, tenant_id, member_id into s from sessions where auth_session_id = p_auth_session_id and revoked_at is null;
  if not found then return false; end if;
  insert into security_events (tenant_id, kind_id, member_id, detail, occurred_at)
  values (s.tenant_id, case when p_ok then 'step_up' else 'step_up_failed' end, s.member_id, coalesce(p_detail, '{}'::jsonb), now());
  if p_ok then update sessions set step_up_at = now() where id = s.id; end if;
  return p_ok;
end $$;
grant execute on function app.record_step_up(text, boolean, jsonb) to kaname_app;

insert into app.schema_migrations (name) values ('0083_session_watch.sql') on conflict do nothing;
