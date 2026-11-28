-- 20261128213100 承認の後の実行の指示に、承認した版の成果物の字を足す（K-770・K-578・K-742・answer=8b228b743062）
--   20261125021600 の app.ticket_job_context を同じ形で置き換え、1 つだけ足す：
--   承認の後の実行（v_exec）のときは、確認項目の後に「## 承認された成果物（版 N）」と成果物の区画（ticket_sections の artifacts）の字。
--   K-578 の後、指示は本文だけを読み「区画『成果物』の中身」と書くだけで、人が直した版の字が実行に渡っていなかった（K770-M1-07）。
--   作る段の指示・spec_check の指示・記録の要約は変えない。

create or replace function app.ticket_job_context(p_ticket uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare t tickets%rowtype; v_text text; v_specs text; v_prompt text; v_sess text; v_sess_member uuid; rec record;
        v_lines text[] := '{}'; v_total int := 0; v_head text; v_summary text;
        v_spec_n int; v_appr record; v_exec boolean := false; v_art text; v_art_ver int;
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
  -- 承認の後の実行には、承認した版の成果物の字を足す（人が直した版がそのまま渡る・K770-M1-07・answer=8b228b743062）。
  --   承認と自分で直す（app.approval_self_edit）は承認の行で待ち合わせるので、決めた時点の成果物の区画が承認した版
  if v_exec then
    select s.body->>'text', s.version into v_art, v_art_ver from ticket_sections s
     where s.ticket_id = t.id and s.tenant_id = t.tenant_id and s.section_key = 'artifacts' and s.deleted_at is null
     order by s.position, s.created_at, s.id limit 1;
    if coalesce(btrim(v_art), '') <> '' then
      v_prompt := v_prompt || E'\n\n## 承認された成果物（版 ' || coalesce(v_art_ver::text, '?') || E'）\n' || v_art;
    end if;
  end if;
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
