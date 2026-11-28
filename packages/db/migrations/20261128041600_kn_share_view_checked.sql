-- 20261128041600 共有の選びの checked を真偽にする（K-689・関門 C2・読むだけ・統合の枝）
--   20261125012900 の app.kn_share_view は checked を「g.st in ('shared', 'waiting')」で出しており、状態の無いグループ（st が null）では
--   null になっていた（行の表は「断られて帯を消していない頼みは declined（checked false）・消した後は null（checked false）」）。
--   本体を写し、checked を coalesce(…, false) にした 1 か所だけを変えた。引数・答えの鍵・権限は前のまま。もう 1 度当てても壊れない。
create or replace function app.kn_share_view(p_page uuid, p_folder uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  t record;
  v_obj uuid := coalesce(p_page, p_folder);
  v_groups jsonb;
begin
  if (p_page is null) = (p_folder is null) then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  select * into t from app.kn_share_target(p_page, p_folder);
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if not t.writable and not app.kn_share_receiver(p_page, p_folder) then
    return jsonb_build_object('ok', false, 'reason', 'denied');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'group_id', g.id, 'name', g.name, 'manager_name', g.manager_name,
           'checked', coalesce(g.st in ('shared', 'waiting'), false), 'state', g.st) order by g.name collate "C", g.id), '[]'::jsonb)
    into v_groups
    from (
      select s.id, s.name,
             coalesce((select string_agg(m.display_name, '・' order by m.display_name collate "C")
                         from app.kn_approvers_of(s.id) a join members m on m.id = a), '') as manager_name,
             case
               when exists (select 1 from knowledge_shares x
                             where x.tenant_id = app.tenant_id() and x.group_id = s.id and x.ended_at is null and x.deleted_at is null
                               and coalesce(x.page_id, x.folder_id) = v_obj) then 'shared'
               when exists (select 1 from knowledge_requests q
                             where q.tenant_id = app.tenant_id() and q.kind = 'share' and q.to_scope_id = s.id
                               and q.state = 'pending' and q.deleted_at is null and coalesce(q.page_id, q.folder_id) = v_obj) then 'waiting'
               when (select q.state = 'declined' and q.dismissed_at is null from knowledge_requests q
                      where q.tenant_id = app.tenant_id() and q.kind = 'share' and q.to_scope_id = s.id
                        and q.deleted_at is null and coalesce(q.page_id, q.folder_id) = v_obj
                      order by q.created_at desc, q.id desc limit 1) then 'declined'
               else null
             end as st
        from scopes s
       where s.tenant_id = app.tenant_id() and s.parent_id is not null and s.deleted_at is null and s.id <> t.scope_id
    ) g;
  return jsonb_build_object('ok', true,
    'target', jsonb_build_object('page_id', p_page, 'folder_id', p_folder, 'title', t.title),
    'from_group_name', app.kn_shelf_name(t.scope_id, t.is_personal),
    'groups', v_groups);
end $$;
