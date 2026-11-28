-- 20261119070749_join_invitation ログイン中の人が今のアカウントで招待に参加する（K-333・契約の口 acceptInvitation・関門 C2）
--   1 人のアカウントは複数のワークスペースに入れる（D-125.150）。参加したら、そのログインの印（sessions の 1 行）だけを招かれたワークスペースへ切り替える
--   （answer=becc3d3aa526 ④）。ほかのブラウザと PC（Bridge）は元のワークスペースのまま。
--   app.join_invitation(p_token_hash, p_auth_user_id, p_auth_session_id) → (tenant_id, member_id)。1 つの取引の中で：
--   ① 招待を for update で読み、K-332 の app.accept_invitation と同じ順で not_found／used／revoked／expired の例外（insufficient_privilege・hint に理由）
--   ② 宛ての lower(email) と本人（kaname_auth."user"）の lower(email) が違えば例外（hint wrong_email・answer=becc3d3aa526 ②）
--   ③ その会社にもう生きた所属がある（app.current_members_of_auth_user・0111 と同じ引き方）なら例外（hint already_member・招待は触らない・answer=7fe1f09fdab4 ⑦）
--   ④ 前に抜けた（left）・招待中（invited）・消した所属の行があれば戻す（D-128.96：status active・役割は招待のもの・joined_at・members.deleted_at を空に・
--      members.scope_id と主のグループの所属を招待のグループに）。無ければ members（auth_user_id は空・名前は kaname_auth."user".name。
--      members.auth_user_id は一意なので本人へは所属の行 tenant_memberships.auth_user_id で結ぶ）＋ tenant_memberships ＋ scope_memberships を作る
--   ⑤ accepted_member_id・出来事 invitation_accepted
--   ⑥ p_auth_session_id の sessions の行（生きている・Bridge でない・本人のもの）の tenant_id・member_id を新しい所属に付け替える。無ければ例外（取引ごと戻る）
--   規約の同意は足さない（今の同意のまま・同意し直しの印も立てない）。同じ人の参加は会社ごとに 1 つずつ（取引の中の鍵）

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
    raise exception '切り替えるセッションが無い' using errcode = 'no_data_found';
  end if;

  tenant_id := inv.tenant_id;
  member_id := v_member;
  return next;
end $$;
revoke all on function app.join_invitation(text, text, text) from public;
grant execute on function app.join_invitation(text, text, text) to kaname_app;

insert into app.schema_migrations (name) values ('20261119070749_join_invitation.sql') on conflict do nothing;
