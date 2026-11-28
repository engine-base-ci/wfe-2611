-- 0035 Bridge が公式 CLI を 1 行 1 イベントで動かす（D-093）。
--   途中経過（何をしているか）・会話の id（init で先に取る）・確認（これを実行していいか）と本人の答え を
--   仕事ごとの出来事として残す。答えは証跡（audit_events）にも出す（誰がいつ何を許可したか・D-093.8）。
--   確認の間、仕事は 'asking'（確認待ち）。答えが返ったら 'running' に戻る。答えが無ければ Bridge が許可しない。
-- ★ 0027 で bridge_jobs に RLS を掛け忘れていた（ci:rls-enabled が赤）。ここで掛ける。マスタ 2 表も同じ。

insert into bridge_job_states (key, label) values ('asking', '確認待ち（本人が許可するまで）') on conflict do nothing;

create table if not exists bridge_job_events (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id),
  scope_id uuid references scopes(id),
  member_id uuid not null references members(id),
  job_id uuid not null references bridge_jobs(id),
  kind text not null check (kind in ('init', 'progress', 'ask', 'answer')),
  seq int not null default 0,
  request_id text,                   -- 確認（ask）とその答え（answer）を結ぶ id
  payload jsonb not null default '{}'::jsonb,   -- progress: {text} / ask: {tool,input,summary} / answer: {allow}
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz
);
create index if not exists bridge_job_events_job_idx on bridge_job_events (job_id, created_at);
drop trigger if exists bridge_job_events_updated_at on bridge_job_events; create trigger bridge_job_events_updated_at before update on bridge_job_events for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('bridge_job_events', 'AIの途中経過と確認') on conflict do nothing;

-- 途中経過：init は会話の id（落ちても「続きから」が押せる）、progress は何をしているか
create or replace function app.bridge_progress(p_session uuid, p_job uuid, p_seq int, p_kind text, p_payload jsonb) returns boolean
language plpgsql security definer set search_path = public, app as $$
declare v_member uuid; j bridge_jobs%rowtype;
begin
  select member_id into v_member from sessions where id = p_session and kind_id = 'bridge' and revoked_at is null;
  if v_member is null then return false; end if;
  select * into j from bridge_jobs where id = p_job and member_id = v_member and state_id in ('running', 'asking');
  if j.id is null then return false; end if;
  if p_kind not in ('init', 'progress') then raise exception '途中経過は init か progress'; end if;
  insert into bridge_job_events (tenant_id, scope_id, member_id, job_id, kind, seq, payload)
    values (j.tenant_id, j.scope_id, j.member_id, j.id, p_kind, coalesce(p_seq, 0), coalesce(p_payload, '{}'::jsonb));
  if p_kind = 'init' and (p_payload->>'agent_session_id') is not null then
    update bridge_jobs set agent_session_id = p_payload->>'agent_session_id' where id = j.id;
    if j.conversation_id is not null then
      update conversations set agent_session_id = p_payload->>'agent_session_id'
        where id = j.conversation_id and agent_session_id is distinct from (p_payload->>'agent_session_id');
    end if;
  end if;
  return true;
end $$;
grant execute on function app.bridge_progress(uuid, uuid, int, text, jsonb) to kaname_app;

-- 確認：CLI が「これを実行していいか」と聞いた。仕事を 'asking' にして画面に出す（同じ request_id は 1 回だけ）
create or replace function app.bridge_ask(p_session uuid, p_job uuid, p_request_id text, p_payload jsonb) returns boolean
language plpgsql security definer set search_path = public, app as $$
declare v_member uuid; j bridge_jobs%rowtype;
begin
  select member_id into v_member from sessions where id = p_session and kind_id = 'bridge' and revoked_at is null;
  if v_member is null then return false; end if;
  select * into j from bridge_jobs where id = p_job and member_id = v_member and state_id in ('running', 'asking');
  if j.id is null or coalesce(p_request_id, '') = '' then return false; end if;
  if exists (select 1 from bridge_job_events where job_id = j.id and kind = 'ask' and request_id = p_request_id) then return true; end if;
  insert into bridge_job_events (tenant_id, scope_id, member_id, job_id, kind, request_id, payload)
    values (j.tenant_id, j.scope_id, j.member_id, j.id, 'ask', p_request_id, coalesce(p_payload, '{}'::jsonb));
  update bridge_jobs set state_id = 'asking' where id = j.id;
  return true;
end $$;
grant execute on function app.bridge_ask(uuid, uuid, text, jsonb) to kaname_app;

-- Bridge が答えを取りに来る。まだ無ければ null
create or replace function app.bridge_take_answer(p_session uuid, p_job uuid, p_request_id text) returns text
language plpgsql security definer set search_path = public, app as $$
declare v_member uuid; v text;
begin
  select member_id into v_member from sessions where id = p_session and kind_id = 'bridge' and revoked_at is null;
  if v_member is null then return null; end if;
  select case when (e.payload->>'allow')::boolean then 'allow' else 'deny' end into v
    from bridge_job_events e join bridge_jobs j on j.id = e.job_id
   where e.job_id = p_job and j.member_id = v_member and e.kind = 'answer' and e.request_id = p_request_id
   order by e.created_at desc limit 1;
  return v;
end $$;
grant execute on function app.bridge_take_answer(uuid, uuid, text) to kaname_app;

-- 本人が答える（許可する／許可しない）。答えは 出来事・会話・証跡 の 3 か所に残る（D-093.8）
create or replace function app.agent_answer(p_member uuid, p_job uuid, p_request_id text, p_allow boolean) returns boolean
language plpgsql security definer set search_path = public, app as $$
declare j bridge_jobs%rowtype; a bridge_job_events%rowtype; v_name text;
begin
  select * into j from bridge_jobs where id = p_job and member_id = p_member and state_id = 'asking';
  if j.id is null then return false; end if;
  select * into a from bridge_job_events where job_id = j.id and kind = 'ask' and request_id = p_request_id order by created_at desc limit 1;
  if a.id is null then return false; end if;
  if exists (select 1 from bridge_job_events where job_id = j.id and kind = 'answer' and request_id = p_request_id) then return true; end if;
  insert into bridge_job_events (tenant_id, scope_id, member_id, job_id, kind, request_id, payload, created_by)
    values (j.tenant_id, j.scope_id, j.member_id, j.id, 'answer', p_request_id, jsonb_build_object('allow', p_allow), p_member);
  update bridge_jobs set state_id = 'running' where id = j.id;
  select display_name into v_name from members where id = p_member;
  if j.conversation_id is not null then
    insert into messages (tenant_id, conversation_id, sender_member_id, body, kind)
      values (j.tenant_id, j.conversation_id, p_member,
              '「' || coalesce(a.payload->>'summary', '道具の実行') || '」を' || case when p_allow then '許可しました' else '許可しませんでした' end
              || coalesce('（' || v_name || '）', ''), 'note');
  end if;
  insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
    values (j.tenant_id, p_member, 'member', case when p_allow then 'bridge.tool_allowed' else 'bridge.tool_denied' end,
            'bridge_jobs', j.id::text, 'C5', jsonb_build_object('request_id', p_request_id, 'tool', a.payload->>'tool', 'summary', a.payload->>'summary'), p_member);
  return true;
end $$;
grant execute on function app.agent_answer(uuid, uuid, text, boolean) to kaname_app;

-- 会話のいま（0032 を置き換え）：途中経過（動いている仕事の直近）と 確認待ち を足す。'note' は許可の記録
create or replace function app.agent_state(p_member uuid, p_conv uuid)
returns jsonb language plpgsql security definer set search_path = public, app as $$
declare v_id uuid; v_msgs jsonb; v_stopped jsonb; v_running uuid; v_progress jsonb; v_asking jsonb;
begin
  if p_conv is not null then
    select c.id into v_id from conversations c
      where c.id = p_conv and c.owner_member_id = p_member and c.deleted_at is null;
  else
    select c.id into v_id from conversations c
      where c.owner_member_id = p_member and c.closed_at is null and c.deleted_at is null
      order by c.updated_at desc limit 1;
  end if;
  if v_id is null then
    return jsonb_build_object('conversation_id', null, 'messages', '[]'::jsonb, 'running_job_id', null, 'stopped', null, 'progress', '[]'::jsonb, 'asking', null);
  end if;
  select coalesce(jsonb_agg(x order by x->>'at'), '[]'::jsonb) into v_msgs from (
    select jsonb_build_object(
             'id', m.id,
             'who', case when m.kind = 'human' then 'me' when m.kind = 'stopped' then 'stopped' when m.kind = 'note' then 'note' else 'ai' end,
             'text', coalesce(m.body, ''), 'at', m.created_at) as x
      from messages m where m.conversation_id = v_id and m.deleted_at is null
      order by m.created_at desc limit 50
  ) t;
  select j.id into v_running from bridge_jobs j
    where j.conversation_id = v_id and j.member_id = p_member and j.state_id in ('queued', 'running', 'asking') and j.deleted_at is null
    order by j.created_at desc limit 1;
  select coalesce(jsonb_agg(x order by x->>'at'), '[]'::jsonb) into v_progress from (
    select jsonb_build_object('at', e.created_at, 'text', e.payload->>'text') as x
      from bridge_job_events e where e.job_id = v_running and e.kind = 'progress' order by e.created_at desc limit 8
  ) t;
  select jsonb_build_object('job_id', e.job_id, 'request_id', e.request_id, 'tool', e.payload->>'tool',
                            'summary', e.payload->>'summary', 'input', e.payload->'input', 'at', e.created_at) into v_asking
    from bridge_job_events e join bridge_jobs j on j.id = e.job_id
   where e.job_id = v_running and j.state_id = 'asking' and e.kind = 'ask'
     and not exists (select 1 from bridge_job_events a where a.job_id = e.job_id and a.kind = 'answer' and a.request_id = e.request_id)
   order by e.created_at desc limit 1;
  select jsonb_build_object('job_id', j.id, 'reason', coalesce(j.stopped_reason, '理由は分かりません')) into v_stopped
    from bridge_jobs j
    where j.conversation_id = v_id and j.member_id = p_member and j.state_id = 'stopped' and j.deleted_at is null
    order by j.finished_at desc nulls last limit 1;
  return jsonb_build_object('conversation_id', v_id, 'messages', v_msgs, 'running_job_id', v_running, 'stopped', v_stopped,
                            'progress', v_progress, 'asking', v_asking);
end $$;
grant execute on function app.agent_state(uuid, uuid) to kaname_app;
