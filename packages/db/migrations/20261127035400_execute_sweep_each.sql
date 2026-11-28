-- 20261127035400_execute_sweep_each 承認の後の実行の片付けを 1 件ずつ受ける（K-1190・K-190 の子・関門 C2・決める人の答え answer=6cc3d368a591）
--   今まで（0098）：片付けの本体の輪で 1 件の判定が例外になると、本体ごと例外になり、その回の片付けが全部戻った。
--   この migration で：
--     ① bridge_jobs に片付けに失敗した印の列を 2 つ（最初に失敗した時刻・例外の SQLSTATE。文は残さない）
--     ② 本体 app.ticket_execute_sweep_jobs を 0098 から作り直し、輪の 1 件ごとを begin … exception で包む。
--        例外の 1 件は変更だけを戻して印を付け、残りを続ける。1 件の手順が通ったら印を消す。
--        plpgsql の others は query_canceled（時間切れ・取り消し）を含まないので、それは受けずに回全体を戻す（0104 の包み・K-189 が受ける）。
--        印を書く update が例外になったら受けずに外へ出す（回全体が失敗＝K-189 の形。印の無いまま判定の壊れた仕事を渡さない）
--     ③ 渡す関数 app.bridge_take_job を 20261119120300 から作り直し、印の付いた仕事を選ばない条件を 1 つ足す
--   片付けの入口 3 つ（app.ticket_execute_expire・app.ticket_execute_sweep・app.ticket_execute_sweep_mine）は変えない（中で本体を呼ぶだけ）。
--   止める理由の順・止めたものは stopped・止まったら自動で戻さない は 0098 のまま（D-090・D-131.14）。

-- ① 片付けに失敗した印（どちらも null 可・既定なし。null＝印なし）
alter table bridge_jobs add column if not exists sweep_failed_at timestamptz;
alter table bridge_jobs add column if not exists sweep_error_code text;

-- ② 片付けの本体（0098 の写し。輪の 1 件ごとを包み、印を付ける・消すを足す。返す数・権限は 0098 と同じ）
create or replace function app.ticket_execute_sweep_jobs(p_jobs uuid[]) returns integer
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_id uuid; j bridge_jobs%rowtype; r action_runs%rowtype; ap approvals%rowtype; t tickets%rowtype;
        v_why text; v_24 boolean; n int := 0;
begin
  for v_id in select x from unnest(coalesce(p_jobs, '{}')) x where x is not null order by x loop
    begin
      select * into j from bridge_jobs where id = v_id for update;
      if j.id is not null and j.state_id = 'queued' and j.kind = 'ticket' then
        select * into r from action_runs where bridge_job_id = j.id order by created_at desc limit 1;
        if r.id is not null and r.phase = 'execute' and r.status_id = 'queued' then
          select * into ap from approvals where id = r.approval_id;
          select * into t from tickets where id = r.ticket_id;
          v_why := app.ticket_execute_stop_reason(j.id);
          v_24 := v_why is null and (ap.decided_at is null or ap.decided_at <= now() - interval '24 hours');
          if v_why is not null or v_24 then
            update bridge_jobs set state_id = 'stopped', finished_at = now(),
                   stopped_reason = coalesce(v_why, '承認から 24 時間を過ぎたので、実行の前にもう一度確かめます')
             where id = j.id and state_id = 'queued';
            if found then
              n := n + 1;
              if v_24 and ap.id is not null then
                -- 承認する人は今の担当者。取り消せないの印・人が見る項目は前の承認のまま
                insert into approvals (tenant_id, scope_id, ticket_id, kind, action_run_id, requested_by, approver_member_id, status_id,
                                       subject_type, subject_id, irreversible, human_checks, note, created_by)
                  values (ap.tenant_id, ap.scope_id, ap.ticket_id, ap.kind, ap.action_run_id, ap.requested_by, t.assignee_member_id, 'pending',
                          'approval', ap.id, true, ap.human_checks,
                          '承認から 24 時間を過ぎたので、実行の前にもう一度確かめてください', ap.requested_by);
                perform app.ticket_stage_to(t.id, 'awaiting_approval', null);
              end if;
            end if;
          end if;
        end if;
      end if;
      -- 1 件の手順が例外なく終わった（止めた・待ったまま・見る物でなかった のどれでも）：前の回の印があれば消す
      update bridge_jobs set sweep_failed_at = null, sweep_error_code = null
       where id = v_id and (sweep_failed_at is not null or sweep_error_code is not null);
    exception when others then
      -- その 1 件の変更だけが戻った。印を付けて残りを続ける（数えない）。時刻は最初の失敗のまま。
      --   この update が例外になったら受けずに外へ出る（回全体が失敗）
      update bridge_jobs set sweep_failed_at = coalesce(sweep_failed_at, now()), sweep_error_code = SQLSTATE
       where id = v_id;
    end;
  end loop;
  return n;
end $$;
revoke all on function app.ticket_execute_sweep_jobs(uuid[]) from public;

-- ③ 仕事を受け取る：20261119120300 の本体の写しに、選ぶ条件「印が無い」を 1 つ足すだけ（ほかは変えない・引数の形も同じなので drop しない）
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
     -- ⑤ 片付けで 1 件だけ例外になった仕事（印の付いた仕事）は渡さない（K-1190）。印は片付けが通った回に消える
     and x.sweep_failed_at is null
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
