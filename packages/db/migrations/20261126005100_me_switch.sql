-- 20261126005100 ワークスペースを切り替える・自分に届いた招待を読む（K-851・switchWorkspace・listMyInvitations・K-70 の葉・D-125.150・D-154.55・D-154.81・関門 C2）
--
-- 関数（どれも security definer・public から外し kaname_app に渡す）：
--   app.me_switch_workspace(tenant, 部品のセッションの id) … 今の端末の sessions の行を、その会社の同じログインの人に結び直す（行を増やさない）
--     今の会社と同じなら何も変えない（switched false）。入れない会社（無い・別のログイン・止められた・抜けた・招待中・人が止まった・会社を消した）は
--     同じ not_found。今の端末の行が無い・切れている・同じログインの物でなければ no_session。記録・安全の記録・受け箱は作らない（D-154.55）
--   app.me_invitations(部品の利用者の id) … 確かめ済みのログインのメールに届いた、待っている・期限内の招待（期限の近い順に 20 件と全部の数）
--     呼んだ人の同じログインの id でなければ 0 件。止められた人・今の会社で有効でない人は stopped（口は 403）。招待の印（ハッシュ）・宛ては返さない
-- 届いた招待の問い合わせ（と K-852 の門の問い合わせ）のために、待っている招待のメールの索引を足す

create index if not exists invitations_email_lower_idx on invitations (lower(btrim(email)))
  where accepted_member_id is null and revoked_at is null and deleted_at is null;

create or replace function app.me_switch_workspace(p_tenant uuid, p_auth_session text) returns jsonb
language plpgsql security definer set search_path = public, app, kaname_auth, pg_temp as $$
declare
  v_self uuid := app.user_id();
  v_row record;
  v_au text;
  v_target uuid;
begin
  if v_self is null or p_tenant is null or p_auth_session is null or p_auth_session = '' then
    return jsonb_build_object('error', 'no_session');
  end if;
  -- ① 今の端末の行（同じログインの物・生きている物）。同じ端末の切り替えはここで順に通す
  select s.id, s.tenant_id, s.member_id into v_row
    from sessions s
   where s.auth_session_id = p_auth_session and s.revoked_at is null and s.deleted_at is null
     and s.member_id in (select app.account_members(v_self))
   for update of s;
  if not found then
    return jsonb_build_object('error', 'no_session');
  end if;
  -- ② 今いる会社なら何も変えない
  if v_row.tenant_id = p_tenant then
    return jsonb_build_object('tenant_id', p_tenant, 'switched', false);
  end if;
  -- ③ 行き先：同じログイン（tenant_memberships.auth_user_id・D-125.150）の、その会社の有効な人
  select tm.auth_user_id into v_au
    from tenant_memberships tm
   where tm.member_id = v_row.member_id and tm.auth_user_id is not null and tm.deleted_at is null
   limit 1;
  if v_au is null then
    select m.auth_user_id into v_au from members m where m.id = v_row.member_id;
  end if;
  if v_au is null then
    return jsonb_build_object('error', 'not_found');
  end if;
  select tm.member_id into v_target
    from tenant_memberships tm
    join members m on m.id = tm.member_id
    join tenants t on t.id = tm.tenant_id
   where tm.tenant_id = p_tenant and tm.auth_user_id = v_au and tm.status = 'active' and tm.deleted_at is null
     and m.deleted_at is null and m.suspended_at is null and t.deleted_at is null
   order by tm.created_at, tm.member_id
   limit 1;
  if v_target is null then
    return jsonb_build_object('error', 'not_found');
  end if;
  -- ④ 結び直す（行を増やさない。issued_at・auth_session_id・端末・本人確認の取り直しの時刻はそのまま）
  update sessions set tenant_id = p_tenant, member_id = v_target, last_seen_at = now()
   where id = v_row.id;
  return jsonb_build_object('tenant_id', p_tenant, 'switched', true);
end $$;
revoke all on function app.me_switch_workspace(uuid, text) from public;
grant execute on function app.me_switch_workspace(uuid, text) to kaname_app;

create or replace function app.me_invitations(p_auth_user_id text) returns jsonb
language plpgsql stable security definer set search_path = public, app, kaname_auth, pg_temp as $$
declare
  v_email text;
  v_ok boolean;
  v_list jsonb;
  v_total int;
begin
  -- 止められた人・今の会社で有効でない人は読めない（口は 403。本物のログインでは止めたときに端末が切れて入口が 401）
  if exists (select 1 from members m where m.id = app.user_id() and (m.suspended_at is not null or m.deleted_at is not null))
     or not exists (select 1 from tenant_memberships tm
                     where tm.member_id = app.user_id() and tm.status = 'active' and tm.deleted_at is null) then
    return jsonb_build_object('error', 'stopped');
  end if;
  -- 呼んだ人の同じログインの id だけを読む（ほかのログインのメールの招待を引けないように）
  if p_auth_user_id is null or p_auth_user_id = '' or not exists (
       select 1 from tenant_memberships tm
        where tm.member_id = app.user_id() and tm.auth_user_id = p_auth_user_id and tm.deleted_at is null) then
    return jsonb_build_object('invitations', '[]'::jsonb, 'total', 0);
  end if;
  select u.email, u."emailVerified" into v_email, v_ok from kaname_auth."user" u where u.id = p_auth_user_id;
  if v_email is null or btrim(v_email) = '' or v_ok is not true then
    return jsonb_build_object('invitations', '[]'::jsonb, 'total', 0);
  end if;
  with pending as (
    select i.id, i.expires_at, btrim(t.name) as workspace_name, m.display_name as inviter_name
      from invitations i
      join tenants t on t.id = i.tenant_id and t.deleted_at is null
      left join members m on m.id = i.created_by
     where lower(btrim(i.email)) = lower(btrim(v_email))
       and i.accepted_member_id is null and i.revoked_at is null and i.deleted_at is null
       and i.expires_at > now()
       and not exists (
         select 1 from tenant_memberships tm
          where tm.tenant_id = i.tenant_id and tm.auth_user_id = p_auth_user_id
            and tm.status in ('active', 'suspended') and tm.deleted_at is null)
  )
  select (select count(*)::int from pending),
         coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'workspace_name', x.workspace_name,
                                                       'inviter_name', x.inviter_name, 'expires_at', x.expires_at)
                                    order by x.expires_at, x.id)
                     from (select * from pending order by expires_at, id limit 20) x), '[]'::jsonb)
    into v_total, v_list;
  return jsonb_build_object('invitations', v_list, 'total', v_total);
end $$;
revoke all on function app.me_invitations(text) from public;
grant execute on function app.me_invitations(text) to kaname_app;
