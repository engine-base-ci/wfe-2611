-- RLS（機械生成：scripts/ci/gen_rls.py ← 07_functional/entities.json の access_control_policies。手で直さない）

alter table tickets enable row level security;
alter table tickets force row level security;
drop policy if exists tickets_read on tickets;
create policy tickets_read on tickets for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND app.ticket_draft_ok(draft_import_id, app.user_id()) AND (scope_id = ANY(visible_scopes(app.user_id())) OR assignee_member_id = app.user_id() OR app.ticket_involved(id, app.user_id()))));
drop policy if exists tickets_create on tickets;
create policy tickets_create on tickets for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND app.ticket_draft_ok(draft_import_id, app.user_id()) AND has_permission(app.user_id(), 'tickets', scope_id, 'edit')));
drop policy if exists tickets_update on tickets;
create policy tickets_update on tickets for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND app.ticket_draft_ok(draft_import_id, app.user_id()) AND (has_permission(app.user_id(), 'tickets', scope_id, 'edit') OR assignee_member_id = app.user_id()))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND app.ticket_draft_ok(draft_import_id, app.user_id()) AND (has_permission(app.user_id(), 'tickets', scope_id, 'edit') OR assignee_member_id = app.user_id())));
drop policy if exists tickets_ops_read_with_grant on tickets;
create policy tickets_ops_read_with_grant on tickets for select using (app.ops_grant_ok(tickets.tenant_id));

alter table test_specs enable row level security;
alter table test_specs force row level security;
drop policy if exists test_specs_ticket_read on test_specs;
create policy test_specs_ticket_read on test_specs for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND app.ticket_visible(ticket_id)));
drop policy if exists test_specs_ticket_write_insert on test_specs;
create policy test_specs_ticket_write_insert on test_specs for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND app.ticket_writable(ticket_id)));
drop policy if exists test_specs_ticket_write_update on test_specs;
create policy test_specs_ticket_write_update on test_specs for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND app.ticket_writable(ticket_id))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND app.ticket_writable(ticket_id)));
drop policy if exists test_specs_ticket_write_delete on test_specs;
create policy test_specs_ticket_write_delete on test_specs for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND app.ticket_writable(ticket_id)));
drop policy if exists test_specs_ops_read_with_grant on test_specs;
create policy test_specs_ops_read_with_grant on test_specs for select using (app.ops_grant_ok(test_specs.tenant_id));

alter table checks enable row level security;
alter table checks force row level security;
drop policy if exists checks_ticket_read on checks;
create policy checks_ticket_read on checks for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND app.ticket_visible(ticket_id)));
drop policy if exists checks_ticket_write on checks;
create policy checks_ticket_write on checks for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND app.ticket_writable(ticket_id)));
drop policy if exists checks_ops_read_with_grant on checks;
create policy checks_ops_read_with_grant on checks for select using (app.ops_grant_ok(checks.tenant_id));

alter table ticket_decisions enable row level security;
alter table ticket_decisions force row level security;
drop policy if exists ticket_decisions_ticket_read on ticket_decisions;
create policy ticket_decisions_ticket_read on ticket_decisions for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND app.ticket_visible(ticket_id)));
drop policy if exists ticket_decisions_ticket_write_insert on ticket_decisions;
create policy ticket_decisions_ticket_write_insert on ticket_decisions for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND app.ticket_writable(ticket_id)));
drop policy if exists ticket_decisions_ticket_write_update on ticket_decisions;
create policy ticket_decisions_ticket_write_update on ticket_decisions for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND app.ticket_writable(ticket_id))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND app.ticket_writable(ticket_id)));
drop policy if exists ticket_decisions_ops_read_with_grant on ticket_decisions;
create policy ticket_decisions_ops_read_with_grant on ticket_decisions for select using (app.ops_grant_ok(ticket_decisions.tenant_id));

alter table ticket_messages enable row level security;
alter table ticket_messages force row level security;
drop policy if exists ticket_messages_ticket_read on ticket_messages;
create policy ticket_messages_ticket_read on ticket_messages for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND app.ticket_visible(ticket_id)));
drop policy if exists ticket_messages_post on ticket_messages;
create policy ticket_messages_post on ticket_messages for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND app.ticket_visible(ticket_id) AND ((kind = 'post' AND author_member_id = app.user_id()) OR (kind <> 'post' AND app.ticket_writable(ticket_id)))));
drop policy if exists ticket_messages_own_update on ticket_messages;
create policy ticket_messages_own_update on ticket_messages for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND author_member_id = app.user_id() AND app.ticket_visible(ticket_id))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND author_member_id = app.user_id() AND app.ticket_visible(ticket_id)));
drop policy if exists ticket_messages_ops_read_with_grant on ticket_messages;
create policy ticket_messages_ops_read_with_grant on ticket_messages for select using (app.ops_grant_ok(ticket_messages.tenant_id));

alter table reference_logs enable row level security;
alter table reference_logs force row level security;
drop policy if exists reference_logs_ticket_read on reference_logs;
create policy reference_logs_ticket_read on reference_logs for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND app.ticket_visible(ticket_id)));
drop policy if exists reference_logs_ticket_write on reference_logs;
create policy reference_logs_ticket_write on reference_logs for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND app.ticket_writable(ticket_id)));
drop policy if exists reference_logs_ops_read_with_grant on reference_logs;
create policy reference_logs_ops_read_with_grant on reference_logs for select using (app.ops_grant_ok(reference_logs.tenant_id));

alter table ticket_links enable row level security;
alter table ticket_links force row level security;
drop policy if exists ticket_links_both_read on ticket_links;
create policy ticket_links_both_read on ticket_links for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND app.ticket_visible(from_ticket_id) AND app.ticket_visible(to_ticket_id)));
drop policy if exists ticket_links_write_insert on ticket_links;
create policy ticket_links_write_insert on ticket_links for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND app.ticket_writable(from_ticket_id) AND app.ticket_visible(to_ticket_id)));
drop policy if exists ticket_links_write_update on ticket_links;
create policy ticket_links_write_update on ticket_links for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND app.ticket_writable(from_ticket_id) AND app.ticket_visible(to_ticket_id))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND app.ticket_writable(from_ticket_id) AND app.ticket_visible(to_ticket_id)));
drop policy if exists ticket_links_write_delete on ticket_links;
create policy ticket_links_write_delete on ticket_links for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND app.ticket_writable(from_ticket_id) AND app.ticket_visible(to_ticket_id)));
drop policy if exists ticket_links_ops_read_with_grant on ticket_links;
create policy ticket_links_ops_read_with_grant on ticket_links for select using (app.ops_grant_ok(ticket_links.tenant_id));

alter table ticket_handovers enable row level security;
alter table ticket_handovers force row level security;
drop policy if exists ticket_handovers_read on ticket_handovers;
create policy ticket_handovers_read on ticket_handovers for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND (app.ticket_visible(ticket_id) OR from_member_id = app.user_id() OR to_member_id = app.user_id() OR has_permission(app.user_id(), 'ticket_handovers', to_scope_id, 'edit'))));
drop policy if exists ticket_handovers_create on ticket_handovers;
create policy ticket_handovers_create on ticket_handovers for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND from_member_id = app.user_id() AND app.ticket_writable(ticket_id)));
drop policy if exists ticket_handovers_answer on ticket_handovers;
create policy ticket_handovers_answer on ticket_handovers for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND (to_member_id = app.user_id() OR from_member_id = app.user_id() OR has_permission(app.user_id(), 'ticket_handovers', to_scope_id, 'edit')))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND (to_member_id = app.user_id() OR from_member_id = app.user_id() OR has_permission(app.user_id(), 'ticket_handovers', to_scope_id, 'edit'))));
drop policy if exists ticket_handovers_ops_read_with_grant on ticket_handovers;
create policy ticket_handovers_ops_read_with_grant on ticket_handovers for select using (app.ops_grant_ok(ticket_handovers.tenant_id));

alter table saved_views enable row level security;
alter table saved_views force row level security;
drop policy if exists saved_views_read on saved_views;
create policy saved_views_read on saved_views for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND (member_id = app.user_id() OR (share = 'group' AND scope_id = ANY(visible_scopes(app.user_id()))))));
drop policy if exists saved_views_create on saved_views;
create policy saved_views_create on saved_views for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND member_id = app.user_id() AND (share = 'self' OR scope_id = ANY(visible_scopes(app.user_id())))));
drop policy if exists saved_views_edit_update on saved_views;
create policy saved_views_edit_update on saved_views for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND (member_id = app.user_id() OR (share = 'group' AND has_permission(app.user_id(), 'saved_views', scope_id, 'edit'))))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND (member_id = app.user_id() OR (share = 'group' AND has_permission(app.user_id(), 'saved_views', scope_id, 'edit')))));
drop policy if exists saved_views_edit_delete on saved_views;
create policy saved_views_edit_delete on saved_views for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND (member_id = app.user_id() OR (share = 'group' AND has_permission(app.user_id(), 'saved_views', scope_id, 'edit')))));
drop policy if exists saved_views_ops_read_with_grant on saved_views;
create policy saved_views_ops_read_with_grant on saved_views for select using (app.ops_grant_ok(saved_views.tenant_id));

alter table ticket_imports enable row level security;
alter table ticket_imports force row level security;
drop policy if exists ticket_imports_read on ticket_imports;
create policy ticket_imports_read on ticket_imports for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND (uploaded_by = app.user_id() OR has_permission(app.user_id(), 'ticket_imports', NULL, 'view'))));
drop policy if exists ticket_imports_create on ticket_imports;
create policy ticket_imports_create on ticket_imports for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND uploaded_by = app.user_id() AND has_permission(app.user_id(), 'tickets', scope_id, 'edit')));
drop policy if exists ticket_imports_own_update on ticket_imports;
create policy ticket_imports_own_update on ticket_imports for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND uploaded_by = app.user_id())) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND uploaded_by = app.user_id()));
drop policy if exists ticket_imports_ops_read_with_grant on ticket_imports;
create policy ticket_imports_ops_read_with_grant on ticket_imports for select using (app.ops_grant_ok(ticket_imports.tenant_id));
