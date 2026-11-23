-- 20261125012100 ページを消すときの下書きの版（K-681・契約の口 deleteKnowledgePage・D-152.14）
--   新しい表・列は作らない。関数を 1 つ足す。同じ migration をもう 1 度当てても壊れない（create or replace）。
--
-- app.kn_page_drop_drafts(p)：ページを消す前に、そのページの生きている下書きの版（だれの物でも）に消した印を入れる。数を返す。
--   行の守り（knowledge_page_versions_decide）は他人の下書きの版を直させないので、口からは消せない。ここで消す。
--   呼んだ人がそのページに書けない（app.kpage_writable が偽・消した後）なら何もしない（0）。公開の版は触らない（履歴として残す）
create or replace function app.kn_page_drop_drafts(p uuid) returns int
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare n int;
begin
  if not app.kpage_writable(p) then
    return 0;
  end if;
  update knowledge_page_versions set deleted_at = now(), updated_by = app.user_id()
   where page_id = p and tenant_id = app.tenant_id() and kind = 'draft' and deleted_at is null;
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function app.kn_page_drop_drafts(uuid) from public;
grant execute on function app.kn_page_drop_drafts(uuid) to kaname_app;
