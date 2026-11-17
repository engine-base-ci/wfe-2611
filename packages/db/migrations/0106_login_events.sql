-- K-301 ログインの記録（成功・失敗・ロック）を、その人が入っている会社ごとの security_events に残す。
--   ログインの前は会社の文脈が無く、members は行の守りの中なので、kaname_app からは本人の会社を引けない。
--   そこで認証の本人の id（members.auth_user_id）から会社の人を引いて書く関数を 1 本足す（security definer）。
--   本人がどの会社にもいなければ（登録していない・会社から抜けた）何も書かず 0 を返す。
--   種類はログインの 5 つだけ受ける（login_succeeded・login_failed・login_locked。6 けたの段の login_code_failed・login_code_locked は K-302）。
--   ip_region は国だけ（x-vercel-ip-country）。IP そのもの・メール・パスワードは入れない（detail は空）
create or replace function app.record_login_event(p_auth_user_id text, p_kind text, p_ip_region text) returns int
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_n int;
begin
  if p_kind not in ('login_succeeded', 'login_failed', 'login_locked', 'login_code_failed', 'login_code_locked') then
    raise exception 'ログインの記録の種類でない: %', p_kind using errcode = 'invalid_parameter_value';
  end if;
  if p_auth_user_id is null then return 0; end if;
  insert into security_events (tenant_id, kind_id, member_id, ip_region, detail)
    select m.tenant_id, p_kind, m.id, left(p_ip_region, 8), '{}'::jsonb
      from members m
     where m.auth_user_id = p_auth_user_id and m.deleted_at is null;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function app.record_login_event(text, text, text) from public;
grant execute on function app.record_login_event(text, text, text) to kaname_app;

insert into app.schema_migrations (name) values ('0106_login_events.sql') on conflict do nothing;
