-- 20261128041300 請求書をまとめて出す関数の「中身が変わった」を両向きで見る（K-1013・D-156.31・関門 C2）
--   20261128012100（K-981）は p_pdf の会社が今の行に無い・額が違うときだけ changed だった。逆に、PDF を作って置いている間に
--   出す会社が増えると（下書きの消し・会社の戻し・半作りの解消 等）、その会社は pdf_ref が空のまま請求書が出ていた。
--   出す（下書きでない）ときは、今の行の会社が p_pdf に 1 つでも無ければ changed を返し、何も書かない（出した請求書は必ず PDF を持つ）。
--   口（apps/api/src/features/F12/ops/invoices-issue.ts）は出すときいつも全部の会社の PDF を渡す。0 行なら p_pdf も空で nothing_to_issue のまま
--   ほかは 20261128012100 と同じ（関数を置き換えるだけ・表は変えない）

create or replace function app.ops_invoices_issue(p_month text, p_dry boolean, p_pdf jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public, app, pg_temp as $$
declare
  v_me uuid; v_start date; v_end date; v_due date; v_label text; v_lines jsonb; v_l jsonb;
  v_pdf jsonb := coalesce(p_pdf, '{}'::jsonb); v_out jsonb := '[]'::jsonb; v_total bigint := 0;
  v_tenant uuid; v_id uuid; v_line_total bigint;
begin
  perform app.ops_require('money');
  v_me := app.user_id();
  if p_month is null or p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
    raise exception '月の形が違う' using errcode = 'invalid_parameter_value';
  end if;
  v_start := (p_month || '-01')::date;
  if v_start >= date_trunc('month', (now() at time zone 'Asia/Tokyo')::date)::date then
    return jsonb_build_object('error', 'month_open');
  end if;
  perform pg_advisory_xact_lock(hashtext('ops_invoices_issue:' || p_month));
  v_lines := app.ops_invoice_lines(p_month);

  if coalesce(p_dry, false) then
    return jsonb_build_object('data', jsonb_build_object(
      'month', p_month,
      'count', jsonb_array_length(v_lines),
      'total', (select coalesce(sum((e.l ->> 'total')::bigint), 0) from jsonb_array_elements(v_lines) e(l)),
      'lines', (select coalesce(jsonb_agg(e.l - 'subscription_id' - 'contact' order by e.o), '[]'::jsonb)
                  from jsonb_array_elements(v_lines) with ordinality e(l, o))));
  end if;

  -- 両向き（K-1013）：PDF 側の会社が今の行に無い・額が違う、または今の行の会社が PDF 側に無い（PDF を作る間に出す会社が増えた）なら changed
  if exists (select 1 from jsonb_each(v_pdf) k(tid, v)
              where not exists (select 1 from jsonb_array_elements(v_lines) e(l)
                                 where e.l -> 'workspace' ->> 'id' = k.tid
                                   and (e.l ->> 'total')::bigint = (k.v ->> 'total')::bigint))
     or exists (select 1 from jsonb_array_elements(v_lines) e(l)
                 where not (v_pdf ? (e.l -> 'workspace' ->> 'id'))) then
    return jsonb_build_object('error', 'changed');
  end if;

  v_end := (v_start + interval '1 month' - interval '1 day')::date;
  v_due := (v_start + interval '2 month' - interval '1 day')::date;
  v_label := extract(month from v_start)::int || ' 月分';
  for v_l in select e.l from jsonb_array_elements(v_lines) e(l) loop
    v_tenant := (v_l -> 'workspace' ->> 'id')::uuid;
    v_line_total := (v_l ->> 'total')::bigint;
    insert into invoices (id, tenant_id, subscription_id, period_start, period_end, amount,
                          plan_name, price_amount, tax_amount, prorated_amount,
                          issued_at, due_on, status_id, pdf_ref, created_by)
    values (coalesce(nullif(v_pdf -> v_tenant::text ->> 'invoice_id', '')::uuid, gen_random_uuid()),
            v_tenant, nullif(v_l ->> 'subscription_id', '')::uuid, v_start, v_end, v_line_total,
            v_l ->> 'plan_name', (v_l ->> 'amount')::int, (v_l ->> 'tax')::int, (v_l ->> 'prorated')::int,
            now(), v_due, 'issued', nullif(v_pdf -> v_tenant::text ->> 'pdf_ref', ''), v_me)
    on conflict (tenant_id, period_start) where issued_at is not null and deleted_at is null do nothing
    returning id into v_id;
    if not found then continue; end if;

    perform app.record_ops_audit(v_tenant, 'invoice.issue', 'invoices', v_id::text, null,
                                 jsonb_build_object('target_label', v_label, 'amount_total', v_line_total));
    insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, created_by)
    select v_tenant, m.id, 'inapp', 'billing.invoice_issued',
           jsonb_build_object('invoice_id', v_id, 'month', p_month, 'amount_total', v_line_total, 'due_on', v_due::text),
           v_me
      from tenant_memberships tm
      join members m on m.id = tm.member_id
     where tm.tenant_id = v_tenant and tm.role = 'admin' and tm.status = 'active'
       and tm.deleted_at is null and m.deleted_at is null;

    v_out := v_out || jsonb_build_array(v_l - 'subscription_id' - 'contact');
    v_total := v_total + v_line_total;
  end loop;

  if jsonb_array_length(v_out) = 0 then
    return jsonb_build_object('error', 'nothing_to_issue');
  end if;
  return jsonb_build_object('data', jsonb_build_object(
    'month', p_month, 'count', jsonb_array_length(v_out), 'total', v_total, 'lines', v_out));
end $$;
revoke all on function app.ops_invoices_issue(text, boolean, jsonb) from public;
grant execute on function app.ops_invoices_issue(text, boolean, jsonb) to kaname_app;
