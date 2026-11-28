-- 0028 会話を開く／言ったことを積む（D-090・D-062・D-066）。0027 の続き（0027 は適用済みのため分けた）

-- 開いている会話を返す（無ければ作る）。「ここから分岐」なら元を親にして新しい会話を作る（D-062・D-066）
create or replace function app.agent_open_conversation(p_member uuid, p_conv uuid, p_branch_from uuid, p_title text)
returns table (id uuid, agent_session_id text)
language plpgsql security definer set search_path = public, app as $$
declare v_tenant uuid; v_scope uuid; v_id uuid; v_parent uuid; v_sess text;
begin
  select tenant_id, scope_id into v_tenant, v_scope from members where id = p_member;
  if p_branch_from is not null then                 -- 分岐：元の会話を親にして、新しい session で始める
    select conversation_id into v_parent from messages where id = p_branch_from;
    insert into conversations (tenant_id, scope_id, owner_member_id, title, parent_conversation_id, branched_from_message_id, created_by)
      values (v_tenant, v_scope, p_member, p_title, v_parent, p_branch_from, p_member) returning conversations.id into v_id;
    return query select v_id, null::text;
  end if;
  if p_conv is not null then
    select c.id, c.agent_session_id into v_id, v_sess from conversations c
      where c.id = p_conv and c.owner_member_id = p_member and c.deleted_at is null;
    if v_id is not null then return query select v_id, v_sess; end if;
  end if;
  select c.id, c.agent_session_id into v_id, v_sess from conversations c      -- 開いている会話（D-062：新しい会話を押すまで 1 本）
    where c.owner_member_id = p_member and c.closed_at is null and c.deleted_at is null
    order by c.updated_at desc limit 1;
  if v_id is null then
    insert into conversations (tenant_id, scope_id, owner_member_id, title, created_by)
      values (v_tenant, v_scope, p_member, p_title, p_member) returning conversations.id into v_id;
  end if;
  return query select v_id, v_sess;
end $$;
grant execute on function app.agent_open_conversation(uuid, uuid, uuid, text) to kaname_app;

-- 言ったことを会話に残し、仕事を 1 件積む
create or replace function app.agent_enqueue(p_member uuid, p_conv uuid, p_text text) returns uuid
language plpgsql security definer set search_path = public, app as $$
declare v_tenant uuid; v_scope uuid; v_sess text; v_job uuid;
begin
  select tenant_id, scope_id into v_tenant, v_scope from members where id = p_member;
  select agent_session_id into v_sess from conversations where id = p_conv;
  insert into messages (tenant_id, conversation_id, sender_member_id, body, kind)
    values (v_tenant, p_conv, p_member, p_text, 'human');
  insert into bridge_jobs (tenant_id, scope_id, member_id, conversation_id, prompt, agent_session_id, created_by)
    values (v_tenant, v_scope, p_member, p_conv, p_text, v_sess, p_member) returning id into v_job;
  return v_job;
end $$;
grant execute on function app.agent_enqueue(uuid, uuid, text) to kaname_app;
