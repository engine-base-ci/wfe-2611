-- 20261128012900_ops_plans_impact 値段を変える案の影響を見る（K-989・関門 C2・D-128.72・D-156.12・D-156.17・D-156.49・D-156.51）
--   ① app.plan_existing_from(policy, days, immediate, from)：いまの顧客が新しい値段になる月の 1 日（式はここ 1 か所。K-990 が決めるとき、K-1017 が請求に効かせるときも呼ぶ）
--      keep → null（いまの顧客は前の版のまま）／immediate → from の次の月の 1 日／after_days → from + days 日以後で最初の月の 1 日（その日が 1 日ならその月）
--   ② app.ops_plan_impact(id)：案 1 つの影響（7 欄）。運営の関数の型（ops_require → 値段の印 ops_plan_caps_ok）。読むだけで記録は書かない
--      いまの顧客＝顧客のワークスペース（消していない・作りかけでない・運営の会社でない）のうち app.tenant_plan_id が案のプランの物（止めている会社も数える）
--      止めている＝app.tenant_stopped（K-970 の 1 か所）・人数＝app.tenant_seat_count（K-961 の 1 か所）。式を自分で書かない
--      すぐ効く（immediate）＝案の値段が今以下で、人数が今以上（値下げ・中身を増やすだけ）
--      月の売上の差＝変わる月が null なら 0。ほかは止めていないいまの顧客の数 ×（案の値段 − 今の値段）（税別の円・人数で掛けない＝D-156.31）
--      変わる月の起点は日本の今日。決めた案は決めた日（日本）
--   どちらも search_path に pg_temp。ops_plan_impact は public から外し、アプリの接続（kaname_app）にだけ渡す（D-128.171）

create or replace function app.plan_existing_from(p_policy text, p_days int, p_immediate boolean, p_from date) returns date
language sql immutable set search_path = public, app, pg_temp as $$
  select case
    when p_from is null or p_policy = 'keep' then null
    when coalesce(p_immediate, false) then (date_trunc('month', p_from) + interval '1 month')::date
    when extract(day from p_from + coalesce(p_days, 0)) = 1 then p_from + coalesce(p_days, 0)
    else (date_trunc('month', p_from + coalesce(p_days, 0)) + interval '1 month')::date
  end
$$;
grant execute on function app.plan_existing_from(text, int, boolean, date) to kaname_app;

create or replace function app.ops_plan_impact(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_plan_id uuid;
  v_changes jsonb;
  v_policy text;
  v_days int;
  v_new_from date;
  v_state text;
  v_decided_at timestamptz;
  v_now_price bigint;
  v_now_members int;
  v_after_price bigint;
  v_after_members int;
  v_immediate boolean;
  v_from date;
  v_month date;
  v_month_text text;
  v_customers int;
  v_stopped int;
  v_rows jsonb;
begin
  perform app.ops_require('any');
  perform app.ops_plan_caps_ok();
  select p.plan_id, p.changes, p.existing_policy, p.notice_days, p.new_from, p.state, p.decided_at
    into v_plan_id, v_changes, v_policy, v_days, v_new_from, v_state, v_decided_at
    from ops_plan_proposals p
   where p.id = p_id and p.deleted_at is null and p.tenant_id = app.ops_tenant_id();
  if v_plan_id is null then
    raise exception '案が無い' using errcode = 'no_data_found';
  end if;
  select coalesce(pl.price_monthly, 0)::bigint, coalesce((pl.limits->>'members')::int, 0)
    into v_now_price, v_now_members
    from plans pl where pl.id = v_plan_id;
  v_after_price := coalesce((v_changes->>'price_monthly')::bigint, v_now_price);
  v_after_members := coalesce((v_changes->>'member_limit')::int, v_now_members);
  v_immediate := v_after_price <= v_now_price and v_after_members >= v_now_members;
  v_from := case when v_state = 'decided' and v_decided_at is not null
                 then (v_decided_at at time zone 'Asia/Tokyo')::date
                 else (now() at time zone 'Asia/Tokyo')::date end;
  v_month := app.plan_existing_from(v_policy, v_days, v_immediate, v_from);
  v_month_text := to_char(v_month, 'YYYY-MM');

  with c as (
    select t.id, t.name, app.tenant_stopped(t.id) as stopped, app.tenant_seat_count(t.id) as members
      from tenants t
     where t.deleted_at is null and t.half_made_at is null and t.id <> app.ops_tenant_id()
       and app.tenant_plan_id(t.id) = v_plan_id
  )
  select count(*)::int,
         count(*) filter (where c.stopped)::int,
         coalesce(jsonb_agg(jsonb_build_object(
           'workspace', jsonb_build_object('id', c.id, 'name', c.name),
           'members', c.members,
           'now_price', v_now_price,
           'after_price', case when c.stopped then null else v_after_price end,
           'from_month', case when c.stopped then null else v_month_text end,
           'stopped', c.stopped) order by c.name, c.id), '[]'::jsonb)
    into v_customers, v_stopped, v_rows
    from c;

  return jsonb_build_object(
    'customers', v_customers,
    'stopped', v_stopped,
    'monthly_revenue_diff', case when v_month is null then 0
                                 else (v_customers - v_stopped)::bigint * (v_after_price - v_now_price) end,
    'immediate', v_immediate,
    'existing_from', v_month_text,
    'new_from', v_new_from,
    'by_workspace', v_rows);
end $$;
revoke all on function app.ops_plan_impact(uuid) from public;
grant execute on function app.ops_plan_impact(uuid) to kaname_app;
