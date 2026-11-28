-- 20261126000800 メンバーの並びに「最後に使った日」を足す（K-808・K-70 の葉・D-154.1・D-154.32・関門 C2 読むだけ）
--
-- app.workspace_members() を作り直す。20261121091900_workspace_invitations.sql（K-419）の同じ関数を一字も変えずに写し、2 か所だけ足す：
--   ① seats に、画面（web）のセッションの last_seen_at のいちばん新しい物を横に引く（lu.used）。
--      失効した行も数える（ログアウトしても「最後に使った」は残る）・消した行（deleted_at）は数えない・PC（bridge）の行は数えない。
--   ② 人ごとの答えに last_used_at（その時刻・1 度も無ければ null）と last_used_days（今から何日前か・24 時間ごとに切り捨て・今日は 0・
--      1 度も無ければ null）を足す。人の鍵は K-419 の 11 に 2 つを足して 13。
-- 人の集合・招待中の条件・PC の様子・並び順・守り（会社の文脈が無いと呼べない）は K-419 のまま。
-- 後の段で同じ関数を作り直すとき（段 12 の K-876 ほか）は、この版（last_used の 2 つの鍵を持つ）から写す。

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
