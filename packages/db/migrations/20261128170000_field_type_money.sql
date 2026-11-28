-- 項目の種類に「金額」（money）を足す（代表の答え answer=6280a4739b6e「項目の種類に『金額』を足す（金額の項目は『95,000 円』と出る）」・PM の決め 2026-11-28）。
--   金額は円の整数（共通の決まり：円は小数を持たない整数・D-128.130）。値は数（jsonb の number）で、小数は断る（bad_type）。
--   見せ方は桁を区切り後ろに「円」（やり取りの 1 行・AI に渡す本文）。ほかの種類は今のまま。
--   変えるもの：custom_fields の種類の check／値をそろえる custom_field_normalize／見せ方 custom_field_show／AI に渡す本文 ticket_brief_items／
--   項目を足す ticket_field_create・直す ticket_field_update の種類の一覧（関数の中身は前の migration のまま・種類の一覧と金額の枝だけ足す）
-- 種類の一覧に money を 1 つ足す（広げるだけ・今の行はどれも新しい制約を満たす）。制約を付け直すために一度外す
-- squawk-ignore ban-drop-constraint
alter table custom_fields drop constraint if exists custom_fields_field_type_check;
-- squawk-ignore ban-drop-constraint
alter table custom_fields drop constraint if exists custom_fields_field_type_ck;
alter table custom_fields add constraint custom_fields_field_type_ck
  check (field_type in ('short_text', 'long_text', 'number', 'money', 'date', 'select', 'multi_select', 'check')) not valid;
alter table custom_fields validate constraint custom_fields_field_type_ck;

create or replace function app.custom_field_normalize(p_field uuid, p_value jsonb) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare f custom_fields%rowtype; v_t text; v_s text; v_d date; v_arr jsonb := '[]'::jsonb; v_seen text[] := '{}'; e jsonb;
        c_space constant text := E' \t\n\x0B\f\r                 　﻿';   -- 空かどうかを見るときに前後から落とす空白（入口の JavaScript の \s と同じ字・契約の pattern と合わせる）
begin
  select * into f from custom_fields where id = p_field and tenant_id = app.tenant_id() and deleted_at is null;
  if f.id is null then return jsonb_build_object('error', 'field_not_found'); end if;
  v_t := jsonb_typeof(p_value);
  if p_value is null or v_t = 'null'
     or (v_t = 'string' and btrim(p_value #>> '{}', c_space) = '')
     or (v_t = 'array' and jsonb_array_length(p_value) = 0) then
    return jsonb_build_object('ok', true, 'value', null::jsonb);
  end if;
  if f.field_type in ('short_text', 'long_text') then
    if v_t <> 'string' then return jsonb_build_object('error', 'bad_type'); end if;
    return jsonb_build_object('ok', true, 'value', to_jsonb(btrim(p_value #>> '{}', c_space)));
  elsif f.field_type = 'number' then
    if v_t <> 'number' then return jsonb_build_object('error', 'bad_type'); end if;
    return jsonb_build_object('ok', true, 'value', p_value);
  elsif f.field_type = 'money' then
    -- 金額は円の整数（小数は断る）
    if v_t <> 'number' or (p_value #>> '{}')::numeric <> trunc((p_value #>> '{}')::numeric) then
      return jsonb_build_object('error', 'bad_type');
    end if;
    return jsonb_build_object('ok', true, 'value', p_value);
  elsif f.field_type = 'date' then
    if v_t <> 'string' then return jsonb_build_object('error', 'bad_type'); end if;
    v_s := p_value #>> '{}';
    if v_s !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return jsonb_build_object('error', 'bad_type'); end if;
    begin
      v_d := v_s::date;
    exception when others then
      return jsonb_build_object('error', 'bad_type');
    end;
    if to_char(v_d, 'YYYY-MM-DD') <> v_s then return jsonb_build_object('error', 'bad_type'); end if;
    return jsonb_build_object('ok', true, 'value', p_value);
  elsif f.field_type = 'select' then
    if v_t <> 'string' then return jsonb_build_object('error', 'bad_type'); end if;
    v_s := p_value #>> '{}';
    if not exists (select 1 from jsonb_array_elements(f.options) o where o ->> 'id' = v_s) then
      return jsonb_build_object('error', 'bad_option');
    end if;
    return jsonb_build_object('ok', true, 'value', p_value);
  elsif f.field_type = 'multi_select' then
    if v_t <> 'array' then return jsonb_build_object('error', 'bad_type'); end if;
    for e in select x.value from jsonb_array_elements(p_value) with ordinality as x(value, n) order by x.n loop
      if jsonb_typeof(e) <> 'string' then return jsonb_build_object('error', 'bad_type'); end if;
      v_s := e #>> '{}';
      if not exists (select 1 from jsonb_array_elements(f.options) o where o ->> 'id' = v_s) then
        return jsonb_build_object('error', 'bad_option');
      end if;
      if not (v_s = any (v_seen)) then
        v_seen := array_append(v_seen, v_s);
        v_arr := v_arr || to_jsonb(v_s);
      end if;
    end loop;
    return jsonb_build_object('ok', true, 'value', v_arr);
  elsif f.field_type = 'check' then
    if v_t <> 'boolean' then return jsonb_build_object('error', 'bad_type'); end if;
    return jsonb_build_object('ok', true, 'value', p_value);
  end if;
  return jsonb_build_object('error', 'bad_type');
end $$;
revoke all on function app.custom_field_normalize(uuid, jsonb) from public;
grant execute on function app.custom_field_normalize(uuid, jsonb) to kaname_app;

create or replace function app.custom_field_show(p_type text, p_options jsonb, v jsonb) returns text
language sql stable set search_path = public, app, pg_temp as $$
  select case
    when v is null or jsonb_typeof(v) = 'null' then null
    when p_type = 'check' then case when v = 'true'::jsonb then 'チェックあり' else 'チェックなし' end
    when p_type = 'money' and jsonb_typeof(v) = 'number' then to_char((v #>> '{}')::numeric, 'FM999,999,999,999,999,990') || ' 円'
    when p_type = 'select' then coalesce((select o ->> 'name' from jsonb_array_elements(p_options) o where o ->> 'id' = v #>> '{}' limit 1), v #>> '{}')
    when p_type = 'multi_select' then
      (select string_agg(coalesce((select o ->> 'name' from jsonb_array_elements(p_options) o where o ->> 'id' = x.id limit 1), x.id), '、' order by x.n)
         from jsonb_array_elements_text(v) with ordinality as x(id, n))
    else v #>> '{}'
  end
$$;
revoke all on function app.custom_field_show(text, jsonb, jsonb) from public;

create or replace function app.ticket_brief_items(p_ticket uuid) returns text
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare t tickets%rowtype; v_kind text; v_lines text[]; f record; v_val text;
begin
  select * into t from tickets where id = p_ticket;
  if t.id is null then return ''; end if;
  select k.name into v_kind from ticket_kinds k where k.id = t.kind_id;
  v_lines := array[
    '- 題名: ' || t.title,
    '- 種別: ' || coalesce(v_kind, ''),
    '- 期限: ' || coalesce(to_char(t.due_on, 'YYYY-MM-DD'), 'なし'),
    '- 優先度: ' || case when t.priority = 'high' then '高（理由：' || coalesce(t.priority_reason, '') || '）' else '中' end];
  for f in
    select cf.id, cf.name, cf.field_type, cf.options, v.value
      from custom_fields cf join ticket_field_values v on v.field_id = cf.id and v.ticket_id = t.id and v.deleted_at is null
     where cf.tenant_id = t.tenant_id and cf.deleted_at is null
       and (not exists (select 1 from custom_field_kinds ck where ck.field_id = cf.id and ck.deleted_at is null)
            or exists (select 1 from custom_field_kinds ck where ck.field_id = cf.id and ck.kind_id = t.kind_id and ck.deleted_at is null))
     order by cf.position, cf.created_at, cf.id
  loop
    v_val := case f.field_type
      when 'check' then case when f.value = 'true'::jsonb then 'はい' when f.value = 'false'::jsonb then 'いいえ' end
      when 'money' then case when jsonb_typeof(f.value) = 'number' then to_char((f.value #>> '{}')::numeric, 'FM999,999,999,999,999,990') || ' 円' end
      when 'select' then (select o->>'name' from jsonb_array_elements(f.options) o where o->>'id' = f.value #>> '{}' limit 1)
      when 'multi_select' then (select string_agg(o->>'name', '、' order by (o->>'position')::numeric, o->>'id')
                                  from jsonb_array_elements(f.options) o
                                 where jsonb_typeof(f.value) = 'array' and f.value @> to_jsonb(o->>'id'))
      else case when jsonb_typeof(f.value) in ('string', 'number') then f.value #>> '{}' end
    end;
    if coalesce(btrim(v_val), '') = '' then continue; end if;
    v_lines := v_lines || ('- ' || f.name || ': ' || v_val);
  end loop;
  return array_to_string(v_lines, E'\n');
end $$;
revoke all on function app.ticket_brief_items(uuid) from public;

create or replace function app.ticket_field_create(p_name text, p_type text, p_options jsonb, p_required boolean, p_description text, p_kind_ids uuid[])
returns jsonb language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_name text := app.ticket_field_clean_name(p_name);
  v_desc text := nullif(btrim(coalesce(p_description, ''), E' \t\r\n\f\v　'), '');
  v_select boolean := p_type in ('select', 'multi_select');
  v_opts jsonb := '[]'::jsonb;
  r jsonb;
  v_id uuid;
begin
  if not app.ticket_field_can_edit() then return jsonb_build_object('error', 'forbidden'); end if;
  if v_name is null then return jsonb_build_object('error', 'invalid', 'field', 'name'); end if;
  if p_type is null or p_type not in ('short_text', 'long_text', 'number', 'money', 'date', 'select', 'multi_select', 'check') then
    return jsonb_build_object('error', 'invalid', 'field', 'field_type');
  end if;
  if p_kind_ids is null or coalesce(array_length(p_kind_ids, 1), 0) = 0 then return jsonb_build_object('error', 'invalid', 'field', 'kind_ids'); end if;
  if v_select then
    if p_options is null or jsonb_typeof(p_options) <> 'array' or jsonb_array_length(p_options) = 0 then
      return jsonb_build_object('error', 'invalid', 'field', 'options');
    end if;
    r := app.ticket_field_options_build('[]'::jsonb, p_options);
    if r ? 'error' then return r; end if;
    v_opts := r->'data';
  elsif p_options is not null and p_options <> '[]'::jsonb and p_options <> 'null'::jsonb then
    return jsonb_build_object('error', 'invalid', 'field', 'options');
  end if;
  if exists (select 1 from unnest(p_kind_ids) k
             where not exists (select 1 from ticket_kinds t where t.id = k and t.tenant_id = v_tenant and t.deleted_at is null)) then
    return jsonb_build_object('error', 'kind_not_found');
  end if;
  perform pg_advisory_xact_lock(hashtext('custom_fields:' || v_tenant::text));
  if exists (select 1 from custom_fields where tenant_id = v_tenant and deleted_at is null and name = v_name) then
    return jsonb_build_object('error', 'name_taken');
  end if;
  insert into custom_fields (tenant_id, name, field_type, required, description, options, position, created_by, updated_by)
    values (v_tenant, v_name, p_type, coalesce(p_required, false), v_desc, v_opts,
            coalesce((select max(position) from custom_fields where tenant_id = v_tenant and deleted_at is null), 0) + 10,
            app.user_id(), app.user_id())
    returning id into v_id;
  r := app.ticket_field_kinds_set(v_id, p_kind_ids);
  if r ? 'error' then raise exception '種別の行を入れられない' using errcode = 'P0001'; end if;
  perform app.record_audit('custom_field.create', 'custom_fields', v_id::text, 'C2', jsonb_build_object('field_id', v_id));
  return jsonb_build_object('data', app.ticket_field_settings(v_id)->0);
end $$;


create or replace function app.ticket_field_update(p_id uuid, p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  cur custom_fields%rowtype;
  v_name text;
  v_type text;
  v_select boolean;
  v_opts jsonb;
  v_required boolean;
  v_desc text;
  v_kinds uuid[];
  r jsonb;
begin
  if not app.ticket_field_can_edit() then return jsonb_build_object('error', 'forbidden'); end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then return jsonb_build_object('error', 'invalid', 'field', 'body'); end if;
  perform pg_advisory_xact_lock(hashtext('custom_fields:' || v_tenant::text));
  select * into cur from custom_fields where id = p_id and tenant_id = v_tenant and deleted_at is null for update;
  if not found then return jsonb_build_object('error', 'not_found'); end if;

  -- 名前（前後の空白を落として 1〜40 字・ほかの生きている項目と重ならない）
  v_name := cur.name;
  if p_patch ? 'name' then
    if jsonb_typeof(p_patch->'name') <> 'string' then return jsonb_build_object('error', 'invalid', 'field', 'name'); end if;
    v_name := app.ticket_field_clean_name(p_patch->>'name');
    if v_name is null then return jsonb_build_object('error', 'invalid', 'field', 'name'); end if;
  end if;

  -- 型（値が 1 つでも入っていれば同じ型だけ）
  v_type := cur.field_type;
  if p_patch ? 'field_type' then
    v_type := p_patch->>'field_type';
    if v_type is null or v_type not in ('short_text', 'long_text', 'number', 'money', 'date', 'select', 'multi_select', 'check') then
      return jsonb_build_object('error', 'invalid', 'field', 'field_type');
    end if;
  end if;
  v_select := v_type in ('select', 'multi_select');

  -- 選ぶ物
  if p_patch ? 'options' and p_patch->'options' <> 'null'::jsonb then
    if jsonb_typeof(p_patch->'options') <> 'array' then return jsonb_build_object('error', 'invalid', 'field', 'options'); end if;
    if not v_select then
      if jsonb_array_length(p_patch->'options') = 0 then v_opts := '[]'::jsonb;
      elsif p_patch ? 'field_type' then return jsonb_build_object('error', 'invalid', 'field', 'options');
      else return jsonb_build_object('error', 'options_not_allowed');
      end if;
    else
      if jsonb_array_length(p_patch->'options') = 0 then return jsonb_build_object('error', 'invalid', 'field', 'options'); end if;
      r := app.ticket_field_options_build(
             case when cur.field_type in ('select', 'multi_select') then coalesce(cur.options, '[]'::jsonb) else '[]'::jsonb end,
             p_patch->'options');
      if r ? 'error' then return r; end if;
      v_opts := r->'data';
    end if;
  elsif v_select then
    if cur.field_type not in ('select', 'multi_select') then return jsonb_build_object('error', 'invalid', 'field', 'options'); end if;
    v_opts := coalesce(cur.options, '[]'::jsonb);
  else
    v_opts := '[]'::jsonb;
  end if;

  -- 必須・説明
  v_required := cur.required;
  if p_patch ? 'required' then
    if jsonb_typeof(p_patch->'required') <> 'boolean' then return jsonb_build_object('error', 'invalid', 'field', 'required'); end if;
    v_required := (p_patch->>'required')::boolean;
  end if;
  v_desc := cur.description;
  if p_patch ? 'description' then
    if p_patch->'description' = 'null'::jsonb then v_desc := null;
    elsif jsonb_typeof(p_patch->'description') <> 'string' then return jsonb_build_object('error', 'invalid', 'field', 'description');
    else v_desc := nullif(btrim(p_patch->>'description', E' \t\r\n\f\v　'), '');
    end if;
  end if;

  -- 種別（無い・消した・別の会社の種別は書く前に断る）
  if p_patch ? 'kind_ids' then
    if jsonb_typeof(p_patch->'kind_ids') <> 'array' or jsonb_array_length(p_patch->'kind_ids') = 0 then
      return jsonb_build_object('error', 'invalid', 'field', 'kind_ids');
    end if;
    v_kinds := array(select (x)::uuid from jsonb_array_elements_text(p_patch->'kind_ids') x);
    if exists (select 1 from unnest(v_kinds) k
               where not exists (select 1 from ticket_kinds t where t.id = k and t.tenant_id = v_tenant and t.deleted_at is null)) then
      return jsonb_build_object('error', 'kind_not_found');
    end if;
  end if;

  -- 状態の確かめ（同じ名前・値が入っているのに型を変える）
  if v_name <> cur.name and exists (select 1 from custom_fields
                                    where tenant_id = v_tenant and deleted_at is null and name = v_name and id <> p_id) then
    return jsonb_build_object('error', 'name_taken');
  end if;
  if v_type <> cur.field_type and exists (select 1 from ticket_field_values v where v.field_id = p_id and v.deleted_at is null) then
    return jsonb_build_object('error', 'type_locked');
  end if;

  -- 書く（種別の行 → 項目の行 → 証跡。どれかが落ちれば取引ごと戻る）
  if v_kinds is not null then
    r := app.ticket_field_kinds_set(p_id, v_kinds);
    if r ? 'error' then return r; end if;
  end if;
  update custom_fields set name = v_name, field_type = v_type, options = v_opts, required = v_required, description = v_desc,
                           updated_at = now(), updated_by = app.user_id()
    where id = p_id;
  perform app.record_audit('custom_field.update', 'custom_fields', p_id::text, 'C2',
                           jsonb_build_object('field_id', p_id, 'fields', (select jsonb_agg(k) from jsonb_object_keys(p_patch) k)));
  return jsonb_build_object('data', app.ticket_field_settings(p_id)->0);
end $$;

