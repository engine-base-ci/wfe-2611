-- 20261119120600_credential_login_check 預けた後のログインの確かめの口（K-355・契約の口 checkCredentialLogin・answerCredentialLoginCheck・reportCredentialCheck・D-117・関門 C2）
--   前の道すじの関数（0065 の credential_login_check_enqueue・0066 の credential_login_check_retry／agent_answer_code／bridge_take_code、
--   0065・0066 の bridge_login_check_result）の中身を、契約の口が呼ぶ関数へ移す。前の関数は消さない（前の道すじは K-358 まで今のまま動く）。
--   ① app.credential_check_start   ：もう一度確かめる（積む判定と積み方の 1 か所。④ ⑤ も同じ物を呼ぶ）
--   ② app.credential_check_answer  ：確かめの途中で PC が頼んだコード（か「スマホで承認した」）を置く
--   ③ app.bridge_credential_check_report：PC が途中（頼む・答えを待つ）と結果を知らせる
--   ④ app.credential_login_check_enqueue（預ける口 K-352 が預けた直後に呼ぶ）を ① と同じ判定・同じ開く先で積む形に作り直す
--   ⑤ PC が初めて生きている扱いになった時（sessions.alive_at が初めて入る）に、まだ確かめていない（no_bridge）物へ積む引き金
--   開く先は app.credential_check_target 1 つで決める（使える場所のうち *. で始まらない 1 つ目の https://<名前>/）。
--   外に影響する手順は、どれも 1 つの関数（1 つの取引）の中で、証跡も同じ取引に書く。コードは答えの行に一時的に置き、PC が取った時点で消す（D-117.3）

-- 開く先：使える場所のうち *. で始まらない 1 つ目。無ければ null（*. の名前は下の名前だけに当たるので、*. を外した名前を開かない）
create or replace function app.credential_check_target(p_destinations text[]) returns text
language sql immutable security definer set search_path = public, app, pg_temp as $$
  select 'https://' || d || '/'
    from unnest(coalesce(p_destinations, '{}'::text[])) with ordinality as t(d, n)
   where d is not null and d <> '' and left(d, 2) <> '*.'
   order by n limit 1
$$;
revoke all on function app.credential_check_target(text[]) from public;
grant execute on function app.credential_check_target(text[]) to kaname_app;

-- ① もう一度確かめる。答えは {"state": pending|no_pc|forbidden|no_target, "job_id": …} か {"error": not_found|revoked|not_login|busy}
--   判定の順：本人の物 → 失効・期限切れ → ログインか → 確かめている最中か → 禁止のサービス → 開く先が決まるか → PC があるか
create or replace function app.credential_check_start(p_member uuid, p_credential uuid) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare c credentials%rowtype; v_verdict text; v_target text; v_job uuid;
begin
  select * into c from credentials where id = p_credential and owner_member_id = p_member and deleted_at is null for update;
  if c.id is null then return jsonb_build_object('error', 'not_found'); end if;
  if c.revoked_at is not null or (c.expires_at is not null and c.expires_at < now()) then return jsonb_build_object('error', 'revoked'); end if;
  if c.kind_id not in ('basic', 'password_totp', 'email_otp') then return jsonb_build_object('error', 'not_login'); end if;
  if exists (select 1 from bridge_jobs j where j.credential_id = c.id and j.kind = 'login_check'
                and j.state_id in ('queued', 'running', 'asking') and j.deleted_at is null) then
    return jsonb_build_object('error', 'busy');
  end if;
  -- 台帳の判定は、その会社の行か運営の共通の行だけを見る（ほかの会社が足した台帳の行に、名前の重なりで結ばれても効かせない）。
  --   使える場所を持つ物は、今の使える場所（*. を外した名前とその下の名前）で引く。上書きで使える場所を替えても service_id・service_domain は
  --   預けた時のままなので、それでは前のサービスで判定してしまう（K-353 からの知らせ）。使える場所の 1 つでも禁止・銀行に当たれば試さない。
  --   使える場所を持たない前の道すじの物だけ、預けた時に結んだ service_id で引く（K-358 まで）
  if cardinality(coalesce(c.destinations, '{}'::text[])) > 0 then
    select x.verdict into v_verdict
      from (select s.automation_verdict_id as verdict,
                   lower(regexp_replace(regexp_replace(coalesce(s.domain, ''), '^[a-z]+://', '', 'i'), '^www\.|/.*$', '', 'g')) as dom
              from service_registry s
             where s.deleted_at is null and (s.tenant_id = c.tenant_id or s.tenant_id = app.ops_tenant_id())
               and s.automation_verdict_id in ('forbidden', 'bank')) x,
           (select lower(regexp_replace(d, '^\*\.', '')) as host from unnest(c.destinations) as t(d)) h
     where x.dom <> '' and (h.host = x.dom or right(h.host, length(x.dom) + 1) = '.' || x.dom)
     limit 1;
  else
    select s.automation_verdict_id into v_verdict from service_registry s
     where s.id = c.service_id and s.deleted_at is null and (s.tenant_id = c.tenant_id or s.tenant_id = app.ops_tenant_id());
  end if;
  if v_verdict in ('forbidden', 'bank') then
    update credentials set login_check_state = 'forbidden', login_check_detail = '規約で自動操作が禁止のサービスなので、ログインは試しません', login_check_at = now() where id = c.id;
    return jsonb_build_object('state', 'forbidden', 'job_id', null);
  end if;
  -- 使える場所を持つのに全部が *. で始まる物は、開く先を決められない（PC をつないでも決まらないので no_bridge にしない）。
  --   使える場所を 1 つも持たない物は前の道すじ（/api/auth-ext/vault/*）で預けた物だけで、前の積み方のまま開く先を空で積む（PC が service_name を開く・K-358 まで）
  v_target := app.credential_check_target(c.destinations);
  if v_target is null and cardinality(coalesce(c.destinations, '{}'::text[])) > 0 then
    update credentials set login_check_state = 'unreachable',
           login_check_detail = 'ログインの画面の名前（例：login.example.com）を使える場所に足してください', login_check_at = now()
     where id = c.id;
    return jsonb_build_object('state', 'no_target', 'job_id', null);
  end if;
  -- PC はアカウントのもの（D-128.150 ④）。つないだだけで、まだ生きている知らせを送っていない PC も数える
  if not exists (select 1 from sessions s where s.member_id in (select app.account_members(p_member))
                    and s.kind_id = 'bridge' and s.revoked_at is null and s.deleted_at is null) then
    update credentials set login_check_state = 'no_bridge',
           login_check_detail = 'PC をつないでいません。PC をつなぐと、自動で 1 回ログインを試します', login_check_at = now()
     where id = c.id;
    return jsonb_build_object('state', 'no_pc', 'job_id', null);
  end if;
  insert into bridge_jobs (tenant_id, scope_id, member_id, conversation_id, prompt, created_by, browser, kind, credential_id)
    values (c.tenant_id, c.scope_id, p_member, null, coalesce(v_target, ''), p_member, 'dedicated', 'login_check', c.id)
    returning id into v_job;
  update credentials set login_check_state = 'pending', login_check_detail = null, login_check_at = now() where id = c.id;
  return jsonb_build_object('state', 'pending', 'job_id', v_job);
end $$;
revoke all on function app.credential_check_start(uuid, uuid) from public;
grant execute on function app.credential_check_start(uuid, uuid) to kaname_app;

-- ② 頼まれたコードに答える。'ok'・'already'（同じ頼みに答え済み・前のコードを上書きしない）・'not_asked'・'not_found'。
--   答えの行・仕事を running・証跡（何を答えたかは書かない）を 1 つの取引で
create or replace function app.credential_check_answer(p_member uuid, p_credential uuid, p_request text, p_code text) returns text
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare c credentials%rowtype; j bridge_jobs%rowtype; a bridge_job_events%rowtype;
begin
  select * into c from credentials where id = p_credential and owner_member_id = p_member and deleted_at is null;
  if c.id is null then return 'not_found'; end if;
  select * into j from bridge_jobs where credential_id = c.id and kind = 'login_check' and state_id in ('running', 'asking') and deleted_at is null
   order by created_at desc limit 1 for update;
  if j.id is null then return 'not_asked'; end if;
  select * into a from bridge_job_events where job_id = j.id and kind = 'ask' and request_id = p_request order by created_at desc limit 1;
  if a.id is null then return 'not_asked'; end if;
  if exists (select 1 from bridge_job_events where job_id = j.id and kind = 'answer' and request_id = p_request) then return 'already'; end if;
  if j.state_id <> 'asking' then return 'not_asked'; end if;
  insert into bridge_job_events (tenant_id, scope_id, member_id, job_id, kind, request_id, payload, created_by)
    values (j.tenant_id, j.scope_id, j.member_id, j.id, 'answer', p_request, jsonb_build_object('allow', true, 'code', p_code), p_member);
  update bridge_jobs set state_id = 'running' where id = j.id;
  insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
    values (j.tenant_id, p_member, 'member', 'credential.two_factor_answered', 'credentials', c.id::text, 'C6',
            jsonb_build_object('request_id', p_request, 'job_id', j.id, 'kind', a.payload->>'tool'), p_member);
  return 'ok';
end $$;
revoke all on function app.credential_check_answer(uuid, uuid, text, text) from public;
grant execute on function app.credential_check_answer(uuid, uuid, text, text) to kaname_app;

-- ③ PC が途中と結果を知らせる。仕事はその PC が取った（か、アカウントの誰も取っていない）確かめの仕事で、道の id と同じ情報の物だけ。
--   答えは {"code": …} か {"error": not_found|not_running}。
--   asking：頼みの行を同じ request_id で 1 つだけ・仕事を asking（行の state は変えない）
--   waiting：答えの行があればコードを返して行から消す（taken）。無ければ null
--   結果の 9 種：行の state・文（400 字まで）・時刻、仕事を done（result）か stopped（stopped_reason）、証跡（job_id と state だけ）
create or replace function app.bridge_credential_check_report(p_session uuid, p_job uuid, p_credential uuid, p_state text, p_detail text,
                                                              p_request text, p_ask_kind text, p_text text) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare j bridge_jobs%rowtype; v_id uuid; v_code text;
begin
  select * into j from bridge_jobs where id = app.bridge_job_of(p_session, p_job) for update;
  if j.id is null or j.kind <> 'login_check' or j.credential_id is distinct from p_credential then
    return jsonb_build_object('error', 'not_found');
  end if;
  if j.state_id not in ('running', 'asking') then return jsonb_build_object('error', 'not_running'); end if;
  if p_state = 'asking' then
    if p_request is null or p_request = '' then raise exception '頼みには request_id が要る' using errcode = '22023'; end if;
    if not exists (select 1 from bridge_job_events where job_id = j.id and kind = 'ask' and request_id = p_request) then
      insert into bridge_job_events (tenant_id, scope_id, member_id, job_id, kind, request_id, payload, created_by)
        values (j.tenant_id, j.scope_id, j.member_id, j.id, 'ask', p_request,
                jsonb_build_object('tool', case when p_ask_kind = 'approve' then 'TwoFactorApprove' else 'TwoFactorCode' end,
                                   'summary', left(coalesce(p_text, ''), 300)), j.member_id);
    end if;
    update bridge_jobs set state_id = 'asking' where id = j.id and state_id <> 'asking';
    return jsonb_build_object('code', null);
  end if;
  if p_state = 'waiting' then
    if p_request is null or p_request = '' then raise exception '答えを待つには request_id が要る' using errcode = '22023'; end if;
    select e.id, e.payload->>'code' into v_id, v_code from bridge_job_events e
     where e.job_id = j.id and e.kind = 'answer' and e.request_id = p_request order by e.created_at desc limit 1;
    if v_id is null or v_code is null then return jsonb_build_object('code', null); end if;
    update bridge_job_events set payload = (payload - 'code') || jsonb_build_object('taken', true, 'taken_at', now()) where id = v_id;
    return jsonb_build_object('code', v_code);
  end if;
  if p_state not in ('ok', 'bad_password', 'needs_2fa', 'bad_code', 'captcha', 'unreachable', 'no_form', 'stopped', 'no_answer') then
    raise exception 'ログインの結果は ok／bad_password／needs_2fa／bad_code／captcha／unreachable／no_form／stopped／no_answer' using errcode = '22023';
  end if;
  -- 行を先に書く（仕事を止めた時の引き金 app.login_check_job_stopped は pending／running の行だけを「止まった」にするので、送った種類を上書きしない）
  update credentials set login_check_state = p_state, login_check_detail = left(p_detail, 400), login_check_at = now() where id = j.credential_id;
  update bridge_jobs set state_id = case when p_state in ('stopped', 'no_answer') then 'stopped' else 'done' end,
         result = case when p_state not in ('stopped', 'no_answer') then p_state end,
         stopped_reason = case when p_state in ('stopped', 'no_answer') then left(p_detail, 400) end,
         finished_at = now()
   where id = j.id;
  insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
    values (j.tenant_id, j.member_id, 'bridge', 'credential.login_check', 'credentials', j.credential_id::text, 'C2',
            jsonb_build_object('job_id', j.id, 'state', p_state), j.member_id);
  return jsonb_build_object('code', null);
end $$;
revoke all on function app.bridge_credential_check_report(uuid, uuid, uuid, text, text, text, text, text) from public;
grant execute on function app.bridge_credential_check_report(uuid, uuid, uuid, text, text, text, text, text) to kaname_app;

-- ④ 預けた直後に積む（K-352 の預ける口が呼ぶ・前の道すじも呼ぶ）。① と同じ判定・同じ開く先で積む。答えは前と同じ（積んだ仕事の id か null）
create or replace function app.credential_login_check_enqueue(p_member uuid, p_credential uuid) returns uuid
language plpgsql security definer set search_path = public, app, pg_temp as $$
begin
  return nullif(app.credential_check_start(p_member, p_credential)->>'job_id', '')::uuid;
end $$;
revoke all on function app.credential_login_check_enqueue(uuid, uuid) from public;
grant execute on function app.credential_login_check_enqueue(uuid, uuid) to kaname_app;

-- ⑤ PC が初めて生きている扱いになった時（生きている知らせ app.bridge_beat・仕事の問い合わせ app.bridge_poll のどちらでも）に、
--   その人のアカウントのまだ確かめていない（no_bridge）ログイン情報へ、作った順に 50 件まで ④ と同じ積み方で積む（代表の答え answer=449e72553c59）。
--   1 件ごとに包み、積めなかった物はその 1 件だけ戻して飛ばす（生きている知らせそのものは落とさない・値と名前をログに出さない）
create or replace function app.credential_check_on_first_alive() returns trigger
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare r record;
begin
  for r in
    select c.id, c.owner_member_id from credentials c
     where c.owner_member_id in (select app.account_members(new.member_id))
       and c.kind_id in ('basic', 'password_totp', 'email_otp') and c.login_check_state = 'no_bridge'
       and c.deleted_at is null and c.revoked_at is null and (c.expires_at is null or c.expires_at >= now())
     order by c.created_at limit 50
  loop
    begin
      perform app.credential_check_start(r.owner_member_id, r.id);
    exception when others then
      raise warning '[credentials] PC の最初の知らせで確かめを積めなかった（%）', sqlstate;
    end;
  end loop;
  return new;
end $$;
revoke all on function app.credential_check_on_first_alive() from public;
drop trigger if exists sessions_credential_check_on_first_alive on sessions;
create trigger sessions_credential_check_on_first_alive after update of alive_at on sessions for each row
  when (new.kind_id = 'bridge' and old.alive_at is null and new.alive_at is not null and new.revoked_at is null and new.deleted_at is null)
  execute function app.credential_check_on_first_alive();
