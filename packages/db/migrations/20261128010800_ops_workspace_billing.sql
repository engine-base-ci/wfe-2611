-- 20261128010800 運営が 1 社のプランと請求を読む・頼まれたときに代わりにプランを変える（K-968・契約の口 getOpsWorkspaceBilling・changeOpsWorkspacePlan・
--   D-128.65・D-128.108・D-156.3・D-156.12・D-156.31・D-156.36・D-156.51・関門 C2）
--   ① 中身を 1 か所に分ける（同じ決めを 2 つ書かない）。どちらもアプリの接続から呼べない（public から外し、kaname_app に渡さない）
--      app.plan_change_for(会社, 鍵, 頼んだ人)：K-961 の app.plan_change の ⓑ〜ⓖ（会社の行を for update・鍵・同じ・人数・上げる・下げる・頼みの行）。
--        記録は書かない（呼ぶ側が書く）。答えは { data, audit: { from, to, from_name, to_name, effective_from } } か { error[, detail] }
--      app.tenant_invoices(会社)：K-958 の app.billing_get の請求書の行（state・paid_on・新しい順）
--   ② K-961 の app.plan_change と K-958 の app.billing_get を、①を呼ぶ形に直す（答えも断りの言葉も前のまま）
--   ③ 運営の関数（頭で app.ops_require('money')・次に app.ops_target）
--      app.ops_workspace_billing(会社)：今のプラン・人数・請求書（支払い条件は口が設定から足す）。読むだけ
--      app.ops_workspace_plan_change(会社, 鍵, 問い合わせ)：頼まれた問い合わせ（その会社の消していない物）を引き、①で変え、
--        運営の記録と会社の記録に 1 行ずつ（app.record_ops_audit）。お知らせ・メールは出さない（D-125.130）
--   暦はどれも日本（Asia/Tokyo）

-- ① プランを変える中身（K-961 の決めをそのまま写す。能力の確かめと記録は呼ぶ側）
create or replace function app.plan_change_for(p_tenant uuid, p_key text, p_by uuid) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_next date := (date_trunc('month', (now() at time zone 'Asia/Tokyo')::date) + interval '1 month')::date;
  v_next_at timestamptz; v_to plans%rowtype; v_cur plans%rowtype; v_live subscriptions%rowtype;
  v_sched boolean; v_lim int; v_members int; v_eff date; v_amount int := 0; v_status text;
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

  v_lim := (v_to.limits->>'members')::int;
  v_members := app.tenant_seat_count(p_tenant);
  if v_lim is not null and v_members > v_lim then
    return jsonb_build_object('error', 'over_limit', 'detail', jsonb_build_object('members', v_members, 'member_limit', v_lim));
  end if;

  -- 前の予定（まだ始まっていない行・頼みの行）を取り消す
  update subscriptions set deleted_at = now(), updated_by = p_by
   where tenant_id = p_tenant and deleted_at is null and started_at > now();
  update plan_change_requests set status_id = 'cancelled', updated_by = p_by
   where tenant_id = p_tenant and deleted_at is null and status_id = 'scheduled';

  if coalesce(v_to.price_monthly, 0) > coalesce(v_cur.price_monthly, 0) then
    -- 上げる：すぐ。日割りは次の請求書に（K-981）
    if v_live.id is not null then
      update subscriptions set ended_at = now(), updated_by = p_by where id = v_live.id;
    end if;
    insert into subscriptions (tenant_id, plan_id, status_id, started_at, created_by)
      values (p_tenant, v_to.id, 'active', now(), p_by);
    v_eff := v_today;
    v_amount := app.plan_prorate(coalesce(v_to.price_monthly, 0) - coalesce(v_cur.price_monthly, 0));
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

-- ① 請求書の行（K-958 の決めをそのまま写す）。状態の決めは後で K-982 が app.invoice_state の 1 か所に寄せる（D-156.46）
--   状態：入金の合計（消していない入金・打ち消しの負の行も足す）が請求の額と同じなら paid（paid_on は最後の入金の日）／
--         期限（due_on）が日本の今日より前なら overdue／ほかは unpaid（D-156.32）
create or replace function app.tenant_invoices(p_tenant uuid) returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  with inv as (
    select i.id, i.period_start, i.issued_at, i.due_on, round(coalesce(i.amount, 0))::bigint as amount,
           p.paid_total, p.last_paid_on
      from invoices i
      left join lateral (
        select round(coalesce(sum(x.amount), 0))::bigint as paid_total, max(x.paid_on) as last_paid_on
          from payments x
         where x.invoice_id = i.id and x.tenant_id = p_tenant and x.deleted_at is null
      ) p on true
     where i.tenant_id = p_tenant and i.deleted_at is null and i.issued_at is not null
  ), st as (
    select inv.*,
           case when paid_total = amount then 'paid'
                when due_on < (now() at time zone 'Asia/Tokyo')::date then 'overdue'
                else 'unpaid' end as state
      from inv
  )
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id', id,
             'month', to_char(period_start, 'YYYY-MM'),
             'issued_on', to_char((issued_at at time zone 'Asia/Tokyo')::date, 'YYYY-MM-DD'),
             'amount_total', amount,
             'due_on', to_char(due_on, 'YYYY-MM-DD'),
             'state', state)
           || case when state = 'paid' then jsonb_build_object('paid_on', to_char(last_paid_on, 'YYYY-MM-DD')) else '{}'::jsonb end
           order by period_start desc, id), '[]'::jsonb)
    from st
$$;
revoke all on function app.tenant_invoices(uuid) from public;

-- ② 会社の人がプランを変える（K-961）：能力 → 中身 → 断りでなければ会社の記録。答えも断りの言葉も前のまま
create or replace function app.plan_change(p_key text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare
  v_tenant uuid := app.tenant_id(); v_me uuid := app.user_id(); v_r jsonb;
begin
  if v_tenant is null or not app.member_ok() or not has_permission(v_me, 'tenants', null, 'billing') then
    return jsonb_build_object('error', 'forbidden');
  end if;
  v_r := app.plan_change_for(v_tenant, p_key, v_me);
  if v_r ? 'error' then return v_r; end if;
  perform app.record_audit('plan.change', 'tenants', v_tenant::text, 'C2',
    jsonb_build_object('from', v_r->'audit'->>'from', 'to', v_r->'audit'->>'to', 'effective_from', v_r->'audit'->'effective_from'));
  return jsonb_build_object('data', v_r->'data');
end $$;
revoke all on function app.plan_change(text) from public;
grant execute on function app.plan_change(text) to kaname_app;

-- ② 会社の人が請求書の画面を読む（K-958）：請求書の行は①を呼ぶ。期限を過ぎた数はその行から数える（答えは前のまま）
create or replace function app.billing_get() returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_rows jsonb;
  v_overdue jsonb;
  v_contact jsonb;
  v_free boolean;
begin
  if v_tenant is null or not app.member_ok() or not has_permission(app.user_id(), 'tenants', null, 'billing') then
    return jsonb_build_object('error', 'forbidden');
  end if;

  v_rows := app.tenant_invoices(v_tenant);
  select case when count(*) = 0 then null
              else jsonb_build_object('count', count(*), 'amount_total', coalesce(sum((r->>'amount_total')::bigint), 0)) end
    into v_overdue
    from jsonb_array_elements(v_rows) r
   where r->>'state' = 'overdue';

  select coalesce(t.billing_contact, jsonb_build_object('company', t.name, 'attn', '', 'email', ''))
    into v_contact
    from tenants t where t.id = v_tenant;

  -- 今のプランの決めは app.tenant_plan_id（契約が無ければ無料）。同じ決めを別に書かない
  select coalesce((select pl.key = 'free' from plans pl where pl.id = app.tenant_plan_id(v_tenant)), true) into v_free;

  return jsonb_build_object('data', jsonb_build_object(
    'contact', v_contact,
    'invoices', v_rows,
    'overdue', v_overdue,
    'free', v_free,
    'can_edit_contact', true));
end $$;
revoke all on function app.billing_get() from public;
grant execute on function app.billing_get() to kaname_app;

-- ③ 運営が 1 社のプランと請求を読む（お金の人だけ）。答えは { plan, members, invoices }（支払い条件は口が足す）
create or replace function app.ops_workspace_billing(p_tenant uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_plan plans%rowtype;
  v_since date;
begin
  perform app.ops_require('money');
  perform app.ops_target(p_tenant);

  select * into v_plan from plans where id = app.tenant_plan_id(p_tenant);
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
      'price_monthly', coalesce(v_plan.price_monthly, 0)::int,
      'since', to_char(v_since, 'YYYY-MM-DD')),
    'members', jsonb_build_object(
      'count', app.tenant_seat_count(p_tenant),
      'limit', (v_plan.limits->>'members')::int),
    'invoices', app.tenant_invoices(p_tenant));
end $$;
revoke all on function app.ops_workspace_billing(uuid) from public;
grant execute on function app.ops_workspace_billing(uuid) to kaname_app;

-- ③ 運営が頼まれたときに代わりにプランを変える（お金の人だけ・本人確認は入口）。
--   頼まれた問い合わせ（その会社の消していない物）が無ければ no_data_found（404）。断りの言葉（not_found・same_plan・over_limit）はそのまま返す。
--   記録は運営の記録と会社の記録に 1 行ずつ（app.record_ops_audit。app.record_audit を重ねて書かない）
create or replace function app.ops_workspace_plan_change(p_tenant uuid, p_key text, p_inquiry uuid) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_title text;
  v_r jsonb;
begin
  perform app.ops_require('money');
  perform app.ops_target(p_tenant);

  select q.title into v_title from inquiries q
   where q.id = p_inquiry and q.tenant_id = p_tenant and q.deleted_at is null;
  if not found then
    raise exception '頼まれた問い合わせが無い' using errcode = 'no_data_found';
  end if;

  v_r := app.plan_change_for(p_tenant, p_key, app.user_id());
  if v_r ? 'error' then return v_r; end if;

  perform app.record_ops_audit(p_tenant, 'plan.change', 'tenants', p_tenant::text, null,
    jsonb_build_object(
      'target_label', format('%s → %s', v_r->'audit'->>'from_name', v_r->'audit'->>'to_name'),
      'reason', format('問い合わせ「%s」', v_title),
      'inquiry_id', p_inquiry,
      'from', v_r->'audit'->>'from',
      'to', v_r->'audit'->>'to',
      'effective_from', v_r->'audit'->'effective_from'));
  return jsonb_build_object('data', v_r->'data');
end $$;
revoke all on function app.ops_workspace_plan_change(uuid, text, uuid) from public;
grant execute on function app.ops_workspace_plan_change(uuid, text, uuid) to kaname_app;
