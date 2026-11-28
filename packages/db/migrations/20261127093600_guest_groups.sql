-- 20261127093600 ゲストのグループの置き場（K-876・契約の口 listGuestGroups・createGuestGroup・createInvitations・D-155.35・D-155.37・D-155.39・D-155.40・D-155.47・D-155.49・D-155.51・関門 C2）
--   ① guest_groups：ゲストのグループ（名前・表記ゆらぎをそろえた鍵 name_key・依頼が届く社内のグループ request_scope_id）。消していない物は会社の中で名前が一意
--   ② guest_group_members：ゲスト（役割 requester の人）がどのグループに入るか（1 人は消していない 1 つのグループ）
--   ③ 引き金 app.guest_same_tenant()：届け先の社内のグループ・グループ・人が同じ会社で、入る人が役割 requester であること（違えば 22023）
--   ④ invitations.guest_group_id（役割 requester の招待だけが持つ・check）
--   ⑤ 引き金 app.invitation_guest_join()：招待が受けられたとき（accepted_member_id が付くとき）、その招待のゲストのグループへ入れる。
--      受ける道 3 つ（0005 の前の道・app.accept_invitation・app.join_invitation）が共通で最後に行う更新に掛けるので、3 つの関数は変えない。
--      入れられなければ（ゲストでない人・別の会社）22023 で受ける取引ごと落ちる
--   ⑥ app.create_invitations を作り直す（引数 p_guest_group を足す）：requester はゲストのグループをちょうど 1 つ持ち、依頼の届け先 scope_id を持たない。
--      グループがこの会社の消していない物でなければ 42501・hint E-GST-001。ほかの役は今までどおり（p_guest_group を持てない）
--   ⑦ app.guest_group_create(p_name, p_request_scope)：メンバーを招く権限か直す権限を持つ人だけ。届け先が無ければ 42501・hint E-GST-003、
--      同じ名前は 22023・hint E-GST-002。証跡 guest_group.created（payload は届け先だけ・名前は載せない）
--   ⑧ app.invitation_preview2 を作り直す（形は 20261121092100 のまま）：requester の招待の group_name はゲストのグループの名前（社内のグループの名前を出さない）
--   ⑨ app.workspace_members を作り直す（形は 20261121091900 のまま）：ゲスト（requester）を人にも招待中にも人数にも入れない
--   ⑩ app.guest_groups_list()：メンバーを見る権限か招く権限を持つ人だけ。消していないグループを名前の順に、届け先・ゲスト・招待中つきで
--
-- どれも security definer・search_path に pg_temp・public から外し kaname_app にだけ渡す（引き金の関数は渡さない）

create table if not exists guest_groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  name text not null check (length(btrim(name)) between 1 and 80),
  name_key text generated always as (lower(regexp_replace(normalize(btrim(name), NFKC), '\s+', '', 'g'))) stored,
  request_scope_id uuid not null references scopes(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create unique index if not exists guest_groups_name_uq on guest_groups (tenant_id, name_key) where deleted_at is null;
create index if not exists guest_groups_tenant_idx on guest_groups (tenant_id);

create table if not exists guest_group_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  guest_group_id uuid not null references guest_groups(id),
  member_id uuid not null references members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
create unique index if not exists guest_group_members_member_uq on guest_group_members (member_id) where deleted_at is null;
create index if not exists guest_group_members_group_idx on guest_group_members (tenant_id, guest_group_id);

-- 同じ会社の物だけ（0075 の app.people_same_tenant と同じ形・表ごとに分けて見る）
create or replace function app.guest_same_tenant() returns trigger
language plpgsql security definer set search_path = public, app, pg_temp as $$
begin
  if tg_table_name = 'guest_groups' then
    if not exists (select 1 from scopes s where s.id = new.request_scope_id and s.tenant_id = new.tenant_id) then
      raise exception '依頼が届くグループは同じ会社のもの' using errcode = '22023';
    end if;
  elsif tg_table_name = 'guest_group_members' then
    if not exists (select 1 from guest_groups g where g.id = new.guest_group_id and g.tenant_id = new.tenant_id)
       or not exists (select 1 from members m where m.id = new.member_id and m.tenant_id = new.tenant_id) then
      raise exception 'ゲストのグループと人は同じ会社のもの' using errcode = '22023';
    end if;
    if not exists (select 1 from tenant_memberships tm
                    where tm.tenant_id = new.tenant_id and tm.member_id = new.member_id and tm.role = 'requester') then
      raise exception 'ゲストのグループに入るのは役割ゲストの人だけ' using errcode = '22023';
    end if;
  end if;
  return new;
end $$;
revoke all on function app.guest_same_tenant() from public;

do $$ declare t text; begin
  foreach t in array array['guest_groups', 'guest_group_members'] loop
    execute format('drop trigger if exists %I_same_tenant on %I', t, t);
    execute format('create trigger %I_same_tenant before insert or update on %I for each row execute function app.guest_same_tenant()', t, t);
    execute format('drop trigger if exists %I_updated_at on %I', t, t);
    execute format('create trigger %I_updated_at before update on %I for each row execute function app.set_updated_at()', t, t);
    execute format('insert into target_kinds (key, label) values (%L, %L) on conflict do nothing', t, t);
  end loop;
end $$;

alter table invitations add column if not exists guest_group_id uuid references guest_groups(id);
alter table invitations add constraint invitations_guest_group_role_ck check (guest_group_id is null or role_id = 'requester');
comment on column invitations.guest_group_id is 'ゲストのグループ。役割 requester の招待だけが持つ（K-876）';

-- 招待が受けられたとき（accepted_member_id が付くとき）、その招待のゲストのグループへ入れる（受ける取引の中・別の取引にしない）
create or replace function app.invitation_guest_join() returns trigger
language plpgsql security definer set search_path = public, app, pg_temp as $$
begin
  insert into guest_group_members (tenant_id, guest_group_id, member_id, created_by)
  values (new.tenant_id, new.guest_group_id, new.accepted_member_id, new.created_by)
  on conflict (member_id) where deleted_at is null
  do update set guest_group_id = excluded.guest_group_id;
  return null;
end $$;
revoke all on function app.invitation_guest_join() from public;
drop trigger if exists invitations_guest_join on invitations;
create trigger invitations_guest_join after update of accepted_member_id on invitations
  for each row when (old.accepted_member_id is null and new.accepted_member_id is not null and new.guest_group_id is not null)
  execute function app.invitation_guest_join();

-- squawk-ignore ban-drop-function
drop function if exists app.create_invitations(text[], uuid, text, text, text[]);
create or replace function app.create_invitations(
  p_emails text[], p_scope uuid, p_role text, p_message text, p_token_hashes text[], p_guest_group uuid default null
) returns table (invitation_id uuid, email text, expires_at timestamptz)
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_user uuid := app.user_id();
  v_in text[];
  i int;
  v_email text;
  v_id uuid;
  v_exp timestamptz := now() + interval '7 days';
  v_guest boolean := p_role = 'requester';
begin
  if v_tenant is null or v_user is null
     or not has_permission(v_user, 'members', null, 'invite') then
    raise exception '招く権限が無い' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(array_length(p_emails, 1), 0) = 0
     or array_length(p_emails, 1) <> coalesce(array_length(p_token_hashes, 1), 0)
     or p_role is null or p_role not in ('admin', 'manager', 'member', 'viewer', 'requester') then
    raise exception '招く入力が正しくない' using errcode = '22023';
  end if;
  if v_guest then
    -- ゲストはゲストのグループをちょうど 1 つ選び、依頼の届け先（社内のグループ）を持たない
    if p_scope is not null or p_guest_group is null then
      raise exception 'ゲストの招待はゲストのグループだけを持つ' using errcode = '22023';
    end if;
    if not exists (select 1 from guest_groups g
                    where g.id = p_guest_group and g.tenant_id = v_tenant and g.deleted_at is null) then
      raise exception 'このゲストのグループには招けない' using errcode = 'insufficient_privilege', hint = 'E-GST-001';
    end if;
  else
    if p_guest_group is not null then
      raise exception 'ゲストでない招待はゲストのグループを持てない' using errcode = '22023';
    end if;
    if not exists (select 1 from scopes s where s.id = p_scope and s.tenant_id = v_tenant and s.deleted_at is null) then
      raise exception 'このグループには招けない' using errcode = 'insufficient_privilege', hint = 'E-INV-011';
    end if;
  end if;
  select coalesce(array_agg(m.email), '{}') into v_in from app.invitation_member_emails(p_emails) m;
  if coalesce(array_length(v_in, 1), 0) > 0 then
    raise exception 'もうこのワークスペースに入っている人がいる' using errcode = '22023', hint = 'E-INV-010',
      detail = array_to_string(v_in, E'\n');
  end if;
  for i in 1 .. array_length(p_emails, 1) loop
    v_email := lower(p_emails[i]);
    update invitations x set revoked_at = now()
     where x.tenant_id = v_tenant and lower(x.email) = v_email and x.revoked_at is null
       and x.accepted_member_id is null and x.deleted_at is null and x.expires_at > now();
    insert into invitations (tenant_id, email, scope_id, role_id, message, token_hash, expires_at, created_by, guest_group_id)
    values (v_tenant, v_email, case when v_guest then null else p_scope end, p_role, nullif(p_message, ''), p_token_hashes[i], v_exp, v_user,
            case when v_guest then p_guest_group end)
    returning id into v_id;
    perform app.record_audit('invitation.created', 'invitation', v_id::text, 'C6',
      case when v_guest
           then jsonb_build_object('role', p_role, 'guest_group_id', p_guest_group)
           else jsonb_build_object('email_domain', split_part(v_email, '@', 2), 'role', p_role, 'scope_id', p_scope) end);
    invitation_id := v_id; email := v_email; expires_at := v_exp;
    return next;
  end loop;
end $$;
revoke all on function app.create_invitations(text[], uuid, text, text, text[], uuid) from public;
grant execute on function app.create_invitations(text[], uuid, text, text, text[], uuid) to kaname_app;

create or replace function app.guest_group_create(p_name text, p_request_scope uuid) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_user uuid := app.user_id();
  v_name text := btrim(coalesce(p_name, ''), E' \t\r\n　');
  v_scope_name text;
  v_id uuid;
begin
  if v_tenant is null or v_user is null
     or not (has_permission(v_user, 'members', null, 'invite') or has_permission(v_user, 'members', null, 'edit')) then
    raise exception 'ゲストのグループを作る権限が無い' using errcode = 'insufficient_privilege';
  end if;
  select s.name into v_scope_name from scopes s
   where s.id = p_request_scope and s.tenant_id = v_tenant and s.deleted_at is null;
  if not found then
    raise exception '依頼が届くグループが無い' using errcode = 'insufficient_privilege', hint = 'E-GST-003';
  end if;
  begin
    insert into guest_groups (tenant_id, name, request_scope_id, created_by)
    values (v_tenant, v_name, p_request_scope, v_user)
    returning id into v_id;
  exception when unique_violation then
    raise exception '同じ名前のゲストのグループがある' using errcode = '22023', hint = 'E-GST-002';
  end;
  perform app.record_audit('guest_group.created', 'guest_group', v_id::text, 'C2',
    jsonb_build_object('request_scope_id', p_request_scope));
  return jsonb_build_object('id', v_id, 'name', v_name,
    'request_scope', jsonb_build_object('id', p_request_scope, 'name', v_scope_name));
end $$;
revoke all on function app.guest_group_create(text, uuid) from public;
grant execute on function app.guest_group_create(text, uuid) to kaname_app;

create or replace function app.guest_groups_list() returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_user uuid := app.user_id();
begin
  if v_tenant is null or v_user is null
     or not (has_permission(v_user, 'members', null, 'view') or has_permission(v_user, 'members', null, 'invite')) then
    raise exception 'ゲストのグループを見る権限が無い' using errcode = 'insufficient_privilege';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', g.id,
      'name', g.name,
      'request_scope', (select jsonb_build_object('id', s.id, 'name', s.name) from scopes s
                         where s.id = g.request_scope_id and s.deleted_at is null),
      'guests', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', m.id, 'name', m.display_name, 'email', u.email::text,
          'suspended', coalesce(tm.status = 'suspended' or m.suspended_at is not null, false)
        ) order by m.display_name, m.id)
          from guest_group_members gm
          join members m on m.id = gm.member_id and m.deleted_at is null
          join tenant_memberships tm on tm.tenant_id = m.tenant_id and tm.member_id = m.id
               and tm.status in ('active', 'suspended') and tm.deleted_at is null
          left join kaname_auth."user" u on u.id = coalesce(m.auth_user_id, tm.auth_user_id)
         where gm.guest_group_id = g.id and gm.tenant_id = v_tenant and gm.deleted_at is null), '[]'::jsonb),
      'invitations', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', i.id, 'email', i.email,
          'left_days', ceil(extract(epoch from (i.expires_at - now())) / 86400)::int
        ) order by i.created_at, i.id)
          from invitations i
         where i.tenant_id = v_tenant and i.guest_group_id = g.id and i.role_id = 'requester'
           and i.deleted_at is null and i.revoked_at is null and i.accepted_member_id is null
           and i.expires_at > now() and i.email is not null), '[]'::jsonb)
    ) order by g.name, g.id)
      from guest_groups g
     where g.tenant_id = v_tenant and g.deleted_at is null
  ), '[]'::jsonb);
end $$;
revoke all on function app.guest_groups_list() from public;
grant execute on function app.guest_groups_list() to kaname_app;

create or replace function app.invitation_preview2(p_token_hash text, p_auth_user_id text default null)
returns table (state text, workspace_name text, inviter_name text, group_name text, role text, message text, email text,
               expires_at timestamptz, account_exists boolean, signed_email text, email_matches boolean, already_member boolean)
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_inv invitations%rowtype;
  v_has_auth boolean := to_regclass('kaname_auth."user"') is not null;
  v_exists boolean := false;
  v_signed text;
begin
  select * into v_inv from invitations i where i.token_hash = p_token_hash;
  if not found then return; end if;
  if v_has_auth then
    if v_inv.email is not null then
      execute 'select exists (select 1 from kaname_auth."user" u where lower(u.email) = lower($1))' into v_exists using v_inv.email;
    end if;
    if p_auth_user_id is not null then
      execute 'select u.email from kaname_auth."user" u where u.id = $1' into v_signed using p_auth_user_id;
    end if;
  end if;
  return query
  select case
           when v_inv.accepted_member_id is not null then 'used'
           when v_inv.revoked_at is not null or v_inv.deleted_at is not null then 'revoked'
           when v_inv.expires_at < now() then 'expired'
           else 'ok'
         end,
         t.name,
         (select m.display_name from members m where m.id = v_inv.created_by),
         -- ゲストの招待はゲストのグループの名前（社内のグループの名前を外の人に見せない・K-876）
         case when v_inv.role_id = 'requester'
              then (select g.name from guest_groups g where g.id = v_inv.guest_group_id and g.deleted_at is null)
              else (select s.name from scopes s where s.id = v_inv.scope_id and s.deleted_at is null) end,
         case when v_inv.role_id in ('admin', 'manager', 'member', 'viewer', 'requester') then v_inv.role_id else 'member' end,
         v_inv.message,
         v_inv.email,
         v_inv.expires_at,
         coalesce(v_exists, false),
         case when p_auth_user_id is null then null else v_signed end,
         case when p_auth_user_id is null then null
              when v_inv.email is null then true
              else coalesce(lower(v_signed) = lower(v_inv.email), false) end,
         case when p_auth_user_id is null then null
              else exists (select 1 from app.current_members_of_auth_user(p_auth_user_id) c where c.tenant_id = v_inv.tenant_id) end
    from tenants t
   where t.id = v_inv.tenant_id;
end $$;
revoke all on function app.invitation_preview2(text, text) from public;
grant execute on function app.invitation_preview2(text, text) to kaname_app;

-- ⑨ メンバーの並び（20261126000800（K-808）の版・ゲストを人にも招待中にも人数にも入れない 2 か所だけ足した。統合の枝で K-808 の「最後に使った日」の 2 つの鍵を写した）
create or replace function app.workspace_members() returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_self uuid := app.user_id();
  v_out jsonb;
begin
  if v_tenant is null then
    raise exception 'ワークスペースの文脈が無い' using errcode = 'insufficient_privilege';
  end if;
  with recursive tree as (
    select s.id, s.name, s.ticket_prefix, s.created_at, 0 as depth
      from scopes s
     where s.tenant_id = v_tenant and s.deleted_at is null
       and (s.parent_id is null
            or not exists (select 1 from scopes p where p.id = s.parent_id and p.deleted_at is null))
    union all
    select c.id, c.name, c.ticket_prefix, c.created_at, t.depth + 1
      from scopes c join tree t on c.parent_id = t.id
     where c.tenant_id = v_tenant and c.deleted_at is null
  ),
  people as (
    select m.id, m.display_name, m.scope_id as primary_scope, u.email::text as email,
           coalesce(tm.role, case when m.role_id = 'owner' then 'admin' else 'member' end) as role,
           coalesce(tm.status = 'suspended' or m.suspended_at is not null, false) as suspended
      from members m
      left join tenant_memberships tm on tm.tenant_id = m.tenant_id and tm.member_id = m.id
      left join kaname_auth."user" u on u.id = coalesce(m.auth_user_id, tm.auth_user_id)
     where m.tenant_id = v_tenant and m.deleted_at is null and m.kind_id = 'human'
       and (tm.id is null or (tm.status in ('active', 'suspended') and tm.deleted_at is null))
       and coalesce(tm.role, case when m.role_id = 'owner' then 'admin' else 'member' end) <> 'requester'   -- ゲストは出さない（K-876・D-155.39・D-155.49）
  ),
  seat as (
    select p.id as member_id, p.primary_scope as scope_id, true as is_primary from people p
    union all
    select sm.member_id, sm.scope_id, false
      from scope_memberships sm join people p on p.id = sm.member_id
     where sm.tenant_id = v_tenant and sm.deleted_at is null and sm.scope_id <> p.primary_scope
  ),
  seats as (
    select st.scope_id, p.id as member_id, p.display_name, p.email, p.role, p.suspended, st.is_primary,
           (select sm.role from scope_memberships sm
             where sm.member_id = p.id and sm.scope_id = st.scope_id and sm.deleted_at is null) as group_role,
           case when st.is_primary then
             coalesce((select jsonb_agg(s2.name order by s2.created_at, s2.id)
                         from scope_memberships sm2 join scopes s2 on s2.id = sm2.scope_id and s2.deleted_at is null
                        where sm2.member_id = p.id and sm2.deleted_at is null and sm2.scope_id <> p.primary_scope),
                      '[]'::jsonb)
           else '[]'::jsonb end as other_groups,
           ps.seen, lu.used
      from seat st
      join people p on p.id = st.member_id
      join tree g on g.id = st.scope_id
      left join lateral (
        select max(s.last_seen_at) as seen from sessions s
         where s.member_id = p.id and s.kind_id = 'bridge' and s.deleted_at is null
      ) ps on true
      left join lateral (
        select max(s.last_seen_at) as used from sessions s
         where s.member_id = p.id and s.kind_id = 'web' and s.deleted_at is null
      ) lu on true
  ),
  inv as (
    select i.id, i.email, i.scope_id, i.role_id as role, i.expires_at,
           ceil(extract(epoch from (i.expires_at - now())) / 86400)::int as left_days, i.created_at
      from invitations i
     where i.tenant_id = v_tenant and i.deleted_at is null and i.revoked_at is null
       and i.accepted_member_id is null and i.expires_at > now() and i.email is not null
       and i.role_id is distinct from 'requester'   -- ゲストの招待は listGuestGroups で読む（K-876）
  )
  select jsonb_build_object(
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id, 'code', g.ticket_prefix, 'name', g.name,
        'members', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', r.member_id, 'name', r.display_name, 'email', r.email, 'role', r.role,
            'group_role', r.group_role, 'primary', r.is_primary, 'other_groups', r.other_groups,
            'self', r.member_id = v_self, 'suspended', r.suspended,
            'pc', case when r.role in ('viewer', 'requester') then 'none'
                       when r.seen is null then 'never'
                       when r.seen > now() - interval '1 day' then 'ok'
                       else 'away' end,
            'pc_days_away', case when r.role not in ('viewer', 'requester') and r.seen is not null
                                      and r.seen <= now() - interval '1 day'
                                 then floor(extract(epoch from (now() - r.seen)) / 86400)::int end,
            'last_used_at', r.used,
            'last_used_days', case when r.used is null then null
                                   else floor(extract(epoch from (now() - r.used)) / 86400)::int end
          ) order by r.display_name, r.member_id)
          from seats r where r.scope_id = g.id), '[]'::jsonb)
      ) order by g.depth, g.created_at, g.id)
      from tree g), '[]'::jsonb),
    'invitations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', v.id, 'email', v.email, 'scope_id', v.scope_id, 'role', v.role,
        'expires_at', v.expires_at, 'left_days', v.left_days) order by v.created_at, v.id)
      from inv v), '[]'::jsonb),
    'alerts', '[]'::jsonb,
    'count', (select count(distinct r.member_id) from seats r) + (select count(*) from inv)
  ) into v_out;
  return v_out;
end $$;
revoke all on function app.workspace_members() from public;
grant execute on function app.workspace_members() to kaname_app;
