-- 20261127235900_execute_sweep_stop 片付けに失敗した承認の後の実行を 1 時間で自動で止める・担当者が止めたときの理由の文・実行の形に印の時刻（K-1191・K-190 の子・関門 C2・D-090・D-131.14・D-153.24・D-153.25・D-190.1〜D-190.4・D-190.6）
--   列も表も足さない（印の列 bridge_jobs.sweep_failed_at・sweep_error_code は K-1190 の migration が足す）。作り直すのは関数 3 本：
--     ① 片付けの本体 app.ticket_execute_sweep_jobs(uuid[])：K-1190 の版（1 件ずつ例外を受け、例外の 1 件に印を付け、通った回に印を消す）の写しに、
--        「印が 1 時間以上前の待っている承認の後の実行は、判定を呼ばずに止める」の分かれ道を 1 つ足す（cron が無いので片付けの中で止める・D-190.6）
--     ② 止める関数 app.run_stop(uuid)：K-731 の版の写し。印のある待っている承認の後の実行を止めるときだけ理由の文を替え、止める update で印を消す
--     ③ 実行の形 app.action_run_json(uuid)：20261123085900 の版の写しに sweep_failed_at の 1 欄（実行が待っている時だけ・帯は K-1192）
--   名前の時刻は K-1190・K-731 の migration より後（同じ関数を後から当てて上書きするため）。
--   どの関数も security definer・search_path に pg_temp・public から外す（D-128.171）。

-- ---------------------------------------------------------------- ① 片付けの本体
--   1 件ごとの手順は 0098 のまま（仕事の行を for update で取り、queued の行だけを条件つきで変える。聞き直しの行は 1 つ）。
--   K-1190：1 件ごとを begin … exception when others で包み、例外の 1 件だけを戻して残りを続ける（others は query_canceled を含まない＝時間切れは回全体を戻す）。
--     例外の受けでは印（最初に失敗した時刻・SQLSTATE）を書くだけ。この書き込みが例外なら受けずに外へ出す（回全体が失敗）。
--     1 件の手順が例外なく終わったら（止めた・待ったまま・飛ばした）、印があれば消す。
--   K-1191：仕事と実行が待っている承認の後の実行だと分かった直後（判定を呼ぶ前）に、印が 1 時間以上前なら止める（判定も 24 時間の聞き直しもしない）。
--     実行の記録・段（作業中）・やり取りの 1 行は、仕事を閉じたときの引き金 app.ticket_execute_job_end が書く。
--     止める update が例外なら K-1190 の受けに入る（印の時刻はそのまま・次の回にまた止める）
create or replace function app.ticket_execute_sweep_jobs(p_jobs uuid[]) returns integer
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_id uuid; j bridge_jobs%rowtype; r action_runs%rowtype; ap approvals%rowtype; t tickets%rowtype;
        v_why text; v_24 boolean; n int := 0;
        v_auto constant text := '片付けに失敗したまま 1 時間たったので止めました。もう一度「AI に任せる」を押せます';
begin
  for v_id in select x from unnest(coalesce(p_jobs, '{}')) x where x is not null order by x loop
    begin
      <<one>>
      begin
        select * into j from bridge_jobs where id = v_id for update;
        if j.id is null or j.state_id <> 'queued' or j.kind <> 'ticket' then exit one; end if;
        select * into r from action_runs where bridge_job_id = j.id order by created_at desc limit 1;
        if r.id is null or r.phase is distinct from 'execute' or r.status_id <> 'queued' then exit one; end if;
        -- K-1191 片付けに失敗したまま 1 時間たった実行は、判定を呼ばずに止める（D-190.2・D-190.4）
        if j.sweep_failed_at is not null and j.sweep_failed_at <= now() - interval '1 hour' then
          update bridge_jobs set state_id = 'stopped', finished_at = now(), stopped_reason = v_auto,
                 sweep_failed_at = null, sweep_error_code = null
           where id = j.id and state_id = 'queued';
          if found then n := n + 1; end if;
          exit one;
        end if;
        select * into ap from approvals where id = r.approval_id;
        select * into t from tickets where id = r.ticket_id;
        v_why := app.ticket_execute_stop_reason(j.id);
        v_24 := v_why is null and (ap.decided_at is null or ap.decided_at <= now() - interval '24 hours');
        if v_why is null and not v_24 then exit one; end if;
        update bridge_jobs set state_id = 'stopped', finished_at = now(),
               stopped_reason = coalesce(v_why, '承認から 24 時間を過ぎたので、実行の前にもう一度確かめます')
         where id = j.id and state_id = 'queued';
        if not found then exit one; end if;
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
      end;
      -- 1 件の手順が例外なく終わった：印があれば消す（K-1190）
      update bridge_jobs set sweep_failed_at = null, sweep_error_code = null
       where id = v_id and (sweep_failed_at is not null or sweep_error_code is not null);
    exception when others then
      -- その 1 件の変更だけが戻る。印を書く（時刻は最初のまま・残すのは SQLSTATE だけ）。この update の例外は受けない（回全体が失敗）
      update bridge_jobs set sweep_failed_at = coalesce(sweep_failed_at, now()), sweep_error_code = SQLSTATE where id = v_id;
    end;
  end loop;
  return n;
end $$;
revoke all on function app.ticket_execute_sweep_jobs(uuid[]) from public;

-- ---------------------------------------------------------------- ② 止める（K-731 の 20261125021100 の本体の写し）
--   替えるのは 2 か所だけ：理由の文（印のある待っている承認の後の実行のときだけ「片付けに失敗していたので、〈担当者〉が止めました」・D-190.3）と、
--   待っている仕事を止める update で印の 2 列を消すこと。ほかは K-731 のまま
create or replace function app.run_stop(p_run uuid) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_tenant uuid := app.tenant_id(); v_me uuid := app.user_id(); r action_runs%rowtype; t tickets%rowtype; j bridge_jobs%rowtype;
        v_stage text; v_job uuid; v_was text; v_why text;
begin
  if v_tenant is null or v_me is null or not app.member_ok() then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  -- 錠を取る前に、仕事の id だけを読む（id は変わらない）
  select x.bridge_job_id into v_job from action_runs x where x.id = p_run and x.tenant_id = v_tenant;
  if v_job is not null then
    select * into j from bridge_jobs where id = v_job for update;
  end if;
  select * into r from action_runs
   where id = p_run and tenant_id = v_tenant and ticket_id is not null and deleted_at is null for update;
  if r.id is null then return jsonb_build_object('ok', false, 'code', 'NOT_FOUND'); end if;
  select * into t from tickets where id = r.ticket_id and tenant_id = v_tenant and deleted_at is null for update;
  if t.id is null or not app.ticket_visible(t.id) then return jsonb_build_object('ok', false, 'code', 'NOT_FOUND'); end if;
  -- 担当者だけ（任せた人・マネージャーではない）。担当者がいないチケットは誰も止められない
  if t.assignee_member_id is distinct from v_me then return jsonb_build_object('ok', false, 'code', 'FORBIDDEN'); end if;
  if r.status_id not in ('queued', 'running', 'asking') then return jsonb_build_object('ok', false, 'code', 'DECIDED'); end if;
  select s.key into v_stage from ticket_stages s where s.id = t.stage_id;
  v_was := r.status_id;
  -- K-1191 片付けに失敗した印のある、待っている承認の後の実行を止めるときだけ理由の文を替える（D-190.3）
  if r.phase = 'execute' and j.id is not null and j.state_id = 'queued' and j.sweep_failed_at is not null then
    v_why := '片付けに失敗していたので、' || app.member_name(v_me) || 'が止めました';
  else
    v_why := app.member_name(v_me) || 'が止めました';
  end if;
  -- 実行を先に止まりにする（PC が遅れて返した結果は app.bridge_finish_job が使わない）
  update action_runs set status_id = 'stopped', error_summary = v_why, finished_at = now(), updated_by = v_me
   where id = r.id returning * into r;
  -- 待っている仕事はその場で止める（PC が取りに来ても渡らない）。動いている仕事は止める合図だけ（PC が読んで返すまで動いたまま）
  if j.id is not null and j.state_id = 'queued' then
    update bridge_jobs set state_id = 'stopped', finished_at = now(), partial = null, stopped_reason = v_why,
           stop_requested_at = now(), sweep_failed_at = null, sweep_error_code = null
     where id = j.id;
  elsif j.id is not null and j.state_id in ('running', 'asking') then
    update bridge_jobs set stop_requested_at = coalesce(stop_requested_at, now()) where id = j.id;
  end if;
  -- 試し打ち（phase dry_run）の実行を止めるときは段と旗に触らない（承認待ちのまま・K-746）
  if r.phase is distinct from 'dry_run' then
    if v_stage = 'running' then perform app.ticket_stage_to(t.id, 'doing', v_me); end if;
    update tickets set delegated_to_clone = false where id = t.id;
  end if;
  perform app.ticket_system_line(t.id, v_me, app.member_name(v_me) || 'が AI を止めました');
  perform app.record_audit('action_runs.stop', 'action_runs', r.id::text, 'C2',
                           jsonb_build_object('ticket_id', t.id, 'was', v_was, 'phase', r.phase));
  return jsonb_build_object('ok', true, 'run', jsonb_build_object(
           'id', r.id, 'ticket_id', r.ticket_id, 'phase', r.phase, 'status', r.status_id,
           'stopped_reason', r.error_summary, 'stopped_at', r.finished_at));
end $$;
revoke all on function app.run_stop(uuid) from public;
grant execute on function app.run_stop(uuid) to kaname_app;

-- ---------------------------------------------------------------- ③ 実行の 1 件の形（ActionRunView）に sweep_failed_at の 1 欄だけを足す（20261123085900 の本体の写し）
--   実行が待っている（queued）ときだけ仕事の印の時刻、ほかは null。出すのは時刻だけ（SQLSTATE・例外の文は出さない）
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
    'taken_over_at', r.taken_over_at,
    'sweep_failed_at', case when r.status_id = 'queued' then j.sweep_failed_at end,
    'checks', jsonb_build_object('state', 'none'));
end $$;
revoke all on function app.action_run_json(uuid) from public;
