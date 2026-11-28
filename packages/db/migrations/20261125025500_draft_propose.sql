-- 20261125025500 AI の案の道具 draft_propose（K-775・D-153.17・関門 C2）
--   新しい表・列・索引は作らない（会話の種類 talk_kind は K-757・messages.options・job_id は前から在る）。関数を 2 つ作り直す・足す。
--   どれも security definer・search_path に pg_temp・public から外して kaname_app に渡す。もう 1 度当てても壊れない。
--
-- ① app.bridge_tool_job(p_hash)（0092 を写す）：答えの表に会話の種類 talk_kind を足す（会話の無い仕事は null）。中身は前のまま
--   （動いている・asking の仕事だけ・止められた／外された持ち主の鍵は引かない）
-- ② app.draft_tool_propose(p_job, p_token_hash, p_session, p_title, p_body, p_checks)：作る画面の会話の仕事の中で、AI が題・本文・確認項目の案を
--   会話の行（kind proposal・本文は空・書いた人は空・options.proposal に出した欄だけ）として 1 つ付ける。欄にも作る口にも触らない（欄に入れるのは人）。
--   2 層目の入口：鍵のハッシュ・受け取った PC・仕事の状態・持ち主・会話の種類 draft・会話の持ち主を DB でも見る。合わなければ null（何も書かない）。
--   形が残らなければ { error: shape }・この仕事の案が 3 つなら { error: limit }（どちらも何も書かない）。
--   答え：{ ok: true, id, remaining }。証跡 tool.draft_propose（payload は job_id だけ・案の字は入れない）

-- ---------------------------------------------------------------- ① 鍵から仕事を引く（talk_kind を足す）
-- squawk-ignore ban-drop-function
drop function if exists app.bridge_tool_job(text);
create function app.bridge_tool_job(p_hash text)
returns table (job_id uuid, member_id uuid, tenant_id uuid, scope_id uuid, conversation_id uuid, ticket_id uuid, kind text,
               taken_session_id uuid, talk_kind text)
language sql stable security definer set search_path = public, app, pg_temp as $$
  select j.id, j.member_id, j.tenant_id, m.scope_id, j.conversation_id,
         (select r.ticket_id from action_runs r where r.bridge_job_id = j.id order by r.created_at desc limit 1),
         j.kind, j.taken_session_id,
         (select c.talk_kind from conversations c where c.id = j.conversation_id)
    from bridge_jobs j join members m on m.id = j.member_id and m.deleted_at is null and m.suspended_at is null   -- 止められた・外された人の鍵は引かない（G-14・K62-API-070）
   where coalesce(p_hash, '') ~ '^[0-9a-f]{64}$' and j.tool_token_hash = p_hash and j.state_id in ('running', 'asking')
   limit 1
$$;
revoke all on function app.bridge_tool_job(text) from public;
grant execute on function app.bridge_tool_job(text) to kaname_app;

-- ---------------------------------------------------------------- ② 道具 draft_propose の入口（2 層目）
create or replace function app.draft_tool_propose(p_job uuid, p_token_hash text, p_session uuid,
                                                  p_title text, p_body text, p_checks jsonb)
returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare j bridge_jobs%rowtype; c conversations%rowtype; v_title text; v_checks jsonb := '[]'::jsonb; v_item jsonb; v_s text;
        v_prop jsonb := '{}'::jsonb; v_n int; v_id uuid;
begin
  -- 仕事を引く：会話の仕事・動いている・鍵のハッシュと受け取った PC が合う・持ち主が止められていない。同時の呼び出しで回数を数え違えないよう行を取る
  select b.* into j from bridge_jobs b join members m on m.id = b.member_id
   where b.id = p_job and b.kind = 'chat' and b.conversation_id is not null and b.state_id in ('running', 'asking')
     and b.tool_token_hash is not null and b.tool_token_hash = p_token_hash and b.taken_session_id = p_session
     and m.deleted_at is null and m.suspended_at is null
   for update of b;
  if j.id is null then return null; end if;
  -- 会話を引く：作る画面の会話（draft）・持ち主は仕事の持ち主・消していない
  select * into c from conversations x
   where x.id = j.conversation_id and x.owner_member_id = j.member_id and x.talk_kind = 'draft' and x.deleted_at is null;
  if c.id is null then return null; end if;
  -- 形の砦：題は前後の空白（全角・タブ・改行も）を落として 1〜200 字。本文は空白だけでなければ書いたとおり。確認項目は文字の並び（空は捨て、50 件・1 件 200 字まで）
  v_title := btrim(coalesce(p_title, ''), E' \t\r\n　');
  if length(v_title) > 200 then return jsonb_build_object('error', 'shape'); end if;
  if v_title <> '' then v_prop := v_prop || jsonb_build_object('title', v_title); end if;
  if p_body is not null and btrim(p_body, E' \t\r\n　') <> '' then
    v_prop := v_prop || jsonb_build_object('body', p_body);
  end if;
  if p_checks is not null then
    if jsonb_typeof(p_checks) <> 'array' then return jsonb_build_object('error', 'shape'); end if;
    for v_item in select e from jsonb_array_elements(p_checks) as e loop
      if jsonb_typeof(v_item) <> 'string' then return jsonb_build_object('error', 'shape'); end if;
      v_s := btrim(v_item #>> '{}', E' \t\r\n　');
      if v_s = '' then continue; end if;
      if length(v_s) > 200 then return jsonb_build_object('error', 'shape'); end if;
      v_checks := v_checks || jsonb_build_array(v_s);
    end loop;
    if jsonb_array_length(v_checks) > 50 then return jsonb_build_object('error', 'shape'); end if;
    if jsonb_array_length(v_checks) > 0 then v_prop := v_prop || jsonb_build_object('checks', v_checks); end if;
  end if;
  if v_prop = '{}'::jsonb then return jsonb_build_object('error', 'shape'); end if;
  -- 回数：この仕事の案の行（消していない）が 3 つなら断る
  select count(*) into v_n from messages m where m.job_id = j.id and m.kind = 'proposal' and m.deleted_at is null;
  if v_n >= 3 then return jsonb_build_object('error', 'limit'); end if;
  -- 書く：会話の行・会話の更新時刻・証跡（1 取引）
  insert into messages (tenant_id, conversation_id, sender_member_id, body, kind, job_id, options)
  values (c.tenant_id, c.id, null, '', 'proposal', j.id, jsonb_build_object('proposal', v_prop))
  returning id into v_id;
  update conversations set updated_at = now() where id = c.id;
  perform app.agent_tool_audit(j.member_id, j.tenant_id, 'tool.draft_propose', 'conversation', c.id, jsonb_build_object('job_id', j.id));
  return jsonb_build_object('ok', true, 'id', v_id, 'remaining', 3 - (v_n + 1));
end $$;
revoke all on function app.draft_tool_propose(uuid, text, uuid, text, text, jsonb) from public;
grant execute on function app.draft_tool_propose(uuid, text, uuid, text, text, jsonb) to kaname_app;
