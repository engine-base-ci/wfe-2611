-- 20261127102700 ゲストのグループの名前を直す・消す（K-927・契約の口 updateGuestGroup・deleteGuestGroup・D-155.46・D-155.51・D-128.97・関門 C2）
--   ① 失効の理由 guest_group_deleted
--   ② app.guest_group_rename(グループ, 名前)：メンバーを直す権限（members の edit）の人だけ。無い・消した・別の会社は 42501・hint E-GST-001、
--      同じ名前（表記ゆらぎを含む・一意の索引が最後の砦）は 22023・hint E-GST-002。証跡 guest_group.renamed（payload は guest_group_id だけ）
--   ③ app.guest_group_delete(グループ)：1 つの取引で、見せる相手を外す（K-881 の app.ticket_guest_shares_drop_group）→ 中のゲストを会社から抜けた扱い
--      （members.deleted_at・所属 left・セッションを全部切る・所属の行に deleted_at）→ 受けていない招待を取り消す → グループに deleted_at → 証跡 guest_group.deleted
--      （payload は guest_group_id・guest_count・share_count だけ）。チケット・依頼・やり取りは残す。メール・お知らせは送らない
--
-- どれも security definer・search_path に pg_temp・public から外し kaname_app にだけ渡す

insert into revoke_reasons (key, label) values ('guest_group_deleted', 'ゲストのグループを消した') on conflict do nothing;

-- 権限とグループの確かめ（中の道具・渡さない）。グループの行を for update で取る（同時に消す 2 本は 1 本ずつになる）
create or replace function app.guest_group_lock_for_edit(p_group uuid) returns guest_groups
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_user uuid := app.user_id();
  g guest_groups%rowtype;
begin
  if v_tenant is null or v_user is null or not has_permission(v_user, 'members', null, 'edit') then
    raise exception 'メンバーを直す権限が無い' using errcode = 'insufficient_privilege';
  end if;
  select * into g from guest_groups x
   where x.id = p_group and x.tenant_id = v_tenant and x.deleted_at is null
   for update;
  if g.id is null then
    raise exception 'このゲストのグループは無い' using errcode = 'insufficient_privilege', hint = 'E-GST-001';
  end if;
  return g;
end $$;
revoke all on function app.guest_group_lock_for_edit(uuid) from public;

-- ② 名前を直す（中のゲストと届け先はそのまま）
create or replace function app.guest_group_rename(p_group uuid, p_name text) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_user uuid := app.user_id();
  v_name text := btrim(coalesce(p_name, ''), E' \t\r\n　');
  g guest_groups%rowtype;
begin
  g := app.guest_group_lock_for_edit(p_group);
  if char_length(v_name) not between 1 and 80 then
    raise exception 'ゲストのグループの名前は 1〜80 字' using errcode = '22023';
  end if;
  begin
    update guest_groups set name = v_name, updated_by = v_user where id = g.id;
  exception when unique_violation then
    raise exception '同じ名前のゲストのグループがある' using errcode = '22023', hint = 'E-GST-002';
  end;
  perform app.record_audit('guest_group.renamed', 'guest_group', g.id::text, 'C2', jsonb_build_object('guest_group_id', g.id));
  return jsonb_build_object('id', g.id, 'name', v_name);
end $$;
revoke all on function app.guest_group_rename(uuid, text) from public;
grant execute on function app.guest_group_rename(uuid, text) to kaname_app;

-- ③ 消す（1 つの取引。どれかが落ちたら全部戻る）
create or replace function app.guest_group_delete(p_group uuid) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_user uuid := app.user_id();
  g guest_groups%rowtype;
  v_guests uuid[];
  v_shares int;
  m uuid;
begin
  g := app.guest_group_lock_for_edit(p_group);
  -- ① 見せる相手を外す（証跡は K-881 の関数が書く）
  v_shares := app.ticket_guest_shares_drop_group(g.id);
  -- ② 中のゲストを会社から抜けた扱いにする（人ごとの文を増やさない。セッションの失効だけは人ごと）
  select coalesce(array_agg(gm.member_id), '{}') into v_guests
    from guest_group_members gm
   where gm.tenant_id = v_tenant and gm.guest_group_id = g.id and gm.deleted_at is null;
  update members set deleted_at = now(), updated_by = v_user
   where id = any(v_guests) and tenant_id = v_tenant and deleted_at is null;
  update tenant_memberships set status = 'left', updated_by = v_user
   where tenant_id = v_tenant and member_id = any(v_guests) and deleted_at is null and status <> 'left';
  foreach m in array v_guests loop
    perform app.revoke_all_sessions(m, 'guest_group_deleted');
  end loop;
  update guest_group_members set deleted_at = now(), updated_by = v_user
   where tenant_id = v_tenant and guest_group_id = g.id and deleted_at is null;
  -- ③ 受けていない・取り消していない招待を取り消す
  update invitations set revoked_at = now()
   where tenant_id = v_tenant and guest_group_id = g.id and accepted_member_id is null and revoked_at is null;
  -- ④ グループ（行は消さず deleted_at だけ。社内の読みで名前は今までどおり出る）
  update guest_groups set deleted_at = now(), updated_by = v_user where id = g.id;
  -- ⑤ 証跡（名前もメールも載せない）
  perform app.record_audit('guest_group.deleted', 'guest_group', g.id::text, 'C2',
    jsonb_build_object('guest_group_id', g.id, 'guest_count', coalesce(array_length(v_guests, 1), 0), 'share_count', v_shares));
  return jsonb_build_object('id', g.id);
end $$;
revoke all on function app.guest_group_delete(uuid) from public;
grant execute on function app.guest_group_delete(uuid) to kaname_app;
