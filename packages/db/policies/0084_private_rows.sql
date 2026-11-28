-- RLS（機械生成：scripts/ci/gen_rls.py ← 07_functional/entities.json の access_control_policies。手で直さない）

alter table conversations enable row level security;
alter table conversations force row level security;
do $$ declare r record; begin for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'conversations' and policyname <> all (array['conversations_ops_read_with_grant', 'conversations_self_only_write_delete', 'conversations_self_only_write_insert', 'conversations_self_only_write_update', 'conversations_self_read']::name[]) loop execute format('drop policy %I on conversations', r.policyname); end loop; end $$;
drop policy if exists conversations_self_read on conversations;
create policy conversations_self_read on conversations for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND (owner_member_id = app.user_id() OR app.user_id() = ANY(participant_member_ids))));
drop policy if exists conversations_self_only_write_insert on conversations;
create policy conversations_self_only_write_insert on conversations for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND owner_member_id = app.user_id()));
drop policy if exists conversations_self_only_write_update on conversations;
create policy conversations_self_only_write_update on conversations for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND owner_member_id = app.user_id())) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND owner_member_id = app.user_id()));
drop policy if exists conversations_self_only_write_delete on conversations;
create policy conversations_self_only_write_delete on conversations for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND owner_member_id = app.user_id()));
drop policy if exists conversations_ops_read_with_grant on conversations;
create policy conversations_ops_read_with_grant on conversations for select using (app.ops_grant_ok(conversations.tenant_id));

alter table messages enable row level security;
alter table messages force row level security;
do $$ declare r record; begin for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'messages' and policyname <> all (array['messages_conversation_read', 'messages_conversation_write_insert', 'messages_conversation_write_update', 'messages_ops_read_with_grant']::name[]) loop execute format('drop policy %I on messages', r.policyname); end loop; end $$;
drop policy if exists messages_conversation_read on messages;
create policy messages_conversation_read on messages for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND app.conversation_visible(conversation_id)));
drop policy if exists messages_conversation_write_insert on messages;
create policy messages_conversation_write_insert on messages for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND app.conversation_visible(conversation_id)));
drop policy if exists messages_conversation_write_update on messages;
create policy messages_conversation_write_update on messages for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND app.conversation_visible(conversation_id))) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND app.conversation_visible(conversation_id)));
drop policy if exists messages_ops_read_with_grant on messages;
create policy messages_ops_read_with_grant on messages for select using (app.ops_grant_ok(messages.tenant_id));

alter table memories enable row level security;
alter table memories force row level security;
do $$ declare r record; begin for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'memories' and policyname <> all (array['memories_ops_read_with_grant', 'memories_self_only_write_delete', 'memories_self_only_write_insert', 'memories_self_only_write_update', 'memories_self_read']::name[]) loop execute format('drop policy %I on memories', r.policyname); end loop; end $$;
drop policy if exists memories_self_read on memories;
create policy memories_self_read on memories for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND owner_member_id = app.user_id()));
drop policy if exists memories_self_only_write_insert on memories;
create policy memories_self_only_write_insert on memories for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND owner_member_id = app.user_id()));
drop policy if exists memories_self_only_write_update on memories;
create policy memories_self_only_write_update on memories for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND owner_member_id = app.user_id())) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND owner_member_id = app.user_id()));
drop policy if exists memories_self_only_write_delete on memories;
create policy memories_self_only_write_delete on memories for delete using (app.member_ok() AND (tenant_id = app.tenant_id() AND owner_member_id = app.user_id()));
drop policy if exists memories_ops_read_with_grant on memories;
create policy memories_ops_read_with_grant on memories for select using (app.ops_grant_ok(memories.tenant_id));

alter table inquiries enable row level security;
alter table inquiries force row level security;
do $$ declare r record; begin for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'inquiries' and policyname <> all (array['inquiries_ops_read_with_grant', 'inquiries_ops_write', 'inquiries_self_only_write_insert', 'inquiries_self_only_write_update', 'inquiries_self_read']::name[]) loop execute format('drop policy %I on inquiries', r.policyname); end loop; end $$;
drop policy if exists inquiries_self_read on inquiries;
create policy inquiries_self_read on inquiries for select using (app.member_ok() AND (tenant_id = app.tenant_id() AND opened_by_member_id = app.user_id()));
drop policy if exists inquiries_self_only_write_insert on inquiries;
create policy inquiries_self_only_write_insert on inquiries for insert with check (app.member_ok() AND (tenant_id = app.tenant_id() AND opened_by_member_id = app.user_id()));
drop policy if exists inquiries_self_only_write_update on inquiries;
create policy inquiries_self_only_write_update on inquiries for update using (app.member_ok() AND (tenant_id = app.tenant_id() AND opened_by_member_id = app.user_id())) with check (app.member_ok() AND (tenant_id = app.tenant_id() AND opened_by_member_id = app.user_id()));
drop policy if exists inquiries_ops_read_with_grant on inquiries;
create policy inquiries_ops_read_with_grant on inquiries for select using (app.ops_grant_ok(inquiries.tenant_id));
drop policy if exists inquiries_ops_write on inquiries;
create policy inquiries_ops_write on inquiries for update using (current_setting('app.role', true) = 'ops' AND tenant_id = app.tenant_id()) with check (current_setting('app.role', true) = 'ops' AND tenant_id = app.tenant_id());
