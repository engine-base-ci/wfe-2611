-- 20261128032700 請求書の型（K-1107・契約の口 getOpsInvoiceTemplate・updateOpsInvoiceTemplate・D-156.59・D-156.60・D-128.108・関門 C2）
--   ① 表 ops_invoice_templates：運営の会社に 1 行（一意 tenant_id＝型は 1 つ）。出す側の会社名・住所・登録番号・連絡先・振込先・備考と版
--   ② app.invoice_issuer()：請求書に載る出す側の値だけ（版・直した人を返さない）。請求書の PDF（K-1013）と顧客の振込先（K-958）が読む 1 か所。
--      行が無ければ null（口が設定の値を初めの値に使う）
--   ③ app.ops_invoice_template()：お金を持つ運営の人に 9 欄（直した人の名前つき）か null
--   ④ app.ops_invoice_template_set(p)：版で取り合いを止める（違えば changed）。同じ値なら書かない。書いたら版＋1 と運営の記録（値の字は入れない）
--   整え（NFKC・前後の空白）と形（422）は口と入口がする。ここは受け取った字をそのまま書く

-- ① 表
create table if not exists ops_invoice_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) default app.ops_tenant_id(),
  company text not null,
  address text not null,
  reg_no text not null,
  contact text not null,
  payee text not null,
  note text not null default '',
  version integer not null default 1,
  updated_by uuid references members(id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint ops_invoice_templates_tenant_uq unique (tenant_id),
  constraint ops_invoice_templates_reg_no_check check (reg_no ~ '^T[0-9]{13}$')
);
insert into target_kinds (key, label) values ('ops_invoice_templates', 'ops_invoice_templates') on conflict do nothing;
grant select, insert, update, delete on ops_invoice_templates to kaname_app;

-- ② 請求書に載る出す側の値（顧客にも見えてよい値だけ）
create or replace function app.invoice_issuer() returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  select jsonb_build_object('company', t.company, 'address', t.address, 'reg_no', t.reg_no,
                            'contact', t.contact, 'payee', t.payee, 'note', t.note)
    from ops_invoice_templates t
   where t.tenant_id = app.ops_tenant_id()
$$;
revoke all on function app.invoice_issuer() from public;
grant execute on function app.invoice_issuer() to kaname_app;

-- 型の 1 行の 9 欄（直した人の名前は members の display_name）
create or replace function app.invoice_template_row(p_id uuid) returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  select jsonb_build_object('company', t.company, 'address', t.address, 'reg_no', t.reg_no,
                            'contact', t.contact, 'payee', t.payee, 'note', t.note, 'version', t.version,
                            'updated_at', t.updated_at, 'updated_by_name', m.display_name)
    from ops_invoice_templates t
    left join members m on m.id = t.updated_by
   where t.id = p_id
$$;
revoke all on function app.invoice_template_row(uuid) from public;

-- ③ 読む（お金を持つ運営の人）
create or replace function app.ops_invoice_template() returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare v_id uuid;
begin
  perform app.ops_require('money');
  select t.id into v_id from ops_invoice_templates t where t.tenant_id = app.ops_tenant_id();
  if v_id is null then
    return null;
  end if;
  return app.invoice_template_row(v_id);
end $$;
revoke all on function app.ops_invoice_template() from public;
grant execute on function app.ops_invoice_template() to kaname_app;

-- ④ 直す：{ company, address, reg_no, contact, payee, note?, version } → { data: 9 欄 } か { error: 'changed' }
create or replace function app.ops_invoice_template_set(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public, app, pg_temp as $$
declare
  v_ops uuid := app.ops_tenant_id();
  v_row ops_invoice_templates%rowtype;
  v_version integer := 0;
  v_new jsonb;
  v_prev jsonb := null;
  v_fields text[] := array[]::text[];
  v_key text;
  v_id uuid;
begin
  perform app.ops_require('money');

  select * into v_row from ops_invoice_templates t where t.tenant_id = v_ops for update;
  if found then
    v_version := v_row.version;
    v_prev := jsonb_build_object('company', v_row.company, 'address', v_row.address, 'reg_no', v_row.reg_no,
                                 'contact', v_row.contact, 'payee', v_row.payee, 'note', v_row.note);
  end if;

  if (p->>'version') is null or (p->>'version')::integer <> v_version then
    return jsonb_build_object('error', 'changed');
  end if;

  v_new := jsonb_build_object('company', p->>'company', 'address', p->>'address', 'reg_no', p->>'reg_no',
                              'contact', p->>'contact', 'payee', p->>'payee', 'note', coalesce(p->>'note', ''));
  if v_prev is not distinct from v_new then
    return jsonb_build_object('data', app.invoice_template_row(v_row.id));
  end if;

  foreach v_key in array array['company', 'address', 'reg_no', 'contact', 'payee', 'note'] loop
    if v_prev is null or (v_prev->>v_key) is distinct from (v_new->>v_key) then
      v_fields := v_fields || v_key;
    end if;
  end loop;

  if v_prev is null then
    -- 2 人が同時に初めて保存したら、後の方は一意の索引に当たらず changed（版 0 はもう無い）
    insert into ops_invoice_templates (tenant_id, company, address, reg_no, contact, payee, note, version, updated_by)
    values (v_ops, v_new->>'company', v_new->>'address', v_new->>'reg_no', v_new->>'contact', v_new->>'payee',
            v_new->>'note', 1, app.user_id())
    on conflict (tenant_id) do nothing
    returning id into v_id;
    if v_id is null then
      return jsonb_build_object('error', 'changed');
    end if;
  else
    update ops_invoice_templates
       set company = v_new->>'company', address = v_new->>'address', reg_no = v_new->>'reg_no',
           contact = v_new->>'contact', payee = v_new->>'payee', note = v_new->>'note',
           version = version + 1, updated_by = app.user_id(), updated_at = now()
     where id = v_row.id
    returning id into v_id;
  end if;

  perform app.record_ops_audit(v_ops, 'invoice_template.update', 'ops_invoice_templates', v_id::text, null,
                               jsonb_build_object('target_label', '請求書の型', 'fields', to_jsonb(v_fields)));

  return jsonb_build_object('data', app.invoice_template_row(v_id));
end $$;
revoke all on function app.ops_invoice_template_set(jsonb) from public;
grant execute on function app.ops_invoice_template_set(jsonb) to kaname_app;
