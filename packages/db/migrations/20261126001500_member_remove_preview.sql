-- 20261126001500 外す前の下見（K-815・契約の口 previewMemberRemoval・D-128.96・D-150.21・D-154.6・D-154.15・D-154.19・D-154.26・D-154.37）
--   新しい表・列は作らない。関数を 1 つ足す（読むだけ・書かない・証跡も受け箱も増やさない）。
--
-- app.member_remove_preview(p_member)：メンバーの 1 人の画面の「外す」を開いたときに、外すと何が起きるかを返す。
--   ① 直す権限（app.admin_can('members','edit')・K-800）が無ければ {"error":"forbidden"}
--   ② 相手（app.admin_target・K-800）が null（外した・消した・別の会社・招待中・AI・無い id）なら {"error":"member_gone"}
--   ③ {"ok": true, "data": { member, blocked_by, tickets, handovers_cancelled, approvals_reassigned, sole_approver, deleted, kept, restorable_until }}
--      blocked_by：自分なら 'self'・最後の管理者（app.admin_is_last_admin・止めた管理者は数えない）なら 'last_admin'・ほかは null。
--        外せない人も断らず 200 で理由を返す（画面が理由を出して主ボタンを押せなくする・断る 409 は外す口 K-848）
--      tickets：担当が外す人で、完了していない・消していないチケット（下書きも数える・K-810 の assigned と同じ）。番号順。
--        stage は会社ごとの段の名前・handing は待っている渡しが付いているか
--      handovers_cancelled：待っている渡しのうち、外す人が渡した側（from）か受ける側（to）の物（グループ宛て・申し出も含む）
--      approvals_reassigned：外す人が担当するチケットの、まだ決まっていない承認（承認は担当者に従う・D-150.21）
--      sole_approver：外す人がマネージャーで、そのグループのマネージャーが外す人 1 人だけのグループ（兼務は層ごとに出る・D-154.15）
--      deleted：すぐ消える物の数（K-849 の消す条件と同じ）。順は memories・conversations・credentials・pc・invitations
--      kept：messages・decisions・artifacts・group_memories（数は持たない）。restorable_until：呼んだ時刻の 30 日後（D-154.26）
--   security definer・search_path に pg_temp・public から外して kaname_app に渡す。

create or replace function app.member_remove_preview(p_member uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_target jsonb;
  v_blocked text;
  v_tickets jsonb;
  v_handovers jsonb;
  v_approvals jsonb;
  v_sole jsonb;
  v_deleted jsonb;
begin
  if v_tenant is null or not coalesce(app.admin_can('members', 'edit'), false) then
    return jsonb_build_object('error', 'forbidden');
  end if;
  v_target := app.admin_target(p_member);
  if v_target is null then
    return jsonb_build_object('error', 'member_gone');
  end if;
  v_blocked := case when coalesce((v_target->>'is_self')::boolean, false) then 'self'
                    when coalesce(app.admin_is_last_admin(p_member), false) then 'last_admin' end;

  -- 担当しているチケット（番号順＝頭の字・数の順）
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.id, 'number', t.number, 'title', t.title, 'stage', st.name,
           'handing', exists (select 1 from ticket_handovers h
                               where h.ticket_id = t.id and h.tenant_id = v_tenant
                                 and h.state = 'waiting' and h.deleted_at is null))
           order by regexp_replace(t.number, '[0-9]+$', ''),
                    nullif(substring(t.number from '([0-9]+)$'), '')::bigint nulls last, t.number, t.id), '[]'::jsonb)
    into v_tickets
    from tickets t
    left join ticket_stages st on st.id = t.stage_id
   where t.tenant_id = v_tenant and t.assignee_member_id = p_member
     and t.completed_at is null and t.deleted_at is null;

  -- 外すと取り消される渡し（待っている物で、外す人が渡した側か受ける側）
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', h.id, 'ticket_id', h.ticket_id, 'number', t.number,
           'side', case when h.from_member_id = p_member then 'from' else 'to' end)
           order by h.created_at, h.id), '[]'::jsonb)
    into v_handovers
    from ticket_handovers h
    join tickets t on t.id = h.ticket_id
   where h.tenant_id = v_tenant and h.state = 'waiting' and h.deleted_at is null
     and (h.from_member_id = p_member or h.to_member_id = p_member);

  -- 承認する人が替わる承認（外す人が担当するチケットの、まだ決まっていない承認）
  select coalesce(jsonb_agg(jsonb_build_object('ticket_id', a.ticket_id, 'number', t.number)
           order by t.number, a.created_at, a.id), '[]'::jsonb)
    into v_approvals
    from approvals a
    join tickets t on t.id = a.ticket_id
   where a.tenant_id = v_tenant and t.assignee_member_id = p_member
     and t.completed_at is null and t.deleted_at is null
     and a.decision is null and a.withdrawn_at is null and a.deleted_at is null;

  -- マネージャーが外す人 1 人だけのグループ
  select coalesce(jsonb_agg(jsonb_build_object('scope_id', s.id, 'name', s.name)
           order by s.created_at, s.id), '[]'::jsonb)
    into v_sole
    from scope_memberships sm
    join scopes s on s.id = sm.scope_id and s.deleted_at is null
   where sm.tenant_id = v_tenant and sm.member_id = p_member and sm.role = 'manager' and sm.deleted_at is null
     and not exists (
       select 1
         from scope_memberships o
         join members m on m.id = o.member_id and m.deleted_at is null and m.kind_id = 'human'
         left join tenant_memberships tm on tm.tenant_id = m.tenant_id and tm.member_id = m.id
        where o.tenant_id = v_tenant and o.scope_id = sm.scope_id and o.role = 'manager'
          and o.deleted_at is null and o.member_id <> p_member
          and (tm.id is null or (tm.status in ('active', 'suspended') and tm.deleted_at is null)));

  -- すぐ消える物の数（K-849 の消す条件と同じ）
  v_deleted := jsonb_build_array(
    jsonb_build_object('key', 'memories', 'count',
      (select count(*) from memories x
        where x.tenant_id = v_tenant and x.owner_member_id = p_member and x.visibility = 'self' and x.deleted_at is null)),
    jsonb_build_object('key', 'conversations', 'count',
      (select count(*) from conversations x
        where x.tenant_id = v_tenant and x.deleted_at is null and x.participant_member_ids = array[p_member])),
    jsonb_build_object('key', 'credentials', 'count',
      (select count(*) from credentials x
        where x.tenant_id = v_tenant and x.owner_member_id = p_member and x.revoked_at is null and x.deleted_at is null)),
    jsonb_build_object('key', 'pc', 'count',
      (select count(*) from sessions x
        where x.tenant_id = v_tenant and x.member_id = p_member and x.kind_id = 'bridge'
          and x.revoked_at is null and x.deleted_at is null)),
    jsonb_build_object('key', 'invitations', 'count',
      (select count(*) from invitations x
        where x.tenant_id = v_tenant and x.created_by = p_member and x.accepted_member_id is null
          and x.revoked_at is null and x.deleted_at is null)));

  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'member', jsonb_build_object('id', p_member, 'name', v_target->>'name'),
    'blocked_by', v_blocked,
    'tickets', v_tickets,
    'handovers_cancelled', v_handovers,
    'approvals_reassigned', v_approvals,
    'sole_approver', v_sole,
    'deleted', v_deleted,
    'kept', jsonb_build_array(jsonb_build_object('key', 'messages'), jsonb_build_object('key', 'decisions'),
                              jsonb_build_object('key', 'artifacts'), jsonb_build_object('key', 'group_memories')),
    'restorable_until', now() + interval '30 days'));
end $$;
revoke all on function app.member_remove_preview(uuid) from public;
grant execute on function app.member_remove_preview(uuid) to kaname_app;
