-- 20261127095300 届いた依頼の届け先を変える・返事を送る（K-893・関門 C2・C6・D-155.10・D-155.43・D-128.103・D-136.1）
--   K-892 の守りの関数（app.client_request_visible・app.client_request_actable・app.client_request_route・app.client_request_routes）と
--   出し手へのお知らせ app.client_request_notify_author を使う。関数は 3 つ：
--   ① app.client_request_set_route：届け先のグループを変える（同じ届け先なら何もしない）
--   ② app.client_request_reply：返事の行・状態「聞いている」・出し手の受け箱・証跡を 1 つの取引で書く（メールは口が取引の後に送る）
--   ③ app.client_request_mail_record：口が送ったメールの結果を受け箱に email の行で残す（返事と断り K-895 が使う）
--   断りは例外の番号と hint で口に渡す：見えない 42501＋E-GST-100／直せない 42501（hint なし）／もう決まっている 22023＋E-GST-110／
--   選べない届け先 42501＋E-GST-111／本文が空 22023＋empty。中に begin／commit を書かない

-- ---------------------------------------------------------------- 共通：依頼を 1 件、順番待ちで取り、見える・直せる・決まっていないを確かめる
--   同じ依頼の同時の 2 本（返事と断り・チケット化）は依頼の行で待ち合わせる（後の 1 本は前の 1 本が書いた後の状態を見る・K893-API-021）
create or replace function app.client_request_lock_open(p_req uuid) returns client_requests
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_tenant uuid := app.tenant_id(); r client_requests%rowtype;
begin
  if v_tenant is null or app.user_id() is null then
    raise exception '依頼が見つからない' using errcode = 'insufficient_privilege', hint = 'E-GST-100';
  end if;
  select * into r from client_requests where id = p_req and tenant_id = v_tenant and deleted_at is null for update;
  if r.id is null or not app.client_request_visible(r.id) then
    raise exception '依頼が見つからない' using errcode = 'insufficient_privilege', hint = 'E-GST-100';
  end if;
  if not app.client_request_actable(r.id) then
    raise exception '依頼を直す権限が無い' using errcode = 'insufficient_privilege';
  end if;
  if r.state not in ('new', 'asking') then
    raise exception '依頼はもう決まっている' using errcode = 'invalid_parameter_value', hint = 'E-GST-110';
  end if;
  return r;
end $$;
revoke all on function app.client_request_lock_open(uuid) from public;

-- ---------------------------------------------------------------- ① 届け先のグループを変える
--   選べる届け先は app.client_request_routes()（この会社の消していないグループで、見ている人が client_requests を edit できる物）だけ。
--   今の届け先と同じなら何もせず証跡も書かない（冪等）。答えは新しい届け先の名前だけ
create or replace function app.client_request_set_route(p_req uuid, p_route uuid) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare r client_requests%rowtype; v_from uuid; v_name text;
begin
  r := app.client_request_lock_open(p_req);
  if p_route is null or not exists (select 1 from jsonb_array_elements(app.client_request_routes()) e where (e->>'id')::uuid = p_route) then
    raise exception '選べない届け先' using errcode = 'insufficient_privilege', hint = 'E-GST-111';
  end if;
  select s.name into v_name from scopes s where s.id = p_route;
  v_from := app.client_request_route(r.id);
  if v_from is not distinct from p_route then
    return jsonb_build_object('route_name', v_name);
  end if;
  update client_requests set routed_scope_id = p_route, updated_by = app.user_id() where id = r.id;
  perform app.record_audit('client_request.route_changed', 'client_requests', r.id::text, 'C2',
                           jsonb_build_object('request_id', r.id, 'from', v_from, 'to', p_route));
  return jsonb_build_object('route_name', v_name);
end $$;
revoke all on function app.client_request_set_route(uuid, uuid) from public;
grant execute on function app.client_request_set_route(uuid, uuid) to kaname_app;

-- ---------------------------------------------------------------- ② 返事を送る（1 つの取引）
--   返事の行（company・message・書いた人は呼んだ人）→ 状態を asking → 出し手の受け箱（app.client_request_notify_author・ref は返事の id）→ 証跡。
--   どれかが落ちたら全部戻る。notice は受け箱を入れた出し手 { member_id, email, notification_id } か null（メールは口が取引の後に送る）
create or replace function app.client_request_reply(p_req uuid, p_body text) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare r client_requests%rowtype; v_me uuid := app.user_id(); v_body text; v_msg uuid; v_notice jsonb;
        c_space constant text := E' \t\n\x0B\f\r                 　﻿';
begin
  r := app.client_request_lock_open(p_req);
  v_body := nullif(btrim(coalesce(p_body, ''), c_space), '');
  if v_body is null then
    raise exception '返事が空' using errcode = 'invalid_parameter_value', hint = 'empty';
  end if;
  insert into client_request_messages (tenant_id, client_request_id, side, kind, body, author_member_id, created_by, updated_by)
    values (r.tenant_id, r.id, 'company', 'message', v_body, v_me, v_me, v_me)
    returning id into v_msg;
  update client_requests set state = 'asking', updated_by = v_me where id = r.id;
  v_notice := app.client_request_notify_author(r.id, 'client_request.replied', jsonb_build_object('ref', v_msg));
  perform app.record_audit('client_request.replied', 'client_requests', r.id::text, 'C2',
                           jsonb_build_object('request_id', r.id, 'message_id', v_msg));
  return jsonb_build_object('state', 'asking', 'message_id', v_msg, 'notice', v_notice);
end $$;
revoke all on function app.client_request_reply(uuid, text) from public;
grant execute on function app.client_request_reply(uuid, text) to kaname_app;

-- ---------------------------------------------------------------- ③ メールの結果を残す（返事・断り）
--   この依頼の出し手（created_by）に当たる人だけ。受け箱に channel email の行（payload は request_id だけ・宛ては載せない）
create or replace function app.client_request_mail_record(p_req uuid, p_member uuid, p_kind text, p_ok boolean) returns void
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_tenant uuid := app.tenant_id(); r client_requests%rowtype;
begin
  if p_kind not in ('client_request.replied', 'client_request.declined') then
    raise exception '知らない種類' using errcode = 'invalid_parameter_value';
  end if;
  select * into r from client_requests where id = p_req and tenant_id = v_tenant;
  if v_tenant is null or r.id is null or r.created_by is distinct from p_member then
    raise exception '出し手でない' using errcode = 'insufficient_privilege';
  end if;
  insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, dedupe_key, sent_at, failed_at, created_by)
    values (v_tenant, p_member, 'email', p_kind, jsonb_build_object('request_id', r.id),
            p_kind || '.mail:' || r.id::text || ':' || to_char(clock_timestamp() at time zone 'UTC', 'YYYYMMDDHH24MISSUS'),
            case when p_ok then now() end, case when p_ok then null else now() end, app.user_id());
end $$;
revoke all on function app.client_request_mail_record(uuid, uuid, text, boolean) from public;
grant execute on function app.client_request_mail_record(uuid, uuid, text, boolean) to kaname_app;
