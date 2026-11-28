-- 0094 承認待ちを見る（K-161・K-63 の孫・D-012・D-125.107・D-128.25・D-128.36・D-128.138・D-131.9・D-131.10・D-131.11）
--   番号は K-145 の 0093 の次（取り込む順の次の空き番号）。新しい表・列は作らない。読む関数だけ（書き込みは無い・確定の時点は無い）。
--   一覧と数は呼んだ時点の DB の値。並びの鍵は due_on（期限なしは最後）・created_at・id。絞るのも切るのも DB 側（where と limit・G-16・D-131.9）。
--   どの関数も p_member を受けず、呼んだ人を app.user_id() で引く。security definer・search_path に pg_temp・public から外し kaname_app だけに渡す（D-128.171）。
--   中だけで使う関数は誰にも execute を渡さない。
--   読む前の片付け（24 時間を過ぎた待ちの仕事を止める）は K-164、チケットの帯（app.ticket_band）は K-162 が足す。

-- 呼んだ人がそのチケットの今の担当者か（承認する人＝今の担当者・D-128.25・D-128.138）。行の守り approvals_read（policies/0094）と口の行の決まりが使う
create or replace function app.ticket_assignee_is_me(p_ticket uuid) returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select exists (select 1 from tickets t where t.id = p_ticket and t.tenant_id = app.tenant_id() and t.assignee_member_id = app.user_id())
$$;
revoke all on function app.ticket_assignee_is_me(uuid) from public;
grant execute on function app.ticket_assignee_is_me(uuid) to kaname_app;

-- 承認の 1 件を読める人：承認する人（今の担当者・決めた時点の承認する人）・マネージャー・チケットの作った人・AI に任せた人（requested_by）
--   口の行の決まり（scripts/ci/row_rules.mjs の OP_RULES.getApproval）とそろえる（守りは 2 層・どちらか片方を外しても、もう片方が止める）
create or replace function app.approval_readable(p_approval uuid) returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select exists (
    select 1 from approvals a join tickets t on t.id = a.ticket_id
     where a.id = p_approval and a.tenant_id = app.tenant_id() and t.tenant_id = app.tenant_id()
       and a.deleted_at is null and t.deleted_at is null
       and (a.approver_member_id = app.user_id() or a.requested_by = app.user_id()
            or t.assignee_member_id = app.user_id() or t.created_by = app.user_id()
            or app.manages_scope(a.scope_id) or app.manages_scope(t.scope_id)))
$$;
revoke all on function app.approval_readable(uuid) from public;

-- 承認待ちの行の形（一覧）。取り消せる操作で人が見る項目が無い行だけ、その場で決められる（decide_inline）
create or replace function app.approval_item_json(p_approval uuid) returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  select jsonb_build_object(
           'kind', a.kind, 'id', a.id, 'ticket_id', t.id, 'ticket_number', t.number, 'title', t.title,
           'from_member_id', a.requested_by, 'from_name', app.member_name(a.requested_by),
           'check_summary', '検査なし（まだ流していません）',
           'due_on', to_char(t.due_on, 'YYYY-MM-DD'),
           'decide_inline', not a.irreversible and coalesce(a.human_checks, '[]'::jsonb) = '[]'::jsonb,
           'irreversible', a.irreversible,
           'primary_action', case when not a.irreversible and coalesce(a.human_checks, '[]'::jsonb) = '[]'::jsonb
                                  then 'approve' else 'open' end,
           'secondary_action', 'return', 'note', a.note, 'created_at', a.created_at)
    from approvals a join tickets t on t.id = a.ticket_id where a.id = p_approval
$$;
revoke all on function app.approval_item_json(uuid) from public;

-- 呼んだ人が決める承認待ちの条件（一覧と数で同じ）：今の担当者が呼んだ人・kind artifact・決まっていない・
--   書けるチケットだけ（本人のものでない取り込みの下書きを外す・D-131.10）・チケットが消されていない。
--   一覧は鍵と limit を同じ where に入れて DB に絞らせる（呼んだ人の承認待ちを全部読んでから切らない・G-16・D-131.9）。
--   索引は tickets_assignee_idx（担当者）と approvals_ticket_idx（チケット）

-- 承認待ちの一覧：期限の早い順（期限なしは最後）・同じなら古い順・同じなら id の順。鍵（p_after_*）より後の行を p_limit 件。
--   鍵が無い（p_after_created が null）なら頭から。期限なしの行の鍵は p_after_due が null
create or replace function app.approval_queue(p_limit integer, p_after_due date, p_after_created timestamptz, p_after_id uuid)
returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  select coalesce(jsonb_agg(app.approval_item_json(x.id) order by x.due_on asc nulls last, x.created_at asc, x.id asc), '[]'::jsonb)
    from (select a.id, t.due_on, a.created_at
            from tickets t join approvals a on a.ticket_id = t.id
           where app.member_ok()
             and t.tenant_id = app.tenant_id() and a.tenant_id = app.tenant_id() and t.deleted_at is null
             and t.assignee_member_id = app.user_id() and a.kind = 'artifact'
             and a.decision is null and a.withdrawn_at is null and a.deleted_at is null
             and app.ticket_writable(t.id)
             and (p_after_created is null
                  or (p_after_due is not null and (t.due_on is null or t.due_on > p_after_due
                                                   or (t.due_on = p_after_due and (a.created_at, a.id) > (p_after_created, p_after_id))))
                  or (p_after_due is null and t.due_on is null and (a.created_at, a.id) > (p_after_created, p_after_id)))
           order by t.due_on asc nulls last, a.created_at asc, a.id asc
           limit greatest(1, least(coalesce(p_limit, 20), 201))) x
$$;
revoke all on function app.approval_queue(integer, date, timestamptz, uuid) from public;
grant execute on function app.approval_queue(integer, date, timestamptz, uuid) to kaname_app;

-- 承認待ちの数（一覧と同じ条件・見出しの横と左のメニュー）
create or replace function app.approval_queue_count() returns integer
language sql stable security definer set search_path = public, app, pg_temp as $$
  select count(*)::integer
    from tickets t join approvals a on a.ticket_id = t.id
   where app.member_ok()
     and t.tenant_id = app.tenant_id() and a.tenant_id = app.tenant_id() and t.deleted_at is null
     and t.assignee_member_id = app.user_id() and a.kind = 'artifact'
     and a.decision is null and a.withdrawn_at is null and a.deleted_at is null
     and app.ticket_writable(t.id)
$$;
revoke all on function app.approval_queue_count() from public;
grant execute on function app.approval_queue_count() to kaname_app;

-- 承認の 1 件（読めるのは承認する人・マネージャー・作った人・任せた人）。読めない・成果物の承認でない（D-131.11）なら null
create or replace function app.approval_detail(p_approval uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare a approvals%rowtype; t tickets%rowtype; v_stage text; v_ver int; v_text text; v_open boolean; v_approver uuid; v_can boolean;
begin
  if not app.member_ok() or not app.approval_readable(p_approval) then return null; end if;
  select * into a from approvals where id = p_approval;
  if a.kind is distinct from 'artifact' then return null; end if;
  select * into t from tickets where id = a.ticket_id;
  select s.key into v_stage from ticket_stages s where s.id = t.stage_id;
  select s.version, s.body->>'text' into v_ver, v_text from ticket_sections s
   where s.ticket_id = t.id and s.section_key = 'artifacts' and s.deleted_at is null;
  v_open := a.decision is null and a.withdrawn_at is null;
  v_approver := case when v_open then t.assignee_member_id else a.approver_member_id end;
  -- 決められるのは、決まっていない承認の今の担当者で、今のメンバー（抜けた・止められた人でない）で、チケットに書ける人
  v_can := v_open and t.assignee_member_id = app.user_id()
           and exists (select 1 from members m where m.id = app.user_id() and m.tenant_id = app.tenant_id()
                         and m.deleted_at is null and m.suspended_at is null)
           and app.ticket_writable(t.id);
  return jsonb_build_object(
    'approval', jsonb_build_object('id', a.id, 'kind', a.kind, 'status_id', a.status_id, 'decision', a.decision,
                                   'decided_at', a.decided_at, 'irreversible', a.irreversible, 'note', a.note,
                                   'approver_member_id', v_approver,
                                   'approver_name', case when v_approver is not null then app.member_name(v_approver) end,
                                   'created_at', a.created_at),
    'ticket', jsonb_build_object('id', t.id, 'number', t.number, 'title', t.title, 'stage_key', v_stage),
    'artifact_version', jsonb_build_object('version', coalesce(v_ver, 0), 'text', coalesce(v_text, '')),
    'checks', '[]'::jsonb, 'check_summary', '検査なし（まだ流していません）',
    'cautions', case when a.irreversible then jsonb_build_array('取り消せません。承認すると、AI が外へ出します（送る・応募する など）')
                     else '[]'::jsonb end
                || case when a.note is not null then jsonb_build_array(a.note) else '[]'::jsonb end,
    'irreversible', a.irreversible, 'can_decide', coalesce(v_can, false), 'chain', '[]'::jsonb);
end $$;
revoke all on function app.approval_detail(uuid) from public;
grant execute on function app.approval_detail(uuid) to kaname_app;

insert into app.schema_migrations (name) values ('0095_approve_queue.sql') on conflict do nothing;
