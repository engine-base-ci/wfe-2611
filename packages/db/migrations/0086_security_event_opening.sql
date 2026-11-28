-- 0086 落ち始めの 1 件を見分ける（K-51・D-128.146）
--   漏れたパスワードの照合のサービスが落ちている間、登録は止めずに、毎回 security_events に pwned_check_unavailable を残す。
--   運営へのメールは「落ち始めの 1 通」だけ：まだ運営が「確かめた」にしていない同じ出来事が他に無いときだけ送る。
--   security_events は追記専用（0003：更新・削除は誰にもできない）なので、行に「確かめた」の印は付けられない。
--   「確かめた」も同じ表への追記（kind_id = 確かめた出来事の名前。照合なら pwned_check_acknowledged）で持つ。
--   最後の「確かめた」より後に起きた出来事が、まだ確かめていないもの。運営の画面とボタン（確かめたを追記する）は F12（K-72）で作る。
--   時間で動く仕組み（間引きのタイマー・定期の処理）は使わない
create or replace function app.record_security_event_opening(p_tenant uuid, p_kind text, p_ack_kind text, p_detail jsonb default '{}'::jsonb)
returns boolean   -- true：確かめた後の最初の 1 件（落ち始め）。呼んだ側はこのときだけ運営に知らせる
language plpgsql security definer set search_path = public, app as $$
declare v_last_ack timestamptz; v_open int;
begin
  -- 同時に来た 2 件がどちらも「最初」にならないように、同じ会社・同じ出来事の中で順番に並べる
  perform pg_advisory_xact_lock(hashtext('security_event_opening:' || p_tenant::text || ':' || p_kind));
  select max(occurred_at) into v_last_ack from security_events where tenant_id = p_tenant and kind_id = p_ack_kind;
  select count(*) into v_open from security_events
    where tenant_id = p_tenant and kind_id = p_kind and (v_last_ack is null or occurred_at > v_last_ack);
  insert into security_events (tenant_id, kind_id, detail) values (p_tenant, p_kind, coalesce(p_detail, '{}'::jsonb));
  return v_open = 0;
end $$;
revoke all on function app.record_security_event_opening(uuid, text, text, jsonb) from public;
grant execute on function app.record_security_event_opening(uuid, text, text, jsonb) to kaname_app;

insert into app.schema_migrations (name) values ('0086_security_event_opening.sql') on conflict do nothing;
