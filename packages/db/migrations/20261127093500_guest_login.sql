-- K-875 ゲストとしてログインする（D-128.46・D-155.35・D-155.37・D-155.48）
--   ① app.session_role(session_id)：そのセッションの人が、セッションの会社で役割 requester の所属（消していない・状態は問わない）を
--      持てば 'client'、そうでなければ 'member'。画面のログインの解決（packages/auth の createSessionResolver）が今の 1 本の文の列で読む
--      （文は増やさない・K-233）。役割はセッションに持たず毎回その時の所属から引く（外した直後から効く・G-14）
--   ② app.guest_me()：ゲストの文脈（role client）で、自分の 1 行（表示名・role_id 'requester'）を返す。社内の表（members）はゲストの
--      文脈では読めない（K-878 の柵）ので security definer の中で自分の行だけを読む。ゲストでなければ null。
--      app.is_guest_member()（K-878・20261127093800）を呼ぶ。plpgsql なので作る時は通り、呼ぶ時に揃っていればよい
--   どちらも PUBLIC から外し、アプリの接続（kaname_app）にだけ渡す

create or replace function app.session_role(p_session uuid) returns text
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
begin
  if exists (
    select 1
      from sessions s
      join tenant_memberships tm on tm.tenant_id = s.tenant_id and tm.member_id = s.member_id
     where s.id = p_session and tm.role = 'requester' and tm.deleted_at is null
  ) then
    return 'client';
  end if;
  return 'member';
end $$;
revoke all on function app.session_role(uuid) from public;
grant execute on function app.session_role(uuid) to kaname_app;

create or replace function app.guest_me() returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare v_name text;
begin
  if not coalesce(app.is_guest_member(), false) then return null; end if;
  select m.display_name into v_name
    from members m
   where m.id = app.user_id() and m.tenant_id = app.tenant_id() and m.deleted_at is null;
  return jsonb_build_object('display_name', v_name, 'role_id', 'requester');
end $$;
revoke all on function app.guest_me() from public;
grant execute on function app.guest_me() to kaname_app;
