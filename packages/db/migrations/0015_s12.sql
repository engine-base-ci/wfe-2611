-- 0015_s12.sql：データ層 12. 運営と顧客の間で往復するもの・自分で整えるもの（14 表・mi（T-D-11）。正本 07_functional/entities.json（ER図）から scripts/ci/gen_ddl.py が生成。手で直さない（直すなら ER図 → build_functional → 再生成）

-- E-063 inquiries（12. 運営と顧客の間で往復するもの・自分で整えるもの）
create table if not exists inquiries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  opened_by_member_id uuid references members(id),
  kind_id text,
  status_id text,
  conversation_id uuid references conversations(id),
  assignee_ops_member_id uuid references members(id),
  ai_first_answered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists inquiries_tenant_idx on inquiries (tenant_id);
create index if not exists inquiries_opened_by_member_id_idx on inquiries (opened_by_member_id);
create index if not exists inquiries_conversation_id_idx on inquiries (conversation_id);
create index if not exists inquiries_assignee_ops_member_id_idx on inquiries (assignee_ops_member_id);
drop trigger if exists inquiries_updated_at on inquiries; create trigger inquiries_updated_at before update on inquiries for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('inquiries', 'inquiries') on conflict do nothing;

-- E-064 notices（12. 運営と顧客の間で往復するもの・自分で整えるもの）
create table if not exists notices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) default app.ops_tenant_id(),
  kind_id text,
  title text,
  body text,
  target_plan_ids uuid[],
  target_tenant_id uuid references tenants(id),
  publish_at timestamptz,
  published_by uuid references members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists notices_tenant_idx on notices (tenant_id);
create index if not exists notices_target_tenant_id_idx on notices (target_tenant_id);
create index if not exists notices_published_by_idx on notices (published_by);
drop trigger if exists notices_updated_at on notices; create trigger notices_updated_at before update on notices for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('notices', 'notices') on conflict do nothing;

-- E-067 notification_preferences（12. 運営と顧客の間で往復するもの・自分で整えるもの）
create table if not exists notification_preferences (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  member_id uuid references members(id),
  event_kind_id text,
  channel_id text,
  enabled boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists notification_preferences_tenant_idx on notification_preferences (tenant_id);
create index if not exists notification_preferences_member_id_idx on notification_preferences (member_id);
drop trigger if exists notification_preferences_updated_at on notification_preferences; create trigger notification_preferences_updated_at before update on notification_preferences for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('notification_preferences', 'notification_preferences') on conflict do nothing;

-- E-068 notifications（12. 運営と顧客の間で往復するもの・自分で整えるもの）
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  member_id uuid references members(id),
  channel_id text,
  event_kind_id text,
  payload jsonb,
  dedupe_key text,
  sent_at timestamptz,
  failed_at timestamptz,
  retry_count int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists notifications_tenant_idx on notifications (tenant_id);
create index if not exists notifications_member_id_idx on notifications (member_id);
drop trigger if exists notifications_updated_at on notifications; create trigger notifications_updated_at before update on notifications for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('notifications', 'notifications') on conflict do nothing;

-- E-069 plans（12. 運営と顧客の間で往復するもの・自分で整えるもの）
create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) default app.ops_tenant_id(),
  key text not null,
  name text,
  price_monthly numeric,
  limits jsonb,
  current_version int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  unique (tenant_id, key)
);
create index if not exists plans_tenant_idx on plans (tenant_id);
drop trigger if exists plans_updated_at on plans; create trigger plans_updated_at before update on plans for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('plans', 'plans') on conflict do nothing;

-- E-066 status_incidents（12. 運営と顧客の間で往復するもの・自分で整えるもの）
create table if not exists status_incidents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) default app.ops_tenant_id(),
  component_id text,
  service_id uuid references service_registry(id),
  state_id text,
  started_at timestamptz,
  resolved_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists status_incidents_tenant_idx on status_incidents (tenant_id);
create index if not exists status_incidents_service_id_idx on status_incidents (service_id);
drop trigger if exists status_incidents_updated_at on status_incidents; create trigger status_incidents_updated_at before update on status_incidents for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('status_incidents', 'status_incidents') on conflict do nothing;

-- E-073 usage_meters（12. 運営と顧客の間で往復するもの・自分で整えるもの）
create table if not exists usage_meters (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  meter_key text,
  period_start date,
  value numeric,
  limit_value numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists usage_meters_tenant_idx on usage_meters (tenant_id);
drop trigger if exists usage_meters_updated_at on usage_meters; create trigger usage_meters_updated_at before update on usage_meters for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('usage_meters', 'usage_meters') on conflict do nothing;

-- E-065 notice_deliveries（12. 運営と顧客の間で往復するもの・自分で整えるもの）
create table if not exists notice_deliveries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  notice_id uuid references notices(id),
  member_id uuid references members(id),
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists notice_deliveries_tenant_idx on notice_deliveries (tenant_id);
create index if not exists notice_deliveries_notice_id_idx on notice_deliveries (notice_id);
create index if not exists notice_deliveries_member_id_idx on notice_deliveries (member_id);
drop trigger if exists notice_deliveries_updated_at on notice_deliveries; create trigger notice_deliveries_updated_at before update on notice_deliveries for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('notice_deliveries', 'notice_deliveries') on conflict do nothing;

-- E-072 plan_change_requests（12. 運営と顧客の間で往復するもの・自分で整えるもの）
create table if not exists plan_change_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  from_plan_id uuid references plans(id),
  to_plan_id uuid references plans(id),
  requested_by uuid references members(id),
  status_id text,
  dependencies_event_id uuid references account_events(id),
  decided_by_ops_member_id uuid references members(id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists plan_change_requests_tenant_idx on plan_change_requests (tenant_id);
create index if not exists plan_change_requests_from_plan_id_idx on plan_change_requests (from_plan_id);
create index if not exists plan_change_requests_to_plan_id_idx on plan_change_requests (to_plan_id);
create index if not exists plan_change_requests_requested_by_idx on plan_change_requests (requested_by);
create index if not exists plan_change_requests_dependencies_event_id_idx on plan_change_requests (dependencies_event_id);
create index if not exists plan_change_requests_decided_by_ops_member_id_idx on plan_change_requests (decided_by_ops_member_id);
drop trigger if exists plan_change_requests_updated_at on plan_change_requests; create trigger plan_change_requests_updated_at before update on plan_change_requests for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('plan_change_requests', 'plan_change_requests') on conflict do nothing;

-- E-070 plan_versions（12. 運営と顧客の間で往復するもの・自分で整えるもの）
create table if not exists plan_versions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references plans(id),
  version int not null,
  snapshot jsonb,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, version)
);
create index if not exists plan_versions_plan_id_idx on plan_versions (plan_id);
drop trigger if exists plan_versions_updated_at on plan_versions; create trigger plan_versions_updated_at before update on plan_versions for each row execute function app.set_updated_at();

-- E-071 subscriptions（12. 運営と顧客の間で往復するもの・自分で整えるもの）
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  plan_id uuid references plans(id),
  status_id text,
  started_at timestamptz,
  suspended_at timestamptz,
  ended_at timestamptz,
  billing_contact jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists subscriptions_tenant_idx on subscriptions (tenant_id);
create index if not exists subscriptions_plan_id_idx on subscriptions (plan_id);
drop trigger if exists subscriptions_updated_at on subscriptions; create trigger subscriptions_updated_at before update on subscriptions for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('subscriptions', 'subscriptions') on conflict do nothing;

-- E-074 invoices（12. 運営と顧客の間で往復するもの・自分で整えるもの）
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  subscription_id uuid references subscriptions(id),
  period_start date,
  period_end date,
  amount numeric,
  issued_at timestamptz,
  due_on date,
  status_id text,
  pdf_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists invoices_tenant_idx on invoices (tenant_id);
create index if not exists invoices_subscription_id_idx on invoices (subscription_id);
drop trigger if exists invoices_updated_at on invoices; create trigger invoices_updated_at before update on invoices for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('invoices', 'invoices') on conflict do nothing;

-- E-075 payments（12. 運営と顧客の間で往復するもの・自分で整えるもの）
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  invoice_id uuid references invoices(id),
  paid_on date,
  amount numeric,
  method_id text,
  recorded_by_ops_member_id uuid references members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create index if not exists payments_tenant_idx on payments (tenant_id);
create index if not exists payments_invoice_id_idx on payments (invoice_id);
create index if not exists payments_recorded_by_ops_member_id_idx on payments (recorded_by_ops_member_id);
drop trigger if exists payments_updated_at on payments; create trigger payments_updated_at before update on payments for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('payments', 'payments') on conflict do nothing;

-- 先に作った表から今回の表への FK
do $$ begin if not exists (select 1 from pg_constraint where conname = 'tenants_plan_id_fkey') and exists (select 1 from information_schema.columns where table_name = 'tenants' and column_name = 'plan_id' and data_type = 'uuid') then alter table tenants add constraint tenants_plan_id_fkey foreign key (plan_id) references plans(id); end if; end $$;

grant select, insert, update, delete on inquiries, notices, notification_preferences, notifications, plans, status_incidents, usage_meters, notice_deliveries, plan_change_requests, plan_versions, subscriptions, invoices, payments to kaname_app;
insert into app.schema_migrations (name) values ('0015_s12.sql') on conflict do nothing;
