-- K-738：AI が「必ず守る決まりを破っていたので直した」と自分で知らせる道具 guard_report の入口の関数（2 層目）。
--   段 10 の K-700 の数える関数 app.knowledge_record_breach(…, 'ai_self_reported', 理由) を、道具の鍵と PC の印を DB でも見てから呼ぶ。
--   決め：D-152.24・D-153.19（AI はチェックを外せない・この道具はチェックに触らない）・D-110.3・D-128.163（鍵と PC）。
--   列・表・引き金は足さない。create or replace：もう 1 度当てても壊れない。関門 C2
create or replace function app.ticket_tool_guard_report(p_job uuid, p_token_hash text, p_session uuid, p_spec uuid, p_note text)
returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare j bridge_jobs%rowtype; r action_runs%rowtype; t tickets%rowtype; v_note text; v_id uuid;
begin
  -- 仕事を引く：チケットの仕事・動いている・鍵のハッシュと受け取った PC が合う・持ち主が止められていない
  select b.* into j from bridge_jobs b join members m on m.id = b.member_id
   where b.id = p_job and b.kind = 'ticket' and b.state_id in ('running', 'asking')
     and b.tool_token_hash is not null and b.tool_token_hash = p_token_hash and b.taken_session_id = p_session
     and m.deleted_at is null and m.suspended_at is null;
  if j.id is null then return null; end if;
  select * into r from action_runs where bridge_job_id = j.id order by created_at desc limit 1;
  -- 試し打ち（最新の実行が dry_run）は確認項目を変えない仕事：破られた数を足さない（K-746）
  if r.id is null or r.phase = 'dry_run' then return null; end if;
  select * into t from tickets where id = r.ticket_id and deleted_at is null;
  if t.id is null or not app.ticket_writable_for(t.id, r.created_by) then return null; end if;
  -- 理由の形：前後の空白（全角・タブ・改行も）を落とし、空なら無し。200 字を超えたら何も書かない
  v_note := nullif(btrim(p_note, E' \t\r\n　'), '');
  if v_note is not null and length(v_note) > 200 then return jsonb_build_object('error', 'note'); end if;
  -- 確認項目：その仕事のチケットの行・消していない・同じ会社・必ず守るから入った行（区別を答えに出さない）
  if not exists (select 1 from test_specs x where x.id = p_spec and x.ticket_id = t.id and x.tenant_id = t.tenant_id
                    and x.deleted_at is null and x.source = 'knowledge') then
    return jsonb_build_object('error', 'not_found');
  end if;
  -- 証跡（理由の字・題名は入れない）。数えなかった呼び出しにも残す
  perform app.agent_tool_audit(j.member_id, j.tenant_id, 'tool.guard_report', 'test_spec', p_spec, jsonb_build_object('job_id', j.id));
  -- 数える（やり取りの行と数えた証跡は K-700 の関数が同じ取引で書く）。null は範囲の外・外れた・もう数えた
  v_id := app.knowledge_record_breach(t.id, p_spec, 'ai_self_reported', v_note);
  return jsonb_build_object('ok', true, 'id', p_spec, 'counted', v_id is not null);
end $$;
revoke all on function app.ticket_tool_guard_report(uuid, text, uuid, uuid, text) from public;
grant execute on function app.ticket_tool_guard_report(uuid, text, uuid, uuid, text) to kaname_app;
