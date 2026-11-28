-- 会社を作った人の役割（owner）を入れる。D-086 の「その権限で見えない画面」を画面側が判定するのに要る。
-- 今までは role_id が null で、代表かどうかを誰も言えなかった（2026-09-20）
create or replace function app.create_company(p_auth_user_id text, p_company text, p_display_name text) returns uuid
language plpgsql security definer set search_path = public, app as $$
declare v_tenant uuid; v_scope uuid; v_member uuid;
begin
  if exists (select 1 from members where auth_user_id = p_auth_user_id and deleted_at is null) then
    raise exception 'この利用者は既に会社に属している' using errcode = 'unique_violation';
  end if;
  insert into tenants (id, tenant_id, name) select u, u, left(trim(p_company), 120) from gen_random_uuid() u returning id into v_tenant;
  insert into scopes (tenant_id, name) values (v_tenant, '会社') returning id into v_scope;
  insert into members (tenant_id, scope_id, kind_id, display_name, auth_user_id, role_id)
    values (v_tenant, v_scope, 'human', left(trim(p_display_name), 80), p_auth_user_id, 'owner') returning id into v_member;
  update members set created_by = v_member where id = v_member;
  insert into permissions (tenant_id, grantee_member_id, target_kind_id, ability_id, granted_by)
    select v_tenant, v_member, tk.key, a.key, v_member from target_kinds tk cross join (values ('view'), ('edit')) as a(key);
  insert into clones (tenant_id, owner_member_id, persona, created_by) values (v_tenant, v_member, null, v_member);
  perform app.record_security_event(v_tenant, 'company_created', v_member, null, jsonb_build_object('auth_user_id', p_auth_user_id));
  return v_tenant;
end $$;
grant execute on function app.create_company(text, text, text) to kaname_app, kaname_auth;

-- 既にある会社の代表にも入れる（作った人＝自分で created_by が自分）
update members set role_id = 'owner' where role_id is null and kind_id = 'human' and id = created_by;

-- 招待を受けた直後のセッションを開き直す。accept は「認証の利用者を作る → メンバーを作る」の順なので、
-- セッションの hook が走る時点ではまだメンバーが無く、public.sessions に 1 行も入らない＝参加直後に何も操作できなかった（2026-09-20）
create or replace function app.open_sessions_for_user(p_auth_user_id text) returns int
language plpgsql security definer set search_path = public, app, kaname_auth as $$
declare v_n int := 0; r record;
begin
  for r in select s.id from kaname_auth.session s where s."userId" = p_auth_user_id and s."expiresAt" > now() loop
    perform app.open_session(r.id, p_auth_user_id, 'web', null, null);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
grant execute on function app.open_sessions_for_user(text) to kaname_app, kaname_auth;
