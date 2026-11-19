-- 20261119051732_accept_invitation 招待を受ける（K-332・契約の口 acceptInvitation・関門 C2）
--   ① app.invitation_for_accept(p_token_hash)：口が認証の利用者を作る前に見るもの（招待の id・ワークスペース・宛てのメール・状態・ワークスペースが止められているか）。
--      state は 0114 の下見と同じ順（used ＞ revoked ＞ expired ＞ ok）。行が無ければ 0 行。何も書かない
--   ② app.accept_invitation を作り直す（形は 0005 と同じ。前の道すじ /api/auth-ext/invitations/*/accept と packages/auth の acceptInvitation もこれを呼ぶ）。
--      招待を for update で読み、無い → 「無効」、used・revoked・expired → 「無効」と理由の語（hint に理由）の例外（insufficient_privilege）。
--      グループは invitations.scope_id（消したグループ・決めていないならワークスペースのいちばん上の生きたグループ）。
--      members（招いた人が created_by）・tenant_memberships（役割は決まった 5 つならそのまま・ほかは member・active・joined_at）・
--      scope_memberships（主の所属・役割は manager か viewer ならそのまま・ほかは member）・accepted_member_id・出来事 invitation_accepted。
--      0005 の「どこかの会社にもう居れば断る」は外す（D-125.150。2 つ目の会社は K-333）
--   ③ app.agree_current_terms_on_invite(p_member, p_auth_user_id)：招待で入った人の、今の版の規約（app.current_terms() の全部）への同意を記録する
--      （画面の「続けると同意」・D-128.137）。契約の口だけが ② と同じ取引の中で呼ぶ。② の中に入れないのは、前の道すじ（K-337 まで）が
--      同意を取らずに受けて、同意し直しの印を立てるため（前からの試験 flows.test.ts・terms.test.ts の K53-API-039 が見る）。
--      その招待で入った人（accepted_member_id）でなければ何もしない
--   0005 は public から実行権を外していないので、ここで外す（外さないと kaname_app から外しても public の権限で呼べてしまう）

create or replace function app.invitation_for_accept(p_token_hash text)
returns table (invitation_id uuid, tenant_id uuid, email text, state text, workspace_suspended boolean)
language sql stable security definer set search_path = public, app, pg_temp as $$
  select i.id, i.tenant_id, i.email,
         case
           when i.accepted_member_id is not null then 'used'
           when i.revoked_at is not null or i.deleted_at is not null then 'revoked'
           when i.expires_at < now() then 'expired'
           else 'ok'
         end,
         exists (select 1 from subscriptions s
                  where s.tenant_id = i.tenant_id and s.suspended_at is not null and s.deleted_at is null)
    from invitations i
   where i.token_hash = p_token_hash
$$;
revoke all on function app.invitation_for_accept(text) from public;
grant execute on function app.invitation_for_accept(text) to kaname_app;

create or replace function app.accept_invitation(p_token_hash text, p_auth_user_id text, p_display_name text) returns uuid
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  inv invitations%rowtype;
  v_scope uuid;
  v_member uuid;
  v_role text;
  v_scope_role text;
begin
  select * into inv from invitations where token_hash = p_token_hash for update;
  if inv.id is null then
    raise exception '招待が無効（見つからない）' using errcode = 'insufficient_privilege', hint = 'not_found';
  end if;
  if inv.accepted_member_id is not null then
    raise exception '招待が無効（受諾済み）' using errcode = 'insufficient_privilege', hint = 'used';
  end if;
  if inv.revoked_at is not null or inv.deleted_at is not null then
    raise exception '招待が無効（取り消し）' using errcode = 'insufficient_privilege', hint = 'revoked';
  end if;
  if inv.expires_at < now() then
    raise exception '招待が無効（期限切れ）' using errcode = 'insufficient_privilege', hint = 'expired';
  end if;
  select s.id into v_scope from scopes s
   where s.id = inv.scope_id and s.tenant_id = inv.tenant_id and s.deleted_at is null;
  if v_scope is null then
    select s.id into v_scope from scopes s
     where s.tenant_id = inv.tenant_id and s.parent_id is null and s.deleted_at is null
     order by s.created_at limit 1;
  end if;
  v_role := case when inv.role_id in ('admin', 'manager', 'member', 'viewer', 'requester') then inv.role_id else 'member' end;
  v_scope_role := case when inv.role_id in ('manager', 'viewer') then inv.role_id else 'member' end;
  insert into members (tenant_id, scope_id, kind_id, display_name, role_id, auth_user_id, created_by)
  values (inv.tenant_id, v_scope, 'human', p_display_name, inv.role_id, p_auth_user_id, inv.created_by)
  returning id into v_member;
  insert into tenant_memberships (tenant_id, member_id, auth_user_id, role, status, joined_at, created_by)
  values (inv.tenant_id, v_member, p_auth_user_id, v_role, 'active', now(), inv.created_by);
  if v_scope is not null then
    insert into scope_memberships (tenant_id, member_id, scope_id, is_primary, role, changed_by, created_by)
    values (inv.tenant_id, v_member, v_scope, true, v_scope_role, inv.created_by, inv.created_by);
  end if;
  update invitations set accepted_member_id = v_member where id = inv.id;
  perform app.record_security_event(inv.tenant_id, 'invitation_accepted', v_member, null, jsonb_build_object('invitation_id', inv.id));
  return v_member;
end $$;
revoke all on function app.accept_invitation(text, text, text) from public;
grant execute on function app.accept_invitation(text, text, text) to kaname_app, kaname_auth;

create or replace function app.agree_current_terms_on_invite(p_member uuid, p_auth_user_id text) returns int
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_tenant uuid; n int;
begin
  select m.tenant_id into v_tenant from members m
   where m.id = p_member and m.auth_user_id = p_auth_user_id and m.deleted_at is null
     and exists (select 1 from invitations i where i.accepted_member_id = m.id);
  if v_tenant is null then return 0; end if;
  insert into terms_consents (tenant_id, member_id, auth_user_id, terms_version_id, agreed_at, created_by)
  select v_tenant, p_member, p_auth_user_id, t.id, now(), p_member
    from app.current_terms() t
  on conflict (auth_user_id, terms_version_id) where deleted_at is null do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function app.agree_current_terms_on_invite(uuid, text) from public;
grant execute on function app.agree_current_terms_on_invite(uuid, text) to kaname_app;

insert into app.schema_migrations (name) values ('20261119051732_accept_invitation.sql') on conflict do nothing;
