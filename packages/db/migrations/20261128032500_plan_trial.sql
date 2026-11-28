-- 20261128032500 無料期間（K-1104・D-156.62・D-156.61・D-156.71・D-156.74・D-156.52・関門 C2）
--   ① plan_versions.trial_days（その版の無料期間の日数・0 なら無し・0〜365）。版 1 の種の行も 0。プランの今の無料期間＝今の版の行の値（plans に列を足さない）
--   ② app.plan_trial_days(プラン, 会社, 日)：日数を読む 1 か所。版は app.plan_terms（K-1017）の version をそのまま使う（版の決めを写さない）。行が無ければ 0
--   ③ 前の葉の関数の create or replace（引数・戻り・security definer・grant は前のまま。本体の該当の所だけ足す）：
--      app.ops_invoice_lines（K-981・K-1017）：無料の月（その月の末日が最初に請求する日 F より前）は行にしない・日割りは effective_from >= F だけ足す。
--        F＝始めた日 S（値段の契約の started_at の日本の日付）＋N。N は app.plan_trial_days(値段の契約のプラン, 会社, その月の 1 日)。
--        同じ会社に同じプランで S より前に始めた契約の行があれば N＝0（同じプランの無料は 1 社 1 回・D-156.74）
--      app.ops_plan_proposal_create・app.ops_plan_proposal_update（K-988）：trial_days を送ったときだけ changes に入れる。
--        「変わらない」（no_change）の比べに無料期間（送らなければ今の版の値）も入れる
--      app.ops_plan_proposal_row（K-987）：changes に trial_days がある案だけ、changes.trial_days と before.trial_days（from_version の行の値）
--      app.ops_plan_decide（K-990）：新しい版の行の trial_days＝案の値（無ければ今の版の値を引き継ぐ）
--      app.ops_plans（K-987）：各プランの行に trial_days（今の版の行の値・行が無ければ 0）
--   時間で動く仕組みは作らない（請求は運営が「まとめて出す」を押したとき＝D-156.31）

-- ① 版の行の列
alter table plan_versions add column if not exists trial_days integer not null default 0;
alter table plan_versions add constraint plan_versions_trial_days_ck check (trial_days between 0 and 365) not valid;
alter table plan_versions validate constraint plan_versions_trial_days_ck;

-- ② 日数を読む 1 か所
create or replace function app.plan_trial_days(p_plan uuid, p_tenant uuid, p_day date) returns integer
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_version integer;
begin
  v_version := (app.plan_terms(p_plan, p_tenant, p_day) ->> 'version')::integer;
  return coalesce((select pv.trial_days from plan_versions pv
                    where pv.plan_id = p_plan and pv.version = v_version), 0);
end $$;
revoke all on function app.plan_trial_days(uuid, uuid, date) from public;
grant execute on function app.plan_trial_days(uuid, uuid, date) to kaname_app;

-- ③ 請求書の行（K-981 の本体・K-1017 の値段の読み方に、無料の月と日割りの絞りだけを足す。税・期限・出す会社の決め・答えの形は変えない）
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
    select t.id, t.name, t.created_at as made_at, to_jsonb(t) -> 'billing_contact' as bc
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
  ), s as (
    -- 始めた日 S と、同じプランで S より前に始めた契約があるか（1 社 1 回の問い合わせ）
    select c.*, su.plan_id, pl.name as plan,
           (coalesce(su.started_at, c.made_at) at time zone 'Asia/Tokyo')::date as s_day,
           exists (select 1 from subscriptions o
                    where o.tenant_id = c.id and o.deleted_at is null and o.plan_id = su.plan_id
                      and o.started_at < su.started_at) as used_trial
      from c
      left join subscriptions su on su.id = c.sub_id
      left join plans pl on pl.id = su.plan_id
  ), f as (
    -- 最初に請求する日 F＝S＋N（契約が無ければ N＝0）
    select s.*,
           s.s_day + case when s.plan_id is null or s.used_trial then 0
                          else app.plan_trial_days(s.plan_id, s.id, v_start) end as first_day
      from s
  ), p as (
    select f.*,
           case when f.plan_id is null then 0
                else coalesce((app.plan_terms(f.plan_id, f.id, v_start) ->> 'price_monthly')::bigint, 0) end as amount,
           (select coalesce(sum(r.prorated_amount), 0) from plan_change_requests r
             where r.tenant_id = f.id and r.deleted_at is null and r.status_id = 'applied'
               and r.effective_from >= v_start and r.effective_from < v_next
               and r.effective_from >= f.first_day)::bigint as prorated
      from f
     where f.first_day < v_next   -- その月の末日が F より前の月は請求しない
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

-- ③ 案を作る（K-988 の本体に trial_days を足す）
create or replace function app.ops_plan_proposal_create(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public, app, pg_temp as $$
declare
  v_me uuid; v_plan record; v_changes jsonb; v_policy text; v_days integer; v_id uuid; v_trial integer;
begin
  v_me := app.ops_require('plan_propose');
  select * into v_plan from plans
   where tenant_id = app.ops_tenant_id() and key = p ->> 'plan_key' and deleted_at is null;
  if not found then raise exception 'プランが無い' using errcode = 'no_data_found'; end if;
  v_policy := p ->> 'existing_policy';
  v_days := (p ->> 'notice_days')::integer;
  if (v_policy = 'after_days' and v_days is null) or (v_policy = 'keep' and v_days is not null)
     or v_policy is null or v_policy not in ('after_days', 'keep') then
    return jsonb_build_object('error', 'invalid');
  end if;
  v_changes := jsonb_build_object('price_monthly', (p ->> 'price_monthly')::integer,
                                  'member_limit', (p ->> 'member_limit')::integer)
    || case when p ? 'trial_days' then jsonb_build_object('trial_days', (p ->> 'trial_days')::integer) else '{}'::jsonb end;
  if exists (select 1 from ops_plan_proposals q
              where q.plan_id = v_plan.id and q.state in ('draft', 'waiting') and q.deleted_at is null) then
    return jsonb_build_object('error', 'open_exists');
  end if;
  v_trial := coalesce((select pv.trial_days from plans cp
                    join plan_versions pv on pv.plan_id = cp.id and pv.version = coalesce(cp.current_version, 1)
                   where cp.id = v_plan.id), 0);
  if app.plan_proposal_same(v_plan.id, v_changes)
     and coalesce((v_changes ->> 'trial_days')::integer, v_trial) = v_trial then
    return jsonb_build_object('error', 'no_change');
  end if;

  insert into ops_plan_proposals (plan_id, from_version, to_version, changes, existing_policy, notice_days, new_from,
                                  reason, proposed_by, state, created_by, updated_by)
  values (v_plan.id, coalesce(v_plan.current_version, 1), coalesce(v_plan.current_version, 1) + 1, v_changes,
          v_policy, v_days, nullif(p ->> 'new_from', '')::date, p ->> 'reason', v_me, 'draft', app.user_id(), app.user_id())
  returning id into v_id;

  perform app.record_ops_audit(app.ops_tenant_id(), 'plan.propose', 'ops_plan_proposals', v_id::text, null,
                               app.plan_proposal_audit_payload(v_plan.id, v_changes, p ->> 'reason'));
  return jsonb_build_object('data', app.ops_plan_proposal_row(v_id));
end $$;
revoke all on function app.ops_plan_proposal_create(jsonb) from public;
grant execute on function app.ops_plan_proposal_create(jsonb) to kaname_app;

-- ③ 案を直す（K-988 の本体に trial_days を足す）
create or replace function app.ops_plan_proposal_update(p_id uuid, p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public, app, pg_temp as $$
declare
  v_me uuid; q record; v_changes jsonb; v_policy text; v_days integer; v_new_from date; v_reason text; v_trial integer;
begin
  v_me := app.ops_require('plan_propose');
  select * into q from ops_plan_proposals
   where id = p_id and tenant_id = app.ops_tenant_id() and deleted_at is null
   for update;
  if not found then raise exception '案が無い' using errcode = 'no_data_found'; end if;
  if q.proposed_by <> v_me then return jsonb_build_object('error', 'not_owner'); end if;
  if q.state not in ('draft', 'returned') then return jsonb_build_object('error', 'state'); end if;

  v_changes := q.changes
    || case when p ? 'price_monthly' then jsonb_build_object('price_monthly', (p ->> 'price_monthly')::integer) else '{}'::jsonb end
    || case when p ? 'member_limit' then jsonb_build_object('member_limit', (p ->> 'member_limit')::integer) else '{}'::jsonb end
    || case when p ? 'trial_days' then jsonb_build_object('trial_days', (p ->> 'trial_days')::integer) else '{}'::jsonb end;
  v_policy := coalesce(p ->> 'existing_policy', q.existing_policy);
  v_days := case when p ? 'notice_days' then (p ->> 'notice_days')::integer
                 when p ? 'existing_policy' and v_policy = 'keep' then null
                 else q.notice_days end;
  if (v_policy = 'after_days' and v_days is null) or (v_policy = 'keep' and v_days is not null) then
    return jsonb_build_object('error', 'invalid');
  end if;
  v_new_from := case when p ? 'new_from' then nullif(p ->> 'new_from', '')::date else q.new_from end;
  v_reason := coalesce(p ->> 'reason', q.reason);
  v_trial := coalesce((select pv.trial_days from plans cp
                    join plan_versions pv on pv.plan_id = cp.id and pv.version = coalesce(cp.current_version, 1)
                   where cp.id = q.plan_id), 0);
  if app.plan_proposal_same(q.plan_id, v_changes)
     and coalesce((v_changes ->> 'trial_days')::integer, v_trial) = v_trial then
    return jsonb_build_object('error', 'no_change');
  end if;

  update ops_plan_proposals
     set changes = v_changes, existing_policy = v_policy, notice_days = v_days, new_from = v_new_from, reason = v_reason,
         state = 'draft', decided_by = null, decided_at = null, return_reason = null, updated_by = app.user_id()
   where id = p_id;

  perform app.record_ops_audit(app.ops_tenant_id(), 'plan.update', 'ops_plan_proposals', p_id::text, null,
                               app.plan_proposal_audit_payload(q.plan_id, v_changes, v_reason));
  return jsonb_build_object('data', app.ops_plan_proposal_row(p_id));
end $$;
revoke all on function app.ops_plan_proposal_update(uuid, jsonb) from public;
grant execute on function app.ops_plan_proposal_update(uuid, jsonb) to kaname_app;

-- ③ 案の 1 行（K-987 の本体。changes に trial_days がある案だけ changes.trial_days と before.trial_days を足す）
create or replace function app.ops_plan_proposal_row(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_me uuid;
  v_decide boolean;
  v_alone boolean;
  v jsonb;
begin
  v_me := app.ops_require('any');
  select 'plan_decide' = any(m.caps) into v_decide from ops_members m where m.id = v_me;
  select count(*) = 1 into v_alone
    from ops_members m
   where m.tenant_id = app.ops_tenant_id() and m.revoked_at is null and m.deleted_at is null
     and 'plan_decide' = any(m.caps);

  select jsonb_build_object(
           'id', q.id,
           'plan_key', p.key,
           'plan_name', p.name,
           'from_version', q.from_version,
           'to_version', q.to_version,
           'before', jsonb_build_object('price_monthly', pv.snapshot->'price_monthly',
                                        'member_limit', pv.snapshot->'member_limit')
                     || case when q.changes ? 'trial_days'
                             then jsonb_build_object('trial_days', coalesce(pv.trial_days, 0)) else '{}'::jsonb end,
           'changes', jsonb_build_object('price_monthly', q.changes->'price_monthly',
                                         'member_limit', q.changes->'member_limit')
                      || case when q.changes ? 'trial_days'
                              then jsonb_build_object('trial_days', q.changes->'trial_days') else '{}'::jsonb end,
           'existing_policy', q.existing_policy,
           'notice_days', q.notice_days,
           'new_from', q.new_from,
           'reason', q.reason,
           'state', q.state,
           'proposer', jsonb_build_object('member_id', po.member_id, 'name', pm.display_name),
           'decider', case when q.decided_by is null then null
                           else jsonb_build_object('member_id', dop.member_id, 'name', dm.display_name) end,
           'return_reason', q.return_reason,
           'created_at', q.created_at,
           'submitted_at', q.submitted_at,
           'decided_at', q.decided_at,
           'can_edit', q.proposed_by = v_me and q.state in ('draft', 'returned'),
           'can_decide', q.state = 'waiting' and coalesce(v_decide, false)
                         and (q.proposed_by <> v_me or coalesce(v_alone, false)))
    into v
    from ops_plan_proposals q
    join plans p on p.id = q.plan_id
    left join plan_versions pv on pv.plan_id = q.plan_id and pv.version = q.from_version
    left join ops_members po on po.id = q.proposed_by
    left join members pm on pm.id = po.member_id
    left join ops_members dop on dop.id = q.decided_by
    left join members dm on dm.id = dop.member_id
   where q.id = p_id and q.tenant_id = app.ops_tenant_id() and q.deleted_at is null;
  if v is null then
    raise exception '案が無い' using errcode = 'no_data_found';
  end if;
  return v;
end $$;

-- ③ 決める（K-990 の本体。新しい版の行の trial_days を足す）
create or replace function app.ops_plan_decide(p_id uuid, p_notice_body text) returns jsonb
language plpgsql volatile security definer set search_path = public, app, pg_temp as $$
declare
  v_me uuid;
  q ops_plan_proposals%rowtype;
  v_plan plans%rowtype;
  v_now_price integer;
  v_now_members integer;
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
  v_now_price := round(coalesce(v_plan.price_monthly, 0))::integer;
  v_now_members := coalesce((v_plan.limits->>'members')::integer, 0);
  v_after_price := coalesce((q.changes->>'price_monthly')::integer, v_now_price);
  v_after_members := coalesce((q.changes->>'member_limit')::integer, v_now_members);
  v_after_trial := coalesce((q.changes->>'trial_days')::integer,
    (select pv.trial_days from plan_versions pv where pv.plan_id = q.plan_id and pv.version = coalesce(v_plan.current_version, 1)), 0);
  v_immediate := v_after_price <= v_now_price and v_after_members >= v_now_members;
  v_existing := app.plan_existing_from(q.existing_policy, q.notice_days, v_immediate, v_today);
  select coalesce((pv.snapshot->>'price_monthly')::integer, v_now_price),
         coalesce((pv.snapshot->>'member_limit')::integer, v_now_members)
    into v_from_price, v_from_members
    from plan_versions pv where pv.plan_id = q.plan_id and pv.version = q.from_version;

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

-- ③ プランの一覧（K-987 の本体。各行に今の版の trial_days を足す）
create or replace function app.ops_plans() returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
begin
  perform app.ops_require('any');
  perform app.ops_plan_caps_ok();
  return coalesce((
    select jsonb_agg(x.j order by x.price, x.key)
      from (
        select coalesce(p.price_monthly, 0) as price, p.key,
               jsonb_build_object(
                 'plan_key', p.key,
                 'name', p.name,
                 'version', coalesce(p.current_version, 1),
                 'price_monthly', round(coalesce(p.price_monthly, 0))::integer,
                 'member_limit', coalesce((p.limits->>'members')::integer, 0),
                 'trial_days', coalesce((select pv.trial_days from plan_versions pv
                                          where pv.plan_id = p.id and pv.version = coalesce(p.current_version, 1)), 0),
                 'facts', jsonb_build_array(jsonb_build_object(
                            'label', '人数',
                            'value', format('%s 人まで', coalesce((p.limits->>'members')::integer, 0))))
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
         where p.tenant_id = app.ops_tenant_id() and p.deleted_at is null
      ) x), '[]'::jsonb);
end $$;
