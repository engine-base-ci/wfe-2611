-- 20261121091900 人を招く：メンバーの並びを読む・メールで招く（K-419・契約の口 getWorkspaceMembers・createInvitations・D-148.1・D-148.22・D-148.23・D-148.28・D-148.29・D-148.47・関門 C2）
--
-- ① app.workspace_members() returns jsonb：呼んだ人の会社（app.tenant_id()）だけ。メンバーの画面（WsPeople）の並びを 1 回で返す。
--      groups：消していないグループ（上のグループが先・作った順）ごとに、主の所属（members.scope_id）と兼ねる所属（scope_memberships）の人。
--        所属の行が left・invited の人・消した人・人でないもの（AI）は出さない。人ごとに
--        { id, name, email, role, group_role, primary, other_groups, self, suspended, pc, pc_days_away }
--        primary＝このグループが主の所属か。other_groups は主の所属の行だけ兼ねるグループの名前（兼ねる側の行は []）。
--        pc：sessions の bridge の行のいちばん新しい last_seen_at から。1 日の内＝ok・それより前＝away（pc_days_away＝何日前か）・行が無い＝never・
--            閲覧のみ／依頼する側＝none（分身なし）。
--      invitations：招待中（取り消していない・使われていない・消していない・期限の内・宛てのメールが在る＝招待のリンクは出さない・K-421）。
--        { id, email, scope_id, role, expires_at, left_days（残りを日で切り上げ）}
--      count＝人（兼ねても 1 人）と招待中の和。alerts は空（PC がつながっていない人の知らせは F10 の残り）
-- ② app.create_invitations(p_emails, p_scope, p_role, p_message, p_token_hashes)：メールで何人でも招く。全部か無しか（1 つの取引）。
--      呼んだ人が members の invite（会社全体）を持たなければ 42501（hint なし）。グループがこの会社に無い・消した → 42501・hint E-INV-011。
--      もう入っている人（この会社の所属の行が active・suspended のアカウントの宛て）が 1 人でもいれば、何も作らず 22023・hint E-INV-010・
--      detail にその宛て（小文字・入れた順）を改行でつなぐ。宛てごとに、同じ宛ての招待中の招待を revoked_at で取り消し、新しい招待を 1 行
--      （期限 now()+7 日・role_id・message・created_by 呼んだ人・token_hash は口が作った sha256）。証跡 invitation.created を招待ごとに 1 行
--      （payload は宛てのドメインだけ）。宛てと token_hash は同じ数・宛ては口がそろえた後の小文字（この関数も lower で見る）
--
-- どれも security definer・search_path に pg_temp・public から外し kaname_app にだけ渡す。認証の表 kaname_auth."user" は同じ DB（0112 と同じ・plpgsql なので migration の時点で無くてよい）

create or replace function app.invitation_member_emails(p_emails text[])
returns table (email text)
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
begin
  return query
  select t.e
    from unnest(p_emails) with ordinality t(e, ord)
   where exists (
     select 1
       from members m
       left join tenant_memberships tm on tm.tenant_id = m.tenant_id and tm.member_id = m.id
       join kaname_auth."user" u on u.id = coalesce(m.auth_user_id, tm.auth_user_id)
      where m.tenant_id = app.tenant_id() and m.deleted_at is null
        and (tm.id is null or (tm.status in ('active', 'suspended') and tm.deleted_at is null))
        and lower(u.email::text) = lower(t.e)
   )
   order by t.ord;
end $$;
revoke all on function app.invitation_member_emails(text[]) from public;

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
           ps.seen
      from seat st
      join people p on p.id = st.member_id
      join tree g on g.id = st.scope_id
      left join lateral (
        select max(s.last_seen_at) as seen from sessions s
         where s.member_id = p.id and s.kind_id = 'bridge' and s.deleted_at is null
      ) ps on true
  ),
  inv as (
    select i.id, i.email, i.scope_id, i.role_id as role, i.expires_at,
           ceil(extract(epoch from (i.expires_at - now())) / 86400)::int as left_days, i.created_at
      from invitations i
     where i.tenant_id = v_tenant and i.deleted_at is null and i.revoked_at is null
       and i.accepted_member_id is null and i.expires_at > now() and i.email is not null
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
                                 then floor(extract(epoch from (now() - r.seen)) / 86400)::int end
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

create or replace function app.create_invitations(
  p_emails text[], p_scope uuid, p_role text, p_message text, p_token_hashes text[]
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
begin
  if v_tenant is null or v_user is null
     or not has_permission(v_user, 'members', null, 'invite') then
    raise exception '招く権限が無い' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(array_length(p_emails, 1), 0) = 0
     or array_length(p_emails, 1) <> coalesce(array_length(p_token_hashes, 1), 0)
     or p_role not in ('admin', 'manager', 'member', 'viewer') then
    raise exception '招く入力が正しくない' using errcode = '22023';
  end if;
  if not exists (select 1 from scopes s where s.id = p_scope and s.tenant_id = v_tenant and s.deleted_at is null) then
    raise exception 'このグループには招けない' using errcode = 'insufficient_privilege', hint = 'E-INV-011';
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
    insert into invitations (tenant_id, email, scope_id, role_id, message, token_hash, expires_at, created_by)
    values (v_tenant, v_email, p_scope, p_role, nullif(p_message, ''), p_token_hashes[i], v_exp, v_user)
    returning id into v_id;
    perform app.record_audit('invitation.created', 'invitation', v_id::text, 'C6',
      jsonb_build_object('email_domain', split_part(v_email, '@', 2), 'role', p_role, 'scope_id', p_scope));
    invitation_id := v_id; email := v_email; expires_at := v_exp;
    return next;
  end loop;
end $$;
revoke all on function app.create_invitations(text[], uuid, text, text, text[]) from public;
grant execute on function app.create_invitations(text[], uuid, text, text, text[]) to kaname_app;
