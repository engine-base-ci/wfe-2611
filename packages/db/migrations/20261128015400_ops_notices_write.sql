-- 20261128015400_ops_notices_write 運営がお知らせを作る・直す（K-1014・契約の口 createOpsNotice・updateOpsNotice・関門 C2・D-156.3・D-156.12・D-156.17・D-156.28・D-156.33・D-156.64）
--   足すのは関数 3 つ。表・列は作らない（notices は 0015・0078・K-954 の列 target_tenant_ids・impact を使う）。
--   ① app.notice_placements_in(p)：書く側の出す場所の読み替えの 1 か所（契約の band → DB の 'banner'・list → 'list'）。読む側は K-977 の app.ops_notice_detail
--   ② app.ops_notice_create(p)：下書き（state 'draft'）で 1 行と運営の記録 notice.create を 1 取引で書く。出す日時を付けても出さない（出すのは K-978）
--   ③ app.ops_notice_update(p_notice, p)：送られた鍵だけ書く。出した後（K-977 の読み替えで published か resolved）は題・本文・影響・メンテの時間だけ
--   誰に（D-156.33）：all → 列どちらも null／plans → 運営の会社の plans.id の並び（target_plan_ids）／workspaces → uuid の並び（target_tenant_ids・前の列 target_tenant_id は書かない）。
--     選んだワークスペースは K-947 の app.ops_target で顧客の会社に絞る（運営の会社・無い・消した・作りかけは P0002 → 404）
--   断りの言葉：{"error":"maintenance_order"}（メンテの終わりが始まりより前か同じ → 409 E-OPS-014）・{"error":"published_locked"}（→ 409 E-OPS-009）。
--   鈴とメールは出さない（D-156.28・D-128.109）。記録の payload に題・本文の字を入れない（全社向けなので運営の会社の記録に書く）

create or replace function app.notice_placements_in(p jsonb) returns text[]
language sql immutable set search_path = public, app, pg_temp as $$
  select coalesce(array_agg(case x when 'band' then 'banner' else x end order by o), '{}'::text[])
    from jsonb_array_elements_text(coalesce(p, '[]'::jsonb)) with ordinality as e(x, o)
$$;
revoke all on function app.notice_placements_in(jsonb) from public;
grant execute on function app.notice_placements_in(jsonb) to kaname_app;

create or replace function app.ops_notice_create(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public, app, pg_temp as $$
declare
  v_om uuid;
  v_ops uuid := app.ops_tenant_id();
  v_mode text := p->>'audience_mode';
  v_plans uuid[];
  v_tenants uuid[];
  v_from timestamptz;
  v_to timestamptz;
  v_id uuid;
begin
  v_om := app.ops_require('notice');
  v_from := (p->>'maintenance_from')::timestamptz;
  v_to := (p->>'maintenance_to')::timestamptz;
  if v_mode = 'plans' then
    select array_agg(pl.id order by pl.key) into v_plans
      from plans pl
     where pl.tenant_id = v_ops and pl.deleted_at is null
       and pl.key in (select jsonb_array_elements_text(p->'audience_plans'));
  elsif v_mode = 'workspaces' then
    v_tenants := array(select x::uuid from jsonb_array_elements_text(p->'audience_workspace_ids') x);
    perform app.ops_target(t) from unnest(v_tenants) t;
  end if;
  if v_from is not null and v_to is not null and v_to <= v_from then
    return jsonb_build_object('error', 'maintenance_order');
  end if;
  insert into notices (tenant_id, kind_id, title, body, state, target_plan_ids, target_tenant_ids, publish_at, placements,
                       maintenance_from, maintenance_to, impact, created_by, updated_by)
  values (v_ops, p->>'kind', p->>'title', p->>'body', 'draft', v_plans, v_tenants, (p->>'publish_at')::timestamptz,
          app.notice_placements_in(p->'placements'), v_from, v_to, p->>'impact', app.user_id(), app.user_id())
  returning id into v_id;
  perform app.record_ops_audit(v_ops, 'notice.create', 'notices', v_id::text, null, '{}'::jsonb);
  return jsonb_build_object('data', app.ops_notice_detail(v_id));
end $$;
revoke all on function app.ops_notice_create(jsonb) from public;
grant execute on function app.ops_notice_create(jsonb) to kaname_app;

create or replace function app.ops_notice_update(p_notice uuid, p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public, app, pg_temp as $$
declare
  v_om uuid;
  v_ops uuid := app.ops_tenant_id();
  v_n notices%rowtype;
  v_mode text := p->>'audience_mode';
  v_plans uuid[];
  v_tenants uuid[];
  v_from timestamptz;
  v_to timestamptz;
begin
  v_om := app.ops_require('notice');
  select * into v_n from notices n
   where n.id = p_notice and n.tenant_id = v_ops and n.deleted_at is null and n.title is not null
     for update;
  if not found then
    raise exception 'お知らせが無い' using errcode = 'no_data_found';
  end if;
  -- 出した後の判定は K-977 の読み替え（app.ops_notice_detail の state）をそのまま使う（同じ読み替えを 2 つ書かない）
  if p ?| array['kind', 'audience_mode', 'audience_plans', 'audience_workspace_ids', 'placements', 'publish_at']
     and app.ops_notice_detail(p_notice)->>'state' in ('published', 'resolved') then
    return jsonb_build_object('error', 'published_locked');
  end if;
  v_plans := v_n.target_plan_ids;
  v_tenants := v_n.target_tenant_ids;
  if p ? 'audience_mode' then
    v_plans := null;
    v_tenants := null;
    if v_mode = 'plans' then
      select array_agg(pl.id order by pl.key) into v_plans
        from plans pl
       where pl.tenant_id = v_ops and pl.deleted_at is null
         and pl.key in (select jsonb_array_elements_text(p->'audience_plans'));
    elsif v_mode = 'workspaces' then
      v_tenants := array(select x::uuid from jsonb_array_elements_text(p->'audience_workspace_ids') x);
      perform app.ops_target(t) from unnest(v_tenants) t;
    end if;
  end if;
  v_from := case when p ? 'maintenance_from' then (p->>'maintenance_from')::timestamptz else v_n.maintenance_from end;
  v_to := case when p ? 'maintenance_to' then (p->>'maintenance_to')::timestamptz else v_n.maintenance_to end;
  if v_from is not null and v_to is not null and v_to <= v_from then
    return jsonb_build_object('error', 'maintenance_order');
  end if;
  update notices n
     set kind_id = case when p ? 'kind' then p->>'kind' else n.kind_id end,
         title = case when p ? 'title' then p->>'title' else n.title end,
         body = case when p ? 'body' then p->>'body' else n.body end,
         target_plan_ids = v_plans,
         target_tenant_ids = v_tenants,
         placements = case when p ? 'placements' then app.notice_placements_in(p->'placements') else n.placements end,
         publish_at = case when p ? 'publish_at' then (p->>'publish_at')::timestamptz else n.publish_at end,
         maintenance_from = v_from,
         maintenance_to = v_to,
         impact = case when p ? 'impact' then p->>'impact' else n.impact end,
         updated_by = app.user_id()
   where n.id = p_notice;
  perform app.record_ops_audit(v_ops, 'notice.update', 'notices', p_notice::text, null, '{}'::jsonb);
  return jsonb_build_object('data', app.ops_notice_detail(p_notice));
end $$;
revoke all on function app.ops_notice_update(uuid, jsonb) from public;
grant execute on function app.ops_notice_update(uuid, jsonb) to kaname_app;
