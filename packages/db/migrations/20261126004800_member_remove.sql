-- K-848 外す口の前半分（app.member_remove）：管理者が選んだ引き継ぎ先にその場で担当を移し（受ける側の「受ける」は待たない・D-154.6）、
--   外す人が絡む待っている渡しを取り消し（相手の受け箱に handover.withdrawn・D-154.78）、引き継ぎ先に受け箱の行（member.tickets_received）を残し、
--   後ろ半分（すぐ消える物・セッションと PC・外した印・30 日の戻りの元）は K-849 の app.member_erase に任せ、証跡 member.remove を残す。全部を 1 つの取引で。
--   language plpgsql：この migration は K-849 の app.member_erase（20261126004900）より先に流れるので、呼ぶときに名前を解く形にする。
--   頭の順は K-800 の約束：admin_lock → admin_can → admin_target（null は member_gone）→ 自分（self_stop）→ 最後の管理者（last_admin）→ 引き継ぎ先 → 書く。
--   断る答え：K-800 の言葉（forbidden・member_gone・self_stop・last_admin）と、この葉の番号つきの 4 つ（E-MEM-020〜023）。replyOf が code・status・detail を通す
create or replace function app.member_remove(p_member uuid, p_to uuid, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_me uuid := app.user_id();
  v_target jsonb;
  v_assigned uuid[];
  v_pairs jsonb := '[]'::jsonb;  -- [{ticket, heir}]（チケット 1 件ごとの引き継ぎ先）
  v_heirs uuid[] := '{}';
  v_heir uuid;
  v_h jsonb;
  v_n int;
  v_moved int := 0;
  v_cancelled int := 0;
  v_erase jsonb;
  h ticket_handovers%rowtype;
  r record;
begin
  perform app.admin_lock();
  if not app.admin_can('members', 'edit') then
    return jsonb_build_object('error', 'forbidden');
  end if;
  v_target := app.admin_target(p_member);
  if v_target is null then
    return jsonb_build_object('error', 'member_gone');
  end if;
  if coalesce((v_target ->> 'is_self')::boolean, false) then
    return jsonb_build_object('error', 'self_stop');
  end if;
  if app.admin_is_last_admin(p_member) then
    return jsonb_build_object('error', 'last_admin');
  end if;

  -- 外す人の担当（完了も削除もしていない・下書きも含む）
  select coalesce(array_agg(t.id order by t.id), '{}') into v_assigned
    from tickets t
   where t.tenant_id = app.tenant_id() and t.assignee_member_id = p_member
     and t.completed_at is null and t.deleted_at is null;

  -- チケットごとの引き継ぎ先を決める（1 件ずつが勝つ）。担当の全部をちょうど 1 回ずつ指していなければ heir_missing
  if p_items is not null and jsonb_typeof(p_items) = 'array' and jsonb_array_length(p_items) > 0 then
    select coalesce(jsonb_agg(jsonb_build_object('ticket', (x ->> 'ticket_id')::uuid, 'heir', (x ->> 'to_member_id')::uuid)), '[]')
      into v_pairs from jsonb_array_elements(p_items) x;
    if jsonb_array_length(v_pairs) <> coalesce(array_length(v_assigned, 1), 0)
       or (select count(distinct (e ->> 'ticket')) from jsonb_array_elements(v_pairs) e) <> jsonb_array_length(v_pairs)
       or exists (select 1 from jsonb_array_elements(v_pairs) e where not ((e ->> 'ticket')::uuid = any (v_assigned))) then
      return jsonb_build_object('error', 'heir_missing', 'code', 'E-MEM-020', 'status', 409);
    end if;
  elsif coalesce(array_length(v_assigned, 1), 0) > 0 then
    if p_to is null then
      return jsonb_build_object('error', 'heir_missing', 'code', 'E-MEM-020', 'status', 409);
    end if;
    select jsonb_agg(jsonb_build_object('ticket', x, 'heir', p_to)) into v_pairs from unnest(v_assigned) x;
  end if;

  -- 引き継ぎ先の確かめ（1 人でもだめなら全部断る）。担当 0 件でも、付けた引き継ぎ先は確かめる
  select coalesce(array_agg(distinct (e ->> 'heir')::uuid), '{}') into v_heirs from jsonb_array_elements(v_pairs) e;
  if p_to is not null and not (p_to = any (v_heirs)) and jsonb_array_length(v_pairs) = 0 then
    v_heirs := array[p_to];
  end if;
  foreach v_heir in array v_heirs loop
    v_h := app.admin_target(v_heir);
    if v_h is null then
      return jsonb_build_object('error', 'heir_gone', 'code', 'E-MEM-021', 'status', 404);
    end if;
    if v_heir = p_member then
      return jsonb_build_object('error', 'heir_state', 'code', 'E-MEM-022', 'status', 409,
        'detail', jsonb_build_object('名前', v_h ->> 'name', '訳', '外す本人です'));
    end if;
    if v_h ->> 'state' = 'suspended' then
      return jsonb_build_object('error', 'heir_state', 'code', 'E-MEM-022', 'status', 409,
        'detail', jsonb_build_object('名前', v_h ->> 'name', '訳', '止まっています'));
    end if;
    if v_h ->> 'role' in ('viewer', 'requester') then
      return jsonb_build_object('error', 'heir_viewer', 'code', 'E-MEM-023', 'status', 409,
        'detail', jsonb_build_object('名前', v_h ->> 'name'));
    end if;
  end loop;

  -- 外す人が渡した側か受ける側の、待っている渡しを取り消し、相手の受け箱に 1 行ずつ（決まった渡しは触らない）
  for h in
    select * from ticket_handovers x
     where x.tenant_id = app.tenant_id() and x.state = 'waiting' and x.deleted_at is null
       and (x.from_member_id = p_member or x.to_member_id = p_member)
     order by x.created_at, x.id
     for update
  loop
    for r in
      select m.id as member_id from members m
       where m.tenant_id = h.tenant_id and m.id <> p_member and m.deleted_at is null and m.kind_id = 'human'
         and (
           (h.from_member_id <> p_member and m.id = h.from_member_id)
           or (h.from_member_id = p_member and m.id = h.to_member_id)
           or (h.from_member_id = p_member and h.to_member_id is null and h.to_scope_id is not null
               and exists (select 1 from scope_memberships sm
                            where sm.tenant_id = m.tenant_id and sm.member_id = m.id and sm.role = 'manager'
                              and sm.deleted_at is null and sm.scope_id = h.to_scope_id))
         )
    loop
      insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, dedupe_key, created_by)
      select h.tenant_id, r.member_id, 'inapp', 'handover.withdrawn',
             jsonb_build_object('handover_id', h.id, 'ticket_id', t.id, 'number', t.number, 'title', t.title, 'cause', 'member_removed'),
             'handover_withdrawn:' || h.id, v_me
        from tickets t where t.id = h.ticket_id;
    end loop;
    update ticket_handovers set state = 'withdrawn', decided_at = now() where id = h.id;
    v_cancelled := v_cancelled + 1;
  end loop;

  -- 担当を引き継ぎ先に（分身に任せた印は下ろす・承認は今の担当者が受け持つので approvals は書かない・D-150.21）
  update tickets t
     set assignee_member_id = (e ->> 'heir')::uuid, delegated_to_clone = false, updated_by = v_me
    from jsonb_array_elements(v_pairs) e
   where t.id = (e ->> 'ticket')::uuid and t.tenant_id = app.tenant_id() and t.assignee_member_id = p_member;
  get diagnostics v_moved = row_count;

  -- 引き継ぎ先ごとの受け箱（外した本人には出さない・メールは出さない）
  foreach v_heir in array v_heirs loop
    select count(*) into v_n from jsonb_array_elements(v_pairs) e where (e ->> 'heir')::uuid = v_heir;
    continue when v_n = 0;
    insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, dedupe_key, created_by)
    values (app.tenant_id(), v_heir, 'inapp', 'member.tickets_received',
            jsonb_build_object('from_member_id', p_member, 'from_name', v_target ->> 'name', 'count', v_n,
              'numbers', (select coalesce(jsonb_agg(t.number order by t.number), '[]') from tickets t
                           join jsonb_array_elements(v_pairs) e on t.id = (e ->> 'ticket')::uuid
                          where (e ->> 'heir')::uuid = v_heir)),
            'member_tickets_received:' || p_member || ':' || v_heir, v_me);
  end loop;

  -- 後ろ半分（K-849）：すぐ消える物・セッションと PC・外した印・30 日の戻りの元
  v_erase := app.member_erase(p_member, v_me);
  if v_erase ? 'error' then
    raise exception 'member_erase: %', v_erase ->> 'error';
  end if;

  perform app.record_audit('member.remove', 'members', p_member::text, 'C2',
    jsonb_build_object('tickets_moved', v_moved, 'handovers_cancelled', v_cancelled, 'heirs', to_jsonb(v_heirs)));

  return jsonb_build_object('ok', true, 'member_id', p_member, 'tickets_moved', v_moved,
    'handovers_cancelled', v_cancelled, 'restorable_until', v_erase ->> 'restorable_until');
end $$;

revoke all on function app.member_remove(uuid, uuid, jsonb) from public;
grant execute on function app.member_remove(uuid, uuid, jsonb) to kaname_app;
