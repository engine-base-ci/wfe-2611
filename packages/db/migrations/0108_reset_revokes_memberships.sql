-- 0108 再設定（パスワードの変更）で、同じログインで 2 社目に入った人の端末も切る（K-314・D-125.140・D-128.121）。
--   0060 の app.revoke_sessions_for_auth_user は members.auth_user_id の人だけを見ていた。members.auth_user_id は一意なので、
--   同じ人の 2 社目の行は所属の行（tenant_memberships.auth_user_id）でしか結べず（0089 と同じ引き方）、2 社目の画面と PC が生きたままだった。
--   切るのは安全な側：抜けた（left）・招待中・消した所属の会社にある端末も切る（記録は 0106 の関数が今いる会社にだけ書く）
create or replace function app.revoke_sessions_for_auth_user(p_auth_user_id text, p_reason text) returns int
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare n int := 0; r record;
begin
  for r in
    select m.id from members m
    where m.auth_user_id = p_auth_user_id
       or exists (select 1 from tenant_memberships tm
                  where tm.tenant_id = m.tenant_id and tm.member_id = m.id and tm.auth_user_id = p_auth_user_id)
  loop
    n := n + app.revoke_all_sessions(r.id, p_reason);
  end loop;
  return n;
end $$;
revoke all on function app.revoke_sessions_for_auth_user(text, text) from public;
grant execute on function app.revoke_sessions_for_auth_user(text, text) to kaname_app, kaname_auth;

insert into app.schema_migrations (name) values ('0108_reset_revokes_memberships.sql') on conflict do nothing;
