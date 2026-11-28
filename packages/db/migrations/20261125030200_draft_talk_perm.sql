-- 20261125030200 作る画面の AI と話せるのは、チケットを作る権限がある人だけ（K-782・D-153.35・関門 C2）
--   K-774 の app.draft_talk_start()・app.draft_talk_say（20261125025400）を写し、not_member の判定のすぐ後に作る権限の判定を 1 つ足す。
--   作る権限が無い人は { error: no_create }（何も書かない）。口が 403・E-TALK-062 にする。ほかの本文は K-774 の版のまま。
--   新しい表・列・索引は作らない。

create or replace function app.draft_talk_start()
returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_me uuid := app.user_id(); v_tenant uuid := app.tenant_id(); v_scope uuid; v_live int; v_old uuid; v_conv uuid;
begin
  if v_me is null or v_tenant is null or not app.member_ok()
     or exists (select 1 from members m where m.id = v_me and m.suspended_at is not null) then
    return jsonb_build_object('error', 'not_member');
  end if;
  -- 作る権限（K-782・D-153.35）：消していないグループのどれか 1 つに tickets の edit（作る口 createTicket と同じ判定）
  if not exists (select 1 from scopes s where s.tenant_id = v_tenant and s.deleted_at is null
                  and has_permission(v_me, 'tickets', s.id, 'edit')) then
    return jsonb_build_object('error', 'no_create');
  end if;
  -- 人ごとに 1 つずつ（同時に 2 つ始めても 50 を超えない）
  perform pg_advisory_xact_lock(hashtextextended('draft_talk_start:' || v_me::text, 0));
  select count(*) into v_live from conversations c
   where c.owner_member_id = v_me and c.talk_kind = 'draft' and c.deleted_at is null;
  if v_live >= 50 then
    select c.id into v_old from conversations c
     where c.owner_member_id = v_me and c.talk_kind = 'draft' and c.deleted_at is null
     order by c.updated_at, c.id limit 1
     for update;
    update conversations set deleted_at = now(), updated_by = v_me where id = v_old;
  end if;
  select m.scope_id into v_scope from members m where m.id = v_me;
  insert into conversations (tenant_id, scope_id, owner_member_id, talk_kind, created_by)
    values (v_tenant, v_scope, v_me, 'draft', v_me)
    returning id into v_conv;
  insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
    values (v_tenant, v_me, 'member', 'draft_talk.start', 'conversations', v_conv::text, 'C2',
            jsonb_build_object('cleaned', v_old), v_me);
  return jsonb_build_object('conversation_id', v_conv);
end $$;
revoke all on function app.draft_talk_start() from public;
grant execute on function app.draft_talk_start() to kaname_app;

create or replace function app.draft_talk_say(p_conv uuid, p_text text, p_draft jsonb, p_edited jsonb)
returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_me uuid := app.user_id(); v_tenant uuid := app.tenant_id(); v_edited jsonb := coalesce(p_edited, '[]'::jsonb);
        v_ctx text; v jsonb;
begin
  if v_me is null or v_tenant is null or not app.member_ok()
     or exists (select 1 from members m where m.id = v_me and m.suspended_at is not null) then
    return jsonb_build_object('error', 'not_member');
  end if;
  -- 作る権限（K-782・D-153.35）：消していないグループのどれか 1 つに tickets の edit（作る口 createTicket と同じ判定）
  if not exists (select 1 from scopes s where s.tenant_id = v_tenant and s.deleted_at is null
                  and has_permission(v_me, 'tickets', s.id, 'edit')) then
    return jsonb_build_object('error', 'no_create');
  end if;
  -- 守りの判定（2 層目）：自分の・消していない会話だけ（ほかの人の会話も在るかを漏らさない）。判定が落ちたら止める側に倒す
  begin
    if not exists (select 1 from conversations c
                    where c.id = p_conv and c.owner_member_id = v_me and c.tenant_id = v_tenant and c.deleted_at is null) then
      return jsonb_build_object('error', 'not_found');
    end if;
  exception when others then
    return jsonb_build_object('error', 'guard_failed');
  end;
  if p_text is null or btrim(p_text, E' \t\r\n\f\v　') = '' then
    return jsonb_build_object('error', 'text_empty');
  end if;
  if not app.draft_talk_valid(p_draft, v_edited) then
    return jsonb_build_object('error', 'draft_invalid');
  end if;
  v_ctx := app.draft_talk_context(p_draft, v_edited);
  -- app.talk_enqueue は断るときは何も書かない（種類・PC・待ちの数を先に見る）
  v := app.talk_enqueue(v_me, p_conv, 'draft', p_text, v_ctx, jsonb_build_object('passed', v_edited));
  if v ? 'error' then return v; end if;
  insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
    values (v_tenant, v_me, 'member', 'draft_talk.say', 'conversations', p_conv::text, 'C2', '{}'::jsonb, v_me);
  return v;
end $$;
revoke all on function app.draft_talk_say(uuid, text, jsonb, jsonb) from public;
grant execute on function app.draft_talk_say(uuid, text, jsonb, jsonb) to kaname_app;
