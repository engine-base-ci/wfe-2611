-- 0116 パスワードを変えた・決めたの記録を、その人の全部のワークスペース（今いる会社）に残す（K-312・D-128.141・D-125.150・関門 C2）
--   app.record_security_event_for_auth_user（0106・0111）は書ける出来事を再設定の 2 つに絞っていた。変える口（changePassword）の
--   password_changed と、決める口（setMyPassword）の password_set を足す。会社の引き方（今いる会社＝抜けた・招待中・消した所属の会社には
--   書かない・所属の行 tenant_memberships.auth_user_id で入った会社も引く）は 0111 の app.current_members_of_auth_user のまま変えない。
--   中身（detail）は呼ぶ側が渡す空の形だけ（パスワードを入れない）
create or replace function app.record_security_event_for_auth_user(p_auth_user_id text, p_kind text, p_detail jsonb default '{}'::jsonb)
returns int
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_n int;
begin
  if p_kind not in ('password_reset_requested', 'password_reset_done', 'password_changed', 'password_set') then
    raise exception 'パスワードの出来事でない: %', p_kind using errcode = 'insufficient_privilege';
  end if;
  insert into security_events (tenant_id, kind_id, member_id, detail)
  select c.tenant_id, p_kind, c.member_id, coalesce(p_detail, '{}'::jsonb)
    from app.current_members_of_auth_user(p_auth_user_id) c;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function app.record_security_event_for_auth_user(text, text, jsonb) from public;
grant execute on function app.record_security_event_for_auth_user(text, text, jsonb) to kaname_app, kaname_auth;

insert into app.schema_migrations (name) values ('0116_password_change_events.sql') on conflict do nothing;
