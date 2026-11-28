-- 20261125013500 見直すページを読む（K-695・契約の口 getKnowledgeReview・D-152.24・D-152.25）
--   新しい表・列は作らない。① 題名＋説明の似ている度合いの索引（pg_trgm が無い DB では notice を出して通す・0102・K-686 と同じ形）
--   ② 内部の関数 app.kn_first_diff（最初に違う行）・app.kn_conflict_min（似ている度合いのしきい値 0.5）
--   ③ 読む関数 4 つ（使われていない・食い違っている・よく破られる・その数）。どれも「今の人」で決め、見られない人
--      （app.kn_can_approve が偽＝管理者でもグループのマネージャーでもない）には 0 行（口の 403 を通らず直に呼ばれたときの 2 層目）。
--      行は自分が書ける棚の公開済みページだけ（自分の棚は除く・app.kpage_writable）。読むだけ（何も書かない）。
--   同じ migration をもう 1 度当てても壊れない（create … if not exists・create or replace）。

-- ---------------------------------------------------------------- ① 索引（食い違い②の前絞り）
--   既にある表への索引だが、ナレッジのページは段 10 で入ったばかりで行が少なく、ロックの時間は問題にならない（0102 と同じ理由）。
--   execute の文の中で作る（pg_trgm が無い DB では作れないため）
do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_trgm') then
    raise notice 'pg_trgm が無いので見直すページの索引は作らない（食い違いの探しは呼ぶと断る）';
    return;
  end if;
  begin
    create extension if not exists pg_trgm;
  exception when insufficient_privilege then
    raise notice 'pg_trgm を入れる権限が無いので見直すページの索引は作らない';
    return;
  end;
  execute $i$create index if not exists knowledge_pages_head_trgm_idx on knowledge_pages
    using gin (lower(title || ' ' || summary) gin_trgm_ops) where deleted_at is null and state = 'published'$i$;
end $$;

-- ---------------------------------------------------------------- ② 内部の関数
-- 2 つの文を改行で行に分け、行ごとに並べて最初に違う行を [a の行, b の行]（片方に行が無ければ空の文字）。全部同じなら空の並び
create or replace function app.kn_first_diff(a text, b text) returns text[]
language plpgsql immutable security definer set search_path = public, app, pg_temp as $$
declare
  la text[] := string_to_array(coalesce(a, ''), E'\n');
  lb text[] := string_to_array(coalesce(b, ''), E'\n');
  n integer := greatest(coalesce(array_length(la, 1), 0), coalesce(array_length(lb, 1), 0));
begin
  for i in 1..n loop
    if coalesce(la[i], '') <> coalesce(lb[i], '') then
      return array[coalesce(la[i], ''), coalesce(lb[i], '')];
    end if;
  end loop;
  return '{}'::text[];
end $$;

-- 「題名と説明がほぼ同じ」のしきい値（K-686 と同じ式の似ている度合い）。変えるときはここの 1 か所
create or replace function app.kn_conflict_min() returns real
language sql immutable security definer set search_path = public, app, pg_temp as $$ select 0.5::real $$;

-- ---------------------------------------------------------------- ③ 読む関数
-- 使われていない：公開から 90 日以上（最初に公開した版）・AI が 90 日のあいだ 1 度も開いていない（消した記録は数えない・会話の仕事の分も数える）。
--   必ず守る・自分の棚は外す。並びは最後に開かれた時刻の古い順（1 度も無い物が先）・題名・id
create or replace function app.kn_review_unused(p_limit integer default 50)
returns table (id uuid, title text, shelf_name text, folders text[], last_opened_at timestamptz)
language sql stable security definer set search_path = public, app, pg_temp as $$
  select p.id, p.title, app.kn_shelf_name(p.scope_id, p.is_personal),
         case when p.folder_id is null then '{}'::text[] else app.kn_folder_names(p.folder_id) end,
         o.last_at
    from knowledge_pages p
    cross join lateral (
      select min(v.published_at) as first_at from knowledge_page_versions v
       where v.page_id = p.id and v.tenant_id = p.tenant_id and v.kind = 'published' and v.deleted_at is null) f
    cross join lateral (
      select max(r.seen_at) as last_at from reference_logs r
       where r.tenant_id = p.tenant_id and r.ref_type = 'page' and r.ref_id = p.id and r.deleted_at is null) o
   where (select app.kn_can_approve())
     and p.tenant_id = app.tenant_id() and p.deleted_at is null and p.state = 'published'
     and not p.is_must and not p.is_personal
     and f.first_at is not null and f.first_at <= now() - interval '90 days'
     and (o.last_at is null or o.last_at < now() - interval '90 days')
     and app.kpage_writable(p.id)
   order by o.last_at asc nulls first, p.title collate "C", p.id
   limit greatest(coalesce(p_limit, 50), 0)
$$;

-- 食い違っている：上＝会社の棚・下＝グループの棚の、公開済み・消していない・自分の棚でないページの組。
--   (a) 下が上の写し (b) 題名＋説明の似ている度合いが app.kn_conflict_min() 以上（% は索引が効く前絞り）。同じ組は 1 つ。
--   本文（公開の最新の版の text）の前後の空白を落として違う組だけ。両方が見えて、どちらかを書ける人にだけ出す。
--   plpgsql＝pg_trgm が無い DB でも作れ、呼んだときに断る（黙って空を返さない）
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
  ), cand as (
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
  ), bodies as (
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

-- よく破られる：この 30 日の破られた数をページごとに数え、今も生きている必ず守る（自分の棚でない・書ける）ページだけ。
--   cnt＝全部の種類の合計・top_kind＝いちばん多い種類（同じ数なら ai_unchecked・human_unchecked・ai_self_reported の順）。
--   並びは cnt の多い順・題名・id。
--   plpgsql＝表 knowledge_breaches（K-700・この後の migration）が無い時点でも作れる（sql の関数は作るときに表を見る）
create or replace function app.kn_review_broken(p_limit integer default 50)
returns table (id uuid, title text, shelf_name text, folders text[], cnt integer, top_kind text, top_kind_count integer)
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
#variable_conflict use_column
begin
  if not app.kn_can_approve() then return; end if;
  return query
  with k as (
    select b.page_id, b.kind, count(*)::integer as n
      from knowledge_breaches b
     where b.tenant_id = app.tenant_id() and b.deleted_at is null and b.created_at >= now() - interval '30 days'
     group by b.page_id, b.kind
  ), agg as (
    select k.page_id, sum(k.n)::integer as total,
           (array_agg(k.kind order by k.n desc,
                      array_position(array['ai_unchecked', 'human_unchecked', 'ai_self_reported']::text[], k.kind)))[1] as top,
           max(k.n)::integer as top_n
      from k group by k.page_id
  )
  select p.id, p.title, app.kn_shelf_name(p.scope_id, p.is_personal),
         case when p.folder_id is null then '{}'::text[] else app.kn_folder_names(p.folder_id) end,
         a.total, a.top, a.top_n
    from agg a
    join knowledge_pages p on p.id = a.page_id and p.tenant_id = app.tenant_id()
   where p.deleted_at is null and p.state = 'published' and p.is_must and not p.is_personal
     and app.kpage_writable(p.id)
   order by a.total desc, p.title collate "C", p.id
   limit greatest(coalesce(p_limit, 50), 0);
end $$;

-- 見直すページの数（木の admin_counts.review）：上の 3 つを口と同じ上限 50 で数えた行数の合計。見られない人は 0
create or replace function app.kn_review_count() returns integer
language sql stable security definer set search_path = public, app, pg_temp as $$
  select case when not app.kn_can_approve() then 0
              else (select count(*) from app.kn_review_unused(50))::integer
                 + (select count(*) from app.kn_review_conflicts(50))::integer
                 + (select count(*) from app.kn_review_broken(50))::integer end
$$;

revoke all on function app.kn_first_diff(text, text), app.kn_conflict_min(),
  app.kn_review_unused(integer), app.kn_review_conflicts(integer), app.kn_review_broken(integer), app.kn_review_count() from public;
grant execute on function app.kn_review_unused(integer), app.kn_review_conflicts(integer), app.kn_review_broken(integer),
  app.kn_review_count() to kaname_app;
