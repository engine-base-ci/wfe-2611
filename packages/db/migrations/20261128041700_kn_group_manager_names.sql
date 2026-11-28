-- 20261128041700 共有された側の帯のマネージャーの名前を読む（K-719・関門 C2・読むだけ・統合の枝）
--   共有された側の帯（apps/api/src/features/F9/knowledge/page-parts/shared-from.ts）は、元のグループのマネージャーの表示名を
--   要求の文脈で members から直に読んでいた。人の行の守り（members_tenant_read）は「見えるグループ（visible_scopes）の人」だけを通すので、
--   共有先の人（元のグループに入っていない）には元のグループのマネージャーが 1 人も見えず、名前がいつも空になっていた。
--   今の人の会社のグループで、そのグループのページかフォルダが今の人の入っているグループに生きたまま共有されているときだけ名前を返す関数にする。
--   返すのは表示名だけ（コードポイント順・id は返さない）。security definer・public から外し kaname_app だけ。もう 1 度当てても壊れない。
create or replace function app.kn_group_manager_names(p_group uuid) returns text[]
language sql stable security definer set search_path = public, app, pg_temp as $$
  select coalesce(array_agg(m.display_name order by m.display_name collate "C", m.id), '{}')
    from members m
   where m.tenant_id = app.tenant_id() and m.deleted_at is null
     and exists (select 1 from scopes s where s.id = p_group and s.tenant_id = app.tenant_id() and s.deleted_at is null)
     and exists (select 1 from knowledge_shares x
                  where x.tenant_id = app.tenant_id() and x.ended_at is null and x.deleted_at is null
                    and app.kn_in_group(app.user_id(), x.group_id)
                    and exists (select 1 from knowledge_pages p where p.id = x.page_id and p.scope_id = p_group
                                union all
                                select 1 from knowledge_folders f where f.id = x.folder_id and f.scope_id = p_group))
     and app.kn_group_manager(m.id, p_group)
$$;
revoke all on function app.kn_group_manager_names(uuid) from public;
grant execute on function app.kn_group_manager_names(uuid) to kaname_app;
