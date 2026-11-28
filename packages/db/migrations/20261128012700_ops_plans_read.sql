-- 20261128012700 配るもの › プランを読む（K-987・契約の口 listOpsPlans・listPlanProposals・listPlanHistory・関門 C2・D-156.3・D-156.21・D-156.63・D-128.72）
--   ① 列 ops_plan_proposals.submitted_at（決める人に回した時刻・書くのは K-988）
--   ② app.plan_seed()：運営の会社のプランに中身の行（limits の facts）と版 1 の行（plan_versions）を足す。足すだけで、運営が直した値を上書きしない。
--      持ち主の権限で動き、kaname_app には渡さない。この migration の最後で 1 回呼ぶ
--   ③ app.ops_plan_caps_ok()：呼んだ運営の人が「値段の案」か「値段を決める」を持つか（入口は ops:any・ほかの値段の関数もここを呼ぶ）
--   ④ app.ops_plan_proposal_row(id)：案の 1 行の 20 欄と、呼んだ人が直せるか・決められるか（K-988・K-990 の書く口も最後にこれを返す）
--   ⑤ app.ops_plans()・app.ops_plan_proposals(state, limit)・app.ops_plan_history(plan_key, limit)：プランの一覧・案の一覧・値段の記録
--   ③〜⑤ は頭で app.ops_require('any')（K-947 の型・2 層目）。読むだけなので運営の記録は書かない
--   使っている会社：顧客のワークスペース（消していない・作りかけでない・運営の会社でない。止めた会社も数える）で、app.tenant_plan_id（K-954）がそのプランの物

-- ① 回した時刻
alter table ops_plan_proposals add column if not exists submitted_at timestamptz;

-- ② 中身の行と版 1 の行（D-156.63：分身の実行の回数とファイルの量はプランで分けないので行にしない）
create or replace function app.plan_seed() returns void
language plpgsql security definer set search_path = public, app, pg_temp as $$
begin
  update plans p
     set limits = coalesce(p.limits, '{}'::jsonb) || jsonb_build_object('facts', f.facts)
    from (values ('free', '[{"label": "使えるもの", "value": "チケット・承認・ナレッジ"}]'::jsonb),
                 ('team', '[{"label": "使えるもの", "value": "＋ ゲストを招く"}]'::jsonb),
                 ('business', '[{"label": "使えるもの", "value": "＋ ゲストのグループ"}]'::jsonb)) as f(key, facts)
   where p.tenant_id = app.ops_tenant_id() and p.key = f.key and not (coalesce(p.limits, '{}'::jsonb) ? 'facts');

  update plans set current_version = 1 where tenant_id = app.ops_tenant_id() and current_version is null;

  insert into plan_versions (plan_id, version, snapshot, released_at)
  select p.id, p.current_version,
         jsonb_build_object('price_monthly', round(coalesce(p.price_monthly, 0))::integer,
                            'member_limit', coalesce((p.limits->>'members')::integer, 0),
                            'facts', coalesce(p.limits->'facts', '[]'::jsonb)),
         p.created_at
    from plans p
   where p.tenant_id = app.ops_tenant_id() and p.deleted_at is null
  on conflict (plan_id, version) do nothing;
end $$;
revoke all on function app.plan_seed() from public;

-- ③ 値段の印（値段の案か値段を決める）。無ければ 42501（口は 403）
create or replace function app.ops_plan_caps_ok() returns void
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_me uuid;
begin
  v_me := app.ops_require('any');
  if not exists (select 1 from ops_members m
                  where m.id = v_me and m.caps && array['plan_propose', 'plan_decide']::text[]) then
    raise exception '値段の案か値段を決めるが要る' using errcode = 'insufficient_privilege';
  end if;
end $$;

-- ④ 案の 1 行（20 欄）。before は作ったときのプランの値＝from_version の版の写し（今のプランの値から作らない：決めた後に変わってしまう）
--   can_edit：呼んだ人が作った人で、下書きか差し戻し
--   can_decide：待っている案で、呼んだ人が値段を決めるを持ち、作った人でない（値段を決めるを持つ生きている運営の人が呼んだ人 1 人だけなら作った人でもよい・D-128.72）
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
                                        'member_limit', pv.snapshot->'member_limit'),
           'changes', jsonb_build_object('price_monthly', q.changes->'price_monthly',
                                         'member_limit', q.changes->'member_limit'),
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

-- ⑤ プランの一覧（値段の安い順）。facts の先頭に人数の行を足す。proposal は下書きか待っている案の新しい 1 つ
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

-- 案の一覧（新しい順・state で絞る・p_limit 件まで。口は 101 を渡して 101 件目を捨てる）
create or replace function app.ops_plan_proposals(p_state text, p_limit integer) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_limit integer := coalesce(p_limit, 101);
begin
  perform app.ops_require('any');
  perform app.ops_plan_caps_ok();
  if p_state is not null and p_state not in ('draft', 'waiting', 'decided', 'returned') then
    raise exception '知らない状態' using errcode = 'invalid_parameter_value';
  end if;
  if v_limit < 1 or v_limit > 101 then
    raise exception 'limit は 1〜101' using errcode = 'invalid_parameter_value';
  end if;
  return coalesce((
    select jsonb_agg(app.ops_plan_proposal_row(c.id) order by c.created_at desc, c.id desc)
      from (select q.id, q.created_at
              from ops_plan_proposals q
             where q.tenant_id = app.ops_tenant_id() and q.deleted_at is null
               and (p_state is null or q.state = p_state)
             order by q.created_at desc, q.id desc
             limit v_limit) c), '[]'::jsonb);
end $$;

-- 値段の記録（運営の記録のうち案の行の plan.*・新しい順・plan_key で絞る・p_limit 件まで）。消せない・直せない（D-128.72）
create or replace function app.ops_plan_history(p_plan_key text, p_limit integer) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_limit integer := coalesce(p_limit, 101);
begin
  perform app.ops_require('any');
  perform app.ops_plan_caps_ok();
  if p_plan_key is not null and p_plan_key not in ('free', 'team', 'business') then
    raise exception '知らないプラン' using errcode = 'invalid_parameter_value';
  end if;
  if v_limit < 1 or v_limit > 101 then
    raise exception 'limit は 1〜101' using errcode = 'invalid_parameter_value';
  end if;
  return coalesce((
    select jsonb_agg(c.j order by c.at desc, c.id desc)
      from (
        select e.occurred_at as at, e.id,
               jsonb_build_object(
                 'id', e.id,
                 'at', e.occurred_at,
                 'actor_name', m.display_name,
                 'action', e.action,
                 'plan_name', p.name,
                 'to_version', q.to_version,
                 'reason', e.payload->>'reason',
                 'price', case when jsonb_typeof(e.payload->'price') = 'object'
                               then jsonb_build_object('from', e.payload->'price'->'from', 'to', e.payload->'price'->'to') end,
                 'members', case when jsonb_typeof(e.payload->'members') = 'object'
                                 then jsonb_build_object('from', e.payload->'members'->'from', 'to', e.payload->'members'->'to') end) as j
          from ops_audit_events e
          left join ops_plan_proposals q on q.id::text = e.target_id
          left join plans p on p.id = q.plan_id
          left join members m on m.id = e.ops_member_id
         where e.tenant_id = app.ops_tenant_id() and e.deleted_at is null
           and e.target_type = 'ops_plan_proposals' and e.action like 'plan.%'
           and (p_plan_key is null or p.key = p_plan_key)
         order by e.occurred_at desc, e.id desc
         limit v_limit
      ) c), '[]'::jsonb);
end $$;

revoke all on function app.ops_plan_caps_ok(), app.ops_plan_proposal_row(uuid), app.ops_plans(),
  app.ops_plan_proposals(text, integer), app.ops_plan_history(text, integer) from public;
grant execute on function app.ops_plan_caps_ok(), app.ops_plan_proposal_row(uuid), app.ops_plans(),
  app.ops_plan_proposals(text, integer), app.ops_plan_history(text, integer) to kaname_app;

select app.plan_seed();

insert into app.schema_migrations (name) values ('20261128012700_ops_plans_read.sql') on conflict do nothing;
