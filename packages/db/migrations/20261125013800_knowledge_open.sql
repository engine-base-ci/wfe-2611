-- 20261125013800 AI がページを開く道具 knowledge_open（K-698・D-125.28・D-125.35・D-128.50・D-128.51・D-110.3・D-128.163・関門 C2）
--   ① reference_logs の直し：会話の仕事（チケットなし）の記録を持てるよう ticket_id の not null を外し、member_id・bridge_job_id を足す。
--      持ち主の無い行は入らない（check）。同じ仕事・同じページの生きている記録は 1 つ（部分一意）。同じ会社の引き金を app.kn_open_same_tenant に付け替える
--      （前の app.ticket_around_same_tenant はほかの表が使うので触らない）。前からの行・前からの入れ方（ticket_id だけ）は通る。行の守りは変えない
--   ② app.knowledge_open(p_job, p_token_hash, p_session, p_page)：鍵のハッシュと受け取った PC を DB でも見る（2 層目・app.ticket_tool_read と同じ形）。
--      その仕事で見える物（K-697 の app.kn_ai_visible_pages）だけ開ける。見えない・無い・消えた・下書き・別の会社・範囲の外・鍵違いはどれも null。
--      開いた記録 1 行（同じ仕事で同じページは 1 つ）・チケットの仕事だけやり取りに 1 行・証跡は開くたび。全部 1 つの取引（失敗すれば全部戻る）
--   もう 1 度当てても壊れない形にする

-- ---------------------------------------------------------------- ① reference_logs の直し
-- 会話の仕事の記録はチケットを持たない（持ち主の無い行は下の check が止める。前からの読み手は ticket_id で絞るので空の行に当たらない）
-- squawk-ignore ban-drop-not-null
alter table reference_logs alter column ticket_id drop not null;
alter table reference_logs add column if not exists member_id uuid references members(id);
alter table reference_logs add column if not exists bridge_job_id uuid references bridge_jobs(id);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'reference_logs_owner_ck') then
    alter table reference_logs add constraint reference_logs_owner_ck check (ticket_id is not null or bridge_job_id is not null);
  end if;
end $$;
create unique index if not exists reference_logs_page_job_uq on reference_logs (bridge_job_id, ref_id)
  where ref_type = 'page' and bridge_job_id is not null and deleted_at is null;
create index if not exists reference_logs_ref_idx on reference_logs (tenant_id, ref_id);
create index if not exists reference_logs_member_idx on reference_logs (member_id);
create index if not exists reference_logs_bridge_job_idx on reference_logs (bridge_job_id);

-- 同じ会社の行だけ：チケット・人・仕事のうち入っている物が、どれも行の会社のもの
create or replace function app.kn_open_same_tenant() returns trigger
language plpgsql security definer set search_path = public, app, pg_temp as $$
begin
  if new.ticket_id is not null
     and not exists (select 1 from tickets where id = new.ticket_id and tenant_id = new.tenant_id) then
    raise exception '元のチケットと同じ会社の行だけ' using errcode = '22023';
  end if;
  if new.member_id is not null
     and not exists (select 1 from members where id = new.member_id and tenant_id = new.tenant_id) then
    raise exception '同じ会社の人の行だけ' using errcode = '22023';
  end if;
  if new.bridge_job_id is not null
     and not exists (select 1 from bridge_jobs where id = new.bridge_job_id and tenant_id = new.tenant_id) then
    raise exception '同じ会社の仕事の行だけ' using errcode = '22023';
  end if;
  return new;
end $$;
revoke all on function app.kn_open_same_tenant() from public;
drop trigger if exists reference_logs_same_tenant on reference_logs;
create trigger reference_logs_same_tenant before insert or update on reference_logs
  for each row execute function app.kn_open_same_tenant();

-- ---------------------------------------------------------------- ② ページを開く
create or replace function app.knowledge_open(p_job uuid, p_token_hash text, p_session uuid, p_page uuid) returns jsonb
language plpgsql volatile security definer set search_path = public, app, pg_temp as $$
declare
  j bridge_jobs%rowtype;
  v_ticket uuid;
  v_run uuid;
  p knowledge_pages%rowtype;
  v_top uuid;
  v_shelf text;
  v_path text;
  v_place text;
  v_body text;
  v_new uuid;
begin
  if p_job is null or p_token_hash is null or p_session is null or p_page is null then return null; end if;
  -- 1 仕事：動いている・鍵のハッシュが合う・受け取った PC から・持ち主が消されていない・止められていない
  select b.* into j from bridge_jobs b
    join members m on m.id = b.member_id
   where b.id = p_job and b.deleted_at is null and b.state_id in ('running', 'asking')
     and b.tool_token_hash is not null and b.tool_token_hash = p_token_hash and b.taken_session_id = p_session
     and m.deleted_at is null and m.suspended_at is null;
  if j.id is null then return null; end if;
  -- 2 チケット：チケットの仕事はその仕事の最新の実行のチケット。会話の仕事は無し
  if j.kind = 'ticket' then
    select ar.ticket_id, ar.id into v_ticket, v_run from action_runs ar
     where ar.bridge_job_id = j.id order by ar.created_at desc limit 1;
    if v_ticket is null then return null; end if;
  end if;
  -- 3 その仕事で見える物だけ
  if not exists (select 1 from app.kn_ai_visible_pages(j.member_id, v_ticket) v(id) where v.id = p_page) then
    return null;
  end if;
  select * into p from knowledge_pages where id = p_page and tenant_id = j.tenant_id and deleted_at is null;
  if p.id is null then return null; end if;
  v_top := app.kn_company_scope_of(j.tenant_id);
  v_shelf := case when p.is_personal then '自分'
                  when p.scope_id = v_top then '会社'
                  else (select s.name from scopes s where s.id = p.scope_id) end;
  with recursive up(id, parent, name, depth) as (
    select f.id, f.parent_folder_id, f.name, 1 from knowledge_folders f
     where f.id = p.folder_id and f.tenant_id = j.tenant_id
    union all
    select f.id, f.parent_folder_id, f.name, up.depth + 1 from knowledge_folders f join up on f.id = up.parent
     where f.tenant_id = j.tenant_id and up.depth < 64)
  select string_agg(up.name, ' › ' order by up.depth desc) into v_path from up;
  v_place := coalesce(v_shelf, '') || coalesce(' › ' || nullif(v_path, ''), '');
  v_body := coalesce((select pv.body->>'text' from knowledge_page_versions pv
                       where pv.page_id = p.id and pv.kind = 'published' and pv.version = p.current_version
                         and pv.deleted_at is null
                       order by pv.created_at desc limit 1), '');
  -- 4 開いた記録（同じ仕事・同じページは 1 つ）
  insert into reference_logs (tenant_id, ticket_id, bridge_job_id, member_id, action_run_id, ref_type, ref_id, title, seen_at, created_by)
  values (j.tenant_id, v_ticket, j.id, j.member_id, v_run, 'page', p.id, p.title, now(), j.member_id)
  on conflict (bridge_job_id, ref_id) where ref_type = 'page' and bridge_job_id is not null and deleted_at is null do nothing
  returning id into v_new;
  -- 5 チケットの仕事で、初めて開いたときだけやり取りに 1 行
  if v_new is not null and v_ticket is not null then
    perform app.knowledge_ticket_line(
      v_ticket, 'knowledge_open',
      jsonb_build_array(jsonb_build_object('field', 'knowledge_open', 'from', null, 'to', p.title, 'note', v_place, 'page_id', p.id)),
      'AI が『' || p.title || '』（' || v_place || '）を開きました');
  end if;
  -- 6 証跡（開くたび・題名と本文は入れない）
  perform app.agent_tool_audit(j.member_id, j.tenant_id, 'tool.knowledge_open', 'knowledge_page', p.id, jsonb_build_object('job_id', j.id));
  -- 7 答え（本文は 50,000 字まで）
  return jsonb_build_object(
    'ok', true,
    'opened_now', v_new is not null,
    'page', jsonb_build_object(
      'id', p.id, 'title', p.title, 'desc', coalesce(p.summary, ''), 'place', v_place,
      'body_text', left(v_body, 50000), 'truncated', char_length(v_body) > 50000, 'version', p.current_version));
end $$;
revoke all on function app.knowledge_open(uuid, text, uuid, uuid) from public;
grant execute on function app.knowledge_open(uuid, text, uuid, uuid) to kaname_app;

insert into app.schema_migrations (name) values ('20261125013800_knowledge_open.sql') on conflict do nothing;
