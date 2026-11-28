-- 20261126001000 メンバーの 1 人を読む（K-810・契約の口 getMember・D-154.10・D-154.15・D-150.21）
--   新しい表・列は作らない。関数を 2 つ足す（読むだけ・書かない・証跡を増やさない）。
--
-- ① app.member_groups_json(p_member)：その人のグループと役割を [{ id, name, code, primary, role }] で返す。
--      主の所属（members.scope_id）が先・兼ねる所属（消していない scope_memberships）は scope の作った順（created_at・id）。
--      消したグループは出さない。role は所属の行の役割（manager・member・viewer）。主の所属に行が無い人は null（管理者・会社を作った人）。
--      兼務（D-154.15）は 1 グループ 1 行・役割はグループごと。K-811・K-812 の答えの groups も同じ関数で組む（形がずれない）。
--      権限は見ない（呼ぶ関数が見る）ので kaname_app に渡さない。
-- ② app.member_detail(p_member)：メンバーの 1 人の画面（/members/:id）の答え。
--      ① 見る権限（app.admin_can('members','view')・K-800）が無ければ {"error":"forbidden"}
--      ② 相手（app.admin_target・K-800）が null（外した・消した・別の会社・AI・無い id・招待中）なら {"error":"member_gone"}
--      ③ {"ok": true, "detail": { member, groups, assigned, clone, login, recent_events }}（鍵はちょうど 6）。
--        人ごとの「できること」（role_bundle・granted・revoked）は返さない（D-154.10）。承認する人の件数も返さない（担当と同じ・D-150.21）
--      assigned：担当で完了前（下書きも数える・K-815・K-848 と同じ）・期限が日本時間の今日より前・7 日触っていない・待っている渡しの渡す側
--      clone：PC の様子は K-419 の app.workspace_members と同じ決め。device は最後の bridge の行の端末の名前
--      login：認証の表は app.login_methods（0113）経由で読む。last_login_at は画面（web）のセッションの issued_at のいちばん新しい物（失効した行も数える）
--      recent_events：その人が起こした・その人に起きた記録を新しい順に 5 件まで。鍵は id・action・at・by だけ（payload は返さない）
--   どちらも security definer・search_path に pg_temp・public から外す。kaname_app に渡すのは ② だけ。

create or replace function app.member_groups_json(p_member uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid;
  v_primary uuid;
  v_out jsonb;
begin
  select m.tenant_id, m.scope_id into v_tenant, v_primary from members m where m.id = p_member;
  if v_tenant is null then
    return '[]'::jsonb;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', g.id, 'name', g.name, 'code', g.ticket_prefix, 'primary', g.is_primary, 'role', g.role)
           order by g.is_primary desc, g.created_at, g.id), '[]'::jsonb)
    into v_out
    from (
      select s.id, s.name, s.ticket_prefix, s.created_at, true as is_primary,
             (select sm.role from scope_memberships sm
               where sm.member_id = p_member and sm.scope_id = s.id and sm.deleted_at is null) as role
        from scopes s
       where s.id = v_primary and s.tenant_id = v_tenant and s.deleted_at is null
      union all
      select s.id, s.name, s.ticket_prefix, s.created_at, false, sm.role
        from scope_memberships sm
        join scopes s on s.id = sm.scope_id and s.deleted_at is null
       where sm.member_id = p_member and sm.tenant_id = v_tenant and sm.deleted_at is null
         and sm.scope_id is distinct from v_primary
    ) g;
  return v_out;
end $$;
revoke all on function app.member_groups_json(uuid) from public;

create or replace function app.member_detail(p_member uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_target jsonb;
  v_role text;
  m members%rowtype;
  v_tm_auth text;
  v_tm_status text;
  v_joined timestamptz;
  v_email text;
  v_member jsonb;
  v_changed jsonb;
  v_assigned jsonb;
  v_seen timestamptz;
  v_device text;
  v_clone jsonb;
  v_login jsonb;
  v_events jsonb;
begin
  if v_tenant is null or not coalesce(app.admin_can('members', 'view'), false) then
    return jsonb_build_object('error', 'forbidden');
  end if;
  v_target := app.admin_target(p_member);
  if v_target is null then
    return jsonb_build_object('error', 'member_gone');
  end if;
  v_role := v_target->>'role';

  select * into m from members where id = p_member and tenant_id = v_tenant;
  select tm.auth_user_id, tm.status, tm.joined_at into v_tm_auth, v_tm_status, v_joined
    from tenant_memberships tm
   where tm.tenant_id = v_tenant and tm.member_id = p_member and tm.deleted_at is null;
  select u.email::text into v_email from kaname_auth."user" u where u.id = coalesce(m.auth_user_id, v_tm_auth);

  -- 役割を変えた記録の新しい 1 件（K-811 の member.role_change・payload の from）
  select jsonb_build_object('at', e.occurred_at, 'by', a.display_name, 'from', e.payload->>'from')
    into v_changed
    from audit_events e
    left join members a on a.id = e.actor_member_id
   where e.tenant_id = v_tenant and e.action = 'member.role_change' and e.target_type = 'members'
     and e.target_id = p_member::text and e.deleted_at is null
   order by e.occurred_at desc, e.id desc
   limit 1;

  v_member := jsonb_build_object(
    'id', m.id,
    'name', m.display_name,
    'email', v_email,
    'role', v_role,
    'suspended', (v_target->>'state') = 'suspended' or m.suspended_at is not null or v_tm_status = 'suspended',
    'suspended_at', m.suspended_at,
    'since', coalesce(v_joined, m.created_at),
    'self', p_member = app.user_id(),
    'is_owner', coalesce((v_target->>'is_owner')::boolean, false),
    'role_changed', v_changed);

  -- 担当しているもの（完了前・消していない・下書きも数える）と、渡し中（待っている渡しの渡す側）
  select jsonb_build_object(
           'tickets', count(*),
           'overdue', count(*) filter (where t.due_on < (now() at time zone 'Asia/Tokyo')::date),
           'stuck', count(*) filter (where t.updated_at < now() - interval '7 days'),
           'handing', (select count(*) from ticket_handovers h
                        where h.tenant_id = v_tenant and h.from_member_id = p_member
                          and h.state = 'waiting' and h.deleted_at is null))
    into v_assigned
    from tickets t
   where t.tenant_id = v_tenant and t.assignee_member_id = p_member
     and t.completed_at is null and t.deleted_at is null;

  -- 分身（PC）：K-419 の app.workspace_members と同じ決め。device は last_seen_at がいちばん新しい bridge の行の端末の名前
  select s.last_seen_at, s.device_label into v_seen, v_device
    from sessions s
   where s.member_id = p_member and s.kind_id = 'bridge' and s.deleted_at is null
   order by s.last_seen_at desc, s.id desc
   limit 1;
  v_clone := jsonb_build_object(
    'pc', case when v_role in ('viewer', 'requester') then 'none'
               when v_seen is null then 'never'
               when v_seen > now() - interval '1 day' then 'ok'
               else 'away' end,
    'pc_days_away', case when v_role not in ('viewer', 'requester') and v_seen is not null
                              and v_seen <= now() - interval '1 day'
                         then floor(extract(epoch from (now() - v_seen)) / 86400)::int end,
    'device', case when v_role in ('viewer', 'requester') then null else v_device end);

  -- ログイン：入り方は app.login_methods（認証の表を直に読まない）・最後に入ったのは画面のセッションの issued_at（失効した行も数える）
  select jsonb_build_object('passkeys', lm.passkeys, 'has_password', lm.has_password, 'two_factor', lm.two_factor,
                            'last_login_at', (select max(s.issued_at) from sessions s
                                               where s.member_id = p_member and s.kind_id = 'web' and s.deleted_at is null))
    into v_login
    from app.login_methods(coalesce(m.auth_user_id, v_tm_auth)) lm;

  -- 最近の記録：その人が起こした・その人に起きた物を新しい順に 5 件（payload・宛て・ほかの会社の記録は返さない）
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'action', r.action, 'at', r.occurred_at, 'by', r.by)
                            order by r.occurred_at desc, r.id desc), '[]'::jsonb)
    into v_events
    from (
      select e.id, e.action, e.occurred_at, a.display_name as by
        from audit_events e
        left join members a on a.id = e.actor_member_id
       where e.tenant_id = v_tenant and e.deleted_at is null
         and (e.actor_member_id = p_member or (e.target_type = 'members' and e.target_id = p_member::text))
       order by e.occurred_at desc, e.id desc
       limit 5
    ) r;

  return jsonb_build_object('ok', true, 'detail', jsonb_build_object(
    'member', v_member,
    'groups', app.member_groups_json(p_member),
    'assigned', v_assigned,
    'clone', v_clone,
    'login', v_login,
    'recent_events', v_events));
end $$;
revoke all on function app.member_detail(uuid) from public;
grant execute on function app.member_detail(uuid) to kaname_app;
