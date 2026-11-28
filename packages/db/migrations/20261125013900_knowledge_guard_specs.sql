-- 20261125013900 任せたとき：必ず守るのページを確認項目に入れる＋「このチケットで守る物」をやり取りに置く（K-699・関門 C2）
--   ① test_specs_knowledge_uq：同じチケット・同じページの生きている knowledge の行は 1 つ（表の最後の砦）
--   ② app.knowledge_seed_specs(p_ticket, p_member)：必ず守る（app.knowledge_context の must）を確認項目に入れる・題名を直す・外れた物を消す
--      （チェック済みの行は触らない。やり取りの行・証跡は書かない。kaname_app に渡さない＝任せる関数の中からだけ）
--   ③ app.ticket_delegate(uuid, text)：K-578（20261122101600・本文の行の有る無しを見ない版）の本体を写し、3 か所だけ足す
--      1 確認項目の数の決め（読むだけ）：必ず守るが 1 件以上なら NO_SPEC にしない。外れた無チェックの knowledge の行は数えない
--      2 断りが全部通り、仕事と実行を書いた後に種を入れる
--      3 いちばん最後に「守る物」の行（必ず守るが 1 件以上のときだけ）と証跡 knowledge.guard.seed（任せるたび）

-- ---------------------------------------------------------------- ① 1 ページ 1 行
-- squawk-ignore require-concurrent-index-creation
create unique index if not exists test_specs_knowledge_uq on test_specs (ticket_id, source_ref_id)
  where source = 'knowledge' and deleted_at is null;

-- ---------------------------------------------------------------- ② 確認項目の種
create or replace function app.knowledge_seed_specs(p_ticket uuid, p_member uuid) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare c jsonb; t tickets%rowtype; m jsonb; v_ids uuid[] := '{}'; v_page uuid; v_title text; s test_specs%rowtype;
        v_added int := 0; v_kept int := 0; v_retitled int := 0; v_removed int := 0;
begin
  c := app.knowledge_context(p_member, p_ticket);
  if c is null then raise exception 'KNW_GUARD_CONTEXT'; end if;
  select * into t from tickets where id = p_ticket and deleted_at is null;
  if t.id is null then raise exception 'KNW_GUARD_CONTEXT'; end if;
  for m in select x from jsonb_array_elements(coalesce(c->'must', '[]'::jsonb)) as x loop
    v_page := (m->>'id')::uuid;
    v_ids := v_ids || v_page;
    v_title := '『' || left(btrim(coalesce(m->>'title', '')), 190) || '』を守った';
    select * into s from test_specs x
     where x.ticket_id = t.id and x.source = 'knowledge' and x.source_ref_id = v_page and x.deleted_at is null;
    if s.id is null then
      insert into test_specs (tenant_id, ticket_id, title, check_kind, params, source, source_ref_id, created_by, updated_by, created_at)
        values (t.tenant_id, t.id, v_title, null, '{}'::jsonb, 'knowledge', v_page, p_member, p_member, clock_timestamp());
      v_added := v_added + 1;
    elsif s.checked_at is null and s.title <> v_title then
      update test_specs set title = v_title, version = version + 1, updated_by = p_member, updated_at = now() where id = s.id;
      v_retitled := v_retitled + 1;
    else
      v_kept := v_kept + 1;
    end if;
  end loop;
  with gone as (
    update test_specs x set deleted_at = now(), updated_by = p_member, updated_at = now()
     where x.ticket_id = t.id and x.source = 'knowledge' and x.deleted_at is null and x.checked_at is null
       and (x.source_ref_id is null or not (x.source_ref_id = any (v_ids)))
    returning 1)
  select count(*) into v_removed from gone;
  return jsonb_build_object('added', v_added, 'kept', v_kept, 'retitled', v_retitled, 'removed', v_removed);
end $$;
revoke all on function app.knowledge_seed_specs(uuid, uuid) from public;

-- ---------------------------------------------------------------- ③ 任せる（K-578 の本体を写し、3 か所足した）
create or replace function app.ticket_delegate(p_ticket uuid, p_no_spec_reason text) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_tenant uuid := app.tenant_id(); v_me uuid := app.user_id(); t tickets%rowtype; v_stage text; v_run uuid; v_job uuid; v_ctx jsonb;
        v_reason text; v_specs int; v_kc jsonb; v_must jsonb; v_seed jsonb; v_opened jsonb;
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
  -- ★ K-699 の 1：今の必ず守る（読むだけ・書かない）。読めなければ例外（黙って守る物なしで任せない）
  v_kc := app.knowledge_context(v_me, p_ticket);
  if v_kc is null then raise exception 'KNW_GUARD_CONTEXT'; end if;
  v_must := coalesce(v_kc->'must', '[]'::jsonb);
  -- 確認項目の数（全部のチケット。本文の行の有る無しを見ない・K-578）。必ず守るが 0 件のときだけ数え、0 件なら使わない理由が要る
  if jsonb_array_length(v_must) = 0 then
    -- 種を入れた後に残る行だけ数える（必ず守るから外れた無チェックの knowledge の行は、種で消えるので数えない）
    select count(*) into v_specs from test_specs x
     where x.ticket_id = t.id and x.tenant_id = t.tenant_id and x.deleted_at is null
       and not (x.source = 'knowledge' and x.checked_at is null);
    if v_specs = 0 then
      if v_reason is null then return jsonb_build_object('ok', false, 'code', 'NO_SPEC'); end if;
      update tickets set no_spec_reason = v_reason where id = t.id;
    end if;
  end if;
  v_ctx := app.ticket_job_context(p_ticket);
  insert into bridge_jobs (tenant_id, scope_id, member_id, state_id, prompt, agent_session_id, kind, permission_mode, created_by)
    values (t.tenant_id, t.scope_id, v_me, 'queued', v_ctx->>'prompt',
            case when (v_ctx->>'agent_member_id')::uuid = v_me then v_ctx->>'agent_session_id' end,
            'ticket', 'manual', v_me)
    returning id into v_job;
  insert into action_runs (tenant_id, scope_id, ticket_id, phase, status_id, bridge_job_id, created_by, updated_by)
    values (t.tenant_id, t.scope_id, t.id, 'make', 'queued', v_job, v_me, v_me) returning id into v_run;
  -- ★ K-699 の 2：確認項目の種（断りが全部通った後）
  v_seed := app.knowledge_seed_specs(t.id, v_me);
  perform app.ticket_stage_to(t.id, 'running', v_me);
  update tickets set delegated_to_clone = true where id = t.id;
  perform app.ticket_system_line(t.id, v_me, app.member_name(v_me) || 'のAI に任せました');
  -- ★ K-699 の 3：「守る物」の行（必ず守るが 1 件以上）と証跡（任せるたび）。いちばん最後
  if jsonb_array_length(v_must) > 0 then
    -- 前の仕事でこのチケットのために AI が開いたページ：ページごとに新しい 1 つ・今も見える物だけ・新しい順・20 件まで（本文は入れない）
    select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'title', o.title, 'place', o.place) order by o.seen_at desc, o.id), '[]'::jsonb)
      into v_opened
      from (select v.id, v.seen_at, p.title,
                   array_to_string(array[app.kn_shelf_name(p.scope_id, p.is_personal)] || coalesce(app.kn_folder_names(p.folder_id), '{}'), ' › ') as place
              from (select distinct on (r.ref_id) r.ref_id as id, r.seen_at
                      from reference_logs r
                     where r.ticket_id = t.id and r.ref_type = 'page' and r.deleted_at is null and r.ref_id is not null
                       and r.ref_id in (select app.kn_ai_visible_pages(v_me, t.id))
                     order by r.ref_id, r.seen_at desc) v
              join knowledge_pages p on p.id = v.id and p.deleted_at is null
             order by v.seen_at desc, v.id
             limit 20) o;
    perform app.knowledge_ticket_line(t.id, 'guard_list',
      jsonb_build_array(jsonb_build_object(
        'field', 'guard_list', 'from', null, 'to', jsonb_array_length(v_must)::text, 'note', null,
        'must', (select coalesce(jsonb_agg(jsonb_build_object('id', x->>'id', 'title', x->>'title', 'place', x->>'place') order by i), '[]'::jsonb)
                   from jsonb_array_elements(v_must) with ordinality as e(x, i)),
        'opened', v_opened)),
      'AI がこのチケットで守る物を並べました（必ず守る ' || jsonb_array_length(v_must) || ' 件）');
  end if;
  perform app.record_audit('knowledge.guard.seed', 'tickets', t.id::text, 'C2',
    jsonb_build_object('added', (v_seed->>'added')::int, 'retitled', (v_seed->>'retitled')::int, 'removed', (v_seed->>'removed')::int));
  return jsonb_build_object('ok', true, 'run_id', v_run, 'job_id', v_job,
                            'pc', case when app.account_pc_live(v_me) then 'live' else 'asleep' end);
end $$;
revoke all on function app.ticket_delegate(uuid, text) from public;
grant execute on function app.ticket_delegate(uuid, text) to kaname_app;
