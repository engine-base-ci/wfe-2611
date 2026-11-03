-- 0081 本人確認の取り直し（KN-51・D-125.139・D-128.97）
--   直前の本人確認の時刻をセッション（sessions.step_up_at）に持つ。取り直しの口（POST /auth/step-up）が確かめたら app.mark_step_up で付け、
--   入口（apps/api/src/contract/op.ts）が 15 分以内かを見る。ログインし直しや失効で消える（新しいセッションは空から）。
alter table sessions add column if not exists step_up_at timestamptz;

-- 取り直しを付ける（ログインの部品が本人を確かめたあとにだけ呼ぶ。失効したセッションには付けない）
create or replace function app.mark_step_up(p_auth_session_id text) returns boolean language plpgsql security definer set search_path = public, app as $$
declare n int;
begin
  update sessions set step_up_at = now() where auth_session_id = p_auth_session_id and revoked_at is null;
  get diagnostics n = row_count;
  return n > 0;
end $$;
-- 取り直しの時刻を読む（解決の所が文脈に入れる）
create or replace function app.session_step_up_at(p_auth_session_id text) returns timestamptz language sql stable security definer set search_path = public, app as $$
  select step_up_at from sessions where auth_session_id = p_auth_session_id and revoked_at is null
$$;
-- 入口の確かめ（KN-51）：どこかのグループでその能力を持つか（書き出す・層の決まり など、口の中でグループに絞るもの）
create or replace function app.has_any_permission(uid uuid, target_kind text, ability text) returns boolean language sql stable security definer set search_path = public, app as $$
  select exists (
    select 1 from permissions p
    where p.grantee_member_id = uid and p.tenant_id = app.tenant_id() and p.revoked_at is null and p.deleted_at is null
      and p.target_kind_id = target_kind and (p.ability_id = ability or (ability = 'view' and p.ability_id = 'edit'))
  )
$$;
-- 管理者の役割か（「誰ができるか」を変えるのは管理者だけ。権限を個別に付けた人でも通さない・D-128.97）
create or replace function app.is_admin(uid uuid) returns boolean language sql stable security definer set search_path = public, app as $$
  select exists (select 1 from tenant_memberships t where t.member_id = uid and t.tenant_id = app.tenant_id() and t.role = 'admin' and t.status = 'active' and t.deleted_at is null)
$$;
grant execute on function app.mark_step_up(text), app.session_step_up_at(text), app.has_any_permission(uuid, text, text), app.is_admin(uuid) to kaname_app;

insert into app.schema_migrations (name) values ('0081_step_up.sql') on conflict do nothing;
