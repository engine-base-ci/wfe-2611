-- 0043 記憶の毎朝のまとめと、上の層へ上げる候補（D-105・T-B-21・T-B-22）。「覚えて」の記録（D-105.1）。
-- 判定と書き込みは security definer の関数の中（読む側で生の select をすると行レベルの制御に弾かれて黙って 0 になる）。
-- 時間で勝手に動かさない：まとめは本人が「今日」で押したときだけ始まる（D-105.2）。

-- 記憶の種類（決まり／好み・やり方／実例）。決まりは上の層ほど強く、好みは本人に近い層ほど強い（D-105.8）
insert into memory_kinds (key, label) values ('rule', '決まり'), ('preference', '好み・やり方'), ('example', '実例')
  on conflict do nothing;

-- 会話のいま（D-104）に「覚えました」の行（memo）を足す
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
  select coalesce(jsonb_agg(jsonb_build_object('job_id', j.id, 'text', (select m.body from messages m where m.job_id = j.id and m.kind = 'human' order by m.created_at limit 1)) order by j.created_at), '[]'::jsonb)
    into v_queued from bridge_jobs j
   where j.conversation_id = v_id and j.member_id = p_member and j.state_id = 'queued' and j.deleted_at is null
     and (r.id is not null);
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

-- 「覚えて」はその場で（D-105.1）：返事の中の印 [[覚える: …]] を個人の記憶に入れ、会話に「覚えました」を出す
create or replace function app.agent_remember(p_session uuid, p_job uuid, p_items text[]) returns int
language plpgsql security definer set search_path = public, app as $$
declare v_member uuid; j bridge_jobs%rowtype; v_scope uuid; t text; v_id uuid; n int := 0;
begin
  select member_id into v_member from sessions where id = p_session and kind_id = 'bridge' and revoked_at is null;
  if v_member is null then return 0; end if;
  select * into j from bridge_jobs where id = p_job and member_id = v_member;
  if j.id is null then return 0; end if;
  -- 記憶に残さない会話では覚えない（D-104.1）
  if exists (select 1 from conversations c where c.id = j.conversation_id and c.incognito) then return 0; end if;
  select scope_id into v_scope from members where id = v_member;
  foreach t in array coalesce(p_items, '{}') loop
    t := left(trim(t), 2000);
    continue when t = '';
    insert into memories (tenant_id, scope_id, kind_id, owner_member_id, title, body, source_type_id, source_ref_id, created_by)
      values (j.tenant_id, v_scope, 'preference', v_member, left(t, 80), t, 'conversation', j.conversation_id, v_member)
      returning id into v_id;
    if j.conversation_id is not null then
      insert into messages (tenant_id, conversation_id, body, kind, job_id, options)
        values (j.tenant_id, j.conversation_id, t, 'memo', j.id, jsonb_build_object('memory_id', v_id));
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;
grant execute on function app.agent_remember(uuid, uuid, text[]) to kaname_app;

-- 上の層の確認者（D-105.6）：その層で「記憶を承認できる」人 → いなければ 1 つ上の層 → 最後は会社の代表
create or replace function app.memory_reviewer(p_tenant uuid, p_scope uuid, p_except uuid) returns uuid
language plpgsql stable security definer set search_path = public, app as $$
declare s uuid := p_scope; v uuid; depth int := 0;
begin
  while s is not null and depth < 32 loop
    select p.grantee_member_id into v from permissions p join members m on m.id = p.grantee_member_id
     where p.tenant_id = p_tenant and p.scope_id = s and p.target_kind_id = 'memory' and p.ability_id = 'approve'
       and p.revoked_at is null and m.deleted_at is null and m.kind_id = 'human' and m.id <> coalesce(p_except, '00000000-0000-0000-0000-000000000000'::uuid)
     order by p.created_at limit 1;
    if v is not null then return v; end if;
    select parent_id into s from scopes where id = s;
    depth := depth + 1;
  end loop;
  select id into v from members where tenant_id = p_tenant and role_id = 'owner' and deleted_at is null and kind_id = 'human' order by created_at limit 1;
  return v;
end $$;

-- まとめの状態（D-105.2）：溜まっている日数と会話の数・動いている最中か・前回の結果・上の層で変わったこと
create or replace function app.agent_digest_status(p_member uuid) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare m members%rowtype; v_last memory_digests%rowtype; v_run memory_digests%rowtype; v_from date; v_to date;
        v_conv int; v_upper jsonb; v_solo boolean;
begin
  select * into m from members where id = p_member and deleted_at is null;
  if m.id is null then return null; end if;
  select * into v_last from memory_digests where member_id = p_member and state_id = 'done' and deleted_at is null order by finished_at desc limit 1;
  select * into v_run from memory_digests where member_id = p_member and state_id = 'running' and deleted_at is null order by started_at desc limit 1;
  v_to := (now() at time zone 'Asia/Tokyo')::date - 1;
  v_from := coalesce(v_last.to_on + 1,
                     (select min((x.created_at at time zone 'Asia/Tokyo')::date) from messages x join conversations c on c.id = x.conversation_id
                       where c.owner_member_id = p_member and not c.incognito and x.deleted_at is null and x.kind = 'human'));
  select count(distinct c.id) into v_conv from conversations c join messages x on x.conversation_id = c.id
   where c.owner_member_id = p_member and not c.incognito and c.deleted_at is null and x.deleted_at is null
     and (x.created_at at time zone 'Asia/Tokyo')::date between coalesce(v_from, v_to + 1) and v_to;
  -- 上の層で変わったこと：前回のまとめ以降（初めてなら 7 日）に決まった、自分の層より上の記憶
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'title', x.title, 'body', x.body, 'kind', x.kind_id, 'scope', s.name, 'at', x.approved_at) order by x.approved_at desc), '[]'::jsonb)
    into v_upper
    from memories x join scopes s on s.id = x.scope_id
   where x.tenant_id = m.tenant_id and x.owner_member_id is null and x.deleted_at is null and x.superseded_by is null and x.approved_at is not null
     and x.approved_at > coalesce(v_last.finished_at, now() - interval '7 days')
     and x.scope_id in (with recursive up(id, parent_id) as (select id, parent_id from scopes where id = m.scope_id
                         union all select s2.id, s2.parent_id from scopes s2 join up on s2.id = up.parent_id) select id from up);
  select count(*) <= 1 into v_solo from members where tenant_id = m.tenant_id and kind_id = 'human' and deleted_at is null;
  return jsonb_build_object(
    'pending', case when v_from is null or v_from > v_to then null else jsonb_build_object('from_on', v_from, 'to_on', v_to, 'days', v_to - v_from + 1, 'conversations', v_conv) end,
    'running', case when v_run.id is null then null else jsonb_build_object('id', v_run.id, 'started_at', v_run.started_at, 'from_on', v_run.from_on, 'to_on', v_run.to_on, 'conversations', v_run.conversation_count) end,
    'last', case when v_last.id is null then null else jsonb_build_object('id', v_last.id, 'from_on', v_last.from_on, 'to_on', v_last.to_on, 'conversations', v_last.conversation_count, 'finished_at', v_last.finished_at, 'result', v_last.result) end,
    'upper', v_upper,
    'solo', v_solo);
end $$;
grant execute on function app.agent_digest_status(uuid) to kaname_app;

-- まとめに読ませるもの（D-105.3）：記憶に残さない会話は除く。その日に本人が承認・差し戻ししたもの。いまの個人の記憶と上げ先の層
create or replace function app.agent_digest_source(p_member uuid, p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = public, app as $$
declare m members%rowtype;
begin
  select * into m from members where id = p_member and deleted_at is null;
  if m.id is null then return null; end if;
  return jsonb_build_object(
    'conversations', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title, 'messages', (
               select jsonb_agg(jsonb_build_object('who', case when x.kind = 'human' then 'me' else 'ai' end, 'text', left(x.body, 1500)) order by x.created_at)
                 from messages x where x.conversation_id = c.id and x.deleted_at is null and x.kind in ('human', 'ai')
                  and (x.created_at at time zone 'Asia/Tokyo')::date between p_from and p_to)) order by c.updated_at)
        from conversations c
       where c.owner_member_id = p_member and not c.incognito and c.deleted_at is null
         and exists (select 1 from messages x where x.conversation_id = c.id and x.deleted_at is null
                      and (x.created_at at time zone 'Asia/Tokyo')::date between p_from and p_to)), '[]'::jsonb),
    'approvals', coalesce((
      select jsonb_agg(jsonb_build_object('status', a.status_id, 'note', a.note, 'at', a.resolved_at) order by a.resolved_at)
        from approvals a where a.approver_member_id = p_member and a.deleted_at is null and a.resolved_at is not null
         and (a.resolved_at at time zone 'Asia/Tokyo')::date between p_from and p_to), '[]'::jsonb),
    'memories', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'kind', x.kind_id, 'title', x.title, 'body', left(x.body, 600)) order by x.created_at)
        from memories x where x.owner_member_id = p_member and x.deleted_at is null and x.superseded_by is null), '[]'::jsonb),
    'scopes', coalesce((
      with recursive up(id, parent_id, name, depth) as (
        select s.id, s.parent_id, s.name, 0 from scopes s where s.id = m.scope_id
        union all select s2.id, s2.parent_id, s2.name, up.depth + 1 from scopes s2 join up on s2.id = up.parent_id)
      select jsonb_agg(jsonb_build_object('id', id, 'name', name) order by depth) from up), '[]'::jsonb),
    'solo', (select count(*) <= 1 from members where tenant_id = m.tenant_id and kind_id = 'human' and deleted_at is null));
end $$;
grant execute on function app.agent_digest_source(uuid, date, date) to kaname_app;

-- まとめを始める（D-105.2）：本人が押したときだけ。Bridge がつながっていなければ始めない（null）。会話の画面には出さない仕事
create or replace function app.agent_digest_start(p_member uuid, p_from date, p_to date, p_conversations int, p_prompt text) returns uuid
language plpgsql security definer set search_path = public, app as $$
declare m members%rowtype; v_digest uuid; v_job uuid;
begin
  select * into m from members where id = p_member and deleted_at is null;
  if m.id is null then return null; end if;
  -- PC が閉じている（知らせが 75 秒来ていない）ときは始めない。溜まっている分は減らさない（E-MEM-001・G-12）
  if not exists (select 1 from sessions where member_id = p_member and kind_id = 'bridge' and revoked_at is null
                  and coalesce(last_seen_at, issued_at) > now() - interval '75 seconds') then return null; end if;
  if exists (select 1 from memory_digests where member_id = p_member and state_id = 'running' and deleted_at is null) then
    return (select id from memory_digests where member_id = p_member and state_id = 'running' and deleted_at is null order by started_at desc limit 1);
  end if;
  insert into bridge_jobs (tenant_id, scope_id, member_id, state_id, prompt, permission_mode, created_by)
    values (m.tenant_id, m.scope_id, p_member, 'queued', p_prompt, 'manual', p_member) returning id into v_job;
  insert into memory_digests (tenant_id, member_id, from_on, to_on, conversation_count, state_id, bridge_job_id, started_at, created_by)
    values (m.tenant_id, p_member, p_from, p_to, p_conversations, 'running', v_job, now(), p_member) returning id into v_digest;
  return v_digest;
end $$;
grant execute on function app.agent_digest_start(uuid, date, date, int, text) to kaname_app;

-- この仕事は記憶のまとめか（Bridge の結末を受けたとき）
create or replace function app.digest_of_job(p_session uuid, p_job uuid) returns uuid
language sql stable security definer set search_path = public, app as $$
  select d.id from memory_digests d join sessions s on s.member_id = d.member_id
   where d.bridge_job_id = p_job and s.id = p_session and s.kind_id = 'bridge' and s.revoked_at is null and d.state_id = 'running' limit 1;
$$;
grant execute on function app.digest_of_job(uuid, uuid) to kaname_app;

-- まとめの結果を入れる（D-105.4・D-105.5）：覚えた＝個人の記憶に自動で入れる／まとめた＝前は残し置き換え先を指す（戻せる）／
--   上げる候補＝個人の記憶として入れ、候補（送る前）を作る／捨てた＝結果にだけ残す（拾い直せる）
create or replace function app.agent_digest_apply(p_session uuid, p_digest uuid, p_ok boolean, p_result jsonb, p_reason text) returns boolean
language plpgsql security definer set search_path = public, app as $$
declare d memory_digests%rowtype; m members%rowtype; x jsonb; v_id uuid; v_kind text; v_before jsonb; v_old uuid;
        r_rem jsonb := '[]'; r_mer jsonb := '[]'; r_pro jsonb := '[]'; r_dis jsonb := '[]'; v_target uuid; v_prop uuid; v_solo boolean;
begin
  select d2.* into d from memory_digests d2 join sessions s on s.member_id = d2.member_id
   where d2.id = p_digest and s.id = p_session and s.kind_id = 'bridge' and s.revoked_at is null and d2.state_id = 'running';
  if d.id is null then return false; end if;
  if not p_ok then
    update memory_digests set state_id = 'failed', finished_at = now(), result = jsonb_build_object('reason', left(coalesce(p_reason, '理由は分かりません'), 500)) where id = d.id;
    return true;
  end if;
  select * into m from members where id = d.member_id;
  select count(*) <= 1 into v_solo from members where tenant_id = m.tenant_id and kind_id = 'human' and deleted_at is null;
  for x in select * from jsonb_array_elements(coalesce(p_result->'remembered', '[]')) loop
    v_kind := case when x->>'kind' in ('rule', 'preference', 'example') then x->>'kind' else 'preference' end;
    continue when coalesce(trim(x->>'body'), '') = '';
    insert into memories (tenant_id, scope_id, kind_id, owner_member_id, title, body, source_type_id, digest_id, created_by)
      values (m.tenant_id, m.scope_id, v_kind, m.id, left(coalesce(nullif(x->>'title', ''), x->>'body'), 80), left(x->>'body', 2000), 'digest', d.id, m.id)
      returning id into v_id;
    r_rem := r_rem || jsonb_build_array(jsonb_build_object('memory_id', v_id, 'title', left(coalesce(nullif(x->>'title', ''), x->>'body'), 80), 'body', left(x->>'body', 2000), 'kind', v_kind, 'source', left(coalesce(x->>'source', ''), 120)));
  end loop;
  for x in select * from jsonb_array_elements(coalesce(p_result->'merged', '[]')) loop
    continue when coalesce(trim(x->>'body'), '') = '';
    -- 置き換える前の記憶は本人のものだけ（他人・上の層の記憶は整理しない）
    select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'title', o.title, 'body', o.body)), '[]') into v_before
      from memories o where o.id in (select (jsonb_array_elements_text(coalesce(x->'memory_ids', '[]')))::uuid)
       and o.owner_member_id = m.id and o.deleted_at is null and o.superseded_by is null;
    continue when jsonb_array_length(v_before) = 0;
    v_kind := case when x->>'kind' in ('rule', 'preference', 'example') then x->>'kind' else 'preference' end;
    insert into memories (tenant_id, scope_id, kind_id, owner_member_id, title, body, source_type_id, digest_id, created_by)
      values (m.tenant_id, m.scope_id, v_kind, m.id, left(coalesce(nullif(x->>'title', ''), x->>'body'), 80), left(x->>'body', 2000), 'digest', d.id, m.id)
      returning id into v_id;
    update memories set superseded_by = v_id where id in (select (e->>'id')::uuid from jsonb_array_elements(v_before) e);
    r_mer := r_mer || jsonb_build_array(jsonb_build_object('memory_id', v_id, 'title', left(coalesce(nullif(x->>'title', ''), x->>'body'), 80), 'body', left(x->>'body', 2000), 'before', v_before));
  end loop;
  -- 層が個人だけの会社（一人社長）には上げる候補を出さない（D-105.10）
  if not v_solo then
    for x in select * from jsonb_array_elements(coalesce(p_result->'propose', '[]')) loop
      continue when coalesce(trim(x->>'body'), '') = '';
      v_target := null;
      begin v_target := (x->>'target_scope_id')::uuid; exception when others then v_target := null; end;
      -- 上げ先は自分の層か、その上の層だけ
      if v_target is null or v_target not in (with recursive up(id, parent_id) as (select id, parent_id from scopes where id = m.scope_id
                          union all select s2.id, s2.parent_id from scopes s2 join up on s2.id = up.parent_id) select id from up) then
        v_target := m.scope_id;
      end if;
      v_kind := case when x->>'kind' in ('rule', 'preference', 'example') then x->>'kind' else 'rule' end;
      insert into memories (tenant_id, scope_id, kind_id, owner_member_id, title, body, source_type_id, digest_id, created_by)
        values (m.tenant_id, m.scope_id, v_kind, m.id, left(coalesce(nullif(x->>'title', ''), x->>'body'), 80), left(x->>'body', 2000), 'digest', d.id, m.id)
        returning id into v_id;
      insert into memory_proposals (tenant_id, scope_id, memory_id, target_scope_id, proposer_member_id, state_id, evidence, created_by)
        values (m.tenant_id, m.scope_id, v_id, v_target, m.id, 'draft', jsonb_build_object('why', left(coalesce(x->>'why', ''), 500), 'source', left(coalesce(x->>'source', ''), 120), 'digest_id', d.id), m.id)
        returning id into v_prop;
      r_pro := r_pro || jsonb_build_array(jsonb_build_object('proposal_id', v_prop, 'memory_id', v_id, 'title', left(coalesce(nullif(x->>'title', ''), x->>'body'), 80), 'body', left(x->>'body', 2000), 'target_scope_id', v_target, 'why', left(coalesce(x->>'why', ''), 500)));
    end loop;
  end if;
  for x in select * from jsonb_array_elements(coalesce(p_result->'discarded', '[]')) loop
    continue when coalesce(trim(x->>'text'), '') = '';
    r_dis := r_dis || jsonb_build_array(jsonb_build_object('text', left(x->>'text', 500), 'why', left(coalesce(x->>'why', ''), 300)));
  end loop;
  update memory_digests set state_id = 'done', finished_at = now(),
         result = jsonb_build_object('remembered', r_rem, 'merged', r_mer, 'propose', r_pro, 'discarded', r_dis)
   where id = d.id;
  return true;
end $$;
grant execute on function app.agent_digest_apply(uuid, uuid, boolean, jsonb, text) to kaname_app;

-- 結果をその場で直す（D-105.4）：記憶を直す・消す／まとめを戻す／捨てたものを拾い直す（本人のものだけ）
create or replace function app.agent_memory_edit(p_member uuid, p_memory uuid, p_title text, p_body text) returns boolean
language plpgsql security definer set search_path = public, app as $$
declare n int;
begin
  update memories set title = left(coalesce(nullif(trim(p_title), ''), left(trim(p_body), 80)), 80), body = left(trim(p_body), 2000), updated_by = p_member
   where id = p_memory and owner_member_id = p_member and deleted_at is null and coalesce(trim(p_body), '') <> '';
  get diagnostics n = row_count; return n > 0;
end $$;
grant execute on function app.agent_memory_edit(uuid, uuid, text, text) to kaname_app;
create or replace function app.agent_memory_delete(p_member uuid, p_memory uuid) returns boolean
language plpgsql security definer set search_path = public, app as $$
declare n int;
begin
  update memories set deleted_at = now(), updated_by = p_member where id = p_memory and owner_member_id = p_member and deleted_at is null;
  get diagnostics n = row_count;
  -- 送る前の候補も一緒に下げる
  update memory_proposals set deleted_at = now() where memory_id = p_memory and state_id = 'draft';
  return n > 0;
end $$;
grant execute on function app.agent_memory_delete(uuid, uuid) to kaname_app;
create or replace function app.agent_digest_undo_merge(p_member uuid, p_digest uuid, p_memory uuid) returns boolean
language plpgsql security definer set search_path = public, app as $$
declare n int;
begin
  if not exists (select 1 from memory_digests where id = p_digest and member_id = p_member) then return false; end if;
  update memories set superseded_by = null, updated_by = p_member where superseded_by = p_memory and owner_member_id = p_member;
  get diagnostics n = row_count;
  if n = 0 then return false; end if;
  update memories set deleted_at = now(), updated_by = p_member where id = p_memory and owner_member_id = p_member;
  update memory_digests set result = jsonb_set(result, '{merged}', coalesce((select jsonb_agg(e) from jsonb_array_elements(result->'merged') e where (e->>'memory_id')::uuid <> p_memory), '[]'))
   where id = p_digest;
  return true;
end $$;
grant execute on function app.agent_digest_undo_merge(uuid, uuid, uuid) to kaname_app;
create or replace function app.agent_digest_pick(p_member uuid, p_digest uuid, p_index int) returns uuid
language plpgsql security definer set search_path = public, app as $$
declare d memory_digests%rowtype; m members%rowtype; x jsonb; v_id uuid;
begin
  select * into d from memory_digests where id = p_digest and member_id = p_member and state_id = 'done';
  if d.id is null then return null; end if;
  x := d.result->'discarded'->p_index;
  if x is null then return null; end if;
  select * into m from members where id = p_member;
  insert into memories (tenant_id, scope_id, kind_id, owner_member_id, title, body, source_type_id, digest_id, created_by)
    values (m.tenant_id, m.scope_id, 'preference', p_member, left(x->>'text', 80), x->>'text', 'digest', d.id, p_member) returning id into v_id;
  update memory_digests set result = jsonb_set(jsonb_set(result, '{discarded}', coalesce((select jsonb_agg(e) from jsonb_array_elements(result->'discarded') with ordinality t(e, i) where i - 1 <> p_index), '[]')),
                                              '{remembered}', coalesce(result->'remembered', '[]') || jsonb_build_array(jsonb_build_object('memory_id', v_id, 'title', left(x->>'text', 80), 'body', x->>'text', 'kind', 'preference', 'source', '拾い直した')))
   where id = d.id;
  return v_id;
end $$;
grant execute on function app.agent_digest_pick(uuid, uuid, int) to kaname_app;

-- 上げる候補を送る（D-105.6）：上げ先は本人が変えられる。確認者を決め、同じ上げ先で同じ名前の違う中身があれば食い違いの束にする（D-105.9）
create or replace function app.agent_proposal_send(p_member uuid, p_proposal uuid, p_target uuid) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare p memory_proposals%rowtype; m members%rowtype; mem memories%rowtype; v_target uuid; v_reviewer uuid; v_group uuid; o memory_proposals%rowtype;
begin
  select * into p from memory_proposals where id = p_proposal and proposer_member_id = p_member and state_id in ('draft', 'returned') and deleted_at is null;
  if p.id is null then return null; end if;
  select * into m from members where id = p_member;
  v_target := coalesce(p_target, p.target_scope_id);
  if v_target not in (with recursive up(id, parent_id) as (select id, parent_id from scopes where id = m.scope_id
                      union all select s2.id, s2.parent_id from scopes s2 join up on s2.id = up.parent_id) select id from up) then
    return null;
  end if;
  v_reviewer := app.memory_reviewer(m.tenant_id, v_target, p_member);
  if v_reviewer is null then v_reviewer := app.memory_reviewer(m.tenant_id, v_target, null); end if;
  select * into mem from memories where id = p.memory_id;
  -- 食い違い：同じ上げ先に、同じ名前で違う中身の候補が別の人から出ている
  select o2.* into o from memory_proposals o2 join memories om on om.id = o2.memory_id
   where o2.tenant_id = m.tenant_id and o2.target_scope_id = v_target and o2.state_id = 'sent' and o2.deleted_at is null
     and o2.proposer_member_id <> p_member and lower(trim(om.title)) = lower(trim(mem.title)) and trim(om.body) <> trim(mem.body)
   order by o2.created_at limit 1;
  if o.id is not null then
    v_group := coalesce(o.conflict_group_id, gen_random_uuid());
    update memory_proposals set conflict_group_id = v_group where id = o.id;
  end if;
  update memory_proposals set target_scope_id = v_target, reviewer_member_id = v_reviewer, state_id = 'sent', conflict_group_id = v_group, updated_by = p_member
   where id = p.id;
  return jsonb_build_object('reviewer_member_id', v_reviewer, 'target_scope_id', v_target, 'conflict', v_group is not null);
end $$;
grant execute on function app.agent_proposal_send(uuid, uuid, uuid) to kaname_app;

-- 確認待ち（D-105.6・D-105.9）：自分が確認者の候補。食い違いは束ごと
create or replace function app.agent_memory_reviews(p_member uuid) returns jsonb
language sql stable security definer set search_path = public, app as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'proposal_id', p.id, 'title', mem.title, 'body', mem.body, 'kind', mem.kind_id,
           'target_scope_id', p.target_scope_id, 'target_scope', s.name, 'proposer', pm.display_name,
           'evidence', p.evidence, 'conflict_group_id', p.conflict_group_id, 'at', p.updated_at) order by p.conflict_group_id nulls first, p.updated_at), '[]'::jsonb)
    from memory_proposals p join memories mem on mem.id = p.memory_id join scopes s on s.id = p.target_scope_id join members pm on pm.id = p.proposer_member_id
   where p.reviewer_member_id = p_member and p.state_id = 'sent' and p.deleted_at is null;
$$;
grant execute on function app.agent_memory_reviews(uuid) to kaname_app;

-- 確認者が決める：OK＝上げ先の層の記憶にする（下の全員に自動で効く・写しを配らない）。送った人の個人の記憶は置き換える。
--   食い違いの束は、選ばなかった候補を差し戻す。差し戻し＝送った人の個人の記憶のまま（D-105.6・D-105.7・D-105.9）
create or replace function app.agent_proposal_decide(p_member uuid, p_proposal uuid, p_accept boolean, p_body text) returns boolean
language plpgsql security definer set search_path = public, app as $$
declare p memory_proposals%rowtype; mem memories%rowtype; v_id uuid;
begin
  select * into p from memory_proposals where id = p_proposal and reviewer_member_id = p_member and state_id = 'sent' and deleted_at is null;
  if p.id is null then return false; end if;
  select * into mem from memories where id = p.memory_id;
  if p_accept then
    insert into memories (tenant_id, scope_id, kind_id, owner_member_id, title, body, source_type_id, source_ref_id, approved_by, approved_at, created_by)
      values (p.tenant_id, p.target_scope_id, mem.kind_id, null, mem.title, coalesce(nullif(trim(p_body), ''), mem.body), 'proposal', p.id, p_member, now(), p_member)
      returning id into v_id;
    update memories set superseded_by = v_id where id = mem.id and superseded_by is null;
    update memory_proposals set state_id = 'accepted', decided_at = now(), updated_by = p_member where id = p.id;
    if p.conflict_group_id is not null then
      update memory_proposals set state_id = 'returned', decided_at = now(), updated_by = p_member
       where conflict_group_id = p.conflict_group_id and id <> p.id and state_id = 'sent';
    end if;
  else
    update memory_proposals set state_id = 'returned', decided_at = now(), updated_by = p_member where id = p.id;
  end if;
  insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, payload, created_by)
    values (p.tenant_id, p_member, 'member', case when p_accept then 'memory.proposal_accepted' else 'memory.proposal_returned' end,
            'memory_proposals', p.id::text, jsonb_build_object('target_scope_id', p.target_scope_id, 'conflict_group_id', p.conflict_group_id), p_member);
  return true;
end $$;
grant execute on function app.agent_proposal_decide(uuid, uuid, boolean, text) to kaname_app;

-- 送った候補の行方（送った人が見る・決まったら知らせる D-105.9）
create or replace function app.agent_my_proposals(p_member uuid) returns jsonb
language sql stable security definer set search_path = public, app as $$
  select coalesce(jsonb_agg(jsonb_build_object('proposal_id', p.id, 'title', mem.title, 'state', p.state_id, 'target_scope', s.name,
                                               'reviewer', rm.display_name, 'decided_at', p.decided_at, 'conflict', p.conflict_group_id is not null) order by p.updated_at desc), '[]'::jsonb)
    from memory_proposals p join memories mem on mem.id = p.memory_id join scopes s on s.id = p.target_scope_id left join members rm on rm.id = p.reviewer_member_id
   where p.proposer_member_id = p_member and p.deleted_at is null and p.state_id in ('sent', 'accepted', 'returned')
     and (p.decided_at is null or p.decided_at > now() - interval '14 days');
$$;
grant execute on function app.agent_my_proposals(uuid) to kaname_app;

-- 上げ先に選べる層（自分の層とその上。近い順・D-105.6）
create or replace function app.agent_scope_chain(p_member uuid) returns jsonb
language sql stable security definer set search_path = public, app as $$
  with recursive up(id, parent_id, name, depth) as (
    select s.id, s.parent_id, s.name, 0 from scopes s join members m on m.scope_id = s.id where m.id = p_member and m.deleted_at is null
    union all select s2.id, s2.parent_id, s2.name, up.depth + 1 from scopes s2 join up on s2.id = up.parent_id)
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name) order by depth), '[]'::jsonb) from up;
$$;
grant execute on function app.agent_scope_chain(uuid) to kaname_app;
