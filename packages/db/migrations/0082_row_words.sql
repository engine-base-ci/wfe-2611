-- 0082 行に結ぶ言葉の確かめ（KN-52・ZT4・D-128.88）
--   app.manages_scope(グループ)：呼んだ人が、そのグループ（か上のグループ）のマネージャーか、会社の管理者か。
--   マネージャーは、グループの役割（scope_memberships.role = 'manager'）と、主の所属に行が無いときのワークスペースの役割（tenant_memberships.role）の両方を見る（役割の束 0080 と同じ決め方）。
--   入口（apps/api/src/contract/op.ts の 4.1）が scripts/ci/row_rules.mjs の条件の中で使う。
create or replace function app.manages_scope(s uuid) returns boolean language sql stable security definer set search_path = public, app as $$
  select s is not null and (
    app.is_admin(app.user_id())
    or exists (
      select 1 from scope_memberships sm
      where sm.member_id = app.user_id() and sm.tenant_id = app.tenant_id() and sm.role = 'manager' and sm.deleted_at is null
        and s in (select app.scope_tree(sm.scope_id))
    )
    or exists (
      select 1 from tenant_memberships tm join members m on m.id = tm.member_id and m.tenant_id = tm.tenant_id
      where tm.member_id = app.user_id() and tm.tenant_id = app.tenant_id() and tm.role = 'manager' and tm.status = 'active' and tm.deleted_at is null
        and m.scope_id is not null and s in (select app.scope_tree(m.scope_id))
        and not exists (select 1 from scope_memberships sm2 where sm2.member_id = tm.member_id and sm2.scope_id = m.scope_id and sm2.deleted_at is null)
    )
  )
$$;
grant execute on function app.manages_scope(uuid) to kaname_app;

insert into app.schema_migrations (name) values ('0082_row_words.sql') on conflict do nothing;
