-- 0039 自分のAI に「どこで話しかけられたか」を渡す（D-103）。会話はどこで開いても同じ 1 本（D-062.1）で、
-- 場所ごとに違うのは、自分のAI に添える文脈（見ている画面・選んでいる 1 件・確かめているたたき台）だけ。
-- 会話に出す言葉（messages.body）は本人が書いたままにし、Claude Code に渡す指示（bridge_jobs.prompt）にだけ文脈を前に付ける。
create or replace function app.agent_enqueue(p_member uuid, p_conv uuid, p_text text, p_context text) returns uuid
language plpgsql security definer set search_path = public, app as $$
declare v_tenant uuid; v_scope uuid; v_sess text; v_job uuid; v_live int;
begin
  select count(*) into v_live from sessions
    where member_id = p_member and kind_id = 'bridge' and revoked_at is null;
  if v_live = 0 then return null; end if;   -- つながっていない。呼んだ側が 409 にする
  select tenant_id, scope_id into v_tenant, v_scope from members where id = p_member;
  select agent_session_id into v_sess from conversations where id = p_conv;
  insert into messages (tenant_id, conversation_id, sender_member_id, body, kind)
    values (v_tenant, p_conv, p_member, p_text, 'human');
  insert into bridge_jobs (tenant_id, scope_id, member_id, conversation_id, prompt, agent_session_id, created_by)
    values (v_tenant, v_scope, p_member, p_conv,
            case when coalesce(p_context, '') = '' then p_text else p_context || E'\n\n' || p_text end,
            v_sess, p_member) returning id into v_job;
  return v_job;
end $$;
grant execute on function app.agent_enqueue(uuid, uuid, text, text) to kaname_app;
