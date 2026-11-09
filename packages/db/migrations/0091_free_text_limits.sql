-- K-144 ㉝（D-130.3・D-130.4）：人が自由に書く欄に上限を置かず、黙って切らない。守りは入口（apps/api/src/contract/op.ts）の送る量 1MB だけ
--   (1) チケットの下書きの大きさの決まり（0090 の check (pg_column_size(body) <= 200000)）を外す（縮まない 450KB の下書きが 23514 → 500 にならない）
--   (2) 記憶を直す：送った題と本文を切らない。題を送らないときに本文の頭から題を作るのは残す（書いたものを消さない）
--   (3) 会話の名前を変える：送った名前を切らない
--   ほかの式・権限は 0041・0043 のまま。search_path に pg_temp を足し、execute は kaname_app だけ（D-128.171）

alter table app.ticket_drafts drop constraint if exists ticket_drafts_body_check;

create or replace function app.agent_memory_edit(p_member uuid, p_memory uuid, p_title text, p_body text) returns boolean
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare n int;
begin
  update memories set title = coalesce(nullif(trim(p_title), ''), left(trim(p_body), 80)), body = trim(p_body), updated_by = p_member
   where id = p_memory and owner_member_id = p_member and deleted_at is null and coalesce(trim(p_body), '') <> '';
  get diagnostics n = row_count; return n > 0;
end $$;
revoke all on function app.agent_memory_edit(uuid, uuid, text, text) from public;
grant execute on function app.agent_memory_edit(uuid, uuid, text, text) to kaname_app;

create or replace function app.agent_conversation_set(p_member uuid, p_conv uuid, p_title text, p_starred boolean, p_incognito boolean) returns boolean
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare n int;
begin
  update conversations set
      title = case when p_title is not null and trim(p_title) <> '' then trim(p_title) else title end,
      title_auto = case when p_title is not null and trim(p_title) <> '' then false else title_auto end,
      starred_at = case when p_starred is null then starred_at when p_starred then coalesce(starred_at, now()) else null end,
      incognito = coalesce(p_incognito, incognito)
    where id = p_conv and owner_member_id = p_member and deleted_at is null;
  get diagnostics n = row_count; return n > 0;
end $$;
revoke all on function app.agent_conversation_set(uuid, uuid, text, boolean, boolean) from public;
grant execute on function app.agent_conversation_set(uuid, uuid, text, boolean, boolean) to kaname_app;

insert into app.schema_migrations (name) values ('0091_free_text_limits.sql') on conflict do nothing;
