-- 20261125023800 自分の AI に言う・止める（K-758・D-153.16・D-153.17・関門 C2）
--   新しい表・列は作らない。関数を 3 つ足す（どれも security definer・public から外し kaname_app だけが呼べる）。
--   前の道すじの app.agent_enqueue・app.agent_stop（0041）は直さず残す（/api/auth-ext/agent/say・/agent/stop が K-765 まで使う）。
--
-- app.talk_enqueue(p_member, p_conv, p_kind, p_text, p_context, p_options)：言う 3 口（自分の AI・チケットの右のパネル・作る画面）が通る仕事の積み方。
--   会話を for update で取り（同じ会話への同時の言うは 1 つずつ）、持ち主・種類・つながっている PC・待っている仕事の数（20 まで・G-16）を見て、
--   前から在る app.agent_enqueue（選び方は空）で人の言葉の行と待っている仕事を作り、人の言葉の行の options に p_options を入れる。
--   答え：{ conversation_id, job_id, message_id } ／ { error: not_found | kind_mismatch | no_pc | too_many }（何も書かない）
-- app.clone_talk_say(p_member, p_conv, p_text)：自分の AI との会話（clone）に言う。成功なら同じ取引で証跡 clone_talk.say（会話と仕事の id だけ・字は入れない）
-- app.talk_stop(p_member, p_conv)：その会話の仕事を止める（種類を問わない）。待っている仕事は取りやめ・動いている／答えを待っている仕事は止める合図（app.agent_stop）。
--   合図が立っている仕事には何も足さない（二度押し）。答え：{ state: stopping | cancelled | none }／自分の会話でなければ null。
--   何かを変えたときだけ同じ取引で証跡 talk.stop（payload は state だけ）

create or replace function app.talk_enqueue(p_member uuid, p_conv uuid, p_kind text, p_text text, p_context text, p_options jsonb)
returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare c conversations%rowtype; v_job uuid; v_msg uuid; v_waiting int;
begin
  select * into c from conversations
   where id = p_conv and owner_member_id = p_member and deleted_at is null
   for update;
  if c.id is null then return jsonb_build_object('error', 'not_found'); end if;
  if c.talk_kind is distinct from p_kind then return jsonb_build_object('error', 'kind_mismatch'); end if;
  if not exists (select 1 from sessions s where s.member_id = p_member and s.kind_id = 'bridge' and s.revoked_at is null) then
    return jsonb_build_object('error', 'no_pc');
  end if;
  select count(*) into v_waiting from bridge_jobs j
   where j.conversation_id = p_conv and j.state_id = 'queued' and j.deleted_at is null;
  if v_waiting >= 20 then return jsonb_build_object('error', 'too_many'); end if;
  v_job := app.agent_enqueue(p_member, p_conv, p_text, p_context, '{}'::jsonb);
  if v_job is null then return jsonb_build_object('error', 'no_pc'); end if;
  update messages set options = p_options
   where job_id = v_job and kind = 'human'
   returning id into v_msg;
  return jsonb_build_object('conversation_id', p_conv, 'job_id', v_job, 'message_id', v_msg);
end $$;
revoke all on function app.talk_enqueue(uuid, uuid, text, text, text, jsonb) from public;
grant execute on function app.talk_enqueue(uuid, uuid, text, text, text, jsonb) to kaname_app;

create or replace function app.clone_talk_say(p_member uuid, p_conv uuid, p_text text)
returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v jsonb; v_tenant uuid;
begin
  v := app.talk_enqueue(p_member, p_conv, 'clone', p_text, null, null);
  if v ? 'error' then return v; end if;
  select tenant_id into v_tenant from conversations where id = p_conv;
  insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
    values (v_tenant, p_member, 'member', 'clone_talk.say', 'conversations', p_conv::text, 'C2',
            jsonb_build_object('job_id', v->>'job_id'), p_member);
  return v;
end $$;
revoke all on function app.clone_talk_say(uuid, uuid, text) from public;
grant execute on function app.clone_talk_say(uuid, uuid, text) to kaname_app;

create or replace function app.talk_stop(p_member uuid, p_conv uuid)
returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare c conversations%rowtype; j record; v_live boolean := false; v_changed boolean := false; v_state text;
begin
  -- 会話を取って同じ会話への同時の止めるを 1 つずつにする（2 回目は 1 回目の合図を見て何も足さない）
  select * into c from conversations
   where id = p_conv and owner_member_id = p_member and deleted_at is null
   for update;
  if c.id is null then return null; end if;
  for j in
    select x.id, x.state_id, x.stop_requested_at from bridge_jobs x
     where x.conversation_id = p_conv and x.member_id = p_member and x.deleted_at is null
       and x.state_id in ('queued', 'running', 'asking')
     order by x.created_at, x.id
     for update
  loop
    if j.state_id = 'queued' then
      update bridge_jobs set state_id = 'cancelled', finished_at = now() where id = j.id;
      v_changed := true;
    else
      v_live := true;
      if j.stop_requested_at is null then
        perform app.agent_stop(p_member, j.id);
        v_changed := true;
      end if;
    end if;
  end loop;
  v_state := case when v_live then 'stopping' when v_changed then 'cancelled' else 'none' end;
  if v_changed then
    insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
      values (c.tenant_id, p_member, 'member', 'talk.stop', 'conversations', p_conv::text, 'C2',
              jsonb_build_object('state', v_state), p_member);
  end if;
  return jsonb_build_object('state', v_state);
end $$;
revoke all on function app.talk_stop(uuid, uuid) from public;
grant execute on function app.talk_stop(uuid, uuid) to kaname_app;
