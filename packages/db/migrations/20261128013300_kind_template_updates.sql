-- 20261128013300 会社の側のひな形の新しい版（K-993・契約の口 listKindTemplateUpdates・applyKindTemplateUpdate・D-156.20・D-156.56・D-125.72・D-156.12・D-156.17・関門 C2）
--   運営が新しい版を出すと（K-1010）、届いた会社の tenant_distributions に offered_version が付く。会社の管理者はその版を
--   「変える」（差を今の会社の行に当てる）か「そのままにする」（何も変えない）で選ぶ。どちらも選んだ印を残し、一覧から消える。
--   ① app.template_diffs(使い始めの行)：届いた版の中身の 1 つずつを、K-992 の 2 つの関数（app.template_item_hash・app.template_item_of）で
--      今の会社の行と比べた差の並び。読むとき・当てるときに今の行で作る（届いた後に会社が直した・消した所は出ない・当てない）
--        ・会社にその key の行が在り、手を付けていず（今の中身の印 = 配ったときの印）、中身が違う → change
--        ・会社にその key の行が無く（消した行も「在る」に入れる＝消したのは手を付けた扱い・D-156.56）、前の版にも無い → add
--          ただし同じ名前の消していない行が会社に在る（会社が自分で作った・名前を変えた）なら外す（名前の一意の索引に当てない）
--        ・change で名前が変わり、その新しい名前の消していない行がほかに会社に在るなら、その change も外す（同じ訳・Q24）
--   ② app.kind_template_updates()：届いていて、まだ選んでいない版の一覧（差が 0 の行は出さない）。1 行は 7 欄
--   ③ app.kind_template_apply(id, choice)：1 つの取引で行を for update。もう選んだ・届いていない → {"error":"chosen"}
--   ②③ は頭で会社の人か（app.member_ok）と管理者か（tenants の admin）を確かめ、違えば 42501（入口と関数の 2 層）。ほかの会社の行は no_data_found
--   どの関数も search_path に pg_temp・public から外す（D-128.171）。kaname_app に渡すのは ② ③ だけ

-- ---------------------------------------------------------------- 字（色の名は段 10 の 8 つの字の名・apps/web/features/F9/settings/views.tsx の TONES と同じ）
create or replace function app.template_color_name(p_key text) returns text
language sql immutable set search_path = public, app, pg_temp as $$
  select case p_key
    when 'indigo' then '藍' when 'teal' then '青緑' when 'amber' then '黄土' when 'coral' then '珊瑚'
    when 'sage' then '若草' when 'plum' then '葡萄' when 'lavender' then '藤' when 'teal-light' then '浅葱'
    else coalesce(p_key, '')
  end
$$;
revoke all on function app.template_color_name(text) from public;

create or replace function app.template_part_name(p_part text) returns text
language sql immutable set search_path = public, app, pg_temp as $$
  select case p_part when 'kind' then '種別' when 'state' then '状態' when 'field' then '項目' end
$$;
revoke all on function app.template_part_name(text) from public;

create or replace function app.template_part_table(p_part text) returns text
language sql immutable set search_path = public, app, pg_temp as $$
  select case p_part when 'kind' then 'ticket_kinds' when 'state' then 'ticket_stages' when 'field' then 'custom_fields' end
$$;
revoke all on function app.template_part_table(text) from public;

-- 変わる欄の字（「・」で並べる）。p_now は会社の行の今の中身、p_new は届いた版の中身（どちらも app.template_item_norm の欄）
-- 中で app.template_color_name（kaname_app に渡さない）を呼ぶので security definer（呼び手の権限で動く関数の本文が呼ぶ関数は kaname_app が実行できる・K-426）
create or replace function app.template_change_label(p_part text, p_now jsonb, p_new jsonb) returns text
language sql immutable security definer set search_path = public, app, pg_temp as $$
  select coalesce(string_agg(x.t, '・' order by x.n), '中身を変える')
    from (
      select 1 as n, '名前を「' || coalesce(p_new->>'name', '') || '」に' as t
       where (p_now->'name') is distinct from (p_new->'name')
      union all
      select 2, '色を「' || app.template_color_name(p_new->>'color_key') || '」に'
       where p_part in ('kind', 'state') and (p_now->'color_key') is distinct from (p_new->'color_key')
      union all
      select 3, '本文のひな形を変える'
       where p_part = 'kind' and nullif(p_now->'body_template', 'null'::jsonb) is distinct from nullif(p_new->'body_template', 'null'::jsonb)
      union all
      select 4, '種類を変える'
       where p_part = 'field' and (p_now->'field_type') is distinct from (p_new->'field_type')
      union all
      select 5, case when coalesce((p_new->>'required')::boolean, false) then '必須にする' else '必須をやめる' end
       where p_part = 'field' and coalesce((p_now->>'required')::boolean, false) is distinct from coalesce((p_new->>'required')::boolean, false)
      union all
      select 6, '説明を変える'
       where p_part = 'field' and nullif(btrim(coalesce(p_now->>'description', '')), '') is distinct from nullif(btrim(coalesce(p_new->>'description', '')), '')
      union all
      select 7, '選ぶ物を変える'
       where p_part = 'field' and app.template_item_norm('field', p_now)->4 is distinct from app.template_item_norm('field', p_new)->4
      union all
      select 8, '出す種別を変える'
       where p_part = 'field' and app.template_item_norm('field', p_now)->5 is distinct from app.template_item_norm('field', p_new)->5
    ) x
$$;
revoke all on function app.template_change_label(text, jsonb, jsonb) from public;

-- ---------------------------------------------------------------- ① 差
--   1 つは { key, change, target_label, detail_label } と、当てるときに使う内の欄 _row（change の会社の行の id）・_item（届いた版の中身）
--   並びは届いた版の中身の順
create or replace function app.template_diffs_full(p_td uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  td tenant_distributions;
  v_part text;
  v_tbl text;
  v_new jsonb;
  v_prev jsonb;
  it jsonb;
  v_key text;
  v_rid uuid;
  v_rdel timestamptz;
  v_rhash text;
  v_now jsonb;
  v_out jsonb := '[]'::jsonb;
  v_taken boolean;
begin
  select * into td from tenant_distributions where id = p_td and deleted_at is null;
  if td.id is null or td.offered_version is null then return '[]'::jsonb; end if;
  select d.key into v_part from distributions d where d.id = td.distribution_id;
  v_tbl := app.template_part_table(v_part);
  if v_tbl is null then return '[]'::jsonb; end if;
  v_new := app.template_items(td.distribution_id, td.offered_version);
  v_prev := app.template_items(td.distribution_id, td.version_in_use);

  for it in select e.x from jsonb_array_elements(v_new) with ordinality e(x, o) order by e.o loop
    v_key := it->>'key';
    if v_key is null then continue; end if;
    -- 会社のその key の行（消した行も入れる・状態は key の列でも引く）
    v_rid := null; v_rdel := null; v_rhash := null;
    execute format($q$
      select r.id, r.deleted_at, r.template_hash
        from %1$I r
       where r.tenant_id = $1 and (r.template_key = $2 %2$s)
       order by (r.deleted_at is null) desc, (r.template_key is not null) desc
       limit 1
    $q$, v_tbl, case when v_part = 'state' then 'or r.key = $2' else '' end)
      into v_rid, v_rdel, v_rhash using td.tenant_id, v_key;
    if v_rid is not null then
      if v_rdel is not null then continue; end if;                       -- 消した＝手を付けた
      v_now := app.template_item_of(v_part, v_rid);
      if v_rhash is distinct from app.template_item_hash(v_part, v_now) then continue; end if;   -- 手を付けた
      if app.template_item_hash(v_part, v_now) = app.template_item_hash(v_part, it) then continue; end if;  -- 同じ中身
      -- 名前が変わり、その新しい名前の消していない行がほかに会社に在れば外す（会社が自分で作った・名前を変えた。名前の一意に当てない）
      if (it->>'name') is distinct from (v_now->>'name') then
        execute format('select exists (select 1 from %1$I r where r.tenant_id = $1 and r.deleted_at is null and r.name = $2 and r.id <> $3)', v_tbl)
          into v_taken using td.tenant_id, it->>'name', v_rid;
        if v_taken then continue; end if;
      end if;
      v_out := v_out || jsonb_build_array(jsonb_build_object(
        'key', v_key, 'change', 'change',
        'target_label', app.template_part_name(v_part) || '「' || coalesce(v_now->>'name', '') || '」',
        'detail_label', app.template_change_label(v_part, v_now, it),
        '_row', v_rid, '_item', it));
    else
      -- 前の版にも在った key（会社が行ごと無くした）は足し直さない
      if exists (select 1 from jsonb_array_elements(v_prev) p(x) where p.x->>'key' = v_key) then continue; end if;
      -- 同じ名前の消していない行が会社に在れば外す（名前の一意に当てない）
      execute format('select exists (select 1 from %1$I r where r.tenant_id = $1 and r.deleted_at is null and r.name = $2)', v_tbl)
        into v_taken using td.tenant_id, it->>'name';
      if v_taken then continue; end if;
      v_out := v_out || jsonb_build_array(jsonb_build_object(
        'key', v_key, 'change', 'add',
        'target_label', app.template_part_name(v_part) || '「' || coalesce(it->>'name', '') || '」',
        'detail_label', case v_part
          when 'kind' then '種別を足す'
          when 'state' then '状態を足す'
          else '項目を足す（' || case when coalesce((it->>'required')::boolean, false) then '必須です' else '必須ではありません' end || '）'
        end,
        '_row', null, '_item', it));
    end if;
  end loop;
  return v_out;
end $$;
revoke all on function app.template_diffs_full(uuid) from public;

-- 画面に出す差（内の欄を外す）
create or replace function app.template_diffs(p_td uuid) returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  select coalesce(jsonb_agg(x - '_row' - '_item' order by o), '[]'::jsonb)
    from jsonb_array_elements(app.template_diffs_full(p_td)) with ordinality e(x, o)
$$;
revoke all on function app.template_diffs(uuid) from public;

-- 1 行の 7 欄（p_diffs は出す差・選んだ答えは空）
create or replace function app.template_update_row(td tenant_distributions, p_diffs jsonb) returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  select jsonb_build_object(
    'id', td.id,
    'part', d.key,
    'part_name', app.template_part_name(d.key),
    'from_version', td.version_in_use,
    'to_version', td.offered_version,
    'released_at', (select v.released_at from distribution_versions v where v.distribution_id = d.id and v.version = td.offered_version),
    'diffs', coalesce(p_diffs, '[]'::jsonb))
    from distributions d where d.id = td.distribution_id
$$;
revoke all on function app.template_update_row(tenant_distributions, jsonb) from public;

-- 呼んだ人が会社の管理者か（口と同じ確かめの 2 層目）。違えば 42501
create or replace function app.template_update_require() returns void
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
begin
  if app.user_id() is null or app.tenant_id() is null or not app.member_ok()
     or not app.is_admin(app.user_id()) then
    raise exception '会社の管理者だけが選べる' using errcode = 'insufficient_privilege';
  end if;
end $$;
revoke all on function app.template_update_require() from public;

-- ---------------------------------------------------------------- ② 一覧
create or replace function app.kind_template_updates() returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_out jsonb := '[]'::jsonb;
  td tenant_distributions;
  v_diffs jsonb;
begin
  perform app.template_update_require();
  for td in
    select x.* from tenant_distributions x join distributions d on d.id = x.distribution_id
     where x.tenant_id = app.tenant_id() and x.deleted_at is null and d.deleted_at is null
       and d.key in ('kind', 'state', 'field')
       and x.offered_version is not null and x.offered_version > x.version_in_use and x.chosen is null
     order by array_position(array['kind', 'state', 'field'], d.key), x.id
  loop
    v_diffs := app.template_diffs(td.id);
    if jsonb_array_length(v_diffs) > 0 then
      v_out := v_out || jsonb_build_array(app.template_update_row(td, v_diffs));
    end if;
  end loop;
  return jsonb_build_object('data', v_out);
end $$;
revoke all on function app.kind_template_updates() from public;
grant execute on function app.kind_template_updates() to kaname_app;

-- ---------------------------------------------------------------- ③ 選ぶ
--   当てる差 1 つ（change は会社の行の中身を新しい中身に・add は行を足す）。当てた行の印は当てた後の今の中身の印
create or replace function app.template_apply_one(p_tenant uuid, p_part text, p_diff jsonb) returns void
language plpgsql volatile security definer set search_path = public, app, pg_temp as $$
declare
  it jsonb := p_diff->'_item';
  v_row uuid := nullif(p_diff->>'_row', '')::uuid;
  v_id uuid;
  v_end int;
  v_opts jsonb;
  v_me uuid := app.user_id();
begin
  if p_part = 'kind' then
    if v_row is not null then
      update ticket_kinds set name = it->>'name', color_key = it->>'color_key',
             body_template = nullif(it->'body_template', 'null'::jsonb), updated_by = v_me, updated_at = now()
       where id = v_row returning id into v_id;
    else
      insert into ticket_kinds (tenant_id, name, color_key, body_template, position, is_builtin, template_key, created_by, updated_by)
      values (p_tenant, it->>'name', it->>'color_key', nullif(it->'body_template', 'null'::jsonb),
              coalesce((select max(position) from ticket_kinds where tenant_id = p_tenant and deleted_at is null), -10) + 10,
              false, it->>'key', v_me, v_me)
      returning id into v_id;
    end if;
    update ticket_kinds set template_key = it->>'key', template_hash = app.template_item_hash('kind', app.template_item_of('kind', v_id))
     where id = v_id;

  elsif p_part = 'state' then
    if v_row is not null then
      update ticket_stages s set name = case when s.is_fixed then s.name else coalesce(it->>'name', s.name) end,
             color_key = coalesce(it->>'color_key', s.color_key), updated_by = v_me, updated_at = now()
       where s.id = v_row returning s.id into v_id;
    else
      select position into v_end from ticket_stages where tenant_id = p_tenant and deleted_at is null and key = 'done';
      insert into ticket_stages (tenant_id, key, name, color_key, position, is_fixed, template_key, created_by, updated_by)
      values (p_tenant, it->>'key', it->>'name', it->>'color_key', coalesce(v_end, 1000) - 1, false, it->>'key', v_me, v_me)
      returning id into v_id;
    end if;
    update ticket_stages set template_key = it->>'key', template_hash = app.template_item_hash('state', app.template_item_of('state', v_id))
     where id = v_id;

  elsif p_part = 'field' then
    v_opts := case when it->>'field_type' in ('select', 'multi_select') then coalesce((
                select jsonb_agg(jsonb_build_object('id', gen_random_uuid()::text,
                                                   'name', case when jsonb_typeof(o) = 'object' then o->>'name' else o #>> '{}' end,
                                                   'position', n) order by n)
                  from jsonb_array_elements(case when jsonb_typeof(it->'options') = 'array' then it->'options' else '[]'::jsonb end)
                       with ordinality as x(o, n)), '[]'::jsonb)
              else '[]'::jsonb end;
    if v_row is not null then
      update custom_fields set name = it->>'name', field_type = it->>'field_type',
             required = coalesce((it->>'required')::boolean, false),
             description = nullif(btrim(coalesce(it->>'description', '')), ''), options = v_opts,
             updated_by = v_me, updated_at = now()
       where id = v_row returning id into v_id;
    else
      insert into custom_fields (tenant_id, name, field_type, required, description, options, position, template_key, created_by, updated_by)
      values (p_tenant, it->>'name', it->>'field_type', coalesce((it->>'required')::boolean, false),
              nullif(btrim(coalesce(it->>'description', '')), ''), v_opts,
              coalesce((select max(position) from custom_fields where tenant_id = p_tenant and deleted_at is null), 0) + 1,
              it->>'key', v_me, v_me)
      returning id into v_id;
    end if;
    insert into custom_field_kinds (tenant_id, field_id, kind_id)
    select p_tenant, v_id, k.id
      from ticket_kinds k
     where k.tenant_id = p_tenant and k.deleted_at is null and k.template_key is not null
       and jsonb_typeof(it->'kind_keys') = 'array' and (it->'kind_keys') ? k.template_key
       and not exists (select 1 from custom_field_kinds c where c.field_id = v_id and c.kind_id = k.id and c.deleted_at is null);
    update custom_fields set template_key = it->>'key', template_hash = app.template_item_hash('field', app.template_item_of('field', v_id))
     where id = v_id;
  end if;
end $$;
revoke all on function app.template_apply_one(uuid, text, jsonb) from public;

create or replace function app.kind_template_apply(p_id uuid, p_choice text) returns jsonb
language plpgsql volatile security definer set search_path = public, app, pg_temp as $$
declare
  td tenant_distributions;
  v_part text;
  v_diffs jsonb := '[]'::jsonb;
  v_diff jsonb;
  v_me uuid;
begin
  perform app.template_update_require();
  v_me := app.user_id();
  if p_choice is null or p_choice not in ('change', 'keep') then
    raise exception '選び方が違う' using errcode = 'invalid_parameter_value';
  end if;
  select * into td from tenant_distributions
   where id = p_id and tenant_id = app.tenant_id() and deleted_at is null
   for update;
  if td.id is null then raise exception '届いた版が無い' using errcode = 'no_data_found'; end if;
  if td.chosen is not null or td.offered_version is null or td.offered_version <= td.version_in_use then
    return jsonb_build_object('error', 'chosen');
  end if;
  select d.key into v_part from distributions d where d.id = td.distribution_id;

  if p_choice = 'change' then
    -- その時に作った差を当てる（読むときと同じ式）。同じ会社の行の並びを書く取引どうしは会社の錠で 1 本ずつ
    perform pg_advisory_xact_lock(hashtextextended(app.template_part_table(v_part) || ':' || td.tenant_id::text, 0));
    v_diffs := app.template_diffs_full(td.id);
    for v_diff in select e.x from jsonb_array_elements(v_diffs) with ordinality e(x, o) order by e.o loop
      perform app.template_apply_one(td.tenant_id, v_part, v_diff);
    end loop;
    update tenant_distributions
       set version_in_use = offered_version, chosen = 'change', chosen_at = now(), chosen_by = v_me, updated_by = v_me
     where id = td.id
    returning * into td;
  else
    update tenant_distributions
       set chosen = 'keep', chosen_at = now(), chosen_by = v_me, updated_by = v_me
     where id = td.id
    returning * into td;
  end if;

  perform app.record_audit('template.apply', 'tenant_distributions', td.id::text, 'C2',
    jsonb_build_object('choice', p_choice, 'part', v_part, 'to_version', td.offered_version,
                       'changed', jsonb_array_length(v_diffs)));
  return jsonb_build_object('data', app.template_update_row(td, '[]'::jsonb));
end $$;
revoke all on function app.kind_template_apply(uuid, text) from public;
grant execute on function app.kind_template_apply(uuid, text) to kaname_app;

insert into app.schema_migrations (name) values ('20261128013300_kind_template_updates.sql') on conflict do nothing;
