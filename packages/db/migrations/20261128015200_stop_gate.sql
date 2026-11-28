-- K-1012 止めた会社の入口（D-156.23・D-125.126）：止めた会社の PC には新しい仕事を渡さず、動いている仕事は次の止める合図で止める。
--   止めているかの決めは K-970 の app.tenant_stopped（止めた時刻か、止める日が今日〔日本〕以前）の 1 か所。ここはそれを PC のセッションから引くだけ。
--   PC の口（apps/api/src/features/F5/delegate/bridge.ts の takeBridgeJob・getJobControl）が PC のセッションの id で呼ぶ。
--   セッションが無い・PC のセッションでなければ false（止めない。無い PC は口の側が 401 にする）。
--   会社の人の入口（op.ts）は app.tenant_stopped(app.tenant_id()) を直に呼ぶ（K-970 が kaname_app に渡す）
create or replace function app.bridge_tenant_stopped(p_session uuid) returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select coalesce(
    (select app.tenant_stopped(s.tenant_id) from sessions s where s.id = p_session and s.kind_id = 'bridge'),
    false
  )
$$;
revoke execute on function app.bridge_tenant_stopped(uuid) from public;
grant execute on function app.bridge_tenant_stopped(uuid) to kaname_app;
