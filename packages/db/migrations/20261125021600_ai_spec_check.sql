-- K-736：AI が確認項目にチェックを付ける道具 spec_check（2 層の入口の関数）・道具 ticket_read の答えに確認項目・
--   AI に渡す中身の頭の文に「チェックを付けてから最後の返事」の指示・AI に渡す要約の直し 2 つ（変更の行の名前が 2 回・取り消した決定が渡る）。
--   決め：D-153.2（確かめられた物だけ AI が付けてから知らせる）・D-153.4（根拠の 1 行を残す）・D-152.5（別の AI の突き合わせは入れない）。
--   全部 create or replace／add column if not exists：もう 1 度当てても壊れない。関門 C2

-- ---------------------------------------------------------------- ① 根拠の列（前後の空白〔全角・タブ・改行も〕を落として 1〜200 字。空白だけ・201 字以上は DB が断る）
alter table public.test_specs add column if not exists checked_basis text;
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.test_specs'::regclass and conname = 'test_specs_checked_basis_check') then
    alter table public.test_specs add constraint test_specs_checked_basis_check
      check (checked_basis is null or length(btrim(checked_basis, E' \t\r\n　')) between 1 and 200);
  end if;
end $$;

-- ---------------------------------------------------------------- ② 道具 ticket_read（0092 を写す）：答えに specs を足す。前の 2 鍵・鍵と PC の確かめ・権限・証跡は前のまま
create or replace function app.ticket_tool_read(p_job uuid, p_token_hash text, p_session uuid) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare j bridge_jobs%rowtype; r action_runs%rowtype; t tickets%rowtype; v jsonb; v_specs jsonb;
begin
  select * into j from bridge_jobs where id = p_job and kind = 'ticket' and state_id in ('running', 'asking')
     and tool_token_hash is not null and tool_token_hash = p_token_hash and taken_session_id = p_session;
  if j.id is null then return null; end if;
  select * into r from action_runs where bridge_job_id = j.id order by created_at desc limit 1;
  select * into t from tickets where id = r.ticket_id and deleted_at is null;
  if t.id is null or not app.ticket_writable_for(t.id, r.created_by) then return null; end if;
  select jsonb_build_object(
           'ticket', jsonb_build_object('id', t.id, 'number', t.number, 'title', t.title,
                                        'stage', (select s.key from ticket_stages s where s.id = t.stage_id), 'due_on', t.due_on),
           'sections', coalesce(jsonb_agg(jsonb_build_object('key', s.section_key, 'label', coalesce(ks.label, s.section_key),
                                                             'text', s.body->>'text', 'version', s.version) order by s.position), '[]'::jsonb))
    into v
    from ticket_sections s
    left join kind_sections ks on ks.kind_id = t.kind_id and ks.section_key = s.section_key and ks.deleted_at is null
   where s.ticket_id = t.id and s.deleted_at is null;
  -- 確認項目（消していない・作った順）。AI が spec_check に渡す id をここで知る（K-736）
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'text', x.title, 'checked', x.checked_at is not null, 'source', x.source)
                            order by x.created_at, x.id), '[]'::jsonb)
    into v_specs
    from test_specs x where x.ticket_id = t.id and x.tenant_id = t.tenant_id and x.deleted_at is null;
  v := v || jsonb_build_object('specs', v_specs);
  perform app.agent_tool_audit(j.member_id, j.tenant_id, 'tool.ticket_read', 'ticket', t.id, jsonb_build_object('job_id', j.id));
  return v;
end $$;
revoke all on function app.ticket_tool_read(uuid, text, uuid) from public;
grant execute on function app.ticket_tool_read(uuid, text, uuid) to kaname_app;

-- ---------------------------------------------------------------- ③ 道具 spec_check の入口（2 層目：鍵のハッシュと受け取った PC を DB でも見る）。
--   AI のチェックを付けるだけ（外す引数を持たない・K-700 のリスク b）。1 つの取引で：チェック（K-435 の関数）・根拠の列・根拠の行・証跡
create or replace function app.ticket_tool_spec_check(p_job uuid, p_token_hash text, p_session uuid, p_spec uuid, p_basis text)
returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare j bridge_jobs%rowtype; r action_runs%rowtype; t tickets%rowtype; v_basis text; v_prev text; v_res jsonb;
begin
  -- 仕事を引く：チケットの仕事・動いている・鍵のハッシュと受け取った PC が合う・持ち主が止められていない
  select b.* into j from bridge_jobs b join members m on m.id = b.member_id
   where b.id = p_job and b.kind = 'ticket' and b.state_id in ('running', 'asking')
     and b.tool_token_hash is not null and b.tool_token_hash = p_token_hash and b.taken_session_id = p_session
     and m.deleted_at is null and m.suspended_at is null;
  if j.id is null then return null; end if;
  select * into r from action_runs where bridge_job_id = j.id order by created_at desc limit 1;
  select * into t from tickets where id = r.ticket_id and deleted_at is null;
  if t.id is null or not app.ticket_writable_for(t.id, r.created_by) then return null; end if;
  -- 根拠の形
  v_basis := btrim(coalesce(p_basis, ''), E' \t\r\n　');
  if length(v_basis) < 1 or length(v_basis) > 200 then return jsonb_build_object('error', 'basis'); end if;
  -- 確認項目：その仕事のチケットの行・消していない・同じ会社
  if not exists (select 1 from test_specs x where x.id = p_spec and x.ticket_id = t.id and x.tenant_id = t.tenant_id and x.deleted_at is null) then
    return jsonb_build_object('error', 'not_found');
  end if;
  -- 会社の文脈を借りて K-435 の関数を呼び、終わったら呼ぶ前の設定に戻す（接続を使い回しても別の会社に残さない）
  v_prev := current_setting('app.tenant_id', true);
  perform set_config('app.tenant_id', t.tenant_id::text, true);
  v_res := app.test_spec_check_by_ai(p_spec, true);
  perform set_config('app.tenant_id', coalesce(v_prev, ''), true);
  if v_res ? 'error' then return jsonb_build_object('error', v_res->>'error'); end if;
  if coalesce((v_res->>'unchanged')::boolean, false) then
    return jsonb_build_object('ok', true, 'id', p_spec, 'checked', true, 'unchanged', true);
  end if;
  update test_specs set checked_basis = v_basis where id = p_spec;
  perform app.ticket_system_line(t.id, null, '根拠：' || v_basis);
  perform app.agent_tool_audit(j.member_id, j.tenant_id, 'tool.spec_check', 'test_spec', p_spec, jsonb_build_object('job_id', j.id));
  return jsonb_build_object('ok', true, 'id', p_spec, 'checked', true, 'unchanged', false);
end $$;
revoke all on function app.ticket_tool_spec_check(uuid, text, uuid, uuid, text) from public;
grant execute on function app.ticket_tool_spec_check(uuid, text, uuid, uuid, text) to kaname_app;

-- ---------------------------------------------------------------- ④ AI に渡す中身（K-578 の版 20261122101600 を写す）。変えるのは 3 つだけ：
--   (a) 確認項目が 1 件以上で承認の後の実行の prompt でなければ、頭の文の最後に spec_check の指示 1 文
--   (b) やり取りの変更の行（kind change）と作者の無い行は名前を前に付けない
--   (c) 決定は改められていない・取り消していない物だけ（K-390 の列）
create or replace function app.ticket_job_context(p_ticket uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare t tickets%rowtype; v_text text; v_specs text; v_prompt text; v_sess text; v_sess_member uuid; rec record;
        v_lines text[] := '{}'; v_total int := 0; v_head text; v_summary text;
        v_spec_n int; v_appr record; v_exec boolean := false;
begin
  select * into t from tickets where id = p_ticket;
  if t.id is null then return null; end if;
  -- 承認の後の実行か：いちばん新しい決まった承認（artifact・取り下げていない）が approve で、その承認から出た実行がまだ無い（K-736）
  select a.id, a.decision into v_appr from approvals a
   where a.ticket_id = t.id and a.kind = 'artifact' and a.decision is not null and a.withdrawn_at is null and a.deleted_at is null
   order by a.decided_at desc nulls last, a.created_at desc limit 1;
  if v_appr.id is not null and v_appr.decision = 'approve' then
    v_exec := not exists (select 1 from action_runs x where x.approval_id = v_appr.id and x.phase = 'execute' and x.deleted_at is null);
  end if;
  select count(*) into v_spec_n from test_specs x where x.ticket_id = t.id and x.tenant_id = t.tenant_id and x.deleted_at is null;
  -- 本文 → 項目 → 確認項目（K-565）。本文の行（鍵 body・消していない）が無ければ空の本文として組む（見出し「本文」を出さない・区画は読まない・K-578）
  v_prompt := 'Kaname のチケット「' || t.number || ' ' || t.title || '」の成果物を作ってください。'
              || '外（メール・送信・応募など）には何も出さず、作ったものを最後の返事の本文で返してください。'
              || 'チケットの本文と項目は Kaname の道具 ticket_read で読めます。';
  if v_spec_n > 0 and not v_exec then
    v_prompt := v_prompt || '作り終えたら、確認項目を 1 つずつ確かめ、確かめられた物だけ道具 spec_check（確認項目の id と根拠の 1 行を渡す）でチェックを付けてから、最後の返事を返してください。目で見ないと分からない物にはチェックを付けず、そのまま残してください。';
  end if;
  select s.body->>'text' into v_text from ticket_sections s where s.ticket_id = t.id and s.section_key = 'body' and s.deleted_at is null
   order by s.position, s.created_at, s.id limit 1;
  if coalesce(btrim(v_text), '') <> '' then v_prompt := v_prompt || E'\n\n## 本文\n' || v_text; end if;
  v_prompt := v_prompt || E'\n\n## 項目\n' || app.ticket_brief_items(t.id);
  select string_agg('- ' || x.title, E'\n' order by x.created_at, x.id) into v_specs
    from test_specs x where x.ticket_id = t.id and x.tenant_id = t.tenant_id and x.deleted_at is null;
  if v_specs is null then
    v_specs := case when coalesce(t.no_spec_reason, '') = '' then '- なし' else '- なし（使わない理由：' || t.no_spec_reason || '）' end;
  end if;
  v_prompt := v_prompt || E'\n\n## 確認項目\n' || v_specs;
  -- チケットの記録の要約（D-129.46・G-16）：やり取りの書き込み 新しい 10 件・1 件 400 字／決定 新しい 20 件・1 件 200 字／前の実行の記録 新しい 10 件・1 件 200 字。
  --   古い順に並べ、合わせて 8000 字を越えたら古いものから落とす。区画は切らない。前の会話の番号（agent_session_id）は入れない
  for rec in
    select x.line from (
      (select m.created_at as ts,
              '[やり取り] ' || to_char(m.created_at at time zone 'Asia/Tokyo', 'MM/DD HH24:MI') || ' '
              || case when m.kind = 'change' or app.member_name(m.author_member_id) is null then ''
                      else app.member_name(m.author_member_id) || ': ' end
              || left(regexp_replace(coalesce(m.body, ''), E'[\\r\\n]+', ' ', 'g'), 400) as line
         from ticket_messages m where m.ticket_id = t.id and m.kind <> 'system' and m.deleted_at is null
        order by m.created_at desc limit 10)
      union all
      (select d.decided_at,
              '[決定] ' || to_char(d.decided_at at time zone 'Asia/Tokyo', 'MM/DD') || ' ' || left(regexp_replace(coalesce(d.text, ''), E'[\\r\\n]+', ' ', 'g'), 200)
         from ticket_decisions d where d.ticket_id = t.id and d.deleted_at is null
              and d.superseded_by_id is null and d.cancelled_at is null
        order by d.decided_at desc limit 20)
      union all
      (select coalesce(r.finished_at, r.created_at),
              '[前の実行] ' || to_char(coalesce(r.finished_at, r.created_at) at time zone 'Asia/Tokyo', 'MM/DD HH24:MI') || ' ' || coalesce(app.member_name(r.created_by), '') || 'のAI: '
              || case r.status_id when 'done' then '作り終えた' when 'cancelled' then 'やめた' else '止まった' end
              || case when coalesce(r.error_summary, '') = '' then '' else '（' || left(regexp_replace(r.error_summary, E'[\\r\\n]+', ' ', 'g'), 200) || '）' end
         from action_runs r where r.ticket_id = t.id and r.status_id in ('done', 'stopped', 'cancelled') and r.deleted_at is null
        order by coalesce(r.finished_at, r.created_at) desc limit 10)
    ) x order by x.ts
  loop
    v_lines := v_lines || rec.line;
    v_total := v_total + length(rec.line) + 3;   -- 「- 」と改行
  end loop;
  v_head := E'\n\n## チケットの記録（新しいものだけ・古い順）\n';
  while coalesce(array_length(v_lines, 1), 0) > 0 and v_total + length(v_head) > 8000 loop
    v_total := v_total - (length(v_lines[1]) + 3);
    v_lines := v_lines[2:];
  end loop;
  if coalesce(array_length(v_lines, 1), 0) > 0 then
    select string_agg('- ' || u.l, E'\n' order by u.i) into v_summary from unnest(v_lines) with ordinality as u(l, i);
    v_prompt := v_prompt || v_head || v_summary;
  end if;
  -- 前の作る実行の会話の番号と、その実行を任せた人。続きにするかは任せる関数（同じ人）と取る関数（同じ PC）が決める（D-129.46）
  select j.agent_session_id, r.created_by into v_sess, v_sess_member
    from action_runs r join bridge_jobs j on j.id = r.bridge_job_id
   where r.ticket_id = t.id and r.phase = 'make' and j.agent_session_id is not null
     and (t.completed_at is null or r.created_at > t.completed_at)   -- 完了の前の作る実行の続きは使わない（D-125.155・K63-API-054・055）
   order by r.created_at desc limit 1;
  return jsonb_build_object('prompt', v_prompt, 'agent_session_id', v_sess, 'agent_member_id', v_sess_member);
end $$;
-- 中だけで使う（任せる関数と K-63 の承認の関数が呼ぶ）。kaname_app にも渡さない（D-128.171・K62-API-046）
revoke all on function app.ticket_job_context(uuid) from public;
