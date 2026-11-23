-- 20261119120300_device_browser_check もう一度確かめる仕事をその PC に宛てる（K-365・契約の口 checkMyDeviceBrowser・関門 C2）
--   前の道すじの app.agent_browser_check（0057）は人に宛てるので、PC が 2 台あると押していない PC が確かめてしまう（代表の答え answer=0a262be577b2 ①）。
--   仕事に宛先の PC の列を足し、仕事を受け取る関数に「宛先が無いか、自分宛て」の条件を 1 つ足す。
--   PC はアカウントのもの（D-128.137・D-128.156）。持ち主の確かめは口（app.bridge_devices）と、この DB の関数（app.account_members）の 2 重（D-128.166）。
--   前の道すじ（/agent/browser-check・app.agent_browser_check）は消さない（K-367）。前の道すじの仕事は宛先が空なので、今までどおりどの PC でも受け取る。

-- ① 仕事の宛先の PC（受け取った PC の taken_session_id・会話の続きの PC の resume_session_id とは別の意味）。空＝どの PC でも受け取る
alter table bridge_jobs add column if not exists target_session_id uuid references sessions(id);
create index if not exists bridge_jobs_target_session_idx on bridge_jobs (target_session_id) where target_session_id is not null;

-- ② その PC に宛てた確かめの仕事を 1 つ積む。答えは {"state": "not_found" | "asleep" | "queued", "job_id"?}
--   ・その人のアカウントの、外していない・消していない Bridge の行でなければ not_found（他の人の PC・外した PC・消した PC・無い PC を見分けさせない）
--   ・返事がまだ（alive_at が空）か、最後の知らせが 75 秒より前（app.bridge_devices の state と同じ式）なら asleep（積まない）
--   ・その PC 宛ての会話の無い仕事が queued か running なら、その仕事を返す（押し重ねても 1 つ）。
--     ただし queued のまま（受け取られていない）で 90 秒より前の仕事は、PC が眠っている間に積まれた古い仕事として cancelled にし、新しく積む（K365-API-020）
--   ・PC の行を for update で読むので、同じ PC で同時に押しても 2 つ目は 1 つ目の仕事を返す（K365-API-017）
create or replace function app.device_browser_check(p_member uuid, p_session uuid, p_prompt text) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  c_stale constant interval := interval '90 seconds';   -- 画面が結果を待つ上限と同じ。queued のままこれより前の仕事は置き換える
  c_alive constant interval := interval '75 seconds';   -- 生きているとみなす最後の知らせからの時間（app.bridge_devices と同じ）
  s sessions%rowtype; m members%rowtype; v_job uuid;
begin
  select * into s from sessions
   where id = p_session and kind_id = 'bridge' and revoked_at is null and deleted_at is null
     and member_id in (select app.account_members(p_member))
   for update;
  if s.id is null then return jsonb_build_object('state', 'not_found'); end if;
  if s.alive_at is null or s.last_seen_at is null or s.last_seen_at <= now() - c_alive then
    return jsonb_build_object('state', 'asleep');
  end if;
  update bridge_jobs set state_id = 'cancelled', finished_at = now()
   where target_session_id = p_session and conversation_id is null and state_id = 'queued'
     and taken_session_id is null and deleted_at is null and created_at < now() - c_stale;
  select id into v_job from bridge_jobs
   where target_session_id = p_session and conversation_id is null and state_id in ('queued', 'running') and deleted_at is null
   order by created_at desc limit 1;
  if v_job is not null then return jsonb_build_object('state', 'queued', 'job_id', v_job); end if;
  select * into m from members where id = s.member_id;
  insert into bridge_jobs (tenant_id, scope_id, member_id, state_id, prompt, permission_mode, browser, target_session_id, created_by)
    values (m.tenant_id, m.scope_id, m.id, 'queued', p_prompt, 'manual', 'chrome', p_session, p_member)
    returning id into v_job;
  return jsonb_build_object('state', 'queued', 'job_id', v_job);
end $$;
revoke all on function app.device_browser_check(uuid, uuid, text) from public;
grant execute on function app.device_browser_check(uuid, uuid, text) to kaname_app;

-- ③ 仕事を受け取る：0099 の本体の写しに、選ぶ条件「宛先が無いか、自分宛て」を 1 つ足すだけ（ほかは変えない・引数の形も同じなので drop しない）
create or replace function app.bridge_take_job(p_session uuid, p_hold_execute boolean default false)
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
     -- ① 承認の後の実行は、24 時間以内に許され、チケットが消されていないものだけ
     and not exists (select 1 from action_runs ar
                      where ar.bridge_job_id = x.id and ar.phase = 'execute'
                        and not exists (select 1 from approvals ap join tickets tk on tk.id = ar.ticket_id
                                         where ap.id = ar.approval_id and ap.decision = 'approve'
                                           and ap.decided_at > now() - interval '24 hours' and tk.deleted_at is null))
     -- ③ 取る口の前の片付けが失敗した回（p_hold_execute）は、承認の後の実行を 1 つも選ばない（0099）
     and not (coalesce(p_hold_execute, false)
              and exists (select 1 from action_runs ar where ar.bridge_job_id = x.id and ar.phase = 'execute'))
     -- ④ 宛先の PC が決まっている仕事は、その PC だけが受け取る（K-365）。宛先の無い仕事は今までどおり
     and (x.target_session_id is null or x.target_session_id = p_session)
   order by x.created_at limit 1 for update skip locked;
  if v_job is null then return; end if;
  update bridge_jobs j set state_id = 'running', started_at = now(), taken_session_id = p_session,
         agent_session_id = coalesce(j.agent_session_id, (select c.agent_session_id from conversations c where c.id = j.conversation_id))
   where j.id = v_job;
  -- チケットの仕事の会話の続きは、同じ人が同じ PC で任せたときだけ（D-129.46）。その番号を出した前の仕事を受け取った PC が違えば、新しい会話で始める
  update bridge_jobs j set agent_session_id = null
   where j.id = v_job and j.kind = 'ticket' and j.agent_session_id is not null and j.resume_session_id is null
     and (select ar.phase from action_runs ar where ar.bridge_job_id = j.id order by ar.created_at desc limit 1) = 'make'   -- 承認の後の実行（K-63 が積む）は行のまま渡す（D-128.176・K62-API-049）
     and not exists (select 1 from bridge_jobs j2
                      where j2.id <> j.id and j2.kind = 'ticket' and j2.agent_session_id = j.agent_session_id
                        and j2.taken_session_id = p_session);
  update action_runs r set status_id = 'running', started_at = coalesce(r.started_at, now())
   where r.bridge_job_id = v_job and r.status_id = 'queued';
  update credentials c set login_check_state = 'running', login_check_at = now()
   where c.id = (select j.credential_id from bridge_jobs j where j.id = v_job and j.kind = 'login_check') and c.login_check_state = 'pending';
  return query
    select j.id, j.prompt,
           -- ② 続きの記録を持つ PC が決まっている仕事は、その PC が取ったときだけ続きを渡す（行の値は残す）
           case when j.resume_session_id is null or j.resume_session_id = p_session then j.agent_session_id end,
           j.conversation_id, j.permission_mode, j.model, j.effort, j.tools,
           coalesce((select array_agg(r.tool || case when coalesce(r.target_pattern, '') = '' then '' else '(' || r.target_pattern || ')' end)
                       from permission_rules r where r.member_id = j.member_id and r.decision_id = 'allow' and r.revoked_at is null and r.deleted_at is null), '{}'),
           coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'mime', a.mime, 'size', a.size))
                       from attachments a where a.id = any(coalesce(j.attachment_ids, '{}'))), '[]'::jsonb),
           j.kind, j.credential_id,
           (select ar.ticket_id from action_runs ar where ar.bridge_job_id = j.id order by ar.created_at desc limit 1),
           (select ar.phase from action_runs ar where ar.bridge_job_id = j.id order by ar.created_at desc limit 1)
      from bridge_jobs j where j.id = v_job;
end $$;
revoke all on function app.bridge_take_job(uuid, boolean) from public;
grant execute on function app.bridge_take_job(uuid, boolean) to kaname_app;

-- ④ PC を外したら（revoked_at か deleted_at を書いたら・外すどの道でも）、その PC 宛ての queued の仕事を同じ取引で取り下げる（K365-API-019）。
--   running は触らない。宛先の無い仕事も触らない。trigger が落ちたら外す取引ごと戻る（PC が外れて仕事だけ残る形にならない・K365-API-021）
create or replace function app.bridge_jobs_cancel_for_gone_device() returns trigger
language plpgsql security definer set search_path = public, app, pg_temp as $$
begin
  update bridge_jobs set state_id = 'cancelled', finished_at = now()
   where target_session_id = new.id and state_id = 'queued';
  return null;
end $$;
-- trigger は作った時点で結ばれ行の更新で動くので、誰にも実行権を渡さない（D-128.171）
revoke all on function app.bridge_jobs_cancel_for_gone_device() from public;
drop trigger if exists sessions_cancel_target_jobs on sessions;
create trigger sessions_cancel_target_jobs after update of revoked_at, deleted_at on sessions
  for each row
  when (new.kind_id = 'bridge' and ((old.revoked_at is null and new.revoked_at is not null) or (old.deleted_at is null and new.deleted_at is not null)))
  execute function app.bridge_jobs_cancel_for_gone_device();
