-- 0050 自分のAI の仕事の並び（本人の PC の Claude Code は一度に 1 つ）を画面が正しく見せる（2026-09-28 実例）。
--   何も選んでいないときは、動いている・答えを待っている会話を先に出す（読んだ印で更新時刻が動くので updated_at で選ばない）
--   別の会話の仕事の後ろで待っている仕事は、黙って止まって見せず、どの会話が終わるのを待っているかを返す（waiting_on）
create or replace function app.agent_state(p_member uuid, p_conv uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'app'
AS $$
declare v_id uuid; c conversations%rowtype; v_msgs jsonb; v_stopped jsonb; r bridge_jobs%rowtype; v_asking jsonb;
        v_tools jsonb; v_plan jsonb; v_status text; v_queued jsonb; v_wait jsonb;
begin
  if p_conv is not null then
    select * into c from conversations x where x.id = p_conv and x.owner_member_id = p_member and x.deleted_at is null;
  else
    -- 何も選んでいないときは、自分のAI がいま動いている・答えを待っている会話が先。無ければ最後に話した会話
    -- （読んだ印で更新時刻が動くので、updated_at では選ばない・2026-09-28 実例）
    select * into c from conversations x where x.owner_member_id = p_member and x.closed_at is null and x.deleted_at is null
      order by exists (select 1 from bridge_jobs j where j.conversation_id = x.id and j.member_id = p_member and j.state_id in ('running', 'asking') and j.deleted_at is null) desc,
               (select max(m.created_at) from messages m where m.conversation_id = x.id and m.deleted_at is null) desc nulls last,
               x.created_at desc
      limit 1;
  end if;
  v_id := c.id;
  if v_id is null then
    return jsonb_build_object('conversation_id', null, 'conversation', null, 'messages', '[]'::jsonb, 'running_job_id', null, 'stopped', null,
                              'progress', '[]'::jsonb, 'asking', null, 'work', null, 'queued', '[]'::jsonb, 'usage', app.agent_usage(p_member));
  end if;
  select coalesce(jsonb_agg(x order by x->>'at'), '[]'::jsonb) into v_msgs from (
    select jsonb_build_object(
             'id', m.id,
             'who', case when m.kind = 'human' then 'me' when m.kind = 'stopped' then 'stopped' when m.kind = 'note' then 'note' when m.kind = 'memo' then 'memo' else 'ai' end,
             'memory_id', m.options->>'memory_id',
             'text', coalesce(m.body, ''), 'at', m.created_at, 'job_id', m.job_id,
             'quote', m.quote, 'work', m.work, 'attachments', m.attachments, 'send_state', m.send_state) as x
      from messages m where m.conversation_id = v_id and m.deleted_at is null
      order by m.created_at desc limit 200
  ) t;
  select * into r from bridge_jobs j
    where j.conversation_id = v_id and j.member_id = p_member and j.state_id in ('running', 'asking') and j.deleted_at is null
    order by j.created_at limit 1;
  if r.id is not null then
    select coalesce(jsonb_agg(x order by x->>'at'), '[]'::jsonb) into v_tools from (
      select jsonb_build_object('at', e.created_at, 'name', e.payload->>'name', 'target', e.payload->>'target', 'ok', (e.payload->>'ok')::boolean, 'ms', (e.payload->>'ms')::int) as x
        from bridge_job_events e where e.job_id = r.id and e.kind = 'tool' order by e.created_at desc limit 20) t;
    select e.payload->'todos' into v_plan from bridge_job_events e where e.job_id = r.id and e.kind = 'plan' order by e.created_at desc limit 1;
    select e.payload->>'text' into v_status from bridge_job_events e where e.job_id = r.id and e.kind in ('status', 'progress') order by e.created_at desc limit 1;
    select jsonb_build_object('job_id', e.job_id, 'request_id', e.request_id, 'tool', e.payload->>'tool',
                              'summary', e.payload->>'summary', 'input', e.payload->'input', 'at', e.created_at, 'by', e.payload->>'by') into v_asking
      from bridge_job_events e
     where e.job_id = r.id and r.state_id = 'asking' and e.kind = 'ask'
       and not exists (select 1 from bridge_job_events a where a.job_id = e.job_id and a.kind = 'answer' and a.request_id = e.request_id)
     order by e.created_at desc limit 1;
  end if;
  -- この会話に並んでいる仕事が、別の会話の仕事（動いている・答えを待っている）の後ろで待っているなら、その会話を知らせる
  if r.id is null and exists (select 1 from bridge_jobs j where j.conversation_id = v_id and j.member_id = p_member and j.state_id = 'queued' and j.deleted_at is null) then
    select jsonb_build_object('conversation_id', o.id, 'title', coalesce(o.title, '新しい会話'), 'asking', j.state_id = 'asking') into v_wait
      from bridge_jobs j join conversations o on o.id = j.conversation_id and o.deleted_at is null
     where j.member_id = p_member and j.state_id in ('running', 'asking') and j.deleted_at is null and j.conversation_id <> v_id
     order by j.created_at limit 1;
  end if;
  -- 順番待ち（D-104.9）：動いている仕事に次の区切りで渡す一言（まだ渡していない・取り消せる）と、後ろに並んだ仕事
  select coalesce(jsonb_agg(x order by x->>'at'), '[]'::jsonb) into v_queued from (
    select jsonb_build_object('id', e.id, 'kind', 'steer', 'job_id', e.job_id, 'text', e.payload->>'text', 'at', e.created_at) as x
      from bridge_job_events e where r.id is not null and e.job_id = r.id and e.kind = 'steer'
       and coalesce((e.payload->>'delivered')::boolean, false) = false and coalesce((e.payload->>'cancelled')::boolean, false) = false
    union all
    select jsonb_build_object('id', j.id, 'kind', 'job', 'job_id', j.id, 'text', (select m.body from messages m where m.job_id = j.id and m.kind = 'human' order by m.created_at limit 1), 'at', j.created_at)
      from bridge_jobs j
     where j.conversation_id = v_id and j.member_id = p_member and j.state_id = 'queued' and j.deleted_at is null
       and (r.id is not null or v_wait is not null) -- 何も動いていないときの仕事は順番待ちではない（すぐ取られる。送った文は会話に出す）
  ) t;
  -- 止まったもの：いちばん新しい仕事が止まっていて、その後に何も言っていないときだけ（言えば次で決まる・D-104.15）
  select jsonb_build_object('job_id', j.id, 'reason', coalesce(j.stopped_reason, '理由は分かりません')) into v_stopped
    from bridge_jobs j
   where j.conversation_id = v_id and j.member_id = p_member and j.deleted_at is null
   order by j.created_at desc limit 1;
  if v_stopped is not null and not exists (select 1 from bridge_jobs j where j.id = (v_stopped->>'job_id')::uuid and j.state_id = 'stopped') then
    v_stopped := null;
  end if;
  return jsonb_build_object(
    'conversation_id', v_id,
    'conversation', jsonb_build_object('id', c.id, 'title', coalesce(c.title, '新しい会話'), 'starred', c.starred_at is not null, 'incognito', c.incognito),
    'messages', v_msgs,
    'running_job_id', coalesce(r.id, (select j.id from bridge_jobs j where j.conversation_id = v_id and j.member_id = p_member and j.state_id = 'queued' and j.deleted_at is null order by j.created_at limit 1)),
    'stopped', v_stopped,
    'progress', case when v_status is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object('at', now(), 'text', v_status)) end,
    'asking', v_asking,
    'work', case when r.id is null then null else jsonb_build_object(
              'job_id', r.id, 'state', r.state_id, 'started_at', r.started_at,
              'elapsed_ms', floor(extract(epoch from (now() - coalesce(r.started_at, now()))) * 1000),
              'status', v_status, 'plan', v_plan, 'tools', coalesce(v_tools, '[]'::jsonb), 'partial', r.partial,
              'stopping', r.stop_requested_at is not null, 'permission_mode', r.permission_mode) end,
    'queued', v_queued,
    'waiting_on', v_wait,
    'usage', app.agent_usage(p_member));
end $$;
