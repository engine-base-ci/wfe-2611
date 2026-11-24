-- 20261123088300 人がチケットの期限・開始日を変える（K-483・関門 C2・D-125.33・D-128.65・D-130.1・D-150.4・D-151.6・D-151.11〜13）
--   期限・開始日は app.ticket_due_set だけが人の変更として書く（K-483）。列は足さない（due_on・start_on と check (start_on <= due_on) は 0071 に在る）。
--   口 updateTicket の組 due（apps/api/src/features/F7/due/fields.ts）が呼ぶ。p_member を受けず、呼んだ人を app.user_id() で引く。
--   security definer・search_path に pg_temp・public から外し、kaname_app だけに渡す。中に begin／commit を書かない（migrate.ts が 1 本を 1 つの取引で当てる）

-- ---------------------------------------------------------------- 日付の字（YYYY-MM-DD で暦にある日だけ・時刻つきは断る）を date にする。合わなければ null
create or replace function app.ticket_due_date(p_text text) returns date
language plpgsql immutable set search_path = public, app, pg_temp as $$
declare v date;
begin
  if p_text is null or p_text !~ '^\d{4}-\d{2}-\d{2}$' then return null; end if;
  begin
    v := p_text::date;
  exception when others then
    return null;
  end;
  if to_char(v, 'YYYY-MM-DD') <> p_text then return null; end if;   -- 2 月 30 日などを丸めない
  return v;
end $$;
revoke all on function app.ticket_due_date(text) from public;

-- ---------------------------------------------------------------- 答えの ticket（id・number・updated_at と、送った欄の列だけ。日付は YYYY-MM-DD の字か null）
create or replace function app.ticket_due_row(t tickets, p_due boolean, p_start boolean) returns jsonb
language sql stable set search_path = public, app, pg_temp as $$
  select jsonb_build_object('id', t.id, 'number', t.number, 'updated_at', t.updated_at)
         || case when p_due then jsonb_build_object('due_on', t.due_on::text) else '{}'::jsonb end
         || case when p_start then jsonb_build_object('start_on', t.start_on::text) else '{}'::jsonb end
$$;
revoke all on function app.ticket_due_row(tickets, boolean, boolean) from public;

-- ---------------------------------------------------------------- 人が期限・開始日を変える（1 つの処理）
--   p の鍵：due_on・start_on（YYYY-MM-DD の字か null）・due_reason（字・due_on を送るときだけ・要る）・expected_due_on・expected_start_on（画面が見ていた値・送ったときだけ比べる）。
--   見る順：今のメンバーか → チケット（無い・消した・見えない）→ 書けるか（ここまでの判定の例外は guard_failed）→ 完了（done）→ 形（bad_date・bad_input・reason_required・reason_long）
--     → 画面が見ていた値（stale）→ 変わらない（changed false で何も書かない）→ 今日より前の期限（past）→ 開始日が期限より後（order_state）→ 親より後（over_parent）・子より前（under_child）
--   変えたら：列（送った欄だけ）→ やり取りの変更の 1 行 → 期限が変わったときだけ受け箱の行（承認する人と担当者・変えた人を除く・1 回の要求は 1 人に 1 通）→ 証跡
create or replace function app.ticket_due_set(p_ticket uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_tenant uuid := app.tenant_id(); v_me uuid := app.user_id(); t tickets%rowtype;
        v_p jsonb := coalesce(p, '{}'::jsonb); v_err text; k text;
        v_due_sent boolean := v_p ? 'due_on'; v_start_sent boolean := v_p ? 'start_on';
        v_new_due date; v_new_start date; v_exp date; v_reason text; v_reason_raw text;
        v_due_changed boolean := false; v_start_changed boolean := false;
        v_after_due date; v_after_start date; v_today date := (now() at time zone 'Asia/Tokyo')::date;
        v_parent_due date; v_fields text[] := '{}'; v_parts text[] := '{}'; v_changes jsonb := '[]'::jsonb;
        v_body text; v_msg uuid; v_to uuid; v_row jsonb;
        c_reason_max constant integer := 200;
begin
  if v_tenant is null or v_me is null then return jsonb_build_object('error', 'not_member'); end if;
  begin
    if not app.approval_member_now() then v_err := 'not_member'; end if;
  exception when others then
    return jsonb_build_object('error', 'guard_failed');
  end;
  if v_err is not null then return jsonb_build_object('error', v_err); end if;
  -- 同じチケットの同時の 2 本は 1 本ずつ（後の 1 本は前の 1 本が書いた後の行を見る）
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
  if t.completed_at is not null then return jsonb_build_object('error', 'done'); end if;

  -- 形（口の前処理と同じ決まりの 2 層目）
  foreach k in array array['due_on', 'start_on', 'expected_due_on', 'expected_start_on'] loop
    if v_p ? k and jsonb_typeof(v_p -> k) <> 'null'
       and (jsonb_typeof(v_p -> k) <> 'string' or app.ticket_due_date(v_p ->> k) is null) then
      return jsonb_build_object('error', 'bad_date', 'field', k);
    end if;
  end loop;
  if v_p ? 'due_reason' and not v_due_sent then return jsonb_build_object('error', 'bad_input', 'field', 'due_reason'); end if;
  if v_p ? 'expected_due_on' and not v_due_sent then return jsonb_build_object('error', 'bad_input', 'field', 'expected_due_on'); end if;
  if v_p ? 'expected_start_on' and not v_start_sent then return jsonb_build_object('error', 'bad_input', 'field', 'expected_start_on'); end if;
  if not v_due_sent and not v_start_sent then return jsonb_build_object('error', 'bad_input', 'field', 'body'); end if;
  if v_due_sent then
    if jsonb_typeof(v_p -> 'due_reason') is distinct from 'string' then
      return jsonb_build_object('error', 'reason_required', 'field', 'due_reason');
    end if;
    v_reason_raw := v_p ->> 'due_reason';
    v_reason := regexp_replace(regexp_replace(v_reason_raw, '[\x01-\x1f\x7f-\x9f]', '', 'g'), '^[\s　]+|[\s　]+$', '', 'g');
    if v_reason = '' then return jsonb_build_object('error', 'reason_required', 'field', 'due_reason'); end if;
    if char_length(v_reason_raw) > c_reason_max then return jsonb_build_object('error', 'reason_long', 'field', 'due_reason'); end if;
    v_new_due := app.ticket_due_date(v_p ->> 'due_on');
  end if;
  if v_start_sent then v_new_start := app.ticket_due_date(v_p ->> 'start_on'); end if;

  -- 画面が見ていた値（null は「無かった」）
  if v_p ? 'expected_due_on' then
    v_exp := app.ticket_due_date(v_p ->> 'expected_due_on');
    if v_exp is distinct from t.due_on then return jsonb_build_object('error', 'stale'); end if;
  end if;
  if v_p ? 'expected_start_on' then
    v_exp := app.ticket_due_date(v_p ->> 'expected_start_on');
    if v_exp is distinct from t.start_on then return jsonb_build_object('error', 'stale'); end if;
  end if;

  v_due_changed := v_due_sent and v_new_due is distinct from t.due_on;
  v_start_changed := v_start_sent and v_new_start is distinct from t.start_on;
  if not v_due_changed and not v_start_changed then
    return jsonb_build_object('ticket', app.ticket_due_row(t, v_due_sent, v_start_sent), 'changed', false, 'message_id', null);
  end if;

  v_after_due := case when v_due_sent then v_new_due else t.due_on end;
  v_after_start := case when v_start_sent then v_new_start else t.start_on end;
  if v_due_changed and v_new_due is not null and v_new_due < v_today then return jsonb_build_object('error', 'past'); end if;
  if v_after_start is not null and v_after_due is not null and v_after_start > v_after_due then
    return jsonb_build_object('error', 'order_state');
  end if;
  if v_due_changed and v_new_due is not null then
    if t.parent_ticket_id is not null then
      select pt.due_on into v_parent_due from tickets pt
       where pt.id = t.parent_ticket_id and pt.tenant_id = v_tenant and pt.deleted_at is null;
      if v_parent_due is not null and v_new_due > v_parent_due then return jsonb_build_object('error', 'over_parent'); end if;
    end if;
    if exists (select 1 from tickets c where c.parent_ticket_id = t.id and c.tenant_id = v_tenant and c.deleted_at is null
                 and c.due_on is not null and c.due_on > v_new_due) then
      return jsonb_build_object('error', 'under_child');
    end if;
  end if;

  -- 変更の 1 行の字と changes（期限が先）
  if v_due_changed then
    v_fields := array_append(v_fields, 'due_on');
    v_changes := v_changes || jsonb_build_array(jsonb_build_object('field', 'due_on',
                   'from', t.due_on::text, 'to', v_new_due::text, 'raw_from', t.due_on::text, 'raw_to', v_new_due::text, 'note', v_reason));
    v_parts := v_parts || case
      when v_new_due is null then '期限をなくした（理由：' || v_reason || '）'
      when t.due_on is null then '期限を ' || to_char(v_new_due, 'MM/DD') || ' に決めた（理由：' || v_reason || '）'
      else '期限を ' || to_char(t.due_on, 'MM/DD') || ' → ' || to_char(v_new_due, 'MM/DD') || ' に変えた（理由：' || v_reason || '）' end;
  end if;
  if v_start_changed then
    v_fields := array_append(v_fields, 'start_on');
    v_changes := v_changes || jsonb_build_array(jsonb_build_object('field', 'start_on',
                   'from', t.start_on::text, 'to', v_new_start::text, 'raw_from', t.start_on::text, 'raw_to', v_new_start::text));
    v_parts := v_parts || case
      when v_new_start is null then '開始日をなくした'
      when t.start_on is null then '開始日を ' || to_char(v_new_start, 'MM/DD') || ' に決めた'
      else '開始日を ' || to_char(t.start_on, 'MM/DD') || ' → ' || to_char(v_new_start, 'MM/DD') || ' に変えた' end;
  end if;
  v_body := app.member_name(v_me) || ' が' || array_to_string(v_parts, '・');

  -- 書く（1 つの処理）：列 → 変更の 1 行 → 受け箱 → 証跡
  update tickets set due_on = v_after_due, start_on = v_after_start, updated_by = v_me where id = t.id returning * into t;
  insert into ticket_messages (tenant_id, ticket_id, author_member_id, kind, body, changes, created_by)
    values (t.tenant_id, t.id, v_me, 'change', v_body, v_changes, v_me)
  returning id into v_msg;
  -- 期限が変わったときだけ、決まっていない承認の承認する人と担当者（今のメンバーだけ・変えた人を除く・同じ人は 1 つ）の受け箱に知らせる（画面の中だけ・D-151.6）。
  --   本文はほかの組と同じ形（id・番号・リンク・変更の 1 行の id・変えた欄の名前。題名・理由・日付の字は入れない）。
  --   1 回の要求は 1 人に 1 通（代表の答え ⑮7）：同じ取引でその人・このチケットの行（前の組の段・優先度・項目・予定時間の行）が在れば、新しく書かず fields に足す
  if v_due_changed then
    for v_to in
      select distinct w.m from (
        select a.approver_member_id as m from approvals a
         where a.ticket_id = t.id and a.tenant_id = t.tenant_id and a.decision is null and a.withdrawn_at is null and a.deleted_at is null
        union all
        select t.assignee_member_id
      ) w
      where w.m is not null and w.m <> v_me and app.ticket_member_ok(t.tenant_id, w.m)
    loop
      update notifications n
         set payload = n.payload || jsonb_build_object('fields', coalesce(n.payload -> 'fields', '[]'::jsonb) || to_jsonb(v_fields))
       where n.id = (select n2.id from notifications n2
                      where n2.tenant_id = t.tenant_id and n2.member_id = v_to and n2.channel_id = 'inapp'
                        and n2.event_kind_id in ('ticket.stage_changed', 'ticket.sort_changed')
                        and n2.payload ->> 'ticket_id' = t.id::text
                        and n2.xmin = pg_current_xact_id()::xid
                      order by n2.created_at desc, n2.id desc limit 1);
      if not found then
        insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, dedupe_key, sent_at, created_by)
          values (t.tenant_id, v_to, 'inapp', 'ticket.due_changed',
                  jsonb_build_object('ticket_id', t.id, 'number', t.number, 'url', '/tickets/' || t.id::text, 'message_id', v_msg,
                                     'fields', to_jsonb(v_fields)),
                  'ticket.due_changed:' || v_msg::text, now(), v_me);
      end if;
    end loop;
  end if;
  -- 証跡（関門 C2）。中身は変えた欄の名前だけ（日付・理由の字を残さない）
  insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
    values (t.tenant_id, v_me, 'member', 'ticket.due', 'tickets', t.id::text, 'C2',
            jsonb_build_object('fields', to_jsonb(v_fields)), v_me);
  return jsonb_build_object('ticket', app.ticket_due_row(t, v_due_sent, v_start_sent), 'changed', true, 'message_id', v_msg);
end $$;
revoke all on function app.ticket_due_set(uuid, jsonb) from public;
grant execute on function app.ticket_due_set(uuid, jsonb) to kaname_app;
