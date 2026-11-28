-- 20261125014400 チケットの設定 › 種別（K-704・D-150.35・D-150.50・D-152.18・D-152.30・切り方 0.13・設計は 07_functional/段10-F9/土台-settings.md）
--   ① 列 ticket_kinds.color_key（見分けの色 8 つの鍵）② app.tone_hex（鍵 → 16 進）③ app.ticket_kind_color_key_from_hex（16 進 → 鍵）
--   ④ 今ある行に鍵を入れる ⑤ 引き金 ticket_kinds_color_sync（color は鍵から合わせる）⑥ 名前の一意（消していない行だけ）
--   ⑦ 書く関数 4 本（足す・直す・消す・並べる）。どれも 権限 → 状態の確かめ → 書く → 証跡 の順で、断るときは何も書かずに {"error": <言葉>}。
--      書くと証跡は同じ取引（証跡が落ちれば書きも戻る）。答えは {"data": …}

-- ① 色の鍵
alter table ticket_kinds add column if not exists color_key text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ticket_kinds_color_key_check') then
    alter table ticket_kinds add constraint ticket_kinds_color_key_check
      check (color_key is null or color_key in ('indigo', 'teal', 'amber', 'coral', 'sage', 'plum', 'lavender', 'teal-light'));
  end if;
end $$;

-- ② 鍵 → 16 進（04_design/DESIGN-kaname.md の data: の 8 つ）
create or replace function app.tone_hex(p_key text) returns text language sql immutable set search_path = public, app as $$
  select case p_key
    when 'indigo' then '#2F4B7C' when 'teal' then '#186F69' when 'amber' then '#7E570D' when 'coral' then '#A34A3E'
    when 'sage' then '#516F46' when 'plum' then '#6B3F5E' when 'lavender' then '#6B5B99' when 'teal-light' then '#537E7B'
  end
$$;

-- ③ 16 進 → 鍵（8 つの 16 進に一致すればその鍵・前の初めの種別の色も鍵に寄せる・一致しなければ indigo）
create or replace function app.ticket_kind_color_key_from_hex(p_hex text) returns text language sql immutable set search_path = public, app as $$
  select case upper(coalesce(p_hex, ''))
    when '#2F4B7C' then 'indigo' when '#186F69' then 'teal' when '#7E570D' then 'amber' when '#A34A3E' then 'coral'
    when '#516F46' then 'sage' when '#6B3F5E' then 'plum' when '#6B5B99' then 'lavender' when '#537E7B' then 'teal-light'
    when '#B45309' then 'amber' when '#6D4AA6' then 'lavender'
    else 'indigo'
  end
$$;

-- ⑤ 引き金：鍵が入っていれば color は鍵の色。鍵が無くて color だけなら、color から鍵を付ける（運営のひな形の取り込みは color だけを入れる）
create or replace function app.ticket_kinds_color_sync() returns trigger language plpgsql set search_path = public, app as $$
begin
  if new.color_key is not null then
    new.color := app.tone_hex(new.color_key);
  elsif new.color is not null then
    new.color_key := app.ticket_kind_color_key_from_hex(new.color);
  end if;
  return new;
end $$;
drop trigger if exists ticket_kinds_color_sync on ticket_kinds;
create trigger ticket_kinds_color_sync before insert or update of color_key, color on ticket_kinds
  for each row execute function app.ticket_kinds_color_sync();

-- ④ 今ある行（色の入った行だけ・何度流しても同じ）
update ticket_kinds set color_key = app.ticket_kind_color_key_from_hex(color) where color_key is null and color is not null;

-- ⑥ 名前の一意：作る前に、同じ会社の消していない同じ名前の 2 行目以降を「名前（2）」「名前（3）」にする
with d as (
  select id, name, row_number() over (partition by tenant_id, name order by position, created_at, id) as n
    from ticket_kinds where deleted_at is null
)
update ticket_kinds k set name = left(d.name, 36) || '（' || d.n || '）'
  from d where d.id = k.id and d.n > 1;
create unique index if not exists ticket_kinds_name_uq on ticket_kinds (tenant_id, name) where deleted_at is null;

-- 答えの形（鍵ちょうど 6）
create or replace function app.ticket_kind_setting(k ticket_kinds) returns jsonb language sql stable set search_path = public, app as $$
  select jsonb_build_object('id', k.id, 'name', k.name, 'color_key', k.color_key, 'position', k.position,
                            'is_builtin', k.is_builtin, 'body_template', k.body_template)
$$;

-- 前後の空白（全角・タブ・改行）を落とした名前
create or replace function app.ticket_kind_trim(p text) returns text language sql immutable set search_path = public, app as $$
  select regexp_replace(coalesce(p, ''), '^[[:space:]　]+|[[:space:]　]+$', '', 'g')
$$;

-- 本文のひな形の形（表の制約 ticket_kinds_body_template_ok と同じ。深い確かめは口の validateDoc）
create or replace function app.ticket_kind_template_ok(b jsonb) returns boolean language sql immutable set search_path = public, app as $$
  select coalesce(jsonb_typeof(b) = 'object' and b->>'type' = 'doc' and jsonb_typeof(b->'content') = 'array'
                  and octet_length(b::text) <= 1048576, false)
$$;

-- 呼んだ人が種別を直せるか（口と同じ確かめの 2 層目）
create or replace function app.ticket_kind_can_edit() returns boolean language sql stable security definer set search_path = public, app as $$
  select app.user_id() is not null and app.tenant_id() is not null and app.member_ok()
     and has_permission(app.user_id(), 'ticket_kinds', null, 'edit')
$$;

-- ⑦-1 足す
create or replace function app.ticket_kind_create(p_name text, p_color_key text, p_body_template jsonb) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_name text := app.ticket_kind_trim(p_name);
  v_k ticket_kinds%rowtype;
begin
  if not app.ticket_kind_can_edit() then return jsonb_build_object('error', 'forbidden'); end if;
  if length(v_name) not between 1 and 40 then return jsonb_build_object('error', 'invalid'); end if;
  if p_color_key is null or p_color_key not in ('indigo', 'teal', 'amber', 'coral', 'sage', 'plum', 'lavender', 'teal-light') then
    return jsonb_build_object('error', 'invalid');
  end if;
  if p_body_template is not null and jsonb_typeof(p_body_template) <> 'null' and not app.ticket_kind_template_ok(p_body_template) then
    return jsonb_build_object('error', 'invalid');
  end if;
  perform pg_advisory_xact_lock(hashtextextended('ticket_kinds:' || v_tenant::text, 0));
  if exists (select 1 from ticket_kinds where tenant_id = v_tenant and deleted_at is null and name = v_name) then
    return jsonb_build_object('error', 'name_taken');
  end if;
  if (select count(*) from ticket_kinds where tenant_id = v_tenant and deleted_at is null) >= 10 then
    return jsonb_build_object('error', 'limit');
  end if;
  insert into ticket_kinds (tenant_id, name, color_key, body_template, position, is_builtin, created_by, updated_by)
  values (v_tenant, v_name, p_color_key, nullif(p_body_template, 'null'::jsonb),
          coalesce((select max(position) from ticket_kinds where tenant_id = v_tenant and deleted_at is null), -10) + 10,
          false, app.user_id(), app.user_id())
  returning * into v_k;
  perform app.record_audit('ticket_kind.create', 'ticket_kinds', v_k.id::text, 'C2',
    jsonb_build_object('name', v_k.name, 'color_key', v_k.color_key));
  return jsonb_build_object('data', app.ticket_kind_setting(v_k));
end $$;

-- ⑦-2 直す（送った欄だけ。p_patch の鍵は name・color_key・body_template のどれか）
create or replace function app.ticket_kind_update(p_id uuid, p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_k ticket_kinds%rowtype;
  v_name text;
  v_key text;
  v_tpl jsonb;
begin
  if not app.ticket_kind_can_edit() then return jsonb_build_object('error', 'forbidden'); end if;
  select * into v_k from ticket_kinds where id = p_id and tenant_id = v_tenant and deleted_at is null for update;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  v_name := case when p_patch ? 'name' then app.ticket_kind_trim(p_patch->>'name') else v_k.name end;
  v_key := case when p_patch ? 'color_key' then p_patch->>'color_key' else v_k.color_key end;
  v_tpl := case when p_patch ? 'body_template' then nullif(p_patch->'body_template', 'null'::jsonb) else v_k.body_template end;
  if length(v_name) not between 1 and 40 then return jsonb_build_object('error', 'invalid'); end if;
  if p_patch ? 'color_key' and (v_key is null or v_key not in ('indigo', 'teal', 'amber', 'coral', 'sage', 'plum', 'lavender', 'teal-light')) then
    return jsonb_build_object('error', 'invalid');
  end if;
  if v_tpl is not null and not app.ticket_kind_template_ok(v_tpl) then return jsonb_build_object('error', 'invalid'); end if;
  perform pg_advisory_xact_lock(hashtextextended('ticket_kinds:' || v_tenant::text, 0));
  if exists (select 1 from ticket_kinds where tenant_id = v_tenant and deleted_at is null and name = v_name and id <> p_id) then
    return jsonb_build_object('error', 'name_taken');
  end if;
  update ticket_kinds set name = v_name, color_key = v_key, body_template = v_tpl, updated_by = app.user_id(), updated_at = now()
   where id = p_id returning * into v_k;
  perform app.record_audit('ticket_kind.update', 'ticket_kinds', v_k.id::text, 'C2',
    jsonb_build_object('name', v_k.name, 'color_key', v_k.color_key));
  return jsonb_build_object('data', app.ticket_kind_setting(v_k));
end $$;

-- ⑦-3 消す（使っているチケットが在れば断る・消したチケットも数える・最後の 1 つは断る。行は残して deleted_at を入れる）
create or replace function app.ticket_kind_delete(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_k ticket_kinds%rowtype;
  v_n int;
begin
  if not app.ticket_kind_can_edit() then return jsonb_build_object('error', 'forbidden'); end if;
  perform pg_advisory_xact_lock(hashtextextended('ticket_kinds:' || v_tenant::text, 0));
  select * into v_k from ticket_kinds where id = p_id and tenant_id = v_tenant and deleted_at is null for update;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  select count(*) into v_n from tickets where tenant_id = v_tenant and kind_id = p_id;
  if v_n > 0 then return jsonb_build_object('error', 'in_use', 'ticket_count', v_n); end if;
  if (select count(*) from ticket_kinds where tenant_id = v_tenant and deleted_at is null) <= 1 then
    return jsonb_build_object('error', 'last_kind');
  end if;
  update ticket_kinds set deleted_at = now(), updated_by = app.user_id(), updated_at = now() where id = p_id;
  perform app.record_audit('ticket_kind.delete', 'ticket_kinds', p_id::text, 'C2',
    jsonb_build_object('name', v_k.name, 'color_key', v_k.color_key));
  return jsonb_build_object('data', jsonb_build_object('id', p_id));
end $$;

-- ⑦-4 並べる（今の生きている種別の全部と過不足なく一致するときだけ。並びは渡した順に 10 刻み）
create or replace function app.ticket_kind_reorder(p_ids uuid[]) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_live uuid[];
  v_i int;
begin
  if not app.ticket_kind_can_edit() then return jsonb_build_object('error', 'forbidden'); end if;
  perform pg_advisory_xact_lock(hashtextextended('ticket_kinds:' || v_tenant::text, 0));
  select coalesce(array_agg(id order by id), '{}') into v_live
    from ticket_kinds where tenant_id = v_tenant and deleted_at is null;
  if coalesce(array_length(p_ids, 1), 0) <> coalesce(array_length(v_live, 1), 0)
     or (select count(distinct x) from unnest(p_ids) x) <> coalesce(array_length(p_ids, 1), 0)
     or exists (select 1 from unnest(p_ids) x where x <> all (v_live)) then
    return jsonb_build_object('error', 'order_mismatch');
  end if;
  for v_i in 1 .. array_length(p_ids, 1) loop
    update ticket_kinds set position = (v_i - 1) * 10, updated_by = app.user_id(), updated_at = now()
     where id = p_ids[v_i] and tenant_id = v_tenant and position is distinct from (v_i - 1) * 10;
  end loop;
  perform app.record_audit('ticket_kind.reorder', 'ticket_kinds', v_tenant::text, 'C2',
    jsonb_build_object('kind_ids', to_jsonb(p_ids)));
  return jsonb_build_object('data', (
    select coalesce(jsonb_agg(app.ticket_kind_setting(k) order by k.position, k.id), '[]'::jsonb)
      from ticket_kinds k where k.tenant_id = v_tenant and k.deleted_at is null));
end $$;

revoke all on function app.tone_hex(text), app.ticket_kind_color_key_from_hex(text), app.ticket_kinds_color_sync(),
  app.ticket_kind_setting(ticket_kinds), app.ticket_kind_trim(text), app.ticket_kind_template_ok(jsonb), app.ticket_kind_can_edit(),
  app.ticket_kind_create(text, text, jsonb), app.ticket_kind_update(uuid, jsonb), app.ticket_kind_delete(uuid),
  app.ticket_kind_reorder(uuid[]) from public;
grant execute on function app.tone_hex(text), app.ticket_kind_color_key_from_hex(text), app.ticket_kinds_color_sync(),
  app.ticket_kind_setting(ticket_kinds), app.ticket_kind_trim(text), app.ticket_kind_template_ok(jsonb), app.ticket_kind_can_edit(),
  app.ticket_kind_create(text, text, jsonb), app.ticket_kind_update(uuid, jsonb), app.ticket_kind_delete(uuid),
  app.ticket_kind_reorder(uuid[]) to kaname_app;
