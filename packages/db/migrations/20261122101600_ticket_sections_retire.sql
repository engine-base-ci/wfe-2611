-- 20261122101600 区画の道を DB の関数から外す（K-578・段 5 の最後の片付け・関門 C2・D-150.35・D-150.42・D-150.45・D-150.50・D-150.58）
--   K-575（20261122101500）が今ある区画の中身を本文に移した後に当たる。表・列・引き金・policy は触らない（区画の行も消さない）。
--   作り直す関数は 4 つ（どれも前の葉の版を写し、区画の道だけを消した）：
--   ① app.ticket_create（K-581 の 20261122101100 の版）：区画の入力は読まない・必須の区画で止めない。本文が無ければ空の本文で本文の行と版 1 を書く
--   ② app.ticket_job_context（K-565 の 20261122100500 の版）：本文の行が無ければ空の本文として組む（前の区画は読まない）
--   ③ app.ticket_delegate(uuid, text)（同じ版）：確認項目が 0 件で理由が無ければ止める（本文の行の有る無しを見ない）
--   ④ app.ticket_complete：前の 4 引数を落とし、(p_ticket uuid, p_confirmed boolean) で作る（K-566 の 20261122100600 の版。本文の行が無ければ未チェックは 0）
--   中に begin／commit を書かない（migrate.ts が 1 本を 1 つの取引で当てる）。もう一度当てても誤りにならない形

-- ---------------------------------------------------------------- ① 作る
create or replace function app.ticket_create(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id(); v_me uuid := app.user_id();
  v_scope uuid; v_kind uuid; v_assignee uuid; v_parent uuid; v_stage uuid; v_id uuid; v_number text;
  v_sid uuid; v_body_in jsonb; nm uuid; v_notify uuid[];
  v_specs jsonb := coalesce(p->'specs', '[]'::jsonb); v_spec record; v_spec_err text; v_fields jsonb;
  v_links jsonb := coalesce(p->'links', '[]'::jsonb); v_link record; v_link_res jsonb; v_link_err text;
begin
  if v_tenant is null or v_me is null or not app.member_ok() then
    return jsonb_build_object('ok', false, 'status', 403, 'code', 'FORBIDDEN');
  end if;
  v_scope := nullif(p->>'scope_id', '')::uuid; v_kind := nullif(p->>'kind_id', '')::uuid;
  v_assignee := nullif(p->>'assignee_member_id', '')::uuid; v_parent := nullif(p->>'parent_ticket_id', '')::uuid;
  if not exists (select 1 from scopes s where s.id = v_scope and s.tenant_id = v_tenant and s.deleted_at is null)
     or not has_permission(v_me, 'tickets', v_scope, 'edit') then
    return jsonb_build_object('ok', false, 'status', 403, 'code', 'FORBIDDEN', 'field', 'scope_id');
  end if;
  if not exists (select 1 from ticket_kinds k where k.id = v_kind and k.tenant_id = v_tenant and k.deleted_at is null) then
    return jsonb_build_object('ok', false, 'status', 404, 'code', 'KIND_GONE', 'field', 'kind_id');
  end if;
  if not app.ticket_member_ok(v_tenant, v_assignee) then
    return jsonb_build_object('ok', false, 'status', 404, 'code', 'ASSIGNEE_GONE', 'field', 'assignee_member_id');
  end if;
  if v_parent is not null and not exists (
       select 1 from tickets t where t.id = v_parent and t.tenant_id = v_tenant and t.deleted_at is null and app.ticket_visible(t.id)) then
    return jsonb_build_object('ok', false, 'status', 404, 'code', 'PARENT_NOT_FOUND', 'field', 'parent_ticket_id');
  end if;
  select coalesce(array_agg(distinct x::uuid), '{}') into v_notify from jsonb_array_elements_text(coalesce(p->'notify_member_ids', '[]'::jsonb)) x;
  foreach nm in array v_notify loop
    if not app.ticket_member_ok(v_tenant, nm) then
      return jsonb_build_object('ok', false, 'status', 404, 'code', 'NOTIFY_GONE', 'field', 'notify_member_ids');
    end if;
  end loop;
  -- 本文 1 枚（body）：doc と text の 2 つだけを取り、形と上限を確かめる（口が先に確かめるので、ここは最後の砦）。
  --   無い・null なら空の本文（版 1）。区画の入力は読まない（知らない鍵として捨てる・K-578）
  if p->'body' is not null and jsonb_typeof(p->'body') <> 'null' then
    v_body_in := jsonb_build_object('doc', p->'body'->'doc', 'text', p->'body'->'text');
  else
    v_body_in := jsonb_build_object('doc', jsonb_build_object('type', 'doc', 'content', '[]'::jsonb), 'text', '');
  end if;
  if not app.ticket_body_valid(v_body_in) then
    return jsonb_build_object('ok', false, 'status', 422, 'code', 'BODY_INVALID', 'field', 'body');
  end if;
  -- 確認項目の文（K-437）：1 件ずつ K-434 の app.test_spec_title_check で確かめる（前後の空白を落として 1〜200 字・長さは生の字）。外れは 422・欄 specs.<番号>
  if jsonb_typeof(v_specs) <> 'array' then
    return jsonb_build_object('ok', false, 'status', 422, 'code', 'SPEC_INVALID', 'field', 'specs');
  end if;
  for v_spec in select e.value, e.n from jsonb_array_elements(v_specs) with ordinality as e(value, n) loop
    v_spec_err := app.test_spec_title_check(v_spec.value);
    if v_spec_err is not null then
      return jsonb_build_object('ok', false, 'status', 422, 'code', 'SPEC_INVALID', 'field', 'specs.' || (v_spec.n - 1));
    end if;
  end loop;
  select id into v_stage from ticket_stages where tenant_id = v_tenant and key = 'todo' and deleted_at is null;
  begin   -- 断り（会社の項目）でこの塊を丸ごと戻すための入れ子（下の exception when sqlstate 'KF437'）
  begin
    insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title, assignee_member_id, parent_ticket_id,
                         start_on, due_on, priority, priority_reason, estimate_minutes, created_by, updated_by)
    values (v_tenant, v_scope, 'pending', v_kind, v_stage, p->>'title', v_assignee, v_parent,
            nullif(p->>'start_on', '')::date, (p->>'due_on')::date, coalesce(nullif(p->>'priority', ''), 'mid'),
            nullif(p->>'priority_reason', ''), nullif(p->>'estimate_minutes', '')::int, v_me, v_me)
    returning id, number into v_id, v_number;
  exception when sqlstate '22023' then
    if sqlerrm like '%3 段%' then return jsonb_build_object('ok', false, 'status', 409, 'code', 'PARENT_DEPTH', 'field', 'parent_ticket_id'); end if;
    raise;
  end;
  insert into ticket_sections (tenant_id, ticket_id, section_key, position, body, version, created_by, updated_by)
    values (v_tenant, v_id, 'body', 0, v_body_in, 1, v_me, v_me) returning id into v_sid;
  insert into ticket_section_versions (tenant_id, ticket_id, section_id, version, body, edited_by, created_by)
    values (v_tenant, v_id, v_sid, 1, v_body_in, v_me, v_me);
  -- 会社の項目の値（K-437・K-564）：確かめと書き込みは app.ticket_fields_set 1 つだけ（作るとき＝p_create true：値の行だけを書く・必須の項目は送らなくても見る）。
  --   断り（field_not_found＝404・not_in_kind・bad_option・bad_type・required_empty＝409）はこの塊ごと戻して言葉を返す
  v_fields := app.ticket_fields_set(v_id, coalesce(p->'fields', '{}'::jsonb), true);
  if v_fields ? 'error' then
    raise exception using errcode = 'KF437', message = v_fields->>'error';
  end if;
  -- 確認項目（K-437）：文だけの行（チェック無し・出どころ manual・版 1）を渡した順に 1 文で入れる。やり取りの行は足さない（作った時は更新でない）
  insert into test_specs (tenant_id, ticket_id, check_kind, title, params, created_by, updated_by, created_at)
    select v_tenant, v_id, null, btrim(e.value #>> '{}', E' \t\r\n\f\v　'), '{}'::jsonb, v_me, v_me,
           now() + (e.n * interval '1 microsecond')
      from jsonb_array_elements(v_specs) with ordinality as e(value, n);
  -- つながり（K-581）：links を並びの順に 1 件ずつ K-441 の app.ticket_link_add で張る（確かめと証跡はその関数の 1 か所）。
  --   断り（相手が無い・消した・見えない・別の会社＝404／相手に書けない＝403）はこの塊ごと戻して言葉を返す。起きないはずの言葉は例外（取引ごと戻す）
  if jsonb_typeof(v_links) <> 'array' then
    raise exception 'app.ticket_create: links は並びで渡す';
  end if;
  for v_link in select e.value from jsonb_array_elements(v_links) with ordinality as e(value, n) order by e.n loop
    v_link_res := app.ticket_link_add(v_id, jsonb_build_object('other_ticket_id', v_link.value->>'other_ticket_id',
                                                               'kind', v_link.value->>'kind'));
    if (v_link_res->>'ok') = 'true' then
      continue;
    end if;
    v_link_err := v_link_res->>'error';
    if v_link_err in ('not_found', 'gone') then
      raise exception using errcode = 'KL581', message = 'LINK_GONE';
    elsif v_link_err in ('not_writable', 'not_member') then
      raise exception using errcode = 'KL581', message = 'LINK_FORBIDDEN';
    end if;
    raise exception 'app.ticket_create: つなぐ所の知らない答え（%）', coalesce(v_link_err, 'null');
  end loop;
  if v_assignee <> v_me then
    insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, dedupe_key, created_by)
      values (v_tenant, v_assignee, 'inapp', 'ticket.assigned', jsonb_build_object('ticket_id', v_id, 'number', v_number, 'title', p->>'title'),
              'ticket_assigned:' || v_id || ':' || v_assignee, v_me);
  end if;
  foreach nm in array v_notify loop
    if nm <> v_me and nm <> v_assignee then
      insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, dedupe_key, created_by)
        values (v_tenant, nm, 'inapp', 'ticket.created', jsonb_build_object('ticket_id', v_id, 'number', v_number, 'title', p->>'title'),
                'ticket_created:' || v_id || ':' || nm, v_me);
    end if;
  end loop;
  for nm in select (x)::uuid from unnest(array[nullif(p->>'draft_id', ''), nullif(p->>'source_draft_id', '')]) as x where x is not null loop
    delete from app.ticket_drafts where tenant_id = v_tenant and member_id = v_me and draft_id = nm;
    insert into app.ticket_drafts_used (tenant_id, member_id, draft_id) values (v_tenant, v_me, nm)
      on conflict (tenant_id, member_id, draft_id) do update set used_at = now();
  end loop;
  delete from app.ticket_drafts_used where tenant_id = v_tenant and member_id = v_me and used_at < now() - interval '30 days';
  exception when sqlstate 'KF437' then
    return jsonb_build_object('ok', false, 'status', case when sqlerrm = 'field_not_found' then 404 else 409 end,
                              'code', 'FIELD', 'field', 'fields', 'detail', sqlerrm);
    when sqlstate 'KL581' then
      return jsonb_build_object('ok', false, 'status', case when sqlerrm = 'LINK_GONE' then 404 else 403 end, 'code', sqlerrm);
  end;
  return jsonb_build_object('ok', true, 'id', v_id, 'number', v_number);
end $$;
revoke all on function app.ticket_create(jsonb) from public;
grant execute on function app.ticket_create(jsonb) to kaname_app;

-- ---------------------------------------------------------------- ② 仕事の中身を組む
create or replace function app.ticket_job_context(p_ticket uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare t tickets%rowtype; v_text text; v_specs text; v_prompt text; v_sess text; v_sess_member uuid; rec record;
        v_lines text[] := '{}'; v_total int := 0; v_head text; v_summary text;
begin
  select * into t from tickets where id = p_ticket;
  if t.id is null then return null; end if;
  -- 本文 → 項目 → 確認項目（K-565）。本文の行（鍵 body・消していない）が無ければ空の本文として組む（見出し「本文」を出さない・区画は読まない・K-578）
  v_prompt := 'Kaname のチケット「' || t.number || ' ' || t.title || '」の成果物を作ってください。'
              || '外（メール・送信・応募など）には何も出さず、作ったものを最後の返事の本文で返してください。'
              || 'チケットの本文と項目は Kaname の道具 ticket_read で読めます。';
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
              '[やり取り] ' || to_char(m.created_at at time zone 'Asia/Tokyo', 'MM/DD HH24:MI') || ' ' || coalesce(app.member_name(m.author_member_id), '') || ': '
              || left(regexp_replace(coalesce(m.body, ''), E'[\\r\\n]+', ' ', 'g'), 400) as line
         from ticket_messages m where m.ticket_id = t.id and m.kind <> 'system' and m.deleted_at is null
        order by m.created_at desc limit 10)
      union all
      (select d.decided_at,
              '[決定] ' || to_char(d.decided_at at time zone 'Asia/Tokyo', 'MM/DD') || ' ' || left(regexp_replace(coalesce(d.text, ''), E'[\\r\\n]+', ' ', 'g'), 200)
         from ticket_decisions d where d.ticket_id = t.id and d.deleted_at is null
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
     and (t.completed_at is null or r.created_at > t.completed_at)   -- ★ K-166 が足した所：完了の前の作る実行の続きは使わない（D-125.155・K63-API-054・055）
   order by r.created_at desc limit 1;
  return jsonb_build_object('prompt', v_prompt, 'agent_session_id', v_sess, 'agent_member_id', v_sess_member);
end $$;
-- 中だけで使う（任せる関数と K-63 の承認の関数が呼ぶ）。kaname_app にも渡さない（D-128.171・K62-API-046）
revoke all on function app.ticket_job_context(uuid) from public;

-- ---------------------------------------------------------------- ③ 任せる
create or replace function app.ticket_delegate(p_ticket uuid, p_no_spec_reason text) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_tenant uuid := app.tenant_id(); v_me uuid := app.user_id(); t tickets%rowtype; v_stage text; v_run uuid; v_job uuid; v_ctx jsonb;
        v_reason text; v_specs int;
begin
  if v_tenant is null or v_me is null or not app.member_ok() then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  -- 理由の形（最後の砦）：送られたなら前後の空白（全角・タブ・改行も）を落として 1〜500 字
  if p_no_spec_reason is not null then
    v_reason := btrim(p_no_spec_reason, E' \t\r\n　');
    if length(v_reason) < 1 or length(v_reason) > 500 then return jsonb_build_object('ok', false, 'code', 'REASON_INVALID'); end if;
  end if;
  select * into t from tickets where id = p_ticket and tenant_id = v_tenant and deleted_at is null for update;
  if t.id is null or not app.ticket_visible(p_ticket) then return jsonb_build_object('ok', false, 'code', 'NOT_FOUND'); end if;
  if not app.ticket_writable(p_ticket) then return jsonb_build_object('ok', false, 'code', 'FORBIDDEN'); end if;
  select r.id into v_run from action_runs r
   where r.ticket_id = p_ticket and r.status_id in ('queued', 'running', 'asking') and r.deleted_at is null
   order by r.created_at desc limit 1;
  if v_run is not null then return jsonb_build_object('ok', false, 'code', 'RUNNING', 'run_id', v_run); end if;
  select s.key into v_stage from ticket_stages s where s.id = t.stage_id;
  if coalesce(v_stage, '') not in ('todo', 'doing', 'hold') then return jsonb_build_object('ok', false, 'code', 'NOT_DELEGABLE'); end if;
  if not exists (select 1 from sessions s where s.member_id in (select app.account_members(v_me)) and s.kind_id = 'bridge'
                    and s.revoked_at is null and s.deleted_at is null) then
    return jsonb_build_object('ok', false, 'code', 'NO_PC');
  end if;
  -- 確認項目の数（全部のチケット。本文の行の有る無しを見ない・K-578）。0 件なら使わない理由が要る
  select count(*) into v_specs from test_specs x where x.ticket_id = t.id and x.tenant_id = t.tenant_id and x.deleted_at is null;
  if v_specs = 0 then
    if v_reason is null then return jsonb_build_object('ok', false, 'code', 'NO_SPEC'); end if;
    update tickets set no_spec_reason = v_reason where id = t.id;
  end if;
  v_ctx := app.ticket_job_context(p_ticket);
  insert into bridge_jobs (tenant_id, scope_id, member_id, state_id, prompt, agent_session_id, kind, permission_mode, created_by)
    values (t.tenant_id, t.scope_id, v_me, 'queued', v_ctx->>'prompt',
            case when (v_ctx->>'agent_member_id')::uuid = v_me then v_ctx->>'agent_session_id' end,
            'ticket', 'manual', v_me)
    returning id into v_job;
  insert into action_runs (tenant_id, scope_id, ticket_id, phase, status_id, bridge_job_id, created_by, updated_by)
    values (t.tenant_id, t.scope_id, t.id, 'make', 'queued', v_job, v_me, v_me) returning id into v_run;
  perform app.ticket_stage_to(t.id, 'running', v_me);
  update tickets set delegated_to_clone = true where id = t.id;
  perform app.ticket_system_line(t.id, v_me, app.member_name(v_me) || 'のAI に任せました');
  return jsonb_build_object('ok', true, 'run_id', v_run, 'job_id', v_job,
                            'pc', case when app.account_pc_live(v_me) then 'live' else 'asleep' end);
end $$;
revoke all on function app.ticket_delegate(uuid, text) from public;
grant execute on function app.ticket_delegate(uuid, text) to kaname_app;

-- ---------------------------------------------------------------- ④ 完了にする（引数が変わるので前の 4 引数を落としてから作る）
-- squawk-ignore ban-drop-function
drop function if exists app.ticket_complete(uuid, integer[], integer, boolean);
create or replace function app.ticket_complete(p_ticket uuid, p_confirmed boolean)
returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_tenant uuid := app.tenant_id(); v_me uuid := app.user_id(); t tickets%rowtype; v_stage text;
        v_doc jsonb; v_body_n integer := 0; v_specs_n integer := 0; v_kids jsonb;
        v_err text; v_hidden integer := 0;   -- ★ K-166 が足した所：守りの判定の言葉・押した人に見えない終わっていない子の数
begin
  if v_tenant is null or v_me is null then return jsonb_build_object('error', 'not_member'); end if;
  -- 同じチケットの同時の 2 本は 1 本にする（チケットの行で待ち合わせる。後の 1 本は完了の後の行を見る）
  select * into t from tickets where id = p_ticket and tenant_id = v_tenant for update;
  if t.id is null or t.deleted_at is not null then return jsonb_build_object('error', 'not_found'); end if;
  -- ★ K-166 が直した所（ここから v_err の if の終わりまで）：守りの判定（今のメンバーか・書けるか）の所で例外になったら、
  --   外に投げずに guard_failed を返して何も書かない（fail-closed・口は 503・K63-API-063）。判定の中身と順は 0100 のまま
  begin
    if not app.approval_member_now() then v_err := 'not_member';
    elsif not app.ticket_writable(t.id) then v_err := 'not_writable';
    end if;
  exception when others then
    return jsonb_build_object('error', 'guard_failed');
  end;
  if v_err is not null then return jsonb_build_object('error', v_err); end if;
  select s.key into v_stage from ticket_stages s where s.id = t.stage_id;
  if v_stage = 'done' then return jsonb_build_object('error', 'done'); end if;
  -- 承認待ち・実行中・確認中、走っている実行、決まっていない承認待ちがあるうちは完了にできない（D-128.49）
  if v_stage in ('awaiting_approval', 'running', 'checking')
     or exists (select 1 from action_runs r
                 where r.ticket_id = t.id and r.status_id in ('queued', 'running', 'asking') and r.deleted_at is null)
     or exists (select 1 from approvals a
                 where a.ticket_id = t.id and a.decision is null and a.withdrawn_at is null and a.deleted_at is null) then
    return jsonb_build_object('error', 'stage');
  end if;
  -- ★ K-166 が足した所（この 1 行）：完了にできるのは作業中だけ。未着手・保留は not_doing（409・E-CONF-019・決める人の答え db67f3cde899 ②・83361b2157fd）
  if coalesce(v_stage, '') <> 'doing' then return jsonb_build_object('error', 'not_doing'); end if;
  if p_confirmed is distinct from true then return jsonb_build_object('error', 'not_confirmed'); end if;
  -- 終わっていない子（消されていない・段が完了でない）。番号と題名を返す（D-128.138）
  -- ★ K-166 が直した所（ここから children_left の if の終わりまで）：押した人に見える子（app.ticket_visible）だけを children に入れ、
  --   見えない子は数だけを children_hidden で返す（id・番号・題名を出さない・決める人の答え db67f3cde899 ①）。
  --   見える子が 0 でも見えない子が 1 つでもあれば断る（K63-API-096・097）
  select jsonb_agg(jsonb_build_object('id', c.id, 'label', c.number || ' ' || c.title) order by c.number, c.id) filter (where k.seen),
         count(*) filter (where not k.seen)
    into v_kids, v_hidden
    from tickets c left join ticket_stages s on s.id = c.stage_id
         cross join lateral (select coalesce(app.ticket_visible(c.id), false) as seen) k
   where c.parent_ticket_id = t.id and c.tenant_id = t.tenant_id and c.deleted_at is null and coalesce(s.key, '') <> 'done';
  if v_kids is not null or v_hidden > 0 then
    return jsonb_build_object('error', 'children_left', 'children', coalesce(v_kids, '[]'::jsonb), 'children_hidden', v_hidden);
  end if;

  -- 未チェックを数える（書く前の同じ取引の中・チケットの行を for update で取った後。止めない・答えに返すだけ・D-150.42）
  --   本文の行（鍵 body・消していない）が在れば、文書の木の taskItem のうち attrs.checked が真偽の true でない物。
  --   本文の行が無ければ 0（前の区画は読まない・K-578）。確認項目は消していない行の checked_at が空の物
  select s.body->'doc' into v_doc from ticket_sections s
   where s.ticket_id = t.id and s.section_key = 'body' and s.deleted_at is null;
  if found then
    v_body_n := app.ticket_body_unchecked(v_doc);
  end if;
  select count(*)::integer into v_specs_n from test_specs x
   where x.ticket_id = t.id and x.tenant_id = t.tenant_id and x.deleted_at is null and x.checked_at is null;

  -- 書く（1 回の書き込み）：段・完了の時刻と押した人・やり取りの 1 行・証跡。区画・本文の行・確認項目は書かない
  perform app.ticket_stage_to(t.id, 'done', v_me);
  update tickets set completed_at = now(), completed_by = v_me where id = t.id returning * into t;
  perform app.ticket_system_line(t.id, v_me, app.member_name(v_me) || 'が完了にしました');
  -- ナレッジの候補は骨格では出さない（「候補はまだ出していません」・D-128.138）ので、候補の数は 0 と記録する
  insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
    values (t.tenant_id, v_me, 'member', 'ticket.complete', 'tickets', t.id::text, 'C2',
            jsonb_build_object('number', t.number, 'knowledge_candidates', 0), v_me);
  return jsonb_build_object('ticket_id', t.id, 'number', t.number, 'completed_at', t.completed_at, 'completed_by', v_me,
                            'notify_member_ids', coalesce((select jsonb_agg(x) from app.ticket_completed_recipients(t.id) x), '[]'::jsonb),
                            'unchecked', jsonb_build_object('body', v_body_n, 'specs', v_specs_n));
end $$;
revoke all on function app.ticket_complete(uuid, boolean) from public;
grant execute on function app.ticket_complete(uuid, boolean) to kaname_app;
