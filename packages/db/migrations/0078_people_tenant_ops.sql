-- 0078 前からある表に足す列：人・会社・運営（K-10・D-125.128・D-128.46・D-128.55・D-128.57・D-128.58・D-128.68・D-128.70・D-128.95〜.98・D-128.108〜.110）
--   members（呼ばれ方・顔・言葉・見た目・週の始まり・時刻・はじめにやることを閉じた・一時的に止める）・tenants（ロゴ・取引先の見え方の既定・依頼の届け先・消す手続き）・
--   credentials（使える場所・見るだけ・取引先・目的・期限・使った数）・abilities（プランと支払い・書き出す・ワークスペースを消す）・
--   support_access_grants（中を見るの許可：理由・問い合わせ・1 時間・閉じた）・ops_members.caps（運営の人ができること）・notices・status_incidents・inquiries。
--   足すだけ（消す・名前を変えるはしない）。前からある行が新しい決まりに合わないことがあるので、行の決まりは NOT VALID で足す（新しい行から効く）。
--   ★中を見るの許可は、開いた運営の人に結ぶ（今までは、その会社に有効な許可が 1 つあれば、どの運営の人でも中を読めた）。

-- ---------------------------------------------------------------- 人（D-128.55・D-128.58・D-128.97）
alter table members add column if not exists call_name text;
alter table members add column if not exists avatar_ref text;
alter table members add column if not exists language text not null default 'ja';
alter table members add column if not exists theme text not null default 'system';
alter table members add column if not exists week_start smallint not null default 1;
alter table members add column if not exists timezone text not null default 'Asia/Tokyo';
alter table members add column if not exists setup_dismissed_at timestamptz;
alter table members add column if not exists suspended_at timestamptz;              -- 一時的に止める（入れなくなり分身も止まる。担当はそのまま）
alter table members add column if not exists suspended_by uuid references members(id);
do $$ begin
  alter table members add constraint members_call_name_ck check (call_name is null or length(call_name) <= 20) not valid;
  alter table members add constraint members_display_name_len_ck check (length(display_name) <= 100) not valid;
  alter table members add constraint members_theme_ck check (theme in ('system', 'light', 'dark'));
  alter table members add constraint members_week_start_ck check (week_start between 0 and 6);
  alter table members add constraint members_suspended_ck check ((suspended_at is null) = (suspended_by is null)) not valid;
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------- ワークスペース（D-128.46・D-128.54・D-128.98）
alter table tenants add column if not exists logo_ref text;
alter table tenants add column if not exists client_visibility_default text not null default 'all';
alter table tenants add column if not exists request_routing text;
alter table tenants add column if not exists deletion_requested_at timestamptz;      -- 消す手続き（14 日は取り消せる）
do $$ begin
  alter table tenants add constraint tenants_client_visibility_ck check (client_visibility_default in ('all', 'groups'));
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------- 預けたログイン情報（D-128.57：取り出せるのは宛先が合うときの実行器だけ）
alter table credentials add column if not exists destinations text[] not null default '{}';
alter table credentials add column if not exists read_only boolean not null default false;
alter table credentials add column if not exists client_id uuid references clients(id);
alter table credentials add column if not exists purpose text;
alter table credentials add column if not exists expires_at timestamptz;
alter table credentials add column if not exists use_count int not null default 0;
alter table credentials add column if not exists last_used_at timestamptz;

-- ---------------------------------------------------------------- 「誰ができるか」の 3 つ（既定は管理者・D-128.46・D-128.98）
insert into abilities (key, label) values ('billing', 'プランと支払い'), ('export', '書き出す'), ('delete_workspace', 'ワークスペースを消す')
on conflict (key) do nothing;

-- ---------------------------------------------------------------- 中を見るの許可（D-125.128・D-128.68）：理由が必須・1 時間・見るだけ・閉じられる
alter table support_access_grants add column if not exists reason text;
alter table support_access_grants add column if not exists inquiry_id uuid references inquiries(id);
alter table support_access_grants add column if not exists closed_at timestamptz;
do $$ begin
  alter table support_access_grants add constraint support_access_grants_reason_ck check (coalesce(length(trim(reason)), 0) > 0) not valid;
  alter table support_access_grants add constraint support_access_grants_hour_ck check (expires_at <= created_at + interval '1 hour') not valid;
  alter table support_access_grants add constraint support_access_grants_opener_ck check (ops_member_id is not null) not valid;
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------- 運営の人ができること（D-128.70）
alter table ops_members add column if not exists caps text[] not null default '{}';
do $$ begin
  -- 言葉は契約の ops:〜 と同じ（問い合わせ・中を見る・お金・止める・お知らせ・配るもの・値段の案・値段を決める・運営の人）
  alter table ops_members add constraint ops_members_caps_ck check (caps <@ array['inquiry', 'peek', 'money', 'stop', 'notice', 'distribute', 'plan_propose', 'plan_decide', 'ops_people']::text[]);
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------- お知らせ・障害（D-128.109・D-128.110）
alter table notices add column if not exists state text not null default 'draft';
alter table notices add column if not exists affects jsonb not null default '{}'::jsonb;
alter table notices add column if not exists placements text[] not null default '{list}';
alter table notices add column if not exists maintenance_from timestamptz;
alter table notices add column if not exists maintenance_to timestamptz;
alter table notices add column if not exists emailed_admins_at timestamptz;          -- メンテだけ管理者にメール
do $$ begin
  alter table notices add constraint notices_state_ck check (state in ('draft', 'scheduled', 'published'));
  alter table notices add constraint notices_placements_ck check (placements <@ array['list', 'banner', 'maintenance_page']::text[]);
  alter table notices add constraint notices_maintenance_ck check (maintenance_to is null or maintenance_from is null or maintenance_from < maintenance_to);
exception when duplicate_object then null;
end $$;
alter table status_incidents add column if not exists notice_id uuid references notices(id);
alter table status_incidents add column if not exists state text not null default 'investigating';
alter table status_incidents add column if not exists body text;
do $$ begin
  alter table status_incidents add constraint status_incidents_state_ck check (state in ('investigating', 'identified', 'monitoring', 'resolved'));   -- 調べている・原因が分かった・様子を見ている・直った
exception when duplicate_object then null;
end $$;
alter table inquiries add column if not exists context jsonb not null default '{}'::jsonb;   -- いま見ている画面の情報
alter table inquiries add column if not exists later_until timestamptz;

-- ---------------------------------------------------------------- ★中を見るの許可は、開いた運営の人だけに効く（閉じた・取り消した・期限切れは効かない）
create or replace function app.ops_grant_ok(t uuid) returns boolean language sql stable security definer set search_path = public, app as $$
  select coalesce(current_setting('app.role', true), '') = 'ops'
     and exists (
       select 1 from support_access_grants g join ops_members om on om.id = g.ops_member_id
       where g.tenant_id = t and g.expires_at > now() and g.revoked_at is null and g.closed_at is null and g.deleted_at is null
         and om.member_id = nullif(current_setting('app.user_id', true), '')::uuid and om.revoked_at is null and om.deleted_at is null
     )
$$;

insert into app.schema_migrations (name) values ('0078_people_tenant_ops.sql') on conflict do nothing;
