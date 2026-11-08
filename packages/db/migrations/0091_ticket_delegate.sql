-- 0091 AI に任せる（K-62・D-090・D-093・D-110・D-125.106・D-125.143・D-125.156・D-125.157・D-128.25・D-128.26・D-128.137・D-128.138・D-128.163・D-128.171・D-128.176・D-128.177）
--   番号は 11_tickets/K-50.md の予約では 0095（K-92・K-75・K-91・K-89 の 0091〜0094 の後）。この作業場所の土台（K-57・K-60 の控え）は 0090 までなので、
--   取り込みのときに 0095_ticket_delegate.sql へ付け替える（K-57・K-60 の 0087・0088 → 0089・0090 と同じやり方・packages/db/src/index.ts と最後の行も直す）。
--   新しい表は作らない。足すのは 列（bridge_jobs.taken_session_id・action_runs.ticket_id／phase／approval_id）と関数。
--   確定の時点は 2 つ：① 任せた（app.ticket_delegate が仕事・実行の記録・段・やり取りの 1 行を 1 つの処理で書く）
--                    ② 成果物ができた（app.bridge_finish_job のチケットの分かれ道が、成果物の版・承認待ち・段・やり取りの 1 行を 1 つの処理で書く）
--   どの関数も security definer・search_path に pg_temp・public から外し kaname_app だけに渡す（D-128.171）。中だけで使う関数は誰にも渡さない。

-- ⓪ 仕事を受け取った PC（D-128.163）。端末を外す（K-91・0093）も足すので重ねて足せる形にする
alter table bridge_jobs add column if not exists taken_session_id uuid references sessions(id);
create index if not exists bridge_jobs_taken_session_idx on bridge_jobs (taken_session_id) where taken_session_id is not null;

-- ① 仕事の種類にチケットを足す
-- 種類を 1 つ足す（広げるだけ・今の行はどれも新しい制約を満たす）。制約を付け直すために一度外す
-- squawk-ignore ban-drop-constraint
alter table bridge_jobs drop constraint if exists bridge_jobs_kind_check;
alter table bridge_jobs add constraint bridge_jobs_kind_check check (kind in ('chat', 'login_check', 'ticket'));

-- ② 実行の記録をチケットに結ぶ。phase は作る段（make）と承認の後の実行（execute・K-63 が使う）
alter table action_runs add column if not exists ticket_id uuid references tickets(id);
alter table action_runs add column if not exists phase text;
alter table action_runs add constraint action_runs_phase_check check (phase is null or phase in ('make', 'execute'));
create index if not exists action_runs_ticket_idx on action_runs (ticket_id, created_at) where ticket_id is not null;
-- ②′ その実行を許した承認・作り直しのもとの差し戻し（足すのは K-62 だけ・K-63 の 0096 は足さない）
alter table action_runs add column approval_id uuid references approvals(id);
create index action_runs_approval_idx on action_runs (approval_id);

-- ---------------------------------------------------------------- 中だけで使う関数（誰にも execute を渡さない）
-- その人がそのチケットを直せるか（要求の文脈の外・PC の側から見る。app.ticket_writable と同じ条件を、人とチケットの会社で引く）
create or replace function app.ticket_writable_for(p_ticket uuid, p_member uuid) returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select exists (
    select 1 from tickets t join members m on m.id = p_member
     where t.id = p_ticket and t.tenant_id = m.tenant_id and t.deleted_at is null
       and m.deleted_at is null and m.suspended_at is null
       and app.ticket_draft_ok(t.draft_import_id, p_member)
       and (t.assignee_member_id = p_member
            or exists (select 1 from permissions p
                        where p.grantee_member_id = p_member and p.tenant_id = t.tenant_id and p.revoked_at is null and p.deleted_at is null
                          and p.target_kind_id = 'tickets' and p.ability_id = 'edit'
                          and (p.scope_id is null or t.scope_id in (select app.scope_tree(p.scope_id)))))
  )
$$;
revoke all on function app.ticket_writable_for(uuid, uuid) from public;

-- 任せている間に止める理由（D-128.138・D-128.96）。チケットが消された・押した人がチケットを直せなくなった。担当が替わっただけでは止めない
create or replace function app.ticket_job_stop_reason(p_job uuid) returns text
language sql stable security definer set search_path = public, app, pg_temp as $$
  select case
           when t.deleted_at is not null then 'チケットが消されたので止めました'
           when not app.ticket_writable_for(t.id, r.created_by) then 'このチケットを直す権限が無くなったので止めました'
         end
    from action_runs r join tickets t on t.id = r.ticket_id
   where r.bridge_job_id = p_job
   order by r.created_at desc limit 1
$$;
revoke all on function app.ticket_job_stop_reason(uuid) from public;

-- チケットの段を鍵で変える
create or replace function app.ticket_stage_to(p_ticket uuid, p_key text, p_by uuid) returns void
language sql security definer set search_path = public, app, pg_temp as $$
  update tickets t set stage_id = s.id, updated_by = coalesce(p_by, t.updated_by)
    from ticket_stages s
   where t.id = p_ticket and s.tenant_id = t.tenant_id and s.key = p_key and s.deleted_at is null
$$;
revoke all on function app.ticket_stage_to(uuid, text, uuid) from public;

-- やり取りの 1 行（D-125.106）。仕組みの行（kind system）・誰の AI かを文に入れる
create or replace function app.ticket_system_line(p_ticket uuid, p_by uuid, p_body text) returns void
language sql security definer set search_path = public, app, pg_temp as $$
  insert into ticket_messages (tenant_id, ticket_id, kind, body, created_by)
    select t.tenant_id, t.id, 'system', left(p_body, 2000), p_by from tickets t where t.id = p_ticket
$$;
revoke all on function app.ticket_system_line(uuid, uuid, text) from public;

-- 押した人（実行を始めた人）の名前
create or replace function app.member_name(p_member uuid) returns text
language sql stable security definer set search_path = public, app, pg_temp as $$
  select coalesce(nullif(btrim(m.display_name), ''), '自分') from members m where m.id = p_member
$$;
revoke all on function app.member_name(uuid) from public;

-- その人（アカウント全体・D-128.137）の PC が生きているか（最後の知らせから 75 秒未満・0089 の bridge_devices と同じ境目）
create or replace function app.account_pc_live(p_member uuid) returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select exists (select 1 from sessions s
                  where s.member_id in (select app.account_members(p_member)) and s.kind_id = 'bridge'
                    and s.revoked_at is null and s.deleted_at is null and s.alive_at is not null
                    and s.last_seen_at > now() - interval '75 seconds')
$$;
revoke all on function app.account_pc_live(uuid) from public;

-- 実行の 1 件の形（ActionRunView）。見えるかは呼ぶ側（action_run_view・ticket_runs_view）が確かめる。読むだけで書き換えない
create or replace function app.action_run_json(p_run uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare r action_runs%rowtype; j bridge_jobs%rowtype; v_last timestamptz; v_progress text; v_pc text; v_return text; v_silent boolean;
begin
  select * into r from action_runs where id = p_run;
  if r.id is null then return null; end if;
  select * into j from bridge_jobs where id = r.bridge_job_id;
  select max(e.created_at) into v_last from bridge_job_events e where e.job_id = j.id;
  v_last := coalesce(greatest(v_last, j.started_at), j.created_at, r.created_at);
  select e.payload->>'text' into v_progress from bridge_job_events e
   where e.job_id = j.id and e.kind in ('status', 'progress') order by e.created_at desc, e.seq desc limit 1;
  -- 受け取った PC があればその PC、まだならその人のアカウントの PC のどれか（D-128.163）
  if j.taken_session_id is not null and r.status_id in ('running', 'asking') then
    select case when s.alive_at is not null and s.last_seen_at > now() - interval '75 seconds' then 'live' else 'asleep' end
      into v_pc from sessions s where s.id = j.taken_session_id and s.revoked_at is null;
  end if;
  v_pc := coalesce(v_pc, case when app.account_pc_live(r.created_by) then 'live' else 'asleep' end);
  -- 10 分（確認待ちは 30 分）知らせが無い（D-128.138・E-TO-005）。行は書き換えない
  v_silent := r.status_id in ('running', 'asking')
              and v_last < now() - case when r.status_id = 'asking' then interval '30 minutes' else interval '10 minutes' end;
  if r.phase = 'make' and r.approval_id is not null then
    select a.return_reason into v_return from approvals a where a.id = r.approval_id;
  end if;
  return jsonb_build_object(
    'id', r.id, 'ticket_id', r.ticket_id, 'phase', r.phase, 'status', r.status_id,
    'by', jsonb_build_object('member_id', r.created_by, 'display_name', app.member_name(r.created_by)),
    'pc', v_pc, 'silent', v_silent, 'last_event_at', v_last, 'progress', v_progress,
    'stopped_reason', case when r.status_id in ('stopped', 'cancelled') then coalesce(r.error_summary, j.stopped_reason) end,
    'return_reason', v_return,
    'started_at', r.started_at, 'finished_at', r.finished_at,
    'checks', jsonb_build_object('state', 'none'));
end $$;
revoke all on function app.action_run_json(uuid) from public;

-- ---------------------------------------------------------------- 仕事の中身を組む（ただ 1 か所・K-63 の承認の関数も呼ぶ）
-- prompt：チケットの目的・完了の条件・前提と制約・相手・実施事項。agent_session_id：同じチケットの前の作る実行の仕事の会話の id（D-125.157）
create or replace function app.ticket_job_context(p_ticket uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare t tickets%rowtype; v_prompt text; v_sess text; sec record;
begin
  select * into t from tickets where id = p_ticket;
  if t.id is null then return null; end if;
  v_prompt := 'Kaname のチケット「' || t.number || ' ' || t.title || '」の成果物を作ってください。'
              || '外（メール・送信・応募など）には何も出さず、作ったものを最後の返事の本文で返してください。'
              || 'チケットの区画は Kaname の道具 ticket_read で読めます。';
  for sec in select coalesce(ks.label, s.section_key) as label, s.body->>'text' as body
               from ticket_sections s
               left join kind_sections ks on ks.kind_id = t.kind_id and ks.section_key = s.section_key and ks.deleted_at is null
              where s.ticket_id = t.id and s.deleted_at is null
                and s.section_key in ('purpose', 'done', 'constraints', 'counterpart', 'todo')
                and coalesce(btrim(s.body->>'text'), '') <> ''
              order by array_position(array['purpose', 'done', 'constraints', 'counterpart', 'todo'], s.section_key) loop
    v_prompt := v_prompt || E'\n\n## ' || sec.label || E'\n' || sec.body;
  end loop;
  select j.agent_session_id into v_sess
    from action_runs r join bridge_jobs j on j.id = r.bridge_job_id
   where r.ticket_id = t.id and r.phase = 'make' and j.agent_session_id is not null
   order by r.created_at desc limit 1;
  return jsonb_build_object('prompt', v_prompt, 'agent_session_id', v_sess);
end $$;
revoke all on function app.ticket_job_context(uuid) from public;
grant execute on function app.ticket_job_context(uuid) to kaname_app;

-- ---------------------------------------------------------------- 任せる（確定の時点 ①）
--   呼ぶのは要求の文脈の中（withTenant が app.tenant_id／app.user_id を入れた後）。答えは {ok, run_id, job_id, pc} か {ok:false, code[, run_id]}
create or replace function app.ticket_delegate(p_ticket uuid) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_tenant uuid := app.tenant_id(); v_me uuid := app.user_id(); t tickets%rowtype; v_stage text; v_run uuid; v_job uuid; v_ctx jsonb;
begin
  if v_tenant is null or v_me is null or not app.member_ok() then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  -- 同じチケットの同時の 2 本は 1 本にする（チケットの行で待ち合わせる）
  select * into t from tickets where id = p_ticket and tenant_id = v_tenant and deleted_at is null for update;
  if t.id is null or not app.ticket_visible(p_ticket) then return jsonb_build_object('ok', false, 'code', 'NOT_FOUND'); end if;
  if not app.ticket_writable(p_ticket) then return jsonb_build_object('ok', false, 'code', 'FORBIDDEN'); end if;
  select r.id into v_run from action_runs r
   where r.ticket_id = p_ticket and r.status_id in ('queued', 'running', 'asking') and r.deleted_at is null
   order by r.created_at desc limit 1;
  if v_run is not null then return jsonb_build_object('ok', false, 'code', 'RUNNING', 'run_id', v_run); end if;
  select s.key into v_stage from ticket_stages s where s.id = t.stage_id;
  -- 任せられるのは未着手・作業中・保留だけ。承認待ち・完了・確認中・実行中（走っている実行なし）は 409・E-CONF-014
  if coalesce(v_stage, '') not in ('todo', 'doing', 'hold') then return jsonb_build_object('ok', false, 'code', 'NOT_DELEGABLE'); end if;
  -- 押した人の PC（アカウント全体・D-128.137）。一度もつないでいない・外した人は積まない（D-125.143）
  if not exists (select 1 from sessions s where s.member_id in (select app.account_members(v_me)) and s.kind_id = 'bridge'
                    and s.revoked_at is null and s.deleted_at is null) then
    return jsonb_build_object('ok', false, 'code', 'NO_PC');
  end if;
  v_ctx := app.ticket_job_context(p_ticket);
  insert into bridge_jobs (tenant_id, scope_id, member_id, state_id, prompt, agent_session_id, kind, permission_mode, created_by)
    values (t.tenant_id, t.scope_id, v_me, 'queued', v_ctx->>'prompt', v_ctx->>'agent_session_id', 'ticket', 'manual', v_me)
    returning id into v_job;
  insert into action_runs (tenant_id, scope_id, ticket_id, phase, status_id, bridge_job_id, created_by, updated_by)
    values (t.tenant_id, t.scope_id, t.id, 'make', 'queued', v_job, v_me, v_me) returning id into v_run;
  perform app.ticket_stage_to(t.id, 'running', v_me);
  update tickets set delegated_to_clone = true where id = t.id;
  perform app.ticket_system_line(t.id, v_me, app.member_name(v_me) || 'のAI に任せました');
  return jsonb_build_object('ok', true, 'run_id', v_run, 'job_id', v_job,
                            'pc', case when app.account_pc_live(v_me) then 'live' else 'asleep' end);
end $$;
revoke all on function app.ticket_delegate(uuid) from public;
grant execute on function app.ticket_delegate(uuid) to kaname_app;

-- チケットの詳細の can.delegate：直せる・段が未着手／作業中／保留・走っている実行が無い
create or replace function app.ticket_can_delegate(p_ticket uuid) returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select app.member_ok() and app.ticket_writable(p_ticket)
     and exists (select 1 from tickets t join ticket_stages s on s.id = t.stage_id
                  where t.id = p_ticket and t.deleted_at is null and s.key in ('todo', 'doing', 'hold'))
     and not exists (select 1 from action_runs r where r.ticket_id = p_ticket and r.status_id in ('queued', 'running', 'asking') and r.deleted_at is null)
$$;
revoke all on function app.ticket_can_delegate(uuid) from public;
grant execute on function app.ticket_can_delegate(uuid) to kaname_app;

-- ---------------------------------------------------------------- 読む口（見えるチケットの実行だけ）
create or replace function app.action_run_view(p_run uuid) returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  select app.action_run_json(r.id) from action_runs r
   where r.id = p_run and r.ticket_id is not null and r.deleted_at is null
     and app.member_ok() and r.tenant_id = app.tenant_id() and app.ticket_visible(r.ticket_id)
$$;
revoke all on function app.action_run_view(uuid) from public;
grant execute on function app.action_run_view(uuid) to kaname_app;

-- 一覧（新しい順・50 件）と見える数。チケットが見えなければ null
create or replace function app.ticket_runs_view(p_ticket uuid) returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  select case when app.member_ok() and app.ticket_visible(p_ticket) then
    jsonb_build_object(
      'data', coalesce((select jsonb_agg(app.action_run_json(x.id) order by x.created_at desc, x.id desc)
                          from (select r.id, r.created_at from action_runs r where r.ticket_id = p_ticket and r.deleted_at is null
                                 order by r.created_at desc, r.id desc limit 50) x), '[]'::jsonb),
      'total', (select count(*) from action_runs r where r.ticket_id = p_ticket and r.deleted_at is null))
  end
$$;
revoke all on function app.ticket_runs_view(uuid) from public;
grant execute on function app.ticket_runs_view(uuid) to kaname_app;

-- ---------------------------------------------------------------- PC の口（受け取った PC だけ・D-128.163）
-- 仕事の問い合わせ（0089）も、アカウント全体の仕事を見る（待ち受けるかどうか・D-128.137）
create or replace function app.bridge_poll(p_session uuid) returns boolean
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_member uuid;
begin
  update sessions set last_seen_at = now(), alive_at = coalesce(alive_at, now())
   where id = p_session and kind_id = 'bridge' and revoked_at is null and deleted_at is null
   returning member_id into v_member;
  if v_member is null then return null; end if;
  return exists (select 1 from bridge_jobs j
                  where j.member_id in (select app.account_members(v_member)) and j.deleted_at is null
                    and (j.state_id in ('queued', 'running')
                         or j.created_at > now() - interval '5 minutes'
                         or j.finished_at > now() - interval '5 minutes'));
end $$;
revoke all on function app.bridge_poll(uuid) from public;
grant execute on function app.bridge_poll(uuid) to kaname_app;

-- ④ 仕事を 1 件渡す。持ち主はその PC の人のアカウント全体（D-128.137）。受け取った PC を残し、チケットの仕事なら実行を動いているにする。
--   prompt と agent_session_id は行の中身をそのまま渡す（作る段は ticket_delegate、承認の後の実行は K-63 が入れる）
-- 答えの形を変える（列を足す・真偽 → jsonb）ので作り直す。呼ぶのは同じ処理で入れ替える契約の口だけ（前の道すじは消した）
-- squawk-ignore ban-drop-function
drop function if exists app.bridge_take_job(uuid);
create function app.bridge_take_job(p_session uuid)
returns table (job_id uuid, prompt text, agent_session_id text, conversation_id uuid,
               permission_mode text, model text, effort text, tools text[], allowed_tools text[], attachments jsonb,
               kind text, credential_id uuid, ticket_id uuid, phase text)
language plpgsql security definer set search_path = public, app, pg_temp as $$
#variable_conflict use_column
declare v_member uuid; v_job uuid;
begin
  select s.member_id into v_member from sessions s where s.id = p_session and s.kind_id = 'bridge' and s.revoked_at is null and s.deleted_at is null;
  if v_member is null then return; end if;
  select x.id into v_job from bridge_jobs x
   where x.member_id in (select app.account_members(v_member)) and x.state_id = 'queued' and x.deleted_at is null
     and not exists (select 1 from bridge_jobs y where y.conversation_id = x.conversation_id and y.state_id in ('running', 'asking') and y.deleted_at is null)
   order by x.created_at limit 1 for update skip locked;
  if v_job is null then return; end if;
  update bridge_jobs j set state_id = 'running', started_at = now(), taken_session_id = p_session,
         agent_session_id = coalesce(j.agent_session_id, (select c.agent_session_id from conversations c where c.id = j.conversation_id))
   where j.id = v_job;
  update action_runs r set status_id = 'running', started_at = coalesce(r.started_at, now())
   where r.bridge_job_id = v_job and r.status_id = 'queued';
  update credentials c set login_check_state = 'running', login_check_at = now()
   where c.id = (select j.credential_id from bridge_jobs j where j.id = v_job and j.kind = 'login_check') and c.login_check_state = 'pending';
  return query
    select j.id, j.prompt, j.agent_session_id, j.conversation_id, j.permission_mode, j.model, j.effort, j.tools,
           coalesce((select array_agg(r.tool || case when coalesce(r.target_pattern, '') = '' then '' else '(' || r.target_pattern || ')' end)
                       from permission_rules r where r.member_id = j.member_id and r.decision_id = 'allow' and r.revoked_at is null and r.deleted_at is null), '{}'),
           coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'mime', a.mime, 'size', a.size))
                       from attachments a where a.id = any(coalesce(j.attachment_ids, '{}'))), '[]'::jsonb),
           j.kind, j.credential_id,
           (select ar.ticket_id from action_runs ar where ar.bridge_job_id = j.id order by ar.created_at desc limit 1),
           (select ar.phase from action_runs ar where ar.bridge_job_id = j.id order by ar.created_at desc limit 1)
      from bridge_jobs j where j.id = v_job;
end $$;
revoke all on function app.bridge_take_job(uuid) from public;
grant execute on function app.bridge_take_job(uuid) to kaname_app;

-- 道具の鍵を付ける（受け取った PC の仕事だけ）
create or replace function app.bridge_tool_token(p_session uuid, p_job uuid, p_hash text) returns boolean
language plpgsql security definer set search_path = public, app, pg_temp as $$
begin
  if coalesce(p_hash, '') !~ '^[0-9a-f]{64}$' then return false; end if;
  update bridge_jobs set tool_token_hash = p_hash
   where id = p_job and taken_session_id = p_session and state_id in ('running', 'asking')
     and exists (select 1 from sessions s where s.id = p_session and s.kind_id = 'bridge' and s.revoked_at is null);
  return found;
end $$;
revoke all on function app.bridge_tool_token(uuid, uuid, text) from public;
grant execute on function app.bridge_tool_token(uuid, uuid, text) to kaname_app;

-- その PC が受け取った動いている仕事（受け取った PC の列が空の古い行は、その人のアカウントの PC から）
create or replace function app.bridge_job_of(p_session uuid, p_job uuid) returns uuid
language sql stable security definer set search_path = public, app, pg_temp as $$
  select j.id from bridge_jobs j join sessions s on s.id = p_session and s.kind_id = 'bridge' and s.revoked_at is null
   where j.id = p_job and j.deleted_at is null
     and (j.taken_session_id = p_session
          or (j.taken_session_id is null and j.member_id in (select app.account_members(s.member_id))))
$$;
revoke all on function app.bridge_job_of(uuid, uuid) from public;

-- 途中の様子（0058 の中身のまま・受け取った PC だけ）
create or replace function app.bridge_progress(p_session uuid, p_job uuid, p_seq integer, p_kind text, p_payload jsonb) returns boolean
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare j bridge_jobs%rowtype; w jsonb;
begin
  select * into j from bridge_jobs where id = app.bridge_job_of(p_session, p_job) and state_id in ('running', 'asking');
  if j.id is null then return false; end if;
  if p_kind not in ('init', 'progress', 'tool', 'usage', 'status', 'plan', 'limit', 'reply', 'blocked', 'notice') then
    raise exception '途中経過は init／progress／tool／usage／status／plan／limit／reply／blocked／notice';
  end if;
  insert into bridge_job_events (tenant_id, scope_id, member_id, job_id, kind, seq, payload)
    values (j.tenant_id, j.scope_id, j.member_id, j.id, p_kind, coalesce(p_seq, 0), coalesce(p_payload, '{}'::jsonb));
  if p_kind = 'init' and j.model is null and (p_payload->>'model') ~ '^[A-Za-z0-9.-]{1,60}$' then
    update sessions set cli_model = p_payload->>'model' where id = p_session and cli_model is distinct from (p_payload->>'model');
  end if;
  if p_kind = 'init' and (p_payload->>'agent_session_id') is not null then
    update bridge_jobs set agent_session_id = p_payload->>'agent_session_id' where id = j.id;
    if j.conversation_id is not null then
      update conversations set agent_session_id = p_payload->>'agent_session_id'
        where id = j.conversation_id and agent_session_id is distinct from (p_payload->>'agent_session_id');
    end if;
  elsif p_kind = 'limit' then
    for w in select * from jsonb_array_elements(coalesce(p_payload->'windows', '[]'::jsonb)) loop
      update agent_usage_snapshots set utilization = (w->>'utilization')::numeric, resets_at = to_timestamp((w->>'resets_at')::double precision), observed_at = now()
        where member_id = j.member_id and window_id = w->>'window' and deleted_at is null;
      if not found then
        insert into agent_usage_snapshots (tenant_id, member_id, window_id, utilization, resets_at, observed_at, created_by)
          values (j.tenant_id, j.member_id, w->>'window', (w->>'utilization')::numeric, to_timestamp((w->>'resets_at')::double precision), now(), j.member_id);
      end if;
    end loop;
  elsif p_kind = 'blocked' then
    insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
      values (j.tenant_id, j.member_id, 'bridge', 'agent.blocked', 'bridge_job', j.id::text, 'C1',
              jsonb_build_object('tool', left(coalesce(p_payload->>'tool', ''), 80), 'domain', left(coalesce(p_payload->>'domain', ''), 200),
                                 'service', left(coalesce(p_payload->>'service', ''), 120), 'target', left(coalesce(p_payload->>'target', ''), 300)), j.member_id);
  elsif p_kind = 'notice' and j.conversation_id is not null then
    if coalesce(trim(p_payload->>'text'), '') <> ''
       and not exists (select 1 from messages m where m.job_id = j.id and m.kind = 'note' and m.body = left(p_payload->>'text', 400) and m.deleted_at is null) then
      insert into messages (tenant_id, conversation_id, body, kind, job_id)
        values (j.tenant_id, j.conversation_id, left(p_payload->>'text', 400), 'note', j.id);
    end if;
  elsif p_kind = 'reply' and j.conversation_id is not null
        and not exists (select 1 from messages m where m.job_id = j.id and m.kind = 'ai' and m.deleted_at is null and btrim(m.body) = btrim(coalesce(p_payload->>'text', ''))) then
    insert into messages (tenant_id, conversation_id, body, kind, job_id)
      values (j.tenant_id, j.conversation_id, left(coalesce(p_payload->>'text', ''), 200000), 'ai', j.id);
    update bridge_jobs set partial = null where id = j.id;
  end if;
  return true;
end $$;
revoke all on function app.bridge_progress(uuid, uuid, integer, text, jsonb) from public;
grant execute on function app.bridge_progress(uuid, uuid, integer, text, jsonb) to kaname_app;

-- ⑥ 止める合図（受け取った PC だけ）。チケットの仕事は、消された・押した人が直せなくなったら理由つきで止める
-- 答えの形を変える（列を足す・真偽 → jsonb）ので作り直す。呼ぶのは同じ処理で入れ替える契約の口だけ（前の道すじは消した）
-- squawk-ignore ban-drop-function
drop function if exists app.bridge_control(uuid, uuid);
create function app.bridge_control(p_session uuid, p_job uuid) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare j bridge_jobs%rowtype; v_reason text;
begin
  select * into j from bridge_jobs where id = app.bridge_job_of(p_session, p_job);
  if j.id is null then return null; end if;
  if j.kind = 'ticket' then v_reason := app.ticket_job_stop_reason(j.id); end if;
  return jsonb_build_object('stop', j.stop_requested_at is not null or j.state_id not in ('running', 'asking') or v_reason is not null,
                            'reason', v_reason, 'steer', '[]'::jsonb);
end $$;
revoke all on function app.bridge_control(uuid, uuid) from public;
grant execute on function app.bridge_control(uuid, uuid) to kaname_app;

-- ⑤ 結末を返す。答えは {ok, outcome}（awaiting_approval・stopped・done）か null（その PC の動いている仕事でない）
--   チケットの作る段（phase make）：中身のある結果なら成果物の版・承認待ち・段（承認待ち）・やり取り。空・止める理由がある・止まったなら止まった（段は作業中）
--   承認の後の実行（phase execute）：仕事だけ閉じる（受けるのは K-63 の引き金）。会話・ログインの試し：0053 の中身のまま
-- 答えの形を変える（列を足す・真偽 → jsonb）ので作り直す。呼ぶのは同じ処理で入れ替える契約の口だけ（前の道すじは消した）
-- squawk-ignore ban-drop-function
drop function if exists app.bridge_finish_job(uuid, uuid, text, text, text, text);
create function app.bridge_finish_job(p_session uuid, p_job uuid, p_state text, p_result text, p_reason text, p_agent_session text)
returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare j bridge_jobs%rowtype; r action_runs%rowtype; t tickets%rowtype; v_ops int; v_ms bigint; e record;
        v_why text; v_ok boolean; v_sec uuid; v_ver int; v_pos int; v_body jsonb; v_name text; v_state text;
begin
  if p_state not in ('done', 'stopped', 'cancelled') then raise exception '結末は done／stopped／cancelled'; end if;
  select * into j from bridge_jobs where id = app.bridge_job_of(p_session, p_job) and state_id in ('running', 'asking') for update;
  if j.id is null then return null; end if;
  if j.kind = 'ticket' then
    select * into r from action_runs where bridge_job_id = j.id order by created_at desc limit 1 for update;
  end if;
  if j.kind = 'ticket' and r.phase = 'make' then
    select * into t from tickets where id = r.ticket_id for update;
    v_why := app.ticket_job_stop_reason(j.id);
    v_ok := p_state = 'done' and v_why is null and coalesce(btrim(p_result), '') <> '';
    if not v_ok then
      v_why := coalesce(v_why,
                        case when p_state = 'done' then '自分のAI が結果を返さずに終わりました。完了とは見なしていません'
                             else coalesce(nullif(btrim(p_reason), ''), '理由は分かりません') end);
    end if;
    v_state := case when v_ok then 'done' when p_state = 'cancelled' then 'cancelled' else 'stopped' end;
    update bridge_jobs set state_id = v_state, result = case when v_ok then p_result end,
           stopped_reason = case when v_ok then null else left(v_why, 400) end, partial = null,
           agent_session_id = coalesce(p_agent_session, agent_session_id), finished_at = now()
     where id = j.id;
    v_name := app.member_name(r.created_by);
    if v_ok then
      -- 成果物の区画（無ければ作る）に新しい版。編集した人は押した人・AI が書いた印（D-128.138）
      v_body := jsonb_build_object('text', p_result);
      select s.id, s.version into v_sec, v_ver from ticket_sections s where s.ticket_id = t.id and s.section_key = 'artifacts' for update;
      if v_sec is null then
        select ks.position into v_pos from kind_sections ks where ks.kind_id = t.kind_id and ks.section_key = 'artifacts' and ks.deleted_at is null;
        insert into ticket_sections (tenant_id, ticket_id, section_key, position, body, version, created_by, updated_by)
          values (t.tenant_id, t.id, 'artifacts', coalesce(v_pos, 70), v_body, 1, r.created_by, r.created_by) returning id, version into v_sec, v_ver;
      else
        v_ver := v_ver + 1;
        update ticket_sections set body = v_body, version = v_ver, deleted_at = null, updated_by = r.created_by where id = v_sec;
      end if;
      insert into ticket_section_versions (tenant_id, ticket_id, section_id, version, body, edited_by, edited_by_clone, created_by)
        values (t.tenant_id, t.id, v_sec, v_ver, v_body, r.created_by, true, r.created_by);
      -- 承認待ち（承認するのは結果が届いた時点の担当者・D-128.25）。骨格では AI の成果物の承認は全部取り消せない扱い（D-128.177）
      insert into approvals (tenant_id, scope_id, ticket_id, kind, action_run_id, requested_by, approver_member_id, status_id,
                             subject_type, subject_id, irreversible, created_by)
        values (t.tenant_id, t.scope_id, t.id, 'artifact', r.id, r.created_by, t.assignee_member_id, 'pending',
                'ticket_section', v_sec, true, r.created_by);
      update action_runs set status_id = 'done', finished_at = now(), updated_by = r.created_by where id = r.id;
      perform app.ticket_stage_to(t.id, 'awaiting_approval', r.created_by);
      perform app.ticket_system_line(t.id, r.created_by, v_name || 'のAI が作り終えました。承認待ちです');
      return jsonb_build_object('ok', true, 'outcome', 'awaiting_approval');
    end if;
    update action_runs set status_id = v_state, error_summary = left(v_why, 400), finished_at = now(), updated_by = r.created_by where id = r.id;
    perform app.ticket_stage_to(t.id, 'doing', r.created_by);
    perform app.ticket_system_line(t.id, r.created_by, v_name || 'のAI が止まりました（' || left(v_why, 400) || '）');
    return jsonb_build_object('ok', true, 'outcome', 'stopped');
  end if;
  update bridge_jobs set state_id = p_state, result = p_result, stopped_reason = p_reason, partial = null,
         agent_session_id = coalesce(p_agent_session, agent_session_id), finished_at = now()
   where id = j.id returning * into j;
  if j.kind = 'ticket' then   -- 承認の後の実行（phase execute）の終わりは K-63 の引き金が受ける
    return jsonb_build_object('ok', true, 'outcome', case when p_state = 'done' then 'done' else 'stopped' end);
  end if;
  if j.conversation_id is not null and p_agent_session is not null then
    update conversations set agent_session_id = p_agent_session where id = j.conversation_id and agent_session_id is distinct from p_agent_session;
  end if;
  select count(*) into v_ops from bridge_job_events where job_id = j.id and kind = 'tool';
  v_ms := floor(extract(epoch from (j.finished_at - coalesce(j.started_at, j.created_at))) * 1000);
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
  return jsonb_build_object('ok', true, 'outcome', case when p_state = 'done' then 'done' else 'stopped' end);
end $$;
revoke all on function app.bridge_finish_job(uuid, uuid, text, text, text, text) from public;
grant execute on function app.bridge_finish_job(uuid, uuid, text, text, text, text) to kaname_app;

-- ⑦ 道具の鍵から仕事を引く（チケットと仕事の種類も返す）。動いていない仕事・合わない鍵は何も返さない
-- 答えの形を変える（列を足す・真偽 → jsonb）ので作り直す。呼ぶのは同じ処理で入れ替える契約の口だけ（前の道すじは消した）
-- squawk-ignore ban-drop-function
drop function if exists app.bridge_tool_job(text);
create function app.bridge_tool_job(p_hash text)
returns table (job_id uuid, member_id uuid, tenant_id uuid, scope_id uuid, conversation_id uuid, ticket_id uuid, kind text, taken_session_id uuid)
language sql stable security definer set search_path = public, app, pg_temp as $$
  select j.id, j.member_id, j.tenant_id, m.scope_id, j.conversation_id,
         (select r.ticket_id from action_runs r where r.bridge_job_id = j.id order by r.created_at desc limit 1),
         j.kind, j.taken_session_id
    from bridge_jobs j join members m on m.id = j.member_id and m.deleted_at is null
   where coalesce(p_hash, '') ~ '^[0-9a-f]{64}$' and j.tool_token_hash = p_hash and j.state_id in ('running', 'asking')
   limit 1
$$;
revoke all on function app.bridge_tool_job(text) from public;
grant execute on function app.bridge_tool_job(text) to kaname_app;

-- 道具 ticket_read：任された 1 枚の区画だけ。押した人が直せる間だけ（D-110）。証跡に残す（関門 C2）
create or replace function app.ticket_tool_read(p_job uuid) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare j bridge_jobs%rowtype; r action_runs%rowtype; t tickets%rowtype; v jsonb;
begin
  select * into j from bridge_jobs where id = p_job and kind = 'ticket' and state_id in ('running', 'asking');
  if j.id is null then return null; end if;
  select * into r from action_runs where bridge_job_id = j.id order by created_at desc limit 1;
  select * into t from tickets where id = r.ticket_id and deleted_at is null;
  if t.id is null or not app.ticket_writable_for(t.id, r.created_by) then return null; end if;
  select jsonb_build_object(
           'ticket', jsonb_build_object('id', t.id, 'number', t.number, 'title', t.title,
                                        'stage', (select s.key from ticket_stages s where s.id = t.stage_id), 'due_on', t.due_on),
           'sections', coalesce(jsonb_agg(jsonb_build_object('key', s.section_key, 'label', coalesce(ks.label, s.section_key),
                                                             'text', s.body->>'text', 'version', s.version) order by s.position), '[]'::jsonb))
    into v
    from ticket_sections s
    left join kind_sections ks on ks.kind_id = t.kind_id and ks.section_key = s.section_key and ks.deleted_at is null
   where s.ticket_id = t.id and s.deleted_at is null;
  perform app.agent_tool_audit(j.member_id, j.tenant_id, 'tool.ticket_read', 'ticket', t.id, jsonb_build_object('job_id', j.id));
  return v;
end $$;
revoke all on function app.ticket_tool_read(uuid) from public;
grant execute on function app.ticket_tool_read(uuid) to kaname_app;

-- ⑧ 動いたまま残った仕事を止める：その PC が受け取った仕事と、受け取った PC の列が空の古い行（その人の PC から）だけ（D-128.163）。
--   チケットの仕事は実行の記録を止まった・段を作業中・やり取りに「ここで止まりました」
-- 答えの形を変える（列を足す・真偽 → jsonb）ので作り直す。呼ぶのは同じ処理で入れ替える契約の口だけ（前の道すじは消した）
-- squawk-ignore ban-drop-function
drop function if exists app.bridge_sweep_orphans(uuid);
create function app.bridge_sweep_orphans(p_session uuid) returns integer
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_member uuid; n int := 0; g record; r action_runs%rowtype; v_why text;
begin
  select s.member_id into v_member from sessions s where s.id = p_session and s.kind_id = 'bridge' and s.revoked_at is null;
  if v_member is null then return 0; end if;
  for g in
    update bridge_jobs bj set state_id = 'stopped', finished_at = now(), partial = null,
           stopped_reason = case when bj.kind = 'ticket' then 'PC の Bridge が途中で止まったので、ここで止まりました'
                                 else 'PC の Bridge が途中で止まったので、ここで止まりました。続けるなら「続けて」と送ってください' end
     where bj.state_id in ('running', 'asking') and bj.deleted_at is null
       and (bj.taken_session_id = p_session
            or (bj.taken_session_id is null and bj.member_id in (select app.account_members(v_member))))
    returning bj.id, bj.tenant_id, bj.conversation_id, bj.agent_session_id, bj.stopped_reason, bj.kind
  loop
    n := n + 1;
    if g.conversation_id is not null then
      if g.agent_session_id is not null then
        update conversations c set agent_session_id = g.agent_session_id, updated_at = now() where c.id = g.conversation_id;
      end if;
      insert into messages (tenant_id, conversation_id, body, kind, job_id) values (g.tenant_id, g.conversation_id, g.stopped_reason, 'stopped', g.id);
    end if;
    if g.kind = 'ticket' then
      select * into r from action_runs where bridge_job_id = g.id order by created_at desc limit 1;
      if r.id is not null and r.status_id in ('queued', 'running', 'asking') then
        update action_runs set status_id = 'stopped', error_summary = g.stopped_reason, finished_at = now() where id = r.id;
        if r.phase = 'make' then perform app.ticket_stage_to(r.ticket_id, 'doing', r.created_by); end if;
        perform app.ticket_system_line(r.ticket_id, r.created_by,
                                       app.member_name(r.created_by) || 'のAI はここで止まりました（PC の Bridge が途中で止まりました）');
      end if;
    end if;
  end loop;
  return n;
end $$;
revoke all on function app.bridge_sweep_orphans(uuid) from public;
grant execute on function app.bridge_sweep_orphans(uuid) to kaname_app;

-- 権限が変わったときに切るのは画面（ブラウザ）のセッションだけ。PC（Bridge）のセッションは 外す・パスワード変更・退会・国や端末の変化で切り、
--   権限の変化では切らない（D-128.121）。任せた仕事は、押した人が直せなくなったら止める合図で止める（D-128.138・app.ticket_job_stop_reason）
create or replace function app.on_permission_change() returns trigger language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_member uuid := coalesce(new.grantee_member_id, old.grantee_member_id); v_tenant uuid; n int;
begin
  select tenant_id into v_tenant from members where id = v_member;
  update sessions set revoked_at = now(), revoke_reason_id = 'permission_changed'
   where member_id = v_member and revoked_at is null and kind_id is distinct from 'bridge';
  get diagnostics n = row_count;
  if n > 0 then perform app.record_security_event(v_tenant, 'sessions_revoked', v_member, null, jsonb_build_object('reason', 'permission_changed', 'count', n)); end if;
  return coalesce(new, old);
end $$;
revoke all on function app.on_permission_change() from public;

insert into app.schema_migrations (name) values ('0091_ticket_delegate.sql') on conflict do nothing;
