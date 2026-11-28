-- 20261125014000 破られた数を数える（K-700・D-152.24・D-153.19・関門 C2）。名前の正本は 07_functional/段10-F9/土台-knowledge.md の 6 章と 11_tickets/K-700.md
--   数える出来事は 3 つだけ（機械で確かに分かる物）：
--     ai_unchecked     … AI が結果つきで仕事の終わりを知らせたとき、必ず守るから入った確認項目にチェックが無い（仕事の行が done になる引き金）
--     human_unchecked  … AI が付けたチェックを人が外した（確認項目の行の引き金）
--     ai_self_reported … AI 自身が「守れていなかったので直した」と知らせた（app.knowledge_record_breach を段 6 の道具の入口の関数から呼ぶ）
--   ① 表 knowledge_breaches（追記だけ・書くのは下の関数だけ）② 関数 7 つ ③ 引き金 3 つ。
--   同じチケット・同じページ・同じ出来事は 1 度だけ数える（部分一意）。数えるのは今も必ず守るで効く範囲のページの行だけ（app.knowledge_guard_specs）。
--   引き金は数えそこなっても元の操作（仕事の終わり・チェックを外す）を止めない（警告 1 行・入れ子の取引で数えた物は全部戻る）。
--   同じ migration をもう 1 度当てても壊れない形にする（if not exists・create or replace・drop trigger if exists）。

-- ---------------------------------------------------------------- ① 破られた数の表
create table if not exists knowledge_breaches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  ticket_id uuid not null references tickets(id),
  page_id uuid not null references knowledge_pages(id),
  test_spec_id uuid references test_specs(id),
  kind text not null check (kind in ('ai_unchecked', 'human_unchecked', 'ai_self_reported')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);
drop trigger if exists knowledge_breaches_updated_at on knowledge_breaches;
create trigger knowledge_breaches_updated_at before update on knowledge_breaches for each row execute function app.set_updated_at();

-- 同じチケット・同じページ・同じ出来事は 1 行だけ（同時に 2 つ来ても 1 つ）。K-695 が 30 日の数を数える索引
create unique index if not exists knowledge_breaches_once_uq on knowledge_breaches (ticket_id, page_id, kind) where deleted_at is null;
create index if not exists knowledge_breaches_page_idx on knowledge_breaches (tenant_id, page_id, created_at);

-- 権限と行の守り：アプリの役は読むだけ（書く道は下の security definer の関数だけ）。行の守りは同じ名前の policies（gen_rls.py が作る）
grant select on knowledge_breaches to kaname_app;
revoke insert, update, delete, truncate on knowledge_breaches from kaname_app;
alter table knowledge_breaches enable row level security;
alter table knowledge_breaches force row level security;

-- ---------------------------------------------------------------- ② 関数
-- 別の会社のチケット・ページ・確認項目を指せない（口を通さない書き込みも止める・G-02）
create or replace function app.kn_breach_same_tenant() returns trigger
language plpgsql security definer set search_path = public, app, pg_temp as $$
begin
  if not exists (select 1 from tickets t where t.id = new.ticket_id and t.tenant_id = new.tenant_id)
     or not exists (select 1 from knowledge_pages p where p.id = new.page_id and p.tenant_id = new.tenant_id)
     or (new.test_spec_id is not null and not exists (
           select 1 from test_specs s where s.id = new.test_spec_id and s.tenant_id = new.tenant_id and s.ticket_id = new.ticket_id)) then
    raise exception 'KNW_BREACH_TENANT' using errcode = '22023';
  end if;
  return new;
end $$;
revoke all on function app.kn_breach_same_tenant() from public;

-- そのチケットの確認項目（出どころ knowledge・消していない）のうち、ページが今も生きている必ず守る（公開済み・消していない）で、
--   その行を入れた人（created_by＝任せた人）の AI の範囲（K-697 の app.kn_ai_visible_pages）に入っているページの行の id。チェックの有無は問わない。
--   範囲は任せた人ごとに 1 度だけ引く。任せた人が今のメンバーでない（消された・止められた）なら、その人の行は入らない。K-701 も使う
create or replace function app.knowledge_guard_specs(p_ticket uuid) returns setof uuid
language sql stable security definer set search_path = public, app, pg_temp as $$
  with t as (
    select x.id, x.tenant_id from tickets x where x.id = p_ticket and x.deleted_at is null
  ), s as (
    select ts.id, ts.source_ref_id, ts.created_by, ts.created_at
      from test_specs ts join t on ts.ticket_id = t.id and ts.tenant_id = t.tenant_id
     where ts.deleted_at is null and ts.source = 'knowledge' and ts.source_ref_id is not null and ts.created_by is not null
  ), who as (
    select distinct s.created_by as member_id
      from s join t on true
      join members m on m.id = s.created_by and m.tenant_id = t.tenant_id and m.deleted_at is null and m.suspended_at is null
  ), vis as (
    select who.member_id, v.page_id
      from who cross join lateral app.kn_ai_visible_pages(who.member_id, p_ticket) as v(page_id)
  )
  select s.id
    from s join t on true
    join knowledge_pages p on p.id = s.source_ref_id and p.tenant_id = t.tenant_id
                          and p.deleted_at is null and p.state = 'published' and p.is_must
    join vis on vis.member_id = s.created_by and vis.page_id = s.source_ref_id
   order by s.created_at, s.id
$$;
revoke all on function app.knowledge_guard_specs(uuid) from public;

-- 数える 1 件を書く（範囲の判定は呼ぶ側が済ませた行だけを渡す・この migration の関数の中からだけ）。
--   表に 1 行（一意に当たれば何もせず null）→ やり取りに 1 行（K-697 の app.knowledge_ticket_line）→ 証跡に 1 行。同じ取引
create or replace function app.kn_breach_write(p_tenant uuid, p_ticket uuid, p_spec uuid, p_page uuid, p_kind text, p_note text)
returns uuid
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_id uuid;
  v_title text;
  v_note text;
  v_body text;
begin
  insert into knowledge_breaches (tenant_id, ticket_id, page_id, test_spec_id, kind)
    values (p_tenant, p_ticket, p_page, p_spec, p_kind)
    on conflict (ticket_id, page_id, kind) where deleted_at is null do nothing
    returning id into v_id;
  if v_id is null then
    return null;
  end if;
  select p.title into v_title from knowledge_pages p where p.id = p_page;
  v_note := case when p_note is null or btrim(p_note) = '' then null else left(p_note, 200) end;
  v_body := case p_kind
    when 'ai_unchecked' then
      format('守れていなかった決まりが 1 つ：『%s』（AI が終わりを知らせたのに、チェックが付いていませんでした）', v_title)
    when 'human_unchecked' then
      format('守れていなかった決まりが 1 つ：『%s』（AI が付けたチェックが外されました）', v_title)
    else
      case when v_note is null then format('守れていなかった決まりが 1 つ：『%s』。AI が直しました', v_title)
           else format('守れていなかった決まりが 1 つ：『%s』（%s）。AI が直しました', v_title, v_note) end
  end;
  perform app.knowledge_ticket_line(
    p_ticket, 'knowledge_breach',
    jsonb_build_array(jsonb_build_object(
      'field', 'knowledge_breach', 'from', p_kind, 'to', v_title, 'note', v_note, 'page_id', p_page)),
    v_body);
  -- 証跡：会社の文脈（app.tenant_id）を持たない入口（PC の印で動く仕事の終わり）からも呼ばれるので、record_audit を使わず直に書く。
  --   中身は出来事の種類だけ（題名・理由を入れない）
  insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
    values (p_tenant, null, 'bridge', 'knowledge.breach.record', 'tickets', p_ticket::text, 'C2',
            jsonb_build_object('kind', p_kind), null);
  return v_id;
end $$;
revoke all on function app.kn_breach_write(uuid, uuid, uuid, uuid, text, text) from public;

-- 破られた 1 件を数える（引き金と、段 6 の道具の入口の関数の中からだけ・kaname_app に渡さない）。答えは数えた行の id か null
--   知らない種類は例外（22023）。数えられない指し方（ほかのチケット・外した行・manual・効く範囲の外）と、もう数えた物は null で何も書かない
create or replace function app.knowledge_record_breach(p_ticket uuid, p_spec uuid, p_kind text, p_note text default null)
returns uuid
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  s record;
begin
  if p_kind is null or p_kind not in ('ai_unchecked', 'human_unchecked', 'ai_self_reported') then
    raise exception 'KNW_BREACH_KIND' using errcode = '22023';
  end if;
  select ts.id, ts.tenant_id, ts.source_ref_id into s from test_specs ts
   where ts.id = p_spec and ts.ticket_id = p_ticket and ts.deleted_at is null and ts.source = 'knowledge';
  if not found then
    return null;
  end if;
  if not exists (select 1 from app.knowledge_guard_specs(p_ticket) g(id) where g.id = p_spec) then
    return null;
  end if;
  return app.kn_breach_write(s.tenant_id, p_ticket, p_spec, s.source_ref_id, p_kind, p_note);
end $$;
revoke all on function app.knowledge_record_breach(uuid, uuid, text, text) from public;

-- AI が終わりを知らせたとき：効く範囲の行のうちチェックの無い行を作った順に ai_unchecked で数える（範囲は 1 度だけ引く）。新しく数えた行数
create or replace function app.knowledge_breach_scan(p_ticket uuid) returns integer
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select ts.id, ts.tenant_id, ts.source_ref_id
      from app.knowledge_guard_specs(p_ticket) g(id)
      join test_specs ts on ts.id = g.id
     where ts.checked_at is null
     order by ts.created_at, ts.id
  loop
    if app.kn_breach_write(r.tenant_id, p_ticket, r.id, r.source_ref_id, 'ai_unchecked', null) is not null then
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;
revoke all on function app.knowledge_breach_scan(uuid) from public;

-- ①の引き金の中身：結果つきで done になったチケットの仕事だけ。数えそこなっても仕事の終わりは止めない
create or replace function app.knowledge_breach_on_job_done() returns trigger
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_ticket uuid;
begin
  if coalesce(new.result, '') !~ '\S' then
    return null;
  end if;
  select r.ticket_id into v_ticket from action_runs r
   where r.bridge_job_id = new.id order by r.created_at desc, r.id desc limit 1;
  if v_ticket is null then
    return null;
  end if;
  begin
    perform app.knowledge_breach_scan(v_ticket);
  exception when others then
    raise warning '[knowledge] 破られた数を数えられなかった（%）', sqlstate;
  end;
  return null;
end $$;
revoke all on function app.knowledge_breach_on_job_done() from public;

-- ②の引き金の中身：AI が付けたチェックを人が外した。数えそこなってもチェックを外す操作は止めない
create or replace function app.knowledge_breach_on_uncheck() returns trigger
language plpgsql security definer set search_path = public, app, pg_temp as $$
begin
  begin
    perform app.knowledge_record_breach(new.ticket_id, new.id, 'human_unchecked');
  exception when others then
    raise warning '[knowledge] 破られた数を数えられなかった（%）', sqlstate;
  end;
  return null;
end $$;
revoke all on function app.knowledge_breach_on_uncheck() from public;

-- ---------------------------------------------------------------- ③ 引き金
drop trigger if exists knowledge_breaches_same_tenant on knowledge_breaches;
create trigger knowledge_breaches_same_tenant before insert or update on knowledge_breaches
  for each row execute function app.kn_breach_same_tenant();

-- 既にある bridge_jobs_ticket_execute_end（0098）は作り直さない（別の引き金として並ぶ）
drop trigger if exists bridge_jobs_knowledge_breach on bridge_jobs;
create trigger bridge_jobs_knowledge_breach after update of state_id on bridge_jobs
  for each row when (new.kind = 'ticket' and new.state_id = 'done' and old.state_id is distinct from new.state_id)
  execute function app.knowledge_breach_on_job_done();

drop trigger if exists test_specs_knowledge_breach on test_specs;
create trigger test_specs_knowledge_breach after update of checked_at on test_specs
  for each row when (old.source = 'knowledge' and old.checked_by_ai and old.checked_at is not null and new.checked_at is null)
  execute function app.knowledge_breach_on_uncheck();
