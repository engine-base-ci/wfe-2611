-- 20261126001100_member_role 役割を変える口（K-811・契約の口 updateMemberRole・関門 C2・D-125.115・D-125.117・D-125.140・D-128.97・D-154.9・D-154.15・D-154.18・D-154.19・D-154.21・D-154.25・D-154.27・D-154.29）
--   足すのは関数 1 本（app.member_role_change）だけ。新しい表・列・引き金は作らない。
--   役割は 2 つの所に持つ：会社の役割（tenant_memberships.role）と、グループごとの役割（scope_memberships.role・兼務はグループごとに別・D-154.15）。
--   会社の役割が変わるのは admin ⇔ それ以外のときだけ。グループの役割だけを変えるときは会社の役割を触らない。
--   セッションは口で切らない：役割の束の引き金（0080）が権限の行を作り直し、権限の引き金（0004）がその人の全セッションを切る（同じ取引・G-14・D-125.140）。
--   だから同じ値への書き直しはしない（何も変わらない回は書かず、証跡も増やさず、セッションも切れない）。
--   断りは答えの言葉（forbidden・member_gone・self_role・last_admin・scope_gone・not_in_group）で返す。言葉を返す前には何も書かない（書いてから断ると取引に残る）。
--   security definer・search_path に pg_temp・public から外し、kaname_app に渡す（D-128.171）。共通の関数（admin_lock・admin_can・admin_target・admin_is_last_admin）は K-800、
--   答えの groups は K-810 の app.member_groups_json（getMember と同じ形）。

create or replace function app.member_role_change(p_member uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_key text := p->>'role_key';
  v_me uuid := app.user_id();
  v_tenant uuid := app.tenant_id();
  t jsonb;
  v_role text;          -- 今の会社の役割（admin_target の role）
  v_scope uuid;         -- 役割を付けるグループ（admin のときは null）
  v_seat scope_memberships%rowtype;
  v_from text;
  v_changed boolean := false;
begin
  if v_key is null or v_key not in ('manager', 'member', 'viewer', 'admin') then
    raise exception 'role_key が決まった 4 つの外' using errcode = '22023';
  end if;
  -- ① 会社ごとの錠（同時に互いを下げても順に通す・D-154.21）② 錠の後に権限（2 本目は権限を失っていれば forbidden）
  perform app.admin_lock();
  if not app.admin_can('members', 'edit') then return jsonb_build_object('error', 'forbidden'); end if;
  -- ③ 相手（人・同じ会社・消していない・外していない）④ 自分の役割は自分で変えられない（D-154.19）
  t := app.admin_target(p_member);
  if t is null then return jsonb_build_object('error', 'member_gone'); end if;
  if coalesce((t->>'is_self')::boolean, false) then return jsonb_build_object('error', 'self_role'); end if;
  v_role := t->>'role';

  if v_key = 'admin' then
    -- ⑤ 会社全体の管理者にする（scope_id は見ない・グループの所属の行は変えない）。もう管理者なら何もしない
    if v_role is distinct from 'admin' then
      insert into tenant_memberships (tenant_id, member_id, role, status, joined_at, created_by, updated_by)
      values (v_tenant, p_member, 'admin', 'active', now(), v_me, v_me)
      on conflict (tenant_id, member_id) do update set role = 'admin', updated_at = now(), updated_by = v_me;
      perform app.record_audit('member.role_change', 'members', p_member::text, 'C2',
                               jsonb_build_object('scope_id', null, 'from', v_role, 'to', 'admin'));
    end if;
  else
    -- ⑥ グループの役割：scope_id か、無ければ相手の主の所属
    v_scope := coalesce(nullif(p->>'scope_id', '')::uuid, (t->>'primary_scope')::uuid);
    if v_scope is null or not exists (
      select 1 from scopes s where s.id = v_scope and s.tenant_id = v_tenant and s.deleted_at is null
    ) then
      return jsonb_build_object('error', 'scope_gone');
    end if;
    select * into v_seat from scope_memberships sm
     where sm.member_id = p_member and sm.scope_id = v_scope and sm.deleted_at is null;
    -- そのグループに居ない（主の所属でも兼ねる所属でもない）
    if v_seat.id is null and v_scope is distinct from (t->>'primary_scope')::uuid then
      return jsonb_build_object('error', 'not_in_group');
    end if;
    -- 管理者を下げる：最後の管理者なら断る（止めた管理者は数えない・K-800 の数え方）
    if v_role = 'admin' and app.admin_is_last_admin(p_member) then
      return jsonb_build_object('error', 'last_admin');
    end if;
    v_from := case when v_role = 'admin' then 'admin' else coalesce(v_seat.role, v_role) end;
    if v_role = 'admin' then
      insert into tenant_memberships (tenant_id, member_id, role, status, joined_at, created_by, updated_by)
      values (v_tenant, p_member, 'member', 'active', now(), v_me, v_me)
      on conflict (tenant_id, member_id) do update set role = 'member', updated_at = now(), updated_by = v_me;
      v_changed := true;
    end if;
    if v_seat.id is not null then
      if v_seat.role is distinct from v_key then
        update scope_memberships set role = v_key, changed_by = v_me, updated_at = now(), updated_by = v_me
         where id = v_seat.id;
        v_changed := true;
      end if;
    else
      -- 主の所属に所属の行が無い人（管理者・会社を作った人など）：行を足す（消した行が残っていれば戻す）
      insert into scope_memberships (tenant_id, member_id, scope_id, is_primary, role, changed_by, created_by, updated_by)
      values (v_tenant, p_member, v_scope, true, v_key, v_me, v_me, v_me)
      on conflict (member_id, scope_id) do update
        set deleted_at = null, is_primary = true, role = excluded.role, changed_by = v_me, updated_at = now(), updated_by = v_me;
      v_changed := true;
    end if;
    -- ⑦ 変えた物があるときだけ証跡（名前・メールは入れない・D-154.25）
    if v_changed then
      perform app.record_audit('member.role_change', 'members', p_member::text, 'C2',
                               jsonb_build_object('scope_id', v_scope, 'from', v_from, 'to', v_key));
    end if;
  end if;
  -- ⑧ 答え：会社の役割は読み直す・groups は getMember と同じ関数で組む
  return jsonb_build_object('ok', true, 'result', jsonb_build_object(
    'member_id', p_member,
    'company_role', app.admin_target(p_member)->>'role',
    'groups', app.member_groups_json(p_member)));
end $$;
revoke all on function app.member_role_change(uuid, jsonb) from public;
grant execute on function app.member_role_change(uuid, jsonb) to kaname_app;
