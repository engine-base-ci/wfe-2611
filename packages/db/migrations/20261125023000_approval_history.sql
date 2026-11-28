-- 20261125023000_approval_history 決めた履歴を読む（K-750・契約の口 listApprovalHistory・読むだけ・D-125.105・D-128.36・D-131.14・D-153.21・D-153.27・D-153.31）
--   列も表も足さない。足すのは読む関数 1 本（app.approval_history）。
--   読むのは呼んだ人が決めた（approvals.approver_member_id＝承認の行を決めたときの担当者・0100 の app.approval_decide と K-732 の app.approval_stop が入れる）
--   AI の成果物の承認（承認・差し戻し・止める）。決めた新しい順（decided_at・id の降順）。決まっていない承認待ち・ほかの人が決めた物・
--   別の会社の物・消したチケットの物・見えないチケットの物は出ない。渡しの行（ticket_handovers）は読まない。
--   期間は日本時間の日付（両端を含む・null は無制限）。数（counts）は期間までを同じ条件で絞った数（決めの札では絞らない）。
--   取り下げられるか（can_withdraw）は K-733 の app.approval_withdraw が通す条件と同じ判定を 1 つの式に置く：
--   承認で・取り下げの印が無く・承認の後の実行（一番新しい execute の行）が queued で・その仕事（bridge_jobs）も queued。
--   K-733 の条件を変えるときは、この式も同時に直す（K750-API-007 が見張る）。
--   p_decision は null・approve・return・stop のどれか。それ以外は { error: bad_query }（口は入口で先に 422 にする。直に呼ばれたときの 2 層目）。
--   security definer・search_path に pg_temp・public から外す（D-128.171）。

create or replace function app.approval_history(p_decision text, p_from date, p_to date, p_limit integer,
                                                p_after_at timestamptz, p_after_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare v_rows jsonb; v_counts jsonb;
begin
  if p_decision is not null and p_decision not in ('approve', 'return', 'stop') then
    return jsonb_build_object('error', 'bad_query');
  end if;
  with mine as (
    select a.id, a.decision, a.decided_at, a.return_reason, a.next_actor, a.withdrawn_at, t.id as ticket_id, t.number, t.title
      from approvals a join tickets t on t.id = a.ticket_id
     where app.member_ok()
       and a.tenant_id = app.tenant_id() and t.tenant_id = app.tenant_id()
       and a.approver_member_id = app.user_id()
       and a.kind = 'artifact' and a.decision in ('approve', 'return', 'stop') and a.decided_at is not null
       and a.deleted_at is null and t.deleted_at is null
       and app.ticket_visible(t.id)
       and (p_from is null or (a.decided_at at time zone 'Asia/Tokyo')::date >= p_from)
       and (p_to is null or (a.decided_at at time zone 'Asia/Tokyo')::date <= p_to)
  ),
  page as (
    select m.* from mine m
     where (p_decision is null or m.decision = p_decision)
       and (p_after_at is null or (m.decided_at, m.id) < (p_after_at, p_after_id))
     order by m.decided_at desc, m.id desc
     limit greatest(1, least(coalesce(p_limit, 20), 201))
  ),
  shaped as (
    select p.*, run.status_id as run_status,
           (p.decision = 'approve' and p.withdrawn_at is null and run.status_id = 'queued'
            and coalesce(j.state_id = 'queued', false)) as can_withdraw
      from page p
      left join lateral (select ar.status_id, ar.bridge_job_id from action_runs ar
                          where ar.approval_id = p.id and ar.phase = 'execute'
                          order by ar.created_at desc limit 1) run on true
      left join bridge_jobs j on j.id = run.bridge_job_id
  )
  select coalesce((select jsonb_agg(jsonb_build_object(
           'id', s.id, 'ticket_id', s.ticket_id, 'ticket_number', s.number, 'title', s.title,
           'decision', s.decision, 'decided_at', s.decided_at,
           'reason', case when s.decision = 'return' then s.return_reason end,
           'next_actor', s.next_actor, 'withdrawn_at', s.withdrawn_at,
           'run_status', s.run_status, 'can_withdraw', coalesce(s.can_withdraw, false))
         order by s.decided_at desc, s.id desc) from shaped s), '[]'::jsonb),
         (select jsonb_build_object('total', count(*)::integer,
                                    'approve', (count(*) filter (where m.decision = 'approve'))::integer,
                                    'return', (count(*) filter (where m.decision = 'return'))::integer,
                                    'stop', (count(*) filter (where m.decision = 'stop'))::integer) from mine m)
    into v_rows, v_counts;
  return jsonb_build_object('rows', v_rows, 'counts', v_counts);
end $$;
revoke all on function app.approval_history(text, date, date, integer, timestamptz, uuid) from public;
grant execute on function app.approval_history(text, date, date, integer, timestamptz, uuid) to kaname_app;
