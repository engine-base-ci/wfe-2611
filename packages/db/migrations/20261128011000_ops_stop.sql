-- 20261128011000_ops_stop 運営が 1 社を止める・再開する（K-970・stopWorkspace・resumeWorkspace・関門 C2・D-156.23・D-125.126・D-128.68・D-128.108）
--   ① tenants.stop_notice：管理者へのお知らせの本文（2000 字まで）。止める印の 4 列（stopped_at・stop_on・stop_reason_key・stop_noticed_at）は K-963 が足した
--   ② app.tenant_stopped(会社)：止めているかの決めの 1 か所＝止めた時刻がある か 止める日が日本の今日以前（D-156.49）。
--      止める日が来たら何もしなくても止まる（時間で動く仕組みは使わない）。K-1012 の入口が会社の人の文脈で呼ぶので kaname_app に渡す
--   ③ app.ops_workspace_stop(会社, 理由, mode, 止める日, メモ, お知らせの本文)：日を決めて止める（scheduled）／すぐ止める（now）
--      日を決めたときだけ、その会社の管理者全員に画面のお知らせ（inapp の workspace.stop_scheduled・本文の字は入れない）
--   ④ app.ops_workspace_resume(会社, メモ)：止める予定を取り消す・止めた会社を戻す（印の 5 列を全部空に）
--   ③④ は頭で app.ops_require('stop')（K-947 の型・2 層目）→ app.ops_target → 会社の行を for update → 書く → app.record_ops_audit。
--      断り（二重・日が今日以前・止めていない）は {"error": …} で返し、口が 409 の番号に直す。答えは app.ops_workspace（K-966）の 12 欄
--   ⑤ app.member_stop_band()（K-955 の空の関数を入れ替える）：止めている → その会社の人全員に止めた帯。
--      止める予定（止める日が明日以降）→ 管理者と中を見ている運営の人にだけ予定の帯。ほかは null
--   顧客に出す理由の字は app.tenant_stop_reason_label の 1 か所（帯の題と運営の記録の reason が同じ字を使う）

alter table tenants
  add column if not exists stop_notice text
    check (stop_notice is null or char_length(stop_notice) between 1 and 2000);

-- 顧客に出す理由の字（unpaid・violation・danger・request の 4 つ・K-1006 の reason_key）
create or replace function app.tenant_stop_reason_label(p_key text) returns text
language sql immutable set search_path = public, app, pg_temp as $$
  select case p_key
    when 'unpaid' then '請求が払われない'
    when 'violation' then '規約に反する'
    when 'danger' then '危ない使い方をしている'
    when 'request' then '管理者から頼まれた'
    else null end
$$;
revoke all on function app.tenant_stop_reason_label(text) from public;

create or replace function app.tenant_stopped(p_tenant uuid) returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select coalesce((
    select t.stopped_at is not null or t.stop_on <= (now() at time zone 'Asia/Tokyo')::date
      from tenants t where t.id = p_tenant), false)
$$;
revoke all on function app.tenant_stopped(uuid) from public;
grant execute on function app.tenant_stopped(uuid) to kaname_app;

create or replace function app.ops_workspace_stop(p_tenant uuid, p_reason text, p_mode text, p_stop_on date, p_note text, p_notice text)
returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_ops uuid;
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  t record;
  v_action text;
begin
  v_ops := app.ops_require('stop');
  perform app.ops_target(p_tenant);
  -- 2 層目の形の決め（入口の契約と同じ）。ここに来るのは入口を抜けた呼び出しだけ
  if p_mode not in ('scheduled', 'now') or app.tenant_stop_reason_label(p_reason) is null
     or (p_mode = 'now' and (p_reason not in ('violation', 'danger') or p_stop_on is not null))
     or (p_mode = 'scheduled' and p_stop_on is null) then
    raise exception '止める形が決まりに合わない' using errcode = 'invalid_parameter_value';
  end if;

  select x.id, x.name, x.stopped_at, x.stop_on into t from tenants x where x.id = p_tenant for update;

  -- 二重：止めている会社はどちらの mode でも、予定がある会社に日を決め直すのも断る（すぐ止めるのは通す）
  if t.stopped_at is not null or t.stop_on <= v_today or (p_mode = 'scheduled' and t.stop_on is not null) then
    return jsonb_build_object('error', 'already_stopping');
  end if;
  if p_mode = 'scheduled' and p_stop_on <= v_today then
    return jsonb_build_object('error', 'stop_on_past');
  end if;

  if p_mode = 'scheduled' then
    update tenants
       set stop_on = p_stop_on, stopped_at = null, stop_reason_key = p_reason,
           stop_noticed_at = now(), stop_notice = p_notice
     where id = p_tenant;
    -- その会社の管理者全員に画面のお知らせ（本文の字は入れない・帯で本文を見せる）
    insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, sent_at, created_by)
    select p_tenant, tm.member_id, 'inapp', 'workspace.stop_scheduled',
           jsonb_build_object('stop_on', to_char(p_stop_on, 'YYYY-MM-DD'), 'reason_key', p_reason), now(), app.user_id()
      from tenant_memberships tm
      join members m on m.id = tm.member_id and m.tenant_id = p_tenant and m.deleted_at is null
     where tm.tenant_id = p_tenant and tm.role = 'admin' and tm.status = 'active' and tm.deleted_at is null;
    v_action := 'workspace.stop_scheduled';
  else
    update tenants
       set stopped_at = now(), stop_on = v_today, stop_reason_key = p_reason, stop_notice = p_notice
     where id = p_tenant;
    v_action := 'workspace.stop';
  end if;

  perform app.record_ops_audit(p_tenant, v_action, 'tenants', p_tenant::text, null,
    jsonb_build_object('target_label', t.name, 'reason', app.tenant_stop_reason_label(p_reason), 'note', p_note));
  return jsonb_build_object('data', app.ops_workspace(p_tenant));
end $$;
revoke all on function app.ops_workspace_stop(uuid, text, text, date, text, text) from public;
grant execute on function app.ops_workspace_stop(uuid, text, text, date, text, text) to kaname_app;

create or replace function app.ops_workspace_resume(p_tenant uuid, p_note text) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_ops uuid;
  t record;
begin
  v_ops := app.ops_require('stop');
  perform app.ops_target(p_tenant);
  select x.id, x.name, x.stopped_at, x.stop_on into t from tenants x where x.id = p_tenant for update;
  if t.stopped_at is null and t.stop_on is null then
    return jsonb_build_object('error', 'not_stopped');
  end if;
  update tenants
     set stop_on = null, stopped_at = null, stop_reason_key = null, stop_noticed_at = null, stop_notice = null
   where id = p_tenant;
  perform app.record_ops_audit(p_tenant, 'workspace.resume', 'tenants', p_tenant::text, null,
    jsonb_build_object('target_label', t.name, 'note', p_note));
  return jsonb_build_object('data', app.ops_workspace(p_tenant));
end $$;
revoke all on function app.ops_workspace_resume(uuid, text) from public;
grant execute on function app.ops_workspace_resume(uuid, text) to kaname_app;

-- 止める日・止めた帯（K-1004 の bands の 1 つ・kind stop）。state は管理者へのお知らせの本文（kind stop のときだけの使い方）
create or replace function app.member_stop_band() returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  t record;
begin
  if v_tenant is null then
    return null;
  end if;
  select x.stopped_at, x.stop_on, x.stop_reason_key, x.stop_notice into t from tenants x where x.id = v_tenant;
  if not found or (t.stopped_at is null and t.stop_on is null) then
    return null;
  end if;
  -- 止める予定（まだ止めていない）は管理者と中を見ている運営の人にだけ
  if not app.tenant_stopped(v_tenant)
     and coalesce(app.role(), '') <> 'ops'
     and not exists (select 1 from tenant_memberships tm
                      where tm.tenant_id = v_tenant and tm.member_id = app.user_id()
                        and tm.role = 'admin' and tm.status = 'active' and tm.deleted_at is null) then
    return null;
  end if;
  return jsonb_build_object(
    'kind', 'stop',
    'notice_id', null,
    'title', app.tenant_stop_reason_label(t.stop_reason_key),
    'state', t.stop_notice,
    'note', null,
    'ref', null,
    'from', coalesce(t.stopped_at, t.stop_on::timestamp at time zone 'Asia/Tokyo'),
    'to', null,
    'closable', false,
    'more', 0);
end $$;
revoke all on function app.member_stop_band() from public;
grant execute on function app.member_stop_band() to kaname_app;
