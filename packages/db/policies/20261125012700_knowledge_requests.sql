-- RLS（機械生成：scripts/ci/gen_rls.py ← 07_functional/entities.json の access_control_policies。手で直さない）

alter table knowledge_requests enable row level security;
alter table knowledge_requests force row level security;
do $$ declare r record; begin for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'knowledge_requests' and policyname <> all (array['knowledge_requests_read']::name[]) loop execute format('drop policy %I on knowledge_requests', r.policyname); end loop; end $$;
drop policy if exists knowledge_requests_read on knowledge_requests;
create policy knowledge_requests_read on knowledge_requests for select using (coalesce(current_setting('app.user_id', true), '') <> '' AND (tenant_id = app.tenant_id() AND app.kn_request_visible(id)));
