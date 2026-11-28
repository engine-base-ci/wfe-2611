-- 20261125021900_approval_check_summary 承認の一覧・詳細・実行の 1 件の「確認」を確認項目から出す（K-739・関門 C2・読むだけ・D-153.3・D-150.39・D-150.40・D-128.138）
--   列も表も足さない。読むのはそのチケットの確認項目（test_specs・消していない行）だけ。
--   見せ方は数だけ：「4 ／ 5 済み」（確認項目が無ければ「検査なし」）。済み＝checked_at が入っている行（付けたのが AI でも人でも同じ）。
--   行は id・文・済みかの 3 つだけで、だれが・いつ・AI の根拠は答えのどこにも出さない（やり取りの記録の行に在る＝K-736）。
--   段 9 の K-405 が作り直す app.approval_item_json・app.approval_detail・app.approval_queue と、0092 の app.action_run_json は触らない：
--   新しい関数がその答えを包み、check_summary・checks の値だけを差し替える（口の 1 つの文の中・文の数は増えない）。

-- ① 確認の数と行（見えないチケットは null）
create or replace function app.approval_check_summary(p_ticket uuid, p_rows boolean default true) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_total integer;
  v_done integer;
  v_out jsonb;
begin
  if p_ticket is null or not app.member_ok() then
    return null;
  end if;
  if not exists (select 1 from tickets t where t.id = p_ticket and t.tenant_id = v_tenant and t.deleted_at is null) then
    return null;
  end if;
  if not app.ticket_visible(p_ticket) then
    return null;
  end if;
  select count(*)::integer, count(s.checked_at)::integer into v_total, v_done
    from test_specs s
   where s.ticket_id = p_ticket and s.tenant_id = v_tenant and s.deleted_at is null;
  v_out := jsonb_build_object(
    'state', case when v_total = 0 then 'none' when v_done = v_total then 'all' else 'partial' end,
    'counts', jsonb_build_object('done', v_done, 'total', v_total),
    'summary', case when v_total = 0 then '検査なし' else v_done::text || ' ／ ' || v_total::text || ' 済み' end);
  if p_rows then
    v_out := v_out || jsonb_build_object('rows', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'text', s.title, 'checked', s.checked_at is not null)
                       order by s.created_at, s.id)
        from test_specs s
       where s.ticket_id = p_ticket and s.tenant_id = v_tenant and s.deleted_at is null), '[]'::jsonb));
  end if;
  return v_out;
end
$$;
revoke all on function app.approval_check_summary(uuid, boolean) from public;
grant execute on function app.approval_check_summary(uuid, boolean) to kaname_app;

-- ⑥（中だけ）字の id を uuid に。uuid の形でなければ null
create or replace function app.approval_checks_uuid(p_text text) returns uuid
language sql immutable set search_path = public, app, pg_temp as $$
  select case when p_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then p_text::uuid end
$$;
revoke all on function app.approval_checks_uuid(text) from public;

-- ② 一覧の差し込み：kind が artifact の行だけ check_summary を数の字に（見えない・無いチケットの行と渡しの行は元のまま）
create or replace function app.approval_checks_overlay(p_items jsonb) returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  select case when p_items is null or jsonb_typeof(p_items) <> 'array' then p_items
    else coalesce((
      select jsonb_agg(case when c.summary is null then x.v else x.v || jsonb_build_object('check_summary', c.summary) end
                       order by x.n)
        from jsonb_array_elements(p_items) with ordinality as x(v, n)
        left join lateral (
          select app.approval_check_summary(app.approval_checks_uuid(x.v->>'ticket_id'), false)->>'summary' as summary
           where x.v->>'kind' = 'artifact') c on true), '[]'::jsonb)
  end
$$;
revoke all on function app.approval_checks_overlay(jsonb) from public;
grant execute on function app.approval_checks_overlay(jsonb) to kaname_app;

-- ③ 詳細の差し込み：checks を行に・check_summary を数の字に（null・見えないチケットは元のまま）
create or replace function app.approval_detail_checks(p_detail jsonb) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_sum jsonb;
begin
  if p_detail is null or jsonb_typeof(p_detail) <> 'object' then
    return p_detail;
  end if;
  v_sum := app.approval_check_summary(app.approval_checks_uuid(p_detail->'ticket'->>'id'), true);
  if v_sum is null then
    return p_detail;
  end if;
  return p_detail || jsonb_build_object('checks', v_sum->'rows', 'check_summary', v_sum->>'summary');
end
$$;
revoke all on function app.approval_detail_checks(jsonb) from public;
grant execute on function app.approval_detail_checks(jsonb) to kaname_app;

-- ④ 実行の 1 件・一覧（20261120215500 を写して checks だけを差し替える。見える・消した・phase と状態が空の行を外す決め・件数・並びは前のまま）
create or replace function app.action_run_view(p_run uuid) returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  select case when c.s is null then x.v else x.v || jsonb_build_object('checks', c.s) end
    from (select app.action_run_json(r.id) as v, r.ticket_id from action_runs r
           where r.id = p_run and r.ticket_id is not null and r.deleted_at is null
             and r.phase is not null and r.status_id is not null
             and app.member_ok() and r.tenant_id = app.tenant_id() and app.ticket_visible(r.ticket_id)
             and exists (select 1 from tickets t where t.id = r.ticket_id and t.deleted_at is null)) x
    cross join lateral (select app.approval_check_summary(x.ticket_id, true) as s) c
$$;
revoke all on function app.action_run_view(uuid) from public;
grant execute on function app.action_run_view(uuid) to kaname_app;

create or replace function app.ticket_runs_view(p_ticket uuid) returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  select case when app.member_ok() and app.ticket_visible(p_ticket)
                   and exists (select 1 from tickets t where t.id = p_ticket and t.deleted_at is null) then
    jsonb_build_object(
      'data', coalesce((select jsonb_agg(case when c.s is null then app.action_run_json(x.id)
                                              else app.action_run_json(x.id) || jsonb_build_object('checks', c.s) end
                                         order by x.created_at desc, x.id desc)
                          from (select r.id, r.created_at from action_runs r
                                 where r.ticket_id = p_ticket and r.deleted_at is null
                                   and r.phase is not null and r.status_id is not null
                                 order by r.created_at desc, r.id desc limit 50) x
                          cross join (select app.approval_check_summary(p_ticket, false) as s) c), '[]'::jsonb),
      'total', (select count(*) from action_runs r
                 where r.ticket_id = p_ticket and r.deleted_at is null
                   and r.phase is not null and r.status_id is not null))
  end
$$;
revoke all on function app.ticket_runs_view(uuid) from public;
grant execute on function app.ticket_runs_view(uuid) to kaname_app;

-- ⑤ 頁の道（K-748 の app.approval_queue_page の答え { rows, more, counts }）の差し込み：rows に②を当てる（rows の無い答えはそのまま）
create or replace function app.approval_page_checks(p_page jsonb) returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  select case when p_page is null or jsonb_typeof(p_page) <> 'object' or jsonb_typeof(p_page->'rows') is distinct from 'array'
              then p_page
              else p_page || jsonb_build_object('rows', app.approval_checks_overlay(p_page->'rows')) end
$$;
revoke all on function app.approval_page_checks(jsonb) from public;
grant execute on function app.approval_page_checks(jsonb) to kaname_app;
