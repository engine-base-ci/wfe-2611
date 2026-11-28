-- 0053 自分のAI の会話は本人の PC の Claude Code の記録が正本（D-112）。Bridge が自分のAI の文を記録と同じ id で写す。
--   同じ会話で同じ id は二度入れない。仕事の結末は、写した文があれば答えの吹き出しを足さない

alter table messages add column if not exists transcript_uuid text;
create unique index if not exists messages_transcript_uuid_idx on messages (conversation_id, transcript_uuid) where transcript_uuid is not null;

-- 自分のAI の文を写す。entries は [{uuid, text, at}]。本人の会話にだけ入れる。入れた数を返す
create or replace function app.bridge_entries(p_session uuid, p_conv uuid, p_job uuid, p_entries jsonb) returns integer
language plpgsql security definer set search_path = public, app as $$
declare v_member uuid; c conversations%rowtype; e jsonb; n int := 0; k int; v_job uuid;
begin
  select member_id into v_member from sessions where id = p_session and kind_id = 'bridge' and revoked_at is null;
  if v_member is null then return 0; end if;
  select * into c from conversations where id = p_conv and owner_member_id = v_member and deleted_at is null;
  if c.id is null or jsonb_typeof(p_entries) <> 'array' then return 0; end if;
  select id into v_job from bridge_jobs where id = p_job and member_id = v_member and conversation_id = p_conv;
  for e in select * from jsonb_array_elements(p_entries) loop
    continue when coalesce(e->>'uuid', '') !~ '^[0-9a-f-]{8,64}$' or coalesce(trim(e->>'text'), '') = '';
    continue when exists (select 1 from messages m where m.conversation_id = c.id and m.transcript_uuid = e->>'uuid');
    -- 写す前からある同じ文（id を持たない前の答え）は、その吹き出しに id を付けるだけ（履歴を二重にしない）
    update messages set transcript_uuid = e->>'uuid'
     where id = (select m.id from messages m
                  where m.conversation_id = c.id and m.kind = 'ai' and m.transcript_uuid is null and m.deleted_at is null
                    and btrim(m.body) = btrim(e->>'text')
                  order by m.created_at limit 1);
    continue when found;
    insert into messages (tenant_id, conversation_id, body, kind, job_id, transcript_uuid, created_at)
      values (c.tenant_id, c.id, left(e->>'text', 200000), 'ai', v_job, e->>'uuid',
              coalesce(case when e->>'at' ~ '^\d{4}-\d{2}-\d{2}T' then (e->>'at')::timestamptz end, now()))
      on conflict (conversation_id, transcript_uuid) where transcript_uuid is not null do nothing;
    get diagnostics k = row_count;
    n := n + k;
  end loop;
  return n;
end $$;
grant execute on function app.bridge_entries(uuid, uuid, uuid, jsonb) to kaname_app;

-- 取り戻す先：直近 14 日の本人の会話と、その会話で使った Claude Code の session
create or replace function app.bridge_mirror_targets(p_session uuid) returns jsonb
language sql stable security definer set search_path = public, app as $$
  select coalesce(jsonb_agg(jsonb_build_object('conversation_id', t.conversation_id, 'agent_session_id', t.agent_session_id)), '[]'::jsonb)
    from (select distinct j.conversation_id, j.agent_session_id
            from bridge_jobs j join sessions s on s.id = p_session and s.kind_id = 'bridge' and s.revoked_at is null and s.member_id = j.member_id
           where j.conversation_id is not null and j.agent_session_id is not null and j.deleted_at is null
             and j.created_at > now() - interval '14 days') t
$$;
grant execute on function app.bridge_mirror_targets(uuid) to kaname_app;

create or replace function app.bridge_finish_job(p_session uuid, p_job uuid, p_state text, p_result text, p_reason text, p_agent_session text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'app'
AS $$
declare v_member uuid; j bridge_jobs%rowtype; v_ops int; v_ms bigint; e record;
begin
  select member_id into v_member from sessions where id = p_session and kind_id = 'bridge' and revoked_at is null;
  if v_member is null then return false; end if;
  if p_state not in ('done', 'stopped', 'cancelled') then raise exception '結末は done／stopped／cancelled'; end if;
  update bridge_jobs set state_id = p_state, result = p_result, stopped_reason = p_reason, partial = null,
         agent_session_id = coalesce(p_agent_session, agent_session_id), finished_at = now()
    where id = p_job and member_id = v_member and state_id in ('running', 'asking') returning * into j;
  if j.id is null then return false; end if;
  if j.conversation_id is not null and p_agent_session is not null then
    update conversations set agent_session_id = p_agent_session where id = j.conversation_id and agent_session_id is distinct from p_agent_session;
  end if;
  select count(*) into v_ops from bridge_job_events where job_id = j.id and kind = 'tool';
  v_ms := floor(extract(epoch from (j.finished_at - coalesce(j.started_at, j.created_at))) * 1000);
  -- 写した文（本人の PC の記録と同じ id・D-112）があれば、答えの吹き出しは足さず、最後の文に作業の記録を付ける
  if j.conversation_id is not null and p_state = 'done'
     and exists (select 1 from messages m where m.job_id = j.id and m.kind = 'ai' and m.transcript_uuid is not null and m.deleted_at is null) then
    update messages set work = jsonb_build_object('ops', v_ops, 'ms', v_ms)
     where id = (select m.id from messages m where m.job_id = j.id and m.kind = 'ai' and m.deleted_at is null order by m.created_at desc, m.id desc limit 1);
    update conversations set updated_at = now() where id = j.conversation_id;
  elsif j.conversation_id is not null then
    insert into messages (tenant_id, conversation_id, body, kind, job_id, work)
      values (j.tenant_id, j.conversation_id,
              case when p_state = 'done' then coalesce(p_result, '')
                   when p_state = 'stopped' then coalesce(p_reason, '理由は分かりません')
                   else 'やめました。' end,
              case when p_state = 'done' then 'ai' else 'stopped' end, j.id,
              case when v_ops > 0 or p_state = 'done' then jsonb_build_object('ops', v_ops, 'ms', v_ms) else null end);
    update conversations set updated_at = now() where id = j.conversation_id;
  end if;
  -- 仕事が区切りの一言を取りに行った後、結末の前に届いた一言は、渡せていない。捨てずに次の仕事として並べる
  -- （写した文が結末より先に出るようになり、この間に送られやすくなった・D-112）。本人が止めた仕事では並べない
  if p_state = 'done' and j.conversation_id is not null then
    for e in select x.id, x.payload from bridge_job_events x
               where x.job_id = j.id and x.kind = 'steer'
                 and not coalesce((x.payload->>'delivered')::boolean, false) and not coalesce((x.payload->>'cancelled')::boolean, false)
               order by x.created_at loop
      update bridge_job_events set payload = payload || '{"delivered": true, "moved": true}'::jsonb where id = e.id;
      perform app.agent_enqueue(j.member_id, j.conversation_id, e.payload->>'text', null,
                                coalesce(e.payload->'opts', jsonb_build_object('permission_mode', j.permission_mode, 'model', j.model, 'effort', j.effort)));
    end loop;
  end if;
  return true;
end $$;

-- 区切りの答え（止めずに直したとき）も、記録から写した同じ文があれば重ねない
create or replace function app.bridge_take_steers(p_session uuid, p_job uuid, p_reply text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'app'
AS $$
declare v_member uuid; j bridge_jobs%rowtype; v jsonb; e record; v_first boolean := true;
begin
  select member_id into v_member from sessions where id = p_session and kind_id = 'bridge' and revoked_at is null;
  if v_member is null then return null; end if;
  select * into j from bridge_jobs where id = p_job and member_id = v_member and state_id in ('running', 'asking');
  if j.id is null then return '[]'::jsonb; end if;
  v := '[]'::jsonb;
  for e in select * from bridge_job_events where job_id = j.id and kind = 'steer'
             and coalesce((payload->>'delivered')::boolean, false) = false and coalesce((payload->>'cancelled')::boolean, false) = false
           order by created_at for update loop
    update bridge_job_events set payload = payload || '{"delivered": true}'::jsonb where id = e.id;
    if v_first and j.conversation_id is not null and coalesce(p_reply, '') <> ''
       -- 記録から写した同じ文があれば重ねない（D-112）
       and not exists (select 1 from messages m where m.job_id = j.id and m.kind = 'ai' and m.deleted_at is null and btrim(m.body) = btrim(p_reply)) then
      insert into messages (tenant_id, conversation_id, body, kind, job_id)
        values (j.tenant_id, j.conversation_id, left(p_reply, 200000), 'ai', j.id);
      update bridge_jobs set partial = null where id = j.id;
    end if;
    v_first := false;
    if j.conversation_id is not null then
      insert into messages (tenant_id, conversation_id, sender_member_id, body, kind, job_id)
        values (j.tenant_id, j.conversation_id, j.member_id, e.payload->>'text', 'human', j.id);
      update conversations set updated_at = now() where id = j.conversation_id;
    end if;
    v := v || jsonb_build_array(jsonb_build_object('id', e.id, 'text', e.payload->>'text'));
  end loop;
  return v;
end $$;

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
  elsif p_kind = 'reply' and j.conversation_id is not null
        -- 記録から写した同じ文があれば重ねない（D-112）
        and not exists (select 1 from messages m where m.job_id = j.id and m.kind = 'ai' and m.deleted_at is null and btrim(m.body) = btrim(coalesce(p_payload->>'text', ''))) then
    insert into messages (tenant_id, conversation_id, body, kind, job_id)
      values (j.tenant_id, j.conversation_id, left(coalesce(p_payload->>'text', ''), 200000), 'ai', j.id);
    update bridge_jobs set partial = null where id = j.id;
  end if;
  return true;
end $$;

-- 動いている仕事への一言に、送ったときのモード・モデルを添える（区切りに間に合わず次の仕事になったときに使う）
create or replace function app.agent_steer(p_member uuid, p_job uuid, p_text text, p_opts jsonb) returns boolean
language plpgsql security definer set search_path = public, app as $$
declare j bridge_jobs%rowtype;
begin
  select * into j from bridge_jobs where id = p_job and member_id = p_member and state_id in ('running', 'asking') and deleted_at is null;
  if j.id is null or coalesce(trim(p_text), '') = '' then return false; end if;
  insert into bridge_job_events (tenant_id, scope_id, member_id, job_id, kind, payload, created_by)
    values (j.tenant_id, j.scope_id, j.member_id, j.id, 'steer',
            jsonb_build_object('text', left(p_text, 20000), 'delivered', false)
              || case when jsonb_typeof(p_opts) = 'object' and p_opts <> '{}'::jsonb then jsonb_build_object('opts', p_opts) else '{}'::jsonb end,
            p_member);
  return true;
end $$;
grant execute on function app.agent_steer(uuid, uuid, text, jsonb) to kaname_app;
