-- 0057 AI が使うブラウザを PC ごとに Kaname で選ぶ（D-120.1）・もう一度確かめる（D-120.3）。
--   sessions.browser：Bridge の端末（kind 'bridge'）ごとの選択。Kaname が正本で、仕事と一緒に Bridge に渡す（Bridge の窓でも変えられる）
--   bridge_jobs.browser：その仕事だけの指定（もう一度確かめる仕事は chrome）。空なら端末の選択（会話の無い仕事は使わない）

alter table sessions add column if not exists browser text not null default 'chrome';
alter table sessions drop constraint if exists sessions_browser_check;
alter table sessions add constraint sessions_browser_check check (browser in ('chrome', 'dedicated', 'off'));
alter table bridge_jobs add column if not exists browser text;
alter table bridge_jobs drop constraint if exists bridge_jobs_browser_check;
alter table bridge_jobs add constraint bridge_jobs_browser_check check (browser is null or browser in ('chrome', 'dedicated', 'off'));

-- 本人がいまの端末（画面に出している 1 台＝最後に知らせが来た端末）の選択を変える
create or replace function app.agent_set_browser(p_member uuid, p_browser text) returns boolean
language plpgsql security definer set search_path = public, app as $$
declare v_sid uuid;
begin
  if p_browser not in ('chrome', 'dedicated', 'off') then return false; end if;
  select id into v_sid from sessions
    where member_id = p_member and kind_id = 'bridge' and revoked_at is null and deleted_at is null
    order by last_seen_at desc nulls last limit 1;
  if v_sid is null then return false; end if;
  update sessions set browser = p_browser, updated_at = now(), updated_by = p_member where id = v_sid;
  return true;
end $$;
grant execute on function app.agent_set_browser(uuid, text) to kaname_app;

-- Bridge の窓から変える（同じ値。どちらで変えても同じ）
create or replace function app.bridge_set_browser(p_session uuid, p_browser text) returns boolean
language plpgsql security definer set search_path = public, app as $$
begin
  if p_browser not in ('chrome', 'dedicated', 'off') then return false; end if;
  update sessions set browser = p_browser, updated_at = now() where id = p_session and kind_id = 'bridge' and revoked_at is null;
  return found;
end $$;
grant execute on function app.bridge_set_browser(uuid, text) to kaname_app;

-- 端末の選択を読む（Bridge の窓に出す）
create or replace function app.bridge_browser(p_session uuid) returns text
language sql stable security definer set search_path = public, app as $$
  select browser from sessions where id = p_session and kind_id = 'bridge' and revoked_at is null;
$$;
grant execute on function app.bridge_browser(uuid) to kaname_app;

-- 仕事に渡すブラウザ：仕事の指定 → 会話の仕事なら端末の選択 → それ以外（記憶のまとめ）は使わない
create or replace function app.bridge_job_browser(p_session uuid, p_job uuid) returns text
language sql stable security definer set search_path = public, app as $$
  select coalesce(j.browser, case when j.conversation_id is not null then s.browser else 'off' end)
    from bridge_jobs j join sessions s on s.member_id = j.member_id
   where j.id = p_job and s.id = p_session and s.kind_id = 'bridge' and s.revoked_at is null;
$$;
grant execute on function app.bridge_job_browser(uuid, uuid) to kaname_app;

-- もう一度確かめる（D-120.3）：Bridge が小さな仕事（タブの一覧を見るだけ）で Chrome を本当に使えるか試す。会話には出さない。
--   PC が閉じているときは始めない（null）。確かめている最中なら同じ仕事を返す（押し重ねない）
create or replace function app.agent_browser_check(p_member uuid, p_prompt text) returns uuid
language plpgsql security definer set search_path = public, app as $$
declare m members%rowtype; v_job uuid;
begin
  select * into m from members where id = p_member and deleted_at is null;
  if m.id is null then return null; end if;
  if not exists (select 1 from sessions where member_id = p_member and kind_id = 'bridge' and revoked_at is null
                  and coalesce(last_seen_at, issued_at) > now() - interval '75 seconds') then return null; end if;
  select id into v_job from bridge_jobs
    where member_id = p_member and browser = 'chrome' and conversation_id is null and state_id in ('queued', 'running') and deleted_at is null
    order by created_at desc limit 1;
  if v_job is not null then return v_job; end if;
  insert into bridge_jobs (tenant_id, scope_id, member_id, state_id, prompt, permission_mode, browser, created_by)
    values (m.tenant_id, m.scope_id, p_member, 'queued', p_prompt, 'manual', 'chrome', p_member) returning id into v_job;
  return v_job;
end $$;
grant execute on function app.agent_browser_check(uuid, text) to kaname_app;

-- 画面の PC の状態に、いまの選択を足す（0032 を置き換え）
create or replace function app.bridge_state(p_member uuid)
returns jsonb language plpgsql security definer set search_path = public, app as $$
declare s record;
begin
  select id, device_label, last_seen_at, health, health_at, browser into s from sessions
    where member_id = p_member and kind_id = 'bridge' and revoked_at is null and deleted_at is null
    order by last_seen_at desc limit 1;
  if s.id is null then return jsonb_build_object('connected', false, 'live', false); end if;
  return jsonb_build_object(
    'connected', true,
    'live', s.last_seen_at > now() - interval '75 seconds',
    'device_label', s.device_label,
    'last_seen_sec', floor(extract(epoch from (now() - s.last_seen_at)))::int,
    'health', s.health, 'health_at', s.health_at,
    'browser', s.browser);
end $$;
grant execute on function app.bridge_state(uuid) to kaname_app;
