-- 20261128032600 すぐ効くの判定と影響の今の値段を、いまの顧客が会社ごとに払っている版の値で決める（K-1157・関門 C2・D-128.72・D-156.12・D-156.17）
--   名前の時刻は K-1017 の 20261128032400_plan_terms.sql・K-1104 の 20261128032500_plan_trial.sql の後（K-1104 が作り直した
--   app.ops_plan_decide・app.ops_plans の上に、この葉が作り直す）
--   ① app.plan_version_terms(プラン, 版)：その版の { price_monthly, member_limit }。版の行の列（null なら snapshot の同じ名前の値）。
--      行が無ければプランの列（price_monthly を整数に丸める・limits の members。無ければ null＝上限なし・K-1017 の plan_terms と同じ）
--   ② app.plan_immediate(プラン, 元の版, 案の値段, 案の人数, 比べる日)：すぐ効くかの決め（影響と決めるが呼ぶ 1 か所）。
--      いまの顧客（K-989 の影響と同じ条件・止めている会社も入れる）の全部で、案の値段 ≤ その会社のその日の app.plan_terms の値段、
--      かつ案の人数 ≥ その member_limit（null＝上限なし。案の人数が null＝上限なしなら満たす。上限なしの会社には案も上限なしのときだけ満たす）。
--      1 社でも満たさなければ false。いまの顧客が居なければ元の版の値（①）と同じ比べ
--   ③ 読む所の置き換え（create or replace・ほかの式・断り・記録・答えの形は前の葉のまま）
--      app.ops_plan_impact（K-989）：immediate は ②。案の後の値は案に無ければ元の版の値。now_price は会社ごとの plan_terms。
--        比べる日は K-989 の v_from（決めた案は決めた日の日本の日付・ほかは今日）。決めた案は効いた後に開いても決めたときと同じ答え
--        月の売上の差は止めていない会社ごとの（案の値段 − その会社の now_price）の和
--      app.ops_plan_decide（K-1104 の版）：immediate は ②（比べる日は今日）。案の後の値・記録の from は元の版の値（①）
--      app.ops_plans（K-1104 の版）：値段・人数・facts の先頭の人数・並びの値段を今の版の値（①・人数が null なら前と同じ 0）に
--   ①② は public から外し、kaname_app に渡さない（運営の関数の中からだけ呼ぶ）。暦は日本（Asia/Tokyo）

-- ① 元の版の値
create or replace function app.plan_version_terms(p_plan uuid, p_version integer) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_price integer;
  v_limit integer;
  v_found boolean := false;
begin
  select coalesce(pv.price_monthly, (pv.snapshot->>'price_monthly')::integer),
         coalesce(pv.member_limit, (pv.snapshot->>'member_limit')::integer), true
    into v_price, v_limit, v_found
    from plan_versions pv
   where pv.plan_id = p_plan and pv.version = p_version
   limit 1;
  if coalesce(v_found, false) then
    return jsonb_build_object('price_monthly', v_price, 'member_limit', v_limit);
  end if;
  return (select jsonb_build_object('price_monthly', round(coalesce(pl.price_monthly, 0))::integer,
                                    'member_limit', (pl.limits->>'members')::integer)
            from plans pl where pl.id = p_plan);
end $$;
revoke all on function app.plan_version_terms(uuid, integer) from public;

-- ② すぐ効くかの決め（いまの顧客の会社ごとに比べる）
create or replace function app.plan_immediate(p_plan uuid, p_from_version integer, p_after_price integer, p_after_members integer,
                                              p_day date)
returns boolean
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_terms jsonb;
  v_price integer;
  v_limit integer;
  v_any boolean := false;
  r record;
begin
  for r in select t.id
             from tenants t
            where t.deleted_at is null and t.half_made_at is null and t.id <> app.ops_tenant_id()
              and app.tenant_plan_id(t.id) = p_plan loop
    v_any := true;
    v_terms := app.plan_terms(p_plan, r.id, p_day);
    v_price := coalesce((v_terms->>'price_monthly')::integer, 0);
    v_limit := (v_terms->>'member_limit')::integer;
    -- 案の値段 ≤ 今の値段、かつ案の人数 ≥ 今の上限（null＝上限なし：案も上限なしのときだけ満たす）
    if not (coalesce(p_after_price, 0) <= v_price
            and (p_after_members is null or (v_limit is not null and p_after_members >= v_limit))) then
      return false;
    end if;
  end loop;
  if v_any then
    return true;
  end if;
  -- いまの顧客が居ない：元の版の値と同じ比べ
  v_terms := app.plan_version_terms(p_plan, p_from_version);
  v_price := coalesce((v_terms->>'price_monthly')::integer, 0);
  v_limit := (v_terms->>'member_limit')::integer;
  return coalesce(p_after_price, 0) <= v_price
     and (p_after_members is null or (v_limit is not null and p_after_members >= v_limit));
end $$;
revoke all on function app.plan_immediate(uuid, integer, integer, integer, date) from public;

-- ③ 影響（K-989 の本体。今の値段・案の後の値・すぐ効く・月の売上の差の読む所だけを置き換える）
create or replace function app.ops_plan_impact(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_plan_id uuid;
  v_from_version integer;
  v_changes jsonb;
  v_policy text;
  v_days int;
  v_new_from date;
  v_state text;
  v_decided_at timestamptz;
  v_from_terms jsonb;
  v_after_price bigint;
  v_after_members int;
  v_immediate boolean;
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_from date;
  v_month date;
  v_month_text text;
  v_customers int;
  v_stopped int;
  v_diff bigint;
  v_rows jsonb;
begin
  perform app.ops_require('any');
  perform app.ops_plan_caps_ok();
  select p.plan_id, p.from_version, p.changes, p.existing_policy, p.notice_days, p.new_from, p.state, p.decided_at
    into v_plan_id, v_from_version, v_changes, v_policy, v_days, v_new_from, v_state, v_decided_at
    from ops_plan_proposals p
   where p.id = p_id and p.deleted_at is null and p.tenant_id = app.ops_tenant_id();
  if v_plan_id is null then
    raise exception '案が無い' using errcode = 'no_data_found';
  end if;
  v_from_terms := app.plan_version_terms(v_plan_id, v_from_version);
  v_after_price := coalesce((v_changes->>'price_monthly')::bigint, (v_from_terms->>'price_monthly')::bigint);
  v_after_members := coalesce((v_changes->>'member_limit')::int, (v_from_terms->>'member_limit')::int);
  v_from := case when v_state = 'decided' and v_decided_at is not null
                 then (v_decided_at at time zone 'Asia/Tokyo')::date
                 else v_today end;
  v_immediate := app.plan_immediate(v_plan_id, v_from_version, v_after_price::integer, v_after_members, v_from);
  v_month := app.plan_existing_from(v_policy, v_days, v_immediate, v_from);
  v_month_text := to_char(v_month, 'YYYY-MM');

  with c as (
    select t.id, t.name, app.tenant_stopped(t.id) as stopped, app.tenant_seat_count(t.id) as members,
           coalesce((app.plan_terms(v_plan_id, t.id, v_from)->>'price_monthly')::bigint, 0) as now_price
      from tenants t
     where t.deleted_at is null and t.half_made_at is null and t.id <> app.ops_tenant_id()
       and app.tenant_plan_id(t.id) = v_plan_id
  )
  select count(*)::int,
         count(*) filter (where c.stopped)::int,
         coalesce(sum(v_after_price - c.now_price) filter (where not c.stopped), 0)::bigint,
         coalesce(jsonb_agg(jsonb_build_object(
           'workspace', jsonb_build_object('id', c.id, 'name', c.name),
           'members', c.members,
           'now_price', c.now_price,
           'after_price', case when c.stopped then null else v_after_price end,
           'from_month', case when c.stopped then null else v_month_text end,
           'stopped', c.stopped) order by c.name, c.id), '[]'::jsonb)
    into v_customers, v_stopped, v_diff, v_rows
    from c;

  return jsonb_build_object(
    'customers', v_customers,
    'stopped', v_stopped,
    'monthly_revenue_diff', case when v_month is null then 0 else v_diff end,
    'immediate', v_immediate,
    'existing_from', v_month_text,
    'new_from', v_new_from,
    'by_workspace', v_rows);
end $$;
revoke all on function app.ops_plan_impact(uuid) from public;
grant execute on function app.ops_plan_impact(uuid) to kaname_app;

-- ③ 決める（K-1104 の版の本体。案の後の値・すぐ効く・記録の from の読む所だけを置き換える）
create or replace function app.ops_plan_decide(p_id uuid, p_notice_body text) returns jsonb
language plpgsql volatile security definer set search_path = public, app, pg_temp as $$
declare
  v_me uuid;
  q ops_plan_proposals%rowtype;
  v_plan plans%rowtype;
  v_from_terms jsonb;
  v_after_price integer;
  v_after_members integer;
  v_after_trial integer;
  v_from_price integer;
  v_from_members integer;
  v_immediate boolean;
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_existing date;
  v_targets uuid[];
  v_version uuid;
  v_notice uuid;
begin
  v_me := app.ops_require('plan_decide');
  select * into q from ops_plan_proposals p
   where p.id = p_id and p.tenant_id = app.ops_tenant_id() and p.deleted_at is null
   for update;
  if q.id is null then
    raise exception '案が無い' using errcode = 'no_data_found';
  end if;
  if q.state <> 'waiting' then
    return jsonb_build_object('error', 'state');
  end if;
  if q.proposed_by = v_me and app.plan_deciders_besides(v_me) > 0 then
    return jsonb_build_object('error', 'self');
  end if;

  select * into v_plan from plans pl where pl.id = q.plan_id for update;
  v_from_terms := app.plan_version_terms(q.plan_id, q.from_version);
  v_from_price := (v_from_terms->>'price_monthly')::integer;
  v_from_members := (v_from_terms->>'member_limit')::integer;
  v_after_price := coalesce((q.changes->>'price_monthly')::integer, v_from_price);
  v_after_members := coalesce((q.changes->>'member_limit')::integer, v_from_members);
  v_after_trial := coalesce((q.changes->>'trial_days')::integer,
    (select pv.trial_days from plan_versions pv where pv.plan_id = q.plan_id and pv.version = coalesce(v_plan.current_version, 1)), 0);
  v_immediate := app.plan_immediate(q.plan_id, q.from_version, v_after_price, v_after_members, v_today);
  v_existing := app.plan_existing_from(q.existing_policy, q.notice_days, v_immediate, v_today);

  insert into plan_versions (plan_id, version, snapshot, released_at, price_monthly, member_limit,
                             new_from, existing_from, proposal_id, decided_by, trial_days)
  values (q.plan_id, q.to_version,
          jsonb_build_object('price_monthly', v_after_price, 'member_limit', v_after_members,
                             'facts', coalesce(v_plan.limits->'facts', '[]'::jsonb)),
          now(), v_after_price, v_after_members, q.new_from, v_existing, q.id, v_me, v_after_trial)
  returning id into v_version;
  update plans set current_version = q.to_version where id = q.plan_id;

  -- いまの顧客（K-989 の影響と同じ条件・止めている会社も含める）が変わるときだけ、管理者に向けたお知らせを 1 行（鈴は出さない・D-156.28）
  if v_existing is not null then
    select coalesce(array_agg(t.id order by t.id), '{}'::uuid[]) into v_targets
      from tenants t
     where t.deleted_at is null and t.half_made_at is null and t.id <> app.ops_tenant_id()
       and app.tenant_plan_id(t.id) = q.plan_id;
    if cardinality(v_targets) > 0 then
      insert into notices (tenant_id, kind_id, title, body, target_tenant_ids, placements, admins_only,
                           state, publish_at, created_by, published_by)
      values (app.ops_tenant_id(), 'release', format('%sプランの料金が変わります', coalesce(v_plan.name, v_plan.key)),
              btrim(p_notice_body), v_targets, array['list']::text[], true,
              'published', now(), app.user_id(), app.user_id())
      returning id into v_notice;
    end if;
  end if;

  update ops_plan_proposals
     set state = 'decided', decided_by = v_me, decided_at = now()
   where id = q.id;

  perform app.record_ops_audit(app.ops_tenant_id(), 'plan.decide', 'ops_plan_proposals', q.id::text, null,
    jsonb_build_object('reason', null,
                       'price', jsonb_build_object('from', v_from_price, 'to', v_after_price),
                       'members', jsonb_build_object('from', v_from_members, 'to', v_after_members),
                       'plan_key', v_plan.key, 'step_up', true));

  return jsonb_build_object('data', app.ops_plan_proposal_row(q.id), 'version', v_version, 'notice_id', v_notice);
end $$;

-- ③ プランの一覧（K-1104 の版の本体。値段・人数・facts の先頭の人数・並びの値段を今の版の値に）
create or replace function app.ops_plans() returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
begin
  perform app.ops_require('any');
  perform app.ops_plan_caps_ok();
  return coalesce((
    select jsonb_agg(x.j order by x.price, x.key)
      from (
        select (vt.terms->>'price_monthly')::integer as price, p.key,
               jsonb_build_object(
                 'plan_key', p.key,
                 'name', p.name,
                 'version', coalesce(p.current_version, 1),
                 'price_monthly', coalesce((vt.terms->>'price_monthly')::integer, 0),
                 'member_limit', coalesce((vt.terms->>'member_limit')::integer, 0),
                 'trial_days', coalesce((select pv.trial_days from plan_versions pv
                                          where pv.plan_id = p.id and pv.version = coalesce(p.current_version, 1)), 0),
                 'facts', jsonb_build_array(jsonb_build_object(
                            'label', '人数',
                            'value', format('%s 人まで', coalesce((vt.terms->>'member_limit')::integer, 0))))
                          || coalesce(p.limits->'facts', '[]'::jsonb),
                 'places', (select count(*)::integer
                              from tenants t
                             where t.deleted_at is null and t.half_made_at is null and t.id <> app.ops_tenant_id()
                               and app.tenant_plan_id(t.id) = p.id),
                 'proposal', (select jsonb_build_object(
                                       'id', q.id,
                                       'state', q.state,
                                       'to_version', q.to_version,
                                       'price_monthly', round((q.changes->>'price_monthly')::numeric)::integer,
                                       'proposer_name', m.display_name)
                                from ops_plan_proposals q
                                left join ops_members om on om.id = q.proposed_by
                                left join members m on m.id = om.member_id
                               where q.plan_id = p.id and q.deleted_at is null and q.state in ('draft', 'waiting')
                               order by q.created_at desc, q.id desc
                               limit 1)) as j
          from plans p
          cross join lateral (select app.plan_version_terms(p.id, coalesce(p.current_version, 1)) as terms) vt
         where p.tenant_id = app.ops_tenant_id() and p.deleted_at is null
      ) x), '[]'::jsonb);
end $$;
