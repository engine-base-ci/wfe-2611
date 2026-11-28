-- RLS（機械生成：scripts/ci/gen_rls.py ← 07_functional/entities.json の access_control_policies。手で直さない）

alter table knowledge_pages enable row level security;
alter table knowledge_pages force row level security;
drop policy if exists knowledge_pages_read on knowledge_pages;
create policy knowledge_pages_read on knowledge_pages for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND (owner_member_id = app.user_id() OR (NOT is_personal AND scope_id = ANY(visible_scopes(app.user_id())) AND (state <> 'draft' OR has_permission(app.user_id(), 'knowledge_pages', scope_id, 'edit'))))));
drop policy if exists knowledge_pages_create on knowledge_pages;
create policy knowledge_pages_create on knowledge_pages for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND owner_member_id = app.user_id() AND (is_personal OR has_permission(app.user_id(), 'knowledge_pages', scope_id, 'edit'))));
drop policy if exists knowledge_pages_update on knowledge_pages;
create policy knowledge_pages_update on knowledge_pages for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND (owner_member_id = app.user_id() OR (NOT is_personal AND has_permission(app.user_id(), 'knowledge_pages', scope_id, 'edit'))))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND (owner_member_id = app.user_id() OR (NOT is_personal AND has_permission(app.user_id(), 'knowledge_pages', scope_id, 'edit')))));
drop policy if exists knowledge_pages_ops_read_with_grant on knowledge_pages;
create policy knowledge_pages_ops_read_with_grant on knowledge_pages for select using (app.ops_grant_ok(knowledge_pages.tenant_id));

alter table knowledge_page_versions enable row level security;
alter table knowledge_page_versions force row level security;
drop policy if exists knowledge_page_versions_read on knowledge_page_versions;
create policy knowledge_page_versions_read on knowledge_page_versions for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND ((kind = 'published' AND app.kpage_visible(page_id)) OR app.kpage_writable(page_id))));
drop policy if exists knowledge_page_versions_add on knowledge_page_versions;
create policy knowledge_page_versions_add on knowledge_page_versions for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND ((kind = 'proposal' AND app.kpage_visible(page_id)) OR app.kpage_writable(page_id))));
drop policy if exists knowledge_page_versions_decide on knowledge_page_versions;
create policy knowledge_page_versions_decide on knowledge_page_versions for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND app.kpage_writable(page_id))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND app.kpage_writable(page_id)));
drop policy if exists knowledge_page_versions_ops_read_with_grant on knowledge_page_versions;
create policy knowledge_page_versions_ops_read_with_grant on knowledge_page_versions for select using (app.ops_grant_ok(knowledge_page_versions.tenant_id));

alter table knowledge_links enable row level security;
alter table knowledge_links force row level security;
drop policy if exists knowledge_links_read on knowledge_links;
create policy knowledge_links_read on knowledge_links for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND app.kpage_visible(from_page_id)));
drop policy if exists knowledge_links_write_insert on knowledge_links;
create policy knowledge_links_write_insert on knowledge_links for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND app.kpage_writable(from_page_id)));
drop policy if exists knowledge_links_write_update on knowledge_links;
create policy knowledge_links_write_update on knowledge_links for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND app.kpage_writable(from_page_id))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND app.kpage_writable(from_page_id)));
drop policy if exists knowledge_links_write_delete on knowledge_links;
create policy knowledge_links_write_delete on knowledge_links for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND app.kpage_writable(from_page_id)));
drop policy if exists knowledge_links_ops_read_with_grant on knowledge_links;
create policy knowledge_links_ops_read_with_grant on knowledge_links for select using (app.ops_grant_ok(knowledge_links.tenant_id));
