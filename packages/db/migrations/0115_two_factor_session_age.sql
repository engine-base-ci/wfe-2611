-- 0115 2 段階を付けたときに作り直したセッションの写しに、前のセッションの始まりの時刻を引き継ぐ（K-311・D-128.141・関門 C2）
--   部品（Better Auth）は 2 段階を付ける確かめのときに、新しいセッションを作って前のセッションを消す。新しい写し（public.sessions）は
--   app.open_session で issued_at = now() になり、最長の長さの判定（app.session_check の max_age・0083）が数え直しになる
--   （付けた操作でセッションの最長が延びる）。新しい行の issued_at を前の行の値にそろえる（遅くするだけ・早める側には動かさない）。
--   同じ人の行だけを結ぶ（前と後で member_id が同じ）。PUBLIC から外し、アプリの接続（kaname_app）にだけ渡す
create or replace function app.carry_session_age(p_new_auth_session_id text, p_old_auth_session_id text) returns int
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare n int;
begin
  if p_new_auth_session_id is null or p_old_auth_session_id is null or p_new_auth_session_id = p_old_auth_session_id then
    return 0;
  end if;
  update sessions s set issued_at = o.issued_at
    from sessions o
   where s.auth_session_id = p_new_auth_session_id
     and o.auth_session_id = p_old_auth_session_id
     and o.member_id = s.member_id
     and o.issued_at < s.issued_at;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function app.carry_session_age(text, text) from public;
grant execute on function app.carry_session_age(text, text) to kaname_app;

insert into app.schema_migrations (name) values ('0115_two_factor_session_age.sql') on conflict do nothing;
