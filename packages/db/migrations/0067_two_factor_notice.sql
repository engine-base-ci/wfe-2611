-- 0067 2 段階のコード・承認を本人に頼むとき、メールでも知らせる（D-117.3 の「承認待ち・通知」・関門 C6）。
--   Bridge の鍵から本人のメールアドレスを引く（本人の端末・生きている鍵のときだけ）。読む先の kaname_auth."user" は認証の表（同じ DB）
create or replace function app.bridge_session_email(p_session uuid) returns text
language plpgsql security definer set search_path = public, app as $$
declare v text;
begin
  execute 'select u.email from sessions s join members m on m.id = s.member_id join kaname_auth."user" u on u.id = m.auth_user_id '
       || 'where s.id = $1 and s.kind_id = ''bridge'' and s.revoked_at is null and m.deleted_at is null'
    into v using p_session;
  return v;
end $$;
grant execute on function app.bridge_session_email(uuid) to kaname_app;
