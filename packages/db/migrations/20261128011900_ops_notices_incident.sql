-- 20261128011900 運営が障害の続報を足す（K-979・契約の口 addIncidentUpdate・D-125.127・D-156.28・関門 C2）
--   関数 app.ops_notice_incident_update(お知らせ, 状態, 本文)：
--   ⓐ 運営の人で notice を持つか（app.ops_require・入口の 2 層目）
--   ⓑ お知らせの行（運営の会社・消していない）を for update で引く。無ければ no_data_found（P0002 → 404）
--   ⓒ 障害で出した物（DB の published か、予定の時刻を過ぎた scheduled・K-977 の読み替えと同じ）でなければ not_live_incident
--   ⓓ 今の状態の行（status_incidents の消していない新しい 1 つ）を for update。無ければ作る（started_at は publish_at か created_at）。
--      直った（resolved）なら already_resolved。状態の順は決めない（直る前なら戻してよい）
--   ⓔ 続報 notice_updates に 1 行。created_at は錠を取った後の clock_timestamp()（同時の 2 つで、書いた順と続報の古い順をそろえる）
--   ⓕ 今の状態の行を同じ状態に直す（resolved なら resolved_at）
--   ⓖ 運営の記録（payload は状態だけ・本文の字を入れない）
--   ⓗ 答えは K-977 の app.ops_notice_detail（読み替えは 1 か所）
--   鈴（notifications）もメールも出さない（D-156.28）。全部 1 取引なので、どれかが書けなければ全部戻る

create or replace function app.ops_notice_incident_update(p_notice uuid, p_state text, p_body text) returns jsonb
language plpgsql volatile security definer set search_path = public, app, pg_temp as $$
declare
  v_n notices%rowtype;
  v_inc_id uuid;
  v_inc_state text;
begin
  perform app.ops_require('notice');

  select * into v_n
    from notices n
   where n.id = p_notice and n.tenant_id = app.ops_tenant_id() and n.deleted_at is null
   for update;
  if not found then
    raise exception 'お知らせが無い' using errcode = 'no_data_found';
  end if;

  if v_n.kind_id is distinct from 'incident'
     or not (v_n.state = 'published' or (v_n.state = 'scheduled' and v_n.publish_at is not null and v_n.publish_at <= now())) then
    return jsonb_build_object('error', 'not_live_incident');
  end if;

  select s.id, s.state into v_inc_id, v_inc_state
    from status_incidents s
   where s.notice_id = p_notice and s.deleted_at is null
   order by s.created_at desc, s.id desc
   limit 1
   for update;
  if v_inc_id is null then
    insert into status_incidents (tenant_id, notice_id, state, started_at, created_by)
    values (app.ops_tenant_id(), p_notice, 'investigating', coalesce(v_n.publish_at, v_n.created_at), app.user_id())
    returning id, state into v_inc_id, v_inc_state;
  end if;
  if v_inc_state = 'resolved' then
    return jsonb_build_object('error', 'already_resolved');
  end if;

  insert into notice_updates (tenant_id, notice_id, state, body, created_at, created_by)
  values (app.ops_tenant_id(), p_notice, p_state, p_body, clock_timestamp(), app.user_id());

  update status_incidents
     set state = p_state,
         resolved_at = case when p_state = 'resolved' then now() else resolved_at end,
         updated_by = app.user_id()
   where id = v_inc_id;

  perform app.record_ops_audit(app.ops_tenant_id(), 'notice.incident_update', 'notices', p_notice::text, null,
                               jsonb_build_object('state', p_state));

  return jsonb_build_object('data', app.ops_notice_detail(p_notice));
end $$;
revoke all on function app.ops_notice_incident_update(uuid, text, text) from public;
grant execute on function app.ops_notice_incident_update(uuid, text, text) to kaname_app;
