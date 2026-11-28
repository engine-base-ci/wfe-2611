-- 20261128015000 運営がひな形の新しい版を出す・操作を読む（K-1010・契約の口 releaseOpsTemplate・listOperations・D-156.20・D-156.21・D-156.56・D-125.68・D-126.19・関門 C2）
--   ① 操作（operations）に 3 列（版の札・説明・確かめの状態）と、ブラウザの操作の行の値（下絵 oq-operations の字）
--   ② app.template_offer_needed(配るもの, 会社, 新しい中身, 前の中身)：その会社に新しい版を知らせるか（既定のまま使っている会社だけ・D-156.56）
--   ③ app.ops_template_release(配るもの, 体, 下書き)：部と合わない中身・同じ中身を断り、届く数を数え、下書きでなければ版・使い始めの行・鈴・記録を 1 つの取引で書く
--   ④ app.ops_operations()：操作を読むだけ（上げる・直すは作らない・D-156.21・D-156.15）
--   ⑤ app.template_seed（K-992）を直す：新しく入る会社の行の印を、版の中身ではなく行の今の中身から作る（仕組みの段の名前は種まきが直さないため・K1010-API-015）
--   ひな形の置き場・会社の行の印（template_key・template_hash）・印の関数（app.template_item_hash・app.template_item_of）・
--   答えの 1 行（app.ops_template_row）は K-992（20261128013200_ops_templates.sql）が作る

-- ① 操作の 3 列。前からの行は空（状態は none）
alter table operations add column if not exists version_label text;
alter table operations add column if not exists description text;
alter table operations add column if not exists check_state text not null default 'none'
  check (check_state in ('passed', 'failed', 'none'));
update operations
   set version_label = 'v1.4',
       description = '汎用の操作 1 つ。初めてのサイトも動かし、うまくいったら動かし方を記録して次から使う',
       check_state = 'passed'
 where tenant_id = app.ops_tenant_id() and key = 'browser';

-- ② その会社に新しい版を知らせるか。既定のまま使っている会社（その部の会社の行が、前の版のひな形の key の行ちょうどで、
--    どれも手を付けていない・前の版の key を 1 つも消していない・自分で足した行が無い）で、新しい中身が前の中身と違うときだけ true。
--    手を付けたかの比べは K-992 の 2 つの関数（今の中身の印 ⇔ 配ったときの印 template_hash）。部ごとに見る
create or replace function app.template_offer_needed(p_dist uuid, p_tenant uuid, p_items jsonb, p_prev jsonb) returns boolean
language plpgsql stable set search_path = public, app, pg_temp as $$
declare v_part text; v_tbl text; v_ok boolean;
begin
  if p_items is not distinct from p_prev then return false; end if;
  select d.key into v_part from distributions d where d.id = p_dist;
  v_tbl := case v_part when 'kind' then 'ticket_kinds' when 'state' then 'ticket_stages' when 'field' then 'custom_fields' end;
  if v_tbl is null then return false; end if;
  execute format($q$
    select not exists (select 1 from %1$I r where r.tenant_id = $1 and r.deleted_at is null and r.template_key is null)
       and not exists (select 1 from %1$I r
                        where r.tenant_id = $1 and r.deleted_at is null and r.template_key is not null
                          and r.template_hash is distinct from app.template_item_hash($2, app.template_item_of($2, r.id)))
       and (select coalesce(array_agg(r.template_key order by r.template_key), '{}'::text[])
              from %1$I r where r.tenant_id = $1 and r.deleted_at is null and r.template_key is not null)
         = (select coalesce(array_agg(e.x ->> 'key' order by e.x ->> 'key'), '{}'::text[])
              from jsonb_array_elements(coalesce($3, '[]'::jsonb)) e(x))
  $q$, v_tbl) into v_ok using p_tenant, v_part, p_prev;
  return coalesce(v_ok, false);
end $$;
revoke all on function app.template_offer_needed(uuid, uuid, jsonb, jsonb) from public;
grant execute on function app.template_offer_needed(uuid, uuid, jsonb, jsonb) to kaname_app;

-- ③ 新しい版を出す。p は { items, change_reason }（形は口が確かめた後）。答えは { data, meta: { offered, using } } か { error[, key] }。
--   見る順：運営の人と配るもののできること（42501）→ 配るものを for update（無ければ P0002）→ 部と合わない中身（mismatch・どの 1 つか）→
--   同じ中身（same）→ 届く会社を数える → 下書きならここで返す → 版・今の版・届く会社の使い始めの行・管理者の鈴・記録。
--   部と合わない：部の欄でない欄を持つ・項目に field_type が無い・同じ key が 2 つ・数の上限（種別 10・状態は仕組みの段を除いて 8＝D-125.68）。
--   書く所の失敗（例外）はそのまま上げる（1 つの取引なので何も残らない・口が 503）
create or replace function app.ops_template_release(p_id uuid, p jsonb, p_dry boolean) returns jsonb
language plpgsql volatile security definer set search_path = public, app, pg_temp as $$
declare
  v_me uuid; d record; v_items jsonb; v_prev jsonb; v_it jsonb; v_key text; v_allowed text[]; v_seen text[] := '{}';
  v_count int := 0; v_tenants uuid[]; v_using int; v_offered int; v_ver int; v_reason text;
  c_fixed constant text[] := array['checking', 'awaiting_approval', 'running'];
begin
  perform app.ops_require('distribute');
  v_me := app.user_id();
  select * into d from distributions
   where id = p_id and tenant_id = app.ops_tenant_id() and deleted_at is null
   for update;
  if not found then raise exception 'ひな形が無い' using errcode = 'no_data_found'; end if;
  v_items := coalesce(p -> 'items', '[]'::jsonb);
  if jsonb_typeof(v_items) <> 'array' then
    raise exception '中身の形が違う' using errcode = 'invalid_parameter_value';
  end if;
  v_reason := p ->> 'change_reason';
  v_allowed := case d.key
    when 'kind' then array['key', 'name', 'color_key', 'body_template']
    when 'state' then array['key', 'name', 'color_key']
    when 'field' then array['key', 'name', 'field_type', 'required', 'description', 'options', 'kind_keys']
  end;
  if v_allowed is null then raise exception 'ひな形が無い' using errcode = 'no_data_found'; end if;

  for v_it in select e.x from jsonb_array_elements(v_items) with ordinality e(x, o) order by e.o loop
    v_key := v_it ->> 'key';
    if jsonb_typeof(v_it) <> 'object' or v_key is null then
      return jsonb_build_object('error', 'mismatch', 'key', v_key);
    end if;
    if exists (select 1 from jsonb_object_keys(v_it) k(n) where k.n <> all(v_allowed))
       or (d.key = 'field' and coalesce(v_it ->> 'field_type', '') = '')
       or v_key = any(v_seen) then
      return jsonb_build_object('error', 'mismatch', 'key', v_key);
    end if;
    v_seen := v_seen || v_key;
    if d.key = 'kind' or (d.key = 'state' and v_key <> all(c_fixed)) then
      v_count := v_count + 1;
      if (d.key = 'kind' and v_count > 10) or (d.key = 'state' and v_count > 8) then
        return jsonb_build_object('error', 'mismatch', 'key', v_key);
      end if;
    end if;
  end loop;

  select coalesce(v.snapshot -> 'items', '[]'::jsonb) into v_prev
    from distribution_versions v where v.distribution_id = p_id and v.version = d.current_version;
  v_prev := coalesce(v_prev, '[]'::jsonb);
  if v_items = v_prev then return jsonb_build_object('error', 'same'); end if;

  select coalesce(array_agg(td.tenant_id) filter (where app.template_offer_needed(p_id, td.tenant_id, v_items, v_prev)), '{}'),
         count(*)::int
    into v_tenants, v_using
    from tenant_distributions td
    join tenants t on t.id = td.tenant_id
   where td.distribution_id = p_id and td.deleted_at is null
     and t.deleted_at is null and t.half_made_at is null and t.id <> app.ops_tenant_id();
  v_offered := coalesce(cardinality(v_tenants), 0);

  if coalesce(p_dry, false) then
    return jsonb_build_object('data', app.ops_template_row(p_id),
                              'meta', jsonb_build_object('offered', v_offered, 'using', v_using));
  end if;

  v_ver := coalesce(d.current_version, 0) + 1;
  insert into distribution_versions (distribution_id, version, snapshot, released_at, released_by, change_reason)
  values (p_id, v_ver, jsonb_build_object('items', v_items), now(), v_me, v_reason);
  update distributions set current_version = v_ver, updated_by = v_me where id = p_id;

  update tenant_distributions
     set offered_version = v_ver, offered_at = now(), chosen = null, chosen_at = null, chosen_by = null, updated_by = v_me
   where distribution_id = p_id and deleted_at is null and tenant_id = any(v_tenants);

  insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, created_by)
  select tm.tenant_id, m.id, 'inapp', 'template.update',
         jsonb_build_object('distribution_id', p_id, 'part', d.key, 'version', v_ver),
         v_me
    from tenant_memberships tm
    join members m on m.id = tm.member_id
   where tm.tenant_id = any(v_tenants) and tm.role = 'admin' and tm.status = 'active'
     and tm.deleted_at is null and m.deleted_at is null;

  perform app.record_ops_audit(app.ops_tenant_id(), 'template.release', 'distributions', p_id::text, null,
                               jsonb_build_object('target_label', d.name, 'version', v_ver,
                                                  'offered', v_offered, 'reason', v_reason));

  return jsonb_build_object('data', app.ops_template_row(p_id),
                            'meta', jsonb_build_object('offered', v_offered, 'using', v_using));
end $$;
revoke all on function app.ops_template_release(uuid, jsonb, boolean) from public;
grant execute on function app.ops_template_release(uuid, jsonb, boolean) to kaname_app;

-- ④ 操作を読む（運営の会社の行だけ・名前の順）。1 行は { id, key, name, version_label, description, check_state }
create or replace function app.ops_operations() returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare v_rows jsonb;
begin
  perform app.ops_require('distribute');
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', o.id, 'key', o.key, 'name', o.name, 'version_label', o.version_label,
           'description', o.description, 'check_state', o.check_state)
         order by o.name, o.id), '[]'::jsonb)
    into v_rows
    from operations o
   where o.tenant_id = app.ops_tenant_id() and o.deleted_at is null;
  return v_rows;
end $$;
revoke all on function app.ops_operations() from public;
grant execute on function app.ops_operations() to kaname_app;

-- ⑤ 新しく入る会社の種まき（K-992 の app.template_seed）を直す。中身の入れ方は同じで、印だけを行の今の中身から作る。
--    仕組みの段（checking・awaiting_approval・running）は名前を直さないので、版の中身から印を作ると、運営が版で名前を変えた後に入る会社のその段が
--    最初から「手を付けた」に見えていた（K-992 のレビューの申し送り・PM の決め 2026-11-25）
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
               template_key = it->>'key'
         where id = v_id;
      else
        insert into ticket_kinds (tenant_id, name, color_key, body_template, position, is_builtin, template_key)
        values (p_tenant, it->>'name', it->>'color_key', nullif(it->'body_template', 'null'::jsonb),
                coalesce((select max(position) from ticket_kinds where tenant_id = p_tenant and deleted_at is null), 0) + 10,
                false, it->>'key');
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
               template_key = it->>'key'
         where s.id = v_id;
      else
        select position into v_end from ticket_stages where tenant_id = p_tenant and deleted_at is null and key = 'done';
        insert into ticket_stages (tenant_id, key, name, color_key, position, is_fixed, template_key)
        values (p_tenant, it->>'key', it->>'name', it->>'color_key', coalesce(v_end, 1000) - 1, false,
                it->>'key');
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
               template_key = it->>'key'
         where id = v_id;
      else
        insert into custom_fields (tenant_id, name, field_type, required, description, options, position, template_key)
        values (p_tenant, it->>'name', it->>'field_type', coalesce((it->>'required')::boolean, false),
                nullif(btrim(coalesce(it->>'description', '')), ''), v_opts,
                coalesce((select max(position) from custom_fields where tenant_id = p_tenant and deleted_at is null), 0) + 1,
                it->>'key')
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

  -- 印は 1 か所：入れ終わった会社の行の今の中身から作る（仕組みの段の名前は直さず色だけ直す・項目の種別は custom_field_kinds の後で決まるため）
  update ticket_kinds k set template_hash = app.template_item_hash('kind', app.template_item_of('kind', k.id))
   where k.tenant_id = p_tenant and k.deleted_at is null and k.template_key is not null;
  update ticket_stages s set template_hash = app.template_item_hash('state', app.template_item_of('state', s.id))
   where s.tenant_id = p_tenant and s.deleted_at is null and s.template_key is not null;
  update custom_fields f set template_hash = app.template_item_hash('field', app.template_item_of('field', f.id))
   where f.tenant_id = p_tenant and f.deleted_at is null and f.template_key is not null;
end $$;
revoke all on function app.template_seed(uuid) from public;
