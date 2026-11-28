-- 20261126002700 設定を読む・名前を直す（K-827・getWorkspaceSettings・updateWorkspace・D-154.4・D-154.5・D-154.16・D-154.21・D-154.22・D-154.83）
--   ① tenants に「誰ができるか」の 2 つの列（プランと支払い・ワークスペースを消す）。値は admin（管理者）か admin_manager（管理者とマネージャー）。書き出しは作らない（D-154.4）
--   ② 共通の判定 app.workspace_can(ability)：その 2 つを「いま押せる人か」を 1 か所で決める（K-829・K-830・段 13 の changePlan も呼ぶ・判定を二重に持たない）
--   ③ app.workspace_settings()：設定の画面の答え（名前・ロゴの ref・誰ができるか・決まっている物は口・消す手続きの今・押せる区画 access）。読むだけ
--   ④ app.workspace_rename(name)：名前だけを直す。会社ごとの錠（app.admin_lock・K-800）で順に通し、記録 workspace.renamed と 1 つの取引
--   プランと支払い・取引先の見える人の既定・依頼の届け先は読まない・書かない（D-154.22）。行の守り（packages/db/policies）は変えない：
--   tenants への書き込みは security definer の関数だけが行う

-- ---------------------------------------------------------------- ① 誰ができるか（既定は管理者）
alter table tenants add column if not exists who_billing text not null default 'admin';
alter table tenants add column if not exists who_delete_workspace text not null default 'admin';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tenants_who_billing_ck') then
    alter table tenants add constraint tenants_who_billing_ck check (who_billing in ('admin', 'admin_manager'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tenants_who_delete_workspace_ck') then
    alter table tenants add constraint tenants_who_delete_workspace_ck check (who_delete_workspace in ('admin', 'admin_manager'));
  end if;
end $$;

-- ---------------------------------------------------------------- ② 共通の判定（K-829 の前提と制約の「共通の判定」のとおり）
--   呼んだ人（app.user_id）が自分の会社の中で止められていない有効な人のとき、ability が billing か delete_workspace なら
--   ① 会社全体の役割が管理者 → 可 ② 会社全体の役割がマネージャー（グループの役割ではない）で、対応する列が admin_manager → 可
--   ③ その ability を個別に付けた permissions の行（取り消していない・束から作った行ではない）が在る → 可。
--   それ以外・知らない名前（export など）は不可。呼ぶたびに列と permissions を読む（覚えておかない・G-12）
create or replace function app.workspace_can(p_ability text) returns boolean
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare v_tenant uuid := app.tenant_id(); v_user uuid := app.user_id(); v_role text; v_who text;
begin
  if v_tenant is null or v_user is null or p_ability is null or p_ability not in ('billing', 'delete_workspace') then
    return false;
  end if;
  if not exists (select 1 from members m where m.id = v_user and m.tenant_id = v_tenant
                   and m.deleted_at is null and m.suspended_at is null) then
    return false;
  end if;
  select tm.role into v_role from tenant_memberships tm
   where tm.tenant_id = v_tenant and tm.member_id = v_user and tm.status = 'active' and tm.deleted_at is null;
  if v_role is null then return false; end if;
  if v_role = 'admin' then return true; end if;
  if v_role = 'manager' then
    select case p_ability when 'billing' then t.who_billing else t.who_delete_workspace end into v_who
      from tenants t where t.id = v_tenant;
    if v_who = 'admin_manager' then return true; end if;
  end if;
  return exists (select 1 from permissions p
                  where p.tenant_id = v_tenant and p.grantee_member_id = v_user and p.ability_id = p_ability
                    and p.revoked_at is null and p.deleted_at is null and p.bundle_role is null);
end $$;
revoke all on function app.workspace_can(text) from public;
grant execute on function app.workspace_can(text) to kaname_app;

-- 時刻を答えの字にする（ミリ秒まで・UTC）。消す日と始めた日の差がちょうど 14 日になるよう、両方を同じ形にそろえる
create or replace function app.workspace_ts(p timestamptz) returns text
language sql stable set search_path = public, app, pg_temp as $$
  select case when p is null then null else to_char(p at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end
$$;
revoke all on function app.workspace_ts(timestamptz) from public;

-- ---------------------------------------------------------------- ③ 設定を読む（読むだけ）
--   開けるのは管理者と、workspace_can が可の人（D-154.83）。どちらでもなければ 42501（口が 403 にする）。
--   消す手続き（D-154.16）：始めた日から 14 日後に消す。残りの日は切り上げ・0 以上。始めた人は記録 workspace.deletion_requested の人。
--   消えるものの数は、その時点で在る表だけ数える（チケット＝消していない件数・人＝有効と止めた人。ナレッジ・取引先は数えない）
create or replace function app.workspace_settings() returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id(); v_user uuid := app.user_id();
  v_admin boolean; v_billing boolean; v_delete boolean;
  t tenants%rowtype; v_by jsonb; v_delete_at timestamptz; v_days int;
begin
  if v_tenant is null or v_user is null or not app.member_ok() then
    raise exception '設定を読めるのは会社の人だけ' using errcode = '42501';
  end if;
  v_admin := app.is_admin(v_user)
             and exists (select 1 from members m where m.id = v_user and m.tenant_id = v_tenant and m.suspended_at is null);
  v_billing := app.workspace_can('billing');
  v_delete := app.workspace_can('delete_workspace');
  if not (v_admin or v_billing or v_delete) then
    raise exception '設定を開ける権限が無い' using errcode = '42501';
  end if;
  select * into t from tenants where id = v_tenant;
  if t.deletion_requested_at is not null then
    v_delete_at := t.deletion_requested_at + interval '14 days';
    v_days := greatest(0, ceil(extract(epoch from (v_delete_at - now())) / 86400.0)::int);
    select jsonb_build_object('id', m.id, 'name', m.display_name) into v_by
      from audit_events a join members m on m.id = a.actor_member_id and m.tenant_id = v_tenant
     where a.tenant_id = v_tenant and a.action = 'workspace.deletion_requested'
       and a.occurred_at >= t.deletion_requested_at - interval '1 minute'
     order by a.occurred_at desc limit 1;
  end if;
  return jsonb_build_object(
    'workspace', jsonb_build_object('id', t.id, 'name', t.name, 'logo_ref', t.logo_ref),
    'who', jsonb_build_object('billing', t.who_billing, 'delete_workspace', t.who_delete_workspace),
    'deletion', jsonb_build_object(
      'requested_at', app.workspace_ts(t.deletion_requested_at),
      'delete_at', app.workspace_ts(v_delete_at),
      'days_left', v_days,
      'requested_by', v_by,
      'preview', jsonb_build_object(
        'tickets', (select count(*) from tickets k where k.tenant_id = v_tenant and k.deleted_at is null),
        'members', (select count(*) from tenant_memberships tm
                     where tm.tenant_id = v_tenant and tm.status in ('active', 'suspended') and tm.deleted_at is null))),
    'access', jsonb_build_object('admin', v_admin, 'billing', v_admin or v_billing, 'delete_workspace', v_admin or v_delete));
end $$;
revoke all on function app.workspace_settings() from public;
grant execute on function app.workspace_settings() to kaname_app;

-- ---------------------------------------------------------------- ④ 名前を直す（管理者だけ・1 つの取引）
--   名前は口が前後の空白を削り 1〜100 字（コードポイント）を確かめた後の字。DB でも字数（1〜100・コードポイント）を確かめる（2 層目）。
--   同じ名前なら書かない（記録も書かない）。答え：{ changed, workspace: { id, name, logo_ref } }
create or replace function app.workspace_rename(p_name text) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_tenant uuid := app.tenant_id(); v_user uuid := app.user_id(); v_from text; t tenants%rowtype;
begin
  if v_tenant is null or v_user is null or not app.member_ok() then
    raise exception '名前を直せるのは会社の人だけ' using errcode = '42501';
  end if;
  perform app.admin_lock();
  if not app.is_admin(v_user)
     or not exists (select 1 from members m where m.id = v_user and m.tenant_id = v_tenant and m.suspended_at is null) then
    raise exception '名前を直せるのは管理者だけ' using errcode = '42501';
  end if;
  if p_name is null or char_length(p_name) < 1 or char_length(p_name) > 100 then
    raise exception '名前の形が決まりに合わない' using errcode = '22023';
  end if;
  select * into t from tenants where id = v_tenant for update;
  v_from := t.name;
  if v_from is not distinct from p_name then
    return jsonb_build_object('changed', false,
      'workspace', jsonb_build_object('id', t.id, 'name', t.name, 'logo_ref', t.logo_ref));
  end if;
  update tenants set name = p_name, updated_at = now(), updated_by = v_user where id = v_tenant returning * into t;
  perform app.record_audit('workspace.renamed', 'workspace', v_tenant::text, 'C2',
                           jsonb_build_object('from', v_from, 'to', p_name));
  return jsonb_build_object('changed', true,
    'workspace', jsonb_build_object('id', t.id, 'name', t.name, 'logo_ref', t.logo_ref));
end $$;
revoke all on function app.workspace_rename(text) from public;
grant execute on function app.workspace_rename(text) to kaname_app;
