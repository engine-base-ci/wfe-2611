-- 20261126000700 招待を送り直す・取り消す（K-807・契約の口 resendInvitation・revokeInvitation・D-154.12・D-154.21・D-154.25・D-154.35・関門 C2）
--   招いた側（管理者・members の invite を付けた人）がメンバーの画面の招待中の行の「⋯」から押す。
--   ① invitations.resent_at：最後に送り直した時刻（同じ招待は 1 日 1 回）。メールが送れなかった回は空に戻す（数えない）
--   ② app.invitation_resend(p_id, p_token_hash)：同じ招待の行を更新する（新しい招待を作らない）。リンク（token_hash）を新しくして前のリンクを
--      使えなくし、期限を今から 7 日にする。期限切れでも送り直せる。取り消した・使われた招待は送り直せない。K-334 の頼みの印と受け箱の行を片付ける
--   ③ app.invitation_revoke(p_id)：revoked_at を今にする（並びから消え、リンクは使えなくなる）。頼みの印と受け箱の行を片付ける
--   ④ app.invitation_mail_failed(p_id)：口がメールを送れなかった後に呼ぶ。resent_at を空に戻し、証跡 invitation.mail_failed を書く
--   書く関数はどれも、最初に会社ごとの錠 app.admin_lock()（K-800）を取り、app.admin_can('members','invite') で権限を見る（入口と 2 層）。
--   答えは {"ok": true, …} か {"error": 言葉, …}（言葉 → 状態と番号は口の gate.ts の replyOf・K-800）。証跡の payload は招待の id と宛てのドメインだけ。
--   どれも security definer・search_path に pg_temp。public から外し kaname_app にだけ渡す。認証の表 kaname_auth."user" は読まない
alter table invitations add column if not exists resent_at timestamptz;

-- 招待を引く（同じ会社・消していない）。for update で取り、同時の送り直し・取り消しを順に通す（錠の後なので待たない）
create or replace function app.invitation_manage_row(p_id uuid)
returns invitations
language sql security definer set search_path = public, app, pg_temp as $$
  select i.* from invitations i
   where i.id = p_id and i.tenant_id = app.tenant_id() and i.deleted_at is null
   for update
$$;
revoke all on function app.invitation_manage_row(uuid) from public;

-- 送り直し・取り消しで、K-334 の「送り直しを頼む」の受け箱の行を片付ける（消した扱い）
create or replace function app.invitation_clear_requests(p_inv invitations)
returns void
language sql security definer set search_path = public, app, pg_temp as $$
  update notifications n set deleted_at = now()
   where n.tenant_id = p_inv.tenant_id and n.event_kind_id = 'invitation_resend_requested'
     and n.payload ->> 'invitation_id' = p_inv.id::text and n.deleted_at is null
$$;
revoke all on function app.invitation_clear_requests(invitations) from public;

create or replace function app.invitation_resend(p_id uuid, p_token_hash text)
returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_inv invitations%rowtype;
  v_exp timestamptz := now() + interval '7 days';
  c_day constant interval := interval '24 hours';
  v_mail jsonb;
begin
  perform app.admin_lock();
  if not app.admin_can('members', 'invite') then return jsonb_build_object('error', 'forbidden'); end if;
  if p_token_hash is null or p_token_hash = '' then return jsonb_build_object('error', 'inv_gone'); end if;
  select * into v_inv from app.invitation_manage_row(p_id);
  if v_inv.id is null then return jsonb_build_object('error', 'inv_gone'); end if;
  if v_inv.accepted_member_id is not null then return jsonb_build_object('error', 'inv_used'); end if;
  if v_inv.revoked_at is not null then return jsonb_build_object('error', 'inv_revoked'); end if;
  -- 1 日 1 回（D-154.12）。作った直後（resent_at が空）は数えない
  if v_inv.resent_at is not null and v_inv.resent_at > now() - c_day then
    return jsonb_build_object('error', 'inv_today', '次に送れる時刻', to_jsonb(v_inv.resent_at + c_day));
  end if;
  update invitations x
     set token_hash = p_token_hash, expires_at = v_exp, resent_at = now(),
         resend_requested_at = null, updated_by = app.user_id()
   where x.id = v_inv.id;
  perform app.invitation_clear_requests(v_inv);
  perform app.record_audit('invitation.resend', 'invitations', v_inv.id::text, 'C6',
    jsonb_build_object('invitation_id', v_inv.id, 'email_domain', split_part(v_inv.email, '@', 2)));
  select jsonb_build_object(
           'workspace_name', (select t.name from tenants t where t.id = v_inv.tenant_id),
           'inviter_name', (select m.display_name from members m where m.id = app.user_id()),
           'group_name', (select s.name from scopes s where s.id = v_inv.scope_id and s.deleted_at is null),
           'role', v_inv.role_id,
           'message', v_inv.message)
    into v_mail;
  return jsonb_build_object(
    'ok', true,
    'invitation', jsonb_build_object('id', v_inv.id, 'email', v_inv.email, 'expires_at', v_exp),
    'mail', v_mail);
end $$;
revoke all on function app.invitation_resend(uuid, text) from public;
grant execute on function app.invitation_resend(uuid, text) to kaname_app;

create or replace function app.invitation_revoke(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_inv invitations%rowtype;
  v_at timestamptz := now();
begin
  perform app.admin_lock();
  if not app.admin_can('members', 'invite') then return jsonb_build_object('error', 'forbidden'); end if;
  select * into v_inv from app.invitation_manage_row(p_id);
  if v_inv.id is null then return jsonb_build_object('error', 'inv_gone'); end if;
  if v_inv.accepted_member_id is not null then return jsonb_build_object('error', 'inv_used'); end if;
  if v_inv.revoked_at is not null then return jsonb_build_object('error', 'inv_revoked'); end if;
  update invitations x
     set revoked_at = v_at, resend_requested_at = null, updated_by = app.user_id()
   where x.id = v_inv.id;
  perform app.invitation_clear_requests(v_inv);
  perform app.record_audit('invitation.revoke', 'invitations', v_inv.id::text, 'C2',
    jsonb_build_object('invitation_id', v_inv.id, 'email_domain', split_part(v_inv.email, '@', 2)));
  return jsonb_build_object('ok', true, 'invitation', jsonb_build_object('id', v_inv.id, 'revoked_at', v_at));
end $$;
revoke all on function app.invitation_revoke(uuid) from public;
grant execute on function app.invitation_revoke(uuid) to kaname_app;

create or replace function app.invitation_mail_failed(p_id uuid)
returns void
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_inv invitations%rowtype;
begin
  if not app.admin_can('members', 'invite') then
    raise exception '招く権限が無い' using errcode = 'insufficient_privilege';
  end if;
  select * into v_inv from app.invitation_manage_row(p_id);
  if v_inv.id is null then return; end if;
  update invitations x set resent_at = null where x.id = v_inv.id;
  perform app.record_audit('invitation.mail_failed', 'invitations', v_inv.id::text, 'C6',
    jsonb_build_object('invitation_id', v_inv.id, 'email_domain', split_part(v_inv.email, '@', 2)));
end $$;
revoke all on function app.invitation_mail_failed(uuid) from public;
grant execute on function app.invitation_mail_failed(uuid) to kaname_app;
