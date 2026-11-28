-- 20261128010900_ops_peek 運営が 1 社の中を見る：開く（openPeek）・閉じる（closePeek）と、見ている間の上の帯（K-969・関門 C2・D-156.50・D-156.3・D-156.10・D-125.128・D-128.68・D-128.108）
--   ① app.ops_peek_open(会社, 理由, 分, 問い合わせ)：許可の行（support_access_grants・scope read・開いた運営の人）を作り、運営の記録と会社の記録に peek.open
--      同じ運営の人がその会社にまだ効いている許可を持てば {"error":"already_open"}（口が 409 E-OPS-001）。ほかの運営の人の許可は数えない
--   ② app.ops_peek_close(許可)：自分が開いた・消していない許可だけを閉じる（ほか・無い → P0002 → 404）。閉じた・期限・取り消し → {"error":"not_open"}（409 E-OPS-002）
--      行を for update で取るので、同時の 2 回目は閉じた後の行を見て not_open になる
--   ③ app.member_peek_band()：K-955 の空の関数を差し替える。運営の側（見ている本人・notice_id は許可の id）と顧客の側（notice_id null・題「運営が中を見ています」）
--   ④ app.member_status_ok()：K-955 の頭の確かめを差し替え、その会社の中を見ている運営の人（app.ops_grant_ok）も稼働状況を読める
--   期限が来たら何もしなくても効かなくなる（app.ops_grant_ok が期限を見る・時間で動く仕組みは作らない）。
--   どの関数も security definer・search_path に pg_temp・public から外し、アプリの接続（kaname_app）にだけ渡す（D-128.171）

create or replace function app.ops_peek_open(p_tenant uuid, p_reason text, p_minutes integer, p_inquiry uuid) returns jsonb
language plpgsql volatile security definer set search_path = public, app, pg_temp as $$
declare
  v_om uuid;
  v_name text;
  v_reason text := trim(coalesce(p_reason, ''));
  g support_access_grants%rowtype;
begin
  v_om := app.ops_require('peek');
  perform app.ops_target(p_tenant);
  if v_reason = '' or p_minutes is null or p_minutes < 1 or p_minutes > 60 then
    raise exception '理由と見る時間（1〜60 分）が要る' using errcode = 'invalid_parameter_value';
  end if;
  if p_inquiry is not null and not exists (
       select 1 from inquiries q where q.id = p_inquiry and q.tenant_id = p_tenant and q.deleted_at is null) then
    raise exception '問い合わせが無い' using errcode = 'no_data_found';
  end if;
  -- 同じ人の 2 つ目を同時に作らないよう、会社の行で並べる
  select t.name into v_name from tenants t where t.id = p_tenant for update;
  if exists (
       select 1 from support_access_grants x
        where x.tenant_id = p_tenant and x.ops_member_id = v_om and x.deleted_at is null
          and x.closed_at is null and x.revoked_at is null and x.expires_at > now()) then
    return jsonb_build_object('error', 'already_open');
  end if;
  insert into support_access_grants (tenant_id, scope, ops_member_id, reason, inquiry_id, expires_at, created_by, updated_by)
  values (p_tenant, 'read', v_om, v_reason, p_inquiry, now() + make_interval(mins => p_minutes), app.user_id(), app.user_id())
  returning * into g;
  perform app.record_ops_audit(p_tenant, 'peek.open', 'support_access_grants', g.id::text, g.id,
                               jsonb_build_object('target_label', v_name, 'reason', g.reason));
  return jsonb_build_object('data', jsonb_build_object(
    'id', g.id, 'workspace_id', g.tenant_id, 'reason', g.reason, 'expires_at', g.expires_at, 'closed_at', g.closed_at));
end $$;
revoke all on function app.ops_peek_open(uuid, text, integer, uuid) from public;
grant execute on function app.ops_peek_open(uuid, text, integer, uuid) to kaname_app;

create or replace function app.ops_peek_close(p_grant uuid) returns jsonb
language plpgsql volatile security definer set search_path = public, app, pg_temp as $$
declare
  v_om uuid;
  v_name text;
  g support_access_grants%rowtype;
begin
  v_om := app.ops_require('peek');
  select * into g from support_access_grants x
   where x.id = p_grant and x.ops_member_id = v_om and x.deleted_at is null
   for update;
  if not found then
    raise exception '許可が無い' using errcode = 'no_data_found';
  end if;
  if g.closed_at is not null or g.revoked_at is not null or g.expires_at <= now() then
    return jsonb_build_object('error', 'not_open');
  end if;
  update support_access_grants set closed_at = now(), updated_at = now(), updated_by = app.user_id()
   where id = g.id
  returning * into g;
  select t.name into v_name from tenants t where t.id = g.tenant_id;
  perform app.record_ops_audit(g.tenant_id, 'peek.close', 'support_access_grants', g.id::text, g.id,
                               jsonb_build_object('target_label', v_name));
  return jsonb_build_object('data', jsonb_build_object(
    'id', g.id, 'workspace_id', g.tenant_id, 'reason', g.reason, 'expires_at', g.expires_at, 'closed_at', g.closed_at));
end $$;
revoke all on function app.ops_peek_close(uuid) from public;
grant execute on function app.ops_peek_close(uuid) to kaname_app;

-- 頭の確かめ：会社の人、またはその会社の中を見ている運営の人（自分の効いている許可がある）
create or replace function app.member_status_ok() returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select coalesce(
           (app.role() = 'member' and app.tenant_id() is not null and app.user_id() is not null)
        or (app.role() = 'ops' and app.tenant_id() is not null and app.user_id() is not null
            and app.ops_grant_ok(app.tenant_id())),
         false)
$$;

-- 中を見ている間の帯（kind peek）。欄は K-1004 の bands のまま（欄を足さない）
create or replace function app.member_peek_band() returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v jsonb;
begin
  if v_tenant is null or app.user_id() is null then
    return null;
  end if;
  if coalesce(app.role(), '') = 'ops' then
    -- 運営の側：見ている本人の効いている許可。notice_id に許可の id（closePeek に渡す）
    select jsonb_build_object(
             'kind', 'peek', 'notice_id', g.id, 'title', t.name, 'state', g.reason, 'note', null, 'ref', null,
             'from', g.created_at, 'to', g.expires_at, 'closable', false, 'more', 0)
      into v
      from support_access_grants g
      join ops_members om on om.id = g.ops_member_id
      join tenants t on t.id = g.tenant_id
     where g.tenant_id = v_tenant and g.deleted_at is null
       and g.closed_at is null and g.revoked_at is null and g.expires_at > now()
       and om.member_id = app.user_id() and om.revoked_at is null and om.deleted_at is null
     order by g.expires_at desc, g.id desc
     limit 1;
    return v;
  end if;
  -- 顧客の側：その会社の効いている許可（誰が開いたかは問わない・名前は出さない）の期限の遅い 1 つと、ほかの数
  with a as (
    select g.* from support_access_grants g
     where g.tenant_id = v_tenant and g.deleted_at is null
       and g.closed_at is null and g.revoked_at is null and g.expires_at > now()
  )
  select jsonb_build_object(
           'kind', 'peek', 'notice_id', null, 'title', '運営が中を見ています', 'state', a.reason, 'note', null, 'ref', null,
           'from', a.created_at, 'to', a.expires_at, 'closable', false, 'more', (select count(*) from a) - 1)
    into v
    from a
   order by a.expires_at desc, a.id desc
   limit 1;
  return v;
end $$;
revoke all on function app.member_status_ok(), app.member_peek_band() from public;
grant execute on function app.member_status_ok(), app.member_peek_band() to kaname_app;
