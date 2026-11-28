-- RLS（機械生成：scripts/ci/gen_rls.py ← 07_functional/entities.json の access_control_policies。手で直さない）

alter table ops_invoice_templates enable row level security;
alter table ops_invoice_templates force row level security;
do $$ declare r record; begin for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'ops_invoice_templates' and policyname <> all (array['ops_invoice_templates_ops_all']::name[]) loop execute format('drop policy %I on ops_invoice_templates', r.policyname); end loop; end $$;
drop policy if exists ops_invoice_templates_ops_all on ops_invoice_templates;
create policy ops_invoice_templates_ops_all on ops_invoice_templates for all using (tenant_id = app.ops_tenant_id() AND current_setting('app.role', true) = 'ops') with check (tenant_id = app.ops_tenant_id() AND current_setting('app.role', true) = 'ops');
