-- 0027 Bridge が仕事を受け取って返す（D-090・T-B-03）＋ 自己診断の報告 ＋ 生存の知らせ。
-- 文脈（会話の続き）は本人の Claude Code が持つ。Kaname が二重に持たない。Kaname が持つのは
--   ・会話の正本（既存 conversations／messages。3 層で整理：D-062）
--   ・会話 ↔ Claude の session_id の対応（この migration で足す 1 列）
--   ・仕事の並び（誰が・何を・いまどうなっているか）
-- 止まったものは自動で再開しない（D-090）。人が 続きから／やり直す／やめる を選ぶまで止まったまま。

-- 既存の会話に足す（新しい表は作らない）
alter table conversations add column if not exists agent_session_id text;          -- Claude Code の session。文脈の本体はここ
alter table conversations add column if not exists branched_from_message_id uuid references messages(id); -- 「ここから分岐」（D-066）
alter table conversations add column if not exists owner_member_id uuid references members(id);           -- 誰の自分のAIとの会話か
alter table conversations add column if not exists closed_at timestamptz;          -- 「新しい会話」を押すと閉じる（D-062）
create index if not exists conversations_open_idx on conversations (owner_member_id) where closed_at is null and deleted_at is null;

-- 仕事の並び（Bridge が取りに来る）。止まったものは stopped のまま残す
create table if not exists bridge_job_states (key text primary key, label text not null);
insert into bridge_job_states (key, label) values
  ('queued', '待っている'), ('running', '動いている'), ('done', '終わった'),
  ('stopped', '止まった（人が選ぶまでそのまま）'), ('cancelled', 'やめた')
on conflict do nothing;

create table if not exists bridge_jobs (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id),
  scope_id uuid references scopes(id),
  member_id uuid not null references members(id),
  conversation_id uuid references conversations(id),
  state_id text not null default 'queued' references bridge_job_states(key),
  prompt text not null,
  agent_session_id text,
  result text,
  stopped_reason text,              -- なぜ止まったか。そのまま人に見せる文
  started_at timestamptz, finished_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz
);
create index if not exists bridge_jobs_queue_idx on bridge_jobs (member_id, state_id, created_at);
drop trigger if exists bridge_jobs_updated_at on bridge_jobs; create trigger bridge_jobs_updated_at before update on bridge_jobs for each row execute function app.set_updated_at();
insert into target_kinds (key, label) values ('bridge_jobs', 'Bridge の仕事') on conflict do nothing;

-- 自己診断の報告（Bridge の中で完結させず Kaname に返す・D-090）
alter table sessions add column if not exists health jsonb;
alter table sessions add column if not exists health_at timestamptz;

-- 生存の知らせ：最後の応答を本当に動かす
create or replace function app.bridge_heartbeat(p_session uuid, p_health jsonb) returns boolean
language plpgsql security definer set search_path = public, app as $$
declare n int;
begin
  update sessions set last_seen_at = now(),
         health = coalesce(p_health, health), health_at = case when p_health is null then health_at else now() end
    where id = p_session and kind_id = 'bridge' and revoked_at is null;
  get diagnostics n = row_count; return n > 0;
end $$;
grant execute on function app.bridge_heartbeat(uuid, jsonb) to kaname_app;

-- 仕事を 1 件取る（同じ 1 件を 2 つの Bridge が取らない）
create or replace function app.bridge_take_job(p_session uuid)
returns table (job_id uuid, prompt text, agent_session_id text, conversation_id uuid)
language plpgsql security definer set search_path = public, app as $$
declare v_member uuid;
begin
  select member_id into v_member from sessions where id = p_session and kind_id = 'bridge' and revoked_at is null;
  if v_member is null then return; end if;
  return query
    update bridge_jobs j set state_id = 'running', started_at = now()
     where j.id = (select x.id from bridge_jobs x
                    where x.member_id = v_member and x.state_id = 'queued' and x.deleted_at is null
                    order by x.created_at limit 1 for update skip locked)
    returning j.id, j.prompt, j.agent_session_id, j.conversation_id;
end $$;
grant execute on function app.bridge_take_job(uuid) to kaname_app;

-- 仕事の結末を書き、会話の中にも出す。止まったものは stopped のまま置く（自動で戻さない・D-090）
create or replace function app.bridge_finish_job(p_session uuid, p_job uuid, p_state text, p_result text, p_reason text, p_agent_session text)
returns boolean language plpgsql security definer set search_path = public, app as $$
declare v_member uuid; v_conv uuid; n int;
begin
  select member_id into v_member from sessions where id = p_session and kind_id = 'bridge' and revoked_at is null;
  if v_member is null then return false; end if;
  if p_state not in ('done', 'stopped', 'cancelled') then raise exception '結末は done／stopped／cancelled'; end if;
  update bridge_jobs set state_id = p_state, result = p_result, stopped_reason = p_reason,
         agent_session_id = coalesce(p_agent_session, agent_session_id), finished_at = now()
    where id = p_job and member_id = v_member returning conversation_id into v_conv;
  get diagnostics n = row_count; if n = 0 then return false; end if;
  if v_conv is not null and p_agent_session is not null then
    update conversations set agent_session_id = p_agent_session where id = v_conv and agent_session_id is distinct from p_agent_session;
  end if;
  if v_conv is not null then   -- 止まったことも無言にしない（D-090）
    insert into messages (tenant_id, conversation_id, body, kind)
    select c.tenant_id, c.id,
           case when p_state = 'done' then coalesce(p_result, '')
                when p_state = 'stopped' then 'ここで止まりました。' || coalesce(p_reason, '理由は分かりません') || '　続きから／最初からやり直す／やめる を選んでください。'
                else 'やめました。' end,
           case when p_state = 'done' then 'ai' else 'stopped' end
      from conversations c where c.id = v_conv;
  end if;
  return true;
end $$;
grant execute on function app.bridge_finish_job(uuid, uuid, text, text, text, text) to kaname_app;

-- 人が選び直す（続きから／やり直す／やめる）。選んだ事実は仕事の行に残る（D-090・証跡は「何をしたか」だけ）
create or replace function app.bridge_resume_job(p_member uuid, p_job uuid, p_how text) returns uuid
language plpgsql security definer set search_path = public, app as $$
declare v bridge_jobs%rowtype; v_new uuid;
begin
  select * into v from bridge_jobs where id = p_job and member_id = p_member and state_id = 'stopped';
  if v.id is null then return null; end if;
  if p_how = 'cancel' then
    update bridge_jobs set state_id = 'cancelled', finished_at = now() where id = p_job; return p_job;
  elsif p_how in ('continue', 'restart') then
    insert into bridge_jobs (tenant_id, scope_id, member_id, conversation_id, prompt, agent_session_id, created_by)
      values (v.tenant_id, v.scope_id, v.member_id, v.conversation_id, v.prompt,
              case when p_how = 'continue' then v.agent_session_id else null end, p_member)
      returning id into v_new;
    update bridge_jobs set state_id = 'cancelled', finished_at = now() where id = p_job;
    return v_new;
  end if;
  raise exception '選び方は continue／restart／cancel';
end $$;
grant execute on function app.bridge_resume_job(uuid, uuid, text) to kaname_app;
