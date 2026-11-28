-- 20261120130000 やり取りを読む口（K-383・契約の口 listTicketTimeline・D-128.45・D-128.58・D-128.96・D-130.4・D-136.1・D-136.2・関門 C2）
--   書き込み・変更の 1 行・仕組みの行・AI の実行 1 回＝1 枚を、1 本の時系列で返す。新しい方から limit 件を古い順に並べ、前は (時刻, id) で読む。
--   読む関数はどれも読むだけ（最後に開いた時刻も書かない。書くのは K-384 の口）。
--
-- ① ticket_messages に、後の葉が書く列を足す（どれも既定は空の並び・null）：
--      notify_member_ids（知らせる人に選ばれた人・K-385）・quote_text（引用した元の頭の 2 行の写し・K-385）・
--      edited_at（本文を直した時刻・☆ では変えない・K-386）・deleted_by（消した人・K-386）
-- ② app.ticket_thread_seen：人ごと・チケットごとの「最後にやり取りを開いた時刻」。アプリの役は直に触れない（前例 app.ticket_drafts・0090）
-- ③ app.ticket_timeline_item：書き込み 1 件の答えの形（K-385・K-386 の書く関数も使う。同じ形を 2 か所で作らない）
-- ④ app.ticket_timeline：読む関数（見られないチケットなら null）
-- ⑤ 並べる鍵と同じ索引（前を見る問い合わせで並べ直さない）

alter table ticket_messages add column if not exists notify_member_ids uuid[] not null default '{}';
alter table ticket_messages add column if not exists quote_text text;
alter table ticket_messages add column if not exists edited_at timestamptz;
alter table ticket_messages add column if not exists deleted_by uuid references members(id);

create table if not exists app.ticket_thread_seen (
  tenant_id uuid not null references tenants(id),
  ticket_id uuid not null references tickets(id),
  member_id uuid not null references members(id),
  seen_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, ticket_id, member_id)
);
-- アプリの役は表に直に触れない（security definer の関数だけが読み書きする）
revoke all on app.ticket_thread_seen from kaname_app;

create index if not exists ticket_messages_ticket_order_idx on ticket_messages (ticket_id, created_at, id);

-- 人の出し方 { member_id, display_name, call_name }。会社から外れた人（消した印のある人）も名前を出す（D-128.96）。
--   空白だけの名前は null。引くのは呼んだ人の会社の人だけ（別の会社の人の名前は出さない）。id が無ければ null
create or replace function app.ticket_timeline_who(p_member uuid) returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  select case when p_member is null then null else jsonb_build_object(
    'member_id', p_member,
    'display_name', (select nullif(btrim(m.display_name), '') from members m where m.id = p_member and m.tenant_id = app.tenant_id()),
    'call_name', (select nullif(btrim(m.call_name), '') from members m where m.id = p_member and m.tenant_id = app.tenant_id()))
  end
$$;
revoke all on function app.ticket_timeline_who(uuid) from public;

-- 人の並び（@・知らせた人）を、並びのまま人の出し方にする
create or replace function app.ticket_timeline_whos(p_members uuid[]) returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  select coalesce(jsonb_agg(app.ticket_timeline_who(x.id) order by x.n), '[]'::jsonb)
    from unnest(coalesce(p_members, '{}'::uuid[])) with ordinality as x(id, n)
$$;
revoke all on function app.ticket_timeline_whos(uuid[]) from public;

-- 決定の元か：そのメッセージを元に持つ、消していない決定があるか（改められた古い決定も数える）。
--   取り消した決定を外す条件は、取り消しの列を足す葉の後で K-391 がこの関数を作り直して足す
create or replace function app.ticket_message_decided(p_message uuid) returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select exists (select 1 from ticket_decisions d where d.source_message_id = p_message and d.deleted_at is null)
$$;
revoke all on function app.ticket_message_decided(uuid) from public;

-- 書き込み 1 件の答え { id, kind, at, actor, message, changes, run, deleted }。見ている人は app.user_id()、p_seen はその人の最後に開いた時刻。
--   kind：post／change／system はそのまま、消した書き込みは deleted。AI の実行の 1 枚（run）はここでは作らない（読む関数だけが作る）。
--   消した跡は本文・@・知らせた人・引用・☆ を返さない（message が null）
create or replace function app.ticket_timeline_item(p_message uuid, p_seen timestamptz) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  r ticket_messages%rowtype; v_me uuid := app.user_id(); v_scope uuid; v_kind text; v_stars jsonb; v_msg jsonb := null;
begin
  select * into r from ticket_messages where id = p_message and tenant_id = app.tenant_id();
  if r.id is null then return null; end if;
  v_kind := case when r.kind = 'post' and r.deleted_at is not null then 'deleted' else r.kind end;
  if v_kind in ('post', 'system') then
    select t.scope_id into v_scope from tickets t where t.id = r.ticket_id;
    v_stars := case when jsonb_typeof(r.reactions->'star') = 'array' then r.reactions->'star' else '[]'::jsonb end;
    v_msg := jsonb_build_object(
      'body', r.body,
      'mentions', app.ticket_timeline_whos(r.mentions),
      'notified', app.ticket_timeline_whos(r.notify_member_ids),
      'quote', case when r.quote_of_id is not null or r.quote_text is not null
                    then jsonb_build_object('id', r.quote_of_id, 'excerpt', r.quote_text) end,
      'edited_at', r.edited_at,
      'stars', jsonb_array_length(v_stars),
      'starred', v_me is not null and v_stars ? v_me::text,
      'is_new', r.kind = 'post' and r.author_member_id is distinct from v_me and (p_seen is null or r.created_at > p_seen),
      'decided', app.ticket_message_decided(r.id),
      'can_edit', r.kind = 'post' and r.author_member_id = v_me,
      'can_delete', r.kind = 'post' and (r.author_member_id = v_me or app.manages_scope(v_scope)));
  end if;
  return jsonb_build_object(
    'id', r.id,
    'kind', v_kind,
    'at', r.created_at,
    'actor', app.ticket_timeline_who(case when r.kind = 'system' then r.created_by else r.author_member_id end),
    'message', v_msg,
    'changes', r.changes,
    'run', null,
    'deleted', case when v_kind = 'deleted' then jsonb_build_object(
                 'by', app.ticket_timeline_who(r.deleted_by),
                 'author', app.ticket_timeline_who(r.author_member_id),
                 'by_manager', r.deleted_by is distinct from r.author_member_id) end);
end $$;
revoke all on function app.ticket_timeline_item(uuid, timestamptz) from public;
-- 呼ぶのはこの段の security definer の関数の中だけ（読む関数・K-385・K-386 の書く関数）。アプリの役には渡さない

-- AI の実行の 1 枚（読む口だけが返す）。result は実行の状態の鍵（字にするのは画面）。minutes は終わっていれば秒を分にして四捨五入
create or replace function app.ticket_timeline_run(p_run uuid) returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  select jsonb_build_object(
    'id', r.id,
    'kind', 'run',
    'at', r.created_at,
    'actor', app.ticket_timeline_who(r.created_by),
    'message', null,
    'changes', null,
    'run', jsonb_build_object(
      'id', r.id,
      'summary', coalesce(nullif(btrim(app.action_run_json(r.id)->>'progress'), ''), 'AIの実行'),
      'started_at', r.started_at,
      'finished_at', r.finished_at,
      'minutes', case when r.started_at is not null and r.finished_at is not null
                      then round(extract(epoch from (r.finished_at - r.started_at)) / 60)::int end,
      'result', r.status_id),
    'deleted', null)
  from action_runs r where r.id = p_run and r.tenant_id = app.tenant_id()
$$;
revoke all on function app.ticket_timeline_run(uuid) from public;

-- 絞り込みの中の行（並べる鍵 (at, id) と元の種類）。呼んだ人のチケットか・見られるかは呼ぶ側（app.ticket_timeline）が先に確かめる
--   all：書き込み（消した書き込みは跡）・変更・仕組み・AI の実行／talk：書き込みと消した跡だけ／
--   mine：自分が @ されたか知らせる人に入っていた、ほかの人の消していない書き込み
create or replace function app.ticket_timeline_rows(p_ticket uuid, p_filter text) returns table (at timestamptz, id uuid, src text)
language sql stable security definer set search_path = public, app, pg_temp as $$
  select m.created_at, m.id, 'message' from ticket_messages m
   where m.tenant_id = app.tenant_id() and m.ticket_id = p_ticket
     and (m.deleted_at is null or m.kind = 'post')
     and case p_filter
           when 'talk' then m.kind = 'post'
           when 'mine' then m.kind = 'post' and m.deleted_at is null and m.author_member_id is distinct from app.user_id()
                            and (app.user_id() = any(m.mentions) or app.user_id() = any(m.notify_member_ids))
           else true end
  union all
  select r.created_at, r.id, 'run' from action_runs r
   where p_filter = 'all' and r.tenant_id = app.tenant_id() and r.ticket_id = p_ticket and r.deleted_at is null
$$;
revoke all on function app.ticket_timeline_rows(uuid, text) from public;

-- 読む。見ている人がチケットを見られなければ null。
--   答え { items, older_count, new_count, mine_count, post_count, people? }（people は p_before_at が null のときだけ）。
--   並べる鍵は (at, id)：書き込みは created_at、AI の実行は action_runs.created_at。
--   絞り込み all：全部（消した書き込みは跡）／talk：書き込みと消した跡だけ／mine：自分が @ されたか知らせる人に入っていた、ほかの人の消していない書き込み
create or replace function app.ticket_timeline(p_ticket uuid, p_limit int, p_before_at timestamptz, p_before_id uuid, p_filter text)
returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id(); v_me uuid := app.user_id(); t tickets%rowtype;
  v_limit int := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_filter text := case when p_filter in ('all', 'talk', 'mine') then p_filter else 'all' end;
  v_seen timestamptz; v_items jsonb; v_oldest_at timestamptz; v_oldest_id uuid; v_older int := 0;
  v_new int; v_mine int; v_post int; v_people jsonb;
begin
  if v_tenant is null or v_me is null or p_ticket is null or not app.ticket_visible(p_ticket) then return null; end if;
  select * into t from tickets where id = p_ticket and tenant_id = v_tenant and deleted_at is null;
  if t.id is null then return null; end if;
  select s.seen_at into v_seen from app.ticket_thread_seen s where s.tenant_id = v_tenant and s.ticket_id = p_ticket and s.member_id = v_me;

  with page as (
    select x.at, x.id, x.src from app.ticket_timeline_rows(p_ticket, v_filter) x
     where p_before_at is null or (x.at, x.id) < (p_before_at, p_before_id)
     order by x.at desc, x.id desc limit v_limit)
  select coalesce(jsonb_agg(case when p.src = 'run' then app.ticket_timeline_run(p.id) else app.ticket_timeline_item(p.id, v_seen) end
                            order by p.at, p.id), '[]'::jsonb),
         (array_agg(p.at order by p.at, p.id))[1], (array_agg(p.id order by p.at, p.id))[1]
    into v_items, v_oldest_at, v_oldest_id from page p;
  if v_oldest_at is not null then
    select count(*) into v_older from app.ticket_timeline_rows(p_ticket, v_filter) x where (x.at, x.id) < (v_oldest_at, v_oldest_id);
  end if;

  -- 数は絞り込みとページに依らない
  select count(*) filter (where m.author_member_id is distinct from v_me and (v_seen is null or m.created_at > v_seen)),
         count(*) filter (where m.author_member_id is distinct from v_me and (v_me = any(m.mentions) or v_me = any(m.notify_member_ids))),
         count(*)
    into v_new, v_mine, v_post
    from ticket_messages m
   where m.tenant_id = v_tenant and m.ticket_id = p_ticket and m.kind = 'post' and m.deleted_at is null;

  -- @ と知らせる人の候補（最初の 1 回だけ）：そのチケットを見られる、抜けていない・止められていない人（見ている人も含む）
  if p_before_at is null then
    select coalesce(jsonb_agg(jsonb_build_object(
             'member_id', c.id, 'display_name', c.display_name, 'call_name', c.call_name,
             'label', case when c.is_assignee then '担当者' when c.is_approver then '承認する人' else c.scope_name end,
             'is_assignee', c.is_assignee, 'is_approver', c.is_approver)
           order by (not c.is_assignee), (not c.is_approver), c.display_name, c.id), '[]'::jsonb)
      into v_people
      from (
        select m.id, nullif(btrim(m.display_name), '') as display_name, nullif(btrim(m.call_name), '') as call_name,
               (select s.name from scopes s where s.id = m.scope_id and s.tenant_id = v_tenant) as scope_name,
               m.id = t.assignee_member_id as is_assignee,
               exists (select 1 from approvals a
                        where a.tenant_id = v_tenant and a.ticket_id = t.id and a.approver_member_id = m.id
                          and a.decision is null and a.withdrawn_at is null and a.deleted_at is null) as is_approver
          from members m
         where m.tenant_id = v_tenant and m.kind_id = 'human'
           and app.ticket_member_ok(v_tenant, m.id)
           and app.ticket_draft_ok(t.draft_import_id, m.id)
           and (t.scope_id = any(visible_scopes(m.id)) or t.assignee_member_id = m.id or app.ticket_involved(t.id, m.id))
      ) c;
  end if;

  return jsonb_build_object('items', v_items, 'older_count', v_older, 'new_count', v_new, 'mine_count', v_mine, 'post_count', v_post)
         || case when p_before_at is null then jsonb_build_object('people', v_people) else '{}'::jsonb end;
end $$;
revoke all on function app.ticket_timeline(uuid, int, timestamptz, uuid, text) from public;
grant execute on function app.ticket_timeline(uuid, int, timestamptz, uuid, text) to kaname_app;
