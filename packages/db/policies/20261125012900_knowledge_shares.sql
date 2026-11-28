-- RLS（機械生成：scripts/ci/gen_rls.py ← 07_functional/entities.json の access_control_policies。手で直さない）

alter table knowledge_shares enable row level security;
alter table knowledge_shares force row level security;
do $$ declare r record; begin for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'knowledge_shares' and policyname <> all (array['knowledge_shares_read']::name[]) loop execute format('drop policy %I on knowledge_shares', r.policyname); end loop; end $$;
drop policy if exists knowledge_shares_read on knowledge_shares;
create policy knowledge_shares_read on knowledge_shares for select using (coalesce(current_setting('app.user_id', true), '') <> '' AND (tenant_id = app.tenant_id() AND (app.kpage_writable(page_id) OR app.kfolder_writable(folder_id) OR app.kn_group_manager(app.user_id(), group_id))));
