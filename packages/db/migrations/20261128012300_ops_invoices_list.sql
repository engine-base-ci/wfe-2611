-- 20261128012300_ops_invoices_list 運営の請求の一覧（listOpsInvoices）と、期限を過ぎた知らせ（K-983・関門 C2・D-156.24・D-156.29・D-156.44・D-156.54・D-125.128・D-128.68・D-128.108）
--   ① invoices に知らせた印の 2 列（期限を過ぎた・期限から 7 日）。時間で動く仕組みは作らず、運営が一覧を開いたときに追いついて出す（D-156.54）
--   ② app.ops_invoice_overdue_notify()：まだ知らせていない期限を過ぎた請求書の管理者全員に鈴を 1 通ずつ・印・記録 1 行。中から呼ぶだけ
--   ③ app.ops_invoices(月, 状態, 件数)：知らせ → その月の請求書と、前の月の分でも期限を過ぎた物を上に。1 行は K-982 の app.billing_invoice_row
--   ②③ は頭で app.ops_require('money')（K-947 の型・2 層目）。状態の決めは app.billing_invoice_row の state（K-982 の app.invoice_state・同じ決めを 2 つ書かない）
--   どれも security definer・search_path に pg_temp・public から外す（D-128.171）。アプリに渡すのは ③ だけ。日付は日本の暦（Asia/Tokyo）

alter table invoices add column if not exists overdue_noticed_at timestamptz;
alter table invoices add column if not exists overdue_week_noticed_at timestamptz;

-- 期限を過ぎた知らせ。期限が日本の今日の 7 日前より後 → billing.overdue（1 回）・7 日前以前 → billing.overdue_week（1 回・期限を過ぎたの印が空なら同じ時刻を入れ、overdue は出さない）。
--   払われた・期限の前・当日は出さない。行を for update で取るので、同時の 2 回は並び、後の方は印を見て書かない。返すのは出した鈴の数
create or replace function app.ops_invoice_overdue_notify() returns integer
language plpgsql volatile security definer set search_path = public, app, pg_temp as $$
declare
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  r record;
  v_row jsonb;
  v_kind text;
  v_reason text;
  v_sent integer := 0;
  n integer;
begin
  perform app.ops_require('money');
  for r in
    select v.id, v.tenant_id, v.due_on, v.period_start
      from invoices v
     where v.tenant_id <> app.ops_tenant_id() and v.issued_at is not null and v.deleted_at is null
       and v.due_on < v_today
       and (v.overdue_noticed_at is null or v.overdue_week_noticed_at is null)
     order by v.id
       for update of v
  loop
    v_row := app.billing_invoice_row(r.id);
    continue when v_row is null or v_row ->> 'state' is distinct from 'overdue';
    v_kind := null;
    -- 取った後の今の印で決める（同時に開いた前の取引が書いた印を見る）
    if r.due_on <= v_today - 7 then
      if exists (select 1 from invoices x where x.id = r.id and x.overdue_week_noticed_at is null) then
        v_kind := 'billing.overdue_week';
        v_reason := '期限から 7 日';
        update invoices
           set overdue_week_noticed_at = now(), overdue_noticed_at = coalesce(overdue_noticed_at, now())
         where id = r.id;
      end if;
    elsif exists (select 1 from invoices x where x.id = r.id and x.overdue_noticed_at is null) then
      v_kind := 'billing.overdue';
      v_reason := '期限を過ぎた';
      update invoices set overdue_noticed_at = now() where id = r.id;
    end if;
    continue when v_kind is null;

    -- その会社の管理者全員に画面の鈴（メールは送らない・D-156.11）
    insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, sent_at, created_by)
    select r.tenant_id, tm.member_id, 'inapp', v_kind,
           jsonb_build_object('invoice_id', r.id, 'month', v_row -> 'month', 'amount_total', v_row -> 'amount_total',
                              'due_on', to_char(r.due_on, 'YYYY-MM-DD')),
           now(), app.user_id()
      from tenant_memberships tm
      join members m on m.id = tm.member_id and m.tenant_id = r.tenant_id and m.deleted_at is null
     where tm.tenant_id = r.tenant_id and tm.role = 'admin' and tm.status = 'active' and tm.deleted_at is null;
    get diagnostics n = row_count;
    v_sent := v_sent + n;

    perform app.record_ops_audit(r.tenant_id, 'invoice.overdue_notice', 'invoices', r.id::text, null,
      jsonb_build_object('target_label', extract(month from r.period_start)::integer || ' 月分', 'reason', v_reason));
  end loop;
  return v_sent;
end $$;
revoke all on function app.ops_invoice_overdue_notify() from public;

-- 運営の請求の一覧。月を省くと日本の先月。出すのは、運営の会社でない会社の、消していない・出した請求書のうち
--   その月の物と、前の月の物で期限を過ぎた物。並びは 期限を過ぎた物（期限の古い順）→ ほか、その中はワークスペースの名前 → id
create or replace function app.ops_invoices(p_month text, p_state text, p_limit integer) returns jsonb
language plpgsql volatile security definer set search_path = public, app, pg_temp as $$
declare
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_m1 date;
  v_rows jsonb;
begin
  perform app.ops_require('money');
  perform app.ops_invoice_overdue_notify();

  if p_month is null then
    v_m1 := (date_trunc('month', v_today) - interval '1 month')::date;
  elsif p_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
    v_m1 := to_date(p_month || '-01', 'YYYY-MM-DD');
  else
    raise exception 'month の形が違う' using errcode = 'invalid_parameter_value';
  end if;
  if p_state is not null and p_state not in ('unpaid', 'paid', 'overdue') then
    raise exception 'state の値が違う' using errcode = 'invalid_parameter_value';
  end if;

  with picked as (
    select v.id, v.due_on, v.period_start, t.name, app.billing_invoice_row(v.id) as j
      from invoices v
      join tenants t on t.id = v.tenant_id
     where v.tenant_id <> app.ops_tenant_id() and v.issued_at is not null and v.deleted_at is null
       and v.period_start < (v_m1 + interval '1 month')::date
       and (v.period_start >= v_m1 or v.due_on < v_today)
  ), shown as (
    select p.*, (p.j ->> 'state') = 'overdue' as late
      from picked p
     where p.j is not null
  ), kept as (
    -- その月の物は状態を問わず・前の月の物は期限を過ぎた物だけ
    select s.* from shown s
     where (s.period_start >= v_m1 or s.late)
       and (p_state is null or s.j ->> 'state' = p_state)
     order by s.late desc, case when s.late then s.due_on end, s.name, s.id
     limit coalesce(p_limit, 100)
  )
  select coalesce(jsonb_agg(k.j order by k.late desc, case when k.late then k.due_on end, k.name, k.id), '[]'::jsonb)
    into v_rows
    from kept k;

  return jsonb_build_object('data', v_rows);
end $$;
revoke all on function app.ops_invoices(text, text, integer) from public;
grant execute on function app.ops_invoices(text, text, integer) to kaname_app;
