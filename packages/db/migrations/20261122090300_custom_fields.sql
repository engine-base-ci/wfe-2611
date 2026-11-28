-- 20261122090300 会社が足す項目の表と、分類の軸からの移し（K-563・D-150.36・D-150.37・D-150.46・関門 C2）
--   ① custom_fields：会社の項目（名前・型・必須・説明・選択肢・並び）。型は 7 つ。項目の数・選択肢の数に上限は置かない（D-130.1）
--   ② custom_field_kinds：どの種別で出すか（行が無い項目は全部の種別）
--   ③ ticket_field_values：チケットごとの値（jsonb・null は断る。値の形・必須・選択肢に在るかの確かめは書く口が持つ）
--   ⑥ app.custom_fields_move_axes：class_axes（作り付けでない）→ 「1 つ選ぶ」の項目・class_values → 選択肢・ticket_class_values → 値。
--      項目の id＝軸の id・選択肢の id＝値の id（段 9 の handover_rules.axis_id は付け替えずに項目の id として読める）。何度流しても増えない。
--      class_axes・class_values・ticket_class_values は凍結（列・行・引き金は変えない）
create table if not exists custom_fields (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  name text not null check (length(btrim(name, E' \t\r\n　')) between 1 and 40),
  field_type text not null check (field_type in ('short_text', 'long_text', 'number', 'date', 'select', 'multi_select', 'check')),
  required boolean not null default false,
  description text check (description is null or length(btrim(description, E' \t\r\n　')) > 0),
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  check (field_type in ('select', 'multi_select') or options = '[]'::jsonb)
);
create unique index if not exists custom_fields_name_uq on custom_fields (tenant_id, name) where deleted_at is null;
create index if not exists custom_fields_tenant_idx on custom_fields (tenant_id);

create table if not exists custom_field_kinds (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  field_id uuid not null references custom_fields(id),
  kind_id uuid not null references ticket_kinds(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create unique index if not exists custom_field_kinds_uq on custom_field_kinds (field_id, kind_id) where deleted_at is null;
create index if not exists custom_field_kinds_tenant_idx on custom_field_kinds (tenant_id);
create index if not exists custom_field_kinds_kind_idx on custom_field_kinds (kind_id);

create table if not exists ticket_field_values (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  ticket_id uuid not null references tickets(id),
  field_id uuid not null references custom_fields(id),
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create unique index if not exists ticket_field_values_uq on ticket_field_values (ticket_id, field_id) where deleted_at is null;
create index if not exists ticket_field_values_ticket_idx on ticket_field_values (ticket_id);
create index if not exists ticket_field_values_tenant_idx on ticket_field_values (tenant_id);

-- 種別の行・値は、項目・種別・チケットと同じ会社（別の会社につなげない）
create or replace function app.custom_field_same_tenant() returns trigger language plpgsql security definer set search_path = public, app, pg_temp as $$
begin
  if tg_table_name = 'custom_field_kinds' then
    if not exists (select 1 from custom_fields where id = new.field_id and tenant_id = new.tenant_id)
       or not exists (select 1 from ticket_kinds where id = new.kind_id and tenant_id = new.tenant_id) then
      raise exception '会社が違う（項目と種別は同じ会社の物だけ）' using errcode = '22023';
    end if;
  elsif tg_table_name = 'ticket_field_values' then
    if not exists (select 1 from tickets where id = new.ticket_id and tenant_id = new.tenant_id)
       or not exists (select 1 from custom_fields where id = new.field_id and tenant_id = new.tenant_id) then
      raise exception '会社が違う（チケットと項目は同じ会社の物だけ）' using errcode = '22023';
    end if;
  end if;
  return new;
end $$;

do $$ declare t text; begin
  foreach t in array array['custom_fields', 'custom_field_kinds', 'ticket_field_values'] loop
    execute format('drop trigger if exists %I_updated_at on %I', t, t);
    execute format('create trigger %I_updated_at before update on %I for each row execute function app.set_updated_at()', t, t);
    execute format('insert into target_kinds (key, label) values (%L, %L) on conflict do nothing', t, t);
  end loop;
  foreach t in array array['custom_field_kinds', 'ticket_field_values'] loop
    execute format('drop trigger if exists %I_same_tenant on %I', t, t);
    execute format('create trigger %I_same_tenant before insert or update on %I for each row execute function app.custom_field_same_tenant()', t, t);
  end loop;
end $$;

-- 軸 → 項目の移し（その会社 1 つ。何度流しても増えない）。答えは今回写した数
create or replace function app.custom_fields_move_axes(p_tenant uuid) returns jsonb language plpgsql security definer set search_path = public, app, pg_temp as $$
declare ax record; nm text; f int := 0; v int := 0; n int;
begin
  for ax in
    select a.id, a.name, a.position, a.created_by, a.updated_by from class_axes a
    where a.tenant_id = p_tenant and not a.is_builtin and a.deleted_at is null
    order by a.position, a.created_at, a.id
  loop
    if exists (select 1 from custom_fields where id = ax.id) then continue; end if;
    nm := ax.name;
    while exists (select 1 from custom_fields where tenant_id = p_tenant and name = nm and deleted_at is null) loop
      nm := nm || '（軸）';
    end loop;
    insert into custom_fields (id, tenant_id, name, field_type, required, options, position, created_by, updated_by)
    values (ax.id, p_tenant, nm, 'select', false,
      coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'name', o.label, 'position', o.rn) order by o.rn)
                from (select cv.id, cv.label, row_number() over (order by cv.position, cv.id) as rn
                        from class_values cv where cv.axis_id = ax.id and cv.tenant_id = p_tenant and cv.deleted_at is null) o), '[]'::jsonb),
      ax.position, ax.created_by, ax.updated_by);
    f := f + 1;
  end loop;
  insert into ticket_field_values (tenant_id, ticket_id, field_id, value, created_by, updated_by)
    select p_tenant, x.ticket_id, x.axis_id, to_jsonb(x.value_id::text), x.created_by, x.created_by
    from (select distinct on (tcv.ticket_id, cv.axis_id) tcv.ticket_id, cv.axis_id, cv.id as value_id, tcv.created_by
            from ticket_class_values tcv
            join class_values cv on cv.id = tcv.value_id and cv.deleted_at is null
            join class_axes a on a.id = cv.axis_id and not a.is_builtin and a.deleted_at is null
            where tcv.tenant_id = p_tenant and tcv.deleted_at is null
            order by tcv.ticket_id, cv.axis_id, tcv.created_at, tcv.id) x
    where exists (select 1 from custom_fields cf where cf.id = x.axis_id and cf.tenant_id = p_tenant)
    on conflict do nothing;
  get diagnostics n = row_count;
  v := n;
  return jsonb_build_object('fields', f, 'values', v);
end $$;
revoke all on function app.custom_fields_move_axes(uuid) from public;

-- 前からある会社の軸を、1 回だけ項目に移す
select app.custom_fields_move_axes(id) from tenants;

-- 管理者の束に新しい表を入れる（0080 の決まり）
select app.refresh_role_bundle_defaults();
do $$ declare r record; begin
  for r in select tenant_id, member_id from tenant_memberships where deleted_at is null loop
    perform app.apply_role_bundles(r.tenant_id, r.member_id);
  end loop;
end $$;
