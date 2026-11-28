-- 0069 テストで動かす（T-U-11・D-028・D-116.4）。
--   AI社員の実行（action_runs）に「誰が・どの担当業務を・テストか本番か・どの Bridge の仕事で」を持たせ、はじめの設定の 5 段目が読む形（AI社員ごとの最新の実行と、出てきた成果物）を 1 回で返す。
--   実際に AI社員を動かす結線（実行ループ）は T-I-01。ここは記録の形と、人が「この仕事はやめる」を選ぶ口まで。
--   ER図：action_runs.mode_id（テストモードは外に出ない・D-028.2）
alter table action_runs add column if not exists ai_employee_id uuid references ai_employees(id);
alter table action_runs add column if not exists duty_id uuid references duties(id);
alter table action_runs add column if not exists mode_id text check (mode_id in ('test', 'live'));
alter table action_runs add column if not exists bridge_job_id uuid references bridge_jobs(id);
create index if not exists action_runs_ai_employee_id_idx on action_runs (ai_employee_id);
create index if not exists action_runs_bridge_job_id_idx on action_runs (bridge_job_id);

-- 5 テスト の画面が読むもの：AI社員ごと（名前・試す仕事・最新のテストの実行）、出てきたもの（テストの実行から渡された成果物）、本番に切り替えられるか
--   切り替えられる＝AI社員が 1 体以上いて、全員が 完了（1 回以上）か「この仕事はやめる」を選んだ。止まった・実行中がいる間は押せない（D-116.4）
create or replace function app.onboard_testrun(p_member uuid) returns jsonb
language sql stable security definer set search_path = public, app as $$
  with me as (select tenant_id from members where id = p_member and deleted_at is null),
  rows as (
    select a.id as employee_id, coalesce(m.display_name, '') as name, d.id as duty_id, coalesce(d.name, '') as duty, a.created_at,
           (select jsonb_build_object('id', r.id, 'status', r.status_id, 'reason', r.error_summary, 'finished_at', r.finished_at,
                                      'count', (select count(*) from action_runs x where x.ai_employee_id = a.id and x.mode_id = 'test' and x.status_id = 'done' and x.deleted_at is null))
              from action_runs r where r.ai_employee_id = a.id and r.mode_id = 'test' and r.deleted_at is null
             order by r.created_at desc limit 1) as run
      from ai_employees a join me on me.tenant_id = a.tenant_id
      left join members m on m.id = a.member_id
      left join lateral (select x.id, x.name from duties x where x.ai_employee_id = a.id and x.deleted_at is null order by x.created_at limit 1) d on true
     where a.deleted_at is null)
  select jsonb_build_object(
    'employees', coalesce((select jsonb_agg((to_jsonb(rows) - 'created_at') order by rows.created_at) from rows), '[]'::jsonb),
    'outputs', coalesce((
      select jsonb_agg(jsonb_build_object('id', ar.id, 'title', ar.title, 'format', ar.format_id, 'at', ar.created_at,
                                          'employee', coalesce(m2.display_name, '')) order by ar.created_at desc)
        from artifacts ar join me on me.tenant_id = ar.tenant_id
        join action_runs r on r.bridge_job_id = ar.source_job_id and r.mode_id = 'test' and r.deleted_at is null
        left join ai_employees a2 on a2.id = r.ai_employee_id left join members m2 on m2.id = a2.member_id
       where ar.deleted_at is null), '[]'::jsonb),
    'ready', coalesce((select count(*) > 0 and bool_and(run is not null and (run->>'status') in ('done', 'cancelled')) from rows), false)
  )
$$;
grant execute on function app.onboard_testrun(uuid) to kaname_app;

-- 「この仕事はやめる」：止まった（CAPTCHA 等）・実行中のテストの実行を、本人の会社の分だけ やめた にする。証跡に残す
create or replace function app.testrun_cancel(p_member uuid, p_run uuid) returns boolean
language plpgsql security definer set search_path = public, app as $$
declare v_tenant uuid; r action_runs%rowtype;
begin
  select tenant_id into v_tenant from members where id = p_member and deleted_at is null;
  if v_tenant is null then return false; end if;
  update action_runs set status_id = 'cancelled', finished_at = coalesce(finished_at, now()), updated_by = p_member
   where id = p_run and tenant_id = v_tenant and mode_id = 'test' and status_id in ('stopped', 'running') and deleted_at is null
   returning * into r;
  if r.id is null then return false; end if;
  insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
    values (v_tenant, p_member, 'member', 'testrun.cancelled', 'action_runs', r.id::text, 'C2',
            jsonb_build_object('ai_employee_id', r.ai_employee_id, 'duty_id', r.duty_id, 'reason', left(coalesce(r.error_summary, ''), 200)), p_member);
  return true;
end $$;
grant execute on function app.testrun_cancel(uuid, uuid) to kaname_app;
