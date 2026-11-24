-- 20261125013700 AI に渡すナレッジ（K-697・D-152.4・D-152.17・D-152.23・D-128.50・D-128.51・関門 C2）
--   PC が仕事を取る瞬間に、その時のナレッジを足す（任せたときに保存する prompt には入れない。段 5 の app.ticket_job_context は変えない）。
--   ① 会社の頂点 app.kn_company_scope_of ② 見える範囲 app.kn_ai_visible_pages ③ 渡す物 app.knowledge_context
--   ④ 取る PC 用の入口 app.bridge_job_knowledge ⑤ やり取りの 1 行の書き手 app.knowledge_ticket_line（K-698〜K-700 が使う）。
--   AI の実行者は人の要求の文脈を持たないので、どの関数も app.tenant_id()・app.user_id() を使わず引数の人で決める
--   （app.kn_in_group・kn_shelf_name・kn_folder_names は要求の文脈の会社で絞るので、同じ決めをここで引数の会社で書く）。
--   kaname_app に渡すのは ④ だけ。①②③⑤ は ④ と K-698〜K-700 の関数（持ち主の権限）の中からだけ呼ぶ。
--   同じ migration をもう 1 度当てても壊れない形にする（create or replace）。

-- ---------------------------------------------------------------- ① 会社の頂点（app.kn_company_scope と同じ選び方）
create or replace function app.kn_company_scope_of(p_tenant uuid) returns uuid
language sql stable security definer set search_path = public, app, pg_temp as $$
  select s.id from scopes s
  where s.tenant_id = p_tenant and s.parent_id is null and s.deleted_at is null
  order by s.created_at, s.id limit 1
$$;

-- 使える人の会社（消していない・止めていない・会社の所属が有効）。使えない人は null
create or replace function app.kn_ai_member_tenant(p_member uuid) returns uuid
language sql stable security definer set search_path = public, app, pg_temp as $$
  select m.tenant_id from members m
  where m.id = p_member and m.deleted_at is null and m.suspended_at is null
    and exists (select 1 from tenant_memberships tm
                where tm.member_id = m.id and tm.tenant_id = m.tenant_id
                  and tm.deleted_at is null and tm.status = 'active')
$$;

-- ---------------------------------------------------------------- ② 見える範囲（同じ物を外す前の全部・K-698 の道具も使う）
--   チケットあり＝会社の頂点＋チケットのグループ（頂点なら無し）＋自分の棚／チケットなし＝会社の頂点＋入っている全部のグループ＋自分の棚。
--   グループには、生きている共有でそのグループに見せている物（ページ自身か上のフォルダ・app.kn_folder_chain）も入る。公開済み・消していない物だけ
create or replace function app.kn_ai_visible_pages(p_member uuid, p_ticket uuid) returns setof uuid
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare v_tenant uuid; v_top uuid; v_groups uuid[];
begin
  v_tenant := app.kn_ai_member_tenant(p_member);
  if v_tenant is null then return; end if;
  v_top := app.kn_company_scope_of(v_tenant);
  if p_ticket is not null then
    select coalesce(array_remove(array[t.scope_id], v_top), '{}'::uuid[]) into v_groups
      from tickets t where t.id = p_ticket and t.tenant_id = v_tenant and t.deleted_at is null;
    if not found then return; end if;
  else
    select coalesce(array_agg(distinct s.id), '{}'::uuid[]) into v_groups from scopes s
     where s.tenant_id = v_tenant and s.parent_id is not null and s.deleted_at is null
       and (exists (select 1 from scope_memberships sm
                    where sm.member_id = p_member and sm.scope_id = s.id and sm.tenant_id = v_tenant and sm.deleted_at is null)
            or exists (select 1 from members m where m.id = p_member and m.scope_id = s.id and m.tenant_id = v_tenant));
  end if;
  return query
    select p.id from knowledge_pages p
     where p.tenant_id = v_tenant and p.deleted_at is null and p.state = 'published'
       and ((p.is_personal and p.owner_member_id = p_member)
            or (not p.is_personal and p.scope_id = v_top)
            or (not p.is_personal and p.scope_id = any(v_groups))
            or (not p.is_personal and exists (
                  select 1 from knowledge_shares ks
                   where ks.tenant_id = v_tenant and ks.ended_at is null and ks.deleted_at is null
                     and ks.group_id = any(v_groups)
                     and (ks.page_id = p.id
                          or (p.folder_id is not null and ks.folder_id in (select app.kn_folder_chain(p.folder_id)))))));
end $$;

-- ---------------------------------------------------------------- ③ 渡す物
--   { must: [{id, title, place, shelf_name, body_text, truncated}], index: [{id, title, desc, place}], must_more, index_more }。使えない人・使えないチケットは null。
--   棚の強さ 会社＝1・グループ＝2・自分＝3。同じ物を外す：(a) 写しの元が範囲の中にあり本文が同じ (b) より強い棚に題名も本文も同じページがある
--   （どちらも前後の空白だけ落として比べ、全角と半角は正規化しない）。必ず守るは棚ごとの上限（app.kn_must_limit）と全体 100 件、本文は 2,000 字で切る。
--   切れた必ず守るは目次に回す。目次は 200 件で切る（ai/context.ts の KNOWLEDGE_INDEX_MAX と同じ数）
create or replace function app.knowledge_context(p_member uuid, p_ticket uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare v_tenant uuid; v_top uuid;
begin
  v_tenant := app.kn_ai_member_tenant(p_member);
  if v_tenant is null then return null; end if;
  if p_ticket is not null and not exists (
       select 1 from tickets t where t.id = p_ticket and t.tenant_id = v_tenant and t.deleted_at is null) then
    return null;
  end if;
  v_top := app.kn_company_scope_of(v_tenant);
  return (
    with vis as (
      select p.id, p.title, p.summary, p.scope_id, p.is_personal, p.is_must, p.folder_id, p.updated_at, p.copied_from_page_id,
             case when p.is_personal then 3 when p.scope_id = v_top then 1 else 2 end as rk,
             coalesce((select pv.body->>'text' from knowledge_page_versions pv
                        where pv.page_id = p.id and pv.kind = 'published' and pv.version = p.current_version
                          and pv.deleted_at is null
                        order by pv.created_at desc limit 1), '') as body
        from knowledge_pages p
       where p.id in (select app.kn_ai_visible_pages(p_member, p_ticket))
    ), norm as (
      select v.*, regexp_replace(v.title, '^\s+|\s+$', '', 'g') as nt, regexp_replace(v.body, '^\s+|\s+$', '', 'g') as nb
        from vis v
    ), kept as (
      select n.* from norm n
       where not exists (select 1 from norm u where u.id = n.copied_from_page_id and u.nb = n.nb)
         and not exists (select 1 from norm u where u.rk < n.rk and u.nt = n.nt and u.nb = n.nb)
    ), placed as (
      select k.*, sh.shelf_name,
             sh.shelf_name || coalesce(' › ' || nullif(fp.path, ''), '') as place
        from kept k
        cross join lateral (
          select case when k.is_personal then '自分' when k.rk = 1 then '会社'
                      else (select s.name from scopes s where s.id = k.scope_id) end as shelf_name) sh
        cross join lateral (
          select string_agg(up.name, ' › ' order by up.depth desc) as path from (
            with recursive up(id, parent, name, depth) as (
              select f.id, f.parent_folder_id, f.name, 1 from knowledge_folders f
               where f.id = k.folder_id and f.tenant_id = v_tenant
              union all
              select f.id, f.parent_folder_id, f.name, up.depth + 1 from knowledge_folders f join up on f.id = up.parent
               where f.tenant_id = v_tenant and up.depth < 64)
            select * from up) up) fp
    ), must_shelf as (
      select pl.*,
             row_number() over (partition by pl.rk, case when pl.is_personal then null else pl.scope_id end
                                order by pl.title collate "C", pl.id) as shelf_n,
             coalesce(app.kn_must_limit(case pl.rk when 1 then 'company' when 2 then 'group' else 'me' end), 2147483647) as lim
        from placed pl where pl.is_must
    ), must_all as (
      select ms.*, row_number() over (order by ms.rk, ms.title collate "C", ms.id) as all_n
        from must_shelf ms where ms.shelf_n <= ms.lim
    ), must_in as (
      select * from must_all where all_n <= 100
    ), idx as (
      select pl.*, row_number() over (order by pl.rk, pl.updated_at desc, pl.id) as idx_n
        from placed pl where pl.id not in (select id from must_in)
    )
    select jsonb_build_object(
      'must', coalesce((select jsonb_agg(jsonb_build_object(
                  'id', m.id, 'title', m.title, 'place', m.place, 'shelf_name', m.shelf_name,
                  'body_text', left(m.body, 2000), 'truncated', char_length(m.body) > 2000) order by m.all_n)
                from must_in m), '[]'::jsonb),
      'index', coalesce((select jsonb_agg(jsonb_build_object(
                  'id', i.id, 'title', i.title, 'desc', coalesce(i.summary, ''), 'place', i.place) order by i.idx_n)
                from idx i where i.idx_n <= 200), '[]'::jsonb),
      'must_more', (select count(*) from placed where is_must) - (select count(*) from must_in),
      'index_more', greatest((select count(*) from idx) - 200, 0))
  );
end $$;

-- ---------------------------------------------------------------- ④ 取る PC 用の入口（app.bridge_job_memories と同じ形）
--   その仕事を受け取った PC の印（取り消していない）の持ち主＝仕事の持ち主のときだけ、knowledge_context を返す。ほかは null。
--   チケットは仕事の種類が ticket のとき、その仕事の最新の実行（action_runs）のチケット
create or replace function app.bridge_job_knowledge(p_session uuid, p_job uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare v_member uuid; j bridge_jobs%rowtype; v_ticket uuid;
begin
  select s.member_id into v_member from sessions s
   where s.id = p_session and s.kind_id = 'bridge' and s.revoked_at is null;
  if v_member is null then return null; end if;
  select * into j from bridge_jobs b
   where b.id = p_job and b.member_id = v_member and b.taken_session_id = p_session and b.deleted_at is null;
  if j.id is null then return null; end if;
  if j.kind = 'ticket' then
    select ar.ticket_id into v_ticket from action_runs ar
     where ar.bridge_job_id = j.id order by ar.created_at desc limit 1;
  end if;
  return app.knowledge_context(v_member, v_ticket);
end $$;

-- ---------------------------------------------------------------- ⑤ やり取りの 1 行の書き手（AI の更新の行・K-698〜K-700 の取引の中から）
--   欄は guard_list・knowledge_open・knowledge_breach の 3 つだけ（外れは例外）。無いチケット・消されたチケットは何も書かず null。
--   作った時刻は clock_timestamp()（既定の now() は取引の開始時刻で、同じ取引で 2 行足すと並びが id の乱数で決まる）
create or replace function app.knowledge_ticket_line(p_ticket uuid, p_field text, p_changes jsonb, p_body text) returns uuid
language plpgsql volatile security definer set search_path = public, app, pg_temp as $$
declare v_tenant uuid; v_id uuid;
begin
  if p_field is null or p_field not in ('guard_list', 'knowledge_open', 'knowledge_breach') then
    raise exception 'knowledge_ticket_line: 知らない欄です' using errcode = '22023';
  end if;
  select t.tenant_id into v_tenant from tickets t where t.id = p_ticket and t.deleted_at is null;
  if v_tenant is null then return null; end if;
  insert into ticket_messages (tenant_id, ticket_id, author_member_id, kind, body, changes, created_at, updated_at)
  values (v_tenant, p_ticket, null, 'change', p_body, p_changes, clock_timestamp(), clock_timestamp())
  returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------- 権限：kaname_app に渡すのは取る PC 用の入口だけ
revoke all on function
  app.kn_company_scope_of(uuid), app.kn_ai_member_tenant(uuid), app.kn_ai_visible_pages(uuid, uuid),
  app.knowledge_context(uuid, uuid), app.bridge_job_knowledge(uuid, uuid),
  app.knowledge_ticket_line(uuid, text, jsonb, text)
  from public;
revoke all on function
  app.kn_company_scope_of(uuid), app.kn_ai_member_tenant(uuid), app.kn_ai_visible_pages(uuid, uuid),
  app.knowledge_context(uuid, uuid), app.knowledge_ticket_line(uuid, text, jsonb, text)
  from kaname_app;
grant execute on function app.bridge_job_knowledge(uuid, uuid) to kaname_app;
