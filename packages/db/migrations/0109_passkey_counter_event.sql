-- 0109 パスキーの署名の回数が戻った応答（写されたパスキーの疑い）を、本人の今いる会社の security_events に残す（K-304・関門 C2）。
--   ログインの前の出来事なので、ログインの記録の関数 app.record_login_event（0107）が受ける種類に passkey_counter_rollback を 1 つ足す。
--   会社の引き方・ip_region（国だけ）・detail（空。credential id を入れない）は 0107 のまま変えない（関数の本体は 0107 と同じで、種類の一覧だけが違う）。
--   呼ぶのは packages/auth/src/passkey.ts の見張り（部品の verify-authentication の前）だけ。
create or replace function app.record_login_event(p_auth_user_id text, p_kind text, p_ip_region text) returns int
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_n int;
begin
  if p_kind not in ('login_succeeded', 'login_failed', 'login_locked', 'login_code_failed', 'login_code_locked',
                    'passkey_counter_rollback') then
    raise exception 'ログインの記録の種類でない: %', p_kind using errcode = 'invalid_parameter_value';
  end if;
  if p_auth_user_id is null then return 0; end if;
  insert into security_events (tenant_id, kind_id, member_id, ip_region, detail)
    select m.tenant_id, p_kind, m.id, left(p_ip_region, 8), '{}'::jsonb
      from members m
     where m.deleted_at is null
       and (m.auth_user_id = p_auth_user_id   -- 会社を作った人・招待で入った人
            or exists (select 1 from tenant_memberships tb   -- 同じログインで別の会社にも入った人（D-125.150・0089 と同じ引き方）
                       where tb.tenant_id = m.tenant_id and tb.member_id = m.id and tb.auth_user_id = p_auth_user_id))
       and not exists (select 1 from tenant_memberships tm
                       where tm.tenant_id = m.tenant_id and tm.member_id = m.id
                         and (tm.status in ('left', 'invited') or tm.deleted_at is not null));
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function app.record_login_event(text, text, text) from public;
grant execute on function app.record_login_event(text, text, text) to kaname_app;

insert into app.schema_migrations (name) values ('0109_passkey_counter_event.sql') on conflict do nothing;
