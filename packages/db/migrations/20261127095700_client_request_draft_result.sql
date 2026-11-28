-- 20261127095700 PC が案を返す（K-897・契約の口 reportClientRequestDraft・D-155.11・D-128.101・D-128.113・関門 C2）
--   新しい表・列は作らない。関数を 1 つ足す。案の列（draft・draft_state・draft_job_id・draft_at・questions）は K-892（20261127095200）、
--   仕事の種類 client_request_draft と bridge_jobs.client_request_id は K-896（20261127095600）が作る。
--
-- app.bridge_client_request_draft_result(p_session, p_job, p_draft, p_failed)：1 つの取引で、依頼の案・仕事の結末・証跡を書く。
--   ・その PC が受け取った仕事（app.bridge_job_of・0092）で、種類 client_request_draft・状態 running の物でなければ、何も書かず null（口が 404・E-GST-150）
--   ・依頼が決まっていた（ticketed・declined）・押し直されて別の仕事が結んである（draft_job_id がこの仕事でない）・依頼が無いなら、
--     案を保存せず仕事を done にして { state: 'discarded' }
--   ・p_failed：依頼を draft_state failed・draft null、仕事を stopped（理由は先頭 400 字）、証跡 client_request.draft_failed → { state: 'failed' }
--   ・p_draft：決めた欄だけで組み直して保存（知らない欄は捨てる・形と長さが決まりの外なら断る＝口が先に 422 にするので、ここは最後の砦）、
--     questions 列・draft_state ready・draft_at、仕事を done（result ready）、証跡 client_request.draft_ready → { state: 'ready' }
--   証跡の payload は request_id と job_id だけ（案の中身は載せない）。メール・お知らせは書かない。
--   先方の字から AI が作った文はデータのまま保存する（加工しない・指示として読まない・ZT8）。
--   鍵の順は 依頼 → 仕事（K-896 の app.client_request_draft_enqueue と同じ順。逆にすると押し直しとぶつかって互いに待つ）

create or replace function app.bridge_client_request_draft_result(p_session uuid, p_job uuid, p_draft jsonb, p_failed text) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_job uuid;
  v_req uuid;
  j bridge_jobs%rowtype;
  r client_requests%rowtype;
  t jsonb;
  v_ticket jsonb;
  v_route jsonb;
  v_questions jsonb;
  v_title text;
  v_failed text;
  k text;
begin
  v_job := app.bridge_job_of(p_session, p_job);
  if v_job is null then return null; end if;
  select client_request_id into v_req from bridge_jobs
   where id = v_job and kind = 'client_request_draft' and state_id = 'running';
  if not found then return null; end if;
  if (p_draft is null) = (p_failed is null) then
    raise exception '案か失敗のどちらか 1 つ' using errcode = '22023';
  end if;
  select * into r from client_requests where id = v_req for update;
  select * into j from bridge_jobs
   where id = v_job and kind = 'client_request_draft' and state_id = 'running' for update;
  if j.id is null then return null; end if;

  -- 捨てる：依頼が無い・決まった・押し直された
  if r.id is null or r.state in ('ticketed', 'declined') or r.draft_job_id is distinct from j.id then
    update bridge_jobs set state_id = 'done', finished_at = now() where id = j.id;
    return jsonb_build_object('state', 'discarded');
  end if;

  -- 失敗
  if p_failed is not null then
    v_failed := left(btrim(p_failed), 400);
    if v_failed = '' then raise exception '失敗の理由が空' using errcode = '22023'; end if;
    update client_requests set draft_state = 'failed', draft = null where id = r.id;
    update bridge_jobs set state_id = 'stopped', stopped_reason = v_failed, finished_at = now() where id = j.id;
    insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
      values (j.tenant_id, j.member_id, 'bridge', 'client_request.draft_failed', 'client_requests', r.id::text, 'C2',
              jsonb_build_object('request_id', r.id, 'job_id', j.id), j.member_id);
    return jsonb_build_object('state', 'failed');
  end if;

  -- 成功：決めた欄だけで組み直す（最後の砦。形と長さは口が先に確かめている）
  t := p_draft->'ticket';
  if jsonb_typeof(p_draft) is distinct from 'object' or jsonb_typeof(t) is distinct from 'object'
     or jsonb_typeof(t->'title') is distinct from 'string'
     or jsonb_typeof(p_draft->'reply') is distinct from 'string'
     or jsonb_typeof(p_draft->'questions') is distinct from 'array' then
    raise exception '案の形が決まりの外' using errcode = '22023';
  end if;
  v_title := btrim(t->>'title');
  if char_length(v_title) not between 1 and 200 or char_length(p_draft->>'reply') > 10000
     or jsonb_array_length(p_draft->'questions') > 5
     or exists (select 1 from jsonb_array_elements(p_draft->'questions') q
                 where jsonb_typeof(q) <> 'string' or char_length(q #>> '{}') not between 1 and 300) then
    raise exception '案の長さが決まりの外' using errcode = '22023';
  end if;
  v_ticket := jsonb_build_object('title', v_title);
  foreach k in array array['kind', 'owner', 'due', 'cost', 'route_name'] loop
    continue when not (t ? k);
    if jsonb_typeof(t->k) <> 'string'
       or char_length(t->>k) > (case k when 'kind' then 40 when 'owner' then 80 when 'cost' then 40 when 'route_name' then 80 else 10 end)
       or (k = 'due' and (t->>k) !~ '^\d{4}-\d{2}-\d{2}$') then
      raise exception '案の欄 % が決まりの外', k using errcode = '22023';
    end if;
    if k = 'due' then perform (t->>k)::date; end if;   -- 無い日付（2026-02-30 など）は例外で断る
    v_ticket := v_ticket || jsonb_build_object(k, t->>k);
  end loop;
  v_questions := p_draft->'questions';
  if p_draft ? 'route' then
    v_route := p_draft->'route';
    if jsonb_typeof(v_route) <> 'object' or jsonb_typeof(v_route->'name') is distinct from 'string'
       or jsonb_typeof(v_route->'reason') is distinct from 'string'
       or char_length(v_route->>'name') > 80 or char_length(v_route->>'reason') > 200 then
      raise exception '届け先の案が決まりの外' using errcode = '22023';
    end if;
    v_route := jsonb_build_object('name', v_route->>'name', 'reason', v_route->>'reason');   -- id は受けない（選ぶのは人）
  end if;

  update client_requests
     set draft = jsonb_build_object('ticket', v_ticket, 'reply', p_draft->>'reply', 'questions', v_questions)
                 || case when v_route is null then '{}'::jsonb else jsonb_build_object('route', v_route) end,
         draft_state = 'ready', draft_at = now(), questions = v_questions
   where id = r.id;
  update bridge_jobs set state_id = 'done', result = 'ready', stopped_reason = null, finished_at = now() where id = j.id;
  insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
    values (j.tenant_id, j.member_id, 'bridge', 'client_request.draft_ready', 'client_requests', r.id::text, 'C2',
            jsonb_build_object('request_id', r.id, 'job_id', j.id), j.member_id);
  return jsonb_build_object('state', 'ready');
end $$;
revoke all on function app.bridge_client_request_draft_result(uuid, uuid, jsonb, text) from public;
grant execute on function app.bridge_client_request_draft_result(uuid, uuid, jsonb, text) to kaname_app;
