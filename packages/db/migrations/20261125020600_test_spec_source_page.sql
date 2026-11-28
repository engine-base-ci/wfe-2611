-- 20261125020600 確認項目の行の答えに出どころのページ（source_page）を足す（K-726・D-150.39・D-152.12・関門 C2）。名前の正本は 07_functional/段10-F9/土台-knowledge.md の 6 章と 11_tickets/K-726.md
--   app.test_spec_item（K-434 が作り K-435 が使う形）を写して、答えに 1 鍵 source_page だけを足して作り直す（引数・元の 6 鍵・権限・security definer・search_path は前のまま）。
--   source_page は、出どころ knowledge で今も必ず守るで生きているページの行（K-700 の app.knowledge_guard_specs が返す行・判定はその 1 か所）だけ { id, title（ページの今の題名） }。
--   それ以外（人が足した行・必ず守るが外れた・消えた・下書き・範囲の外・任せた人が会社を抜けた・出どころの id が空か指す先が無い）は null（鍵は常に在る・落ちない）。
--   読むだけ。何も書かない。もう 1 度当てても壊れない（create or replace）
create or replace function app.test_spec_item(p_spec uuid) returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  select jsonb_build_object(
    'id', s.id,
    'title', s.title,
    'checked', s.checked_at is not null,
    'position', (select count(*) from test_specs x
                  where x.tenant_id = s.tenant_id and x.ticket_id = s.ticket_id and x.deleted_at is null
                    and (x.created_at, x.id) <= (s.created_at, s.id))::int,
    'source', s.source,
    'version', s.version,
    'source_page', case
      when s.source = 'knowledge' and s.source_ref_id is not null
           and exists (select 1 from app.knowledge_guard_specs(s.ticket_id) g where g = s.id)
      then (select jsonb_build_object('id', p.id, 'title', p.title)
              from knowledge_pages p
             where p.id = s.source_ref_id and p.tenant_id = s.tenant_id and p.deleted_at is null)
    end)
    from test_specs s
   where s.id = p_spec and s.tenant_id = app.tenant_id()
$$;
revoke all on function app.test_spec_item(uuid) from public;
grant execute on function app.test_spec_item(uuid) to kaname_app;
