-- 20261126005200_reinvite_return 外された人が招待から戻る（K-852・D-154.86〜89・D-154.85・D-154.26・D-154.41・関門 C2）
--   ① app.login_invite_only(利用者, 招待の印の sha256)：本人宛ての使える招待があり、本人が止められていないかを答える（読むだけ・記録は書かない）。
--      使える招待＝宛て（lower(btrim)）が本人のメールと同じ・使っていない・取り消していない・消していない・期限の内・招いた会社が止められていない。
--      止められている＝本人の members の行（消した行も・どの会社でも）に suspended_at があるか、同じ組の所属の status が suspended（止めたまま外された人も偽）。
--      招いた会社がその人を外した会社かどうかは問わない（D-154.88・D-154.89）。印（sha256）があればその 1 つの招待だけを見る
--   ② app.login_gate：② 「使える組が 1 つも無い」の手前で、①（印なし）が真なら 'invite_only'。ほかの順と記録は 0108 のまま
--   ③ app.join_invitation：K-333 の形のまま、次を足す
--      0. 戻す行（前に抜けた・消した所属）の members.suspended_at が入っていれば生き返らせずに例外（hint suspended・取引ごと戻る）
--      1. 戻す行の members.deleted_at が招待の created_at の 30 日前〜created_at の間なら、同じ時刻で消したグループの所属（今も在るグループ・招いたグループでない）を
--         兼務で戻す（役割は app.restore_group_role（K-817）＝外す前と招いた役割の低いほう）。戻したら member_restored を 1 行
--      2. そのログインの印の sessions の行が無く、部品のセッションが本人のものなら、新しい所属の人の行として 1 行足し、規約と 2 段階の印を当てる
create or replace function app.login_invite_only(p_auth_user_id text, p_token_hash text default null) returns boolean
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_email text;
begin
  if p_auth_user_id is null or to_regclass('kaname_auth."user"') is null then
    return false;
  end if;
  execute 'select u.email from kaname_auth."user" u where u.id = $1' into v_email using p_auth_user_id;
  if v_email is null then
    return false;
  end if;
  -- 本人が止められている（消した行も・どの会社でも。門と同じ引き方）
  if exists (
    select 1
      from members m
      left join tenant_memberships tm on tm.tenant_id = m.tenant_id and tm.member_id = m.id
     where (m.auth_user_id = p_auth_user_id
            or exists (select 1 from tenant_memberships tb
                        where tb.tenant_id = m.tenant_id and tb.member_id = m.id and tb.auth_user_id = p_auth_user_id))
       and (m.suspended_at is not null or coalesce(tm.status = 'suspended', false))
  ) then
    return false;
  end if;
  return exists (
    select 1
      from invitations i
     where lower(btrim(i.email)) = lower(btrim(v_email))
       and (p_token_hash is null or i.token_hash = p_token_hash)
       and i.accepted_member_id is null
       and i.revoked_at is null
       and i.deleted_at is null
       and i.expires_at > now()
       and not exists (select 1 from subscriptions s
                        where s.tenant_id = i.tenant_id and s.suspended_at is not null and s.deleted_at is null)
  );
end $$;
revoke all on function app.login_invite_only(text, text) from public;
grant execute on function app.login_invite_only(text, text) to kaname_app;

create or replace function app.login_gate(p_auth_user_id text) returns text
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  r record;
  v_pairs int := 0;
  v_person boolean := false;
  v_workspace boolean := false;
  v_tenants uuid[] := '{}';
  v_members uuid[] := '{}';
  v_reason text;
begin
  if p_auth_user_id is null then return 'ok'; end if;
  for r in
    select m.tenant_id, m.id as member_id,
           m.deleted_at is null and coalesce(tm.status <> 'left' and tm.deleted_at is null, true) as usable,
           m.suspended_at is not null or coalesce(tm.status = 'suspended', false) as person_suspended,
           exists (select 1 from subscriptions s
                    where s.tenant_id = m.tenant_id and s.suspended_at is not null and s.deleted_at is null) as workspace_suspended
      from members m
      left join tenant_memberships tm on tm.tenant_id = m.tenant_id and tm.member_id = m.id
     where (m.auth_user_id = p_auth_user_id   -- 会社を作った人・招待で入った人
            or exists (select 1 from tenant_memberships tb   -- 同じログインで別の会社にも入った人（D-125.150）
                       where tb.tenant_id = m.tenant_id and tb.member_id = m.id and tb.auth_user_id = p_auth_user_id))
       and not (coalesce(tm.status = 'invited', false) and tm.deleted_at is null)   -- 招待の受諾の途中は数えない
     order by m.tenant_id, m.id
  loop
    v_pairs := v_pairs + 1;
    continue when not r.usable;
    v_person := v_person or r.person_suspended;
    v_workspace := v_workspace or r.workspace_suspended;
    if not (r.tenant_id = any (v_tenants)) then
      v_tenants := v_tenants || r.tenant_id;
      v_members := v_members || r.member_id;
    end if;
  end loop;
  if v_pairs = 0 then return 'ok'; end if;
  if cardinality(v_tenants) = 0 then
    -- 使える会社が無い：本人宛ての使える招待があり止められていなければ、招待の口だけに使う印を渡す（どの招待かは口と hook が見る・K-852）
    if app.login_invite_only(p_auth_user_id) then return 'invite_only'; end if;
    return 'member_left';
  end if;
  if v_person then
    v_reason := 'member_suspended';
  elsif v_workspace then
    v_reason := 'workspace_suspended';
  else
    return 'ok';
  end if;
  -- 使える組の会社ごとに 1 行（理由だけ）
  insert into security_events (tenant_id, kind_id, member_id, detail)
  select t, 'login_blocked', mid, jsonb_build_object('reason', v_reason)
    from unnest(v_tenants, v_members) as u(t, mid);
  return v_reason;
end $$;
revoke all on function app.login_gate(text) from public;
grant execute on function app.login_gate(text) to kaname_app;

create or replace function app.join_invitation(p_token_hash text, p_auth_user_id text, p_auth_session_id text)
returns table (tenant_id uuid, member_id uuid)
language plpgsql security definer set search_path = public, app, pg_temp as $$
#variable_conflict use_column
declare
  inv invitations%rowtype;
  v_email text;
  v_name text;
  v_scope uuid;
  v_member uuid;
  v_role text;
  v_scope_role text;
  v_target uuid;
  v_removed_at timestamptz;
  v_suspended timestamptz;
  v_restored int := 0;
  v_session uuid;
  n int;
begin
  select * into inv from invitations where token_hash = p_token_hash for update;
  if inv.id is null then
    raise exception '招待が無効（見つからない）' using errcode = 'insufficient_privilege', hint = 'not_found';
  end if;
  if inv.accepted_member_id is not null then
    raise exception '招待が無効（受諾済み）' using errcode = 'insufficient_privilege', hint = 'used';
  end if;
  if inv.revoked_at is not null or inv.deleted_at is not null then
    raise exception '招待が無効（取り消し）' using errcode = 'insufficient_privilege', hint = 'revoked';
  end if;
  if inv.expires_at < now() then
    raise exception '招待が無効（期限切れ）' using errcode = 'insufficient_privilege', hint = 'expired';
  end if;

  select u.email, u.name into v_email, v_name from kaname_auth."user" u where u.id = p_auth_user_id;
  if v_email is null or lower(v_email) <> lower(inv.email) then
    raise exception 'この招待は別のメールの宛て' using errcode = 'insufficient_privilege', hint = 'wrong_email';
  end if;

  -- 同じ人が同じ会社へ同時に入る（別の招待を 2 つ）ときに所属を 2 つ作らない
  perform pg_advisory_xact_lock(hashtextextended(inv.tenant_id::text || ':' || p_auth_user_id, 0));

  if exists (select 1 from app.current_members_of_auth_user(p_auth_user_id) c where c.tenant_id = inv.tenant_id) then
    raise exception 'このワークスペースには既に入っている' using errcode = 'insufficient_privilege', hint = 'already_member';
  end if;

  select s.id into v_scope from scopes s
   where s.id = inv.scope_id and s.tenant_id = inv.tenant_id and s.deleted_at is null;
  if v_scope is null then
    select s.id into v_scope from scopes s
     where s.tenant_id = inv.tenant_id and s.parent_id is null and s.deleted_at is null
     order by s.created_at limit 1;
  end if;
  v_role := case when inv.role_id in ('admin', 'manager', 'member', 'viewer', 'requester') then inv.role_id else 'member' end;
  v_scope_role := case when inv.role_id in ('manager', 'viewer') then inv.role_id else 'member' end;

  -- 前に抜けた・招待中・消した所属（D-128.96：所属の行が残っていれば戻す）
  select tm.member_id into v_member
    from tenant_memberships tm join members m on m.id = tm.member_id
   where tm.tenant_id = inv.tenant_id
     and (tm.auth_user_id = p_auth_user_id or m.auth_user_id = p_auth_user_id)
     and (tm.status in ('left', 'invited') or tm.deleted_at is not null or m.deleted_at is not null)
   order by tm.updated_at desc limit 1;

  if v_member is not null then
    select m.deleted_at, m.suspended_at into v_removed_at, v_suspended from members m where m.id = v_member;
    -- 止めたまま外した行は生き返らせない（生き返らせると門の ③ でその人の全部の会社が止まる・D-154.85・K-852）
    if v_suspended is not null then
      raise exception '止められたまま外された人は戻せない' using errcode = 'insufficient_privilege', hint = 'suspended';
    end if;
    update tenant_memberships tm
       set status = 'active', role = v_role, joined_at = now(), deleted_at = null, updated_by = inv.created_by
     where tm.tenant_id = inv.tenant_id and tm.member_id = v_member;
    update members m
       set deleted_at = null, role_id = inv.role_id, scope_id = coalesce(v_scope, m.scope_id), updated_by = inv.created_by
     where m.id = v_member;
    if v_scope is not null then
      select sm.id into v_target from scope_memberships sm where sm.member_id = v_member and sm.scope_id = v_scope;
      if v_target is not null then
        -- 招待のグループの行がもうある：前の主の行の印を外してから、その行を主にする（主の所属は 1 人 1 つ）
        update scope_memberships sm set is_primary = false, changed_by = inv.created_by, updated_by = inv.created_by
         where sm.member_id = v_member and sm.is_primary and sm.deleted_at is null and sm.id <> v_target;
        update scope_memberships sm
           set is_primary = true, deleted_at = null, role = v_scope_role, changed_by = inv.created_by, updated_by = inv.created_by
         where sm.id = v_target;
      else
        update scope_memberships sm
           set scope_id = v_scope, role = v_scope_role, changed_by = inv.created_by, updated_by = inv.created_by
         where sm.member_id = v_member and sm.is_primary and sm.deleted_at is null;
        get diagnostics n = row_count;
        if n = 0 then
          insert into scope_memberships (tenant_id, member_id, scope_id, is_primary, role, changed_by, created_by)
          values (inv.tenant_id, v_member, v_scope, true, v_scope_role, inv.created_by, inv.created_by);
        end if;
      end if;
    end if;
    -- 外して 30 日の内の招き直しなら、外したときに消したグループの所属（今も在るグループ）を兼務で戻す（D-154.26・D-154.41・K-817 と同じ規則）。
    --   外す前の主も、招いたグループと違えば兼務で戻す。招待が外す前に作られていた（招き直しではない）・30 日を過ぎたは戻さない
    if v_removed_at is not null
       and v_removed_at >= inv.created_at - interval '30 days'
       and v_removed_at <= inv.created_at then
      update scope_memberships sm
         set deleted_at = null, is_primary = false, role = app.restore_group_role(sm.role, inv.role_id),
             changed_by = inv.created_by, updated_by = inv.created_by
       where sm.member_id = v_member
         and sm.deleted_at = v_removed_at
         and sm.scope_id is distinct from v_scope
         and exists (select 1 from scopes s where s.id = sm.scope_id and s.tenant_id = inv.tenant_id and s.deleted_at is null);
      get diagnostics v_restored = row_count;
      if v_restored > 0 then
        perform app.record_security_event(inv.tenant_id, 'member_restored', v_member, null,
          jsonb_build_object('removed_member_id', v_member, 'groups', v_restored));
      end if;
    end if;
  else
    insert into members (tenant_id, scope_id, kind_id, display_name, role_id, auth_user_id, created_by)
    values (inv.tenant_id, v_scope, 'human', coalesce(nullif(v_name, ''), v_email), inv.role_id, null, inv.created_by)
    returning id into v_member;
    insert into tenant_memberships (tenant_id, member_id, auth_user_id, role, status, joined_at, created_by)
    values (inv.tenant_id, v_member, p_auth_user_id, v_role, 'active', now(), inv.created_by);
    if v_scope is not null then
      insert into scope_memberships (tenant_id, member_id, scope_id, is_primary, role, changed_by, created_by)
      values (inv.tenant_id, v_member, v_scope, true, v_scope_role, inv.created_by, inv.created_by);
    end if;
  end if;

  update invitations set accepted_member_id = v_member where id = inv.id;
  perform app.record_security_event(inv.tenant_id, 'invitation_accepted', v_member, null, jsonb_build_object('invitation_id', inv.id));

  -- そのログインの印だけを切り替える（ほかのセッションと PC は元のまま）
  update sessions x set tenant_id = inv.tenant_id, member_id = v_member
   where x.auth_session_id = p_auth_session_id and x.revoked_at is null and x.kind_id <> 'bridge'
     and exists (select 1 from kaname_auth.session a where a.id = p_auth_session_id and a."userId" = p_auth_user_id);
  get diagnostics n = row_count;
  if n <> 1 then
    -- 招待の印で入った人（使える会社が無い・K-852）：その印の sessions の行がまだ無く、部品のセッションが本人のものなら、新しい所属の人の行を足す
    if not exists (select 1 from sessions x where x.auth_session_id = p_auth_session_id) then
      insert into sessions (tenant_id, member_id, kind_id, auth_session_id, device_label, ip_region)
      select inv.tenant_id, v_member, 'web', a.id, nullif(left(coalesce(a."userAgent", ''), 200), ''), null
        from kaname_auth.session a
       where a.id = p_auth_session_id and a."userId" = p_auth_user_id and a."expiresAt" > now()
      returning id into v_session;
    end if;
    if v_session is null then
      raise exception '切り替えるセッションが無い' using errcode = 'no_data_found';
    end if;
    -- ログインの後と同じ印。規約は app.mark_session_terms と同じ決め方を本人（認証の利用者）で当てる
    --   （mark_session_terms は members.auth_user_id で引くので、所属の行で結ぶ人＝別の会社の初めての招待では本人を引けない）
    update sessions x set terms_pending = exists (select 1 from app.terms_pending(p_auth_user_id))
     where x.id = v_session and inv.tenant_id <> app.ops_tenant_id();
    perform app.mark_session_mfa(p_auth_session_id);
  end if;

  tenant_id := inv.tenant_id;
  member_id := v_member;
  return next;
end $$;
revoke all on function app.join_invitation(text, text, text) from public;
grant execute on function app.join_invitation(text, text, text) to kaname_app;

insert into app.schema_migrations (name) values ('20261126005200_reinvite_return.sql') on conflict do nothing;
