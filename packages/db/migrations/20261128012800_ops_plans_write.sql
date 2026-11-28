-- 20261128012800 値段を変える案を作る・直す・決める人に回す（K-988・契約の口 createPlanProposal・updatePlanProposal・submitPlanProposal・
--   D-156.3・D-156.21・D-128.72・関門 C2）
--   ① 1 つのプランに開いた案（下書き・待っている）は 1 つ：部分の一意の索引。前からの行で開いた案が 2 つ以上在るプランは、新しい 1 つを残して消した印にする
--   ② app.ops_plan_proposal_create(体)・app.ops_plan_proposal_update(案, 体)・app.ops_plan_proposal_submit(案)：
--      頭で app.ops_require('plan_propose')（K-947 の型・2 層目）→ 決まり → 書く → 運営の記録 → 案の 1 行（K-987 の app.ops_plan_proposal_row）。
--      断りは { error: open_exists | no_change | not_owner | state | invalid }・無い案は no_data_found（口が 404）。
--      同時に 2 つ作ったときの後の方は一意の違反（23505・口が 409 E-OPS-019）。お知らせ・鈴は出さない（待っている案は 配るもの › プラン の数で見る）
--   値段と人数の「今」は plans の行（値段は円の整数・人数は limits.members）。記録の payload は { reason, price: {from, to}, members: {from, to}, plan_key }

-- ① 前からの重なりを消した印にしてから索引を張る（今の本線には案の行が無い）
update ops_plan_proposals q set deleted_at = now()
 where q.state in ('draft', 'waiting') and q.deleted_at is null
   and exists (select 1 from ops_plan_proposals o
                where o.plan_id = q.plan_id and o.state in ('draft', 'waiting') and o.deleted_at is null
                  and (o.created_at, o.id) > (q.created_at, q.id));
create unique index if not exists ops_plan_proposals_open_uq on ops_plan_proposals (plan_id)
  where state in ('draft', 'waiting') and deleted_at is null;

-- 記録の payload（前と後の値段と人数）
create or replace function app.plan_proposal_audit_payload(p_plan uuid, p_changes jsonb, p_reason text) returns jsonb
language sql stable set search_path = public, app, pg_temp as $$
  select jsonb_build_object(
           'reason', p_reason,
           'price', jsonb_build_object('from', round(coalesce(p.price_monthly, 0))::integer, 'to', p_changes -> 'price_monthly'),
           'members', jsonb_build_object('from', coalesce((p.limits ->> 'members')::integer, 0), 'to', p_changes -> 'member_limit'),
           'plan_key', p.key)
    from plans p where p.id = p_plan
$$;
revoke all on function app.plan_proposal_audit_payload(uuid, jsonb, text) from public;
grant execute on function app.plan_proposal_audit_payload(uuid, jsonb, text) to kaname_app;

-- 値段と人数が今のプランと同じか
create or replace function app.plan_proposal_same(p_plan uuid, p_changes jsonb) returns boolean
language sql stable set search_path = public, app, pg_temp as $$
  select coalesce((p_changes ->> 'price_monthly')::numeric = round(coalesce(p.price_monthly, 0))
                  and (p_changes ->> 'member_limit')::integer = coalesce((p.limits ->> 'members')::integer, 0), false)
    from plans p where p.id = p_plan
$$;
revoke all on function app.plan_proposal_same(uuid, jsonb) from public;
grant execute on function app.plan_proposal_same(uuid, jsonb) to kaname_app;

-- ② 作る。p は { plan_key, price_monthly, member_limit, existing_policy, notice_days?, new_from?, reason }（形は口が確かめた後）
create or replace function app.ops_plan_proposal_create(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public, app, pg_temp as $$
declare
  v_me uuid; v_plan record; v_changes jsonb; v_policy text; v_days integer; v_id uuid;
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
                                  'member_limit', (p ->> 'member_limit')::integer);
  if exists (select 1 from ops_plan_proposals q
              where q.plan_id = v_plan.id and q.state in ('draft', 'waiting') and q.deleted_at is null) then
    return jsonb_build_object('error', 'open_exists');
  end if;
  if app.plan_proposal_same(v_plan.id, v_changes) then
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

-- 直す。p は plan_key 以外の 6 つのうち 1 つ以上。作った人だけ・下書きか差し戻された案だけ（差し戻された案は下書きに戻す）
create or replace function app.ops_plan_proposal_update(p_id uuid, p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public, app, pg_temp as $$
declare
  v_me uuid; q record; v_changes jsonb; v_policy text; v_days integer; v_new_from date; v_reason text;
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
    || case when p ? 'member_limit' then jsonb_build_object('member_limit', (p ->> 'member_limit')::integer) else '{}'::jsonb end;
  v_policy := coalesce(p ->> 'existing_policy', q.existing_policy);
  v_days := case when p ? 'notice_days' then (p ->> 'notice_days')::integer
                 when p ? 'existing_policy' and v_policy = 'keep' then null
                 else q.notice_days end;
  if (v_policy = 'after_days' and v_days is null) or (v_policy = 'keep' and v_days is not null) then
    return jsonb_build_object('error', 'invalid');
  end if;
  v_new_from := case when p ? 'new_from' then nullif(p ->> 'new_from', '')::date else q.new_from end;
  v_reason := coalesce(p ->> 'reason', q.reason);
  if app.plan_proposal_same(q.plan_id, v_changes) then
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

-- 回す。作った人だけ・下書きだけ。state waiting・回した時刻
create or replace function app.ops_plan_proposal_submit(p_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = public, app, pg_temp as $$
declare
  v_me uuid; q record;
begin
  v_me := app.ops_require('plan_propose');
  select * into q from ops_plan_proposals
   where id = p_id and tenant_id = app.ops_tenant_id() and deleted_at is null
   for update;
  if not found then raise exception '案が無い' using errcode = 'no_data_found'; end if;
  if q.proposed_by <> v_me then return jsonb_build_object('error', 'not_owner'); end if;
  if q.state <> 'draft' then return jsonb_build_object('error', 'state'); end if;

  update ops_plan_proposals set state = 'waiting', submitted_at = now(), updated_by = app.user_id() where id = p_id;

  perform app.record_ops_audit(app.ops_tenant_id(), 'plan.submit', 'ops_plan_proposals', p_id::text, null,
                               app.plan_proposal_audit_payload(q.plan_id, q.changes, q.reason));
  return jsonb_build_object('data', app.ops_plan_proposal_row(p_id));
end $$;
revoke all on function app.ops_plan_proposal_submit(uuid) from public;
grant execute on function app.ops_plan_proposal_submit(uuid) to kaname_app;
