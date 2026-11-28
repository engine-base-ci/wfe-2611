-- 0006 error_events（T-F-17）。D-069.3・D-069.4。エラーが「出た」記録。文言と次の一手は errors.json が正本（ここには code だけ）。
create table if not exists error_events (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id),
  error_code text not null, member_id uuid references members(id), screen_id text, context jsonb not null default '{}'::jsonb,
  shown_at timestamptz not null default now(), next_action_taken_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid, updated_by uuid, deleted_at timestamptz
);
create index if not exists error_events_tenant_time_idx on error_events (tenant_id, shown_at desc);
create index if not exists error_events_code_idx on error_events (tenant_id, error_code);
drop trigger if exists error_events_updated_at on error_events; create trigger error_events_updated_at before update on error_events for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('error_events', 'エラーの記録') on conflict do nothing;
grant select, insert, update, delete on all tables in schema public to kaname_app;
insert into app.schema_migrations (name) values ('0006_error_events.sql') on conflict do nothing;
