-- 20261125025900_dry_run_sweep 試し打ちの片付け（K-779・K-746 の分け・関門 C2・D-153.6・D-153.7・D-128.98・D-152.24・D-136.1）
--   ① app.dry_run_stop_waiting：そのチケットの待っている（queued）試し打ちの仕事を止める（誰にも渡さない）
--   ② 引き金 approvals_dry_run_stop：承認する・差し戻す・止める（K-732）・取り下げ（K-733）で承認の行の decision か withdrawn_at が決まったら ① を呼ぶ。
--      承認の関数 app.approval_decide は直さない。失敗は警告 1 行だけで承認の取引を止めない
--   ③ app.dry_run_expire：PC が取りに来る前の片付け。待ってから 24 時間を過ぎた試し打ちを止める（K-164 の app.ticket_execute_expire と同じ形）
--   ④ app.knowledge_breach_on_job_done（段 10 の K-700 の引き金の関数）を作り直し、最新の実行が試し打ちなら数えない
--   実行の記録とやり取りの 1 行は書かない（仕事が閉じたときに K-746 の引き金 bridge_jobs_dry_run_end が書く）。動いている（running）試し打ちは止めない。
--   全部 create or replace・drop trigger if exists → create trigger。もう 1 度当てても壊れない。security definer・search_path に pg_temp・public から外す（D-128.171）

-- ---------------------------------------------------------------- ① 待っている試し打ちを止める（中だけで使う）
--   PC の取り（app.bridge_take_job・for update skip locked）と競っても、取られた仕事（running）は state_id = 'queued' に当たらず止めない
create or replace function app.dry_run_stop_waiting(p_ticket uuid, p_why text) returns integer
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare n int;
begin
  if p_ticket is null then return 0; end if;
  update bridge_jobs j set state_id = 'stopped', stopped_reason = p_why, finished_at = now(), partial = null
   where j.state_id = 'queued' and j.kind = 'ticket' and j.deleted_at is null
     and j.id in (select r.bridge_job_id from action_runs r
                   where r.ticket_id = p_ticket and r.phase = 'dry_run' and r.status_id = 'queued'
                     and r.deleted_at is null and r.bridge_job_id is not null);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function app.dry_run_stop_waiting(uuid, text) from public;

-- ---------------------------------------------------------------- ② 承認が決まったら止める（引き金）
create or replace function app.approvals_dry_run_stop() returns trigger
language plpgsql security definer set search_path = public, app, pg_temp as $$
begin
  begin
    perform app.dry_run_stop_waiting(new.ticket_id, '承認が決まったので、待っていた試し打ちを止めました');
  exception when others then
    -- 入れ子の取引なので止めた分は戻る。待ちのまま残った試し打ちは次の片付け（24 時間・③）で止まる
    raise warning '[dry_run] 待っている試し打ちを止められなかった（%）', sqlstate;
  end;
  return null;
end $$;
revoke all on function app.approvals_dry_run_stop() from public;

drop trigger if exists approvals_dry_run_stop on approvals;
create trigger approvals_dry_run_stop after update of decision, withdrawn_at on approvals
  for each row when (new.kind = 'artifact' and ((old.decision is null and new.decision is not null)
                                                or (old.withdrawn_at is null and new.withdrawn_at is not null)))
  execute function app.approvals_dry_run_stop();

-- ---------------------------------------------------------------- ③ PC が取りに来る前の片付け（24 時間）
--   呼んだ人（app.user_id()）の PC の印でなければ何も変えずに 0。その人のアカウントの待っている試し打ちのうち、待ってから 24 時間を過ぎた物を止める
create or replace function app.dry_run_expire(p_session uuid) returns integer
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_member uuid; n int;
begin
  select s.member_id into v_member from sessions s
   where s.id = p_session and s.kind_id = 'bridge' and s.revoked_at is null and s.deleted_at is null;
  if v_member is null or app.user_id() is null or v_member <> app.user_id() then return 0; end if;
  update bridge_jobs j set state_id = 'stopped', stopped_reason = '待っている間に 24 時間を過ぎたので、試し打ちを止めました',
         finished_at = now(), partial = null
   where j.member_id in (select app.account_members(v_member)) and j.kind = 'ticket' and j.state_id = 'queued'
     and j.deleted_at is null and j.created_at <= now() - interval '24 hours'
     and exists (select 1 from action_runs r
                  where r.bridge_job_id = j.id and r.phase = 'dry_run' and r.status_id = 'queued' and r.deleted_at is null
                    and r.id = (select r2.id from action_runs r2 where r2.bridge_job_id = j.id
                                 order by r2.created_at desc, r2.id desc limit 1));
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function app.dry_run_expire(uuid) from public;
grant execute on function app.dry_run_expire(uuid) to kaname_app;

-- ---------------------------------------------------------------- ④ 段 10 の K-700 の引き金の関数（試し打ちは数えない）
--   K-700（20261125014000_knowledge_breaches）の本体の写し。足したのは「★ K-779」の 1 分かれ道だけ
create or replace function app.knowledge_breach_on_job_done() returns trigger
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_ticket uuid;
  v_phase text;
begin
  if coalesce(new.result, '') !~ '\S' then
    return null;
  end if;
  select r.ticket_id, r.phase into v_ticket, v_phase from action_runs r
   where r.bridge_job_id = new.id order by r.created_at desc, r.id desc limit 1;
  if v_ticket is null then
    return null;
  end if;
  -- ★ K-779：試し打ちは確認項目を変えない仕事なので、破られた数に数えない
  if v_phase = 'dry_run' then
    return null;
  end if;
  begin
    perform app.knowledge_breach_scan(v_ticket);
  exception when others then
    raise warning '[knowledge] 破られた数を数えられなかった（%）', sqlstate;
  end;
  return null;
end $$;
revoke all on function app.knowledge_breach_on_job_done() from public;
