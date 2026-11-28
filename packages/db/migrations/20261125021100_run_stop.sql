-- 20261125021100_run_stop 動いている AI の実行を人が止める（K-731・契約の口 stopActionRun・関門 C2・C5・D-128.26・D-129.47・D-130.4・D-153.7・D-153.20・D-153.24・D-153.25）
--   列も表も足さない。足すのは関数 2 本（app.run_stop・app.dry_run_job_end〔空の形〕）と app.bridge_finish_job の作り直し（0092 の本体の写しに分かれ道 2 つ）。
--   止める手順は K-485 の app.run_takeover と同じ書き方：錠は 仕事 → 実行 → チケット の順（PC の終わる口と同じ）、実行を先に止まりにしてから仕事を閉じる／合図を立てる
--   （承認の後の実行の仕事を閉じる引き金 app.ticket_execute_job_end〔0100〕は実行が動いているときだけ書くので、先に止めて空振りさせる）。
--   どの関数も security definer・search_path に pg_temp・public から外す（D-128.171）。

-- ① 試し打ちの結末の呼び口（空の形）。本物にするのは K-746。null を返す＝前の道を通す。中だけで使うので誰にも渡さない
create or replace function app.dry_run_job_end(p_job uuid, p_state text, p_result text, p_reason text, p_agent_session text) returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  select null::jsonb
$$;
revoke all on function app.dry_run_job_end(uuid, text, text, text, text) from public;

-- ② PC が仕事の結末を返す口（0092 の本体の写し）。足すのは「人が止めた仕事」と「試し打ち」の分かれ道の 2 つだけ（どちらもチケットの仕事の中・実行を引いた直後）
-- squawk-ignore ban-drop-function
drop function if exists app.bridge_finish_job(uuid, uuid, text, text, text, text);
create function app.bridge_finish_job(p_session uuid, p_job uuid, p_state text, p_result text, p_reason text, p_agent_session text)
returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare j bridge_jobs%rowtype; r action_runs%rowtype; t tickets%rowtype; v_ops int; v_ms bigint; e record;
        v_why text; v_ok boolean; v_sec uuid; v_ver int; v_pos int; v_body jsonb; v_name text; v_state text; v_dry jsonb;
begin
  if p_state not in ('done', 'stopped', 'cancelled') then raise exception '結末は done／stopped／cancelled'; end if;
  select * into j from bridge_jobs where id = app.bridge_job_of(p_session, p_job) and state_id in ('running', 'asking') for update;
  if j.id is null then return null; end if;
  if j.kind = 'ticket' then
    select * into r from action_runs where bridge_job_id = j.id order by created_at desc limit 1 for update;
  end if;
  -- K-731 ① 人が止めた仕事（止める合図が立っていて、実行がもう止まっている）：PC が done・stopped・cancelled のどれを返しても、結果は使わず仕事だけ閉じる。
  --   成果物の版・承認の行・実行・段・旗には触らない（もう一度任せ直した新しい実行を壊さない）。中身のある done のときだけやり取りに 1 行（D-153.20）。
  --   合図だけ立って実行が動いたままの仕事（止める口 app.run_stop を通らない道・会話の止める口 app.agent_stop に直に）は当てず、前の道で実行・段・旗を止まりに戻す（K731-API-024）
  if j.kind = 'ticket' and j.stop_requested_at is not null
     and (r.id is null or r.status_id not in ('queued', 'running', 'asking')) then
    update bridge_jobs set state_id = case when p_state = 'cancelled' then 'cancelled' else 'stopped' end, result = null,
           stopped_reason = coalesce(nullif(btrim(p_reason), ''), j.stopped_reason, 'PC に止める合図が届いて止まりました'),
           agent_session_id = coalesce(p_agent_session, agent_session_id), partial = null, finished_at = now()
     where id = j.id;
    if p_state = 'done' and coalesce(p_result, '') ~ '\S' and r.id is not null then
      perform app.ticket_system_line(r.ticket_id, null, '止めたので、届いた結果は使いませんでした');
    end if;
    return jsonb_build_object('ok', true, 'outcome', 'stopped');
  end if;
  -- K-731 ② 試し打ち（phase dry_run）の結末は app.dry_run_job_end が受ける（中身は K-746）。null なら前の道へ
  if j.kind = 'ticket' and r.phase = 'dry_run' then
    v_dry := app.dry_run_job_end(j.id, p_state, p_result, p_reason, p_agent_session);
    if v_dry is not null then return v_dry; end if;
  end if;
  if j.kind = 'ticket' and r.phase = 'make' then
    select * into t from tickets where id = r.ticket_id for update;
    v_why := app.ticket_job_stop_reason(j.id);
    v_ok := p_state = 'done' and v_why is null and coalesce(p_result, '') ~ '\S';   -- 空白・改行だけの結果は空（E-SIG-004・G-15）。中身があれば書いたまま残す（K62-API-071）
    if not v_ok then
      v_why := coalesce(v_why,
                        case when p_state = 'done' then '自分のAI が結果を返さずに終わりました。完了とは見なしていません'
                             -- 帯に出す止まった理由（決める人の決定 D-129.47）。PC が理由を送ればその文
                             when p_state = 'cancelled' then coalesce(nullif(btrim(p_reason), ''), 'PC でこの実行をやめました。もう一度「AI に任せる」を押せます')
                             else coalesce(nullif(btrim(p_reason), ''), 'AI が途中で止まりました（理由は届いていません）。もう一度「AI に任せる」を押せます') end);
    end if;
    v_state := case when v_ok then 'done' when p_state = 'cancelled' then 'cancelled' else 'stopped' end;
    update bridge_jobs set state_id = v_state, result = case when v_ok then p_result end,
           stopped_reason = case when v_ok then null else v_why end, partial = null,   -- 切らない（D-130.4）
           agent_session_id = coalesce(p_agent_session, agent_session_id), finished_at = now()
     where id = j.id;
    v_name := app.member_name(r.created_by);
    if v_ok then
      -- 成果物の区画（無ければ作る）に新しい版。編集した人は押した人・AI が書いた印（D-128.138）
      v_body := jsonb_build_object('text', p_result);
      select s.id, s.version into v_sec, v_ver from ticket_sections s where s.ticket_id = t.id and s.section_key = 'artifacts' for update;
      if v_sec is null then
        select ks.position into v_pos from kind_sections ks where ks.kind_id = t.kind_id and ks.section_key = 'artifacts' and ks.deleted_at is null;
        insert into ticket_sections (tenant_id, ticket_id, section_key, position, body, version, created_by, updated_by)
          values (t.tenant_id, t.id, 'artifacts', coalesce(v_pos, 70), v_body, 1, r.created_by, r.created_by) returning id, version into v_sec, v_ver;
      else
        v_ver := v_ver + 1;
        update ticket_sections set body = v_body, version = v_ver, deleted_at = null, updated_by = r.created_by where id = v_sec;
      end if;
      insert into ticket_section_versions (tenant_id, ticket_id, section_id, version, body, edited_by, edited_by_clone, created_by)
        values (t.tenant_id, t.id, v_sec, v_ver, v_body, r.created_by, true, r.created_by);
      -- 承認待ち（承認するのは結果が届いた時点の担当者・D-128.25）。骨格では AI の成果物の承認は全部取り消せない扱い（D-128.177）
      insert into approvals (tenant_id, scope_id, ticket_id, kind, action_run_id, requested_by, approver_member_id, status_id,
                             subject_type, subject_id, irreversible, created_by)
        values (t.tenant_id, t.scope_id, t.id, 'artifact', r.id, r.created_by, t.assignee_member_id, 'pending',
                'ticket_section', v_sec, true, r.created_by);
      update action_runs set status_id = 'done', finished_at = now(), updated_by = r.created_by where id = r.id;
      perform app.ticket_stage_to(t.id, 'awaiting_approval', r.created_by);
      perform app.ticket_system_line(t.id, r.created_by, v_name || 'のAI が作り終えました。承認待ちです');
      return jsonb_build_object('ok', true, 'outcome', 'awaiting_approval');
    end if;
    update action_runs set status_id = v_state, error_summary = v_why, finished_at = now(), updated_by = r.created_by where id = r.id;
    perform app.ticket_stage_to(t.id, 'doing', r.created_by);
    update tickets set delegated_to_clone = false where id = t.id;   -- 止まった・やめたら「任せている」の旗を下ろす（D-128.26・K62-API-080）
    perform app.ticket_system_line(t.id, r.created_by, v_name || 'のAI が止まりました（' || v_why || '）');
    return jsonb_build_object('ok', true, 'outcome', 'stopped');
  end if;
  update bridge_jobs set state_id = p_state, result = p_result, stopped_reason = p_reason, partial = null,
         agent_session_id = coalesce(p_agent_session, agent_session_id), finished_at = now()
   where id = j.id returning * into j;
  if j.kind = 'ticket' then   -- 承認の後の実行（phase execute）の終わりは K-63 の引き金が受ける
    return jsonb_build_object('ok', true, 'outcome', case when p_state = 'done' then 'done' else 'stopped' end);
  end if;
  if j.conversation_id is not null and p_agent_session is not null then
    update conversations set agent_session_id = p_agent_session where id = j.conversation_id and agent_session_id is distinct from p_agent_session;
  end if;
  select count(*) into v_ops from bridge_job_events where job_id = j.id and kind = 'tool';
  v_ms := floor(extract(epoch from (j.finished_at - coalesce(j.started_at, j.created_at))) * 1000);
  if j.conversation_id is not null and p_state = 'done'
     and exists (select 1 from messages m where m.job_id = j.id and m.kind = 'ai' and m.transcript_uuid is not null and m.deleted_at is null) then
    update messages set work = jsonb_build_object('ops', v_ops, 'ms', v_ms)
     where id = (select m.id from messages m where m.job_id = j.id and m.kind = 'ai' and m.deleted_at is null order by m.created_at desc, m.id desc limit 1);
    update conversations set updated_at = now() where id = j.conversation_id;
  elsif j.conversation_id is not null then
    insert into messages (tenant_id, conversation_id, body, kind, job_id, work)
      values (j.tenant_id, j.conversation_id,
              case when p_state = 'done' then coalesce(p_result, '')
                   when p_state = 'stopped' then coalesce(p_reason, '理由は分かりません')
                   else 'やめました。' end,
              case when p_state = 'done' then 'ai' else 'stopped' end, j.id,
              case when v_ops > 0 or p_state = 'done' then jsonb_build_object('ops', v_ops, 'ms', v_ms) else null end);
    update conversations set updated_at = now() where id = j.conversation_id;
  end if;
  if p_state = 'done' and j.conversation_id is not null then
    for e in select x.id, x.payload from bridge_job_events x
               where x.job_id = j.id and x.kind = 'steer'
                 and not coalesce((x.payload->>'delivered')::boolean, false) and not coalesce((x.payload->>'cancelled')::boolean, false)
               order by x.created_at loop
      update bridge_job_events set payload = payload || '{"delivered": true, "moved": true}'::jsonb where id = e.id;
      perform app.agent_enqueue(j.member_id, j.conversation_id, e.payload->>'text', null,
                                coalesce(e.payload->'opts', jsonb_build_object('permission_mode', j.permission_mode, 'model', j.model, 'effort', j.effort)));
    end loop;
  end if;
  return jsonb_build_object('ok', true, 'outcome', case when p_state = 'done' then 'done' else 'stopped' end);
end $$;
revoke all on function app.bridge_finish_job(uuid, uuid, text, text, text, text) from public;
grant execute on function app.bridge_finish_job(uuid, uuid, text, text, text, text) to kaname_app;

-- ③ 止める（1 つの取引）。呼ぶのは要求の文脈の中（withTenant が app.tenant_id／app.user_id を入れた後）。
--   答えは {ok:true, run:{id, ticket_id, phase, status, stopped_reason, stopped_at}} か {ok:false, code: FORBIDDEN|NOT_FOUND|DECIDED}。
--   止められるのは担当者だけ（D-153.24）。お知らせ（受け箱）は書かない（担当者だけに出すもの＝止めた本人あては出さない・D-153.7）
create or replace function app.run_stop(p_run uuid) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_tenant uuid := app.tenant_id(); v_me uuid := app.user_id(); r action_runs%rowtype; t tickets%rowtype; j bridge_jobs%rowtype;
        v_stage text; v_job uuid; v_was text; v_why text;
begin
  if v_tenant is null or v_me is null or not app.member_ok() then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  -- 錠を取る前に、仕事の id だけを読む（id は変わらない）
  select x.bridge_job_id into v_job from action_runs x where x.id = p_run and x.tenant_id = v_tenant;
  if v_job is not null then
    select * into j from bridge_jobs where id = v_job for update;
  end if;
  select * into r from action_runs
   where id = p_run and tenant_id = v_tenant and ticket_id is not null and deleted_at is null for update;
  if r.id is null then return jsonb_build_object('ok', false, 'code', 'NOT_FOUND'); end if;
  select * into t from tickets where id = r.ticket_id and tenant_id = v_tenant and deleted_at is null for update;
  if t.id is null or not app.ticket_visible(t.id) then return jsonb_build_object('ok', false, 'code', 'NOT_FOUND'); end if;
  -- 担当者だけ（任せた人・マネージャーではない）。担当者がいないチケットは誰も止められない
  if t.assignee_member_id is distinct from v_me then return jsonb_build_object('ok', false, 'code', 'FORBIDDEN'); end if;
  if r.status_id not in ('queued', 'running', 'asking') then return jsonb_build_object('ok', false, 'code', 'DECIDED'); end if;
  select s.key into v_stage from ticket_stages s where s.id = t.stage_id;
  v_was := r.status_id;
  v_why := app.member_name(v_me) || 'が止めました';
  -- 実行を先に止まりにする（PC が遅れて返した結果は app.bridge_finish_job が使わない）
  update action_runs set status_id = 'stopped', error_summary = v_why, finished_at = now(), updated_by = v_me
   where id = r.id returning * into r;
  -- 待っている仕事はその場で止める（PC が取りに来ても渡らない）。動いている仕事は止める合図だけ（PC が読んで返すまで動いたまま）
  if j.id is not null and j.state_id = 'queued' then
    update bridge_jobs set state_id = 'stopped', finished_at = now(), partial = null, stopped_reason = v_why,
           stop_requested_at = now()
     where id = j.id;
  elsif j.id is not null and j.state_id in ('running', 'asking') then
    update bridge_jobs set stop_requested_at = coalesce(stop_requested_at, now()) where id = j.id;
  end if;
  -- 試し打ち（phase dry_run）の実行を止めるときは段と旗に触らない（承認待ちのまま・K-746）
  if r.phase is distinct from 'dry_run' then
    if v_stage = 'running' then perform app.ticket_stage_to(t.id, 'doing', v_me); end if;
    update tickets set delegated_to_clone = false where id = t.id;
  end if;
  perform app.ticket_system_line(t.id, v_me, app.member_name(v_me) || 'が AI を止めました');
  perform app.record_audit('action_runs.stop', 'action_runs', r.id::text, 'C2',
                           jsonb_build_object('ticket_id', t.id, 'was', v_was, 'phase', r.phase));
  return jsonb_build_object('ok', true, 'run', jsonb_build_object(
           'id', r.id, 'ticket_id', r.ticket_id, 'phase', r.phase, 'status', r.status_id,
           'stopped_reason', r.error_summary, 'stopped_at', r.finished_at));
end $$;
revoke all on function app.run_stop(uuid) from public;
grant execute on function app.run_stop(uuid) to kaname_app;
