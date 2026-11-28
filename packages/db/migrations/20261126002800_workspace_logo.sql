-- 20261126002800 会社のロゴを変える（K-828・契約の口 uploadWorkspaceLogo・D-154.4・関門 C2）
--   実体は口が置き場（関門 C4）に先に置き、その ref をこの関数が tenants.logo_ref に書く。前の ref を返し、口が後片付けで実体を消す。
--   app.workspace_logo_set(p_ref)：会社ごとの錠 app.admin_lock()（K-800）→ 管理者でなければ 42501 → p_ref が自分の会社の ref でなければ 42501
--   → 前の logo_ref を読み、新しい ref に書き換え → 記録 workspace.logo_changed（payload は空・ref を書かない）。全部を 1 つの取引で
create or replace function app.workspace_logo_set(p_ref text)
returns text
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_user uuid := app.user_id();
  v_prev text;
begin
  perform app.admin_lock();
  if v_tenant is null or v_user is null or not app.is_admin(v_user) then
    raise exception 'ロゴを変える権限が無い' using errcode = 'insufficient_privilege';
  end if;
  if p_ref is null or p_ref not like 'tenants/' || v_tenant::text || '/%' then
    raise exception 'この会社のファイルでない' using errcode = 'insufficient_privilege';
  end if;
  select t.logo_ref into v_prev from tenants t where t.id = v_tenant for update;
  update tenants set logo_ref = p_ref where id = v_tenant;
  perform app.record_audit('workspace.logo_changed', 'workspace', v_tenant::text, 'C4', '{}'::jsonb);
  return v_prev;
end $$;
revoke all on function app.workspace_logo_set(text) from public;
grant execute on function app.workspace_logo_set(text) to kaname_app;
