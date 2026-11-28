-- 0048 問い合わせに答えた記録には、答えた中身を残す（2026-09-28・user「問い合わせでのこれはちょっと嫌」）。
--   前は「問い合わせに答えました（表示名）」だけで、何を答えたかが会話に残らず、表示名に会社名が出ていた
create or replace function app.agent_answer2(p_member uuid, p_job uuid, p_request_id text, p_allow boolean, p_scope text, p_note text, p_answers jsonb)
returns boolean language plpgsql security definer set search_path = public, app as $$
declare j bridge_jobs%rowtype; a bridge_job_events%rowtype; v_name text; v_tool text; v_pat text;
begin
  select * into j from bridge_jobs where id = p_job and member_id = p_member and state_id = 'asking';
  if j.id is null then return false; end if;
  select * into a from bridge_job_events where job_id = j.id and kind = 'ask' and request_id = p_request_id order by created_at desc limit 1;
  if a.id is null then return false; end if;
  if exists (select 1 from bridge_job_events where job_id = j.id and kind = 'answer' and request_id = p_request_id) then return true; end if;
  insert into bridge_job_events (tenant_id, scope_id, member_id, job_id, kind, request_id, payload, created_by)
    values (j.tenant_id, j.scope_id, j.member_id, j.id, 'answer', p_request_id,
            jsonb_build_object('allow', p_allow, 'scope', coalesce(p_scope, 'once'), 'note', nullif(left(coalesce(p_note, ''), 2000), ''), 'answers', p_answers), p_member);
  update bridge_jobs set state_id = 'running' where id = j.id;
  v_tool := a.payload->>'tool';
  if p_allow and p_scope = 'always' and v_tool is not null and v_tool <> 'AskUserQuestion' then
    v_pat := case when v_tool ~* '^bash$' then coalesce(a.payload->'input'->>'command', '') else coalesce(a.payload->'input'->>'file_path', a.payload->'input'->>'path', '') end;
    insert into permission_rules (tenant_id, scope_id, member_id, tool, target_pattern, decision_id, bridge_job_event_id, created_by)
      values (j.tenant_id, j.scope_id, p_member, v_tool, nullif(v_pat, ''), 'allow', a.id, p_member);
  end if;
  select display_name into v_name from members where id = p_member;
  if j.conversation_id is not null then
    insert into messages (tenant_id, conversation_id, sender_member_id, body, kind, job_id)
      values (j.tenant_id, j.conversation_id, p_member,
              -- 問い合わせは答えた中身を残す（何を答えたかが会話の流れで分かる・会社名は出さない）
              case when v_tool = 'AskUserQuestion' then
                     case when not p_allow then '問い合わせに答えませんでした'
                          else '問い合わせに答えました：' || left(coalesce((select string_agg(value, '／' order by key) from jsonb_each_text(coalesce(p_answers, '{}'::jsonb)) where key <> '（一言）' and value <> ''), ''), 400)
                               || coalesce('（一言：' || nullif(p_answers->>'（一言）', '') || '）', '') end
                   else '「' || coalesce(a.payload->>'summary', '道具の実行') || '」を'
                        || case when not p_allow then '許可しませんでした' when p_scope = 'always' then 'いつも許可にしました' else '今回だけ許可しました' end
                        || coalesce('（' || v_name || '）', '') end, 'note', j.id);
  end if;
  insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
    values (j.tenant_id, p_member, 'member', case when p_allow then 'bridge.tool_allowed' else 'bridge.tool_denied' end,
            'bridge_jobs', j.id::text, 'C5', jsonb_build_object('request_id', p_request_id, 'tool', v_tool, 'summary', a.payload->>'summary', 'scope', coalesce(p_scope, 'once')), p_member);
  return true;
end $$;
grant execute on function app.agent_answer2(uuid, uuid, text, boolean, text, text, jsonb) to kaname_app;
