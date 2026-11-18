-- 0112 招待の下見（K-331・契約の口 getInvitation・関門 C2）
--   ① invitations.message：招いた人のひとこと（D-128.62）。空を許す・500 文字まで
--   ② app.invitation_preview2(p_token_hash, p_auth_user_id)：リンクを開いた人が受ける前に見るもの。0020 の app.invitation_preview は
--      前の道すじ（/api/auth-ext/invitations/*）が使うので残す（消すのは K-337）。
--      state は used（accepted_member_id）＞ revoked（revoked_at か deleted_at）＞ expired（expires_at < now()）＞ ok の順に決める。
--      role は決まった 5 つ（admin・manager・member・viewer・requester）ならそのまま、ほか（古い値 staff・空）は member。
--      inviter_name は招いた人（created_by）の members.display_name、group_name は消していない scopes.name（消したグループ・決めていないは null）。
--      account_exists は宛てのメールに認証のアカウント（kaname_auth."user"）があるか。認証の表は migrateAuth が後から作るので、
--      plpgsql で to_regclass を見てから引く（表が無ければ false）。
--      signed_email・email_matches・already_member はログイン中（p_auth_user_id がある）ときだけ。無ければ null。
--      already_member は 0111 の app.current_members_of_auth_user（抜けた・招待中・消した所属は入らない）に招待の会社があるか。
--      何も書かない（読むだけ）。トークンは hash で引く（平文を DB に置かない）
alter table invitations add column if not exists message text;
alter table invitations drop constraint if exists invitations_message_len;
alter table invitations add constraint invitations_message_len check (message is null or char_length(message) <= 500);

create or replace function app.invitation_preview2(p_token_hash text, p_auth_user_id text default null)
returns table (state text, workspace_name text, inviter_name text, group_name text, role text, message text, email text,
               expires_at timestamptz, account_exists boolean, signed_email text, email_matches boolean, already_member boolean)
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_inv invitations%rowtype;
  v_has_auth boolean := to_regclass('kaname_auth."user"') is not null;
  v_exists boolean := false;
  v_signed text;
begin
  select * into v_inv from invitations i where i.token_hash = p_token_hash;
  if not found then return; end if;
  if v_has_auth then
    execute 'select exists (select 1 from kaname_auth."user" u where lower(u.email) = lower($1))' into v_exists using v_inv.email;
    if p_auth_user_id is not null then
      execute 'select u.email from kaname_auth."user" u where u.id = $1' into v_signed using p_auth_user_id;
    end if;
  end if;
  return query
  select case
           when v_inv.accepted_member_id is not null then 'used'
           when v_inv.revoked_at is not null or v_inv.deleted_at is not null then 'revoked'
           when v_inv.expires_at < now() then 'expired'
           else 'ok'
         end,
         t.name,
         (select m.display_name from members m where m.id = v_inv.created_by),
         (select s.name from scopes s where s.id = v_inv.scope_id and s.deleted_at is null),
         case when v_inv.role_id in ('admin', 'manager', 'member', 'viewer', 'requester') then v_inv.role_id else 'member' end,
         v_inv.message,
         v_inv.email,
         v_inv.expires_at,
         coalesce(v_exists, false),
         case when p_auth_user_id is null then null else v_signed end,
         case when p_auth_user_id is null then null
              else coalesce(lower(v_signed) = lower(v_inv.email), false) end,
         case when p_auth_user_id is null then null
              else exists (select 1 from app.current_members_of_auth_user(p_auth_user_id) c where c.tenant_id = v_inv.tenant_id) end
    from tenants t
   where t.id = v_inv.tenant_id;
end $$;
revoke all on function app.invitation_preview2(text, text) from public;
grant execute on function app.invitation_preview2(text, text) to kaname_app;

insert into app.schema_migrations (name) values ('0112_invitation_preview.sql') on conflict do nothing;
