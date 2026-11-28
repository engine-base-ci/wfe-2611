-- 20261120215500_runs_view_real_runs_only 実行の 1 件・一覧は「AI に任せた実行」だけを返す（K-429・関門 C2・読むだけ）
--   実行の行を作る 4 つの道（任せる 0092・承認 0096・差し戻し 0097・完了 0100）はどれも phase と status_id を入れる。
--   phase か status_id が空の行は実行ではない（種が作る生の行）ので、契約（phase・status は文字）を破る答えにせず、読む関数が外す
create or replace function app.action_run_view(p_run uuid) returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  select app.action_run_json(r.id) from action_runs r
   where r.id = p_run and r.ticket_id is not null and r.deleted_at is null
     and r.phase is not null and r.status_id is not null
     and app.member_ok() and r.tenant_id = app.tenant_id() and app.ticket_visible(r.ticket_id)
     and exists (select 1 from tickets t where t.id = r.ticket_id and t.deleted_at is null)
$$;
revoke all on function app.action_run_view(uuid) from public;
grant execute on function app.action_run_view(uuid) to kaname_app;

create or replace function app.ticket_runs_view(p_ticket uuid) returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  select case when app.member_ok() and app.ticket_visible(p_ticket)
                   and exists (select 1 from tickets t where t.id = p_ticket and t.deleted_at is null) then
    jsonb_build_object(
      'data', coalesce((select jsonb_agg(app.action_run_json(x.id) order by x.created_at desc, x.id desc)
                          from (select r.id, r.created_at from action_runs r
                                 where r.ticket_id = p_ticket and r.deleted_at is null
                                   and r.phase is not null and r.status_id is not null
                                 order by r.created_at desc, r.id desc limit 50) x), '[]'::jsonb),
      'total', (select count(*) from action_runs r
                 where r.ticket_id = p_ticket and r.deleted_at is null
                   and r.phase is not null and r.status_id is not null))
  end
$$;
revoke all on function app.ticket_runs_view(uuid) from public;
grant execute on function app.ticket_runs_view(uuid) to kaname_app;
