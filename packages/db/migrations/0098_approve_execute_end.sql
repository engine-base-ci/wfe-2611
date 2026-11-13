-- 0098 実行の結末と時間の流れ（K-164・K-63 の孫・D-090・D-124・D-125.106・D-127.9・D-128.98・D-128.171・D-128.176・D-129.47・D-131.2・D-131.4・D-131.14）
--   番号は取り込む順の次の空き番号（K-163 の 0097 の次）。新しい表・列は作らない。足すのは関数と引き金。
--   確定の時点：承認の後の仕事（phase execute）を PC が中身のある結果で「終わった」と返した時点
--     （引き金 app.ticket_execute_job_end が実行の記録を done にし、チケットを作業中に戻し、やり取りに 1 行を書く）。
--   片付けで止めるものはどれも stopped（cancelled は人が承認を取り下げたときだけ・D-131.14）。止まったら自動で戻さない（D-090）。
--   片付けの理由が重なったら「チケットが消された」＞「任せた人が使えない」＞「承認から 24 時間」の順で 1 つにする（決める人の答え bf373f5b265a）。
--   どの関数も p_member を受けず、呼んだ人を app.user_id() で引く。security definer・search_path に pg_temp・public から外し kaname_app だけに渡す（D-128.171）。
--   中だけで使う関数は誰にも execute を渡さない。

-- ---------------------------------------------------------------- 中だけで使う関数（誰にも execute を渡さない）
-- 承認の後の実行の仕事を止める理由（24 時間より先に見る 2 つ）：チケットが消された ＞ 任せた人が使えない（0096 の 3 つの文）。
--   承認の後の実行の仕事でない・止める理由が無いなら null
create or replace function app.ticket_execute_stop_reason(p_job uuid) returns text
language sql stable security definer set search_path = public, app, pg_temp as $$
  select case when t.deleted_at is not null then 'チケットが消されたので止めました'
              else app.ticket_delegator_stop(t.id, j.member_id) end
    from bridge_jobs j
    join lateral (select ar.* from action_runs ar where ar.bridge_job_id = j.id order by ar.created_at desc limit 1) r on true
    join tickets t on t.id = r.ticket_id
   where j.id = p_job and j.kind = 'ticket' and r.phase = 'execute'
$$;
revoke all on function app.ticket_execute_stop_reason(uuid) from public;

-- 待っている承認の後の仕事の片付け（② と ② b の本体）。
--   仕事の行を for update で取り、queued の行だけを条件つきで変える。PC の取り（app.bridge_take_job）は for update skip locked で取るので、
--   同じ仕事は「渡される」か「片付けられる」のどちらか 1 つ。変わった行があったときだけ聞き直しの行を書く（聞き直しの行は 1 つ）。
--   実行の記録・チケットの段（作業中）・やり取りの 1 行は、仕事を閉じたときの引き金（④）が書く。
--   24 時間だけのものは、決まった承認を変えずに（0063 の approvals_once）新しい承認待ちの行で聞き直し、チケットを承認待ちに戻す（D-127.9・D-128.98）
create or replace function app.ticket_execute_sweep_jobs(p_jobs uuid[]) returns integer
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_id uuid; j bridge_jobs%rowtype; r action_runs%rowtype; ap approvals%rowtype; t tickets%rowtype;
        v_why text; v_24 boolean; n int := 0;
begin
  for v_id in select x from unnest(coalesce(p_jobs, '{}')) x where x is not null order by x loop
    select * into j from bridge_jobs where id = v_id for update;
    if j.id is null or j.state_id <> 'queued' or j.kind <> 'ticket' then continue; end if;
    select * into r from action_runs where bridge_job_id = j.id order by created_at desc limit 1;
    if r.id is null or r.phase is distinct from 'execute' or r.status_id <> 'queued' then continue; end if;
    select * into ap from approvals where id = r.approval_id;
    select * into t from tickets where id = r.ticket_id;
    v_why := app.ticket_execute_stop_reason(j.id);
    v_24 := v_why is null and (ap.decided_at is null or ap.decided_at <= now() - interval '24 hours');
    if v_why is null and not v_24 then continue; end if;
    update bridge_jobs set state_id = 'stopped', finished_at = now(),
           stopped_reason = coalesce(v_why, '承認から 24 時間を過ぎたので、実行の前にもう一度確かめます')
     where id = j.id and state_id = 'queued';
    if not found then continue; end if;
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
  end loop;
  return n;
end $$;
revoke all on function app.ticket_execute_sweep_jobs(uuid[]) from public;

-- ---------------------------------------------------------------- ② PC が取りに来る前の片付け（その PC の人の、待っている承認の後の仕事）
--   その PC のセッションの人が呼んだ人（要求の PC と同じ）でなければ何も変えずに 0 を返す（K63-API-058）
create or replace function app.ticket_execute_expire(p_session uuid) returns integer
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_member uuid;
begin
  select s.member_id into v_member from sessions s
   where s.id = p_session and s.kind_id = 'bridge' and s.revoked_at is null and s.deleted_at is null;
  if v_member is null or app.user_id() is null or v_member <> app.user_id() then return 0; end if;
  return app.ticket_execute_sweep_jobs(array(
    select j.id from bridge_jobs j join action_runs r on r.bridge_job_id = j.id
     where j.member_id in (select app.account_members(v_member)) and j.kind = 'ticket' and j.state_id = 'queued'
       and j.deleted_at is null and r.phase = 'execute' and r.status_id = 'queued'));
end $$;
revoke all on function app.ticket_execute_expire(uuid) from public;
grant execute on function app.ticket_execute_expire(uuid) to kaname_app;

-- ---------------------------------------------------------------- ② b 読むときの片付け（読む口が読む前に呼ぶ。何度呼んでも同じになる）
-- そのチケット 1 枚（そのチケットが見える人だけ。見えなければ何も変えない）
create or replace function app.ticket_execute_sweep(p_ticket uuid) returns integer
language plpgsql security definer set search_path = public, app, pg_temp as $$
begin
  if p_ticket is null or not app.member_ok() or not app.ticket_visible(p_ticket) then return 0; end if;
  return app.ticket_execute_sweep_jobs(array(
    select r.bridge_job_id from action_runs r join bridge_jobs j on j.id = r.bridge_job_id
     where r.ticket_id = p_ticket and r.tenant_id = app.tenant_id() and r.phase = 'execute' and r.status_id = 'queued'
       and j.state_id = 'queued' and j.deleted_at is null));
end $$;
revoke all on function app.ticket_execute_sweep(uuid) from public;
grant execute on function app.ticket_execute_sweep(uuid) to kaname_app;

-- 呼んだ人が今の担当者のチケットの、待っている承認の後の仕事を全部（承認待ちの一覧。消されたチケットの仕事も止める）
create or replace function app.ticket_execute_sweep_mine() returns integer
language plpgsql security definer set search_path = public, app, pg_temp as $$
begin
  if app.user_id() is null or not app.member_ok() then return 0; end if;
  return app.ticket_execute_sweep_jobs(array(
    select r.bridge_job_id from action_runs r join tickets t on t.id = r.ticket_id join bridge_jobs j on j.id = r.bridge_job_id
     where t.tenant_id = app.tenant_id() and t.assignee_member_id = app.user_id()
       and r.phase = 'execute' and r.status_id = 'queued' and j.state_id = 'queued' and j.deleted_at is null));
end $$;
revoke all on function app.ticket_execute_sweep_mine() from public;
grant execute on function app.ticket_execute_sweep_mine() to kaname_app;

-- ---------------------------------------------------------------- ④ 承認の後の仕事の終わり
--   終わる口（app.bridge_finish_job）・PC がつながり直したときの後始末（app.bridge_sweep_orphans）・人を止めた／外したとき（app.on_member_stopped）・
--   片付け（② ② b）のどこから仕事を閉じても同じ：
--     done で結果に中身がある → 実行の記録は done・やり取りに「<任せた人>のAI が実行しました：<結果の始め 200 字>」（確定の時点）
--     done で結果が空（空白・改行だけ）→ 完了と見なさず止まった（E-SIG-004・G-15）
--     stopped → 止まった。理由は全文そのまま（切らない・D-131.2）。理由が空なら D-129.47 の文（D-131.4）
--     cancelled → 実行の記録も cancelled（人がやめたときだけ・D-131.14）
--   どれもチケットを作業中に戻す（24 時間の聞き直しは、片付けがこの後で承認待ちに戻す）。新しい仕事は積まない（自動で戻さない・D-090）
create or replace function app.ticket_execute_job_end() returns trigger
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare r action_runs%rowtype; v_ok boolean; v_state text; v_why text; v_name text;
begin
  select * into r from action_runs where bridge_job_id = new.id order by created_at desc limit 1 for update;
  if r.id is null or r.phase is distinct from 'execute' or r.status_id not in ('queued', 'running', 'asking') then return null; end if;
  v_ok := new.state_id = 'done' and coalesce(new.result, '') ~ '\S';
  v_state := case when v_ok then 'done' when new.state_id = 'cancelled' then 'cancelled' else 'stopped' end;
  v_why := case when v_ok then null
                when new.state_id = 'done' then '自分のAI が結果を返さずに終わりました。完了とは見なしていません'
                when new.state_id = 'cancelled'
                  then coalesce(nullif(btrim(new.stopped_reason), ''), 'PC でこの実行をやめました。もう一度「AI に任せる」を押せます')
                when coalesce(new.stopped_reason, '') ~ '\S' then new.stopped_reason
                else 'AI が途中で止まりました（理由は届いていません）。もう一度「AI に任せる」を押せます' end;
  update action_runs set status_id = v_state, error_summary = v_why, finished_at = now() where id = r.id;
  perform app.ticket_stage_to(r.ticket_id, 'doing', null);
  v_name := app.member_name(new.member_id);
  perform app.ticket_system_line(r.ticket_id, null,
    case when v_ok then v_name || 'のAI が実行しました：' || left(btrim(new.result, E' \t\r\n　'), 200)
         else v_name || 'のAI の実行が止まりました：' || v_why end);
  return null;
end $$;
revoke all on function app.ticket_execute_job_end() from public;
drop trigger if exists bridge_jobs_ticket_execute_end on bridge_jobs;
create trigger bridge_jobs_ticket_execute_end after update of state_id on bridge_jobs
  for each row when (new.kind = 'ticket' and new.state_id in ('done', 'stopped', 'cancelled') and old.state_id is distinct from new.state_id)
  execute function app.ticket_execute_job_end();

-- ---------------------------------------------------------------- 任せた人が止められた・外されたとき（K-62 の 0092 の本体を写し、理由の 1 か所だけを足す）
--   足すのは 1 つだけ：承認の後の実行（phase execute）の仕事は、止める理由を「消された ＞ 任せた人が使えない」の文にする（K63-API-057）。
--   作る段の仕事は 0092 のまま。承認の後の実行の記録・段・やり取りは、仕事を閉じたときの引き金（④）が先に書く（下の輪は閉じた記録を飛ばす）
create or replace function app.on_member_stopped() returns trigger
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare g record; r action_runs%rowtype; v_why text;
begin
  if (new.suspended_at is not null and old.suspended_at is null) or (new.deleted_at is not null and old.deleted_at is null) then
    for g in
      update bridge_jobs bj set state_id = 'stopped', finished_at = now(), partial = null,
             stopped_reason = coalesce(app.ticket_execute_stop_reason(bj.id), app.ticket_job_stop_reason(bj.id),
                                       'このチケットを直す権限が無くなったので止めました')
       where bj.member_id = new.id and bj.kind = 'ticket' and bj.state_id in ('queued', 'running', 'asking') and bj.deleted_at is null
      returning bj.id, bj.stopped_reason
    loop
      select * into r from action_runs where bridge_job_id = g.id order by created_at desc limit 1;
      if r.id is not null and r.status_id in ('queued', 'running', 'asking') then
        update action_runs set status_id = 'stopped', error_summary = g.stopped_reason, finished_at = now() where id = r.id;
        if r.phase = 'make' then
          perform app.ticket_stage_to(r.ticket_id, 'doing', r.created_by);
          update tickets set delegated_to_clone = false where id = r.ticket_id;   -- 旗を下ろす（K62-API-080）
        end if;
        perform app.ticket_system_line(r.ticket_id, r.created_by, app.member_name(r.created_by) || 'のAI が止まりました（' || g.stopped_reason || '）');
      end if;
    end loop;
  end if;
  return new;
end $$;
revoke all on function app.on_member_stopped() from public;

-- 読むたびの片付け（② b）が、待っている承認の後の実行だけを引けるようにする（一覧を読むたびに全部の実行をたどらない）
create index if not exists action_runs_execute_queued_idx on action_runs (ticket_id) where phase = 'execute' and status_id = 'queued';

insert into app.schema_migrations (name) values ('0098_approve_execute_end.sql') on conflict do nothing;
