-- 0049 自分のAI が Kaname の道具でたたき台に置く（D-110）。
--   鍵は仕事を渡すたびに作り（ハッシュだけ持つ）、その仕事が動いている間だけ・本人の会社にだけ書ける。
--   書いたことは証跡に残す。資格情報は扱わない

alter table bridge_jobs add column if not exists tool_token_hash text;

-- 仕事を渡すときに鍵のハッシュを付ける（Bridge の session でその仕事の持ち主を確かめる）
create or replace function app.bridge_tool_token(p_session uuid, p_job uuid, p_hash text) returns boolean
language plpgsql security definer set search_path = public, app as $$
declare v_member uuid;
begin
  select member_id into v_member from sessions where id = p_session and kind_id = 'bridge' and revoked_at is null;
  if v_member is null or coalesce(p_hash, '') !~ '^[0-9a-f]{64}$' then return false; end if;
  update bridge_jobs set tool_token_hash = p_hash where id = p_job and member_id = v_member and state_id in ('running', 'asking');
  return found;
end $$;
grant execute on function app.bridge_tool_token(uuid, uuid, text) to kaname_app;

-- 道具の鍵から、その仕事と持ち主を引く。動いていない仕事・合わない鍵は何も返さない
create or replace function app.bridge_tool_job(p_hash text) returns table (job_id uuid, member_id uuid, tenant_id uuid, scope_id uuid, conversation_id uuid)
language sql stable security definer set search_path = public, app as $$
  select j.id, j.member_id, j.tenant_id, m.scope_id, j.conversation_id
    from bridge_jobs j join members m on m.id = j.member_id and m.deleted_at is null
   where coalesce(p_hash, '') ~ '^[0-9a-f]{64}$' and j.tool_token_hash = p_hash and j.state_id in ('running', 'asking')
   limit 1
$$;
grant execute on function app.bridge_tool_job(text) to kaname_app;

-- 証跡（道具で書いたこと）
create or replace function app.agent_tool_audit(p_member uuid, p_tenant uuid, p_action text, p_type text, p_target uuid, p_payload jsonb) returns void
language sql security definer set search_path = public, app as $$
  insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
  values (p_tenant, p_member, 'bridge', p_action, p_type, p_target::text, 'C2', coalesce(p_payload, '{}'::jsonb), p_member)
$$;

-- 単位（ラベルから。会社に無ければ作る）
create or replace function app.agent_unit(p_tenant uuid, p_scope uuid, p_label text) returns uuid
language plpgsql security definer set search_path = public, app as $$
declare v uuid; l text := left(trim(coalesce(p_label, '')), 20);
begin
  if l = '' then return null; end if;
  select id into v from units where tenant_id = p_tenant and deleted_at is null and (label = l or symbol = l) order by created_at limit 1;
  if v is null then
    insert into units (tenant_id, scope_id, key, label, symbol) values (p_tenant, p_scope, 'u-' || substr(md5(l), 1, 12), l, l) returning id into v;
  end if;
  return v;
end $$;

-- 目標を置く・直す（名前は版に持つ・D-108.1）。id があれば直す（名前が変われば版を上げる）
create or replace function app.agent_goal_set(p_member uuid, p_id uuid, p_name text, p_target numeric, p_unit text, p_start date, p_end date) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare m members%rowtype; g goals%rowtype; v_name text := left(trim(coalesce(p_name, '')), 80); v_unit uuid; v_ver int; v_old text;
begin
  select * into m from members where id = p_member and deleted_at is null;
  if m.id is null then return jsonb_build_object('error', '持ち主が見つかりません'); end if;
  if p_start is not null and p_end is not null and p_end < p_start then return jsonb_build_object('error', '期間の終わりが始まりより前です'); end if;
  v_unit := app.agent_unit(m.tenant_id, m.scope_id, p_unit);
  if p_id is null then
    if v_name = '' then return jsonb_build_object('error', '目標の名前が要ります'); end if;
    insert into goals (tenant_id, scope_id, target_value, unit_id, period_start, period_end, created_by)
      values (m.tenant_id, m.scope_id, p_target, v_unit, p_start, p_end, p_member) returning * into g;
    insert into goal_versions (tenant_id, goal_id, version, name, snapshot, changed_at, changed_by)
      values (m.tenant_id, g.id, 1, v_name, jsonb_build_object('target_value', p_target, 'unit', p_unit, 'period_start', p_start, 'period_end', p_end), now(), p_member);
    perform app.agent_tool_audit(p_member, m.tenant_id, 'agent.goal_created', 'goal', g.id, jsonb_build_object('name', v_name));
    return jsonb_build_object('id', g.id, 'done', 'created', 'name', v_name);
  end if;
  select * into g from goals where id = p_id and tenant_id = m.tenant_id and deleted_at is null;
  if g.id is null then return jsonb_build_object('error', 'その目標はこの会社にありません'); end if;
  update goals set target_value = coalesce(p_target, target_value), unit_id = coalesce(v_unit, unit_id),
         period_start = coalesce(p_start, period_start), period_end = coalesce(p_end, period_end), updated_by = p_member
   where id = g.id returning * into g;
  v_old := app.goal_name(g.id);
  if v_name <> '' and v_name is distinct from v_old then
    v_ver := g.version + 1;
    update goals set version = v_ver where id = g.id;
    insert into goal_versions (tenant_id, goal_id, version, name, snapshot, changed_at, changed_by)
      values (m.tenant_id, g.id, v_ver, v_name, jsonb_build_object('target_value', g.target_value, 'period_start', g.period_start, 'period_end', g.period_end), now(), p_member);
  end if;
  perform app.agent_tool_audit(p_member, m.tenant_id, 'agent.goal_updated', 'goal', g.id, jsonb_build_object('name', coalesce(nullif(v_name, ''), v_old)));
  return jsonb_build_object('id', g.id, 'done', 'updated', 'name', coalesce(nullif(v_name, ''), v_old));
end $$;

-- 台帳を置く・直す（段階と項目は文字の並び）
create or replace function app.agent_ledger_set(p_member uuid, p_id uuid, p_name text, p_stages jsonb, p_fields jsonb) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare m members%rowtype; l ledger_definitions%rowtype; v_name text := left(trim(coalesce(p_name, '')), 80);
  v_stages jsonb := case when jsonb_typeof(p_stages) = 'array' then p_stages end;
  v_fields jsonb := case when jsonb_typeof(p_fields) = 'array' then p_fields end;
begin
  select * into m from members where id = p_member and deleted_at is null;
  if m.id is null then return jsonb_build_object('error', '持ち主が見つかりません'); end if;
  if p_id is null then
    if v_name = '' then return jsonb_build_object('error', '台帳の名前が要ります'); end if;
    insert into ledger_definitions (tenant_id, scope_id, name, json_schema, created_by)
      values (m.tenant_id, m.scope_id, v_name, jsonb_build_object('stages', coalesce(v_stages, '[]'::jsonb), 'fields', coalesce(v_fields, '[]'::jsonb)), p_member)
      returning * into l;
    perform app.agent_tool_audit(p_member, m.tenant_id, 'agent.ledger_created', 'ledger_definition', l.id, jsonb_build_object('name', v_name));
    return jsonb_build_object('id', l.id, 'done', 'created', 'name', v_name);
  end if;
  select * into l from ledger_definitions where id = p_id and tenant_id = m.tenant_id and deleted_at is null;
  if l.id is null then return jsonb_build_object('error', 'その台帳はこの会社にありません'); end if;
  update ledger_definitions set name = coalesce(nullif(v_name, ''), name), version = version + 1, updated_by = p_member,
         json_schema = coalesce(json_schema, '{}'::jsonb)
           || case when v_stages is null then '{}'::jsonb else jsonb_build_object('stages', v_stages) end
           || case when v_fields is null then '{}'::jsonb else jsonb_build_object('fields', v_fields) end
   where id = l.id returning * into l;
  perform app.agent_tool_audit(p_member, m.tenant_id, 'agent.ledger_updated', 'ledger_definition', l.id, jsonb_build_object('name', l.name));
  return jsonb_build_object('id', l.id, 'done', 'updated', 'name', l.name);
end $$;

-- 担当業務とAI社員を置く・直す。AI社員の名前があれば、その名前の AI社員（無ければ作る）に持たせる
create or replace function app.agent_duty_set(p_member uuid, p_id uuid, p_name text, p_definition text, p_staff text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare m members%rowtype; du duties%rowtype; v_name text := left(trim(coalesce(p_name, '')), 80);
  v_staff text := left(trim(coalesce(p_staff, '')), 40); v_ai uuid; v_staff_member uuid;
begin
  select * into m from members where id = p_member and deleted_at is null;
  if m.id is null then return jsonb_build_object('error', '持ち主が見つかりません'); end if;
  if v_staff <> '' then
    select a.id into v_ai from ai_employees a join members sm on sm.id = a.member_id
     where a.tenant_id = m.tenant_id and a.deleted_at is null and sm.deleted_at is null and sm.display_name = v_staff limit 1;
    if v_ai is null then
      insert into members (tenant_id, scope_id, kind_id, display_name, manager_member_id, created_by)
        values (m.tenant_id, m.scope_id, 'ai_employee', v_staff, p_member, p_member) returning id into v_staff_member;
      insert into ai_employees (tenant_id, scope_id, member_id, created_by) values (m.tenant_id, m.scope_id, v_staff_member, p_member) returning id into v_ai;
      perform app.agent_tool_audit(p_member, m.tenant_id, 'agent.ai_employee_created', 'ai_employee', v_ai, jsonb_build_object('name', v_staff));
    end if;
  end if;
  if p_id is null then
    if v_name = '' then return jsonb_build_object('error', '担当業務の名前が要ります'); end if;
    insert into duties (tenant_id, scope_id, ai_employee_id, name, definition_md, created_by)
      values (m.tenant_id, m.scope_id, v_ai, v_name, left(coalesce(p_definition, ''), 8000), p_member) returning * into du;
    perform app.agent_tool_audit(p_member, m.tenant_id, 'agent.duty_created', 'duty', du.id, jsonb_build_object('name', v_name, 'staff', v_staff));
    return jsonb_build_object('id', du.id, 'done', 'created', 'name', v_name, 'staff', v_staff);
  end if;
  select * into du from duties where id = p_id and tenant_id = m.tenant_id and deleted_at is null;
  if du.id is null then return jsonb_build_object('error', 'その担当業務はこの会社にありません'); end if;
  update duties set name = coalesce(nullif(v_name, ''), name), definition_md = coalesce(p_definition, definition_md),
         ai_employee_id = coalesce(v_ai, ai_employee_id), version = version + 1, updated_by = p_member
   where id = du.id returning * into du;
  perform app.agent_tool_audit(p_member, m.tenant_id, 'agent.duty_updated', 'duty', du.id, jsonb_build_object('name', du.name));
  return jsonb_build_object('id', du.id, 'done', 'updated', 'name', du.name);
end $$;

-- 外す（目標・台帳・担当業務）。消さずに印を付ける（証跡に残る）
create or replace function app.agent_draft_remove(p_member uuid, p_kind text, p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare m members%rowtype; n int := 0;
begin
  select * into m from members where id = p_member and deleted_at is null;
  if m.id is null then return jsonb_build_object('error', '持ち主が見つかりません'); end if;
  if p_kind = 'goal' then update goals set deleted_at = now(), updated_by = p_member where id = p_id and tenant_id = m.tenant_id and deleted_at is null;
  elsif p_kind = 'ledger' then update ledger_definitions set deleted_at = now(), updated_by = p_member where id = p_id and tenant_id = m.tenant_id and deleted_at is null;
  elsif p_kind = 'duty' then update duties set deleted_at = now(), updated_by = p_member where id = p_id and tenant_id = m.tenant_id and deleted_at is null;
  else return jsonb_build_object('error', '外せるのは目標・台帳・担当業務だけです');
  end if;
  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('error', 'それはこの会社にありません'); end if;
  perform app.agent_tool_audit(p_member, m.tenant_id, 'agent.' || p_kind || '_removed', p_kind, p_id, '{}'::jsonb);
  return jsonb_build_object('id', p_id, 'done', 'removed');
end $$;

-- 覚える（道具から。記憶に残さない会話では覚えない・D-104.1）。会話に「覚えました」を残すのは [[覚える]] と同じ
create or replace function app.agent_remember_tool(p_job uuid, p_items text[]) returns integer
language plpgsql security definer set search_path = public, app as $$
declare j bridge_jobs%rowtype; v_scope uuid; t text; v_id uuid; n int := 0;
begin
  select * into j from bridge_jobs where id = p_job and state_id in ('running', 'asking');
  if j.id is null then return 0; end if;
  if exists (select 1 from conversations c where c.id = j.conversation_id and c.incognito) then return 0; end if;
  select scope_id into v_scope from members where id = j.member_id;
  foreach t in array coalesce(p_items, '{}') loop
    t := left(trim(t), 2000);
    continue when t = '';
    insert into memories (tenant_id, scope_id, kind_id, owner_member_id, title, body, source_type_id, source_ref_id, created_by)
      values (j.tenant_id, v_scope, 'preference', j.member_id, left(t, 80), t, 'conversation', j.conversation_id, j.member_id)
      returning id into v_id;
    if j.conversation_id is not null then
      insert into messages (tenant_id, conversation_id, body, kind, job_id, options)
        values (j.tenant_id, j.conversation_id, t, 'memo', j.id, jsonb_build_object('memory_id', v_id));
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;

grant execute on function app.agent_goal_set(uuid, uuid, text, numeric, text, date, date) to kaname_app;
grant execute on function app.agent_ledger_set(uuid, uuid, text, jsonb, jsonb) to kaname_app;
grant execute on function app.agent_duty_set(uuid, uuid, text, text, text) to kaname_app;
grant execute on function app.agent_draft_remove(uuid, text, uuid) to kaname_app;
grant execute on function app.agent_remember_tool(uuid, text[]) to kaname_app;
