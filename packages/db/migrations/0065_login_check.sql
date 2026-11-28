-- 0065 ログイン情報を預けたらその場で 1 回ログインだけ試す（T-B-38・D-117.1・D-017.1・D-117.6）。
--   預けた直後に Bridge の仕事（kind 'login_check'）を 1 件積む。Bridge が専用のブラウザで 1 回だけ入り、入れたらそのまま出て、結果を預けたものの行に書く。
--   規約で禁止・銀行のサービスは試さない（結果 forbidden）。Bridge が 1 台も無ければ積まない（結果 no_bridge）。何度も試さない（1 件につき 1 回）
alter table bridge_jobs add column if not exists kind text not null default 'chat';
alter table bridge_jobs drop constraint if exists bridge_jobs_kind_check;
alter table bridge_jobs add constraint bridge_jobs_kind_check check (kind in ('chat', 'login_check'));
alter table bridge_jobs add column if not exists credential_id uuid references credentials(id);

alter table credentials add column if not exists login_check_state text;
alter table credentials drop constraint if exists credentials_login_check_state_check;
alter table credentials add constraint credentials_login_check_state_check
  check (login_check_state is null or login_check_state in ('pending', 'running', 'ok', 'bad_password', 'needs_2fa', 'captcha', 'forbidden', 'unreachable', 'no_form', 'no_bridge', 'stopped'));
alter table credentials add column if not exists login_check_detail text;
alter table credentials add column if not exists login_check_at timestamptz;

-- 預けた直後に積む。本人の資格情報だけ。禁止・銀行は試さない。Bridge の端末が無ければ積まない（つないだときに預け直す）
create or replace function app.credential_login_check_enqueue(p_member uuid, p_credential uuid) returns uuid
language plpgsql security definer set search_path = public, app as $$
declare c credentials%rowtype; v_verdict text; v_job uuid;
begin
  select * into c from credentials where id = p_credential and owner_member_id = p_member and deleted_at is null and revoked_at is null;
  if c.id is null then return null; end if;
  select s.automation_verdict_id into v_verdict from service_registry s where s.id = c.service_id and s.deleted_at is null;
  if v_verdict in ('forbidden', 'bank') then
    update credentials set login_check_state = 'forbidden', login_check_detail = '規約で自動操作が禁止のサービスなので、ログインは試しません', login_check_at = now() where id = c.id;
    return null;
  end if;
  if not exists (select 1 from sessions s where s.member_id = p_member and s.kind_id = 'bridge' and s.revoked_at is null and s.deleted_at is null) then
    update credentials set login_check_state = 'no_bridge', login_check_detail = 'PC をつないでから預け直すと、1 回だけログインを試します', login_check_at = now() where id = c.id;
    return null;
  end if;
  insert into bridge_jobs (tenant_id, scope_id, member_id, conversation_id, prompt, created_by, browser, kind, credential_id)
    values (c.tenant_id, c.scope_id, p_member, null, '', p_member, 'dedicated', 'login_check', c.id)
    returning id into v_job;
  update credentials set login_check_state = 'pending', login_check_detail = null, login_check_at = now() where id = c.id;
  return v_job;
end $$;
grant execute on function app.credential_login_check_enqueue(uuid, uuid) to kaname_app;

-- 仕事を取る：種類と資格情報の id も渡す（Bridge が AI を起こさずに自分でログインを試す）。取った時点で「試しています」
drop function if exists app.bridge_take_job(uuid);
create function app.bridge_take_job(p_session uuid)
returns table (job_id uuid, prompt text, agent_session_id text, conversation_id uuid,
               permission_mode text, model text, effort text, tools text[], allowed_tools text[], attachments jsonb,
               kind text, credential_id uuid)
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
  update credentials c set login_check_state = 'running', login_check_at = now()
   where c.id = (select j.credential_id from bridge_jobs j where j.id = v_job and j.kind = 'login_check') and c.login_check_state = 'pending';
  return query
    select j.id, j.prompt, j.agent_session_id, j.conversation_id, j.permission_mode, j.model, j.effort, j.tools,
           coalesce((select array_agg(r.tool || case when coalesce(r.target_pattern, '') = '' then '' else '(' || r.target_pattern || ')' end)
                       from permission_rules r where r.member_id = v_member and r.decision_id = 'allow' and r.revoked_at is null and r.deleted_at is null), '{}'),
           coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'mime', a.mime, 'size', a.size))
                       from attachments a where a.id = any(coalesce(j.attachment_ids, '{}'))), '[]'::jsonb),
           j.kind, j.credential_id
      from bridge_jobs j where j.id = v_job;
end $$;
grant execute on function app.bridge_take_job(uuid) to kaname_app;

-- 結果を書く：本人の Bridge・その Bridge が取った動いている仕事・その仕事の資格情報、のときだけ。仕事も同時に閉じる（1 回で終わり）
create or replace function app.bridge_login_check_result(p_session uuid, p_job uuid, p_state text, p_detail text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v_member uuid; j bridge_jobs%rowtype;
begin
  select member_id into v_member from sessions where id = p_session and kind_id = 'bridge' and revoked_at is null;
  if v_member is null then return null; end if;
  if p_state not in ('ok', 'bad_password', 'needs_2fa', 'captcha', 'unreachable', 'no_form', 'stopped') then
    raise exception 'ログインの結果は ok／bad_password／needs_2fa／captcha／unreachable／no_form／stopped';
  end if;
  select * into j from bridge_jobs where id = p_job and member_id = v_member and kind = 'login_check' and state_id in ('running', 'asking') and deleted_at is null;
  if j.id is null then return null; end if;
  update credentials set login_check_state = p_state, login_check_detail = left(p_detail, 400), login_check_at = now() where id = j.credential_id;
  update bridge_jobs set state_id = case when p_state = 'stopped' then 'stopped' else 'done' end,
         result = case when p_state <> 'stopped' then p_state end,
         stopped_reason = case when p_state = 'stopped' then left(p_detail, 400) end,
         finished_at = now()
   where id = j.id;
  return jsonb_build_object('tenant_id', j.tenant_id, 'member_id', j.member_id, 'credential_id', j.credential_id);
end $$;
grant execute on function app.bridge_login_check_result(uuid, uuid, text, text) to kaname_app;

-- Bridge が途中で止まった（残りの後始末・本人が止めた）ときは、行にも「止まった」を出す（黙って「試しています」のままにしない・G-15）
create or replace function app.login_check_job_stopped() returns trigger
language plpgsql security definer set search_path = public, app as $$
begin
  if new.kind = 'login_check' and new.state_id in ('stopped', 'cancelled') and old.state_id in ('queued', 'running', 'asking') then
    update credentials set login_check_state = 'stopped',
           login_check_detail = 'PC の Bridge が途中で止まったので、ログインは試せませんでした。預け直すともう一度試します',
           login_check_at = now()
     where id = new.credential_id and login_check_state in ('pending', 'running');
  end if;
  return new;
end $$;
drop trigger if exists bridge_jobs_login_check_stopped on bridge_jobs;
create trigger bridge_jobs_login_check_stopped after update of state_id on bridge_jobs for each row execute function app.login_check_job_stopped();

-- 一覧（D-108.3）に、1 回のログインの結果を足す（中身は返さない）
create or replace function app.my_credentials(p_member uuid) returns jsonb
language sql stable security definer set search_path = public, app as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id,
           'service_name', coalesce(nullif(c.service_name, ''), s.name, '（名前なし）'),
           'service_domain', coalesce(nullif(c.service_domain, ''), s.domain, ''),
           'verdict', coalesce(s.automation_verdict_id, 'unspecified'),
           'kind', c.kind_id,
           'state', case when c.revoked_at is not null then 'revoked' when c.kind_id like 'oauth%' then 'connected' else 'stored' end,
           'ref_tail', right(c.vault_ref, 6),
           'login_check', case when c.login_check_state is null then null
                               else jsonb_build_object('state', c.login_check_state, 'detail', c.login_check_detail, 'at', c.login_check_at) end,
           'created_at', c.created_at) order by c.created_at), '[]'::jsonb)
    from credentials c left join service_registry s on s.id = c.service_id
   where c.owner_member_id = p_member and c.deleted_at is null
$$;
grant execute on function app.my_credentials(uuid) to kaname_app;

-- 鍵の受け取り（0064）に宛先を足す：Bridge が開く先（service_name が URL ならそれ・無ければ domain）。返す列が増えるので作り直す
drop function if exists app.bridge_credential(uuid, uuid, uuid);
create function app.bridge_credential(p_session uuid, p_job uuid, p_credential uuid)
returns table (tenant_id uuid, member_id uuid, vault_ref text, service_name text, service_domain text, revoked boolean, job_ok boolean)
language plpgsql security definer set search_path = public, app as $$
declare v_member uuid; v_tenant uuid;
begin
  select s.member_id, s.tenant_id into v_member, v_tenant
    from sessions s where s.id = p_session and s.kind_id = 'bridge' and s.revoked_at is null;
  if v_member is null then return; end if;
  return query
    select c.tenant_id, c.owner_member_id, c.vault_ref, c.service_name, c.service_domain, (c.revoked_at is not null) as revoked,
           exists (select 1 from bridge_jobs j where j.id = p_job and j.member_id = v_member and j.state_id in ('running', 'asking') and j.deleted_at is null) as job_ok
      from credentials c
     where c.id = p_credential and c.tenant_id = v_tenant and c.owner_member_id = v_member and c.deleted_at is null;
end $$;
grant execute on function app.bridge_credential(uuid, uuid, uuid) to kaname_app;
