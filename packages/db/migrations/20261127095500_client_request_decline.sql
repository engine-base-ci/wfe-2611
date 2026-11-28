-- 20261127095500 届いた依頼を断る（K-895・関門 C2・C6・D-155.9・D-128.103・D-136.1）
--   K-892 の守りの関数（app.client_request_visible・app.client_request_actable）と出し手へのお知らせ app.client_request_notify_author を使う。
--   メールの結果は K-893 の app.client_request_mail_record（種類 client_request.declined）が残す（口が取引の後に呼ぶ）。
--   app.client_request_decline：依頼を順番待ちで取り、理由・状態 declined・出し手の受け箱・証跡を 1 つの取引で書く。
--   理由は依頼の行 1 か所だけ（返事のやり取り client_request_messages には入れない）。断った依頼は戻らない（取り消せない）。
--   断りは例外の番号と hint で口に渡す：見えない 42501＋E-GST-100／直せない 42501（hint なし）／もう決まっている 22023＋E-GST-130／
--   理由が空 22023＋empty（口が先に 422 にする最後の砦）。中に begin／commit を書かない

create or replace function app.client_request_decline(p_req uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_tenant uuid := app.tenant_id(); v_me uuid := app.user_id(); r client_requests%rowtype; v_reason text; v_notice jsonb;
        c_space constant text := E' \t\n\x0B\f\r                 　﻿';
begin
  if v_tenant is null or v_me is null then
    raise exception '依頼が見つからない' using errcode = 'insufficient_privilege', hint = 'E-GST-100';
  end if;
  -- 同じ依頼の同時の 2 本（断りと返事・チケット化）は依頼の行で待ち合わせる（後の 1 本は前の 1 本が書いた後の状態を見る・K895-API-012）
  select * into r from client_requests where id = p_req and tenant_id = v_tenant and deleted_at is null for update;
  if r.id is null or not app.client_request_visible(r.id) then
    raise exception '依頼が見つからない' using errcode = 'insufficient_privilege', hint = 'E-GST-100';
  end if;
  if not app.client_request_actable(r.id) then
    raise exception '依頼を直す権限が無い' using errcode = 'insufficient_privilege';
  end if;
  if r.state not in ('new', 'asking') then
    raise exception '依頼はもう決まっている' using errcode = 'invalid_parameter_value', hint = 'E-GST-130';
  end if;
  v_reason := nullif(btrim(coalesce(p_reason, ''), c_space), '');
  if v_reason is null then
    raise exception '理由が空' using errcode = 'invalid_parameter_value', hint = 'empty';
  end if;
  update client_requests set state = 'declined', decline_reason = v_reason, updated_by = v_me where id = r.id;
  -- 受け箱の payload は request_id と ref（依頼の id）だけ。理由の本文・題は載せない（D-128.103）
  v_notice := app.client_request_notify_author(r.id, 'client_request.declined', jsonb_build_object('ref', r.id));
  perform app.record_audit('client_request.declined', 'client_requests', r.id::text, 'C2',
                           jsonb_build_object('request_id', r.id));
  return jsonb_build_object('state', 'done', 'notice',
    case when v_notice is null then null
         else jsonb_build_object('member_id', v_notice->'member_id', 'email', v_notice->'email') end);
end $$;
revoke all on function app.client_request_decline(uuid, text) from public;
grant execute on function app.client_request_decline(uuid, text) to kaname_app;
