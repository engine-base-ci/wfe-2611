-- 0046 規約で自動操作が禁止のサービスと銀行を、全部許可でも本人の PC の上で止める（D-107・T-B-24）。
--   仕事を渡すたびに、サービス台帳で forbidden／bank のドメインを Bridge に渡す（資格情報は渡さない・D-107.7）。
--   Bridge は Claude Code に「使わない道具」とフック（道具を使う直前）で掛け、止めたら途中経過 blocked を送る。blocked は証跡にも残す（D-107.5）

-- 止める先（D-107.1）：台帳の今の可否が forbidden か bank のドメイン。形を揃える（小文字・先頭の scheme と www. と末尾の / を外す）
create or replace function app.bridge_blocked_domains() returns jsonb
language sql stable security definer set search_path = public, app as $$
  select coalesce(jsonb_agg(distinct jsonb_build_object('domain', d, 'service', coalesce(name, d), 'verdict', automation_verdict_id)), '[]'::jsonb)
    from (select s.name, s.automation_verdict_id,
                 regexp_replace(regexp_replace(lower(trim(s.domain)), '^[a-z]+://', ''), '^www\.|/.*$', '', 'g') as d
            from service_registry s
           where s.deleted_at is null and s.automation_verdict_id in ('forbidden', 'bank') and nullif(trim(coalesce(s.domain, '')), '') is not null) x
   where d ~ '^[a-z0-9.-]+\.[a-z]{2,}$'
$$;
grant execute on function app.bridge_blocked_domains() to kaname_app;

alter table bridge_job_events drop constraint if exists bridge_job_events_kind_check;
alter table bridge_job_events add constraint bridge_job_events_kind_check
  check (kind in ('init', 'progress', 'ask', 'answer', 'tool', 'usage', 'status', 'plan', 'steer', 'stop', 'question', 'limit', 'reply', 'blocked'));

-- 途中経過に blocked を足す（0041 の定義に 1 つ足しただけ）
create or replace function app.bridge_progress(p_session uuid, p_job uuid, p_seq int, p_kind text, p_payload jsonb) returns boolean
language plpgsql security definer set search_path = public, app as $$
declare v_member uuid; j bridge_jobs%rowtype; w jsonb;
begin
  select member_id into v_member from sessions where id = p_session and kind_id = 'bridge' and revoked_at is null;
  if v_member is null then return false; end if;
  select * into j from bridge_jobs where id = p_job and member_id = v_member and state_id in ('running', 'asking');
  if j.id is null then return false; end if;
  if p_kind not in ('init', 'progress', 'tool', 'usage', 'status', 'plan', 'limit', 'reply', 'blocked') then
    raise exception '途中経過は init／progress／tool／usage／status／plan／limit／reply／blocked';
  end if;
  insert into bridge_job_events (tenant_id, scope_id, member_id, job_id, kind, seq, payload)
    values (j.tenant_id, j.scope_id, j.member_id, j.id, p_kind, coalesce(p_seq, 0), coalesce(p_payload, '{}'::jsonb));
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
  elsif p_kind = 'reply' and j.conversation_id is not null then   -- 止めずに直した文の前の返事（区切りごとの答え）
    insert into messages (tenant_id, conversation_id, body, kind, job_id)
      values (j.tenant_id, j.conversation_id, left(coalesce(p_payload->>'text', ''), 200000), 'ai', j.id);
    update bridge_jobs set partial = null where id = j.id;
  end if;
  return true;
end $$;
grant execute on function app.bridge_progress(uuid, uuid, int, text, jsonb) to kaname_app;
