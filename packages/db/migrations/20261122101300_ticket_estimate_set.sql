-- 20261122101300 人がチケットの予定時間を変える（K-583・関門 C2・C6・D-128.45・D-130.1・D-150.1・D-150.32・D-150.36・D-150.40・D-150.43・D-150.50・D-150.52）
--   列は足さない（estimate_minutes は 0071 に在る）。足す関数は 2 つ：
--     ① app.ticket_estimate_label：分を変更の 1 行の字にする（空は「（空）」・中だけで使う・誰にも execute を渡さない）
--     ② app.ticket_estimate_set：人が予定時間を変える（1 つの処理）。口 updateTicket の組 ticketEstimate が呼ぶ（K-387 の表に 1 組足す）
--   どの関数も p_member を受けず、呼んだ人を app.user_id() で引く。security definer・search_path に pg_temp・public から外し、口が呼ぶ関数だけを kaname_app に渡す。
--   中に begin／commit を書かない（migrate.ts が 1 本を 1 つの取引で当てる）。もう一度当てても誤りにならない形にする

-- ---------------------------------------------------------------- 分を字にする（0〜59 は「N 分」・60 の倍数は「H 時間」・それ以外は「H 時間 M 分」・空は「（空）」）
create or replace function app.ticket_estimate_label(p_minutes integer) returns text
language sql immutable set search_path = public, app, pg_temp as $$
  select case
    when p_minutes is null then '（空）'
    when p_minutes / 60 = 0 then (p_minutes % 60)::text || ' 分'
    when p_minutes % 60 = 0 then (p_minutes / 60)::text || ' 時間'
    else (p_minutes / 60)::text || ' 時間 ' || (p_minutes % 60)::text || ' 分'
  end
$$;
revoke all on function app.ticket_estimate_label(integer) from public;

-- ---------------------------------------------------------------- ② 人が予定時間を変える（1 つの処理）
--   p の鍵：estimate_minutes（整数 0〜100000 か null＝空にする）。
--   見る順：今のメンバーか → チケット（無い・消した・見えない）→ 書けるか（ここまでの判定の例外は guard_failed）→ 値（bad_minutes）
--   完了したチケットでも、仕組みの段（承認待ち・実行中）の間でも変えられる（段は見ない）。
--   同じ値（もともと空を空にするのも）は何も書かず changed false（行も更新時刻も知らせも証跡も変えない）。
--   変えたら：列 → やり取りの変更の 1 行（raw_from・raw_to は分の整数か null）→ 担当者の受け箱の行（担当者でない人が変えたときだけ）→ 証跡
create or replace function app.ticket_estimate_set(p_ticket uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_tenant uuid := app.tenant_id(); v_me uuid := app.user_id(); t tickets%rowtype;
        v_p jsonb := coalesce(p, '{}'::jsonb); v_err text;
        v_num numeric; v_new integer; v_old integer;
        v_changes jsonb; v_body text; v_msg uuid;
        c_max constant integer := 100000;        -- 予定時間の上限（分・作る口の見込み・K-387 の実績と同じ）
begin
  if v_tenant is null or v_me is null then return jsonb_build_object('error', 'not_member'); end if;
  -- 守りの判定（今のメンバーか）の所で例外になったら、外に投げずに guard_failed を返して何も書かない（fail-closed・D-136.1）
  begin
    if not app.approval_member_now() then v_err := 'not_member'; end if;
  exception when others then
    return jsonb_build_object('error', 'guard_failed');
  end;
  if v_err is not null then return jsonb_build_object('error', v_err); end if;
  -- 同じチケットの同時の 2 本は 1 本ずつにする（チケットの行で待ち合わせる。後の 1 本は前の 1 本が書いた後の行を見る）
  select * into t from tickets where id = p_ticket and tenant_id = v_tenant for no key update;
  if t.id is null or t.deleted_at is not null then return jsonb_build_object('error', 'not_found'); end if;
  begin
    if not app.ticket_visible(t.id) then v_err := 'not_found';
    elsif not app.ticket_writable(t.id) then v_err := 'not_writable';
    end if;
  exception when others then
    return jsonb_build_object('error', 'guard_failed');
  end;
  if v_err is not null then return jsonb_build_object('error', v_err); end if;

  -- 値：整数 0〜100000 か null（小数・文字・真偽・並び・範囲外は bad_minutes）
  if not (v_p ? 'estimate_minutes') then return jsonb_build_object('error', 'bad_minutes', 'field', 'estimate_minutes'); end if;
  if jsonb_typeof(v_p -> 'estimate_minutes') = 'null' then
    v_new := null;
  elsif jsonb_typeof(v_p -> 'estimate_minutes') = 'number' then
    v_num := (v_p ->> 'estimate_minutes')::numeric;
    if v_num <> trunc(v_num) or v_num < 0 or v_num > c_max then
      return jsonb_build_object('error', 'bad_minutes', 'field', 'estimate_minutes');
    end if;
    v_new := v_num::integer;
  else
    return jsonb_build_object('error', 'bad_minutes', 'field', 'estimate_minutes');
  end if;
  v_old := t.estimate_minutes;

  -- 何も変わらない（同じ値・もともと空を空にする・二度押し）：1 行も知らせも証跡も書かない
  if v_new is not distinct from v_old then
    return jsonb_build_object('ticket', jsonb_build_object('id', t.id, 'number', t.number, 'updated_at', t.updated_at, 'estimate_minutes', t.estimate_minutes),
                              'changed', false, 'message_id', null, 'estimate_minutes', t.estimate_minutes);
  end if;

  -- 書く（1 つの処理）：列 → 変更の 1 行 → 受け箱 → 証跡
  update tickets set estimate_minutes = v_new, updated_by = v_me where id = t.id returning * into t;
  v_changes := jsonb_build_array(jsonb_build_object('field', 'estimate_minutes',
                 'from', case when v_old is null then null else app.ticket_estimate_label(v_old) end,
                 'to', case when v_new is null then null else app.ticket_estimate_label(v_new) end,
                 'raw_from', v_old, 'raw_to', v_new));
  v_body := app.member_name(v_me) || 'が予定時間を' || app.ticket_estimate_label(v_old) || ' → ' || app.ticket_estimate_label(v_new) || 'に変えました';
  insert into ticket_messages (tenant_id, ticket_id, author_member_id, kind, body, changes, created_by)
    values (t.tenant_id, t.id, v_me, 'change', v_body, v_changes, v_me)
  returning id into v_msg;
  -- 担当者でない人が変えたときだけ、担当者（今のメンバー：抜けた・止められた人は除く）の受け箱に知らせる（画面の中だけ・メールは出さない・D-150.32）。
  --   本文はチケットの id・番号・リンク・変更の 1 行の id・変えた欄の名前だけ（値の字・題名は入れない）
  if t.assignee_member_id is not null and t.assignee_member_id <> v_me and app.ticket_member_ok(t.tenant_id, t.assignee_member_id) then
    -- 1 回の要求は 1 人に 1 通（代表の答え ⑮7・PM の決め 2026-11-23 04:55）：同じ取引で、この人・このチケットの受け箱の行が既に在れば
    --   （段・優先度・親の組が先に書いた行）、新しく書かず、その行の fields に estimate_minutes を足す。無ければ新しく書く
    update notifications n
       set payload = n.payload || jsonb_build_object('fields', coalesce(n.payload -> 'fields', '[]'::jsonb) || jsonb_build_array('estimate_minutes'))
     where n.id = (select n2.id from notifications n2
                    where n2.tenant_id = t.tenant_id and n2.member_id = t.assignee_member_id and n2.channel_id = 'inapp'
                      and n2.event_kind_id in ('ticket.stage_changed', 'ticket.sort_changed')
                      and n2.payload ->> 'ticket_id' = t.id::text
                      and n2.xmin = pg_current_xact_id()::xid
                    order by n2.created_at desc, n2.id desc limit 1);   -- 1 行だけに足す（同じ取引に行が複数あっても全部には足さない）
    if not found then
      insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, dedupe_key, sent_at, created_by)
        values (t.tenant_id, t.assignee_member_id, 'inapp', 'ticket.sort_changed',
                jsonb_build_object('ticket_id', t.id, 'number', t.number, 'url', '/tickets/' || t.id::text, 'message_id', v_msg,
                                   'fields', jsonb_build_array('estimate_minutes')),
                'ticket.sort_changed:' || v_msg::text, now(), v_me);
    end if;
  end if;
  -- 証跡（関門 C2）。中身は変えた欄の名前だけ（値の字を残さない）
  insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
    values (t.tenant_id, v_me, 'member', 'ticket.estimate', 'tickets', t.id::text, 'C2',
            jsonb_build_object('fields', jsonb_build_array('estimate_minutes')), v_me);
  return jsonb_build_object('ticket', jsonb_build_object('id', t.id, 'number', t.number, 'updated_at', t.updated_at, 'estimate_minutes', t.estimate_minutes),
                            'changed', true, 'message_id', v_msg, 'estimate_minutes', t.estimate_minutes);
end $$;
revoke all on function app.ticket_estimate_set(uuid, jsonb) from public;
grant execute on function app.ticket_estimate_set(uuid, jsonb) to kaname_app;
