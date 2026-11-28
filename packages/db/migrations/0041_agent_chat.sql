-- 0041 自分のAIとの会話の作り込み（D-104・T-B-15〜T-B-20）
--   会話は人が「新しく話す」で分け、一覧から戻る（1 会話＝本人の Claude Code の 1 セッション）
--   書きながら出る返事（partial）・作業の行（status／plan／tool）・止める／止めずに直す（steer）／順番待ち（queued・取り消し）
--   資料を付ける（attachment_ids）・許可のモードと「いつも許可」（permission_rules）・使用量（agent_usage_snapshots）
-- 読む側で生の select をすると行レベルの制御に弾かれ、例外にならず「0 件」になる（0026・0027・0030 で踏んだ）。判定は定義の中で

-- ---- 列（ER図 §1・§6・§13）
alter table conversations add column if not exists title_auto boolean not null default true;   -- 名前を自分のAI（最初の一言）が付けたか。人が直したら false
alter table conversations add column if not exists starred_at timestamptz;                     -- 星
alter table conversations add column if not exists incognito boolean not null default false;   -- 記憶に残さない会話（毎朝のまとめから外す）
alter table conversations add column if not exists last_read_at timestamptz;                   -- 見ていない間の返事の印
alter table members add column if not exists agent_permission_mode text not null default 'manual';
alter table members add column if not exists agent_model text;
alter table members add column if not exists agent_effort text;
alter table bridge_jobs add column if not exists partial text;                 -- 書きながら出る返事の途中
alter table bridge_jobs add column if not exists permission_mode text not null default 'manual';
alter table bridge_jobs add column if not exists model text;
alter table bridge_jobs add column if not exists effort text;
alter table bridge_jobs add column if not exists tools text[];
alter table bridge_jobs add column if not exists attachment_ids uuid[];
alter table bridge_jobs add column if not exists steer_seq int not null default 0;
alter table bridge_jobs add column if not exists stop_requested_at timestamptz;  -- 止めるが押された（Bridge が control で受け取る）
alter table messages add column if not exists quote jsonb;       -- 一部を選んで引用して続けた元
alter table messages add column if not exists work jsonb;        -- 畳んだ作業の 1 行（操作の数・時間）
alter table messages add column if not exists send_state text;   -- 送れなかった＝failed
alter table messages add column if not exists job_id uuid references bridge_jobs(id);
alter table artifacts add column if not exists source_message_id uuid references messages(id);
alter table attachments add column if not exists name text;
alter table attachments add column if not exists uploaded_by uuid references members(id);
alter table memories add column if not exists digest_id uuid references memory_digests(id);
alter table memories add column if not exists superseded_by uuid references memories(id);

alter table bridge_jobs drop constraint if exists bridge_jobs_permission_mode_check;
alter table bridge_jobs add constraint bridge_jobs_permission_mode_check
  check (permission_mode in ('manual', 'acceptEdits', 'auto', 'plan', 'bypassPermissions'));
alter table members drop constraint if exists members_agent_permission_mode_check;
alter table members add constraint members_agent_permission_mode_check
  check (agent_permission_mode in ('manual', 'acceptEdits', 'auto', 'plan'));   -- 全部許可は既定にできない（会話ごとに本人が選ぶ・D-104.14）
alter table bridge_jobs drop constraint if exists bridge_jobs_effort_check;
alter table bridge_jobs add constraint bridge_jobs_effort_check check (effort is null or effort in ('low', 'medium', 'high', 'xhigh', 'max'));

alter table bridge_job_events drop constraint if exists bridge_job_events_kind_check;
alter table bridge_job_events add constraint bridge_job_events_kind_check
  check (kind in ('init', 'progress', 'ask', 'answer', 'tool', 'usage', 'status', 'plan', 'steer', 'stop', 'question', 'limit', 'reply'));

create index if not exists conversations_owner_updated_idx on conversations (owner_member_id, updated_at desc);

-- ---- 会話を分ける（D-104.1）
-- 新しく話す：まっさらな会話を作る（次の一言で新しいセッションが始まる）
create or replace function app.agent_new_conversation(p_member uuid, p_incognito boolean) returns uuid
language plpgsql security definer set search_path = public, app as $$
declare v_tenant uuid; v_scope uuid; v_id uuid;
begin
  select tenant_id, scope_id into v_tenant, v_scope from members where id = p_member and deleted_at is null;
  if v_tenant is null then return null; end if;
  insert into conversations (tenant_id, scope_id, owner_member_id, title, title_auto, incognito, created_by)
    values (v_tenant, v_scope, p_member, null, true, coalesce(p_incognito, false), p_member) returning id into v_id;
  return v_id;
end $$;
grant execute on function app.agent_new_conversation(uuid, boolean) to kaname_app;

-- 会話の一覧（Claude と同じ）：星が上・新しい順。探す（名前も中身も）。見ていない間の返事の数
create or replace function app.agent_conversations(p_member uuid, p_q text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v jsonb; q text := nullif(trim(coalesce(p_q, '')), '');
begin
  select coalesce(jsonb_agg(x order by (x->>'starred')::boolean desc, x->>'updated_at' desc), '[]'::jsonb) into v from (
    select jsonb_build_object(
      'id', c.id, 'title', coalesce(c.title, '新しい会話'), 'title_auto', c.title_auto,
      'starred', c.starred_at is not null, 'incognito', c.incognito, 'updated_at', c.updated_at,
      'unread', (select count(*) from messages m where m.conversation_id = c.id and m.deleted_at is null and m.kind = 'ai'
                   and m.created_at > coalesce(c.last_read_at, 'epoch'::timestamptz)),
      'hit', case when q is null then null else
              (select left(m.body, 120) from messages m where m.conversation_id = c.id and m.deleted_at is null
                 and m.body ilike '%' || q || '%' order by m.created_at desc limit 1) end) as x
      from conversations c
     where c.owner_member_id = p_member and c.deleted_at is null
       and (q is null or c.title ilike '%' || q || '%'
            or exists (select 1 from messages m where m.conversation_id = c.id and m.deleted_at is null and m.body ilike '%' || q || '%'))
     order by c.updated_at desc limit 200
  ) t;
  return v;
end $$;
grant execute on function app.agent_conversations(uuid, text) to kaname_app;

-- 名前を直す（直したら自動で上書きしない）・星・記憶に残さない
create or replace function app.agent_conversation_set(p_member uuid, p_conv uuid, p_title text, p_starred boolean, p_incognito boolean) returns boolean
language plpgsql security definer set search_path = public, app as $$
declare n int;
begin
  update conversations set
      title = case when p_title is not null and trim(p_title) <> '' then left(trim(p_title), 80) else title end,
      title_auto = case when p_title is not null and trim(p_title) <> '' then false else title_auto end,
      starred_at = case when p_starred is null then starred_at when p_starred then coalesce(starred_at, now()) else null end,
      incognito = coalesce(p_incognito, incognito)
    where id = p_conv and owner_member_id = p_member and deleted_at is null;
  get diagnostics n = row_count; return n > 0;
end $$;
grant execute on function app.agent_conversation_set(uuid, uuid, text, boolean, boolean) to kaname_app;

-- 消す：一覧にも探すにも出ない。動いている・待っている仕事はやめる
create or replace function app.agent_conversation_delete(p_member uuid, p_conv uuid) returns boolean
language plpgsql security definer set search_path = public, app as $$
declare n int;
begin
  update conversations set deleted_at = now() where id = p_conv and owner_member_id = p_member and deleted_at is null;
  get diagnostics n = row_count;
  if n > 0 then
    update bridge_jobs set state_id = 'cancelled', finished_at = now()
      where conversation_id = p_conv and member_id = p_member and state_id = 'queued';
    update bridge_jobs set stop_requested_at = now()
      where conversation_id = p_conv and member_id = p_member and state_id in ('running', 'asking');
  end if;
  return n > 0;
end $$;
grant execute on function app.agent_conversation_delete(uuid, uuid) to kaname_app;

-- 見た（見ていない間の返事の印を消す）
create or replace function app.agent_mark_read(p_member uuid, p_conv uuid) returns boolean
language plpgsql security definer set search_path = public, app as $$
declare n int;
begin
  update conversations set last_read_at = now() where id = p_conv and owner_member_id = p_member and deleted_at is null;
  get diagnostics n = row_count; return n > 0;
end $$;
grant execute on function app.agent_mark_read(uuid, uuid) to kaname_app;

-- 会話を開く：指定があればそれ。無ければいちばん最近の会話（無ければ作る）。消した会話は開かない
drop function if exists app.agent_open_conversation(uuid, uuid, uuid, text);
create function app.agent_open_conversation(p_member uuid, p_conv uuid, p_branch_from uuid, p_title text)
returns table (conv_id uuid, agent_session text)
language plpgsql security definer set search_path = public, app as $$
declare v_tenant uuid; v_scope uuid; v_id uuid; v_sess text; v_parent uuid;
begin
  select tenant_id, scope_id into v_tenant, v_scope from members where id = p_member;
  if p_branch_from is not null then   -- 自分の文を直して送り直す：その時点から新しいセッション・元の会話は残る（D-104.17）
    select m.conversation_id into v_parent from messages m join conversations c on c.id = m.conversation_id
      where m.id = p_branch_from and c.owner_member_id = p_member;
    if v_parent is not null then
      insert into conversations (tenant_id, scope_id, owner_member_id, title, title_auto, parent_conversation_id, branched_from_message_id, created_by)
        select v_tenant, v_scope, p_member, c.title, c.title_auto, v_parent, p_branch_from, p_member from conversations c where c.id = v_parent
        returning conversations.id into v_id;
      return query select v_id, null::text;
      return;
    end if;
  end if;
  if p_conv is not null then
    select c.id, c.agent_session_id into v_id, v_sess from conversations c
      where c.id = p_conv and c.owner_member_id = p_member and c.deleted_at is null;
    if v_id is not null then return query select v_id, v_sess; return; end if;
    return;   -- 指定された会話が無い（消した・他人の）。黙って別の会話に書かない
  end if;
  select c.id, c.agent_session_id into v_id, v_sess from conversations c
    where c.owner_member_id = p_member and c.closed_at is null and c.deleted_at is null
    order by c.updated_at desc limit 1;
  if v_id is null then
    insert into conversations (tenant_id, scope_id, owner_member_id, title, title_auto, created_by)
      values (v_tenant, v_scope, p_member, p_title, true, p_member) returning conversations.id into v_id;
  end if;
  return query select v_id, v_sess;
end $$;
grant execute on function app.agent_open_conversation(uuid, uuid, uuid, text) to kaname_app;

-- 言う（D-103・D-104）：文脈は指示にだけ前置き。モード・モデル・使うもの・資料・引用を仕事に持たせる。
--   全部許可（bypassPermissions）は本人が選んだときだけ来る（既定は members.agent_permission_mode・全部許可は既定にできない）
create or replace function app.agent_enqueue(p_member uuid, p_conv uuid, p_text text, p_context text, p_opts jsonb) returns uuid
language plpgsql security definer set search_path = public, app as $$
declare v_tenant uuid; v_scope uuid; v_job uuid; v_live int; v_mode text; v_default text; v_atts uuid[]; v_msg uuid; o jsonb := coalesce(p_opts, '{}'::jsonb);
begin
  select count(*) into v_live from sessions where member_id = p_member and kind_id = 'bridge' and revoked_at is null;
  if v_live = 0 then return null; end if;   -- つながっていない。呼んだ側が 409 にする
  select tenant_id, scope_id, agent_permission_mode into v_tenant, v_scope, v_default from members where id = p_member;
  v_mode := coalesce(nullif(o->>'permission_mode', ''), v_default, 'manual');
  if v_mode not in ('manual', 'acceptEdits', 'auto', 'plan', 'bypassPermissions') then v_mode := 'manual'; end if;
  -- 資料は本人が付けたものだけ（他人の添付の id を混ぜても渡さない）
  select coalesce(array_agg(a.id), '{}') into v_atts from attachments a
    where a.id in (select (jsonb_array_elements_text(coalesce(o->'attachment_ids', '[]'::jsonb)))::uuid)
      and a.uploaded_by = p_member and a.deleted_at is null;
  insert into messages (tenant_id, conversation_id, sender_member_id, body, kind, quote, attachments)
    values (v_tenant, p_conv, p_member, p_text, 'human', o->'quote',
            (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'mime', a.mime, 'size', a.size)), '[]'::jsonb) from attachments a where a.id = any(v_atts)))
    returning id into v_msg;
  update attachments set owner_type = 'message', owner_id = v_msg where id = any(v_atts);
  update conversations set title = left(regexp_replace(p_text, '\s+', ' ', 'g'), 40), updated_at = now()
    where id = p_conv and title is null;
  update conversations set updated_at = now() where id = p_conv;
  insert into bridge_jobs (tenant_id, scope_id, member_id, conversation_id, prompt, agent_session_id, created_by,
                           permission_mode, model, effort, tools, attachment_ids)
    values (v_tenant, v_scope, p_member, p_conv,
            case when coalesce(p_context, '') = '' then p_text else p_context || E'\n\n' || p_text end,
            null, p_member, v_mode, nullif(o->>'model', ''), nullif(o->>'effort', ''),
            (select array_agg(x) from jsonb_array_elements_text(coalesce(o->'tools', '[]'::jsonb)) x),
            v_atts)
    returning id into v_job;
  update messages set job_id = v_job where id = v_msg;
  return v_job;
end $$;
grant execute on function app.agent_enqueue(uuid, uuid, text, text, jsonb) to kaname_app;
-- 前の形（4 引数）も残す（同じ中身）
create or replace function app.agent_enqueue(p_member uuid, p_conv uuid, p_text text, p_context text) returns uuid
language sql security definer set search_path = public, app as $$ select app.agent_enqueue(p_member, p_conv, p_text, p_context, '{}'::jsonb) $$;
grant execute on function app.agent_enqueue(uuid, uuid, text, text) to kaname_app;

-- Bridge が 1 件取る：同じ会話で動いている仕事があれば、その会話の次は待たせる（順番待ち・D-104.9）。
--   会話の続きの id は取る時点の会話から引く（待っている間に前の仕事が id を決めることがある）
drop function if exists app.bridge_take_job(uuid);
create function app.bridge_take_job(p_session uuid)
returns table (job_id uuid, prompt text, agent_session_id text, conversation_id uuid,
               permission_mode text, model text, effort text, tools text[], allowed_tools text[], attachments jsonb)
language plpgsql security definer set search_path = public, app as $$
declare v_member uuid; v_job uuid;
begin
  select s.member_id into v_member from sessions s where s.id = p_session and s.kind_id = 'bridge' and s.revoked_at is null;
  if v_member is null then return; end if;
  select x.id into v_job from bridge_jobs x
   where x.member_id = v_member and x.state_id = 'queued' and x.deleted_at is null
     and not exists (select 1 from bridge_jobs y where y.conversation_id = x.conversation_id and y.state_id in ('running', 'asking') and y.deleted_at is null)
   order by x.created_at limit 1 for update skip locked;
  if v_job is null then return; end if;
  update bridge_jobs j set state_id = 'running', started_at = now(),
         agent_session_id = coalesce(j.agent_session_id, (select c.agent_session_id from conversations c where c.id = j.conversation_id))
   where j.id = v_job;
  return query
    select j.id, j.prompt, j.agent_session_id, j.conversation_id, j.permission_mode, j.model, j.effort, j.tools,
           coalesce((select array_agg(r.tool || case when coalesce(r.target_pattern, '') = '' then '' else '(' || r.target_pattern || ')' end)
                       from permission_rules r where r.member_id = v_member and r.decision_id = 'allow' and r.revoked_at is null and r.deleted_at is null), '{}'),
           coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'mime', a.mime, 'size', a.size))
                       from attachments a where a.id = any(coalesce(j.attachment_ids, '{}'))), '[]'::jsonb)
      from bridge_jobs j where j.id = v_job;
end $$;
grant execute on function app.bridge_take_job(uuid) to kaname_app;

-- 途中経過（D-093・D-100・D-104）：init／progress／tool／usage に加え、status（1 行）／plan（手順）／limit（使用量）／reply（途中の返事）
create or replace function app.bridge_progress(p_session uuid, p_job uuid, p_seq int, p_kind text, p_payload jsonb) returns boolean
language plpgsql security definer set search_path = public, app as $$
declare v_member uuid; j bridge_jobs%rowtype; w jsonb;
begin
  select member_id into v_member from sessions where id = p_session and kind_id = 'bridge' and revoked_at is null;
  if v_member is null then return false; end if;
  select * into j from bridge_jobs where id = p_job and member_id = v_member and state_id in ('running', 'asking');
  if j.id is null then return false; end if;
  if p_kind not in ('init', 'progress', 'tool', 'usage', 'status', 'plan', 'limit', 'reply') then
    raise exception '途中経過は init／progress／tool／usage／status／plan／limit／reply';
  end if;
  insert into bridge_job_events (tenant_id, scope_id, member_id, job_id, kind, seq, payload)
    values (j.tenant_id, j.scope_id, j.member_id, j.id, p_kind, coalesce(p_seq, 0), coalesce(p_payload, '{}'::jsonb));
  if p_kind = 'init' and (p_payload->>'agent_session_id') is not null then
    update bridge_jobs set agent_session_id = p_payload->>'agent_session_id' where id = j.id;
    if j.conversation_id is not null then
      update conversations set agent_session_id = p_payload->>'agent_session_id'
        where id = j.conversation_id and agent_session_id is distinct from (p_payload->>'agent_session_id');
    end if;
  elsif p_kind = 'limit' then   -- 使用量（D-104.16）：枠ごとに最新だけ
    for w in select * from jsonb_array_elements(coalesce(p_payload->'windows', '[]'::jsonb)) loop
      update agent_usage_snapshots set utilization = (w->>'utilization')::numeric, resets_at = to_timestamp((w->>'resets_at')::double precision), observed_at = now()
        where member_id = j.member_id and window_id = w->>'window' and deleted_at is null;
      if not found then
        insert into agent_usage_snapshots (tenant_id, member_id, window_id, utilization, resets_at, observed_at, created_by)
          values (j.tenant_id, j.member_id, w->>'window', (w->>'utilization')::numeric, to_timestamp((w->>'resets_at')::double precision), now(), j.member_id);
      end if;
    end loop;
  elsif p_kind = 'reply' and j.conversation_id is not null then   -- 止めずに直した文の前の返事（区切りごとの答え）
    insert into messages (tenant_id, conversation_id, body, kind, job_id)
      values (j.tenant_id, j.conversation_id, left(coalesce(p_payload->>'text', ''), 200000), 'ai', j.id);
    update bridge_jobs set partial = null where id = j.id;
  end if;
  return true;
end $$;
grant execute on function app.bridge_progress(uuid, uuid, int, text, jsonb) to kaname_app;

-- 書きながら出る返事の途中（D-104.8）。全文を上書き（途中だけ・終われば result）
create or replace function app.bridge_partial(p_session uuid, p_job uuid, p_text text) returns boolean
language plpgsql security definer set search_path = public, app as $$
declare v_member uuid; n int;
begin
  select member_id into v_member from sessions where id = p_session and kind_id = 'bridge' and revoked_at is null;
  if v_member is null then return false; end if;
  update bridge_jobs set partial = left(coalesce(p_text, ''), 200000)
    where id = p_job and member_id = v_member and state_id in ('running', 'asking');
  get diagnostics n = row_count; return n > 0;
end $$;
grant execute on function app.bridge_partial(uuid, uuid, text) to kaname_app;

-- 止める・止めずに直す（D-104.9）。Bridge は動いている間これを数秒おきに見る
create or replace function app.bridge_control(p_session uuid, p_job uuid) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v_member uuid; j bridge_jobs%rowtype; v_steer jsonb;
begin
  select member_id into v_member from sessions where id = p_session and kind_id = 'bridge' and revoked_at is null;
  if v_member is null then return null; end if;
  select * into j from bridge_jobs where id = p_job and member_id = v_member;
  if j.id is null then return null; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'text', e.payload->>'text') order by e.created_at), '[]'::jsonb) into v_steer
    from bridge_job_events e where e.job_id = j.id and e.kind = 'steer' and coalesce((e.payload->>'delivered')::boolean, false) = false;
  update bridge_job_events set payload = payload || '{"delivered": true}'::jsonb
    where job_id = j.id and kind = 'steer' and coalesce((payload->>'delivered')::boolean, false) = false;
  return jsonb_build_object('stop', j.stop_requested_at is not null or j.state_id not in ('running', 'asking'), 'steer', v_steer);
end $$;
grant execute on function app.bridge_control(uuid, uuid) to kaname_app;

-- 止める：動いている仕事は止める合図（Bridge が止めて「あなたが止めました」を返す）。待っている仕事はその場でやめる
create or replace function app.agent_stop(p_member uuid, p_job uuid) returns text
language plpgsql security definer set search_path = public, app as $$
declare j bridge_jobs%rowtype;
begin
  select * into j from bridge_jobs where id = p_job and member_id = p_member and deleted_at is null;
  if j.id is null then return null; end if;
  if j.state_id = 'queued' then
    update bridge_jobs set state_id = 'cancelled', finished_at = now() where id = j.id; return 'cancelled';
  elsif j.state_id in ('running', 'asking') then
    update bridge_jobs set stop_requested_at = coalesce(stop_requested_at, now()) where id = j.id;
    insert into bridge_job_events (tenant_id, scope_id, member_id, job_id, kind, payload, created_by)
      values (j.tenant_id, j.scope_id, j.member_id, j.id, 'stop', '{}'::jsonb, p_member);
    return 'stopping';
  end if;
  return j.state_id;
end $$;
grant execute on function app.agent_stop(uuid, uuid) to kaname_app;

-- 止めずに直す：動いている仕事に次の区切りで渡す文。会話には本人の吹き出しとして出す
create or replace function app.agent_steer(p_member uuid, p_job uuid, p_text text) returns boolean
language plpgsql security definer set search_path = public, app as $$
declare j bridge_jobs%rowtype;
begin
  select * into j from bridge_jobs where id = p_job and member_id = p_member and state_id in ('running', 'asking') and deleted_at is null;
  if j.id is null or coalesce(trim(p_text), '') = '' then return false; end if;
  insert into bridge_job_events (tenant_id, scope_id, member_id, job_id, kind, payload, created_by)
    values (j.tenant_id, j.scope_id, j.member_id, j.id, 'steer', jsonb_build_object('text', left(p_text, 20000), 'delivered', false), p_member);
  update bridge_jobs set steer_seq = steer_seq + 1 where id = j.id;
  if j.conversation_id is not null then
    insert into messages (tenant_id, conversation_id, sender_member_id, body, kind, job_id)
      values (j.tenant_id, j.conversation_id, p_member, p_text, 'human', j.id);
    update conversations set updated_at = now() where id = j.conversation_id;
  end if;
  return true;
end $$;
grant execute on function app.agent_steer(uuid, uuid, text) to kaname_app;

-- 結末：止まったら理由だけ（D-104.15）。畳んだ作業の 1 行（操作の数・時間）を返事に付ける（D-104.8）
create or replace function app.bridge_finish_job(p_session uuid, p_job uuid, p_state text, p_result text, p_reason text, p_agent_session text)
returns boolean language plpgsql security definer set search_path = public, app as $$
declare v_member uuid; j bridge_jobs%rowtype; v_ops int; v_ms bigint;
begin
  select member_id into v_member from sessions where id = p_session and kind_id = 'bridge' and revoked_at is null;
  if v_member is null then return false; end if;
  if p_state not in ('done', 'stopped', 'cancelled') then raise exception '結末は done／stopped／cancelled'; end if;
  update bridge_jobs set state_id = p_state, result = p_result, stopped_reason = p_reason, partial = null,
         agent_session_id = coalesce(p_agent_session, agent_session_id), finished_at = now()
    where id = p_job and member_id = v_member and state_id in ('running', 'asking') returning * into j;
  if j.id is null then return false; end if;
  if j.conversation_id is not null and p_agent_session is not null then
    update conversations set agent_session_id = p_agent_session where id = j.conversation_id and agent_session_id is distinct from p_agent_session;
  end if;
  select count(*) into v_ops from bridge_job_events where job_id = j.id and kind = 'tool';
  v_ms := floor(extract(epoch from (j.finished_at - coalesce(j.started_at, j.created_at))) * 1000);
  if j.conversation_id is not null then
    insert into messages (tenant_id, conversation_id, body, kind, job_id, work)
      values (j.tenant_id, j.conversation_id,
              case when p_state = 'done' then coalesce(p_result, '')
                   when p_state = 'stopped' then coalesce(p_reason, '理由は分かりません')
                   else 'やめました。' end,
              case when p_state = 'done' then 'ai' else 'stopped' end, j.id,
              case when v_ops > 0 or p_state = 'done' then jsonb_build_object('ops', v_ops, 'ms', v_ms) else null end);
    update conversations set updated_at = now() where id = j.conversation_id;
  end if;
  return true;
end $$;
grant execute on function app.bridge_finish_job(uuid, uuid, text, text, text, text) to kaname_app;

-- 許可に答える（D-104.14）：今回だけ／いつも／しない ＋ 一言。いつもは permission_rules に。問い合わせ（AskUserQuestion）の答えも同じ口
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
              case when v_tool = 'AskUserQuestion' then '問い合わせに答えました'
                   else '「' || coalesce(a.payload->>'summary', '道具の実行') || '」を'
                        || case when not p_allow then '許可しませんでした' when p_scope = 'always' then 'いつも許可にしました' else '今回だけ許可しました' end end
              || coalesce('（' || v_name || '）', ''), 'note', j.id);
  end if;
  insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
    values (j.tenant_id, p_member, 'member', case when p_allow then 'bridge.tool_allowed' else 'bridge.tool_denied' end,
            'bridge_jobs', j.id::text, 'C5', jsonb_build_object('request_id', p_request_id, 'tool', v_tool, 'summary', a.payload->>'summary', 'scope', coalesce(p_scope, 'once')), p_member);
  return true;
end $$;
grant execute on function app.agent_answer2(uuid, uuid, text, boolean, text, text, jsonb) to kaname_app;

-- Bridge が答えを取りに来る：許すか・一言・問い合わせの答え
create or replace function app.bridge_take_answer2(p_session uuid, p_job uuid, p_request_id text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v_member uuid; v jsonb;
begin
  select member_id into v_member from sessions where id = p_session and kind_id = 'bridge' and revoked_at is null;
  if v_member is null then return null; end if;
  select e.payload into v from bridge_job_events e join bridge_jobs j on j.id = e.job_id
   where e.job_id = p_job and j.member_id = v_member and e.kind = 'answer' and e.request_id = p_request_id
   order by e.created_at desc limit 1;
  return v;
end $$;
grant execute on function app.bridge_take_answer2(uuid, uuid, text) to kaname_app;

-- 「いつも許可」の一覧と取り消し（ルール › 個人・D-104.14）
create or replace function app.agent_permission_rules(p_member uuid) returns jsonb
language sql security definer set search_path = public, app as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'tool', r.tool, 'target', r.target_pattern, 'at', r.created_at) order by r.created_at desc), '[]'::jsonb)
    from permission_rules r where r.member_id = p_member and r.revoked_at is null and r.deleted_at is null and r.decision_id = 'allow'
$$;
grant execute on function app.agent_permission_rules(uuid) to kaname_app;
create or replace function app.agent_permission_revoke(p_member uuid, p_rule uuid) returns boolean
language plpgsql security definer set search_path = public, app as $$
declare n int;
begin
  update permission_rules set revoked_at = now() where id = p_rule and member_id = p_member and revoked_at is null;
  get diagnostics n = row_count; return n > 0;
end $$;
grant execute on function app.agent_permission_revoke(uuid, uuid) to kaname_app;
create or replace function app.agent_set_default_mode(p_member uuid, p_mode text) returns boolean
language plpgsql security definer set search_path = public, app as $$
begin
  if p_mode not in ('manual', 'acceptEdits', 'auto', 'plan') then return false; end if;   -- 全部許可は既定にできない
  update members set agent_permission_mode = p_mode where id = p_member; return found;
end $$;
grant execute on function app.agent_set_default_mode(uuid, text) to kaname_app;

-- 使用量（D-104.16）
create or replace function app.agent_usage(p_member uuid) returns jsonb
language sql security definer set search_path = public, app as $$
  select coalesce(jsonb_object_agg(u.window_id, jsonb_build_object('utilization', u.utilization, 'resets_at', u.resets_at, 'observed_at', u.observed_at)), '{}'::jsonb)
    from agent_usage_snapshots u where u.member_id = p_member and u.deleted_at is null
$$;
grant execute on function app.agent_usage(uuid) to kaname_app;

-- 会話のいま（0035 を置き換え・D-104）：会話の名前と印・書きながらの返事・作業の行（1 行・手順・道具・経過）・順番待ち・使用量
create or replace function app.agent_state(p_member uuid, p_conv uuid)
returns jsonb language plpgsql security definer set search_path = public, app as $$
declare v_id uuid; c conversations%rowtype; v_msgs jsonb; v_stopped jsonb; r bridge_jobs%rowtype; v_asking jsonb;
        v_tools jsonb; v_plan jsonb; v_status text; v_queued jsonb;
begin
  if p_conv is not null then
    select * into c from conversations x where x.id = p_conv and x.owner_member_id = p_member and x.deleted_at is null;
  else
    select * into c from conversations x where x.owner_member_id = p_member and x.closed_at is null and x.deleted_at is null
      order by x.updated_at desc limit 1;
  end if;
  v_id := c.id;
  if v_id is null then
    return jsonb_build_object('conversation_id', null, 'conversation', null, 'messages', '[]'::jsonb, 'running_job_id', null, 'stopped', null,
                              'progress', '[]'::jsonb, 'asking', null, 'work', null, 'queued', '[]'::jsonb, 'usage', app.agent_usage(p_member));
  end if;
  select coalesce(jsonb_agg(x order by x->>'at'), '[]'::jsonb) into v_msgs from (
    select jsonb_build_object(
             'id', m.id,
             'who', case when m.kind = 'human' then 'me' when m.kind = 'stopped' then 'stopped' when m.kind = 'note' then 'note' else 'ai' end,
             'text', coalesce(m.body, ''), 'at', m.created_at, 'job_id', m.job_id,
             'quote', m.quote, 'work', m.work, 'attachments', m.attachments, 'send_state', m.send_state) as x
      from messages m where m.conversation_id = v_id and m.deleted_at is null
      order by m.created_at desc limit 200
  ) t;
  select * into r from bridge_jobs j
    where j.conversation_id = v_id and j.member_id = p_member and j.state_id in ('running', 'asking') and j.deleted_at is null
    order by j.created_at limit 1;
  if r.id is not null then
    select coalesce(jsonb_agg(x order by x->>'at'), '[]'::jsonb) into v_tools from (
      select jsonb_build_object('at', e.created_at, 'name', e.payload->>'name', 'target', e.payload->>'target', 'ok', (e.payload->>'ok')::boolean, 'ms', (e.payload->>'ms')::int) as x
        from bridge_job_events e where e.job_id = r.id and e.kind = 'tool' order by e.created_at desc limit 20) t;
    select e.payload->'todos' into v_plan from bridge_job_events e where e.job_id = r.id and e.kind = 'plan' order by e.created_at desc limit 1;
    select e.payload->>'text' into v_status from bridge_job_events e where e.job_id = r.id and e.kind in ('status', 'progress') order by e.created_at desc limit 1;
    select jsonb_build_object('job_id', e.job_id, 'request_id', e.request_id, 'tool', e.payload->>'tool',
                              'summary', e.payload->>'summary', 'input', e.payload->'input', 'at', e.created_at, 'by', e.payload->>'by') into v_asking
      from bridge_job_events e
     where e.job_id = r.id and r.state_id = 'asking' and e.kind = 'ask'
       and not exists (select 1 from bridge_job_events a where a.job_id = e.job_id and a.kind = 'answer' and a.request_id = e.request_id)
     order by e.created_at desc limit 1;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('job_id', j.id, 'text', (select m.body from messages m where m.job_id = j.id and m.kind = 'human' order by m.created_at limit 1)) order by j.created_at), '[]'::jsonb)
    into v_queued from bridge_jobs j
   where j.conversation_id = v_id and j.member_id = p_member and j.state_id = 'queued' and j.deleted_at is null
     and (r.id is not null);
  -- 止まったもの：いちばん新しい仕事が止まっていて、その後に何も言っていないときだけ（言えば次で決まる・D-104.15）
  select jsonb_build_object('job_id', j.id, 'reason', coalesce(j.stopped_reason, '理由は分かりません')) into v_stopped
    from bridge_jobs j
   where j.conversation_id = v_id and j.member_id = p_member and j.deleted_at is null
   order by j.created_at desc limit 1;
  if v_stopped is not null and not exists (select 1 from bridge_jobs j where j.id = (v_stopped->>'job_id')::uuid and j.state_id = 'stopped') then
    v_stopped := null;
  end if;
  return jsonb_build_object(
    'conversation_id', v_id,
    'conversation', jsonb_build_object('id', c.id, 'title', coalesce(c.title, '新しい会話'), 'starred', c.starred_at is not null, 'incognito', c.incognito),
    'messages', v_msgs,
    'running_job_id', coalesce(r.id, (select j.id from bridge_jobs j where j.conversation_id = v_id and j.member_id = p_member and j.state_id = 'queued' and j.deleted_at is null order by j.created_at limit 1)),
    'stopped', v_stopped,
    'progress', case when v_status is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object('at', now(), 'text', v_status)) end,
    'asking', v_asking,
    'work', case when r.id is null then null else jsonb_build_object(
              'job_id', r.id, 'state', r.state_id, 'started_at', r.started_at,
              'elapsed_ms', floor(extract(epoch from (now() - coalesce(r.started_at, now()))) * 1000),
              'status', v_status, 'plan', v_plan, 'tools', coalesce(v_tools, '[]'::jsonb), 'partial', r.partial,
              'stopping', r.stop_requested_at is not null, 'permission_mode', r.permission_mode) end,
    'queued', v_queued,
    'usage', app.agent_usage(p_member));
end $$;
grant execute on function app.agent_state(uuid, uuid) to kaname_app;

-- 資料（D-104.11）：置き場に置いた後に行を作る。持ち主は本人・まだどの吹き出しにも付いていない
create or replace function app.agent_attachment_new(p_member uuid, p_storage_ref text, p_name text, p_mime text, p_size bigint) returns uuid
language plpgsql security definer set search_path = public, app as $$
declare v_tenant uuid; v_scope uuid; v_id uuid;
begin
  select tenant_id, scope_id into v_tenant, v_scope from members where id = p_member and deleted_at is null;
  if v_tenant is null then return null; end if;
  insert into attachments (tenant_id, scope_id, owner_type, owner_id, storage_ref, mime, size, name, uploaded_by, created_by)
    values (v_tenant, v_scope, 'message', null, p_storage_ref, left(coalesce(p_mime, 'application/octet-stream'), 120), p_size, left(coalesce(p_name, '資料'), 200), p_member, p_member)
    returning id into v_id;
  return v_id;
end $$;
grant execute on function app.agent_attachment_new(uuid, text, text, text, bigint) to kaname_app;
-- Bridge が仕事の資料の置き場を引く（その仕事に付いたものだけ）
create or replace function app.bridge_attachment(p_session uuid, p_job uuid, p_attachment uuid) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v_member uuid; v jsonb;
begin
  select member_id into v_member from sessions where id = p_session and kind_id = 'bridge' and revoked_at is null;
  if v_member is null then return null; end if;
  select jsonb_build_object('storage_ref', a.storage_ref, 'name', a.name, 'mime', a.mime, 'size', a.size, 'tenant_id', a.tenant_id) into v
    from bridge_jobs j join attachments a on a.id = p_attachment and a.id = any(coalesce(j.attachment_ids, '{}'))
   where j.id = p_job and j.member_id = v_member and j.state_id in ('running', 'asking');
  return v;
end $$;
grant execute on function app.bridge_attachment(uuid, uuid, uuid) to kaname_app;
