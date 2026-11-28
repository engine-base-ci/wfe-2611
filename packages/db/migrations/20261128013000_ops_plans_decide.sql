-- 20261128013000 値段を変える案を決める・差し戻す（K-990・契約の口 decidePlanProposal・returnPlanProposal・関門 C2・D-128.72・D-156.3・D-156.12・D-156.17・D-156.28・D-156.33・D-156.57）
--   ① plan_versions に 6 列：price_monthly・member_limit（その版の値段と人数）・new_from（新しく入る人に効く日・null は決めた日）・
--      existing_from（いまの顧客が変わる月の 1 日・null は前の版のまま）・proposal_id（決めた案）・decided_by（決めた運営の人＝ops_members.id）。
--      前からの版の行（K-987 の種）は price_monthly・member_limit を snapshot から埋める。プランの今の値段の列（plans.price_monthly・limits）は変えない（効かせるのは K-1017）
--   ② 自分の案は決められない（値段を決めるを持つ生きている運営の人が呼んだ人 1 人だけの間は例外）。式は app.plan_deciders_besides の 1 か所で、
--      関数（1 層目）と 0076 の引き金 app.ops_plan_proposal_guard（2 層目）の両方が呼ぶ
--   ③ app.ops_plan_decide(id, notice_body)・app.ops_plan_return(id, reason)：運営の関数の型（ops_require('plan_decide') → 案を for update →
--      決まり（{"error":"state"}・{"error":"self"}・無い案は no_data_found）→ 書く → 記録 → {"data": 案の 1 行, "version", "notice_id"}）
--      決めるとき、いまの顧客が変わる（変わる月が null でない）なら、運営の会社のお知らせを 1 行出す（そのプランのいまの顧客の管理者だけ・鈴は出さない）。
--      いまの顧客が 0 社ならお知らせを作らない。変わる月の式は K-989 の app.plan_existing_from（日本の今日から）・すぐ効くの判定と
--      いまの顧客の条件は K-989 の app.ops_plan_impact と同じ（止めている会社も含める）
--   どれも search_path に pg_temp。public から外し、アプリの接続（kaname_app）にだけ渡す（D-128.171）

-- ① 版の行の列
alter table plan_versions add column if not exists price_monthly integer;
alter table plan_versions add column if not exists member_limit integer;
alter table plan_versions add column if not exists new_from date;
alter table plan_versions add column if not exists existing_from date;
alter table plan_versions add column if not exists proposal_id uuid;
alter table plan_versions add column if not exists decided_by uuid;

update plan_versions
   set price_monthly = coalesce(price_monthly, (snapshot->>'price_monthly')::integer),
       member_limit = coalesce(member_limit, (snapshot->>'member_limit')::integer)
 where (price_monthly is null and snapshot ? 'price_monthly')
    or (member_limit is null and snapshot ? 'member_limit');

-- ② 自分のほかに、値段を決めるを持つ生きている運営の人が居る数（1 か所）
create or replace function app.plan_deciders_besides(p_me uuid) returns integer
language sql stable security definer set search_path = public, app, pg_temp as $$
  select count(*)::integer
    from ops_members m
   where m.tenant_id = app.ops_tenant_id() and m.revoked_at is null and m.deleted_at is null
     and 'plan_decide' = any(m.caps) and m.id is distinct from p_me
$$;
revoke all on function app.plan_deciders_besides(uuid) from public;

-- 0076 の引き金も同じ式で守る（決めた・差し戻した人が作った人なら、ほかに決める人が居ないときだけ通す）
create or replace function app.ops_plan_proposal_guard() returns trigger
language plpgsql security definer set search_path = public, app, pg_temp as $$
begin
  if new.decided_by is not null and new.decided_by = new.proposed_by
     and app.plan_deciders_besides(new.decided_by) > 0 then
    raise exception '自分の案は自分で決められない（値段を決められる人が 1 人のときだけ例外）' using errcode = '42501';
  end if;
  return new;
end $$;

-- ③ 決める
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
  v_immediate := v_after_price <= v_now_price and v_after_members >= v_now_members;
  v_existing := app.plan_existing_from(q.existing_policy, q.notice_days, v_immediate, v_today);
  select coalesce((pv.snapshot->>'price_monthly')::integer, v_now_price),
         coalesce((pv.snapshot->>'member_limit')::integer, v_now_members)
    into v_from_price, v_from_members
    from plan_versions pv where pv.plan_id = q.plan_id and pv.version = q.from_version;

  insert into plan_versions (plan_id, version, snapshot, released_at, price_monthly, member_limit,
                             new_from, existing_from, proposal_id, decided_by)
  values (q.plan_id, q.to_version,
          jsonb_build_object('price_monthly', v_after_price, 'member_limit', v_after_members,
                             'facts', coalesce(v_plan.limits->'facts', '[]'::jsonb)),
          now(), v_after_price, v_after_members, q.new_from, v_existing, q.id, v_me)
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

-- ③ 差し戻す（版の行もお知らせも作らない）
create or replace function app.ops_plan_return(p_id uuid, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = public, app, pg_temp as $$
declare
  v_me uuid;
  q ops_plan_proposals%rowtype;
  v_plan plans%rowtype;
  v_reason text := btrim(p_reason);
  v_from_price integer;
  v_from_members integer;
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

  select * into v_plan from plans pl where pl.id = q.plan_id;
  select coalesce((pv.snapshot->>'price_monthly')::integer, round(coalesce(v_plan.price_monthly, 0))::integer),
         coalesce((pv.snapshot->>'member_limit')::integer, coalesce((v_plan.limits->>'members')::integer, 0))
    into v_from_price, v_from_members
    from plan_versions pv where pv.plan_id = q.plan_id and pv.version = q.from_version;

  update ops_plan_proposals
     set state = 'returned', decided_by = v_me, decided_at = now(), return_reason = v_reason
   where id = q.id;

  perform app.record_ops_audit(app.ops_tenant_id(), 'plan.return', 'ops_plan_proposals', q.id::text, null,
    jsonb_build_object('reason', v_reason,
                       'price', jsonb_build_object('from', v_from_price, 'to', (q.changes->>'price_monthly')::integer),
                       'members', jsonb_build_object('from', v_from_members, 'to', (q.changes->>'member_limit')::integer),
                       'plan_key', v_plan.key));

  return jsonb_build_object('data', app.ops_plan_proposal_row(q.id), 'version', null, 'notice_id', null);
end $$;

revoke all on function app.ops_plan_decide(uuid, text), app.ops_plan_return(uuid, text) from public;
grant execute on function app.ops_plan_decide(uuid, text), app.ops_plan_return(uuid, text) to kaname_app;

insert into app.schema_migrations (name) values ('20261128013000_ops_plans_decide.sql') on conflict do nothing;
