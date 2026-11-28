-- 0001 foundation（T-F-01）。表は T-D-* が足す。ここは全表が前提にするものだけ。
-- 規約: RLS は current_setting('app.tenant_id') ベース。auth.uid() を使わない（G5）。Supabase 固有拡張を使わない。
create extension if not exists vector;
create extension if not exists pgcrypto;

create schema if not exists app;

-- テナント文脈（関門 C2 が要求ごとに SET LOCAL で入れる。無ければ null → RLS で 0 行）
create or replace function app.tenant_id() returns uuid
language sql stable as $$
  select nullif(current_setting('app.tenant_id', true), '')::uuid
$$;

create or replace function app.user_id() returns uuid
language sql stable as $$
  select nullif(current_setting('app.user_id', true), '')::uuid
$$;

-- 監査列の既定（全表が継承する型）
create or replace function app.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end
$$;

-- migration の適用記録（起動時の存在確認 G-11 がここを読む）
create table if not exists app.schema_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);
insert into app.schema_migrations (name) values ('0001_foundation.sql') on conflict do nothing;
