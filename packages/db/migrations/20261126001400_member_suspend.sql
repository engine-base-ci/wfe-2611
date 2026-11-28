-- 20261126001400 一時的に止める・戻す（K-814・契約の口 suspendMember・resumeMember・D-125.140・D-125.150・D-128.97・D-154.18〜.21・D-154.25・D-154.27・D-154.33）
--   新しい表・列は作らない。関数を 3 つ足す（書く・関門 C2）。会社ごとの錠・相手の読み・最後の管理者・権限の確かめは K-800（20261126000000_f10_base.sql）の関数を使う。
--
-- app.admin_cut_sessions(p_member, p_reason)：その人の生きているセッションを全部の種類（web・bridge・api）で失効し（app.revoke_all_sessions・0004）、
--   その人の PC の仕事（bridge_jobs の queued・running・asking＝確認待ち）を cancelled にして人に見せる理由の文を入れる。答えは { sessions_cut, jobs_cancelled } の件数。
--   p_reason は suspended（止める）・member_removed（外す）・member_left（抜ける）の 3 つ（ほかは 22023・何も変えない）。文は p_reason で分ける
--   （代表の答え 29536ded573d・b9c92c9eccf3・e0920e503c99）。セッションの失効の理由は suspended なら suspended、外す・抜けるはどちらも前からの member_left。
--   K-849（外す＝member_removed・抜ける＝member_left）も同じ関数を呼ぶ。どの呼び手も、所属・status を書く前に呼ぶ
--   （status を書くと役割の束の引き金 0080 が束の権限の行を消し、権限の引き金 0004 が理由 permission_changed で先に切ってしまう）。
--   権限は見ない（呼ぶ関数が見る）ので kaname_app には渡さない。
-- app.member_suspend(p_member)：① 錠 ② members の edit ③ 相手 ④ 自分 ⑤ もう止まっている ⑥ 最後の管理者 ⑦ 切る（状態を書く前）⑧ 止めを書く ⑨ 証跡。
-- app.member_resume(p_member)：① 錠 ② members の edit ③ 相手 ④ 止まっていない ⑤ 止めを解く（束の引き金が束の行を作り直す）⑥ 証跡。切ったセッションと仕事は戻さない。
--   答え：{ ok: true, result: { member_id, suspended, suspended_at } } か { error: forbidden | member_gone | self_stop | already_suspended | not_suspended | last_admin }
--   （言葉 → 状態と番号は apps/api/src/features/F10/admin/gate.ts の replyOf・K-800）。

create or replace function app.admin_cut_sessions(p_member uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_sessions int;
  v_jobs int;
  v_why text;
begin
  v_why := case p_reason
    when 'suspended' then '担当の人が一時的に止められたので、この仕事はやめました'
    when 'member_removed' then '担当の人がワークスペースから外されたので、この仕事はやめました'
    when 'member_left' then '担当の人がワークスペースを抜けたので、この仕事はやめました'
  end;
  if v_why is null then
    raise exception '知らない理由：%', p_reason using errcode = '22023';
  end if;
  v_sessions := app.revoke_all_sessions(p_member, case when p_reason = 'suspended' then 'suspended' else 'member_left' end);
  update bridge_jobs
     set state_id = 'cancelled', stopped_reason = v_why, finished_at = now(), updated_by = app.user_id()
   where member_id = p_member and state_id in ('queued', 'running', 'asking');
  get diagnostics v_jobs = row_count;
  return jsonb_build_object('sessions_cut', coalesce(v_sessions, 0), 'jobs_cancelled', v_jobs);
end $$;
revoke all on function app.admin_cut_sessions(uuid, text) from public;

create or replace function app.member_suspend(p_member uuid) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_me uuid := app.user_id();
  v_tenant uuid := app.tenant_id();
  v_target jsonb;
  v_cut jsonb;
  v_at timestamptz := now();
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
  if v_target ->> 'state' = 'suspended' then
    return jsonb_build_object('error', 'already_suspended');
  end if;
  if app.admin_is_last_admin(p_member) then
    return jsonb_build_object('error', 'last_admin');
  end if;

  -- 状態を書く前に切る（束の引き金が先に切ると、理由 suspended の件数が数えられない）
  v_cut := app.admin_cut_sessions(p_member, 'suspended');

  update members set suspended_at = v_at, suspended_by = v_me, updated_by = v_me
   where id = p_member and tenant_id = v_tenant;
  update tenant_memberships set status = 'suspended', updated_by = v_me
   where member_id = p_member and tenant_id = v_tenant and deleted_at is null;

  perform app.record_audit('member.suspend', 'members', p_member::text, 'C2', v_cut);

  return jsonb_build_object('ok', true, 'result', jsonb_build_object(
    'member_id', p_member,
    'suspended', true,
    'suspended_at', to_char(date_trunc('milliseconds', v_at) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
end $$;
revoke all on function app.member_suspend(uuid) from public;
grant execute on function app.member_suspend(uuid) to kaname_app;

create or replace function app.member_resume(p_member uuid) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_me uuid := app.user_id();
  v_tenant uuid := app.tenant_id();
  v_target jsonb;
begin
  perform app.admin_lock();
  if not app.admin_can('members', 'edit') then
    return jsonb_build_object('error', 'forbidden');
  end if;
  v_target := app.admin_target(p_member);
  if v_target is null then
    return jsonb_build_object('error', 'member_gone');
  end if;
  if v_target ->> 'state' is distinct from 'suspended' then
    return jsonb_build_object('error', 'not_suspended');
  end if;

  update members set suspended_at = null, suspended_by = null, updated_by = v_me
   where id = p_member and tenant_id = v_tenant;
  -- status を active にすると、役割の束の引き金（0080）が束の権限の行を作り直す
  update tenant_memberships set status = 'active', updated_by = v_me
   where member_id = p_member and tenant_id = v_tenant and deleted_at is null and status = 'suspended';

  perform app.record_audit('member.resume', 'members', p_member::text, 'C2', '{}'::jsonb);

  return jsonb_build_object('ok', true, 'result', jsonb_build_object(
    'member_id', p_member, 'suspended', false, 'suspended_at', null));
end $$;
revoke all on function app.member_resume(uuid) from public;
grant execute on function app.member_resume(uuid) to kaname_app;
