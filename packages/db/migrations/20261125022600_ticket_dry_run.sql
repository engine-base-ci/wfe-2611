-- 20261125022600_ticket_dry_run 試し打ち（K-746・契約の口 dryRunTicket・関門 C2・C5・D-153.6・D-153.7・D-128.176・D-128.171・D-131.2）
--   承認待ちの成果物を、宛先を押した人のログインのメールアドレスに差し替えて 1 回だけ実行する仕事を積む。任意（承認の前の必須の手順にしない）・何回でも。
--   承認の行・チケットの段・「AI に任せている」の旗・成果物の版・確認項目には、始めるときも結末でも触らない。
--   足すのは 実行の phase の dry_run・関数 4 本（app.member_login_email・app.dry_run_job_end〔K-731 の空の形の中身〕・app.dry_run_job_closed・app.ticket_dry_run）・引き金 1 本。
--   K-731 の app.bridge_finish_job は直さない（phase が dry_run なら app.dry_run_job_end を呼ぶ）。結末の実行の記録とやり取りは、仕事の行が閉じたときの引き金が書く
--   （承認の後の実行の app.ticket_execute_job_end と同じ「閉じ方に依らず 1 か所」の作り）。
--   どの関数も security definer・search_path に pg_temp・public から外す。kaname_app に渡すのは app.ticket_dry_run だけ（D-128.171）。

-- ① 実行の phase に dry_run（試し打ち）を足す。前の値（空・make・execute）は全部通る
-- squawk-ignore ban-drop-constraint
alter table action_runs drop constraint if exists action_runs_phase_check;
alter table action_runs add constraint action_runs_phase_check check (phase is null or phase in ('make', 'execute', 'dry_run')) not valid;
alter table action_runs validate constraint action_runs_phase_check;

-- ② メンバーのログインのメールアドレス（認証の表を動的に引く・0067 の app.bridge_session_email と同じ作り）。空白だけは null。中だけで使うので誰にも渡さない
create or replace function app.member_login_email(p_member uuid) returns text
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare v text;
begin
  execute 'select u.email from members m join kaname_auth."user" u on u.id = m.auth_user_id where m.id = $1 and m.deleted_at is null'
    into v using p_member;
  return nullif(btrim(coalesce(v, ''), E' \t\r\n　'), '');
end $$;
revoke all on function app.member_login_email(uuid) from public;

-- ③ 試し打ちの結末（K-731 が置いた空の形の中身）。呼ぶのは app.bridge_finish_job（仕事を for update で取った後）。
--   最新の実行が phase dry_run でなければ null（前の道へ）。結末を決めて仕事の行を閉じるところまで（実行の記録・やり取りは ④ の引き金が書く）。
--   結果は前後の空白（全角・タブ・改行も）を落として見る：決めた見出しで始まる → stopped（理由は見出しの後の字・全文）／空白だけ → stopped／中身あり → done（切らない）
create or replace function app.dry_run_job_end(p_job uuid, p_state text, p_result text, p_reason text, p_agent_session text) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare r action_runs%rowtype; v_res text; v_state text; v_why text;
        c_mark constant text := '【試し打ちは実行せず止まりました】';
        c_ws constant text := E' \t\r\n　';
begin
  select * into r from action_runs where bridge_job_id = p_job order by created_at desc limit 1;
  if r.id is null or r.phase is distinct from 'dry_run' then return null; end if;
  v_res := btrim(coalesce(p_result, ''), c_ws);
  if p_state = 'done' and left(v_res, length(c_mark)) = c_mark then
    v_state := 'stopped';
    v_why := coalesce(nullif(btrim(substr(v_res, length(c_mark) + 1), c_ws), ''),
                      '宛先を差し替えられない操作があったので、実行せずに止まりました');
  elsif p_state = 'done' and v_res = '' then
    v_state := 'stopped';
    v_why := '自分のAI が結果を返さずに終わりました。完了とは見なしていません';
  elsif p_state = 'done' then
    v_state := 'done';
  elsif p_state = 'cancelled' then
    v_state := 'cancelled';
    v_why := coalesce(nullif(btrim(p_reason, c_ws), ''), 'PC でこの試し打ちをやめました。もう一度試し打ちできます');
  else
    v_state := 'stopped';
    v_why := coalesce(nullif(btrim(p_reason, c_ws), ''), '試し打ちが途中で止まりました（理由は届いていません）。もう一度試し打ちできます');
  end if;
  update bridge_jobs set state_id = v_state, result = case when v_state = 'done' then p_result end,
         stopped_reason = v_why, partial = null,   -- 切らない（D-131.2）
         agent_session_id = coalesce(p_agent_session, agent_session_id), finished_at = now()
   where id = p_job;
  return jsonb_build_object('ok', true, 'outcome', case when v_state = 'done' then 'done' else 'stopped' end);
end $$;
revoke all on function app.dry_run_job_end(uuid, text, text, text, text) from public;

-- ④ 試し打ちの仕事が閉じたとき（PC が終わった・止まった・やめた／つながり直しの片付け／PC を外す／任せた人が止められる、のどこから閉じても）の引き金の本体。
--   最新の実行が phase dry_run で queued・running・asking のときだけ、実行の記録とやり取りの 1 行を書く（止める口で先に止まりにされた実行には何もしない）。
--   承認・段・旗・成果物には触らない。チケットが消されていても書く
create or replace function app.dry_run_job_closed() returns trigger
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare r action_runs%rowtype; v_ok boolean; v_state text; v_why text; v_name text;
        c_ws constant text := E' \t\r\n　';
begin
  select * into r from action_runs where bridge_job_id = new.id order by created_at desc limit 1 for update;
  if r.id is null or r.phase is distinct from 'dry_run' or r.status_id not in ('queued', 'running', 'asking') then return null; end if;
  v_ok := new.state_id = 'done' and coalesce(new.result, '') ~ '\S';
  v_state := case when v_ok then 'done' when new.state_id = 'cancelled' then 'cancelled' else 'stopped' end;
  v_why := case when v_ok then null
                when coalesce(btrim(new.stopped_reason, c_ws), '') <> '' then new.stopped_reason
                when new.state_id = 'cancelled' then 'PC でこの試し打ちをやめました。もう一度試し打ちできます'
                when new.state_id = 'done' then '自分のAI が結果を返さずに終わりました。完了とは見なしていません'
                else '試し打ちが途中で止まりました（理由は届いていません）。もう一度試し打ちできます' end;
  update action_runs set status_id = v_state, error_summary = v_why, finished_at = now() where id = r.id;
  v_name := app.member_name(new.member_id);
  perform app.ticket_system_line(r.ticket_id, null,
    case when v_ok then v_name || 'のAI が試し打ちをあなた宛てに送りました。届いた物を確かめてください：' || left(btrim(new.result, c_ws), 200)
         else v_name || 'のAI の試し打ちが止まりました：' || left(v_why, 200) end);
  return null;
end $$;
revoke all on function app.dry_run_job_closed() from public;

drop trigger if exists bridge_jobs_dry_run_end on bridge_jobs;
create trigger bridge_jobs_dry_run_end after update of state_id on bridge_jobs
  for each row when (new.kind = 'ticket' and new.state_id in ('done', 'stopped', 'cancelled') and old.state_id is distinct from new.state_id)
  execute function app.dry_run_job_closed();

-- ⑤ 試し打ちを始める（口 dryRunTicket の 1 取引）。押せるのは担当者（承認する人）で、チケットを直せる人だけ。
--   答えの言葉：FORBIDDEN・NOT_FOUND・NOT_DRY_RUNNABLE（承認待ちの成果物が無い）・RUNNING（走っている実行の id）・UNUSABLE（動かす AI が使えない・理由）・NO_MAIL。
--   動かすのは承認の後の実行と同じ（作る段の最新の実行を動かした人〔無ければ承認の requested_by〕の AI・その人の PC・許可は auto・D-128.176）。
--   メールアドレスは仕事の prompt にだけ入れる（答え・やり取り・証跡に出さない）
create or replace function app.ticket_dry_run(p_ticket uuid) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_tenant uuid := app.tenant_id(); v_me uuid := app.user_id(); t tickets%rowtype; a approvals%rowtype;
        v_stage text; v_run uuid; v_job uuid; v_by uuid; v_why text; v_mail text; v_prompt text;
        -- K-736 が作る段の prompt に足す 1 文（試し打ちは確認項目を変えない仕事なので取り除く・字は K-736 と同じ）
        c_check constant text := '作り終えたら、確認項目を 1 つずつ確かめ、確かめられた物だけ道具 spec_check（確認項目の id と根拠の 1 行を渡す）でチェックを付けてから、最後の返事を返してください。目で見ないと分からない物にはチェックを付けず、そのまま残してください。';
begin
  if v_tenant is null or v_me is null or not app.approval_member_now() then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  -- 同じチケットの同時の押下は、チケットの行で待ち合わせて 1 つだけ通す（後のものは走っている実行を見る）
  select * into t from tickets where id = p_ticket and tenant_id = v_tenant and deleted_at is null for update;
  if t.id is null or not app.ticket_visible(t.id) then return jsonb_build_object('ok', false, 'code', 'NOT_FOUND'); end if;
  if t.assignee_member_id is distinct from v_me or not app.ticket_writable(t.id) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  select s.key into v_stage from ticket_stages s where s.id = t.stage_id;
  select * into a from approvals x
   where x.ticket_id = t.id and x.kind = 'artifact' and x.decision is null and x.withdrawn_at is null
     and x.resolved_at is null and x.deleted_at is null
   order by x.created_at desc, x.id desc limit 1;
  if a.id is null or coalesce(v_stage, '') <> 'awaiting_approval' then
    return jsonb_build_object('ok', false, 'code', 'NOT_DRY_RUNNABLE');
  end if;
  select r.id into v_run from action_runs r
   where r.ticket_id = t.id and r.status_id in ('queued', 'running', 'asking') and r.deleted_at is null
   order by r.created_at desc limit 1;
  if v_run is not null then return jsonb_build_object('ok', false, 'code', 'RUNNING', 'run_id', v_run); end if;
  select r.created_by into v_by from action_runs r
   where r.ticket_id = t.id and r.phase = 'make' and r.deleted_at is null order by r.created_at desc limit 1;
  v_by := coalesce(v_by, a.requested_by);
  v_why := app.ticket_delegator_stop(t.id, v_by);
  if v_why is not null then return jsonb_build_object('ok', false, 'code', 'UNUSABLE', 'reason', v_why); end if;
  v_mail := app.member_login_email(v_me);
  if v_mail is null then return jsonb_build_object('ok', false, 'code', 'NO_MAIL'); end if;
  -- 試し打ちの指示（字の正本はここ 1 か所。見出し【試し打ちは実行せず止まりました】は ③ が見る）＋チケットの中身＋成果物の 1 段
  v_prompt := '【試し打ち】これは本番の実行ではありません。'
              || 'チケットの区画「成果物」を、宛先だけを次のメールアドレス（' || v_mail || '）に差し替えて、1 回だけ実行してください。'
              || '本来の宛先（取引先・お客様など）には、何も送らないでください。'
              || '宛先を差し替えられない操作（応募フォームへの入力・外部サービスへの登録・公開の投稿など）は、実行せずに止め、'
              || '最後の返事の 1 行目を「【試し打ちは実行せず止まりました】」にして、理由を続けて書いてください。'
              || '実行できたら、何を・どの宛先に送ったかを最後の返事の本文で返してください。'
              || E'\n\n' || replace(coalesce(app.ticket_job_context(t.id)->>'prompt', ''), c_check, '')
              || E'\n\n## 試し打ち\n上の「外には何も出さず」は、この試し打ちには当てはまりません。'
              || 'チケットの区画「成果物」の中身を、宛先だけを一番上のメールアドレスに差し替えて、そのとおりに 1 回だけ外へ出してください。';
  insert into bridge_jobs (tenant_id, scope_id, member_id, state_id, prompt, agent_session_id, resume_session_id, kind,
                           permission_mode, created_by)
    values (t.tenant_id, t.scope_id, v_by, 'queued', v_prompt, null, null, 'ticket', 'auto', v_me)
    returning id into v_job;
  insert into action_runs (tenant_id, scope_id, ticket_id, phase, status_id, bridge_job_id, approval_id, created_by, updated_by)
    values (t.tenant_id, t.scope_id, t.id, 'dry_run', 'queued', v_job, a.id, v_me, v_me)
    returning id into v_run;
  perform app.ticket_system_line(t.id, v_me, app.member_name(v_me) || 'が試し打ちを始めました（宛先を差し替えます）');
  perform app.record_audit('action_runs.dry_run', 'action_runs', v_run::text, 'C2',
                           jsonb_build_object('ticket_id', t.id, 'approval_id', a.id));
  return jsonb_build_object('ok', true, 'run_id', v_run, 'job_id', v_job,
                            'pc', case when app.account_pc_live(v_by) then 'live' else 'asleep' end);   -- 75 秒の式（0092 と同じ）
end $$;
revoke all on function app.ticket_dry_run(uuid) from public;
grant execute on function app.ticket_dry_run(uuid) to kaname_app;
