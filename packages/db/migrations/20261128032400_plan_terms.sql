-- 20261128032400 決めた値段の版を請求とプランの選びに効かせる（K-1017・関門 C2・D-128.72・D-156.31・D-156.36・D-156.9・D-128.65）
--   名前の時刻はチケットの 015700 でなく、K-1103 の 20261128032300_seat_limit.sql の後にした（その migration が app.seat_check を作り直すので、
--   前に置くとこの置き換えが上書きされる）。K-961（010100）・K-968（010800）・K-981（012100）の後でもある
--   ① app.plan_terms(プラン, 会社, 日)：会社とその日で効いている版の { version, price_monthly, member_limit }（決めは 1 か所）
--      始めた日 S＝その会社のそのプランの契約（その日までに始めた物の新しい 1 つ・無ければ一番新しい物）の日本の日付・契約が無ければ会社を作った日。
--      会社が null なら「その日に始めるなら」（S＝その日）。版の行を新しい順に見て、最初に当たる版：
--        ・種の行（proposal_id が null・版 1）はいつも当たる。値段と人数はプランの列（plans.price_monthly・limits.members＝版 1 の値のまま）
--        ・新しく入る人：S >= greatest(coalesce(new_from, 決めた日), 決めた日)（決めた日＝released_at の日本の日付）
--        ・いまの顧客：existing_from が null でなく、その日 >= existing_from
--      版の行が 1 つも無ければプランの列（前と同じ答え）。プランが無ければ null
--   ② 読む所の置き換え（create or replace・ほかの式・断り・答えの形は前の葉のまま）
--      app.ops_invoice_lines（K-981）：値段の契約のプランの値段を、その月の 1 日の plan_terms に
--      app.workspace_plans（K-961）：いまのプランの行は今日の plan_terms、ほかの行は今日始めるなら（会社 null）。上げる・下げるの比べと人数の上限も同じ値。
--        いまのプランの行の upcoming＝今日より後に existing_from が来る、今日効いている版より新しい版の最も早い 1 つ
--        → { price_monthly, member_limit, from_month "YYYY-MM", noticed_on（決めた日） }。ほかの行は null
--      app.plan_change_for（K-968 が K-961 の app.plan_change から分けた決めの中身・会社の口と運営の口の両方が呼ぶ）：
--        人数の上限・上げる／下げるの比べ・日割りの額を全部 app.workspace_plans と同じ値で（今のプラン＝今日の plan_terms、変える先＝今日始めるなら）
--      app.ops_workspace_billing（K-968）：運営が見る 1 社の値段と人数の上限を、今のプランの今日の plan_terms に（ほかの欄と答えの形は前のまま）
--      app.seat_check（K-1103）：上限をいまのプランの今日の plan_terms の member_limit に（数え方と断りは前のまま）
--   暦はどれも日本（Asia/Tokyo）

-- ①
create or replace function app.plan_terms(p_plan uuid, p_tenant uuid, p_day date) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v plans%rowtype;
  r record;
  v_start date;
  v_rel date;
begin
  select * into v from plans where id = p_plan;
  if v.id is null or p_day is null then
    return null;
  end if;
  if p_tenant is null then
    v_start := p_day;
  else
    select (s.started_at at time zone 'Asia/Tokyo')::date into v_start
      from subscriptions s
     where s.tenant_id = p_tenant and s.plan_id = p_plan and s.deleted_at is null
     order by ((s.started_at at time zone 'Asia/Tokyo')::date <= p_day) desc, s.started_at desc
     limit 1;
    if v_start is null then
      select (t.created_at at time zone 'Asia/Tokyo')::date into v_start from tenants t where t.id = p_tenant;
    end if;
  end if;

  for r in select pv.version, pv.proposal_id, pv.new_from, pv.existing_from, pv.released_at, pv.created_at,
                  coalesce(pv.price_monthly, (pv.snapshot->>'price_monthly')::integer) as price,
                  coalesce(pv.member_limit, (pv.snapshot->>'member_limit')::integer) as lim
             from plan_versions pv
            where pv.plan_id = p_plan
            order by pv.version desc loop
    if r.proposal_id is null then
      return jsonb_build_object('version', r.version, 'price_monthly', round(coalesce(v.price_monthly, 0))::integer,
                                'member_limit', (v.limits->>'members')::integer);
    end if;
    v_rel := (coalesce(r.released_at, r.created_at) at time zone 'Asia/Tokyo')::date;
    if (v_start is not null and v_start >= greatest(coalesce(r.new_from, v_rel), v_rel))
       or (r.existing_from is not null and p_day >= r.existing_from) then
      return jsonb_build_object('version', r.version, 'price_monthly', r.price, 'member_limit', r.lim);
    end if;
  end loop;

  return jsonb_build_object('version', coalesce(v.current_version, 1), 'price_monthly', round(coalesce(v.price_monthly, 0))::integer,
                            'member_limit', (v.limits->>'members')::integer);
end $$;
revoke all on function app.plan_terms(uuid, uuid, date) from public;
grant execute on function app.plan_terms(uuid, uuid, date) to kaname_app;

-- ② 請求書の行（K-981）：値段の契約のプランの値段だけを plan_terms（その月の 1 日）に
create or replace function app.ops_invoice_lines(p_month text) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_start date; v_next date; v_at timestamptz; v_next_at timestamptz; v_rows jsonb;
begin
  perform app.ops_require('money');
  if p_month is null or p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
    raise exception '月の形が違う' using errcode = 'invalid_parameter_value';
  end if;
  v_start := (p_month || '-01')::date;
  v_next := (v_start + interval '1 month')::date;
  v_at := v_start::timestamp at time zone 'Asia/Tokyo';
  v_next_at := v_next::timestamp at time zone 'Asia/Tokyo';

  with w as (
    select t.id, t.name, to_jsonb(t) -> 'billing_contact' as bc
      from tenants t
     where t.deleted_at is null and t.half_made_at is null and t.id <> app.ops_tenant_id()
       and not exists (select 1 from invoices i
                        where i.tenant_id = t.id and i.period_start = v_start
                          and i.issued_at is not null and i.deleted_at is null)
  ), c as (
    select w.*, coalesce(
             (select s.id from subscriptions s
               where s.tenant_id = w.id and s.deleted_at is null
                 and s.started_at <= v_at and (s.ended_at is null or s.ended_at > v_at)
               order by s.started_at desc limit 1),
             (select s.id from subscriptions s
               where s.tenant_id = w.id and s.deleted_at is null
                 and s.started_at > v_at and s.started_at < v_next_at
               order by s.started_at asc limit 1)) as sub_id
      from w
  ), p as (
    select c.*, pl.name as plan,
           case when pl.id is null then 0
                else coalesce((app.plan_terms(pl.id, c.id, v_start)->>'price_monthly')::bigint, 0) end as amount,
           (select coalesce(sum(r.prorated_amount), 0) from plan_change_requests r
             where r.tenant_id = c.id and r.deleted_at is null and r.status_id = 'applied'
               and r.effective_from >= v_start and r.effective_from < v_next)::bigint as prorated
      from c
      left join subscriptions su on su.id = c.sub_id
      left join plans pl on pl.id = su.plan_id
  ), x as (
    select p.*, (p.amount * 110 / 100 - p.amount) as tax from p
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'workspace', jsonb_build_object('id', x.id, 'name', x.name),
           'plan_name', coalesce(x.plan, '無料'),
           'amount', x.amount, 'tax', x.tax, 'prorated', x.prorated,
           'total', x.amount + x.tax + x.prorated,
           'subscription_id', x.sub_id,
           'contact', coalesce(nullif(x.bc, 'null'::jsonb),
                               jsonb_build_object('company', x.name, 'attn', '', 'email', '')))
         order by x.name, x.id), '[]'::jsonb) into v_rows
    from x
   where x.amount + x.tax + x.prorated > 0;
  return v_rows;
end $$;
revoke all on function app.ops_invoice_lines(text) from public;
grant execute on function app.ops_invoice_lines(text) to kaname_app;

-- ② 選べるプラン（K-961）：値段・人数の上限・上げる下げるの比べを plan_terms に。いまのプランの行に upcoming
create or replace function app.workspace_plans() returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_next date := (date_trunc('month', (now() at time zone 'Asia/Tokyo')::date) + interval '1 month')::date;
  v_dim int := extract(day from (date_trunc('month', (now() at time zone 'Asia/Tokyo')::date) + interval '1 month - 1 day'))::int;
  v_members int; v_cur uuid; v_cur_terms jsonb; v_cur_price numeric; v_cur_limit int; v_since date; v_upcoming jsonb; v_rows jsonb;
begin
  if v_tenant is null or not app.member_ok() or not has_permission(app.user_id(), 'tenants', null, 'billing') then
    return jsonb_build_object('error', 'forbidden');
  end if;
  v_members := app.tenant_seat_count(v_tenant);
  v_cur := app.tenant_plan_id(v_tenant);
  v_cur_terms := app.plan_terms(v_cur, v_tenant, v_today);
  v_cur_price := coalesce((v_cur_terms->>'price_monthly')::numeric, 0);
  v_cur_limit := (v_cur_terms->>'member_limit')::int;
  -- 今のプランの効いた日：効いている契約の始まり。契約が無ければ会社を作った日
  select (s.started_at at time zone 'Asia/Tokyo')::date into v_since from subscriptions s
   where s.tenant_id = v_tenant and s.deleted_at is null and s.started_at <= now() and (s.ended_at is null or s.ended_at > now())
   order by s.started_at desc limit 1;
  if v_since is null then
    select (t.created_at at time zone 'Asia/Tokyo')::date into v_since from tenants t where t.id = v_tenant;
  end if;
  -- 変わる：今日より後に変わる月が来る、今日効いている版より新しい版の最も早い 1 つ
  select jsonb_build_object('price_monthly', coalesce(pv.price_monthly, (pv.snapshot->>'price_monthly')::integer),
                            'member_limit', coalesce(pv.member_limit, (pv.snapshot->>'member_limit')::integer),
                            'from_month', to_char(pv.existing_from, 'YYYY-MM'),
                            'noticed_on', to_char((coalesce(pv.released_at, pv.created_at) at time zone 'Asia/Tokyo')::date, 'YYYY-MM-DD'))
    into v_upcoming
    from plan_versions pv
   where pv.plan_id = v_cur and pv.proposal_id is not null
     and pv.existing_from is not null and pv.existing_from > v_today
     and pv.version > coalesce((v_cur_terms->>'version')::int, 0)
   order by pv.existing_from, pv.version
   limit 1;

  with p as (
    select pl.id, pl.key, pl.name,
           coalesce((app.plan_terms(pl.id, case when pl.id = v_cur then v_tenant end, v_today)->>'price_monthly')::numeric, 0) as price,
           (app.plan_terms(pl.id, case when pl.id = v_cur then v_tenant end, v_today)->>'member_limit')::int as lim,
           coalesce(pl.limits->>'summary', '') as summary,
           coalesce((pl.limits->>'recommended')::boolean, false) as mark
      from plans pl where pl.tenant_id = app.ops_tenant_id() and pl.deleted_at is null
  ), r as (
    select p.*, p.id = v_cur as cur,
           p.id <> v_cur and not (p.lim is not null and v_members > p.lim) as can,
           p.price > v_cur_price as up
      from p
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'plan_key', r.key, 'name', r.name, 'price_monthly', r.price::int, 'member_limit', r.lim,
           'current', r.cur, 'can_choose', r.can,
           'reason', case when r.cur then 'いまのプランです'
                          when not r.can then format('いま %s 人なので、%s 人までのプランには下げられません', v_members, r.lim) end,
           'effective_from', case when r.cur then v_since when r.up then v_today else v_next end,
           'summary', r.summary,
           'recommended', r.mark,
           'upgrade', case when r.up and r.can then jsonb_build_object(
                        'days', v_dim - extract(day from v_today)::int + 1,
                        'amount', app.plan_prorate(r.price - v_cur_price),
                        'invoice_on', v_next) end,
           'upcoming', case when r.cur then v_upcoming end)
         order by r.price, r.key), '[]'::jsonb) into v_rows
    from r;
  return jsonb_build_object('data', v_rows, 'meta', jsonb_build_object('members', v_members, 'member_limit', v_cur_limit));
end $$;
revoke all on function app.workspace_plans() from public;
grant execute on function app.workspace_plans() to kaname_app;

-- ② プランを変える決めの中身（K-968 が K-961 の app.plan_change から分けた物・会社の口と運営の口の両方が呼ぶ）：
--    人数の上限・上げる／下げるの比べ・日割りの額を全部、変える先の今日始めるならの値と今のプランの今日の値で（app.workspace_plans と同じ値）
create or replace function app.plan_change_for(p_tenant uuid, p_key text, p_by uuid) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_next date := (date_trunc('month', (now() at time zone 'Asia/Tokyo')::date) + interval '1 month')::date;
  v_next_at timestamptz; v_to plans%rowtype; v_cur plans%rowtype; v_live subscriptions%rowtype;
  v_sched boolean; v_lim int; v_members int; v_eff date; v_amount int := 0; v_status text;
  v_to_terms jsonb; v_cur_terms jsonb; v_to_price numeric; v_cur_price numeric;
begin
  v_next_at := v_next::timestamp at time zone 'Asia/Tokyo';
  perform 1 from tenants where id = p_tenant for update;

  select * into v_to from plans where tenant_id = app.ops_tenant_id() and key = p_key and deleted_at is null;
  if v_to.id is null then return jsonb_build_object('error', 'not_found'); end if;

  select * into v_live from subscriptions s
   where s.tenant_id = p_tenant and s.deleted_at is null and s.started_at <= now() and (s.ended_at is null or s.ended_at > now())
   order by s.started_at desc limit 1;
  select * into v_cur from plans where id = app.tenant_plan_id(p_tenant);
  -- 予定の下げ：まだ始まっていない行か、効いている行に終わりの時刻がある
  v_sched := v_live.ended_at is not null
          or exists (select 1 from subscriptions where tenant_id = p_tenant and deleted_at is null and started_at > now());

  if v_to.id = v_cur.id then
    if not v_sched then return jsonb_build_object('error', 'same_plan'); end if;
    -- 予定を取り消して今のプランのまま
    update subscriptions set deleted_at = now(), updated_by = p_by
     where tenant_id = p_tenant and deleted_at is null and started_at > now();
    if v_live.id is not null then
      update subscriptions set ended_at = null, updated_by = p_by where id = v_live.id;
    end if;
    update plan_change_requests set status_id = 'cancelled', updated_by = p_by
     where tenant_id = p_tenant and deleted_at is null and status_id = 'scheduled';
    return jsonb_build_object(
      'data', jsonb_build_object('plan_key', v_to.key, 'effective_from', v_today, 'prorated_amount', 0, 'next_invoice_on', v_next),
      'audit', jsonb_build_object('from', v_cur.key, 'to', v_to.key, 'from_name', v_cur.name, 'to_name', v_to.name, 'effective_from', v_today));
  end if;

  v_to_terms := app.plan_terms(v_to.id, null, v_today);
  v_cur_terms := app.plan_terms(v_cur.id, p_tenant, v_today);
  v_to_price := coalesce((v_to_terms->>'price_monthly')::numeric, 0);
  v_cur_price := coalesce((v_cur_terms->>'price_monthly')::numeric, 0);
  v_lim := (v_to_terms->>'member_limit')::int;
  v_members := app.tenant_seat_count(p_tenant);
  if v_lim is not null and v_members > v_lim then
    return jsonb_build_object('error', 'over_limit', 'detail', jsonb_build_object('members', v_members, 'member_limit', v_lim));
  end if;

  -- 前の予定（まだ始まっていない行・頼みの行）を取り消す
  update subscriptions set deleted_at = now(), updated_by = p_by
   where tenant_id = p_tenant and deleted_at is null and started_at > now();
  update plan_change_requests set status_id = 'cancelled', updated_by = p_by
   where tenant_id = p_tenant and deleted_at is null and status_id = 'scheduled';

  if v_to_price > v_cur_price then
    -- 上げる：すぐ。日割りは次の請求書に（K-981）
    if v_live.id is not null then
      update subscriptions set ended_at = now(), updated_by = p_by where id = v_live.id;
    end if;
    insert into subscriptions (tenant_id, plan_id, status_id, started_at, created_by)
      values (p_tenant, v_to.id, 'active', now(), p_by);
    v_eff := v_today;
    v_amount := app.plan_prorate(v_to_price - v_cur_price);
    v_status := 'applied';
  else
    -- 下げる：来月 1 日 0 時から。無料は契約の行を作らない（契約なし＝無料）
    if v_live.id is not null then
      update subscriptions set ended_at = v_next_at, updated_by = p_by where id = v_live.id;
    end if;
    if v_to.key <> 'free' then
      insert into subscriptions (tenant_id, plan_id, status_id, started_at, created_by)
        values (p_tenant, v_to.id, 'active', v_next_at, p_by);
    end if;
    v_eff := v_next;
    v_status := 'scheduled';
  end if;

  insert into plan_change_requests (tenant_id, from_plan_id, to_plan_id, requested_by, status_id, effective_from, prorated_amount, created_by)
    values (p_tenant, v_cur.id, v_to.id, p_by, v_status, v_eff, v_amount, p_by);
  return jsonb_build_object(
    'data', jsonb_build_object('plan_key', v_to.key, 'effective_from', v_eff, 'prorated_amount', v_amount, 'next_invoice_on', v_next),
    'audit', jsonb_build_object('from', v_cur.key, 'to', v_to.key, 'from_name', v_cur.name, 'to_name', v_to.name, 'effective_from', v_eff));
end $$;
revoke all on function app.plan_change_for(uuid, text, uuid) from public;

-- ② 運営が見る 1 社（K-968）：値段と人数の上限を今のプランの今日の plan_terms に（ほかの欄と答えの形は前のまま）
create or replace function app.ops_workspace_billing(p_tenant uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_plan plans%rowtype;
  v_since date;
  v_terms jsonb;
begin
  perform app.ops_require('money');
  perform app.ops_target(p_tenant);

  select * into v_plan from plans where id = app.tenant_plan_id(p_tenant);
  v_terms := app.plan_terms(v_plan.id, p_tenant, (now() at time zone 'Asia/Tokyo')::date);
  -- 今のプランの効いた日：効いている契約の始まり。契約が無ければ会社を作った日（K-961 の app.workspace_plans と同じ決め）
  select (s.started_at at time zone 'Asia/Tokyo')::date into v_since from subscriptions s
   where s.tenant_id = p_tenant and s.deleted_at is null and s.started_at <= now() and (s.ended_at is null or s.ended_at > now())
   order by s.started_at desc limit 1;
  if v_since is null then
    select (t.created_at at time zone 'Asia/Tokyo')::date into v_since from tenants t where t.id = p_tenant;
  end if;

  return jsonb_build_object(
    'plan', jsonb_build_object(
      'plan_key', v_plan.key,
      'name', v_plan.name,
      'price_monthly', coalesce((v_terms->>'price_monthly')::int, 0),
      'since', to_char(v_since, 'YYYY-MM-DD')),
    'members', jsonb_build_object(
      'count', app.tenant_seat_count(p_tenant),
      'limit', (v_terms->>'member_limit')::int),
    'invoices', app.tenant_invoices(p_tenant));
end $$;
revoke all on function app.ops_workspace_billing(uuid) from public;
grant execute on function app.ops_workspace_billing(uuid) to kaname_app;

-- ② 招くときの席（K-1103）：上限をいまのプランの今日の plan_terms の member_limit に（数え方・断りは前のまま）
create or replace function app.seat_check(p_adding integer, p_replacing text[] default '{}') returns void
language plpgsql volatile security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_limit integer;
  v_members integer;
  v_invited integer;
  v_replacing text[];
begin
  if v_tenant is null or p_adding is null or p_adding <= 0 then
    return;
  end if;
  perform 1 from tenants where id = v_tenant for update;
  v_limit := (app.plan_terms(app.tenant_plan_id(v_tenant), v_tenant, (now() at time zone 'Asia/Tokyo')::date)->>'member_limit')::int;
  if v_limit is null then
    return;
  end if;
  v_members := app.tenant_seat_count(v_tenant);
  select coalesce(array_agg(lower(x)), '{}') into v_replacing from unnest(coalesce(p_replacing, '{}')) as x;
  select count(*)::int into v_invited from invitations i
   where i.tenant_id = v_tenant
     and i.accepted_member_id is null
     and i.revoked_at is null
     and i.deleted_at is null
     and i.expires_at > now()
     and i.role_id is distinct from 'requester'
     and (i.email is null or lower(i.email) <> all (v_replacing));
  if v_members + v_invited + p_adding > v_limit then
    raise exception using errcode = 'P0001', message = 'seat_limit', hint = 'E-PLAN-003',
      detail = v_members || ',' || v_invited || ',' || v_limit;
  end if;
end;
$$;
revoke all on function app.seat_check(integer, text[]) from public;
grant execute on function app.seat_check(integer, text[]) to kaname_app;

insert into app.schema_migrations (name) values ('20261128032400_plan_terms.sql') on conflict do nothing;
