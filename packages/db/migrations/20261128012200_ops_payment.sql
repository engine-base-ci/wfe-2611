-- 20261128012200_ops_payment 運営が入金を 1 件ずつ記録する（K-982・契約の口 recordPayment・D-156.32・D-156.29・D-156.44・D-156.46・D-128.69・D-128.108・関門 C2）
--   ① 入金の表に振込名義 payer_name と、取り消した入金 reverses_payment_id（打ち消しの行だけが持つ）。同じ入金の取り消しは 1 つだけ（一意の索引）
--   ② 状態の決めを 1 か所に：app.invoice_state(額, 入金の合計, 期限)。入金の合計が額と同じなら paid・期限が日本の今日より前なら overdue・ほか unpaid
--      K-968 の app.tenant_invoices（K-958 の請求書の行）をこの関数を呼ぶ形に直す（答えは前のまま・D-156.46）
--   ③ 運営の請求の 1 行を 1 か所に：app.billing_invoice_row(請求書)（11 欄・入金の並び payments・D-156.44）。運営の関数の中から呼ぶだけ（アプリに渡さない）
--   ④ app.ops_payment_record(請求書, 額, 入金日, 名義, 取り消す入金)：お金を持つ運営の人だけ。請求書の行を for update で取り、
--      入金の行（取り消しなら負の同じ額の打ち消しの行）→ 請求書の status_id（paid か issued）→ 運営の記録と会社の記録（payment.record）を 1 つの取引で。
--      断りは何も書かずに {"error": "already_reversed"}（409 E-BILL-004）・{"error": "amount_mismatch"}（409 E-BILL-005）。無い請求書・入金は no_data_found（404）
--   足りない・多いは「お支払い待ち」のまま差を残す（D-156.32）。鈴・メールは出さない（D-125.130）。暦はどれも日本（Asia/Tokyo）

-- ① 入金の表の 2 列と一意の索引
alter table payments add column if not exists payer_name text;
alter table payments add column if not exists reverses_payment_id uuid references payments(id);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'payments_payer_name_check') then
    alter table payments add constraint payments_payer_name_check
      check (payer_name is null or char_length(payer_name) between 1 and 100);
  end if;
end $$;
create unique index if not exists payments_reverses_uq on payments (reverses_payment_id)
  where reverses_payment_id is not null and deleted_at is null;

-- ② 状態の決め（1 か所）
create or replace function app.invoice_state(p_amount numeric, p_paid numeric, p_due date) returns text
language sql stable set search_path = public, app, pg_temp as $$
  select case when coalesce(p_paid, 0) = coalesce(p_amount, 0) then 'paid'
              when p_due < (now() at time zone 'Asia/Tokyo')::date then 'overdue'
              else 'unpaid' end
$$;
revoke all on function app.invoice_state(numeric, numeric, date) from public;
grant execute on function app.invoice_state(numeric, numeric, date) to kaname_app;

-- ② K-968 の請求書の行（K-958 の決め）を、状態の決めを app.invoice_state に寄せた形に直す（答えの欄・並びは前のまま）
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
    select inv.*, app.invoice_state(amount, paid_total, due_on) as state
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

-- ③ 運営の請求の 1 行（11 欄）。payments は打ち消しの行でない入金を入金日・作った順に { id, paid_on, amount, payer_name, reversed }
create or replace function app.billing_invoice_row(p_invoice uuid) returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  with i as (
    select i.*, round(coalesce(i.amount, 0))::bigint as total,
           (select round(coalesce(sum(x.amount), 0))::bigint from payments x
             where x.invoice_id = i.id and x.tenant_id = i.tenant_id and x.deleted_at is null) as paid
      from invoices i where i.id = p_invoice
  )
  select jsonb_build_object(
           'id', i.id,
           'workspace', jsonb_build_object('id', t.id, 'name', t.name),
           'plan_name', coalesce(nullif(i.plan_name, ''),
                                 (select pl.name from subscriptions s join plans pl on pl.id = s.plan_id where s.id = i.subscription_id)),
           'month', to_char(i.period_start, 'YYYY-MM'),
           'amount_total', i.total,
           'state', app.invoice_state(i.total, i.paid, i.due_on),
           'paid_total', i.paid,
           'difference', i.total - i.paid,
           'due_on', to_char(i.due_on, 'YYYY-MM-DD'),
           'can_record_payment', app.invoice_state(i.total, i.paid, i.due_on) <> 'paid',
           'payments', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', p.id,
                      'paid_on', to_char(p.paid_on, 'YYYY-MM-DD'),
                      'amount', round(coalesce(p.amount, 0))::bigint,
                      'payer_name', p.payer_name,
                      'reversed', exists (select 1 from payments r where r.reverses_payment_id = p.id and r.deleted_at is null))
                    order by p.paid_on, p.created_at, p.id)
               from payments p
              where p.invoice_id = i.id and p.tenant_id = i.tenant_id and p.deleted_at is null
                and p.reverses_payment_id is null), '[]'::jsonb))
    from i join tenants t on t.id = i.tenant_id
$$;
revoke all on function app.billing_invoice_row(uuid) from public;

-- ④ 入金を記録する（お金を持つ運営の人だけ・本人確認の取り直しは入口）
create or replace function app.ops_payment_record(p_invoice uuid, p_amount integer, p_paid_on date, p_payer text, p_reverses uuid)
returns jsonb
language plpgsql volatile security definer set search_path = public, app, pg_temp as $$
declare
  v_inv invoices%rowtype;
  v_rev payments%rowtype;
  v_id uuid;
  v_total bigint;
  v_paid bigint;
  v_payload jsonb;
begin
  perform app.ops_require('money');

  -- 請求書：運営の会社でない会社の、消していない・出した物。同時の入金・取り消しでも合計と状態がずれないよう行を取る
  select * into v_inv from invoices
   where id = p_invoice and tenant_id <> app.ops_tenant_id() and deleted_at is null and issued_at is not null
   for update;
  if v_inv.id is null then
    raise exception '請求書が無い' using errcode = 'no_data_found';
  end if;

  -- 取り消し：その請求書の、消していない、正の額の入金だけ
  if p_reverses is not null then
    select * into v_rev from payments
     where id = p_reverses and invoice_id = v_inv.id and tenant_id = v_inv.tenant_id and deleted_at is null
     for update;
    if v_rev.id is null then
      raise exception '取り消す入金が無い' using errcode = 'no_data_found';
    end if;
    if v_rev.reverses_payment_id is not null or coalesce(v_rev.amount, 0) <= 0
       or exists (select 1 from payments r where r.reverses_payment_id = v_rev.id and r.deleted_at is null) then
      return jsonb_build_object('error', 'already_reversed');
    end if;
    if v_rev.amount <> p_amount then
      return jsonb_build_object('error', 'amount_mismatch');
    end if;
  end if;

  insert into payments (tenant_id, invoice_id, paid_on, amount, payer_name, method_id, recorded_by_ops_member_id,
                        reverses_payment_id, created_by, updated_by)
  values (v_inv.tenant_id, v_inv.id, p_paid_on,
          case when p_reverses is null then p_amount else -p_amount end,
          p_payer, 'transfer', app.user_id(), p_reverses, app.user_id(), app.user_id())
  returning id into v_id;

  -- 払われたかの決めの後に請求書の status_id を書き直す（合計＝額は paid・ほかは issued）
  v_total := round(coalesce(v_inv.amount, 0))::bigint;
  select round(coalesce(sum(x.amount), 0))::bigint into v_paid
    from payments x where x.invoice_id = v_inv.id and x.tenant_id = v_inv.tenant_id and x.deleted_at is null;
  update invoices set status_id = case when v_paid = v_total then 'paid' else 'issued' end, updated_by = app.user_id()
   where id = v_inv.id;

  v_payload := jsonb_build_object(
    'target_label', format('%s 月分 ¥%s', extract(month from v_inv.period_start)::int, to_char(v_total, 'FM999,999,999,999,990')));
  if p_reverses is not null then
    v_payload := v_payload || jsonb_build_object('reason', '入金の取り消し');
  end if;
  perform app.record_ops_audit(v_inv.tenant_id, 'payment.record', 'payments', v_id::text, null, v_payload);

  return jsonb_build_object('data', app.billing_invoice_row(v_inv.id));
end $$;
revoke all on function app.ops_payment_record(uuid, integer, date, text, uuid) from public;
grant execute on function app.ops_payment_record(uuid, integer, date, text, uuid) to kaname_app;

insert into app.schema_migrations (name) values ('20261128012200_ops_payment.sql') on conflict do nothing;
