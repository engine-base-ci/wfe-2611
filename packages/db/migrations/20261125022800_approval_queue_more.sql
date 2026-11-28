-- 20261125022800_approval_queue_more 承認待ちを種類で絞る・並べ替える（K-748・契約の口 listApprovalQueue の kind・sort・D-153.10・D-153.30・D-153.32）
--   列も表も足さない。段 9 の app.approval_queue・app.approval_queue_count（K-405・20261121090500）は触らず、呼んで束ねる関数を 3 つ足す：
--     app.approval_queue_all(p_max)            中だけ（誰にも渡さない）：app.approval_queue を鍵で続けて読み、最大 p_max 件を今の並びで返す
--     app.approval_queue_counts()              札の横の数 { total, artifact, handover }（total は app.approval_queue_count と同じ）
--     app.approval_queue_page(kind, sort, limit, offset)  絞る・並べる・頁に切る { rows, more, counts }。知らない kind・sort は { error: bad_query }
--   どれも呼んだ人を app.user_id() で引く（p_member を受けない）。メンバーでなければ app.approval_queue が空を返すので空・0。
--   security definer・search_path に pg_temp・public から外す。口が直に呼ぶ page・counts だけ kaname_app に渡す（D-128.171）。
--   1 回の読みは最大 1000 件（G-16）。超えたときは頁が 1000 件まで・artifact・handover の数が 1000 件分まで（total は正しい・チケットのリスク）。

create or replace function app.approval_queue_all(p_max integer default 1000) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_max integer := greatest(1, coalesce(p_max, 1000));
  v_out jsonb := '[]'::jsonb;
  v_page jsonb;
  v_n integer;
  v_last jsonb;
  v_due date := null;
  v_created timestamptz := null;
  v_id uuid := null;
begin
  loop
    v_page := coalesce(app.approval_queue(201, v_due, v_created, v_id), '[]'::jsonb);
    v_n := jsonb_array_length(v_page);
    exit when v_n = 0;
    v_out := v_out || v_page;
    exit when v_n < 201 or jsonb_array_length(v_out) >= v_max;
    -- 続きの鍵は最後の行の due_on・created_at・id（K-405 の行の並びの鍵・queue.ts と同じ）
    v_last := v_page -> (v_n - 1);
    v_due := nullif(v_last ->> 'due_on', '')::date;
    v_created := (v_last ->> 'created_at')::timestamptz;
    v_id := (v_last ->> 'id')::uuid;
  end loop;
  if jsonb_array_length(v_out) > v_max then
    select coalesce(jsonb_agg(x.e order by x.o), '[]'::jsonb) into v_out
      from jsonb_array_elements(v_out) with ordinality as x(e, o)
     where x.o <= v_max;
  end if;
  return v_out;
end
$$;
revoke all on function app.approval_queue_all(integer) from public;

create or replace function app.approval_queue_counts() returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_all jsonb := app.approval_queue_all(1000);
begin
  return jsonb_build_object(
    'total', coalesce(app.approval_queue_count(), 0),
    'artifact', (select count(*) from jsonb_array_elements(v_all) e where e ->> 'kind' = 'artifact'),
    'handover', (select count(*) from jsonb_array_elements(v_all) e where e ->> 'kind' = 'handover'));
end
$$;
revoke all on function app.approval_queue_counts() from public;
grant execute on function app.approval_queue_counts() to kaname_app;

create or replace function app.approval_queue_page(p_kind text, p_sort text, p_limit integer, p_offset integer) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_sort text := coalesce(p_sort, 'due');
  v_limit integer := greatest(1, least(coalesce(p_limit, 20), 200));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
  v_all jsonb;
  v_rows jsonb;
  v_total integer;
begin
  -- 口は入口と queue-more.ts が先に 422 にする。ここは直に呼ばれたときの 2 層目
  if p_kind is not null and p_kind not in ('artifact', 'handover') then return jsonb_build_object('error', 'bad_query'); end if;
  if v_sort not in ('due', 'waiting', 'title') then return jsonb_build_object('error', 'bad_query'); end if;
  v_all := app.approval_queue_all(1000);
  with f as (
    select x.e, x.o
      from jsonb_array_elements(v_all) with ordinality as x(e, o)
     where p_kind is null or x.e ->> 'kind' = p_kind
  ), s as (
    select f.e,
           row_number() over (order by
             case when v_sort = 'due' then f.o end asc,
             case when v_sort = 'waiting' then (f.e ->> 'created_at')::timestamptz end desc,
             case when v_sort = 'title' then f.e ->> 'title' end asc,
             (f.e ->> 'id')::uuid asc) as n
      from f
  )
  select coalesce(jsonb_agg(s.e order by s.n) filter (where s.n > v_offset and s.n <= v_offset + v_limit), '[]'::jsonb),
         count(*)::integer
    into v_rows, v_total
    from s;
  return jsonb_build_object(
    'rows', v_rows,
    'more', v_total > v_offset + v_limit,
    'counts', jsonb_build_object(
      'total', coalesce(app.approval_queue_count(), 0),
      'artifact', (select count(*) from jsonb_array_elements(v_all) e where e ->> 'kind' = 'artifact'),
      'handover', (select count(*) from jsonb_array_elements(v_all) e where e ->> 'kind' = 'handover')));
end
$$;
revoke all on function app.approval_queue_page(text, text, integer, integer) from public;
grant execute on function app.approval_queue_page(text, text, integer, integer) to kaname_app;
