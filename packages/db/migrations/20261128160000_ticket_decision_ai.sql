-- K-571：決定の決めた人に AI を持てる形（代表の答え answer=538b4df12feb「決定ログには AI が決めたことも『AI が決めた』と残す」・PM の決め 2026-11-28 (c)）。
--   人が決めた行は今のまま（decided_by）。AI が決めた行は decided_by_ai_of＝「誰の AI（〈名〉のAI）が決めたか」を持つ。両方は同時に持たない。
--   AI が決定を書く道（PC の仕事の終わり・AI の道具）は別の葉で作る。ここは列と読む形だけ。
--   読む形 app.ticket_decision_json に decided_by_ai { member_id, display_name（その人の名前・画面が「〈呼び名〉のAI」と出す） } | null を足す（ほかの鍵は 20261120130700 のまま）
alter table ticket_decisions add column if not exists decided_by_ai_of uuid references members(id);
alter table ticket_decisions drop constraint if exists ticket_decisions_decider_one_ck;
alter table ticket_decisions add constraint ticket_decisions_decider_one_ck
  check (decided_by is null or decided_by_ai_of is null) not valid;
alter table ticket_decisions validate constraint ticket_decisions_decider_one_ck;

create or replace function app.ticket_decision_json(p_id uuid) returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  select jsonb_build_object(
    'id', d.id,
    'ticket_id', d.ticket_id,
    'text', d.text,
    'reason', d.reason,
    'decided_by', case when d.decided_by is null then null else jsonb_build_object(
        'id', d.decided_by,
        'display_name', (select nullif(btrim(m.display_name), '') from members m where m.id = d.decided_by and m.tenant_id = d.tenant_id)) end,
    'decided_by_ai', case when d.decided_by_ai_of is null then null else jsonb_build_object(
        'member_id', d.decided_by_ai_of,
        'display_name', (select nullif(btrim(m.display_name), '') from members m where m.id = d.decided_by_ai_of and m.tenant_id = d.tenant_id)) end,
    'decided_note', d.decided_note,
    'decided_at', d.decided_at,
    'source', case when d.source_message_id is null then null else
        (select jsonb_build_object('id', s.id, 'at', s.created_at, 'deleted', s.deleted_at is not null)
           from ticket_messages s where s.id = d.source_message_id and s.tenant_id = d.tenant_id) end,
    'revises_id', (select r.id from ticket_decisions r
                    where r.superseded_by_id = d.id and r.tenant_id = d.tenant_id and r.deleted_at is null
                    order by r.decided_at, r.id limit 1),
    'superseded_by_id', d.superseded_by_id,
    'cancelled', case when d.cancelled_at is null then null else jsonb_build_object(
        'at', d.cancelled_at,
        'by', case when d.cancelled_by is null then null else jsonb_build_object(
            'id', d.cancelled_by,
            'display_name', (select nullif(btrim(m.display_name), '') from members m where m.id = d.cancelled_by and m.tenant_id = d.tenant_id)) end,
        'reason', d.cancel_reason) end,
    'promoted_to', d.promoted_to)
  from ticket_decisions d where d.id = p_id and d.tenant_id = app.tenant_id() and d.deleted_at is null
$$;

revoke all on function app.ticket_decision_json(uuid) from public;
