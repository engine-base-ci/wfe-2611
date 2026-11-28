-- 0005 auth flows（T-F-06）。招待の受諾（D-026・D-037・G-14 取消で即無効）・自分の端末の失効。

-- 招待を受ける：token_hash が生きていれば、その会社・その層にメンバーを作り、認証の利用者と結ぶ（文脈が無い前に起きるので security definer）
create or replace function app.accept_invitation(p_token_hash text, p_auth_user_id text, p_display_name text) returns uuid
language plpgsql security definer set search_path = public, app as $$
declare inv invitations%rowtype; v_scope uuid; v_member uuid;
begin
  select * into inv from invitations where token_hash = p_token_hash for update;
  if inv.id is null or inv.revoked_at is not null or inv.accepted_member_id is not null or inv.expires_at < now() or inv.deleted_at is not null then
    raise exception '招待が無効（取り消し・期限切れ・受諾済み）' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from members where auth_user_id = p_auth_user_id and deleted_at is null) then
    raise exception 'この利用者は既に会社に属している' using errcode = 'unique_violation';
  end if;
  v_scope := inv.scope_id;
  if v_scope is null then select id into v_scope from scopes where tenant_id = inv.tenant_id and parent_id is null and deleted_at is null order by created_at limit 1; end if;
  insert into members (tenant_id, scope_id, kind_id, display_name, role_id, auth_user_id, created_by) values (inv.tenant_id, v_scope, 'human', p_display_name, inv.role_id, p_auth_user_id, inv.created_by) returning id into v_member;
  update invitations set accepted_member_id = v_member where id = inv.id;
  perform app.record_security_event(inv.tenant_id, 'invitation_accepted', v_member, null, jsonb_build_object('invitation_id', inv.id));
  return v_member;
end $$;

-- 自分の端末を失効する（本人だけ。他人の端末は権限で＝sessions_permission_write）
create or replace function app.revoke_own_session(p_session_id uuid, p_reason text default 'logout') returns int
language plpgsql security definer set search_path = public, app as $$
declare n int;
begin
  update sessions set revoked_at = now(), revoke_reason_id = coalesce(p_reason, 'logout') where id = p_session_id and member_id = app.user_id() and tenant_id = app.tenant_id() and revoked_at is null;
  get diagnostics n = row_count; return n;
end $$;

grant execute on function app.accept_invitation(text, text, text), app.revoke_own_session(uuid, text) to kaname_app, kaname_auth;
insert into app.schema_migrations (name) values ('0005_auth_flows.sql') on conflict do nothing;
