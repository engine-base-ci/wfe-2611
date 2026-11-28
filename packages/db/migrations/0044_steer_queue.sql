-- 0044 止めずに直す一言は「次の区切り」まで順番待ちに置く（D-104.9・CHT-17-002・CHT-17-003）。
--   動いている間に送った一言は、いまの区切り（Claude Code の 1 回の答え）が終わるまで取り消せる。
--   Bridge は区切りで取りに来て、そこで初めて本人の吹き出しになり、同じ仕事の続きとして動く

-- 送る：まだ吹き出しにしない（渡したときに吹き出しにする）
create or replace function app.agent_steer(p_member uuid, p_job uuid, p_text text) returns boolean
language plpgsql security definer set search_path = public, app as $$
declare j bridge_jobs%rowtype;
begin
  select * into j from bridge_jobs where id = p_job and member_id = p_member and state_id in ('running', 'asking') and deleted_at is null;
  if j.id is null or coalesce(trim(p_text), '') = '' then return false; end if;
  insert into bridge_job_events (tenant_id, scope_id, member_id, job_id, kind, payload, created_by)
    values (j.tenant_id, j.scope_id, j.member_id, j.id, 'steer', jsonb_build_object('text', left(p_text, 20000), 'delivered', false), p_member);
  return true;
end $$;

-- 取り消す（まだ渡していないものだけ）
create or replace function app.agent_steer_cancel(p_member uuid, p_event uuid) returns boolean
language plpgsql security definer set search_path = public, app as $$
declare n int;
begin
  update bridge_job_events set payload = payload || '{"cancelled": true}'::jsonb
   where id = p_event and member_id = p_member and kind = 'steer'
     and coalesce((payload->>'delivered')::boolean, false) = false and coalesce((payload->>'cancelled')::boolean, false) = false;
  get diagnostics n = row_count; return n > 0;
end $$;
grant execute on function app.agent_steer_cancel(uuid, uuid) to kaname_app;

-- Bridge が区切りで取りに来る：渡した印を付け、ここで本人の吹き出しにする。
--   一言があるときは、その区切りの答え（p_reply）を先に AI の吹き出しにしてから、本人の一言を並べる（読む順＝起きた順）
drop function if exists app.bridge_take_steers(uuid, uuid);
create or replace function app.bridge_take_steers(p_session uuid, p_job uuid, p_reply text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
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
    if v_first and j.conversation_id is not null and coalesce(p_reply, '') <> '' then
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
grant execute on function app.bridge_take_steers(uuid, uuid, text) to kaname_app;

-- 止める合図だけを返す（一言は区切りで bridge_take_steers から渡す）
create or replace function app.bridge_control(p_session uuid, p_job uuid) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v_member uuid; j bridge_jobs%rowtype;
begin
  select member_id into v_member from sessions where id = p_session and kind_id = 'bridge' and revoked_at is null;
  if v_member is null then return null; end if;
  select * into j from bridge_jobs where id = p_job and member_id = v_member;
  if j.id is null then return null; end if;
  return jsonb_build_object('stop', j.stop_requested_at is not null or j.state_id not in ('running', 'asking'), 'steer', '[]'::jsonb);
end $$;

-- 会話のいま：順番待ちに、まだ渡していない一言を入れる
create or replace function app.agent_state(p_member uuid, p_conv uuid)
returns jsonb language plpgsql security definer set search_path = public, app as $$
declare v_id uuid; c conversations%rowtype; v_msgs jsonb; v_stopped jsonb; r bridge_jobs%rowtype; v_asking jsonb;
        v_tools jsonb; v_plan jsonb; v_status text; v_queued jsonb;
begin
  if p_conv is not null then
    select * into c from conversations x where x.id = p_conv and x.owner_member_id = p_member and x.deleted_at is null;
  else
    select * into c from conversations x where x.owner_member_id = p_member and x.closed_at is null and x.deleted_at is null
      order by x.updated_at desc limit 1;
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
  -- 順番待ち（D-104.9）：動いている仕事に次の区切りで渡す一言（まだ渡していない・取り消せる）と、後ろに並んだ仕事
  select coalesce(jsonb_agg(x order by x->>'at'), '[]'::jsonb) into v_queued from (
    select jsonb_build_object('id', e.id, 'kind', 'steer', 'job_id', e.job_id, 'text', e.payload->>'text', 'at', e.created_at) as x
      from bridge_job_events e where r.id is not null and e.job_id = r.id and e.kind = 'steer'
       and coalesce((e.payload->>'delivered')::boolean, false) = false and coalesce((e.payload->>'cancelled')::boolean, false) = false
    union all
    select jsonb_build_object('id', j.id, 'kind', 'job', 'job_id', j.id, 'text', (select m.body from messages m where m.job_id = j.id and m.kind = 'human' order by m.created_at limit 1), 'at', j.created_at)
      from bridge_jobs j
     where j.conversation_id = v_id and j.member_id = p_member and j.state_id = 'queued' and j.deleted_at is null and r.id is not null
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
    'usage', app.agent_usage(p_member));
end $$;
grant execute on function app.agent_state(uuid, uuid) to kaname_app;

-- 自分のAI に効かせる記憶（D-105.7・D-105.8）：Bridge が仕事を取るときに一緒に渡す。
--   決まり（rule）は上の層ほど強い＝上から順。好み・やり方・実例は本人に近いほど強い＝本人から順。置き換えた記憶・消した記憶は渡さない
create or replace function app.bridge_job_memories(p_session uuid, p_job uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app as $$
declare v_member uuid; j bridge_jobs%rowtype; m members%rowtype; v jsonb;
begin
  select member_id into v_member from sessions where id = p_session and kind_id = 'bridge' and revoked_at is null;
  if v_member is null then return null; end if;
  select * into j from bridge_jobs where id = p_job and member_id = v_member;
  if j.id is null then return '[]'::jsonb; end if;
  select * into m from members where id = v_member;
  with recursive up(id, parent_id, name, depth) as (
    select s.id, s.parent_id, s.name, 0 from scopes s where s.id = m.scope_id
    union all select s2.id, s2.parent_id, s2.name, up.depth + 1 from scopes s2 join up on s2.id = up.parent_id)
  select coalesce(jsonb_agg(x order by (x->>'ord')::int, (x->>'depth')::int desc, x->>'at'), '[]'::jsonb) into v from (
    -- 上の層の記憶（持ち主なし・確認者が OK したもの）
    select jsonb_build_object('kind', mm.kind_id, 'scope', up.name, 'depth', up.depth + 1, 'personal', false, 'body', left(mm.body, 600), 'at', mm.created_at,
                              'ord', case when mm.kind_id = 'rule' then 0 else 2 end) as x
      from memories mm join up on up.id = mm.scope_id
     where mm.owner_member_id is null and mm.deleted_at is null and mm.superseded_by is null and mm.tenant_id = m.tenant_id
    union all
    -- 本人の記憶（OK 前の上げる候補も、それまでは本人の記憶として効く）
    select jsonb_build_object('kind', mm.kind_id, 'scope', '本人', 'depth', 0, 'personal', true, 'body', left(mm.body, 600), 'at', mm.created_at,
                              'ord', case when mm.kind_id = 'rule' then 1 else 3 end)
      from memories mm where mm.owner_member_id = v_member and mm.deleted_at is null and mm.superseded_by is null
  ) t;
  return v;
end $$;
grant execute on function app.bridge_job_memories(uuid, uuid) to kaname_app;

-- 長い会話は上へ戻ると古い分を読み込む（D-104.18）：会話のいまは新しい 200 件。これより前を 100 件ずつ
create or replace function app.agent_messages_before(p_member uuid, p_conv uuid, p_before timestamptz, p_limit int) returns jsonb
language plpgsql stable security definer set search_path = public, app as $$
declare v jsonb; n int := least(greatest(coalesce(p_limit, 100), 1), 200); v_more boolean;
begin
  if not exists (select 1 from conversations c where c.id = p_conv and c.owner_member_id = p_member and c.deleted_at is null) then return null; end if;
  select coalesce(jsonb_agg(x order by x->>'at'), '[]'::jsonb) into v from (
    select jsonb_build_object(
             'id', m.id,
             'who', case when m.kind = 'human' then 'me' when m.kind = 'stopped' then 'stopped' when m.kind = 'note' then 'note' when m.kind = 'memo' then 'memo' else 'ai' end,
             'memory_id', m.options->>'memory_id',
             'text', coalesce(m.body, ''), 'at', m.created_at, 'job_id', m.job_id,
             'quote', m.quote, 'work', m.work, 'attachments', m.attachments, 'send_state', m.send_state) as x
      from messages m where m.conversation_id = p_conv and m.deleted_at is null and m.created_at < p_before
      order by m.created_at desc limit n
  ) t;
  select exists (select 1 from messages m where m.conversation_id = p_conv and m.deleted_at is null
                  and m.created_at < coalesce((v->0->>'at')::timestamptz, p_before)) into v_more;
  return jsonb_build_object('messages', v, 'has_more', v_more);
end $$;
grant execute on function app.agent_messages_before(uuid, uuid, timestamptz, int) to kaname_app;

-- 使用量は 人 × 枠 で 1 行（D-104.16）。同時に届いた 2 本が両方 insert して、古い値が読まれていた
update agent_usage_snapshots u set deleted_at = now()
  where u.deleted_at is null and exists (
    select 1 from agent_usage_snapshots v where v.member_id = u.member_id and v.window_id = u.window_id and v.deleted_at is null
      and (v.observed_at, v.id) > (u.observed_at, u.id));
create unique index if not exists agent_usage_snapshots_one on agent_usage_snapshots (member_id, window_id) where deleted_at is null;
