-- 20261126000300 層を足す・直す・読む口（K-803・createLayer・updateLayer・listLayers・K-70 の葉・D-125.116・D-125.117・D-154.7・D-154.8・D-154.21・関門 C2）
--
-- 関数（どれも security definer・public から外す。kaname_app に渡すのは app.layer_create・app.layer_update・app.layer_list）：
--   app.layer_json(layer)       … 答えの 6 つの鍵（id・key・label・order_no・group_count・created_at）を 1 か所で組む
--   app.layer_renumber(tenant)  … その会社の消していない層の order_no を (order_no, created_at, id) の順に 1 から振り直す
--   app.layer_list()            … 今の会社の消していない層を order_no の順に（会社の人なら誰でも読める・入口が先に確かめる）
--   app.layer_create(p jsonb)   … 錠 → 権限 → 上限 8 段 → 名前の重なり → 位置を空ける → 1 行 → 振り直し → 証跡（1 取引）
--   app.layer_update(id, p)     … 錠 → 権限 → 層 → 名前の重なり（自分を除く）→ 位置を動かす → 振り直し → 証跡（1 取引）
--   名前の重なり・上限・並びは一意の索引でなく錠（app.admin_lock・K-800）で守る（前からの種が同じ会社に層を直に入れるため・D-154.21）
--   層は消さない（D-154.8）。名前を直しても人に知らせない

create or replace function app.layer_json(p_layer uuid) returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  select jsonb_build_object(
    'id', l.id,
    'key', l.key,
    'label', l.label,
    'order_no', l.order_no,
    'group_count', (select count(*)::int from scopes s where s.layer_id = l.id and s.deleted_at is null),
    'created_at', l.created_at)
    from layers l
   where l.id = p_layer
$$;
revoke all on function app.layer_json(uuid) from public;

create or replace function app.layer_renumber(p_tenant uuid) returns void
language sql security definer set search_path = public, app, pg_temp as $$
  update layers l set order_no = o.rn, updated_at = now()
    from (select id, row_number() over (order by order_no, created_at, id)::int as rn
            from layers where tenant_id = p_tenant and deleted_at is null) o
   where l.id = o.id and l.order_no <> o.rn
$$;
revoke all on function app.layer_renumber(uuid) from public;

create or replace function app.layer_list() returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  select coalesce(jsonb_agg(app.layer_json(l.id) order by l.order_no, l.created_at, l.id), '[]'::jsonb)
    from layers l
   where l.tenant_id = app.tenant_id() and l.deleted_at is null
$$;
revoke all on function app.layer_list() from public;
grant execute on function app.layer_list() to kaname_app;

create or replace function app.layer_create(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_self uuid := app.user_id();
  v_label text := p->>'label';
  -- 大きすぎる値は層の上限（8）＋1 に丸めてから int に（あふれさせない・超えれば最後）
  v_order int := least(nullif(p->>'order_no', '')::numeric, 9)::int;
  v_count int;
  v_id uuid;
begin
  if v_tenant is null then
    raise exception 'ワークスペースの文脈が無い' using errcode = 'insufficient_privilege';
  end if;
  -- 口が整えて渡す。ここは最後の砦（合わなければ例外＝口は 503）
  if v_label is null or btrim(v_label) = '' or char_length(v_label) > 40 or (v_order is not null and v_order < 1) then
    raise exception '層の入力の形が違う' using errcode = '22023';
  end if;
  -- ① 錠 ② 権限
  perform app.admin_lock();
  if not app.admin_can('layers', 'edit') then
    return jsonb_build_object('error', 'forbidden');
  end if;
  -- ③ 上限（消していない層が 8 段まで・D-154.8）
  select count(*)::int into v_count from layers l where l.tenant_id = v_tenant and l.deleted_at is null;
  if v_count >= 8 then
    return jsonb_build_object('error', 'limit_layers');
  end if;
  -- ④ 名前（消していない層と・大文字小文字・全角半角は同じ）
  if exists (select 1 from layers l
              where l.tenant_id = v_tenant and l.deleted_at is null
                and lower(normalize(l.label, NFKC)) = lower(normalize(v_label, NFKC))) then
    return jsonb_build_object('error', 'layer_name');
  end if;
  -- ⑤ 位置：空か（層の数 + 1）以上なら最後。そうでなければ、その位置から後ろを 1 つずつ下げる
  perform app.layer_renumber(v_tenant);
  if v_order is null or v_order > v_count then
    v_order := v_count + 1;
  else
    update layers l set order_no = l.order_no + 1, updated_at = now(), updated_by = v_self
     where l.tenant_id = v_tenant and l.deleted_at is null and l.order_no >= v_order;
  end if;
  -- ⑥ 層の行（key はサーバーが作る）
  insert into layers (tenant_id, key, label, order_no, created_by, updated_by)
  values (v_tenant, 'l_' || left(replace(gen_random_uuid()::text, '-', ''), 8), v_label, v_order, v_self, v_self)
  returning id into v_id;
  -- ⑦ 振り直し
  perform app.layer_renumber(v_tenant);
  -- ⑧ 証跡（名前は入れない）
  perform app.record_audit('layer.create', 'layers', v_id::text, 'C2',
    jsonb_build_object('order_no', (select l.order_no from layers l where l.id = v_id)));
  return jsonb_build_object('ok', true, 'layer', app.layer_json(v_id));
end $$;
revoke all on function app.layer_create(jsonb) from public;
grant execute on function app.layer_create(jsonb) to kaname_app;

create or replace function app.layer_update(p_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_self uuid := app.user_id();
  v_has_label boolean := p ? 'label';
  v_has_order boolean := p ? 'order_no';
  v_label text := p->>'label';
  -- 大きすぎる値は層の上限（8）＋1 に丸めてから int に（あふれさせない・超えれば最後）
  v_order int := least(nullif(p->>'order_no', '')::numeric, 9)::int;
  v_count int;
  v_cur int;
  v_fields text[] := '{}';
begin
  if v_tenant is null then
    raise exception 'ワークスペースの文脈が無い' using errcode = 'insufficient_privilege';
  end if;
  -- 口が整えて渡す。ここは最後の砦（合わなければ例外＝口は 503）
  if not (v_has_label or v_has_order)
     or (v_has_label and (v_label is null or btrim(v_label) = '' or char_length(v_label) > 40))
     or (v_has_order and (v_order is null or v_order < 1)) then
    raise exception '層の入力の形が違う' using errcode = '22023';
  end if;
  -- ① 錠 ② 権限
  perform app.admin_lock();
  if not app.admin_can('layers', 'edit') then
    return jsonb_build_object('error', 'forbidden');
  end if;
  -- ③ 層（同じ会社の消していない物）
  if not exists (select 1 from layers l where l.id = p_id and l.tenant_id = v_tenant and l.deleted_at is null) then
    return jsonb_build_object('error', 'layer_gone');
  end if;
  -- ④ 名前（自分を除く消していない層と）
  if v_has_label then
    if exists (select 1 from layers l
                where l.tenant_id = v_tenant and l.deleted_at is null and l.id <> p_id
                  and lower(normalize(l.label, NFKC)) = lower(normalize(v_label, NFKC))) then
      return jsonb_build_object('error', 'layer_name');
    end if;
    update layers l set label = v_label, updated_at = now(), updated_by = v_self where l.id = p_id;
    v_fields := array_append(v_fields, 'label');
  end if;
  -- ⑤ 位置：層の数以上は最後へ。指した位置に動かし、間の層を 1 つずつずらす
  if v_has_order then
    perform app.layer_renumber(v_tenant);
    select count(*)::int into v_count from layers l where l.tenant_id = v_tenant and l.deleted_at is null;
    select l.order_no into v_cur from layers l where l.id = p_id;
    if v_order > v_count then
      v_order := v_count;
    end if;
    if v_order < v_cur then
      update layers l set order_no = l.order_no + 1, updated_at = now(), updated_by = v_self
       where l.tenant_id = v_tenant and l.deleted_at is null and l.id <> p_id
         and l.order_no >= v_order and l.order_no < v_cur;
    elsif v_order > v_cur then
      update layers l set order_no = l.order_no - 1, updated_at = now(), updated_by = v_self
       where l.tenant_id = v_tenant and l.deleted_at is null and l.id <> p_id
         and l.order_no > v_cur and l.order_no <= v_order;
    end if;
    update layers l set order_no = v_order, updated_at = now(), updated_by = v_self where l.id = p_id;
    v_fields := array_append(v_fields, 'order_no');
  end if;
  -- ⑥ 振り直し
  perform app.layer_renumber(v_tenant);
  -- ⑦ 証跡（変えた欄の名前だけ・名前は入れない）
  perform app.record_audit('layer.update', 'layers', p_id::text, 'C2', jsonb_build_object('fields', to_jsonb(v_fields)));
  return jsonb_build_object('ok', true, 'layer', app.layer_json(p_id));
end $$;
revoke all on function app.layer_update(uuid, jsonb) from public;
grant execute on function app.layer_update(uuid, jsonb) to kaname_app;
