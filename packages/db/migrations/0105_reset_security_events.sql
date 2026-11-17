-- 0105 再設定を頼んだ・再設定した を本人の今いる会社に残す（K-313・K-314・関門 C2）
--   再設定の口は誰でも呼べる（ログインしていない）ので、要求の文脈（app.tenant_id）が無い。認証の本人の id から、
--   その人が今いる会社ごとに security_events を 1 行ずつ書き、書いた数を返す。
--   今いる会社：members に本人が居て（members.auth_user_id か、所属の行の auth_user_id）消えていない、かつ同じ会社・同じ人の所属（tenant_memberships）が
--   抜けた（left）・招待中（invited）・消した（deleted_at）でない会社。会社を作った人は所属の行を持たないので members で見る
--   （形は app.ticket_member_ok・0090 と同じ not exists の書き方）。抜けた会社・招待中の会社には書かない（前の会社の管理者に見せない）。
--   止められた会社・人には書く（本人の記録として残す）。detail にメール・リンクの手がかりを入れるのは呼ぶ側の誤り（呼ぶ側の試験が見る）
create or replace function app.record_security_event_for_auth_user(p_auth_user_id text, p_kind text, p_detail jsonb default '{}'::jsonb)
returns int
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_n int;
begin
  -- 書けるのは再設定の 2 つの出来事だけ（誰でも呼べる口の後ろなので、ほかの出来事を書かせない）
  if p_kind not in ('password_reset_requested', 'password_reset_done') then
    raise exception '再設定の出来事でない: %', p_kind using errcode = 'insufficient_privilege';
  end if;
  insert into security_events (tenant_id, kind_id, member_id, detail)
  select m.tenant_id, p_kind, m.id, coalesce(p_detail, '{}'::jsonb)
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
revoke all on function app.record_security_event_for_auth_user(text, text, jsonb) from public;
grant execute on function app.record_security_event_for_auth_user(text, text, jsonb) to kaname_app, kaname_auth;

insert into app.schema_migrations (name) values ('0105_reset_security_events.sql') on conflict do nothing;
