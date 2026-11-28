-- 0058 この PC の Claude Code がふだん使うモデルを覚える（2026-09-30 user「モデル単位になっている？ Claude と見比べろ」）。
--   何も選んでいない仕事の開始の知らせ（init の model）で分かる。画面のモデルのボタンに実際のモデル名（例 Opus 4.8）を出す
alter table sessions add column if not exists cli_model text;

create or replace function app.bridge_progress(p_session uuid, p_job uuid, p_seq integer, p_kind text, p_payload jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'app'
AS $$
declare v_member uuid; j bridge_jobs%rowtype; w jsonb;
begin
  select member_id into v_member from sessions where id = p_session and kind_id = 'bridge' and revoked_at is null;
  if v_member is null then return false; end if;
  select * into j from bridge_jobs where id = p_job and member_id = v_member and state_id in ('running', 'asking');
  if j.id is null then return false; end if;
  if p_kind not in ('init', 'progress', 'tool', 'usage', 'status', 'plan', 'limit', 'reply', 'blocked', 'notice') then
    raise exception '途中経過は init／progress／tool／usage／status／plan／limit／reply／blocked／notice';
  end if;
  insert into bridge_job_events (tenant_id, scope_id, member_id, job_id, kind, seq, payload)
    values (j.tenant_id, j.scope_id, j.member_id, j.id, p_kind, coalesce(p_seq, 0), coalesce(p_payload, '{}'::jsonb));
  -- 何も選んでいない仕事の開始の知らせのモデル＝この PC の Claude Code がふだん使うモデル（画面に実際のモデル名を出す・0058）
  if p_kind = 'init' and j.model is null and (p_payload->>'model') ~ '^[A-Za-z0-9.-]{1,60}$' then
    update sessions set cli_model = p_payload->>'model' where id = p_session and cli_model is distinct from (p_payload->>'model');
  end if;
  if p_kind = 'init' and (p_payload->>'agent_session_id') is not null then
    update bridge_jobs set agent_session_id = p_payload->>'agent_session_id' where id = j.id;
    if j.conversation_id is not null then
      update conversations set agent_session_id = p_payload->>'agent_session_id'
        where id = j.conversation_id and agent_session_id is distinct from (p_payload->>'agent_session_id');
    end if;
  elsif p_kind = 'limit' then   -- 使用量（D-104.16）：枠ごとに最新だけ
    for w in select * from jsonb_array_elements(coalesce(p_payload->'windows', '[]'::jsonb)) loop
      update agent_usage_snapshots set utilization = (w->>'utilization')::numeric, resets_at = to_timestamp((w->>'resets_at')::double precision), observed_at = now()
        where member_id = j.member_id and window_id = w->>'window' and deleted_at is null;
      if not found then
        insert into agent_usage_snapshots (tenant_id, member_id, window_id, utilization, resets_at, observed_at, created_by)
          values (j.tenant_id, j.member_id, w->>'window', (w->>'utilization')::numeric, to_timestamp((w->>'resets_at')::double precision), now(), j.member_id);
      end if;
    end loop;
  elsif p_kind = 'blocked' then   -- 台帳で禁止・銀行の宛先を PC の上で止めた（D-107.5）。誰の仕事・どのサービス・どの道具を証跡に
    insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
      values (j.tenant_id, j.member_id, 'bridge', 'agent.blocked', 'bridge_job', j.id::text, 'C1',
              jsonb_build_object('tool', left(coalesce(p_payload->>'tool', ''), 80), 'domain', left(coalesce(p_payload->>'domain', ''), 200),
                                 'service', left(coalesce(p_payload->>'service', ''), 120), 'target', left(coalesce(p_payload->>'target', ''), 300)), j.member_id);
  elsif p_kind = 'notice' and j.conversation_id is not null then
    -- Bridge からの知らせ（D-119：Chrome とつながっていない 等）。会話の流れに残す（黙って終わらない）。同じ仕事で同じ文は 1 回だけ
    if coalesce(trim(p_payload->>'text'), '') <> ''
       and not exists (select 1 from messages m where m.job_id = j.id and m.kind = 'note' and m.body = left(p_payload->>'text', 400) and m.deleted_at is null) then
      insert into messages (tenant_id, conversation_id, body, kind, job_id)
        values (j.tenant_id, j.conversation_id, left(p_payload->>'text', 400), 'note', j.id);
    end if;
  elsif p_kind = 'reply' and j.conversation_id is not null
        -- 記録から写した同じ文があれば重ねない（D-112）
        and not exists (select 1 from messages m where m.job_id = j.id and m.kind = 'ai' and m.deleted_at is null and btrim(m.body) = btrim(coalesce(p_payload->>'text', ''))) then
    insert into messages (tenant_id, conversation_id, body, kind, job_id)
      values (j.tenant_id, j.conversation_id, left(coalesce(p_payload->>'text', ''), 200000), 'ai', j.id);
    update bridge_jobs set partial = null where id = j.id;
  end if;
  return true;
end $$;
grant execute on function app.bridge_progress(uuid, uuid, integer, text, jsonb) to kaname_app;

create or replace function app.bridge_state(p_member uuid)
returns jsonb language plpgsql security definer set search_path = public, app as $$
declare s record;
begin
  select id, device_label, last_seen_at, health, health_at, browser, cli_model into s from sessions
    where member_id = p_member and kind_id = 'bridge' and revoked_at is null and deleted_at is null
    order by last_seen_at desc limit 1;
  if s.id is null then return jsonb_build_object('connected', false, 'live', false); end if;
  return jsonb_build_object(
    'connected', true,
    'live', s.last_seen_at > now() - interval '75 seconds',
    'device_label', s.device_label,
    'last_seen_sec', floor(extract(epoch from (now() - s.last_seen_at)))::int,
    'health', s.health, 'health_at', s.health_at,
    'browser', s.browser,
    'cli_model', s.cli_model);
end $$;
grant execute on function app.bridge_state(uuid) to kaname_app;
