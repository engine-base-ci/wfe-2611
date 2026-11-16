-- 0102 チケットの一覧の口（K-92・D-128.152・D-128.157・D-128.158・D-128.159）
--   ① 一覧の並び（自分に関わるもの：期限 → 更新 → id／すべて：更新 → id）と題名の部分一致の索引
--   ② 消したチケット（deleted_at）を行の守りの関数 app.ticket_visible でも外す（口と行の守りの 2 重・D-128.158）。
--      行の守り tickets_read・tickets_client_read は同じ番号の policies（07_functional/entities.json から生成）が直す
--   ③ チケットを消すのは app.ticket_soft_delete だけ。行の守りに deleted_at を入れると、共通の softDelete（where で deleted_at を読む更新）は
--      新しい行が select の守りに落ちて弾かれるため（口の共通の delete は表が tickets のときこの関数を呼ぶ・apps/api/src/contract/op.ts）
--   新しい表・列は作らない。

-- ---------------------------------------------------------------- ① 索引
create index if not exists tickets_list_mine_idx on tickets (tenant_id, due_on, updated_at desc, id);
create index if not exists tickets_list_all_idx on tickets (tenant_id, updated_at desc, id);
-- 題名の部分一致（全角半角と大文字小文字をそろえた形）。pg_trgm が使えるときだけ作る（無い DB でも migration は通す・G-11）
do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_trgm') then
    raise notice 'pg_trgm が無いので題名の索引は作らない';
    return;
  end if;
  begin
    create extension if not exists pg_trgm;
  exception when insufficient_privilege then
    raise notice 'pg_trgm を入れる権限が無いので題名の索引は作らない';
    return;
  end;
  execute 'create index if not exists tickets_title_trgm_idx on tickets using gin (lower(normalize(title, NFKC)) gin_trgm_ops)';
end $$;

-- ---------------------------------------------------------------- ② 見えるチケット（消したものを外す）
--   0072 の本体を写し、変えた所は「and t.deleted_at is null」の 1 行だけ
create or replace function app.ticket_visible(tid uuid) returns boolean language sql stable security definer set search_path = public, app as $$
  select exists (
    select 1 from tickets t
    where t.id = tid and t.tenant_id = app.tenant_id()
      and t.deleted_at is null
      and app.ticket_draft_ok(t.draft_import_id, app.user_id())
      and (t.scope_id = any(visible_scopes(app.user_id())) or t.assignee_member_id = app.user_id() or app.ticket_involved(t.id, app.user_id()))
  )
$$;
grant execute on function app.ticket_visible(uuid) to kaname_app;

-- ---------------------------------------------------------------- ③ チケットを消す（論理削除）
--   呼んだ人に見えて、そのグループで tickets の edit を持つときだけ deleted_at を立てて true。それ以外は何もせず false。
--   呼んだ人は app.user_id() で引く（引数で人を受けない）。消した記録は repository の softDelete と同じ形（tickets.delete・関門 C2）
create or replace function app.ticket_soft_delete(p_id uuid) returns boolean
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_me uuid := app.user_id(); v_scope uuid;
begin
  if v_me is null or app.tenant_id() is null or not app.member_ok() then return false; end if;
  if not app.ticket_visible(p_id) then return false; end if;
  select t.scope_id into v_scope from tickets t
   where t.id = p_id and t.tenant_id = app.tenant_id() and t.deleted_at is null for update;
  if v_scope is null or not has_permission(v_me, 'tickets', v_scope, 'edit') then return false; end if;
  update tickets set deleted_at = now(), deleted_by = v_me, updated_by = v_me
   where id = p_id and tenant_id = app.tenant_id() and deleted_at is null;
  if not found then return false; end if;
  perform app.record_audit('tickets.delete', 'tickets', p_id::text, 'C2', '{}'::jsonb);
  return true;
end $$;
revoke all on function app.ticket_soft_delete(uuid) from public;
grant execute on function app.ticket_soft_delete(uuid) to kaname_app;

insert into app.schema_migrations (name) values ('0102_ticket_list.sql') on conflict do nothing;
