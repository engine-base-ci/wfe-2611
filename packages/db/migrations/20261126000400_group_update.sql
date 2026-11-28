-- 20261126000400 グループを直す・並びを替える口（K-804・updateScope・K-70 の葉・D-125.115・D-125.116・D-154.8・D-154.15・D-154.21・関門 C2）
--   新しい表・列は作らない（scopes.color・position は K-802）。関数を 3 つ足す：
--   app.scope_renumber(parent)    … 上のグループの下の消していない兄弟の position を (position, created_at, id) の順に 1 から振り直す（kaname_app に渡さない）
--   app.scope_list_json(ids)      … グループの一覧（listScopes・K-60 の口）に足す 10 の鍵（app.scope_json・K-802）を、上のグループが先・兄弟は position の順に返す。
--                                    権限は見ない（呼ぶ hook が行の守りで見える id だけを渡す）。kaname_app に渡す
--   app.scope_update(id, p)       … 会社ごとの錠 → 権限 → 直す先 → 名前の重なり → 人 → 書く（名前・色・マネージャー・並び）→ 証跡（1 取引）。kaname_app に渡す
--   短い名前（ticket_prefix）・上のグループ・層は変えない（欄が無い）。グループは消さない（D-154.8）
--   閲覧のみ＝会社の役割（tenant_memberships.role）が viewer・requester か、主の所属の行の役割が viewer（K-802 と同じ決め）

create or replace function app.scope_renumber(p_parent uuid) returns void
language sql security definer set search_path = public, app, pg_temp as $$
  update scopes s set position = o.rn
    from (select x.id, row_number() over (order by x.position, x.created_at, x.id)::int as rn
            from scopes x
           where x.tenant_id = app.tenant_id() and x.parent_id is not distinct from p_parent and x.deleted_at is null) o
   where s.id = o.id and s.position is distinct from o.rn
$$;
revoke all on function app.scope_renumber(uuid) from public;

create or replace function app.scope_list_json(p_ids uuid[]) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
begin
  if v_tenant is null then
    raise exception 'ワークスペースの文脈が無い' using errcode = 'insufficient_privilege';
  end if;
  return coalesce((
    with recursive tree as (
      select s.id, 0 as depth from scopes s
       where s.tenant_id = v_tenant and s.parent_id is null and s.deleted_at is null
      union all
      select c.id, t.depth + 1 from scopes c join tree t on c.parent_id = t.id
       where c.tenant_id = v_tenant and c.deleted_at is null
    )
    select jsonb_agg(app.scope_json(s.id) order by coalesce(t.depth, 2147483647), s.position, s.created_at, s.id)
      from scopes s left join tree t on t.id = s.id
     where s.id = any (p_ids) and s.tenant_id = v_tenant and s.deleted_at is null), '[]'::jsonb);
end $$;
revoke all on function app.scope_list_json(uuid[]) from public;
grant execute on function app.scope_list_json(uuid[]) to kaname_app;

create or replace function app.scope_update(p_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_self uuid := app.user_id();
  v_name text := p->>'name';
  v_color text := p->>'color';
  v_pos int;
  v_has_managers boolean := p ? 'manager_member_ids';
  v_managers uuid[] := '{}';
  v_parent uuid;
  v_count int;
  v_fields text[] := '{}';
  v_bad record;
begin
  if v_tenant is null then
    raise exception 'ワークスペースの文脈が無い' using errcode = 'insufficient_privilege';
  end if;
  -- 口が整えて渡す。ここは最後の砦（合わなければ例外＝口は 503）
  if not (p ? 'name' or p ? 'color' or p ? 'position' or v_has_managers)
     or (p ? 'name' and (v_name is null or btrim(v_name) = '' or char_length(v_name) > 100))
     or (p ? 'color' and (v_color is null or v_color not in ('teal', 'plum', 'indigo', 'amber', 'coral', 'sage')))
     or (p ? 'position' and (jsonb_typeof(p->'position') <> 'number' or (p->>'position')::numeric < 1
                              or (p->>'position')::numeric <> trunc((p->>'position')::numeric)))
     or (v_has_managers and (jsonb_typeof(p->'manager_member_ids') <> 'array'
                              or jsonb_array_length(p->'manager_member_ids') > 10)) then
    raise exception 'グループの入力の形が違う' using errcode = '22023';
  end if;
  if p ? 'position' then
    v_pos := least((p->>'position')::numeric, 2147483647)::int;
  end if;
  if v_has_managers then
    select coalesce(array_agg(x.v order by x.o), '{}') into v_managers
      from (select e::uuid as v, min(o) as o
              from jsonb_array_elements_text(p->'manager_member_ids') with ordinality t(e, o)
             group by e::uuid) x;
  end if;

  -- ① 錠 ② 権限
  perform app.admin_lock();
  if not app.admin_can('scopes', 'edit') then
    return jsonb_build_object('error', 'forbidden');
  end if;
  -- ③ 直す先（同じ会社の消していないグループ）
  select s.parent_id into v_parent from scopes s
   where s.id = p_id and s.tenant_id = v_tenant and s.deleted_at is null
   for update;
  if not found then
    return jsonb_build_object('error', 'group_gone');
  end if;
  -- ④ 名前（同じ上のグループの下の、自分を除く消していない兄弟・大文字小文字・全角半角は同じ）
  if v_name is not null and exists (
       select 1 from scopes s
        where s.tenant_id = v_tenant and s.parent_id is not distinct from v_parent and s.deleted_at is null and s.id <> p_id
          and lower(normalize(s.name, NFKC)) = lower(normalize(v_name, NFKC))) then
    return jsonb_build_object('error', 'group_name');
  end if;
  -- ⑤ 人：見つからない → 止まっている・招待中 → 閲覧のみ、の順（K-802 の ⑧ と同じ）
  if exists (
       select 1 from unnest(v_managers) u(id)
        left join members m on m.id = u.id and m.tenant_id = v_tenant
        where m.id is null or m.kind_id is distinct from 'human' or app.handover_member_state(u.id) = 'gone') then
    return jsonb_build_object('error', 'person_missing');
  end if;
  select m.display_name as name, app.handover_member_state(u.id) as st into v_bad
    from unnest(v_managers) with ordinality u(id, o) join members m on m.id = u.id
   where app.handover_member_state(u.id) in ('suspended', 'invited')
   order by u.o limit 1;
  if found then
    return jsonb_build_object('error', 'person_state', 'name', v_bad.name, 'reason', v_bad.st);
  end if;
  select m.display_name as name into v_bad
    from unnest(v_managers) with ordinality u(id, o) join members m on m.id = u.id
   where exists (select 1 from tenant_memberships tm
                  where tm.tenant_id = v_tenant and tm.member_id = u.id and tm.deleted_at is null
                    and tm.role in ('viewer', 'requester'))
      or exists (select 1 from scope_memberships sm
                  where sm.member_id = u.id and sm.is_primary and sm.deleted_at is null and sm.role = 'viewer')
   order by u.o limit 1;
  if found then
    return jsonb_build_object('error', 'person_viewer', 'name', v_bad.name);
  end if;

  -- ⑥ グループの行（名前・色）
  if v_name is not null then v_fields := v_fields || 'name'::text; end if;
  if v_color is not null then v_fields := v_fields || 'color'::text; end if;
  if v_name is not null or v_color is not null then
    update scopes s set name = coalesce(v_name, s.name), color = coalesce(v_color, s.color),
                        updated_at = now(), updated_by = v_self
     where s.id = p_id;
  end if;
  -- ⑦ マネージャーの入れ替え（指した人を manager に・外れた manager を member に・所属は残す）
  if v_has_managers then
    v_fields := v_fields || 'manager_member_ids'::text;
    update scope_memberships sm set role = 'member', changed_by = v_self, updated_at = now(), updated_by = v_self
     where sm.scope_id = p_id and sm.tenant_id = v_tenant and sm.deleted_at is null and sm.role = 'manager'
       and not (sm.member_id = any (v_managers));
    update scope_memberships sm set role = 'manager', deleted_at = null, changed_by = v_self, updated_at = now(), updated_by = v_self
     where sm.scope_id = p_id and sm.tenant_id = v_tenant and sm.member_id = any (v_managers)
       and (sm.role <> 'manager' or sm.deleted_at is not null);
    insert into scope_memberships (tenant_id, member_id, scope_id, is_primary, role, changed_by, created_by, updated_by)
    select v_tenant, u.id, p_id,
           (m.scope_id = p_id and not exists (select 1 from scope_memberships x
                                               where x.member_id = u.id and x.is_primary and x.deleted_at is null)),
           'manager', v_self, v_self, v_self
      from unnest(v_managers) u(id) join members m on m.id = u.id
     where not exists (select 1 from scope_memberships sm where sm.member_id = u.id and sm.scope_id = p_id);
  end if;
  -- ⑧ 並び（兄弟の中で位置を指す・範囲を超えた値は最後・ほかの兄弟を詰めて 1 から振り直す）
  if v_pos is not null then
    v_fields := v_fields || 'position'::text;
    select count(*) into v_count from scopes s
     where s.tenant_id = v_tenant and s.parent_id is not distinct from v_parent and s.deleted_at is null and s.id <> p_id;
    v_pos := least(v_pos, v_count + 1);
    update scopes s set position = case when o.rn < v_pos then o.rn else o.rn + 1 end
      from (select x.id, row_number() over (order by x.position, x.created_at, x.id)::int as rn
              from scopes x
             where x.tenant_id = v_tenant and x.parent_id is not distinct from v_parent and x.deleted_at is null
               and x.id <> p_id) o
     where s.id = o.id and s.position is distinct from (case when o.rn < v_pos then o.rn else o.rn + 1 end);
    update scopes s set position = v_pos, updated_at = now(), updated_by = v_self where s.id = p_id;
    perform app.scope_renumber(v_parent);
  end if;
  -- ⑨ 証跡（変えた欄の名前だけ・名前の値は入れない）
  perform app.record_audit('scope.update', 'scopes', p_id::text, 'C2', jsonb_build_object('fields', to_jsonb(v_fields)));
  return jsonb_build_object('ok', true, 'scope', app.scope_json(p_id));
end $$;
revoke all on function app.scope_update(uuid, jsonb) from public;
grant execute on function app.scope_update(uuid, jsonb) to kaname_app;
