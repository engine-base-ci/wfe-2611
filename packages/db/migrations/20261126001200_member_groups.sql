-- 20261126001200 グループを移す・兼ねる（K-812・契約の口 updateMemberGroups・D-125.115・D-128.97・D-154.15・D-154.18・D-154.19・D-154.21・D-154.25）
--   新しい表・列は作らない。書く関数を 1 つ足す（関門 C2）。共通の関数（app.admin_lock・app.admin_can・app.admin_target）は K-800、
--   答えの groups を組む app.member_groups_json は K-810 が持つ。
--
-- app.member_groups_change(p_member, p)：1 つの取引の中で、相手の所属（scope_memberships）と主の所属（members.scope_id）を変える。
--   入力 { primary_scope_id?, add_scope_ids?, remove_scope_ids?, role_key? }（role_key は新しく足す・生き返らせる所属の役割。既定 member）。
--   順（K-800 の決め：錠が先）：① 錠 ② 権限（members の edit）③ 相手 ④ 自分 ⑤ 体の全部のグループが同じ会社の消していないグループか
--     ⑥ 外す（先に全部確かめてから書く：居ない → not_in_group・主を移さずに外す → primary_remove）⑦ 移す ⑧ 足す ⑨ 証跡 ⑩ 答え。
--   断りは何も書かずに返す（全部か無しか）。変わらない指定は何も書かない（証跡も無い・引き金も走らない＝セッションも切れない）。
--   主の行はいつもちょうど 1 つ（部分一意の索引 scope_memberships_primary_uq・0075）：前の主を下ろしてから新しい主を立てる。
--   移すときは members.scope_id を先に直す：役割の束の引き金（0080）は members.scope_id も読むので、最後の所属の行の書き込みの時点で主が新しくなっているようにする。
--   外した行（deleted_at）は消さずに残し、同じ人・同じグループにまた入れるときは生き返らせる（unique (member_id, scope_id)・行を重ねない）。
--   セッションは関数では切らない：所属の行が変わると役割の束の引き金（0080）が権限の行を作り直し、権限の引き金（0004）が相手の全セッションを切る。
--   答え：{ ok: true, result: { member_id, company_role, groups } } か { error: forbidden | member_gone | self_group | scope_gone | not_in_group | primary_remove }

create or replace function app.member_groups_change(p_member uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_me uuid := app.user_id();
  v_tenant uuid := app.tenant_id();
  v_role text;
  v_primary uuid;
  v_add uuid[] := '{}';
  v_remove uuid[] := '{}';
  v_all uuid[];
  v_target jsonb;
  v_from uuid;
  v_to uuid;
  v_moving boolean;
  v_added uuid[] := '{}';
  v_removed uuid[] := '{}';
  v_changed boolean := false;
  v_id uuid;
  v_row scope_memberships%rowtype;
begin
  -- 入口が形を確かめ済み。関数の頭でも決まった値の外は断る（直に呼ばれたとき）
  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'グループの変更の入力が形に合わない' using errcode = '22023';
  end if;
  v_role := coalesce(nullif(p->>'role_key', ''), 'member');
  if v_role not in ('manager', 'member', 'viewer') then
    raise exception 'role_key は manager・member・viewer のどれか' using errcode = '22023';
  end if;
  if (p ? 'add_scope_ids' and jsonb_typeof(p->'add_scope_ids') <> 'array')
     or (p ? 'remove_scope_ids' and jsonb_typeof(p->'remove_scope_ids') <> 'array') then
    raise exception 'グループの並びが配列でない' using errcode = '22023';
  end if;
  if coalesce(jsonb_array_length(p->'add_scope_ids'), 0) > 20 or coalesce(jsonb_array_length(p->'remove_scope_ids'), 0) > 20 then
    raise exception 'グループの並びは 20 まで' using errcode = '22023';
  end if;
  v_primary := nullif(p->>'primary_scope_id', '')::uuid;
  -- 並びは重なりを落とし、入れた順を守る
  v_add := coalesce(array(
    select x from (select e::uuid as x, min(o) as o from jsonb_array_elements_text(coalesce(p->'add_scope_ids', '[]')) with ordinality t(e, o) group by 1) s order by o
  ), '{}');
  v_remove := coalesce(array(
    select x from (select e::uuid as x, min(o) as o from jsonb_array_elements_text(coalesce(p->'remove_scope_ids', '[]')) with ordinality t(e, o) group by 1) s order by o
  ), '{}');

  -- ① 錠（同じ会社の書き込みを順に通す・D-154.21）② 権限（入口と 2 層）
  perform app.admin_lock();
  if not app.admin_can('members', 'edit') then return jsonb_build_object('error', 'forbidden'); end if;
  -- ③ 相手 ④ 自分
  v_target := app.admin_target(p_member);
  if v_target is null then return jsonb_build_object('error', 'member_gone'); end if;
  if coalesce((v_target->>'is_self')::boolean, false) then return jsonb_build_object('error', 'self_group'); end if;
  -- ⑤ 体の全部のグループが同じ会社の消していないグループ（1 つでも無ければ何も変えない）
  v_all := array(select distinct x from unnest(v_add || v_remove || case when v_primary is null then '{}'::uuid[] else array[v_primary] end) x);
  if (select count(*) from scopes s where s.id = any(v_all) and s.tenant_id = v_tenant and s.deleted_at is null) <> coalesce(array_length(v_all, 1), 0) then
    return jsonb_build_object('error', 'scope_gone');
  end if;

  select m.scope_id into v_from from members m where m.id = p_member;
  v_moving := v_primary is not null and v_primary is distinct from v_from;
  v_to := case when v_moving then v_primary else v_from end;

  -- ⑥ 外す：書く前に全部を確かめる（主の所属は、このあと移さない限り外せない・居ないグループは外せない）
  foreach v_id in array v_remove loop
    if v_id = v_from and not v_moving then return jsonb_build_object('error', 'primary_remove'); end if;
    if not exists (select 1 from scope_memberships sm where sm.member_id = p_member and sm.scope_id = v_id and sm.deleted_at is null) then
      return jsonb_build_object('error', 'not_in_group');
    end if;
  end loop;
  foreach v_id in array v_remove loop
    update scope_memberships set deleted_at = now(), is_primary = false, changed_by = v_me, updated_at = now(), updated_by = v_me
      where member_id = p_member and scope_id = v_id and deleted_at is null;
    v_removed := v_removed || v_id;
    v_changed := true;
  end loop;

  -- ⑦ 移す：主を先に直し（引き金が新しい主を読む）、前の主の行を下ろしてから新しい主の行を立てる（主の行はちょうど 1 つ）
  if v_moving then
    update members set scope_id = v_primary, updated_at = now(), updated_by = v_me where id = p_member;
    select * into v_row from scope_memberships sm where sm.member_id = p_member and sm.scope_id = v_from and sm.deleted_at is null;
    if found then
      if v_from = any(v_add) then
        update scope_memberships set is_primary = false, changed_by = v_me, updated_at = now(), updated_by = v_me where id = v_row.id;
      else
        update scope_memberships set deleted_at = now(), is_primary = false, changed_by = v_me, updated_at = now(), updated_by = v_me where id = v_row.id;
        v_removed := v_removed || v_from;
      end if;
    end if;
    select * into v_row from scope_memberships sm where sm.member_id = p_member and sm.scope_id = v_primary;
    if not found then
      insert into scope_memberships (tenant_id, member_id, scope_id, is_primary, role, changed_by, created_by, updated_by)
        values (v_tenant, p_member, v_primary, true, v_role, v_me, v_me, v_me);
      v_added := v_added || v_primary;
    elsif v_row.deleted_at is not null then
      update scope_memberships set deleted_at = null, is_primary = true, role = v_role, since = current_date, changed_by = v_me, updated_at = now(), updated_by = v_me
        where id = v_row.id;
      v_added := v_added || v_primary;
    else
      -- 兼ねていたグループを主にする：役割は保つ
      update scope_memberships set is_primary = true, changed_by = v_me, updated_at = now(), updated_by = v_me where id = v_row.id;
    end if;
    v_changed := true;
  end if;

  -- ⑧ 足す：主のグループと、もう居るグループは何もしない。外した行は生き返らせる
  foreach v_id in array v_add loop
    continue when v_id = v_to;
    select * into v_row from scope_memberships sm where sm.member_id = p_member and sm.scope_id = v_id;
    if not found then
      insert into scope_memberships (tenant_id, member_id, scope_id, is_primary, role, changed_by, created_by, updated_by)
        values (v_tenant, p_member, v_id, false, v_role, v_me, v_me, v_me);
    elsif v_row.deleted_at is not null then
      update scope_memberships set deleted_at = null, is_primary = false, role = v_role, since = current_date, changed_by = v_me, updated_at = now(), updated_by = v_me
        where id = v_row.id;
    else
      continue;
    end if;
    v_added := v_added || v_id;
    v_changed := true;
  end loop;

  -- ⑨ 証跡（変わったときだけ・追記だけ・id だけ・D-154.25）
  if v_changed then
    perform app.record_audit('member.groups_change', 'members', p_member::text, 'C2', jsonb_build_object(
      'from_primary', v_from, 'to_primary', v_to,
      'added', to_jsonb(v_added),
      'removed', to_jsonb(array(select x from unnest(v_removed) x where not (x = any(v_added))))));
  end if;

  -- ⑩ 答え（K-811 と同じ形：member_id・company_role・groups）
  return jsonb_build_object('ok', true, 'result', jsonb_build_object(
    'member_id', p_member,
    'company_role', app.admin_target(p_member)->>'role',
    'groups', app.member_groups_json(p_member)));
end $$;
revoke all on function app.member_groups_change(uuid, jsonb) from public;
grant execute on function app.member_groups_change(uuid, jsonb) to kaname_app;
