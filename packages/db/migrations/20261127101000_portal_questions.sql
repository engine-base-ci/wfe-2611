-- 20261127101000 依頼を書く間に分身が聞く（K-910・D-155.11・D-127.8・D-128.101・関門 C2・C3）
--   ゲストが書いた本文を、依頼が届く社内のグループの担当の PC の分身に渡し、聞き返す質問を返してもらう。口は結果を待つだけ。
--   ① app.portal_ask_target()：担当の PC の人（届け先のグループの人で、消していない・active・ゲストでない・PC がつながっている。マネージャーを先に・同じなら id の小さい人）。無ければ null
--   ② app.portal_ask_enqueue(指示)：本人ごとに 1 つずつ、担当の PC に chat の仕事を積む（道具なし・会話なし）。前の仕事が待っている・担当が無いなら null
--   ③ app.portal_ask_result(仕事)：本人が作った仕事の { state, result }。無ければ null
--   ④ app.portal_ask_cancel(仕事)：本人が作った queued・running の仕事を cancelled に
--   どれも毎回その時の所属を app.guest_ok()（K-878）で見る（G-14）。表・列・方針は足さない。
--   K-878・K-876 の関数と列を使うので、体を流すときに確かめる plpgsql で書く。
--   どの関数も security definer・search_path に pg_temp・public から外し kaname_app だけに渡す（D-128.171）。

-- ---------------------------------------------------------------- 担当を決める
create or replace function app.portal_ask_target() returns uuid
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_t uuid := app.tenant_id();
  v_me uuid := app.user_id();
  v_scope uuid;
  v_who uuid;
begin
  if not app.guest_ok() then
    raise exception 'ゲストでない' using errcode = '42501';
  end if;
  select g.request_scope_id into v_scope
  from guest_groups g
  where g.id = app.my_guest_group() and g.tenant_id = v_t and g.deleted_at is null;
  if v_scope is null then
    return null;
  end if;
  select sm.member_id into v_who
  from scope_memberships sm
  join tenant_memberships tm on tm.tenant_id = sm.tenant_id and tm.member_id = sm.member_id
  join members m on m.id = sm.member_id and m.tenant_id = sm.tenant_id and m.deleted_at is null
  where sm.tenant_id = v_t and sm.scope_id = v_scope and sm.deleted_at is null
    and tm.deleted_at is null and tm.status = 'active' and tm.role <> 'requester'
    and sm.member_id <> v_me
    and app.account_pc_live(sm.member_id)
  order by (sm.role = 'manager') desc, sm.member_id
  limit 1;
  return v_who;
end $$;
revoke all on function app.portal_ask_target() from public;
grant execute on function app.portal_ask_target() to kaname_app;

-- ---------------------------------------------------------------- 積む
create or replace function app.portal_ask_enqueue(p_prompt text) returns uuid
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_t uuid := app.tenant_id();
  v_me uuid := app.user_id();
  v_who uuid;
  v_scope uuid;
  v_job uuid;
begin
  if not app.guest_ok() then
    raise exception 'ゲストでない' using errcode = '42501';
  end if;
  if p_prompt is null or p_prompt = '' then
    raise exception '指示の形' using errcode = '22023';
  end if;
  -- 本人ごとに 1 本ずつ：前の仕事（5 分以内の queued・running）が在れば積まない
  perform pg_advisory_xact_lock(hashtextextended('portal_ask:' || v_me::text, 0));
  if exists (
    select 1 from bridge_jobs j
    where j.tenant_id = v_t and j.created_by = v_me and j.kind = 'chat'
      and j.state_id in ('queued', 'running') and j.deleted_at is null
      and j.created_at > now() - interval '5 minutes'
  ) then
    return null;
  end if;
  v_who := app.portal_ask_target();
  if v_who is null then
    return null;
  end if;
  select g.request_scope_id into v_scope from guest_groups g where g.id = app.my_guest_group() and g.tenant_id = v_t;
  insert into bridge_jobs (tenant_id, scope_id, member_id, conversation_id, state_id, prompt, kind, tools, created_by)
    values (v_t, v_scope, v_who, null, 'queued', p_prompt, 'chat', '{}'::text[], v_me)
    returning id into v_job;
  return v_job;
end $$;
revoke all on function app.portal_ask_enqueue(text) from public;
grant execute on function app.portal_ask_enqueue(text) to kaname_app;

-- ---------------------------------------------------------------- 結果を読む
create or replace function app.portal_ask_result(p_job uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_state text;
  v_result text;
begin
  if not app.guest_ok() then
    raise exception 'ゲストでない' using errcode = '42501';
  end if;
  select j.state_id, j.result into v_state, v_result
  from bridge_jobs j
  where j.id = p_job and j.tenant_id = app.tenant_id() and j.created_by = app.user_id() and j.deleted_at is null;
  if v_state is null then
    return null;
  end if;
  return jsonb_build_object('state', v_state, 'result', v_result);
end $$;
revoke all on function app.portal_ask_result(uuid) from public;
grant execute on function app.portal_ask_result(uuid) to kaname_app;

-- ---------------------------------------------------------------- やめる
create or replace function app.portal_ask_cancel(p_job uuid) returns void
language plpgsql security definer set search_path = public, app, pg_temp as $$
begin
  if not app.guest_ok() then
    raise exception 'ゲストでない' using errcode = '42501';
  end if;
  update bridge_jobs set state_id = 'cancelled', finished_at = now()
  where id = p_job and tenant_id = app.tenant_id() and created_by = app.user_id()
    and state_id in ('queued', 'running') and deleted_at is null;
end $$;
revoke all on function app.portal_ask_cancel(uuid) from public;
grant execute on function app.portal_ask_cancel(uuid) to kaname_app;
