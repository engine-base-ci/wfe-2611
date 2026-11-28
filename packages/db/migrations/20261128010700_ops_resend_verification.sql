-- 20261128010700 運営が 1 社のメンバーに本人確認のメールを送り直す前の確かめと記録（K-967・契約の口 resendOpsVerification・
--   D-156.3・D-156.12・D-128.108・D-125.129・関門 C2・C6）
--   app.ops_resend_verification_prepare(会社, 人)：口が 1 つの取引の中で最初に呼ぶ。ここで記録を書き、口がその後で関門 C6 からメールを送る。
--   送れなければ口が例外にして取引ごと戻す（記録も送った記録も残らない）。記録が書けなければ例外で、口は送らない。
--   ⓐ ops_require('inquiry') ⓑ ops_target ⓒ その会社のメンバー（所属の行が抜けていない・消していない・認証の人がいる）を for update で引く。
--      引けなければ no_data_found（P0002 → 404・在るかを漏らさない）
--   ⓓ 認証の人のメールと確かめの印を読む（kaname_auth は security definer の中だけ・0113 の app.login_methods と同じ動的な文）。
--      認証の人の行が無ければ no_data_found。確かめ済みなら { error: verified }（何も書かない・口が 409 E-CONF-039）
--   ⓔ 運営の記録と会社の記録に 1 行ずつ（app.record_ops_audit・payload は名前だけ。メール・リンクを入れない）
--   ⓕ 送った記録（notifications・email・ops.verification_resend）を 1 行。運営の文脈は notifications の行の守り（同じ会社で自分宛て）を
--      通らないので、関門 C6 の remember の代わりにここで書く（送れなければ取引ごと戻る）。dedupe の鍵は 1 回ごとに違う（記録の id）
--   答えは { email, audit_id, name }。メールは口の中だけで使い、答え・ログに出さない
create or replace function app.ops_resend_verification_prepare(p_tenant uuid, p_member uuid) returns jsonb
language plpgsql volatile security definer set search_path = public, app, pg_temp as $$
declare
  v_auth text;
  v_name text;
  v_email text;
  v_verified boolean;
  v_audit uuid;
begin
  perform app.ops_require('inquiry');
  perform app.ops_target(p_tenant);

  select coalesce(m.auth_user_id, tm.auth_user_id), m.display_name into v_auth, v_name
    from tenant_memberships tm
    join members m on m.id = tm.member_id and m.tenant_id = tm.tenant_id and m.deleted_at is null
   where tm.tenant_id = p_tenant and tm.member_id = p_member
     and tm.deleted_at is null and tm.status <> 'left'
   limit 1
   for update of tm;
  if v_auth is null or v_auth = '' then
    raise exception '送り直せるメンバーが無い' using errcode = 'no_data_found';
  end if;

  if to_regclass('kaname_auth."user"') is not null then
    execute 'select email, "emailVerified" from kaname_auth."user" where id = $1'
      into v_email, v_verified using v_auth;
  end if;
  if v_email is null or v_email = '' then
    raise exception '送り直せるメンバーが無い' using errcode = 'no_data_found';
  end if;
  if coalesce(v_verified, false) then
    return jsonb_build_object('error', 'verified');
  end if;

  v_audit := app.record_ops_audit(p_tenant, 'verification.resend', 'members', p_member::text, null,
    jsonb_build_object('target_label', v_name));

  insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, dedupe_key, sent_at, created_by)
  values (p_tenant, p_member, 'email', 'ops.verification_resend', '{}'::jsonb,
          format('ops.verification_resend:%s:%s', p_member, v_audit), now(), app.user_id());

  return jsonb_build_object('email', v_email, 'audit_id', v_audit, 'name', v_name);
end $$;
revoke all on function app.ops_resend_verification_prepare(uuid, uuid) from public;
grant execute on function app.ops_resend_verification_prepare(uuid, uuid) to kaname_app;
