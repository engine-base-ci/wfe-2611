-- K-307 いまの様子（誰でも読める稼働状況の口 getServiceStatus）を返す DB の関数 app.public_service_status()。
--   障害とお知らせの表の行の守り（policies/0015：運営だけが読める）は変えない。ログインしていない人にも出してよい分だけを、
--   security definer の関数で要る列だけ返す（K-74 の作り方 ②・app.current_terms() と同じ形）。
--   公開の条件：運営のテナントのお知らせで、state = 'published'・消していない・全部向け（target_tenant_id も target_plan_ids も無い）。
--   置き場（placements）は見ない（稼働状況は事実なので、置き場の付け忘れで障害が隠れない）。
--   ① incidents：直っていない障害（state が resolved でない・resolved_at が空・消していない・started_at がある）のうち、
--      公開の条件を満たし題があるお知らせに結んだもの（answer=8467d5780a91）。{state, title（お知らせの題）, started_at}。started_at の古い順
--   ② maintenance：公開の条件を満たし、題・maintenance_from・maintenance_to が全部あり、いま中のもの（from <= now() < to）だけ。
--      予定（これから）と終わったものは出さない（answer=88f98638a534）。kind_id は見ない。2 つ以上なら to の早いもの（同じなら from の早いもの）。
--      {title, from, to}。無ければ null
--   時刻の比べは DB の now()（D-128.130）。運営の本文・メモ・id・テナントの id は返さない。
--   本体はふつうの sql 関数（文字列の本体）にする。BEGIN ATOMIC は作った時点で表に結びつき、表が読めないときに落ちなくなる（K307-API-015）
create or replace function app.public_service_status()
returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  with open_notices as (
    select n.id, n.title, n.maintenance_from, n.maintenance_to
      from notices n
     where n.tenant_id = app.ops_tenant_id()
       and n.state = 'published'
       and n.deleted_at is null
       and n.target_tenant_id is null
       and n.target_plan_ids is null
       and n.title is not null
  )
  select jsonb_build_object(
    'incidents', coalesce((
      select jsonb_agg(jsonb_build_object('state', i.state, 'title', o.title, 'started_at', i.started_at)
                       order by i.started_at, i.id)
        from status_incidents i
        join open_notices o on o.id = i.notice_id
       where i.tenant_id = app.ops_tenant_id()
         and i.state <> 'resolved'
         and i.resolved_at is null
         and i.deleted_at is null
         and i.started_at is not null
    ), '[]'::jsonb),
    'maintenance', (
      select jsonb_build_object('title', o.title, 'from', o.maintenance_from, 'to', o.maintenance_to)
        from open_notices o
       where o.maintenance_from is not null
         and o.maintenance_to is not null
         and o.maintenance_from <= now()
         and now() < o.maintenance_to
       order by o.maintenance_to, o.maintenance_from, o.id
       limit 1
    )
  )
$$;
revoke all on function app.public_service_status() from public;
grant execute on function app.public_service_status() to kaname_app;
