-- 0099 PC が仕事を受け取る口の守り（K-189・基盤・D-090・D-127.9・D-128.98・D-128.125・D-128.143・D-128.147・D-128.171・D-131.14）
--   番号は取り込む順の次の空き番号（K164 の 0098 の次）。新しい表・列は作らない。変えるのは渡す関数 app.bridge_take_job の引数 1 つと、選ぶ条件 1 つだけ。
--   取る口（takeBridgeJob）の前の片付け app.ticket_execute_expire（0098）が例外になった回は、口が p_hold_execute = true で呼ぶ。
--     その回は承認の後の実行（action_runs.phase execute）の仕事を 1 つも渡さない。会話・作る段の仕事は渡す（決める人の答え b01eda354e6c ③）。
--     渡さなかった実行は queued のまま残り、片付けが直った回に今までどおり渡る・止まる・聞き直しになる。
--   伝え方は引数 1 つ（別の関数にしない＝仕事を選ぶ本体を 2 つ持たない）。引数 1 つの呼び方は既定値 false で今までどおり（0096 の ①・②）。
--   引数の形が変わるので、前の形 (uuid) を外して作り直す（残すと引数 1 つの呼び方がどちらか決まらない）。本体は 0096 の写し。
--   security definer・search_path に pg_temp・public から外し kaname_app だけに渡す（0096 と同じ・D-128.171）。

-- squawk-ignore ban-drop-function
drop function if exists app.bridge_take_job(uuid);
create function app.bridge_take_job(p_session uuid, p_hold_execute boolean default false)
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
     -- ③ 取る口の前の片付けが失敗した回（p_hold_execute）は、承認の後の実行を 1 つも選ばない（止める理由・承認からの時間・チケットの有無を見ない。判定の関数を呼ばない）。
     --    止めはしない（queued のまま残す）。止める・聞き直すのは片付けの 1 か所だけ（0098）
     and not (coalesce(p_hold_execute, false)
              and exists (select 1 from action_runs ar where ar.bridge_job_id = x.id and ar.phase = 'execute'))
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

insert into app.schema_migrations (name) values ('0099_bridge_take_guard.sql') on conflict do nothing;
