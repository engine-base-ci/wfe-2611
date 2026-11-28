-- 0031 会話を開く関数の列名の曖昧さを直す（returns table の id と conversations.id が衝突していた）
drop function if exists app.agent_open_conversation(uuid, uuid, uuid, text);
create function app.agent_open_conversation(p_member uuid, p_conv uuid, p_branch_from uuid, p_title text)
returns table (conv_id uuid, agent_session text)
language plpgsql security definer set search_path = public, app as $$
declare v_tenant uuid; v_scope uuid; v_id uuid; v_parent uuid; v_sess text;
begin
  select tenant_id, scope_id into v_tenant, v_scope from members where id = p_member;
  if p_branch_from is not null then                 -- 分岐：元の会話を親に、新しい session で始める（D-066）
    select m.conversation_id into v_parent from messages m where m.id = p_branch_from;
    insert into conversations (tenant_id, scope_id, owner_member_id, title, parent_conversation_id, branched_from_message_id, created_by)
      values (v_tenant, v_scope, p_member, p_title, v_parent, p_branch_from, p_member) returning conversations.id into v_id;
    return query select v_id, null::text;
  end if;
  if p_conv is not null then
    select c.id, c.agent_session_id into v_id, v_sess from conversations c
      where c.id = p_conv and c.owner_member_id = p_member and c.deleted_at is null;
    if v_id is not null then return query select v_id, v_sess; end if;
  end if;
  select c.id, c.agent_session_id into v_id, v_sess from conversations c   -- 開いている会話（D-062：新しい会話を押すまで 1 本）
    where c.owner_member_id = p_member and c.closed_at is null and c.deleted_at is null
    order by c.updated_at desc limit 1;
  if v_id is null then
    insert into conversations (tenant_id, scope_id, owner_member_id, title, created_by)
      values (v_tenant, v_scope, p_member, p_title, p_member) returning conversations.id into v_id;
  end if;
  return query select v_id, v_sess;
end $$;
grant execute on function app.agent_open_conversation(uuid, uuid, uuid, text) to kaname_app;
