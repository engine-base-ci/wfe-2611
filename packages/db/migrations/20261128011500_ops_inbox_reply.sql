-- 20261128011500_ops_inbox_reply 運営が問い合わせに返す・社内メモを書く（K-975・契約の口 replyOpsInquiry・addOpsInquiryNote・関門 C2・C6・D-156.25・D-156.28・D-156.40・D-125.130・D-128.108）
--   ① app.ops_inquiry_reply(id, body)：
--      ⓐ app.ops_require('inquiry')（2 層目）ⓑ 問い合わせ（K-973 の条件）を for update・無い・消した物は no_data_found（口が 404）
--      ⓒ 添付は受けない（運営が添付を上げる口が無い・D-156.40。書き込みの attachments はいつも []）
--      ⓓ ほかの人が担当なら { error: taken }（何も書かない・口が 409 E-OPS-005）。本文が前後の空白を落として空なら { error: empty }（口が先に 422）
--      ⓔ 書き込み（送った人なし・kind inquiry_reply・見え方 all・名前は返した運営の人の写し）。問い合わせは waiting（顧客には 返事あり）・
--         later_until 空・last_message_at 今。担当なしなら返した人を担当にする（済みに返しても waiting に戻す）
--      ⓕ app.record_ops_audit('inquiry.reply' …)（本文の字を入れない）
--      ⓖ { data: <OpsInquiryMessage の 6 欄>, asker: <問い合わせた本人の members.id>, tenant: <会社> }（asker・tenant は口が鈴を送るのに使う）
--   ② app.ops_inquiry_note(id, body)：社内メモ（送った人なし・kind inquiry_note・見え方 ops_only）。担当・状態・last_message_at は変えない。
--      ほかの人が担当でも書ける（運営の中の申し送り）。鈴は出さない。記録は inquiry.note
--   ③ app.inquiry_reply_notice(message)：関門 C6 の inapp の送り口（apps/api/src/features/F12/ops/inbox-reply.ts）が、返事と同じ取引の接続で呼ぶ。
--      運営の人が同じ取引で書いた返事（kind inquiry_reply・送った人なし・見え方 all）だけを引き、問い合わせた本人に inapp の inquiry.replied を 1 行
--      （payload は inquiry_id だけ・本文の字を入れない・dedupe_key inquiry_replied:<書き込みの id>。もう在れば足さない）。答えは書いた行の数。
--      メールは送らない（D-125.130）。書けなければ例外のまま上げる（口が取引ごと戻す・503）
--   どれも search_path に pg_temp・public から外し、アプリの接続（kaname_app）にだけ渡す

create or replace function app.ops_inquiry_reply(p_id uuid, p_body text) returns jsonb
language plpgsql volatile security definer set search_path = public, app, pg_temp as $$
declare
  c_blank constant text := E' \t\r\n\f\v　';
  v_me uuid;
  q record;
  v_body text;
  v_name text;
  v_msg uuid;
  v_at timestamptz;
begin
  perform app.ops_require('inquiry');
  v_me := app.user_id();  -- 担当の列は members.id（K-973・K-974 の「自分」と同じ）
  select x.id, x.tenant_id, x.conversation_id, x.title, x.opened_by_member_id, x.assignee_ops_member_id
    into q
    from inquiries x
    join tenants t on t.id = x.tenant_id
   where x.id = p_id and x.deleted_at is null
     and t.deleted_at is null and t.half_made_at is null and t.id <> app.ops_tenant_id()
     for update of x;
  if not found or q.conversation_id is null then
    raise exception '問い合わせが無い' using errcode = 'no_data_found';
  end if;

  v_body := btrim(coalesce(p_body, ''), c_blank);
  if v_body = '' then
    return jsonb_build_object('error', 'empty');
  end if;
  if q.assignee_ops_member_id is not null and q.assignee_ops_member_id <> v_me then
    return jsonb_build_object('error', 'taken');
  end if;

  select display_name into v_name from members where id = v_me;
  insert into messages (tenant_id, conversation_id, sender_member_id, body, kind, visibility, author_name, attachments, created_by)
    values (q.tenant_id, q.conversation_id, null, v_body, 'inquiry_reply', 'all', v_name, '[]'::jsonb, v_me)
    returning id, created_at into v_msg, v_at;
  update inquiries
     set state = 'waiting', later_until = null, last_message_at = now(),
         assignee_ops_member_id = v_me, updated_at = now(), updated_by = v_me
   where id = q.id;
  perform app.record_ops_audit(q.tenant_id, 'inquiry.reply', 'inquiries', q.id::text, null,
                               jsonb_build_object('target_label', q.title));

  return jsonb_build_object(
    'data', jsonb_build_object('id', v_msg, 'kind', 'reply', 'author_name', v_name, 'body', v_body,
                               'attachments', '[]'::jsonb, 'created_at', v_at),
    'asker', q.opened_by_member_id,
    'tenant', q.tenant_id);
end $$;
revoke all on function app.ops_inquiry_reply(uuid, text) from public;
grant execute on function app.ops_inquiry_reply(uuid, text) to kaname_app;

create or replace function app.ops_inquiry_note(p_id uuid, p_body text) returns jsonb
language plpgsql volatile security definer set search_path = public, app, pg_temp as $$
declare
  c_blank constant text := E' \t\r\n\f\v　';
  v_me uuid;
  q record;
  v_body text;
  v_name text;
  v_msg uuid;
  v_at timestamptz;
begin
  perform app.ops_require('inquiry');
  v_me := app.user_id();
  select x.id, x.tenant_id, x.conversation_id, x.title
    into q
    from inquiries x
    join tenants t on t.id = x.tenant_id
   where x.id = p_id and x.deleted_at is null
     and t.deleted_at is null and t.half_made_at is null and t.id <> app.ops_tenant_id();
  if not found or q.conversation_id is null then
    raise exception '問い合わせが無い' using errcode = 'no_data_found';
  end if;

  v_body := btrim(coalesce(p_body, ''), c_blank);
  if v_body = '' then
    return jsonb_build_object('error', 'empty');
  end if;

  select display_name into v_name from members where id = v_me;
  insert into messages (tenant_id, conversation_id, sender_member_id, body, kind, visibility, author_name, attachments, created_by)
    values (q.tenant_id, q.conversation_id, null, v_body, 'inquiry_note', 'ops_only', v_name, '[]'::jsonb, v_me)
    returning id, created_at into v_msg, v_at;
  perform app.record_ops_audit(q.tenant_id, 'inquiry.note', 'inquiries', q.id::text, null,
                               jsonb_build_object('target_label', q.title));

  return jsonb_build_object(
    'data', jsonb_build_object('id', v_msg, 'kind', 'note', 'author_name', v_name, 'body', v_body,
                               'attachments', '[]'::jsonb, 'created_at', v_at));
end $$;
revoke all on function app.ops_inquiry_note(uuid, text) from public;
grant execute on function app.ops_inquiry_note(uuid, text) to kaname_app;

create or replace function app.inquiry_reply_notice(p_message uuid) returns integer
language plpgsql volatile security definer set search_path = public, app, pg_temp as $$
declare
  v_me uuid;
  r record;
  v_key text;
begin
  perform app.ops_require('inquiry');
  v_me := app.user_id();
  select m.id, m.tenant_id, i.id as inquiry_id, i.opened_by_member_id as asker
    into r
    from messages m
    join inquiries i on i.conversation_id = m.conversation_id and i.tenant_id = m.tenant_id
   where m.id = p_message and m.kind = 'inquiry_reply' and m.sender_member_id is null
     and m.visibility = 'all' and m.deleted_at is null and m.created_by = v_me
     and i.deleted_at is null;
  if not found or r.asker is null then
    raise exception '返事が無い' using errcode = 'no_data_found';
  end if;
  v_key := 'inquiry_replied:' || r.id;
  if exists (select 1 from notifications where tenant_id = r.tenant_id and member_id = r.asker and dedupe_key = v_key) then
    return 0;
  end if;
  insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, dedupe_key, created_by)
    values (r.tenant_id, r.asker, 'inapp', 'inquiry.replied', jsonb_build_object('inquiry_id', r.inquiry_id), v_key, v_me);
  return 1;
end $$;
revoke all on function app.inquiry_reply_notice(uuid) from public;
grant execute on function app.inquiry_reply_notice(uuid) to kaname_app;

insert into app.schema_migrations (name) values ('20261128011500_ops_inbox_reply.sql') on conflict do nothing;
