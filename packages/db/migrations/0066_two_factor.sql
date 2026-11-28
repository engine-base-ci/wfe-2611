-- 0066 2 段階認証（T-B-39・D-117.2〜D-117.5・D-017.2・D-017.4）。
--   預けるときに種類を選ぶ（なし／認証アプリ／SMS／メール／スマホで承認）。認証アプリは鍵から Bridge が 6 桁を作る。
--   SMS・メール・スマホ承認は、Bridge がコードの画面で止まって本人に頼む（仕事は asking）。入れたコードは Bridge だけに渡る：
--   答えの行に一時的に置き、Bridge が取った時点で消す（会話・証跡・一覧に出ない）。10 分返事が無ければ no_answer で止め、本人が「もう一度試す」を押したときだけ回す
alter table credentials add column if not exists two_factor_id text not null default 'none';
alter table credentials drop constraint if exists credentials_two_factor_check;
alter table credentials add constraint credentials_two_factor_check check (two_factor_id in ('none', 'totp', 'sms', 'email', 'push'));
alter table credentials drop constraint if exists credentials_login_check_state_check;
alter table credentials add constraint credentials_login_check_state_check
  check (login_check_state is null or login_check_state in ('pending', 'running', 'ok', 'bad_password', 'needs_2fa', 'bad_code', 'captcha', 'forbidden', 'unreachable', 'no_form', 'no_bridge', 'stopped', 'no_answer'));

-- 鍵の受け取りに 2 段階の種類を足す（Bridge が「頼むか・作るか」を決める）
drop function if exists app.bridge_credential(uuid, uuid, uuid);
create function app.bridge_credential(p_session uuid, p_job uuid, p_credential uuid)
returns table (tenant_id uuid, member_id uuid, vault_ref text, service_name text, service_domain text, two_factor text, revoked boolean, job_ok boolean)
language plpgsql security definer set search_path = public, app as $$
declare v_member uuid; v_tenant uuid;
begin
  select s.member_id, s.tenant_id into v_member, v_tenant
    from sessions s where s.id = p_session and s.kind_id = 'bridge' and s.revoked_at is null;
  if v_member is null then return; end if;
  return query
    select c.tenant_id, c.owner_member_id, c.vault_ref, c.service_name, c.service_domain, c.two_factor_id, (c.revoked_at is not null) as revoked,
           exists (select 1 from bridge_jobs j where j.id = p_job and j.member_id = v_member and j.state_id in ('running', 'asking') and j.deleted_at is null) as job_ok
      from credentials c
     where c.id = p_credential and c.tenant_id = v_tenant and c.owner_member_id = v_member and c.deleted_at is null;
end $$;
grant execute on function app.bridge_credential(uuid, uuid, uuid) to kaname_app;

-- 結果の種類に bad_code（認証アプリ／入れたコードが通らなかった）と no_answer（10 分返事が無かった）を足す
create or replace function app.bridge_login_check_result(p_session uuid, p_job uuid, p_state text, p_detail text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v_member uuid; j bridge_jobs%rowtype;
begin
  select member_id into v_member from sessions where id = p_session and kind_id = 'bridge' and revoked_at is null;
  if v_member is null then return null; end if;
  if p_state not in ('ok', 'bad_password', 'needs_2fa', 'bad_code', 'captcha', 'unreachable', 'no_form', 'stopped', 'no_answer') then
    raise exception 'ログインの結果は ok／bad_password／needs_2fa／bad_code／captcha／unreachable／no_form／stopped／no_answer';
  end if;
  select * into j from bridge_jobs where id = p_job and member_id = v_member and kind = 'login_check' and state_id in ('running', 'asking') and deleted_at is null;
  if j.id is null then return null; end if;
  update credentials set login_check_state = p_state, login_check_detail = left(p_detail, 400), login_check_at = now() where id = j.credential_id;
  update bridge_jobs set state_id = case when p_state in ('stopped', 'no_answer') then 'stopped' else 'done' end,
         result = case when p_state not in ('stopped', 'no_answer') then p_state end,
         stopped_reason = case when p_state in ('stopped', 'no_answer') then left(p_detail, 400) end,
         finished_at = now()
   where id = j.id;
  return jsonb_build_object('tenant_id', j.tenant_id, 'member_id', j.member_id, 'credential_id', j.credential_id);
end $$;
grant execute on function app.bridge_login_check_result(uuid, uuid, text, text) to kaname_app;

-- 止まったときの引き金：Bridge が自分で no_answer を書いた後は上書きしない（login_check_state が pending／running のときだけ）
-- （0065 の app.login_check_job_stopped のまま）

-- もう一度試す（D-117.5「次に本人がいる時間に回す」）：本人が押したときだけ。試している最中・コードを待っている最中は積まない
create or replace function app.credential_login_check_retry(p_member uuid, p_credential uuid) returns uuid
language plpgsql security definer set search_path = public, app as $$
declare c credentials%rowtype;
begin
  select * into c from credentials where id = p_credential and owner_member_id = p_member and deleted_at is null and revoked_at is null;
  if c.id is null then return null; end if;
  if c.login_check_state in ('pending', 'running') then return null; end if;
  if exists (select 1 from bridge_jobs j where j.credential_id = c.id and j.kind = 'login_check' and j.state_id in ('queued', 'running', 'asking') and j.deleted_at is null) then return null; end if;
  return app.credential_login_check_enqueue(p_member, p_credential);
end $$;
grant execute on function app.credential_login_check_retry(uuid, uuid) to kaname_app;

-- 本人がコードを入れる／スマホで承認したと知らせる（D-117.3）。コードは答えの行に一時的に置く。Bridge が取った時点で消す
create or replace function app.agent_answer_code(p_member uuid, p_credential uuid, p_request_id text, p_code text) returns boolean
language plpgsql security definer set search_path = public, app as $$
declare j bridge_jobs%rowtype; a bridge_job_events%rowtype;
begin
  select * into j from bridge_jobs where credential_id = p_credential and member_id = p_member and kind = 'login_check' and state_id = 'asking' and deleted_at is null
   order by created_at desc limit 1;
  if j.id is null then return false; end if;
  select * into a from bridge_job_events where job_id = j.id and kind = 'ask' and request_id = p_request_id order by created_at desc limit 1;
  if a.id is null then return false; end if;
  if exists (select 1 from bridge_job_events where job_id = j.id and kind = 'answer' and request_id = p_request_id) then return true; end if;
  insert into bridge_job_events (tenant_id, scope_id, member_id, job_id, kind, request_id, payload, created_by)
    values (j.tenant_id, j.scope_id, j.member_id, j.id, 'answer', p_request_id, jsonb_build_object('allow', true, 'code', p_code), p_member);
  update bridge_jobs set state_id = 'running' where id = j.id;
  -- 証跡：答えたこと（何を答えたかは書かない）
  insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
    values (j.tenant_id, p_member, 'member', 'credential.two_factor_answered', 'credentials', j.credential_id::text, 'C6',
            jsonb_build_object('request_id', p_request_id, 'job_id', j.id, 'kind', a.payload->>'tool'), p_member);
  return true;
end $$;
grant execute on function app.agent_answer_code(uuid, uuid, text, text) to kaname_app;

-- Bridge がコードを取る。取った時点で答えの行から消す（記録に残さない）。無ければ null
create or replace function app.bridge_take_code(p_session uuid, p_job uuid, p_request_id text) returns text
language plpgsql security definer set search_path = public, app as $$
declare v_member uuid; v_id uuid; v_code text;
begin
  select member_id into v_member from sessions where id = p_session and kind_id = 'bridge' and revoked_at is null;
  if v_member is null then return null; end if;
  select e.id, e.payload->>'code' into v_id, v_code from bridge_job_events e join bridge_jobs j on j.id = e.job_id
   where e.job_id = p_job and j.member_id = v_member and j.kind = 'login_check' and e.kind = 'answer' and e.request_id = p_request_id
   order by e.created_at desc limit 1;
  if v_id is null then return null; end if;
  if v_code is null then return null; end if;   -- もう取った（二度は渡さない）
  update bridge_job_events set payload = (payload - 'code') || jsonb_build_object('taken', true, 'taken_at', now()) where id = v_id;
  return v_code;
end $$;
grant execute on function app.bridge_take_code(uuid, uuid, text) to kaname_app;

-- 一覧（D-108.3）：2 段階の種類と、いま本人に頼んでいること（コードを入れる／スマホで承認）を足す
create or replace function app.my_credentials(p_member uuid) returns jsonb
language sql stable security definer set search_path = public, app as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id,
           'service_name', coalesce(nullif(c.service_name, ''), s.name, '（名前なし）'),
           'service_domain', coalesce(nullif(c.service_domain, ''), s.domain, ''),
           'verdict', coalesce(s.automation_verdict_id, 'unspecified'),
           'kind', c.kind_id,
           'two_factor', c.two_factor_id,
           'state', case when c.revoked_at is not null then 'revoked' when c.kind_id like 'oauth%' then 'connected' else 'stored' end,
           'ref_tail', right(c.vault_ref, 6),
           'login_check', case when c.login_check_state is null then null
                               else jsonb_build_object('state', c.login_check_state, 'detail', c.login_check_detail, 'at', c.login_check_at) end,
           'asking', (select jsonb_build_object('request_id', e.request_id, 'kind', case when e.payload->>'tool' = 'TwoFactorApprove' then 'approve' else 'code' end, 'text', e.payload->>'summary')
                        from bridge_job_events e join bridge_jobs j on j.id = e.job_id
                       where j.credential_id = c.id and j.kind = 'login_check' and j.state_id = 'asking' and j.deleted_at is null and e.kind = 'ask'
                         and not exists (select 1 from bridge_job_events x where x.job_id = j.id and x.kind = 'answer' and x.request_id = e.request_id)
                       order by e.created_at desc limit 1),
           'created_at', c.created_at) order by c.created_at), '[]'::jsonb)
    from credentials c left join service_registry s on s.id = c.service_id
   where c.owner_member_id = p_member and c.deleted_at is null
$$;
grant execute on function app.my_credentials(uuid) to kaname_app;
