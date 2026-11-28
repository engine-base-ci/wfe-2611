-- 20261125015900 共有の見え方（K-719・D-152.6・D-152.28・D-152.34・関門 C2）。名前の正本は 07_functional/段10-F9/土台-knowledge.md と 11_tickets/K-719.md
--   表は作らない。関数を 1 つ足す：app.kn_shared_tree()（木の「共有された物だけのグループ」の材料）。
--   共有の行は行の守り（K-689 の knowledge_shares_read）で共有先のメンバーには見えないので、読むのはこの関数の中で行う。
--   同じ migration をもう 1 度当てても壊れない（create or replace）。
--
-- app.kn_shared_tree()：今の人が、自分の入っているグループに向けた生きている共有（ended_at・deleted_at が空）で読める物を、
--   元のグループ（source_scope）ごとに返す。ページの共有はそのページ自身、フォルダの共有はそのフォルダと下の全部
--   （消していないフォルダ・公開済みで消していないページ。後から足した物も）。下書き・消した物は出さない。
--   元のグループに今の人が入っている物は出さない（自分の棚の木に出る）。同じ物は 1 行。5,001 行で止める（木の口が 5,000 で切る）。
--   列は木の口（K-676 の tree.ts）の FolderRow・PageRow と同じ物と、並びの position
create or replace function app.kn_shared_tree()
returns table (
  source_scope uuid,
  source_name text,
  item_kind text,
  id uuid,
  name text,
  parent_folder_id uuid,
  scope_id uuid,
  is_personal boolean,
  is_must boolean,
  is_draft boolean,
  copied boolean,
  "position" int
)
language sql stable security definer set search_path = public, app, pg_temp as $$
  with recursive my as (
    select unnest(app.kn_my_groups()) as g
  ), live as (
    select s.page_id, s.folder_id from knowledge_shares s
     where s.tenant_id = app.tenant_id() and s.ended_at is null and s.deleted_at is null
       and s.group_id in (select g from my)
  ), down(fid) as (
    select f.id from knowledge_folders f
     where f.id in (select l.folder_id from live l where l.folder_id is not null)
       and f.tenant_id = app.tenant_id() and f.deleted_at is null and not f.is_personal
    union
    select c.id from knowledge_folders c join down d on c.parent_folder_id = d.fid
     where c.tenant_id = app.tenant_id() and c.deleted_at is null and not c.is_personal
  ), items as (
    select f.scope_id as src, 'folder'::text as kind, f.id, f.name, f.parent_folder_id, f.scope_id, f.is_personal,
           false as is_must, false as is_draft, false as copied, f.position
      from knowledge_folders f
     where f.id in (select fid from down)
    union
    select p.scope_id, 'page'::text, p.id, p.title, p.folder_id, p.scope_id, p.is_personal,
           p.is_must, false, (p.copied_from_page_id is not null), p.position
      from knowledge_pages p
     where p.tenant_id = app.tenant_id() and p.deleted_at is null and p.state = 'published' and not p.is_personal
       and (p.id in (select l.page_id from live l where l.page_id is not null)
            or p.folder_id in (select fid from down))
  )
  select i.src, app.kn_shelf_name(i.src, false), i.kind, i.id, i.name, i.parent_folder_id, i.scope_id, i.is_personal,
         i.is_must, i.is_draft, i.copied, i.position
    from items i
    join scopes s on s.id = i.src and s.tenant_id = app.tenant_id() and s.parent_id is not null and s.deleted_at is null
   where i.src not in (select g from my)
   order by i.src, i.kind, i.position, i.name collate "C", i.id
   limit 5001
$$;

revoke execute on function app.kn_shared_tree() from public;
grant execute on function app.kn_shared_tree() to kaname_app;
