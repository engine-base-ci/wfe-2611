-- K-145（D-135.3・D-135.5・D-130.4・精査 R 回 1 追加-3 の PM の判断）：人が書く欄を DB の関数でも黙って切らない。守りは前の道すじの入口の送る量 1MB（apps/api/src/auth/ext.ts）
--   (1) 止めずに直す指示（app.agent_steer の left 20000）  (2) 許可の答えの一言（app.agent_answer2 の note の left 2000）
--   (3) 資料のファイル名（app.agent_attachment_new の name の left 200。ファイルの種類 mime の left 120 は人が打たないので残す）
--   (4) 成果物の名前（app.artifact_rename・app.artifact_create の left 80。名前を付けないときの見出しから作る名前は API の titleOf が 80 で作る）
--   (5) 止めたまま本番への理由（app.golive_pause の left 200・ai_employees と証跡の両方）
--   ほかの式は前の定義（0053・0048・0041・0045・0070）のまま。search_path に pg_temp を足し、execute は kaname_app だけ（D-128.171）

create or replace function app.agent_steer(p_member uuid, p_job uuid, p_text text, p_opts jsonb) returns boolean
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare j bridge_jobs%rowtype;
begin
  select * into j from bridge_jobs where id = p_job and member_id = p_member and state_id in ('running', 'asking') and deleted_at is null;
  if j.id is null or coalesce(trim(p_text), '') = '' then return false; end if;
  insert into bridge_job_events (tenant_id, scope_id, member_id, job_id, kind, payload, created_by)
    values (j.tenant_id, j.scope_id, j.member_id, j.id, 'steer',
            jsonb_build_object('text', p_text, 'delivered', false)
              || case when jsonb_typeof(p_opts) = 'object' and p_opts <> '{}'::jsonb then jsonb_build_object('opts', p_opts) else '{}'::jsonb end,
            p_member);
  return true;
end $$;
revoke all on function app.agent_steer(uuid, uuid, text, jsonb) from public;
grant execute on function app.agent_steer(uuid, uuid, text, jsonb) to kaname_app;

create or replace function app.agent_answer2(p_member uuid, p_job uuid, p_request_id text, p_allow boolean, p_scope text, p_note text, p_answers jsonb)
returns boolean language plpgsql security definer set search_path = public, app, pg_temp as $$
declare j bridge_jobs%rowtype; a bridge_job_events%rowtype; v_name text; v_tool text; v_pat text;
begin
  select * into j from bridge_jobs where id = p_job and member_id = p_member and state_id = 'asking';
  if j.id is null then return false; end if;
  select * into a from bridge_job_events where job_id = j.id and kind = 'ask' and request_id = p_request_id order by created_at desc limit 1;
  if a.id is null then return false; end if;
  if exists (select 1 from bridge_job_events where job_id = j.id and kind = 'answer' and request_id = p_request_id) then return true; end if;
  insert into bridge_job_events (tenant_id, scope_id, member_id, job_id, kind, request_id, payload, created_by)
    values (j.tenant_id, j.scope_id, j.member_id, j.id, 'answer', p_request_id,
            jsonb_build_object('allow', p_allow, 'scope', coalesce(p_scope, 'once'), 'note', nullif(coalesce(p_note, ''), ''), 'answers', p_answers), p_member);
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
revoke all on function app.agent_answer2(uuid, uuid, text, boolean, text, text, jsonb) from public;
grant execute on function app.agent_answer2(uuid, uuid, text, boolean, text, text, jsonb) to kaname_app;

create or replace function app.agent_attachment_new(p_member uuid, p_storage_ref text, p_name text, p_mime text, p_size bigint) returns uuid
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_tenant uuid; v_scope uuid; v_id uuid;
begin
  select tenant_id, scope_id into v_tenant, v_scope from members where id = p_member and deleted_at is null;
  if v_tenant is null then return null; end if;
  insert into attachments (tenant_id, scope_id, owner_type, owner_id, storage_ref, mime, size, name, uploaded_by, created_by)
    values (v_tenant, v_scope, 'message', null, p_storage_ref, left(coalesce(p_mime, 'application/octet-stream'), 120), p_size, coalesce(p_name, '資料'), p_member, p_member)
    returning id into v_id;
  return v_id;
end $$;
revoke all on function app.agent_attachment_new(uuid, text, text, text, bigint) from public;
grant execute on function app.agent_attachment_new(uuid, text, text, text, bigint) to kaname_app;

create or replace function app.artifact_rename(p_member uuid, p_id uuid, p_title text) returns boolean
language plpgsql security definer set search_path = public, app, pg_temp as $$
begin
  if nullif(trim(coalesce(p_title, '')), '') is null then return false; end if;
  update artifacts set title = trim(p_title), updated_by = p_member where id = p_id and owner_member_id = p_member and deleted_at is null;
  return found;
end $$;
revoke all on function app.artifact_rename(uuid, uuid, text) from public;
grant execute on function app.artifact_rename(uuid, uuid, text) to kaname_app;

create or replace function app.artifact_create(p_member uuid, p_message uuid, p_title text, p_format text, p_ref text, p_size bigint) returns uuid
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_tenant uuid; v_scope uuid; v_conv uuid; v_id uuid;
begin
  select m.tenant_id, m.scope_id into v_tenant, v_scope from members m where m.id = p_member and m.deleted_at is null;
  if v_tenant is null then return null; end if;
  select c.id into v_conv from messages x join conversations c on c.id = x.conversation_id
   where x.id = p_message and x.kind = 'ai' and x.deleted_at is null and c.owner_member_id = p_member and c.deleted_at is null;
  if v_conv is null then return null; end if;
  if coalesce(p_format, '') not in ('md', 'csv') then raise exception '書き出せるのは文書（md）と表（csv）'; end if;
  insert into artifacts (tenant_id, scope_id, format_id, storage_ref, source_message_id, source_conversation_id, title, owner_member_id, current_version, created_by, updated_by)
    values (v_tenant, v_scope, p_format, p_ref, p_message, v_conv, coalesce(nullif(trim(p_title), ''), '成果物'), p_member, 1, p_member, p_member)
    returning id into v_id;
  insert into artifact_versions (tenant_id, scope_id, artifact_id, version, storage_ref, size_bytes, owner_member_id, note, created_by, updated_by)
    values (v_tenant, v_scope, v_id, 1, p_ref, p_size, p_member, '書き出し', p_member, p_member);
  return v_id;
end $$;
revoke all on function app.artifact_create(uuid, uuid, text, text, text, bigint) from public;
grant execute on function app.artifact_create(uuid, uuid, text, text, text, bigint) to kaname_app;

create or replace function app.golive_pause(p_member uuid, p_employee uuid, p_paused boolean, p_reason text) returns boolean
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare m members%rowtype; a ai_employees%rowtype;
begin
  select * into m from members where id = p_member and deleted_at is null;
  if m.id is null then return false; end if;
  update ai_employees set paused_at = case when p_paused then coalesce(paused_at, now()) else null end,
                          paused_reason = case when p_paused then coalesce(p_reason, '') else null end, updated_by = p_member
   where id = p_employee and tenant_id = m.tenant_id and deleted_at is null returning * into a;
  if a.id is null then return false; end if;
  insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
    values (m.tenant_id, p_member, 'member', case when p_paused then 'golive.employee_paused' else 'golive.employee_resumed' end, 'ai_employees', a.id::text, 'C2',
            jsonb_build_object('reason', coalesce(p_reason, '')), p_member);
  return true;
end $$;
revoke all on function app.golive_pause(uuid, uuid, boolean, text) from public;
grant execute on function app.golive_pause(uuid, uuid, boolean, text) to kaname_app;

insert into app.schema_migrations (name) values ('0093_free_text_limits_2.sql') on conflict do nothing;
