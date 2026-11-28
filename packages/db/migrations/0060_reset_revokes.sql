-- 0060 パスワードを再設定（メールのリンクで入り直す）したら、その人の端末（画面・Bridge）を全部失効させる（G-14・2026-10-01 QA）。
-- 変更（今のパスワードを入れて変える）は revoke_all_sessions を呼んでいたが、再設定の流れには無く、古い鍵と Bridge が生きたままだった。
-- 再設定の時点では会社の文脈が無いので、認証の利用者 id から自分の行を引く security definer にする。
create or replace function app.revoke_sessions_for_auth_user(p_auth_user_id text, p_reason text) returns int
language plpgsql security definer set search_path = public, app as $$
declare n int := 0; r record;
begin
  for r in select id from members where auth_user_id = p_auth_user_id loop
    n := n + app.revoke_all_sessions(r.id, p_reason);
  end loop;
  return n;
end $$;
revoke all on function app.revoke_sessions_for_auth_user(text, text) from public;
grant execute on function app.revoke_sessions_for_auth_user(text, text) to kaname_app, kaname_auth;
