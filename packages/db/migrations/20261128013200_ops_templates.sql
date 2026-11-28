-- 20261128013200_ops_templates 運営のひな形の置き場と、運営がひな形を読む口（K-992・関門 C2・D-156.20・D-156.21・D-156.3・D-156.12・D-156.17・D-152.18）
--   ひな形は新しく入る会社が最初に使う既定の形（種別・状態・項目の 3 つの配るもの）。会社は後から自由に変えられ、
--   運営が新しい版を出すと、会社が手を付けていない所にだけ知らせる（出すのは K-1010・会社の側は K-993）。新しく入る会社は最新の既定で始まる。
--   ① 列：ticket_kinds・ticket_stages・custom_fields に template_key（どのひな形の物か・null は会社が自分で足した物）と
--      template_hash（配ったときの中身の印）。tenant_distributions に知らせた版・選んだこと（K-1010・K-993 が書く。ここは置くだけ）と一意の索引
--   ② 中身の印 app.template_item_hash(部, 中身)：部の中身の欄だけ（key を除く）を決まった順で並べた jsonb の md5。
--      会社の行の今の中身 app.template_item_of(部, 行の id)。手を付けたかの比べはこの 2 つだけで作る（K-993・K-1010 も使う・1 か所）
--   ③ 配るもの 3 行（kind・state・field）と版 1 の中身（今の既定：種別 4・状態 7・項目 0）。もう一度流しても行は増えない
--   ④ 前からの会社 app.template_backfill()：既定の種別・状態に版 1 の中身の印（今の中身でなく版 1＝もう変えた会社は手を付けた形）と使い始めの行
--   ⑤ 新しく入る会社 app.template_seed(会社)：最新の版の中身で種別・状態・項目を入れ、印と使い始めの行。引き金 tenants_ticket_zz_template
--      （名前の順で tenants_ticket_basics・tenants_ticket_body_template の後に走る）。運営の会社・作りかけの会社には入れない
--   ⑥ 運営が読む関数 app.ops_template_row・app.ops_templates・app.ops_template（頭で ops_require('distribute')・無い id は no_data_found）
--   どの関数も search_path に pg_temp・public から外す（D-128.171）。kaname_app に渡すのは印の 2 つと運営が読む 3 つだけ

-- ---------------------------------------------------------------- ① 列と索引
alter table ticket_kinds add column if not exists template_key text;
alter table ticket_kinds add column if not exists template_hash text;
alter table ticket_stages add column if not exists template_key text;
alter table ticket_stages add column if not exists template_hash text;
alter table custom_fields add column if not exists template_key text;
alter table custom_fields add column if not exists template_hash text;

alter table tenant_distributions add column if not exists offered_version int;
alter table tenant_distributions add column if not exists offered_at timestamptz;
alter table tenant_distributions add column if not exists chosen text;
alter table tenant_distributions add column if not exists chosen_at timestamptz;
alter table tenant_distributions add column if not exists chosen_by uuid;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tenant_distributions_chosen_check') then
    alter table tenant_distributions add constraint tenant_distributions_chosen_check
      check (chosen is null or chosen in ('change', 'keep'));
  end if;
end $$;
create unique index if not exists tenant_distributions_uq on tenant_distributions (tenant_id, distribution_id) where deleted_at is null;

-- ---------------------------------------------------------------- ② 中身の印と会社の行の今の中身
--   中身の形（snapshot の items の 1 つ）：種別 { key, name, color_key, body_template }／状態 { key, name, color_key }／
--   項目 { key, name, field_type, required, description, options, kind_keys }（options は選ぶ物の名前の並び・kind_keys は種別の鍵の並び）
--   印は key を除いた欄を決まった順の jsonb の並びにして md5。無い欄は null・項目の required の無いは false・並びの無いは []
create or replace function app.template_item_norm(p_part text, p_item jsonb) returns jsonb
language sql immutable set search_path = public, app, pg_temp as $$
  select case p_part
    when 'kind' then jsonb_build_array(
      coalesce(p_item->'name', 'null'::jsonb), coalesce(p_item->'color_key', 'null'::jsonb),
      coalesce(p_item->'body_template', 'null'::jsonb))
    when 'state' then jsonb_build_array(
      coalesce(p_item->'name', 'null'::jsonb), coalesce(p_item->'color_key', 'null'::jsonb))
    when 'field' then jsonb_build_array(
      coalesce(p_item->'name', 'null'::jsonb), coalesce(p_item->'field_type', 'null'::jsonb),
      coalesce(nullif(p_item->'required', 'null'::jsonb), 'false'::jsonb),
      -- 説明の空の字と null は同じ（会社に入れるときに空の字を null にする・⑤ と同じ整え）
      coalesce(to_jsonb(nullif(btrim(coalesce(p_item->>'description', '')), '')), 'null'::jsonb),
      coalesce((select jsonb_agg(case when jsonb_typeof(o) = 'object' then coalesce(o->'name', 'null'::jsonb) else o end order by n)
                  from jsonb_array_elements(case when jsonb_typeof(p_item->'options') = 'array' then p_item->'options' else '[]'::jsonb end)
                       with ordinality as x(o, n)), '[]'::jsonb),
      coalesce((select jsonb_agg(distinct k order by k)
                  from jsonb_array_elements_text(case when jsonb_typeof(p_item->'kind_keys') = 'array' then p_item->'kind_keys' else '[]'::jsonb end) k),
               '[]'::jsonb))
  end
$$;
revoke all on function app.template_item_norm(text, jsonb) from public;

create or replace function app.template_item_hash(p_part text, p_item jsonb) returns text
language sql immutable set search_path = public, app, pg_temp as $$
  select md5(app.template_item_norm(p_part, p_item)::text)
$$;
revoke all on function app.template_item_hash(text, jsonb) from public;
grant execute on function app.template_item_norm(text, jsonb), app.template_item_hash(text, jsonb) to kaname_app;

-- 会社の行の今の中身（呼ぶ人の権限で読む＝会社の文脈では自分の会社の行だけ）。無い行は null
create or replace function app.template_item_of(p_part text, p_row_id uuid) returns jsonb
language sql stable set search_path = public, app, pg_temp as $$
  select case p_part
    when 'kind' then (
      select jsonb_build_object('key', k.template_key, 'name', k.name, 'color_key', k.color_key, 'body_template', k.body_template)
        from ticket_kinds k where k.id = p_row_id)
    when 'state' then (
      select jsonb_build_object('key', coalesce(s.template_key, s.key), 'name', s.name, 'color_key', s.color_key)
        from ticket_stages s where s.id = p_row_id)
    when 'field' then (
      select jsonb_build_object(
               'key', f.template_key, 'name', f.name, 'field_type', f.field_type, 'required', f.required, 'description', f.description,
               'options', coalesce((select jsonb_agg(o->'name' order by (o->>'position')::int, n)
                                      from jsonb_array_elements(f.options) with ordinality as x(o, n)), '[]'::jsonb),
               'kind_keys', coalesce((select jsonb_agg(distinct k.template_key order by k.template_key)
                                        from custom_field_kinds c join ticket_kinds k on k.id = c.kind_id
                                       where c.field_id = f.id and c.deleted_at is null and k.deleted_at is null
                                         and k.template_key is not null), '[]'::jsonb))
        from custom_fields f where f.id = p_row_id)
  end
$$;
revoke all on function app.template_item_of(text, uuid) from public;
grant execute on function app.template_item_of(text, uuid) to kaname_app;

-- ---------------------------------------------------------------- ③ 配るもの 3 行と版 1 の中身
--   種別：今の既定の 4 つ（0071 の名前・K-704 の初めの色の鍵・20261122090100 の本文のひな形）／状態：0071 の 7 つ（K-705 の初めの色）／項目：空
insert into distributions (tenant_id, key, name, current_version, is_locked)
select app.ops_tenant_id(), x.key, x.name, 1, false
  from (values ('kind', '種別'), ('state', '状態'), ('field', '項目')) as x(key, name)
 where not exists (select 1 from distributions d where d.tenant_id = app.ops_tenant_id() and d.key = x.key and d.deleted_at is null)
on conflict do nothing;

insert into distribution_versions (distribution_id, version, snapshot, released_at, change_reason)
select d.id, 1, v.snapshot, now(), '初めの版（製品の既定）'
  from distributions d
  join (values
    ('kind', jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('key', 'task', 'name', 'タスク', 'color_key', app.ticket_kind_color_key_from_hex('#186F69'), 'body_template', app.ticket_body_template()),
      jsonb_build_object('key', 'issue', 'name', '課題', 'color_key', app.ticket_kind_color_key_from_hex('#B45309'), 'body_template', app.ticket_body_template()),
      jsonb_build_object('key', 'qa', 'name', 'QA', 'color_key', app.ticket_kind_color_key_from_hex('#6B5B99'), 'body_template', app.ticket_body_template()),
      jsonb_build_object('key', 'meeting', 'name', '会議', 'color_key', app.ticket_kind_color_key_from_hex('#22345C'), 'body_template', app.ticket_body_template())))),
    ('state', jsonb_build_object('items', (
      select jsonb_agg(jsonb_build_object('key', s.key, 'name', s.name, 'color_key', app.ticket_stage_first_color(s.key)) order by s.n)
        from (values ('todo', '未着手', 1), ('doing', '作業中', 2), ('hold', '保留', 3), ('checking', '確認中', 4),
                     ('awaiting_approval', '承認待ち', 5), ('running', '実行中', 6), ('done', '完了', 7)) as s(key, name, n)))),
    ('field', jsonb_build_object('items', '[]'::jsonb))
  ) as v(key, snapshot) on v.key = d.key
 where d.tenant_id = app.ops_tenant_id() and d.deleted_at is null
   and not exists (select 1 from distribution_versions x where x.distribution_id = d.id and x.version = 1);

-- 運営の会社のひな形の 1 つの部（無ければ null）
create or replace function app.template_dist(p_part text) returns distributions
language sql stable security definer set search_path = public, app, pg_temp as $$
  select d.* from distributions d
   where d.tenant_id = app.ops_tenant_id() and d.key = p_part and d.deleted_at is null
   order by d.created_at limit 1
$$;
revoke all on function app.template_dist(text) from public;

-- その版の中身の items（無ければ []）
create or replace function app.template_items(p_dist uuid, p_version int) returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  select coalesce((select case when jsonb_typeof(v.snapshot->'items') = 'array' then v.snapshot->'items' end
                     from distribution_versions v where v.distribution_id = p_dist and v.version = p_version), '[]'::jsonb)
$$;
revoke all on function app.template_items(uuid, int) from public;

-- 既定の種別の鍵 → 0071 が入れる名前（前からの会社・新しく入る会社の既定の行を引く）
create or replace function app.template_builtin_kind_name(p_key text) returns text
language sql immutable set search_path = public, app, pg_temp as $$
  select case p_key when 'task' then 'タスク' when 'issue' then '課題' when 'qa' then 'QA' when 'meeting' then '会議' end
$$;
revoke all on function app.template_builtin_kind_name(text) from public;

-- ---------------------------------------------------------------- ④ 前からの会社（印の無い既定の行と使い始めの行だけを足す・もう一度呼んでも同じ）
create or replace function app.template_backfill() returns void
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  dk distributions; ds distributions; d distributions;
  it jsonb;
begin
  dk := app.template_dist('kind');
  ds := app.template_dist('state');
  if dk.id is not null then
    for it in select value from jsonb_array_elements(app.template_items(dk.id, 1)) loop
      update ticket_kinds k set template_key = it->>'key', template_hash = app.template_item_hash('kind', it)
        from tenants t
       where t.id = k.tenant_id and t.id <> app.ops_tenant_id() and t.deleted_at is null and t.half_made_at is null
         and k.is_builtin and k.deleted_at is null and k.template_key is null
         and k.name = app.template_builtin_kind_name(it->>'key');
    end loop;
  end if;
  if ds.id is not null then
    for it in select value from jsonb_array_elements(app.template_items(ds.id, 1)) loop
      update ticket_stages s set template_key = it->>'key', template_hash = app.template_item_hash('state', it)
        from tenants t
       where t.id = s.tenant_id and t.id <> app.ops_tenant_id() and t.deleted_at is null and t.half_made_at is null
         and s.deleted_at is null and s.template_key is null and s.key = it->>'key';
    end loop;
  end if;
  for d in select * from distributions x where x.tenant_id = app.ops_tenant_id() and x.deleted_at is null and x.key in ('kind', 'state', 'field') loop
    insert into tenant_distributions (tenant_id, distribution_id, version_in_use, enabled)
    select t.id, d.id, 1, true
      from tenants t
     where t.id <> app.ops_tenant_id() and t.deleted_at is null and t.half_made_at is null
       and not exists (select 1 from tenant_distributions td where td.tenant_id = t.id and td.distribution_id = d.id and td.deleted_at is null);
  end loop;
end $$;
revoke all on function app.template_backfill() from public;

-- ---------------------------------------------------------------- ⑤ 新しく入る会社（最新の版の中身で入れる）
create or replace function app.template_seed(p_tenant uuid) returns void
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  d distributions;
  it jsonb;
  v_id uuid;
  v_end int;
  v_opts jsonb;
begin
  if p_tenant is null or p_tenant = app.ops_tenant_id() then return; end if;

  -- 種別：同じ鍵の既定の行（印の付いた行か、既定の名前の行）は中身の値に直し、無ければ足す
  d := app.template_dist('kind');
  if d.id is not null then
    for it in select value from jsonb_array_elements(app.template_items(d.id, d.current_version)) loop
      select k.id into v_id from ticket_kinds k
       where k.tenant_id = p_tenant and k.deleted_at is null
         and (k.template_key = it->>'key' or (k.is_builtin and k.template_key is null and k.name = app.template_builtin_kind_name(it->>'key')))
       order by (k.template_key is not null) desc, k.position limit 1;
      if v_id is not null then
        update ticket_kinds set name = it->>'name', color_key = it->>'color_key',
               body_template = nullif(it->'body_template', 'null'::jsonb),
               template_key = it->>'key', template_hash = app.template_item_hash('kind', it)
         where id = v_id;
      else
        insert into ticket_kinds (tenant_id, name, color_key, body_template, position, is_builtin, template_key, template_hash)
        values (p_tenant, it->>'name', it->>'color_key', nullif(it->'body_template', 'null'::jsonb),
                coalesce((select max(position) from ticket_kinds where tenant_id = p_tenant and deleted_at is null), 0) + 10,
                false, it->>'key', app.template_item_hash('kind', it));
      end if;
    end loop;
    insert into tenant_distributions (tenant_id, distribution_id, version_in_use, enabled)
    select p_tenant, d.id, d.current_version, true
     where not exists (select 1 from tenant_distributions td where td.tenant_id = p_tenant and td.distribution_id = d.id and td.deleted_at is null);
  end if;

  -- 状態：同じ key の行は中身の値に直し（仕組みの段は名前を変えない）、無ければ終わりの段の前に足す
  d := app.template_dist('state');
  if d.id is not null then
    for it in select value from jsonb_array_elements(app.template_items(d.id, d.current_version)) loop
      select s.id into v_id from ticket_stages s
       where s.tenant_id = p_tenant and s.deleted_at is null and s.key = it->>'key' limit 1;
      if v_id is not null then
        update ticket_stages s set name = case when s.is_fixed then s.name else coalesce(it->>'name', s.name) end,
               color_key = coalesce(it->>'color_key', s.color_key),
               template_key = it->>'key', template_hash = app.template_item_hash('state', it)
         where s.id = v_id;
      else
        select position into v_end from ticket_stages where tenant_id = p_tenant and deleted_at is null and key = 'done';
        insert into ticket_stages (tenant_id, key, name, color_key, position, is_fixed, template_key, template_hash)
        values (p_tenant, it->>'key', it->>'name', it->>'color_key', coalesce(v_end, 1000) - 1, false,
                it->>'key', app.template_item_hash('state', it));
      end if;
    end loop;
    insert into tenant_distributions (tenant_id, distribution_id, version_in_use, enabled)
    select p_tenant, d.id, d.current_version, true
     where not exists (select 1 from tenant_distributions td where td.tenant_id = p_tenant and td.distribution_id = d.id and td.deleted_at is null);
  end if;

  -- 項目：同じ鍵の行は中身の値に直し、無ければ足す。出す種別は kind_keys の鍵の種別（無ければ全部の種別＝行を作らない）
  d := app.template_dist('field');
  if d.id is not null then
    for it in select value from jsonb_array_elements(app.template_items(d.id, d.current_version)) loop
      v_opts := case when it->>'field_type' in ('select', 'multi_select') then coalesce((
                  select jsonb_agg(jsonb_build_object('id', gen_random_uuid()::text,
                                                     'name', case when jsonb_typeof(o) = 'object' then o->>'name' else o #>> '{}' end,
                                                     'position', n) order by n)
                    from jsonb_array_elements(case when jsonb_typeof(it->'options') = 'array' then it->'options' else '[]'::jsonb end)
                         with ordinality as x(o, n)), '[]'::jsonb)
                else '[]'::jsonb end;
      select f.id into v_id from custom_fields f
       where f.tenant_id = p_tenant and f.deleted_at is null and f.template_key = it->>'key' limit 1;
      if v_id is not null then
        update custom_fields set name = it->>'name', field_type = it->>'field_type',
               required = coalesce((it->>'required')::boolean, false),
               description = nullif(btrim(coalesce(it->>'description', '')), ''), options = v_opts,
               template_key = it->>'key', template_hash = app.template_item_hash('field', it)
         where id = v_id;
      else
        insert into custom_fields (tenant_id, name, field_type, required, description, options, position, template_key, template_hash)
        values (p_tenant, it->>'name', it->>'field_type', coalesce((it->>'required')::boolean, false),
                nullif(btrim(coalesce(it->>'description', '')), ''), v_opts,
                coalesce((select max(position) from custom_fields where tenant_id = p_tenant and deleted_at is null), 0) + 1,
                it->>'key', app.template_item_hash('field', it))
        returning id into v_id;
      end if;
      insert into custom_field_kinds (tenant_id, field_id, kind_id)
      select p_tenant, v_id, k.id
        from ticket_kinds k
       where k.tenant_id = p_tenant and k.deleted_at is null and k.template_key is not null
         and jsonb_typeof(it->'kind_keys') = 'array' and (it->'kind_keys') ? k.template_key
         and not exists (select 1 from custom_field_kinds c where c.field_id = v_id and c.kind_id = k.id and c.deleted_at is null);
    end loop;
    insert into tenant_distributions (tenant_id, distribution_id, version_in_use, enabled)
    select p_tenant, d.id, d.current_version, true
     where not exists (select 1 from tenant_distributions td where td.tenant_id = p_tenant and td.distribution_id = d.id and td.deleted_at is null);
  end if;
end $$;
revoke all on function app.template_seed(uuid) from public;

create or replace function app.template_seed_on_tenant() returns trigger
language plpgsql security definer set search_path = public, app, pg_temp as $$
begin
  if new.id <> app.ops_tenant_id() and new.deleted_at is null and new.half_made_at is null then
    perform app.template_seed(new.id);
  end if;
  return new;
end $$;
revoke all on function app.template_seed_on_tenant() from public;
drop trigger if exists tenants_ticket_zz_template on tenants;
create trigger tenants_ticket_zz_template after insert on tenants for each row execute function app.template_seed_on_tenant();

-- ---------------------------------------------------------------- ⑥ 運営が読む（distribute を持つ運営の人だけ・関数の中でも確かめる）
--   1 行の 8 欄：id・key・name・summary（下絵 oq-templates の字の形）・version・using（生きている使い始めの行の数）・
--   took（今の版を知らせた会社が在れば { changed, offered }・無ければ null）・last_released_at（今の版を出した時）
create or replace function app.ops_template_row(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  d distributions;
  v_items jsonb;
  v_names text;
  v_offered int;
  v_changed int;
begin
  perform app.ops_require('distribute');
  select * into d from distributions x
   where x.id = p_id and x.tenant_id = app.ops_tenant_id() and x.deleted_at is null;
  if d.id is null then raise exception 'ひな形が無い' using errcode = 'no_data_found'; end if;
  v_items := app.template_items(d.id, d.current_version);
  select string_agg(i->>'name', '・' order by n) into v_names from jsonb_array_elements(v_items) with ordinality as x(i, n);
  select count(*) filter (where td.offered_version = d.current_version),
         count(*) filter (where td.offered_version = d.current_version and td.chosen = 'change')
    into v_offered, v_changed
    from tenant_distributions td where td.distribution_id = d.id and td.deleted_at is null;
  return jsonb_build_object(
    'id', d.id,
    'key', d.key,
    'name', coalesce(d.name, d.key),
    'summary', case d.key
                 when 'kind' then coalesce(v_names, '') || ' の名前・色・本文のひな形'
                 when 'field' then coalesce(v_names, 'チケットの欄の並び・必須。種別ごとに持つ')
                 else coalesce(v_names, '') end,
    'version', coalesce(d.current_version, 0),
    'using', (select count(*) from tenant_distributions td where td.distribution_id = d.id and td.deleted_at is null),
    'took', case when v_offered > 0 then jsonb_build_object('changed', v_changed, 'offered', v_offered) end,
    'last_released_at', (select v.released_at from distribution_versions v where v.distribution_id = d.id and v.version = d.current_version));
end $$;
revoke all on function app.ops_template_row(uuid) from public;
grant execute on function app.ops_template_row(uuid) to kaname_app;

create or replace function app.ops_templates() returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
begin
  perform app.ops_require('distribute');
  return jsonb_build_object('data', coalesce((
    select jsonb_agg(app.ops_template_row(d.id) order by array_position(array['kind', 'state', 'field'], d.key))
      from distributions d
     where d.tenant_id = app.ops_tenant_id() and d.deleted_at is null and d.key in ('kind', 'state', 'field')), '[]'::jsonb));
end $$;
revoke all on function app.ops_templates() from public;
grant execute on function app.ops_templates() to kaname_app;

-- 1 つ：一覧の 8 欄と items（今の版の中身）・versions（新しい順・出した人の名前）
create or replace function app.ops_template(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_row jsonb;
  v_version int;
begin
  perform app.ops_require('distribute');
  v_row := app.ops_template_row(p_id);
  v_version := (v_row->>'version')::int;
  return jsonb_build_object('data', v_row || jsonb_build_object(
    'items', app.template_items(p_id, v_version),
    'versions', coalesce((
      select jsonb_agg(jsonb_build_object('version', v.version, 'released_at', v.released_at,
                                          'released_by_name', m.display_name, 'change_reason', v.change_reason)
                       order by v.version desc)
        from distribution_versions v left join members m on m.id = v.released_by
       where v.distribution_id = p_id), '[]'::jsonb)));
end $$;
revoke all on function app.ops_template(uuid) from public;
grant execute on function app.ops_template(uuid) to kaname_app;

-- ---------------------------------------------------------------- 前からの会社に印と使い始めの行を入れる（最後に 1 回）
select app.template_backfill();

insert into app.schema_migrations (name) values ('20261128013200_ops_templates.sql') on conflict do nothing;
