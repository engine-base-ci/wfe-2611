-- 20261125023700 会話の置き場と、会話を読む 3 つの関数（K-757・D-153.16・D-153.17・関門 C2）
--   ① conversations に種類 talk_kind（clone＝自分の AI との会話・ticket＝チケットの右のパネルの会話・draft＝チケットを作る画面の会話）と ticket_id。
--      前から在る会話は全部 clone（既定値）。ticket は人 × チケットで 1 つだけ（消した物は数えない）
--   ② 読む関数：app.conversation_list（自分の clone の一覧・続きの鍵）・app.conversation_messages（行の続き）・app.conversation_view（1 つの会話の今）。
--      どれも持ち主（p_member）を見る 2 層目の守り・security definer・public から外し kaname_app だけが呼べる
--   ③ 前の道すじの 4 つの関数（0051 の agent_state・0042 の agent_open_conversation・0061 の agent_conversations・0033 の agent_close_conversation）は、
--      今の版を写して「開いている会話」を選ぶ所に talk_kind = 'clone' を足しただけ（会話の指定がある呼び方と答えの鍵は変えない）
alter table conversations add column if not exists talk_kind text not null default 'clone';
alter table conversations add column if not exists ticket_id uuid references tickets(id);
alter table conversations add constraint conversations_talk_kind_ck check (talk_kind in ('clone', 'ticket', 'draft'));
alter table conversations add constraint conversations_talk_ticket_ck check ((talk_kind = 'ticket') = (ticket_id is not null));
create unique index if not exists conversations_ticket_member_idx on conversations (owner_member_id, ticket_id)
  where talk_kind = 'ticket' and deleted_at is null;
create index if not exists conversations_ticket_id_idx on conversations (ticket_id);
create index if not exists conversations_clone_list_idx on conversations (owner_member_id, updated_at desc, id desc)
  where talk_kind = 'clone' and deleted_at is null;

-- 会話の行の続き（MessageView の並び）。自分の会話でなければ null。消した行と記憶の行（memo）は選ばない。
--   (created_at, id) の新しい側から p_limit + 1 件（p_before_* より古い物）を読み、古い順に並べて返す
create or replace function app.conversation_messages(p_member uuid, p_conv uuid, p_before_at timestamptz, p_before_id uuid, p_limit int)
returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare v_rows jsonb; v_n int;
begin
  if not exists (select 1 from conversations c where c.id = p_conv and c.owner_member_id = p_member and c.deleted_at is null) then
    return null;
  end if;
  with picked as (
    select m.id, m.kind, m.body, m.created_at, m.job_id, m.options
      from messages m
     where m.conversation_id = p_conv and m.deleted_at is null and m.kind <> 'memo'
       and (p_before_at is null or (m.created_at, m.id) < (p_before_at, p_before_id))
     order by m.created_at desc, m.id desc
     limit greatest(p_limit, 1) + 1
  ), numbered as (
    select p.*, row_number() over (order by p.created_at desc, p.id desc) as rn from picked p
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', n.id,
           'who', case when n.kind = 'human' then 'me' when n.kind = 'stopped' then 'stopped' when n.kind = 'note' then 'note' else 'ai' end,
           'text', case when n.kind = 'proposal' then '' else coalesce(n.body, '') end,
           'at', n.created_at,
           'job_id', n.job_id,
           'passed', case when n.kind = 'proposal' then '[]'::jsonb
                          when jsonb_typeof(n.options->'passed') = 'array' then n.options->'passed' else '[]'::jsonb end,
           'proposal', case when n.kind = 'proposal' then n.options->'proposal' end,
           'took', null) order by n.created_at, n.id) filter (where n.rn <= greatest(p_limit, 1)), '[]'::jsonb),
         count(*)
    into v_rows, v_n
    from numbered n;
  return jsonb_build_object('messages', v_rows, 'has_more', v_n > greatest(p_limit, 1));
end $$;
revoke all on function app.conversation_messages(uuid, uuid, timestamptz, uuid, int) from public;
grant execute on function app.conversation_messages(uuid, uuid, timestamptz, uuid, int) to kaname_app;

-- 自分の AI との会話（clone）の一覧（ConversationRow の並び）。(updated_at, id) の新しい順に p_limit + 1 件。
--   last_text は人か AI の最新の行（消していない）の本文の先頭 60 字。題が無ければ「新しい会話」
create or replace function app.conversation_list(p_member uuid, p_limit int, p_after_at timestamptz, p_after_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare v_rows jsonb; v_n int;
begin
  with picked as (
    select c.id, c.title, c.updated_at
      from conversations c
     where c.owner_member_id = p_member and c.talk_kind = 'clone' and c.deleted_at is null
       and (p_after_at is null or (c.updated_at, c.id) < (p_after_at, p_after_id))
     order by c.updated_at desc, c.id desc
     limit greatest(p_limit, 1) + 1
  ), numbered as (
    select p.*, row_number() over (order by p.updated_at desc, p.id desc) as rn from picked p
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', n.id,
           'title', coalesce(n.title, '新しい会話'),
           'updated_at', n.updated_at,
           'last_text', (select left(m.body, 60) from messages m
                          where m.conversation_id = n.id and m.deleted_at is null and m.kind in ('human', 'ai')
                          order by m.created_at desc, m.id desc limit 1))
           order by n.updated_at desc, n.id desc) filter (where n.rn <= greatest(p_limit, 1)), '[]'::jsonb),
         count(*)
    into v_rows, v_n
    from numbered n;
  return jsonb_build_object('items', v_rows, 'has_more', v_n > greatest(p_limit, 1));
end $$;
revoke all on function app.conversation_list(uuid, int, timestamptz, uuid) from public;
grant execute on function app.conversation_list(uuid, int, timestamptz, uuid) to kaname_app;

-- 1 つの会話の今（ConversationView）。自分の会話（種類を問わない）でなければ null。
--   行は新しい 50 件を古い順に（app.conversation_messages）。動いている仕事・止まった理由は app.agent_state の答えから鍵を絞って写す
create or replace function app.conversation_view(p_member uuid, p_conv uuid)
returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare c conversations%rowtype; v_msgs jsonb; v_state jsonb; w jsonb;
begin
  select * into c from conversations x where x.id = p_conv and x.owner_member_id = p_member and x.deleted_at is null;
  if c.id is null then return null; end if;
  v_msgs := app.conversation_messages(p_member, p_conv, null, null, 50);
  v_state := app.agent_state(p_member, p_conv);
  w := v_state->'work';
  return jsonb_build_object(
    'conversation', jsonb_build_object('id', c.id, 'title', coalesce(c.title, '新しい会話'), 'talk_kind', c.talk_kind,
                                       'ticket_id', c.ticket_id, 'updated_at', c.updated_at),
    'messages', v_msgs->'messages',
    'has_more', v_msgs->'has_more',
    'running_job_id', v_state->'running_job_id',
    'work', case when w is null or jsonb_typeof(w) = 'null' then null else jsonb_build_object(
              'job_id', w->'job_id', 'state', w->'state', 'status', w->'status', 'partial', w->'partial',
              'elapsed_ms', w->'elapsed_ms', 'stopping', w->'stopping', 'last_at', w->'last_at') end,
    'stopped', case when jsonb_typeof(v_state->'stopped') = 'object'
                    then jsonb_build_object('job_id', v_state->'stopped'->'job_id', 'reason', v_state->'stopped'->'reason') end);
end $$;
revoke all on function app.conversation_view(uuid, uuid) from public;
grant execute on function app.conversation_view(uuid, uuid) to kaname_app;

-- ③ 前の道すじの関数の作り直し（今の版の写し・開いている会話を選ぶ所に talk_kind = 'clone' を足しただけ）
-- 0051 の版：会話の指定なしで選ぶのは clone だけ（指定ありは種類を問わない）
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
    select * into c from conversations x where x.owner_member_id = p_member and x.talk_kind = 'clone' and x.closed_at is null and x.deleted_at is null
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
              'stopping', r.stop_requested_at is not null, 'permission_mode', r.permission_mode,
              -- 最後に動いた時刻（途中経過・書きかけ・状態の変化のいちばん新しいもの）。「進んでいるか」を画面が出す
              'last_at', greatest(r.updated_at, (select max(e.created_at) from bridge_job_events e where e.job_id = r.id))) end,
    'queued', v_queued,
    'waiting_on', v_wait,
    'usage', app.agent_usage(p_member));
end $$;

-- 0042 の版：開いている会話を選ぶのは clone だけ（直して送り直す・会話の指定ありは変えない）
create or replace function app.agent_open_conversation(p_member uuid, p_conv uuid, p_branch_from uuid, p_title text)
returns table (conv_id uuid, agent_session text)
language plpgsql security definer set search_path = public, app as $$
declare v_tenant uuid; v_scope uuid; v_id uuid; v_sess text; v_parent uuid; v_at timestamptz;
begin
  select tenant_id, scope_id into v_tenant, v_scope from members where id = p_member;
  if p_branch_from is not null then
    select m.conversation_id, m.created_at into v_parent, v_at from messages m join conversations c on c.id = m.conversation_id
      where m.id = p_branch_from and c.owner_member_id = p_member and c.deleted_at is null;
    if v_parent is not null then
      insert into conversations (tenant_id, scope_id, owner_member_id, title, title_auto, parent_conversation_id, branched_from_message_id, incognito, created_by)
        select v_tenant, v_scope, p_member, c.title, c.title_auto, v_parent, p_branch_from, c.incognito, p_member from conversations c where c.id = v_parent
        returning conversations.id into v_id;
      insert into messages (tenant_id, conversation_id, sender_member_id, body, kind, quote, attachments, work, created_at)
        select m.tenant_id, v_id, m.sender_member_id, m.body, m.kind, m.quote, m.attachments, m.work, m.created_at
          from messages m where m.conversation_id = v_parent and m.deleted_at is null and m.created_at < v_at and m.kind in ('human', 'ai')
          order by m.created_at;
      return query select v_id, null::text;
      return;
    end if;
    return;   -- 直す元の文が無い（消した・他人の）。黙って別の会話に書かない
  end if;
  if p_conv is not null then
    select c.id, c.agent_session_id into v_id, v_sess from conversations c
      where c.id = p_conv and c.owner_member_id = p_member and c.deleted_at is null;
    if v_id is not null then return query select v_id, v_sess; return; end if;
    return;   -- 指定された会話が無い（消した・他人の）。黙って別の会話に書かない
  end if;
  select c.id, c.agent_session_id into v_id, v_sess from conversations c
    where c.owner_member_id = p_member and c.talk_kind = 'clone' and c.closed_at is null and c.deleted_at is null
    order by c.updated_at desc limit 1;
  if v_id is null then
    insert into conversations (tenant_id, scope_id, owner_member_id, title, title_auto, created_by)
      values (v_tenant, v_scope, p_member, p_title, true, p_member) returning conversations.id into v_id;
  end if;
  return query select v_id, v_sess;
end $$;

-- 0061 の版：前の画面の一覧は clone だけ
create or replace function app.agent_conversations(p_member uuid, p_q text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v jsonb; q text := nullif(trim(app.search_norm(p_q)), ''); pat text;
begin
  pat := '%' || replace(replace(replace(coalesce(q, ''), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  select coalesce(jsonb_agg(x order by (x->>'starred')::boolean desc, x->>'updated_at' desc), '[]'::jsonb) into v from (
    select jsonb_build_object(
      'id', c.id, 'title', coalesce(c.title, '新しい会話'), 'title_auto', c.title_auto,
      'starred', c.starred_at is not null, 'incognito', c.incognito, 'updated_at', c.updated_at,
      'unread', (select count(*) from messages m where m.conversation_id = c.id and m.deleted_at is null and m.kind = 'ai'
                   and m.created_at > coalesce(c.last_read_at, 'epoch'::timestamptz)),
      -- 当たった所：そろえた本文から語のまわりを切り出す（元の本文と長さが変わることがあるので、そろえた側で切る）
      'hit', case when q is null then null else
              (select substr(app.search_norm(m.body), greatest(1, strpos(app.search_norm(m.body), q) - 60), 160 + length(q))
                 from messages m where m.conversation_id = c.id and m.deleted_at is null
                 and app.search_norm(m.body) like pat order by m.created_at desc limit 1) end) as x
      from conversations c
     where c.owner_member_id = p_member and c.talk_kind = 'clone' and c.deleted_at is null
       and (q is null or app.search_norm(c.title) like pat
            or exists (select 1 from messages m where m.conversation_id = c.id and m.deleted_at is null and app.search_norm(m.body) like pat))
     order by c.updated_at desc limit 200
  ) t;
  return v;
end $$;

-- 0033 の版：会話の指定なしで閉じるのは clone だけ（指定ありは今までどおり）
create or replace function app.agent_close_conversation(p_member uuid, p_conv uuid) returns boolean
language plpgsql security definer set search_path = public, app as $$
declare n int;
begin
  update conversations set closed_at = now()
    where owner_member_id = p_member and closed_at is null and deleted_at is null
      and (id = p_conv or (p_conv is null and talk_kind = 'clone'));
  get diagnostics n = row_count; return n > 0;
end $$;
