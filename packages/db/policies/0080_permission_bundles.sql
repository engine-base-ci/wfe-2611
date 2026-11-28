-- RLS（機械生成：scripts/ci/gen_rls.py ← 07_functional/entities.json の access_control_policies。手で直さない）

alter table role_bundle_defaults enable row level security;
alter table role_bundle_defaults force row level security;
do $$ declare r record; begin for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'role_bundle_defaults' and policyname <> all (array['role_bundle_defaults_all_read']::name[]) loop execute format('drop policy %I on role_bundle_defaults', r.policyname); end loop; end $$;
drop policy if exists role_bundle_defaults_all_read on role_bundle_defaults;
create policy role_bundle_defaults_all_read on role_bundle_defaults for select using (coalesce(current_setting('app.user_id', true), '') <> '' AND (true));
