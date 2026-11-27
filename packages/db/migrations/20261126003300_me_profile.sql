-- 20261126003300 自分を読む・直す（K-833・契約の口 getMe・updateMe・D-125.150・D-128.55・D-128.58・D-154.50・D-154.55・D-154.56・D-154.62・D-154.75・関門 C2）
--
-- ① app.me_rows() returns table：今のログインの人（app.user_id()）と同じログイン（app.account_members・D-125.150）の、抜けていない所属の人の行。
--      所属の行が active か suspended（会社を作った人は所属の行を持たないので members で見る）・人が消えていない・会社が消えていない。
--      tenant_id・member_id・role（所属の役割。所属の行の無い owner は admin）。中で使うだけ（誰にも execute を渡さない）
-- ② app.me_email_pending() returns text：確かめ待ちの新しいメール。空の形（常に null）。K-835 が create or replace で本物にする
-- ③ app.me_leave_state(p_tenant uuid) returns jsonb：同じログインがその会社に active か suspended で入っているときだけ
--      { own, last_admin, assigned_total, assigned: [{ id, number, title }]（先頭 10 件・更新の新しい順） }。入っていなければ null。
--      own＝その会社の有効な人（消えていない・止めていない・所属が active か所属の行の無い人）が自分だけ。
--      last_admin＝その会社の管理者（所属の role が admin で status が active の人と、所属の行を持たない owner。止めた管理者は数えない）が自分だけ。
--      assigned＝その会社で自分が担当で、終わっていない（completed_at が空）・消していないチケット。K-838 が抜ける口の判定にそのまま使う
-- ④ app.me_read() returns jsonb：{ member, workspaces, workspace_name }。member は今の会社の自分の行（顔は avatar_ref のまま。期限つき URL は口が作る）。
--      workspaces は ① の行ごとに { tenant_id, name, role, group（主の所属 members.scope_id のグループの名前）, current } と ③ の中身。
--      workspace_name は今の会社の tenants.name の前後の空白（全角を含む）を削り、空なら null（K-253 と同じ決め）。
--      止めた人・抜けた人が呼んだら { error: 'forbidden' }
-- ⑤ app.me_update(p_patch jsonb) returns jsonb：送った欄（name→display_name・call_name・language・theme・week_start・timezone）だけを、
--      ① の全部の人の行に 1 つの取引で書く（updated_by はその行の人）。値が変わる行だけ書く（同じ値への保存は何も書かない）。
--      顔（avatar_ref）は触らない（今の会社の行だけ・K-834）。会社の記録（audit_events）には載せない（D-154.55）。
--      値の確かめを関数の中でも持つ（入口・口・DB の 3 層）：外れたら { error: 'invalid', field }。止めた人・抜けた人は { error: 'forbidden' }。
--      答えは { member（今の会社の自分の行）, saved_at（今の会社の行の updated_at・UTC の ISO 8601） }
--
-- どれも security definer・search_path に pg_temp・public から外す。口が呼ぶ ③④⑤ だけ kaname_app に渡す。
-- 認証の表 kaname_auth."user" は同じ DB（plpgsql なので migration の時点で無くてよい・20261121091900 と同じ）

create or replace function app.me_rows()
returns table (tenant_id uuid, member_id uuid, role text)
language sql stable security definer set search_path = public, app, pg_temp as $$
  select m.tenant_id, m.id,
         coalesce(tm.role, case when m.role_id = 'owner' then 'admin' else 'member' end)
    from app.account_members(app.user_id()) a(member_id)
    join members m on m.id = a.member_id and m.deleted_at is null
    join tenants t on t.id = m.tenant_id and t.deleted_at is null
    left join tenant_memberships tm on tm.tenant_id = m.tenant_id and tm.member_id = m.id
   where app.user_id() is not null
     and (tm.id is null or (tm.status in ('active', 'suspended') and tm.deleted_at is null))
$$;
revoke all on function app.me_rows() from public;

create or replace function app.me_email_pending() returns text
language sql stable security definer set search_path = public, app, pg_temp as $$
  select null::text
$$;
revoke all on function app.me_email_pending() from public;

-- 今のログインの人が呼べるか（消えていない・止めていない・所属が抜けた・招待中でない）
create or replace function app.me_usable() returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select exists (
    select 1 from members m
      left join tenant_memberships tm on tm.tenant_id = m.tenant_id and tm.member_id = m.id
     where m.id = app.user_id() and m.tenant_id = app.tenant_id()
       and m.deleted_at is null and m.suspended_at is null
       and (tm.id is null or (tm.status = 'active' and tm.deleted_at is null))
  )
$$;
revoke all on function app.me_usable() from public;

-- 今の会社の自分の行（口が member の形に直す。顔は avatar_ref のまま）
create or replace function app.me_member_row() returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare v_out jsonb;
begin
  select jsonb_build_object(
           'id', m.id, 'name', m.display_name, 'call_name', m.call_name, 'email', u.email::text,
           'avatar_ref', m.avatar_ref, 'language', m.language, 'theme', m.theme, 'week_start', m.week_start,
           'timezone', m.timezone, 'email_pending', app.me_email_pending())
    into v_out
    from members m
    left join tenant_memberships tm on tm.tenant_id = m.tenant_id and tm.member_id = m.id
    left join kaname_auth."user" u on u.id = coalesce(m.auth_user_id, tm.auth_user_id)
   where m.id = app.user_id() and m.tenant_id = app.tenant_id();
  return v_out;
end $$;
revoke all on function app.me_member_row() from public;

create or replace function app.me_leave_state(p_tenant uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_me uuid;
  v_own boolean;
  v_last boolean;
  v_total int;
  v_list jsonb;
begin
  select r.member_id into v_me from app.me_rows() r where r.tenant_id = p_tenant limit 1;
  if v_me is null then
    return null;
  end if;
  -- 有効な人：消えていない・止めていない人で、所属の行が active か、所属の行を持たない人（会社を作った人）
  select coalesce(bool_and(m.id = v_me), false) and count(*) > 0 into v_own
    from members m
    left join tenant_memberships tm on tm.tenant_id = m.tenant_id and tm.member_id = m.id
   where m.tenant_id = p_tenant and m.deleted_at is null and m.suspended_at is null and m.kind_id = 'human'
     and (tm.id is null or (tm.status = 'active' and tm.deleted_at is null));
  -- 管理者：所属の role が admin で status が active の人と、所属の行を持たない owner（止めた管理者は数えない）
  select coalesce(bool_and(m.id = v_me), false) and count(*) > 0 into v_last
    from members m
    left join tenant_memberships tm on tm.tenant_id = m.tenant_id and tm.member_id = m.id
   where m.tenant_id = p_tenant and m.deleted_at is null and m.suspended_at is null
     and ((tm.id is not null and tm.role = 'admin' and tm.status = 'active' and tm.deleted_at is null)
          or (tm.id is null and m.role_id = 'owner'));
  select count(*) into v_total
    from tickets k
   where k.tenant_id = p_tenant and k.assignee_member_id = v_me and k.completed_at is null and k.deleted_at is null;
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'number', x.number, 'title', x.title)
                            order by x.updated_at desc, x.id), '[]'::jsonb)
    into v_list
    from (select k.id, k.number, k.title, k.updated_at
            from tickets k
           where k.tenant_id = p_tenant and k.assignee_member_id = v_me and k.completed_at is null and k.deleted_at is null
           order by k.updated_at desc, k.id
           limit 10) x;
  return jsonb_build_object('own', v_own, 'last_admin', v_last, 'assigned_total', v_total, 'assigned', v_list);
end $$;
revoke all on function app.me_leave_state(uuid) from public;
grant execute on function app.me_leave_state(uuid) to kaname_app;

create or replace function app.me_read() returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_ws jsonb;
  v_name text;
begin
  if v_tenant is null or app.user_id() is null then
    raise exception 'ワークスペースの文脈が無い' using errcode = 'insufficient_privilege';
  end if;
  if not app.me_usable() then
    return jsonb_build_object('error', 'forbidden');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'tenant_id', r.tenant_id,
           'name', coalesce(nullif(regexp_replace(t.name, '^[[:space:]　]+|[[:space:]　]+$', '', 'g'), ''), t.name),
           'role', r.role,
           'group', (select s.name from members m join scopes s on s.id = m.scope_id and s.deleted_at is null
                      where m.id = r.member_id),
           'current', r.tenant_id = v_tenant
         ) || coalesce(app.me_leave_state(r.tenant_id), '{}'::jsonb)
         order by (r.tenant_id = v_tenant) desc, t.name, r.tenant_id), '[]'::jsonb)
    into v_ws
    from app.me_rows() r
    join tenants t on t.id = r.tenant_id;
  select nullif(regexp_replace(t.name, '^[[:space:]　]+|[[:space:]　]+$', '', 'g'), '') into v_name
    from tenants t where t.id = v_tenant;
  return jsonb_build_object('member', app.me_member_row(), 'workspaces', v_ws, 'workspace_name', v_name);
end $$;
revoke all on function app.me_read() from public;
grant execute on function app.me_read() to kaname_app;

create or replace function app.me_update(p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_name text;
  v_call text;
  v_lang text;
  v_theme text;
  v_week smallint;
  v_tz text;
  v_has_name boolean := p_patch ? 'name';
  v_has_call boolean := p_patch ? 'call_name';
  v_has_lang boolean := p_patch ? 'language';
  v_has_theme boolean := p_patch ? 'theme';
  v_has_week boolean := p_patch ? 'week_start';
  v_has_tz boolean := p_patch ? 'timezone';
  v_saved timestamptz;
begin
  if v_tenant is null or app.user_id() is null then
    raise exception 'ワークスペースの文脈が無い' using errcode = 'insufficient_privilege';
  end if;
  if not app.me_usable() then
    return jsonb_build_object('error', 'forbidden');
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object'
     or not (v_has_name or v_has_call or v_has_lang or v_has_theme or v_has_week or v_has_tz)
     or exists (select 1 from jsonb_object_keys(p_patch) k
                 where k not in ('name', 'call_name', 'language', 'theme', 'week_start', 'timezone')) then
    return jsonb_build_object('error', 'invalid', 'field', 'body');
  end if;
  -- 値の確かめ（3 層目）：口と同じ決まり
  if v_has_name then
    v_name := case when jsonb_typeof(p_patch -> 'name') = 'string' then p_patch ->> 'name' end;
    if v_name is null or v_name !~ '[^[:space:]　]' or length(v_name) > 100 then
      return jsonb_build_object('error', 'invalid', 'field', 'name');
    end if;
  end if;
  if v_has_call then
    if jsonb_typeof(p_patch -> 'call_name') = 'null' then
      v_call := null;
    elsif jsonb_typeof(p_patch -> 'call_name') = 'string' then
      v_call := nullif(p_patch ->> 'call_name', '');
      if v_call is not null and v_call !~ '[^[:space:]　]' then v_call := null; end if;
      if length(v_call) > 20 then
        return jsonb_build_object('error', 'invalid', 'field', 'call_name');
      end if;
    else
      return jsonb_build_object('error', 'invalid', 'field', 'call_name');
    end if;
  end if;
  if v_has_lang then
    v_lang := case when jsonb_typeof(p_patch -> 'language') = 'string' then p_patch ->> 'language' end;
    if v_lang is null or v_lang not in ('ja') then
      return jsonb_build_object('error', 'invalid', 'field', 'language');
    end if;
  end if;
  if v_has_theme then
    v_theme := case when jsonb_typeof(p_patch -> 'theme') = 'string' then p_patch ->> 'theme' end;
    if v_theme is null or v_theme not in ('system', 'light', 'dark') then
      return jsonb_build_object('error', 'invalid', 'field', 'theme');
    end if;
  end if;
  if v_has_week then
    if jsonb_typeof(p_patch -> 'week_start') <> 'number' or (p_patch ->> 'week_start') not in ('0', '1') then
      return jsonb_build_object('error', 'invalid', 'field', 'week_start');
    end if;
    v_week := (p_patch ->> 'week_start')::smallint;
  end if;
  if v_has_tz then
    v_tz := case when jsonb_typeof(p_patch -> 'timezone') = 'string' then p_patch ->> 'timezone' end;
    if v_tz is null or v_tz not in ('Asia/Tokyo', 'UTC') then
      return jsonb_build_object('error', 'invalid', 'field', 'timezone');
    end if;
  end if;
  -- 同じログインの抜けていない全部の人の行に、送った欄だけを書く（値が変わる行だけ）
  update members m set
    display_name = case when v_has_name then v_name else m.display_name end,
    call_name = case when v_has_call then v_call else m.call_name end,
    language = case when v_has_lang then v_lang else m.language end,
    theme = case when v_has_theme then v_theme else m.theme end,
    week_start = case when v_has_week then v_week else m.week_start end,
    timezone = case when v_has_tz then v_tz else m.timezone end,
    updated_at = now(),
    updated_by = m.id
   where m.id in (select r.member_id from app.me_rows() r)
     and ((v_has_name and m.display_name is distinct from v_name)
          or (v_has_call and m.call_name is distinct from v_call)
          or (v_has_lang and m.language is distinct from v_lang)
          or (v_has_theme and m.theme is distinct from v_theme)
          or (v_has_week and m.week_start is distinct from v_week)
          or (v_has_tz and m.timezone is distinct from v_tz));
  select m.updated_at into v_saved from members m where m.id = app.user_id();
  return jsonb_build_object(
    'member', app.me_member_row(),
    'saved_at', to_char(coalesce(v_saved, now()) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
end $$;
revoke all on function app.me_update(jsonb) from public;
grant execute on function app.me_update(jsonb) to kaname_app;
