-- 20261126000200 グループを足す口（K-802・createScope・K-70 の葉・D-125.60・D-125.115・D-125.116・D-154.8・D-154.15・D-154.21・関門 C2）
--
-- 列（scopes）：
--   color    … 画面のトークンの tone の鍵 6 つ（teal・plum・indigo・amber・coral・sage）のどれか。前からの行・直に置いた行は null
--   position … 同じ上のグループの兄弟の位置（1 から）。前からある行は作った順で埋め直す。直に足した行は 0（K-804 の並べ替えが振り直す）
-- 関数（どれも security definer・public から外す。kaname_app に渡すのは app.scope_create だけ）：
--   app.scope_member_count(scope)  … そのグループの人（主の所属と兼ねる所属の和・重ならない数）
--   app.scope_json(scope)          … 答えの 10 の鍵（K-804 の答えも同じ関数）
--   app.scope_layer_for(parent)    … 層を送らないときの層（上のグループの層の 1 つ深い層・無ければいちばん浅い層・いちばん深ければそのまま・層が無ければ null）
--   閲覧のみ＝会社の役割（tenant_memberships.role）が viewer・requester か、主の所属の行の役割が viewer
--   app.scope_create(p jsonb)      … 会社ごとの錠 → 権限 → 上のグループ → 層 → 上限 200 → 短い名前 → 名前 → 人 → 書く（1 取引）
--   短い名前・名前・上限の重なりは一意の索引でなく錠（app.admin_lock・K-800）で守る（消した行の頭も予約に含めるため・D-154.21）

alter table scopes add column if not exists color text
  check (color is null or color in ('teal', 'plum', 'indigo', 'amber', 'coral', 'sage'));
alter table scopes add column if not exists position integer not null default 0;

update scopes s set position = o.rn
  from (select id, row_number() over (partition by tenant_id, parent_id order by created_at, id) as rn from scopes) o
 where o.id = s.id;

create or replace function app.scope_member_count(p_scope uuid) returns integer
language sql stable security definer set search_path = public, app, pg_temp as $$
  select count(distinct x.member_id)::int
    from (
      select m.id as member_id from members m where m.scope_id = p_scope
      union all
      select sm.member_id from scope_memberships sm where sm.scope_id = p_scope and sm.deleted_at is null
    ) x
    join members m on m.id = x.member_id and m.deleted_at is null and m.kind_id = 'human'
    left join tenant_memberships tm on tm.tenant_id = m.tenant_id and tm.member_id = m.id
   where tm.id is null or (tm.status <> 'left' and tm.deleted_at is null)
$$;
revoke all on function app.scope_member_count(uuid) from public;

create or replace function app.scope_json(p_scope uuid) returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  select jsonb_build_object(
    'id', s.id,
    'name', s.name,
    'ticket_prefix', s.ticket_prefix,
    'color', s.color,
    'parent_id', s.parent_id,
    'layer', case when l.id is null then null else jsonb_build_object('id', l.id, 'label', l.label) end,
    'position', s.position,
    'managers', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.display_name) order by m.display_name, m.id)
        from scope_memberships sm join members m on m.id = sm.member_id and m.deleted_at is null
       where sm.scope_id = s.id and sm.deleted_at is null and sm.role = 'manager'), '[]'::jsonb),
    'member_count', app.scope_member_count(s.id),
    'created_at', s.created_at)
    from scopes s left join layers l on l.id = s.layer_id
   where s.id = p_scope
$$;
revoke all on function app.scope_json(uuid) from public;

create or replace function app.scope_layer_for(p_parent uuid) returns uuid
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_order int;
  v_layer uuid;
begin
  select l.order_no, l.id into v_order, v_layer
    from scopes s join layers l on l.id = s.layer_id and l.deleted_at is null
   where s.id = p_parent;
  if v_layer is null then
    return (select l.id from layers l where l.tenant_id = v_tenant and l.deleted_at is null
             order by l.order_no, l.created_at, l.id limit 1);
  end if;
  return coalesce((select l.id from layers l
                    where l.tenant_id = v_tenant and l.deleted_at is null and l.order_no > v_order
                    order by l.order_no, l.created_at, l.id limit 1), v_layer);
end $$;
revoke all on function app.scope_layer_for(uuid) from public;

create or replace function app.scope_create(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_self uuid := app.user_id();
  v_name text := p->>'name';
  v_prefix text := p->>'ticket_prefix';
  v_color text := coalesce(p->>'color', 'teal');
  v_parent uuid := nullif(p->>'parent_id', '')::uuid;
  v_layer uuid := nullif(p->>'layer_id', '')::uuid;
  v_managers uuid[];
  v_members uuid[];
  v_people uuid[];
  v_id uuid;
  v_bad record;
begin
  if v_tenant is null then
    raise exception 'ワークスペースの文脈が無い' using errcode = 'insufficient_privilege';
  end if;
  -- 口が整えて渡す。ここは最後の砦（合わなければ例外＝口は 503）
  if v_name is null or btrim(v_name) = '' or char_length(v_name) > 100
     or v_prefix is null or v_prefix !~ '^[A-Z][A-Z0-9]{0,7}$' or v_prefix = 'T'
     or v_color not in ('teal', 'plum', 'indigo', 'amber', 'coral', 'sage')
     or jsonb_array_length(coalesce(p->'manager_member_ids', '[]'::jsonb)) > 10
     or jsonb_array_length(coalesce(p->'member_ids', '[]'::jsonb)) > 50 then
    raise exception 'グループの入力の形が違う' using errcode = '22023';
  end if;
  select coalesce(array_agg(x.v order by x.o), '{}') into v_managers
    from (select e::uuid as v, min(o) as o
            from jsonb_array_elements_text(coalesce(p->'manager_member_ids', '[]'::jsonb)) with ordinality t(e, o)
           group by e::uuid) x;
  select coalesce(array_agg(x.v order by x.o), '{}') into v_members
    from (select e::uuid as v, min(o) as o
            from jsonb_array_elements_text(coalesce(p->'member_ids', '[]'::jsonb)) with ordinality t(e, o)
           group by e::uuid) x
   where not (x.v = any (v_managers));
  v_people := v_managers || v_members;

  -- ① 錠 ② 権限
  perform app.admin_lock();
  if not app.admin_can('scopes', 'edit') then
    return jsonb_build_object('error', 'forbidden');
  end if;
  -- ③ 上のグループ（無ければ会社のいちばん上）
  if v_parent is null then
    select s.id into v_parent from scopes s
     where s.tenant_id = v_tenant and s.parent_id is null and s.deleted_at is null
     order by s.created_at, s.id limit 1;
  end if;
  if v_parent is null or not exists (
       select 1 from scopes s where s.id = v_parent and s.tenant_id = v_tenant and s.deleted_at is null) then
    return jsonb_build_object('error', 'parent_gone');
  end if;
  -- ④ 層
  if v_layer is not null then
    if not exists (select 1 from layers l where l.id = v_layer and l.tenant_id = v_tenant and l.deleted_at is null) then
      return jsonb_build_object('error', 'layer_missing');
    end if;
  else
    v_layer := app.scope_layer_for(v_parent);
  end if;
  -- ⑤ 上限（消していないグループが 200 まで）
  if (select count(*) from scopes s where s.tenant_id = v_tenant and s.deleted_at is null) >= 200 then
    return jsonb_build_object('error', 'limit_groups');
  end if;
  -- ⑥ 短い名前（消したグループの頭も含めて・大文字小文字・全角半角は同じ）
  if exists (select 1 from scopes s
              where s.tenant_id = v_tenant and s.ticket_prefix is not null
                and upper(normalize(s.ticket_prefix, NFKC)) = upper(normalize(v_prefix, NFKC))) then
    return jsonb_build_object('error', 'group_prefix');
  end if;
  -- ⑦ 名前（同じ上のグループの下の消していない兄弟）
  if exists (select 1 from scopes s
              where s.tenant_id = v_tenant and s.parent_id = v_parent and s.deleted_at is null
                and lower(normalize(s.name, NFKC)) = lower(normalize(v_name, NFKC))) then
    return jsonb_build_object('error', 'group_name');
  end if;
  -- ⑧ 人：見つからない → 止まっている・招待中 → 閲覧のみをマネージャーに、の順
  if exists (
       select 1 from unnest(v_people) u(id)
        left join members m on m.id = u.id and m.tenant_id = v_tenant
        where m.id is null or m.kind_id is distinct from 'human' or app.handover_member_state(u.id) = 'gone') then
    return jsonb_build_object('error', 'person_missing');
  end if;
  select m.display_name as name, app.handover_member_state(u.id) as st into v_bad
    from unnest(v_people) with ordinality u(id, o) join members m on m.id = u.id
   where app.handover_member_state(u.id) in ('suspended', 'invited')
   order by u.o limit 1;
  if found then
    return jsonb_build_object('error', 'person_state', 'name', v_bad.name, 'reason', v_bad.st);
  end if;
  select m.display_name as name into v_bad
    from unnest(v_managers) with ordinality u(id, o) join members m on m.id = u.id
   where (exists (select 1 from tenant_memberships tm
                      where tm.tenant_id = v_tenant and tm.member_id = u.id and tm.deleted_at is null
                        and tm.role in ('viewer', 'requester'))
              or exists (select 1 from scope_memberships sm
                          where sm.member_id = u.id and sm.is_primary and sm.deleted_at is null and sm.role = 'viewer'))
   order by u.o limit 1;
  if found then
    return jsonb_build_object('error', 'person_viewer', 'name', v_bad.name);
  end if;

  -- ⑨ グループの行
  insert into scopes (tenant_id, parent_id, layer_id, name, ticket_prefix, color, position, created_by, updated_by)
  values (v_tenant, v_parent, v_layer, v_name, v_prefix, v_color,
          coalesce((select max(s.position) from scopes s
                     where s.tenant_id = v_tenant and s.parent_id = v_parent and s.deleted_at is null), 0) + 1,
          v_self, v_self)
  returning id into v_id;
  -- ⑩ 所属の行（兼務・主の所属 members.scope_id は変えない）
  insert into scope_memberships (tenant_id, member_id, scope_id, is_primary, role, changed_by, created_by, updated_by)
  select v_tenant, u.id, v_id, false,
         case when u.id = any (v_managers) then 'manager'
              when (exists (select 1 from tenant_memberships tm
                      where tm.tenant_id = v_tenant and tm.member_id = u.id and tm.deleted_at is null
                        and tm.role in ('viewer', 'requester'))
              or exists (select 1 from scope_memberships sm
                          where sm.member_id = u.id and sm.is_primary and sm.deleted_at is null and sm.role = 'viewer')) then 'viewer'
              else 'member' end,
         v_self, v_self, v_self
    from unnest(v_people) u(id);
  -- ⑪ 証跡（名前は入れない）
  perform app.record_audit('scope.create', 'scopes', v_id::text, 'C2',
    jsonb_build_object('parent_id', v_parent, 'ticket_prefix', v_prefix,
                       'manager_count', cardinality(v_managers), 'member_count', cardinality(v_people)));
  return jsonb_build_object('ok', true, 'scope', app.scope_json(v_id));
end $$;
revoke all on function app.scope_create(jsonb) from public;
grant execute on function app.scope_create(jsonb) to kaname_app;
