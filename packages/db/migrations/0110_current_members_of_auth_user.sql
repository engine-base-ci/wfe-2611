-- 0110 記録の関数の「今いる会社の人」を引く部分を 1 つにまとめる（K-302・PM の決め 2026-11-18・関門 C2）
--   0106（app.record_security_event_for_auth_user・K-313）と 0107（app.record_login_event・K-301）が同じ引き方を別々に持っていた。
--   内部の関数 app.current_members_of_auth_user に切り出し、2 つの記録の関数はそれを呼ぶ。振る舞いは変えない。
--   今いる会社の人：members に本人が居て（members.auth_user_id か、所属の行 tenant_memberships.auth_user_id・D-125.150・0089 と同じ引き方）消えていない、
--   かつ同じ会社・同じ人の所属が抜けた（left）・招待中（invited）・消した（deleted_at）でない。会社を作った人は所属の行を持たないので members で見る
--   （形は app.ticket_member_ok・0090 と同じ not exists の書き方）。抜けた会社・招待中の会社の管理者に記録を見せない。
--   内部の関数は誰にも execute を渡さない（行の守りの外の members を読むので、呼べるのは security definer の記録の関数の中だけ）
create or replace function app.current_members_of_auth_user(p_auth_user_id text)
returns table (tenant_id uuid, member_id uuid)
language sql stable set search_path = public, app, pg_temp as $$
  select m.tenant_id, m.id
    from members m
   where p_auth_user_id is not null
     and m.deleted_at is null
     and (m.auth_user_id = p_auth_user_id   -- 会社を作った人・招待で入った人
          or exists (select 1 from tenant_memberships tb   -- 同じログインで別の会社にも入った人
                     where tb.tenant_id = m.tenant_id and tb.member_id = m.id and tb.auth_user_id = p_auth_user_id))
     and not exists (select 1 from tenant_memberships tm
                     where tm.tenant_id = m.tenant_id and tm.member_id = m.id
                       and (tm.status in ('left', 'invited') or tm.deleted_at is not null))
$$;
revoke all on function app.current_members_of_auth_user(text) from public;

-- 再設定の記録（0106 と同じ振る舞い：書けるのは再設定の 2 つの出来事だけ・止められた会社・人には書く）
create or replace function app.record_security_event_for_auth_user(p_auth_user_id text, p_kind text, p_detail jsonb default '{}'::jsonb)
returns int
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_n int;
begin
  if p_kind not in ('password_reset_requested', 'password_reset_done') then
    raise exception '再設定の出来事でない: %', p_kind using errcode = 'insufficient_privilege';
  end if;
  insert into security_events (tenant_id, kind_id, member_id, detail)
  select c.tenant_id, p_kind, c.member_id, coalesce(p_detail, '{}'::jsonb)
    from app.current_members_of_auth_user(p_auth_user_id) c;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function app.record_security_event_for_auth_user(text, text, jsonb) from public;
grant execute on function app.record_security_event_for_auth_user(text, text, jsonb) to kaname_app, kaname_auth;

-- ログインの記録（0107 と同じ振る舞い：種類はログインの 5 つだけ・国だけ・detail は空・本人がどの会社にもいなければ 0）
create or replace function app.record_login_event(p_auth_user_id text, p_kind text, p_ip_region text) returns int
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_n int;
begin
  if p_kind not in ('login_succeeded', 'login_failed', 'login_locked', 'login_code_failed', 'login_code_locked') then
    raise exception 'ログインの記録の種類でない: %', p_kind using errcode = 'invalid_parameter_value';
  end if;
  if p_auth_user_id is null then return 0; end if;
  insert into security_events (tenant_id, kind_id, member_id, ip_region, detail)
  select c.tenant_id, p_kind, c.member_id, left(p_ip_region, 8), '{}'::jsonb
    from app.current_members_of_auth_user(p_auth_user_id) c;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function app.record_login_event(text, text, text) from public;
grant execute on function app.record_login_event(text, text, text) to kaname_app;

insert into app.schema_migrations (name) values ('0110_current_members_of_auth_user.sql') on conflict do nothing;
