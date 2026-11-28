-- 20261128041900 食い違いの見直しの読みが 1 万ページで時間切れになるのを直す（K-695・関門 C2・読むだけ・統合の枝）
--   app.kn_review_conflicts（20261125013500）は、候補の組（cand）を作ってから本文を読み（bodies）、見える・書ける（app.kpage_visible・
--   app.kpage_writable）で絞る。ページをまとめて入れた直後（表の統計がまだ無い・古い）は、planner がその見える・書けるの絞りを
--   候補を作る前の 1 万ページの読み（live の CTE の読み）へ押し下げ、1 行ごとに関数を呼んで 60 秒を超えていた（K695-API-025・文の時間切れ 15 秒 → 503）。
--   cand と bodies を materialized にして、関数の絞りは候補の組（数百）にだけ掛かるようにする（統計の有る無しで計画が変わらない）。
--   あわせて、この関数の中ではいつも値を入れて計画を作る（plan_cache_mode = force_custom_plan・会社の頂点を変数で渡すため）。
--   本体は 20261125013500 の写しで、変えたのは materialized の 2 か所だけ。答え・権限は前のまま。もう 1 度当てても壊れない。
create or replace function app.kn_review_conflicts(p_limit integer default 50)
returns table (upper_id uuid, upper_title text, upper_shelf text, upper_folders text[],
               lower_id uuid, lower_title text, lower_shelf text, lower_folders text[], upper_line text, lower_line text)
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
#variable_conflict use_column
declare
  v_co uuid;
begin
  if not app.kn_can_approve() then return; end if;
  v_co := app.kn_company_scope();
  if v_co is null then return; end if;
  return query
  with live as (
    select p.id, p.title, p.summary, p.scope_id, p.is_personal, p.folder_id, p.copied_from_page_id
      from knowledge_pages p
     where p.tenant_id = app.tenant_id() and p.deleted_at is null and p.state = 'published' and not p.is_personal
  ), cand as materialized (
    select u.id as uid, l.id as lid
      from live u join live l on l.copied_from_page_id = u.id
     where u.scope_id = v_co and l.scope_id <> v_co
    union
    select u.id, l.id
      from knowledge_pages u join knowledge_pages l
        on lower(u.title || ' ' || u.summary) % lower(l.title || ' ' || l.summary)
     where u.tenant_id = app.tenant_id() and l.tenant_id = u.tenant_id
       and u.deleted_at is null and u.state = 'published' and not u.is_personal and u.scope_id = v_co
       and l.deleted_at is null and l.state = 'published' and not l.is_personal and l.scope_id <> v_co
       and similarity(lower(u.title || ' ' || u.summary), lower(l.title || ' ' || l.summary)) >= app.kn_conflict_min()
  ), bodies as materialized (
    select c.uid, c.lid,
           coalesce((select v.body ->> 'text' from knowledge_page_versions v
                      where v.page_id = c.uid and v.kind = 'published' and v.deleted_at is null
                      order by v.version desc limit 1), '') as ut,
           coalesce((select v.body ->> 'text' from knowledge_page_versions v
                      where v.page_id = c.lid and v.kind = 'published' and v.deleted_at is null
                      order by v.version desc limit 1), '') as lt
      from cand c
  ), kept as (
    select b.uid, b.lid, b.ut, b.lt from bodies b
     where btrim(b.ut) <> btrim(b.lt)
       and app.kpage_visible(b.uid) and app.kpage_visible(b.lid)
       and (app.kpage_writable(b.uid) or app.kpage_writable(b.lid))
  )
  select u.id, u.title, app.kn_shelf_name(u.scope_id, u.is_personal),
         case when u.folder_id is null then '{}'::text[] else app.kn_folder_names(u.folder_id) end,
         l.id, l.title, app.kn_shelf_name(l.scope_id, l.is_personal),
         case when l.folder_id is null then '{}'::text[] else app.kn_folder_names(l.folder_id) end,
         d.f[1], d.f[2]
    from kept k
    join knowledge_pages u on u.id = k.uid
    join knowledge_pages l on l.id = k.lid
    cross join lateral (select app.kn_first_diff(k.ut, k.lt) as f) d
   order by u.title collate "C", l.title collate "C", u.id, l.id
   limit greatest(coalesce(p_limit, 50), 0);
end $$;
alter function app.kn_review_conflicts(integer) set plan_cache_mode = force_custom_plan;
