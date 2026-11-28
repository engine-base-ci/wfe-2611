-- 0030 つながっているかの判定を、定義側（security definer）に寄せる。
-- 由来：API から appPool の生の select で sessions／members を読むと行レベルの制御に弾かれ、
--       例外にならず「0 件」＝「つながっていない」になる（同じ取りこぼしを 0026・0027 で 3 回踏んだ）。
--       読む側で判定しない。判定は定義の中でやり、結果だけ返す。
create or replace function app.agent_enqueue(p_member uuid, p_conv uuid, p_text text) returns uuid
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
    values (v_tenant, v_scope, p_member, p_conv, p_text, v_sess, p_member) returning id into v_job;
  return v_job;
end $$;
grant execute on function app.agent_enqueue(uuid, uuid, text) to kaname_app;
