-- 20261128015100_ops_workspace_log 運営が 1 社の問い合わせと記録を読む（K-1011・関門 C2・D-156.3・D-156.12・D-156.17・D-156.25・D-156.48・D-125.129・D-128.108）
--   ① app.ops_workspace_inquiries(会社)：listOpsWorkspaceInquiries の 7 欄（K-1006）。その会社の消していない問い合わせ全部（状態 4 つとも）を
--      作った時刻の新しい順。内容（本文・やり取り）は返さない（D-156.25）。できること inquiry が要る
--   ② app.ops_workspace_audit(会社, from, to, limit)：listOpsWorkspaceAudit の 7 欄（K-1006）。その会社を指した運営の記録（ops_audit_events）を
--      起きた時刻の新しい順。from・to は日本時間の日付（両端を含む・null は絞らない）。limit は 1〜100（null は 50）。運営の人なら誰でも
--   ③ app.ops_audit_action_label(操作の名前)：操作の字の表。この関数が正本（書く口の葉はこの名前で app.record_ops_audit を呼ぶ）。知らない名前は「運営の操作」
--   ①② は頭で app.ops_require（K-947 の型・2 層目）→ app.ops_target（運営の会社・無い・作りかけ・消した会社は P0002 → 404）。
--   読むだけなので運営の記録は書かない（D-128.108 は書く操作だけ）。索引は ops_audit_events_target_idx（0003）を使う。
--   どの関数も security definer・search_path に pg_temp・public から外す（D-128.171）。時刻は UTC・ミリ秒まで・末尾 Z の字

create or replace function app.ops_audit_action_label(p_action text) returns text
language sql immutable set search_path = public, app, pg_temp as $$
  select case p_action
    when 'peek.open' then '中を見た'
    when 'peek.close' then '中を見るのを閉じた'
    when 'workspace.stop_scheduled' then '止める日を決めた'
    when 'workspace.stop' then '止めた'
    when 'workspace.resume' then '再開した'
    when 'verification.resend' then '本人確認のメールを送り直した'
    when 'plan.change' then '代わりにプランを変えた'
    when 'invoice.issue' then '請求書を出した'
    when 'payment.record' then '入金を記録した'
    when 'notice.send' then 'お知らせを送った'
    when 'inquiry.take' then '問い合わせの担当を取った'
    when 'inquiry.release' then '問い合わせの担当を外した'
    when 'inquiry.done' then '問い合わせを済みにした'
    when 'inquiry.reopen' then '問い合わせを開き直した'
    when 'inquiry.later' then '問い合わせを後でにした'
    when 'inquiry.reply' then '問い合わせに返した'
    when 'inquiry.note' then '社内メモを書いた'
    when 'invoice.overdue_notice' then '期限を過ぎた知らせを出した'
    when 'pwned.acknowledge' then '照合が使えなかった登録を確かめた'
    else '運営の操作'
  end
$$;
revoke all on function app.ops_audit_action_label(text) from public;

-- 1 社の問い合わせの 7 欄。聞いた人は opened_by_member_id、担当は assignee_ops_member_id（運営の会社の人）の members.display_name
create or replace function app.ops_workspace_inquiries(p_tenant uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_rows jsonb;
begin
  perform app.ops_require('inquiry');
  perform app.ops_target(p_tenant);

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', i.id,
           'title', i.title,
           'topic', i.topic_key,
           'asker_name', asker.display_name,
           'owner_name', owner.display_name,
           'state', i.state,
           'created_at', to_char(date_trunc('milliseconds', i.created_at) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
         order by i.created_at desc, i.id desc), '[]'::jsonb)
    into v_rows
    from inquiries i
    left join members asker on asker.id = i.opened_by_member_id
    left join members owner on owner.id = i.assignee_ops_member_id
   where i.tenant_id = p_tenant and i.deleted_at is null;

  return v_rows;
end $$;
revoke all on function app.ops_workspace_inquiries(uuid) from public;
grant execute on function app.ops_workspace_inquiries(uuid) to kaname_app;

-- 1 社の記録の 7 欄。した人は ops_member_id（運営の会社の members.id）の display_name。対象の字と理由は payload の target_label・reason
create or replace function app.ops_workspace_audit(p_tenant uuid, p_from date, p_to date, p_limit integer) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_rows jsonb;
begin
  perform app.ops_require('any');
  perform app.ops_target(p_tenant);

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', e.id,
           'at', to_char(date_trunc('milliseconds', e.occurred_at) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
           'actor_name', e.actor_name,
           'action', e.action,
           'action_label', app.ops_audit_action_label(e.action),
           'target_label', e.payload ->> 'target_label',
           'reason', e.payload ->> 'reason')
         order by e.occurred_at desc, e.id desc), '[]'::jsonb)
    into v_rows
    from (
      select a.id, a.occurred_at, a.action, a.payload, m.display_name as actor_name
        from ops_audit_events a
        left join members m on m.id = a.ops_member_id
       where a.target_tenant_id = p_tenant and a.deleted_at is null
         and (p_from is null or a.occurred_at >= (p_from::timestamp at time zone 'Asia/Tokyo'))
         and (p_to is null or a.occurred_at < ((p_to + 1)::timestamp at time zone 'Asia/Tokyo'))
       order by a.occurred_at desc, a.id desc
       limit v_limit
    ) e;

  return v_rows;
end $$;
revoke all on function app.ops_workspace_audit(uuid, date, date, integer) from public;
grant execute on function app.ops_workspace_audit(uuid, date, date, integer) to kaname_app;
