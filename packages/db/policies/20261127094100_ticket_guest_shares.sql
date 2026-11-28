-- RLS（機械生成：scripts/ci/gen_rls.py ← 07_functional/entities.json の access_control_policies。手で直さない）

alter table ticket_guest_shares enable row level security;
alter table ticket_guest_shares force row level security;
do $$ declare r record; begin for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'ticket_guest_shares' and policyname <> all (array['ticket_guest_shares_ops_read_with_grant', 'ticket_guest_shares_ticket_read', 'ticket_guest_shares_ticket_write_delete', 'ticket_guest_shares_ticket_write_insert', 'ticket_guest_shares_ticket_write_update']::name[]) loop execute format('drop policy %I on ticket_guest_shares', r.policyname); end loop; end $$;
drop policy if exists ticket_guest_shares_ticket_read on ticket_guest_shares;
create policy ticket_guest_shares_ticket_read on ticket_guest_shares for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND app.ticket_visible(ticket_id)));
drop policy if exists ticket_guest_shares_ticket_write_insert on ticket_guest_shares;
create policy ticket_guest_shares_ticket_write_insert on ticket_guest_shares for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND app.ticket_writable(ticket_id)));
drop policy if exists ticket_guest_shares_ticket_write_update on ticket_guest_shares;
create policy ticket_guest_shares_ticket_write_update on ticket_guest_shares for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND app.ticket_writable(ticket_id))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND app.ticket_writable(ticket_id)));
drop policy if exists ticket_guest_shares_ticket_write_delete on ticket_guest_shares;
create policy ticket_guest_shares_ticket_write_delete on ticket_guest_shares for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND app.ticket_writable(ticket_id)));
drop policy if exists ticket_guest_shares_ops_read_with_grant on ticket_guest_shares;
create policy ticket_guest_shares_ops_read_with_grant on ticket_guest_shares for select using (app.ops_grant_ok(ticket_guest_shares.tenant_id));
