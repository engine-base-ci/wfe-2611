-- 20261128011700 運営がお知らせを読む（K-977・契約の口 listOpsNotices・getOpsNotice・関門 C2・D-156.3・D-156.33・D-156.57・D-156.82）
--   ① app.notice_audience_ok(お知らせ, 会社)：届け先の決めのうち「誰に」（全部・プラン・ワークスペース）と、止めている会社を外す（app.tenant_stopped・K-970）の 1 か所
--   ② app.notice_for_tenant（K-954）を、①②（運営の会社の行・出したか）と app.notice_audience_ok の and に寄せ直す（式は写さない）
--   ③ app.notice_ops_row(お知らせ)：運営の一覧の 1 行の 11 欄（内部用・kaname_app に渡さない）。読み替え（状態 4 つ・出す場所・誰に・出した時刻）の 1 か所
--   ④ app.ops_notice_detail(お知らせ)：1 件の 16 欄（③ と本文・メンテの時間・影響・続報・出すと届く数）。運営の会社の消していない行でなければ no_data_found（口は 404）
--   ⑤ app.ops_notices(kind, state, limit)：運営の一覧（作った時刻の新しい順・state は読み替えた後の値で絞る）
--   ④⑤ は頭で app.ops_require('notice')（K-947 の型・2 層目）。読むだけなので運営の記録・既読は書かない
--   状態：障害で結んだ今の状態（status_incidents の新しい 1 つ）が resolved なら resolved／予定の時刻を過ぎた scheduled は published／ほかは DB の state

-- ① 誰に（止めている会社は外す・D-156.82）
create or replace function app.notice_audience_ok(p_notice uuid, p_tenant uuid) returns boolean
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  n notices%rowtype;
begin
  if p_notice is null or p_tenant is null then return false; end if;
  select * into n from notices where id = p_notice;
  if not found then return false; end if;
  if coalesce(app.tenant_stopped(p_tenant), false) then return false; end if;
  if coalesce(cardinality(n.target_plan_ids), 0) = 0
     and coalesce(cardinality(n.target_tenant_ids), 0) = 0
     and n.target_tenant_id is null then
    return true;
  end if;
  return coalesce(app.tenant_plan_id(p_tenant) = any(n.target_plan_ids), false)
      or coalesce(p_tenant = any(n.target_tenant_ids), false)
      or coalesce(p_tenant = n.target_tenant_id, false);
end $$;

-- ② 届け先の決め（1 か所）：運営の会社の行・消していない・題がある／出した（予定の日時を過ぎたら出る）／誰に（①）
create or replace function app.notice_for_tenant(p_notice uuid, p_tenant uuid) returns boolean
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  n notices%rowtype;
begin
  if p_notice is null or p_tenant is null then return false; end if;
  select * into n from notices
   where id = p_notice and tenant_id = app.ops_tenant_id() and deleted_at is null and title is not null;
  if not found then return false; end if;
  if not (n.state = 'published' or (n.state = 'scheduled' and n.publish_at is not null and n.publish_at <= now())) then
    return false;
  end if;
  return app.notice_audience_ok(p_notice, p_tenant);
end $$;

-- ③ 一覧の 1 行（11 欄）。出す場所は 'banner' → band・'list' → list（'maintenance_page' は読み飛ばす）
create or replace function app.notice_ops_row(p_id uuid) returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  select jsonb_build_object(
    'id', n.id,
    'kind', n.kind_id,
    'title', n.title,
    'audience',
      case
        when coalesce(cardinality(n.target_plan_ids), 0) > 0 then
          jsonb_build_object('mode', 'plans',
                             'plans', coalesce((select jsonb_agg(p.key order by p.key)
                                                  from plans p where p.id = any(n.target_plan_ids)), '[]'::jsonb),
                             'workspaces', '[]'::jsonb)
        when coalesce(cardinality(n.target_tenant_ids), 0) > 0 or n.target_tenant_id is not null then
          jsonb_build_object('mode', 'workspaces',
                             'plans', '[]'::jsonb,
                             'workspaces', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name) order by t.name, t.id)
                                                       from tenants t
                                                      where t.deleted_at is null
                                                        and (t.id = any(coalesce(n.target_tenant_ids, '{}'::uuid[]))
                                                             or t.id = n.target_tenant_id)), '[]'::jsonb))
        else jsonb_build_object('mode', 'all', 'plans', '[]'::jsonb, 'workspaces', '[]'::jsonb)
      end,
    'state', s.state,
    'placements', coalesce((select jsonb_agg(case x when 'banner' then 'band' else x end order by o)
                              from unnest(n.placements) with ordinality as u(x, o)
                             where x in ('banner', 'list')), '[]'::jsonb),
    'publish_at', n.publish_at,
    'published_at', case when s.state in ('published', 'resolved') then coalesce(n.publish_at, n.created_at) end,
    'author_name', m.display_name,
    'incident_state', s.incident,
    'admins_only', coalesce(n.admins_only, false))
    from notices n
    left join members m on m.id = n.created_by
    cross join lateral (
      select i.incident,
             case
               when i.incident = 'resolved' then 'resolved'
               when n.state = 'scheduled' and n.publish_at is not null and n.publish_at <= now() then 'published'
               else n.state
             end as state
        from (select case when n.kind_id = 'incident' then
                       (select si.state from status_incidents si
                         where si.notice_id = n.id and si.deleted_at is null
                         order by si.created_at desc, si.id desc limit 1)
                     end as incident) i
    ) s
   where n.id = p_id
$$;
revoke all on function app.notice_ops_row(uuid) from public;

-- ④ 1 件（16 欄）。出すと届く数は下書きでも数える（出したら届く数）
create or replace function app.ops_notice_detail(p_notice uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  n notices%rowtype;
  v_reach jsonb;
  v_updates jsonb;
begin
  perform app.ops_require('notice');
  select * into n from notices
   where id = p_notice and tenant_id = app.ops_tenant_id() and deleted_at is null;
  if not found then
    raise exception 'お知らせが無い' using errcode = 'no_data_found';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('state', u.state, 'body', u.body, 'at', u.created_at)
                            order by u.created_at, u.id), '[]'::jsonb)
    into v_updates
    from notice_updates u
   where u.notice_id = n.id and u.deleted_at is null;

  select jsonb_build_object(
           'workspaces', count(*)::integer,
           'members', coalesce(sum((select count(*) from tenant_memberships tm
                                     where tm.tenant_id = t.id and tm.status = 'active' and tm.deleted_at is null)), 0)::integer)
    into v_reach
    from tenants t
   where t.deleted_at is null and t.half_made_at is null and t.id <> app.ops_tenant_id()
     and app.notice_audience_ok(n.id, t.id);

  return app.notice_ops_row(n.id) || jsonb_build_object(
    'body', n.body,
    'maintenance', case when n.maintenance_from is not null and n.maintenance_to is not null
                        then jsonb_build_object('from', n.maintenance_from, 'to', n.maintenance_to) end,
    'impact', n.impact,
    'updates', v_updates,
    'reach', v_reach);
end $$;

-- ⑤ 一覧（作った時刻の新しい順・同じなら id。kind と、読み替えた後の state で絞る・p_limit 件まで。口は 101 を渡して 101 件目を捨てる）
create or replace function app.ops_notices(p_kind text, p_state text, p_limit integer) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_limit integer := coalesce(p_limit, 101);
begin
  perform app.ops_require('notice');
  if p_kind is not null and p_kind not in ('incident', 'maintenance', 'release') then
    raise exception '知らない種類' using errcode = 'invalid_parameter_value';
  end if;
  if p_state is not null and p_state not in ('draft', 'scheduled', 'published', 'resolved') then
    raise exception '知らない状態' using errcode = 'invalid_parameter_value';
  end if;
  if v_limit < 1 or v_limit > 101 then
    raise exception 'limit は 1〜101' using errcode = 'invalid_parameter_value';
  end if;
  return coalesce((
    select jsonb_agg(c.j order by c.created_at desc, c.id desc)
      from (
        select r.j, r.created_at, r.id
          from (select n.id, n.created_at, app.notice_ops_row(n.id) as j
                  from notices n
                 where n.tenant_id = app.ops_tenant_id() and n.deleted_at is null and n.title is not null
                   and (p_kind is null or n.kind_id = p_kind)) r
         where p_state is null or r.j->>'state' = p_state
         order by r.created_at desc, r.id desc
         limit v_limit
      ) c), '[]'::jsonb);
end $$;

revoke all on function app.notice_audience_ok(uuid, uuid), app.notice_for_tenant(uuid, uuid),
  app.ops_notice_detail(uuid), app.ops_notices(text, text, integer) from public;
grant execute on function app.notice_audience_ok(uuid, uuid), app.notice_for_tenant(uuid, uuid),
  app.ops_notice_detail(uuid), app.ops_notices(text, text, integer) to kaname_app;

insert into app.schema_migrations (name) values ('20261128011700_ops_notices_read.sql') on conflict do nothing;
