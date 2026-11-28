-- 0068 自分のAI が作ったファイル・調べた結果を道具 artifact_put で成果物として渡す（D-121・T-B-41）。
--   道具は仕事の間だけの鍵で呼ばれる（D-110.3）。中身は API が先に置き場（関門 C4）に置き、ここは台帳（成果物と版）だけを書く。
--   返事はまだ書かれていないので、成果物は仕事（source_job_id）に結び、結末が書かれたときに返事（source_message_id）へ結び直す
--   （返事の下にカードが並ぶ・D-121.3）。中身は証跡にも DB にも書かない（D-100.3・D-121.5）
alter table artifacts add column if not exists source_job_id uuid references bridge_jobs(id);
create index if not exists artifacts_source_job_id_idx on artifacts (source_job_id);

create or replace function app.artifact_create_from_job(p_member uuid, p_job uuid, p_title text, p_format text, p_ref text, p_size bigint) returns uuid
language plpgsql security definer set search_path = public, app as $$
declare j bridge_jobs%rowtype; v_scope uuid; v_id uuid; v_title text;
begin
  -- 動いている仕事（running／asking）の持ち主だけ。終わった仕事・別の人の鍵では作れない
  select * into j from bridge_jobs where id = p_job and member_id = p_member and state_id in ('running', 'asking') and deleted_at is null;
  if j.id is null then return null; end if;
  select m.scope_id into v_scope from members m where m.id = p_member and m.deleted_at is null;
  if v_scope is null then return null; end if;
  if coalesce(p_ref, '') = '' or coalesce(p_format, '') = '' then return null; end if;
  v_title := left(coalesce(nullif(trim(p_title), ''), '成果物'), 80);
  insert into artifacts (tenant_id, scope_id, format_id, storage_ref, source_conversation_id, source_job_id, title, owner_member_id, current_version, created_by, updated_by)
    values (j.tenant_id, v_scope, p_format, p_ref, j.conversation_id, j.id, v_title, p_member, 1, p_member, p_member)
    returning id into v_id;
  insert into artifact_versions (tenant_id, scope_id, artifact_id, version, storage_ref, size_bytes, owner_member_id, note, created_by, updated_by)
    values (j.tenant_id, v_scope, v_id, 1, p_ref, p_size, p_member, '自分のAI が渡した', p_member, p_member);
  -- 証跡：名前・種類・大きさだけ（中身は書かない・D-121.5）
  perform app.agent_tool_audit(p_member, j.tenant_id, 'agent.artifact_put', 'artifact', v_id,
                               jsonb_build_object('title', v_title, 'format', p_format, 'size', p_size, 'job_id', j.id));
  return v_id;
end $$;
grant execute on function app.artifact_create_from_job(uuid, uuid, text, text, text, bigint) to kaname_app;

-- 結末が書かれたら、その仕事で渡した成果物を返事に結ぶ（返事が無い＝止まった仕事は結ばない。会話の一覧には残る）
create or replace function app.artifact_attach_job(p_job uuid) returns int
language plpgsql security definer set search_path = public, app as $$
declare v_msg uuid; n int;
begin
  select m.id into v_msg from messages m where m.job_id = p_job and m.kind = 'ai' and m.deleted_at is null order by m.created_at desc, m.id desc limit 1;
  if v_msg is null then return 0; end if;
  update artifacts set source_message_id = v_msg where source_job_id = p_job and source_message_id is null and deleted_at is null;
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function app.artifact_attach_job(uuid) to kaname_app;
