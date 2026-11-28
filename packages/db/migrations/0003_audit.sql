-- 0003 audit（T-F-04）。D-042.3・D-074.4・D-075.6・D-077.7。証跡は追記専用：直接の INSERT/UPDATE/DELETE は無く、関門の関数 app.record_*（security definer）だけが書く。

-- 運営テナント（運営の表は tenant_id＝運営）
create or replace function app.ops_tenant_id() returns uuid language sql immutable as $$ select '00000000-0000-4000-8000-000000000001'::uuid $$;
insert into tenants (id, tenant_id, name) values (app.ops_tenant_id(), app.ops_tenant_id(), '運営') on conflict do nothing;

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id),
  actor_member_id uuid, actor_role text not null, action text not null, target_type text not null, target_id text, choke_point_id text, payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid, updated_by uuid, deleted_at timestamptz
);
create index if not exists audit_events_tenant_time_idx on audit_events (tenant_id, occurred_at desc);
create index if not exists audit_events_target_idx on audit_events (tenant_id, target_type, target_id);

create table if not exists ops_audit_events (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id) default app.ops_tenant_id(),
  ops_member_id uuid, target_tenant_id uuid not null references tenants(id), action text not null, target_type text not null, target_id text, grant_id uuid, payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid, updated_by uuid, deleted_at timestamptz
);
create index if not exists ops_audit_events_target_idx on ops_audit_events (target_tenant_id, occurred_at desc);

create table if not exists security_events (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id),
  kind_id text not null, member_id uuid, ip_region text, detail jsonb not null default '{}'::jsonb, occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid, updated_by uuid, deleted_at timestamptz
);
create index if not exists security_events_tenant_time_idx on security_events (tenant_id, occurred_at desc);

-- 持ち出し（D-042。関門 C4 は T-F-10。kind_id／status_id のマスタは T-D-* で FK にする）
create table if not exists export_jobs (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id),
  requested_by uuid references members(id), kind_id text not null, storage_ref text, status_id text not null default 'requested', expires_at timestamptz, downloaded_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid, updated_by uuid, deleted_at timestamptz
);
drop trigger if exists export_jobs_updated_at on export_jobs; create trigger export_jobs_updated_at before update on export_jobs for each row execute function app.set_updated_at();

-- 追記専用：UPDATE / DELETE は所有者を含めて誰にも無い（トリガで raise）
create or replace function app.deny_change() returns trigger language plpgsql as $$
begin raise exception '% は追記専用（UPDATE/DELETE 不可）', tg_table_name using errcode = 'insufficient_privilege'; end $$;
do $$ declare t text; begin
  foreach t in array array['audit_events','ops_audit_events','security_events'] loop
    execute format('drop trigger if exists %I_append_only on %I', t, t);
    execute format('create trigger %I_append_only before update or delete on %I for each row execute function app.deny_change()', t, t);
  end loop; end $$;

-- 関門の関数（security definer）。会社の証跡：要求の文脈（app.*）から actor を取る
create or replace function app.record_audit(p_action text, p_target_type text, p_target_id text, p_choke text default null, p_payload jsonb default '{}'::jsonb) returns uuid
language plpgsql security definer set search_path = public, app as $$
declare v_id uuid; v_tenant uuid := app.tenant_id();
begin
  if v_tenant is null then raise exception '証跡を書くにはテナント文脈が要る' using errcode = 'insufficient_privilege'; end if;
  insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
  values (v_tenant, app.user_id(), coalesce(app.role(), 'anonymous'), p_action, p_target_type, p_target_id, p_choke, coalesce(p_payload, '{}'::jsonb), app.user_id()) returning id into v_id;
  return v_id;
end $$;

-- セキュリティの出来事：ログイン失敗など文脈が無い前に起きる → tenant を引数で
create or replace function app.record_security_event(p_tenant uuid, p_kind text, p_member uuid, p_ip_region text, p_detail jsonb default '{}'::jsonb) returns uuid
language plpgsql security definer set search_path = public, app as $$
declare v_id uuid;
begin
  insert into security_events (tenant_id, kind_id, member_id, ip_region, detail) values (p_tenant, p_kind, p_member, p_ip_region, coalesce(p_detail, '{}'::jsonb)) returning id into v_id;
  return v_id;
end $$;

-- 運営の証跡：運営テナントに書き、同じ行を対象の会社の audit_events にも写す（顧客が自分の証跡で見られる）
create or replace function app.record_ops_audit(p_target_tenant uuid, p_action text, p_target_type text, p_target_id text, p_grant uuid default null, p_payload jsonb default '{}'::jsonb) returns uuid
language plpgsql security definer set search_path = public, app as $$
declare v_id uuid;
begin
  if coalesce(app.role(), '') <> 'ops' then raise exception '運営の文脈でだけ書ける' using errcode = 'insufficient_privilege'; end if;
  insert into ops_audit_events (tenant_id, ops_member_id, target_tenant_id, action, target_type, target_id, grant_id, payload, created_by)
  values (app.ops_tenant_id(), app.user_id(), p_target_tenant, p_action, p_target_type, p_target_id, p_grant, coalesce(p_payload, '{}'::jsonb), app.user_id()) returning id into v_id;
  insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
  values (p_target_tenant, app.user_id(), 'ops', p_action, p_target_type, p_target_id, null, coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('ops_audit_id', v_id, 'grant_id', p_grant), app.user_id());
  return v_id;
end $$;

grant select, insert, update, delete on all tables in schema public to kaname_app;
grant execute on function app.record_audit(text, text, text, text, jsonb), app.record_security_event(uuid, text, uuid, text, jsonb), app.record_ops_audit(uuid, text, text, text, uuid, jsonb), app.ops_tenant_id() to kaname_app;

insert into app.schema_migrations (name) values ('0003_audit.sql') on conflict do nothing;
