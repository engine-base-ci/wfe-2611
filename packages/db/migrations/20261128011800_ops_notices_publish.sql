-- 20261128011800_ops_notices_publish 運営がお知らせを出す・1 社にお知らせを送る（K-978・publishOpsNotice・sendWorkspaceNotice・関門 C2・D-156.33・D-156.28・D-128.108・D-128.109）
--   ① app.ops_notice_publish(お知らせ)：運営の会社の下書きを出す。出す日時が先なら予定（scheduled・時間で動く仕組みは使わない）、
--      無いか過ぎていれば今出す（published・publish_at は出した時刻）。障害は今の状態（status_incidents）を「調べている」で 1 行。
--      使えなくなるメンテだけ、届く会社（app.notice_audience_ok＝止めている会社は入らない・D-156.82）の管理者のメールの宛先を集めて返し、
--      emailed_admins_at に送ると決めた時刻を書く（送るのは口が取引の後に関門 C6 で）。鈴（notifications）は書かない（D-156.28）
--   ② app.ops_workspace_notice_send(会社, 入力)：その 1 社向けのお知らせ（release・誰にはその会社だけ）を作ってすぐ出す。
--      行を作るのは K-1014 の app.ops_notice_create（出す場所の band → 'banner' の読み替えの 1 か所を使う）。管理者だけ（admins_only・D-156.57）を書き、
--      その会社の記録（運営と会社の両方）に notice.send。メールも鈴も出さない
--   どちらも頭で app.ops_require('notice')（2 層目）・書いたら app.record_ops_audit。断り（もう出した・メンテの時間が無い）は {"error": …} で返し、
--   口が 409 の番号に直す。答えは K-977 の app.ops_notice_detail（16 欄）

create or replace function app.ops_notice_publish(p_notice uuid) returns jsonb
language plpgsql volatile security definer set search_path = public, app, pg_temp as $$
declare
  v_ops uuid;
  n record;
  v_later boolean;
  v_at timestamptz;
  v_to text[] := '{}';
  v_mail jsonb := null;
begin
  v_ops := app.ops_require('notice');
  select x.id, x.kind_id, x.title, x.body, x.state, x.publish_at, x.maintenance_from, x.maintenance_to
    into n
    from notices x
   where x.id = p_notice and x.tenant_id = app.ops_tenant_id() and x.deleted_at is null and x.title is not null
     for update;
  if not found then
    raise exception 'お知らせが無い' using errcode = 'no_data_found';
  end if;
  if n.state <> 'draft' then
    return jsonb_build_object('error', 'already_published');
  end if;
  if n.kind_id = 'maintenance' and (n.maintenance_from is null or n.maintenance_to is null) then
    return jsonb_build_object('error', 'maintenance_missing');
  end if;

  v_later := n.publish_at is not null and n.publish_at > now();
  v_at := case when v_later then n.publish_at else now() end;
  update notices
     set state = case when v_later then 'scheduled' else 'published' end,
         publish_at = v_at, published_by = app.user_id(), updated_by = app.user_id()
   where id = p_notice;

  if n.kind_id = 'incident' then
    insert into status_incidents (tenant_id, notice_id, state, started_at, created_by)
    values (app.ops_tenant_id(), p_notice, 'investigating', v_at, app.user_id());
  end if;

  if n.kind_id = 'maintenance' then
    -- 届く会社の管理者（生きている・消していない・認証のメールがある）。止めている会社は app.notice_audience_ok が外す
    select coalesce(array_agg(distinct u.email order by u.email), '{}')
      into v_to
      from tenants t
      join tenant_memberships tm on tm.tenant_id = t.id and tm.role = 'admin' and tm.status = 'active' and tm.deleted_at is null
      join members m on m.id = tm.member_id and m.tenant_id = t.id and m.deleted_at is null
      join kaname_auth."user" u on u.id = coalesce(tm.auth_user_id, m.auth_user_id)
     where t.deleted_at is null and t.half_made_at is null and t.id <> app.ops_tenant_id()
       and app.notice_audience_ok(p_notice, t.id) and u.email is not null;
    update notices set emailed_admins_at = now() where id = p_notice;
    v_mail := jsonb_build_object('title', n.title, 'body', n.body, 'from', n.maintenance_from, 'to', n.maintenance_to);
  end if;

  perform app.record_ops_audit(app.ops_tenant_id(), 'notice.publish', 'notices', p_notice::text, null, '{}'::jsonb);
  return jsonb_build_object('data', app.ops_notice_detail(p_notice), 'mail_to', to_jsonb(v_to), 'mail', v_mail);
end $$;
revoke all on function app.ops_notice_publish(uuid) from public;
grant execute on function app.ops_notice_publish(uuid) to kaname_app;

create or replace function app.ops_workspace_notice_send(p_tenant uuid, p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public, app, pg_temp as $$
declare
  v_ops uuid;
  v_name text;
  v_made jsonb;
  v_id uuid;
begin
  v_ops := app.ops_require('notice');
  perform app.ops_target(p_tenant);
  select t.name into v_name from tenants t where t.id = p_tenant;

  -- 行は下書きを作る 1 か所（K-1014）で作る：種類 release・誰にはその会社だけ・出す場所の読み替えもそこ
  v_made := app.ops_notice_create(jsonb_build_object(
    'kind', 'release',
    'title', p->>'title',
    'body', p->>'body',
    'audience_mode', 'workspaces',
    'audience_workspace_ids', jsonb_build_array(p_tenant),
    'placements', coalesce(p->'placements', '[]'::jsonb)));
  v_id := (v_made->'data'->>'id')::uuid;
  if v_id is null then
    raise exception 'お知らせを作れなかった' using errcode = 'data_exception';
  end if;

  update notices
     set admins_only = coalesce((p->>'admins_only')::boolean, false),
         state = 'published', publish_at = now(), published_by = app.user_id(), updated_by = app.user_id()
   where id = v_id;

  perform app.record_ops_audit(p_tenant, 'notice.send', 'notices', v_id::text, null,
    jsonb_build_object('target_label', v_name));
  return jsonb_build_object('data', app.ops_notice_detail(v_id));
end $$;
revoke all on function app.ops_workspace_notice_send(uuid, jsonb) from public;
grant execute on function app.ops_workspace_notice_send(uuid, jsonb) to kaname_app;
