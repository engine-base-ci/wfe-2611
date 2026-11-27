-- 20261122100700 項目の変更を点の形に戻す（K-576・関門 C2・C6・D-150.52・D-150.47・D-150.40・D-150.30・D-150.56）
--   列と表は足さない。足す関数は 1 つ：app.ticket_item_restore（口 restoreTicketItems が呼ぶ）。
--   点と正味の変わりは K-433 の app.ticket_item_changes から取る（点の数え方を 2 つ持たない）。
--   戻す先は各組の関数を呼んで通す（決まりを 2 つ持たない・L-002）：期限と開始日＝app.ticket_due_set（K-483）・優先度＝app.ticket_sort_set（K-440）・
--   予定時間＝app.ticket_estimate_set（K-583）・会社の項目＝app.ticket_fields_set（K-564）。各組の関数が自分の変更の行・受け箱の行・証跡を書く。
--   この関数が足すのは、まとめの行（やり取りの kind change・changes の field が item_restore）と証跡 ticket.item_restore だけ。
--   plpgsql にする（期限の関数は migration の並びで後〔20261123085800〕なので、呼ぶ時に引く）。
--   security definer・search_path に pg_temp・public から外し、kaname_app だけに渡す。中に begin／commit を書かない（migrate.ts が 1 本を 1 つの取引で当てる）

-- ---------------------------------------------------------------- 組の関数の答えが「この項目の断り」でないとき（呼ぶ前に確かめ済みの守り・知らない言葉）は、取引ごと止める
--   口は例外を 503・E-PAGE-003 にする（何も残らない）。言葉だけを出し、値の字は出さない
create or replace function app.ticket_item_restore_stop(p_kind text) returns void
language plpgsql volatile set search_path = public, app, pg_temp as $$
begin
  raise exception 'ticket_item_restore: %', p_kind using errcode = 'P0001';
end $$;
revoke all on function app.ticket_item_restore_stop(text) from public;

-- ---------------------------------------------------------------- 項目を点 p_from の形に戻す（1 つの取引）
--   断る順：会社か人が無い・今のメンバーでない → not_member／チケットを錠で読み、無い・消した・見えない → not_found／書けない → not_writable
--     （ここまでの判定の例外は guard_failed）→ 無い点（K-433 の関数が not_found）→ not_found → 完了 → done → p_from が p_to 以上 → nothing
--     → p_to が今の最新の点でない → stale → 正味の変わりが空 → nothing
--   答え：{changed, restored: [{field, name}], skipped: [{field, name, why}]}（正味の変わりの並び）か {error: …}
create or replace function app.ticket_item_restore(p_ticket uuid, p_from int, p_to int) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_tenant uuid := app.tenant_id(); v_me uuid := app.user_id(); t tickets%rowtype; v_err text;
        v_ch jsonb; v_diff jsonb; e jsonb; f text; r jsonb; k text; v_has boolean;
        v_names jsonb := '{}'::jsonb;        -- 欄 → 名前
        v_why jsonb := '{}'::jsonb;          -- 欄 → 戻せなかった訳
        v_done text[] := '{}';               -- 戻した欄
        v_due jsonb := '{}'::jsonb;          -- 期限と開始日の戻す値（今と違う物だけ）
        v_prio text; v_prio_reason text; v_est jsonb; v_est_go boolean := false;
        v_fields jsonb := '{}'::jsonb;       -- 会社の項目の id → 戻す生の値（今と違う物だけ）
        v_cur jsonb; v_restored jsonb := '[]'::jsonb; v_skipped jsonb := '[]'::jsonb;
        c_generic constant text := 'この項目は戻せません';
        c_due_why constant jsonb := jsonb_build_object(
          'past', '期限は今日より前の日には戻せません',
          'order_state', '開始日が期限より後になるので戻せません',
          'over_parent', '親の期限より後になるので戻せません',
          'under_child', '子の期限より前になるので戻せません',
          'bad_date', 'この項目は戻せません');
        c_field_why constant jsonb := jsonb_build_object(
          'field_not_found', 'この項目は消されたので戻せません',
          'required_empty', '必須の項目は空に戻せません',
          'bad_type', '選択肢が無くなったので戻せません',
          'bad_option', '選択肢が無くなったので戻せません',
          'not_in_kind', '選択肢が無くなったので戻せません');
begin
  if v_tenant is null or v_me is null then return jsonb_build_object('error', 'not_member'); end if;
  begin
    if not app.approval_member_now() then v_err := 'not_member'; end if;
  exception when others then
    return jsonb_build_object('error', 'guard_failed');
  end;
  if v_err is not null then return jsonb_build_object('error', v_err); end if;
  -- 同じチケットの同時の 2 本は 1 本ずつ（後の 1 本は前の 1 本が書いた後の点を見て stale になる）。組の関数と同じ no key update
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

  v_ch := app.ticket_item_changes(t.id, p_from, p_to);
  if v_ch ? 'error' then
    return jsonb_build_object('error', case v_ch ->> 'error' when 'forbidden' then 'not_member' else 'not_found' end);
  end if;
  if t.completed_at is not null or exists (select 1 from ticket_stages st where st.id = t.stage_id and st.key = 'done') then
    return jsonb_build_object('error', 'done');
  end if;
  if p_from >= p_to then return jsonb_build_object('error', 'nothing'); end if;
  if p_to is distinct from (v_ch -> 'points' -> 0 ->> 'n')::int then return jsonb_build_object('error', 'stale'); end if;
  v_diff := coalesce(v_ch -> 'diff', '[]'::jsonb);
  if jsonb_array_length(v_diff) = 0 then return jsonb_build_object('error', 'nothing'); end if;

  -- 戻す値を決める（正味の変わりの行ごと）。今と同じ値の項目は、戻した扱いにも戻せなかった扱いにもしない
  for e in select x from jsonb_array_elements(v_diff) x loop
    f := e ->> 'field';
    v_names := v_names || jsonb_build_object(f, e ->> 'name');
    if not coalesce((e ->> 'restorable')::boolean, false) then
      v_why := v_why || jsonb_build_object(f, coalesce(e ->> 'why', c_generic));
      continue;
    end if;
    if f in ('due_on', 'start_on') then
      if (e ->> 'from') is distinct from (case f when 'due_on' then t.due_on::text else t.start_on::text end) then
        v_due := v_due || jsonb_build_object(f, e -> 'from');
      end if;
    elsif f = 'priority' then
      if (e ->> 'from') = '中' then
        if t.priority <> 'mid' then v_prio := 'mid'; end if;
      elsif (e ->> 'from') = '高' then
        if t.priority <> 'high' then
          -- 高に戻す理由：点 p_from より前（k <= p_from - 1）で最後に優先度を高へ変えた行の理由
          select c.c ->> 'note' into v_prio_reason
            from app.ticket_item_rows(t.id) ir, jsonb_array_elements(ir.changes) with ordinality as c(c, ord)
           where ir.k <= p_from - 1 and c.c ->> 'field' = 'priority' and c.c ->> 'to' = '高'
           order by ir.k desc, c.ord desc limit 1;
          if nullif(btrim(coalesce(v_prio_reason, '')), '') is null then
            v_why := v_why || jsonb_build_object(f, '優先度を高に戻す理由が残っていないので戻せません');
          else
            v_prio := 'high';
          end if;
        end if;
      else
        v_why := v_why || jsonb_build_object(f, c_generic);
      end if;
    else
      -- 予定時間・会社の項目は生の値 raw_from から戻す。区間の最初の行に raw_from が無ければ戻せない
      select c.c ? 'raw_from' into v_has
        from app.ticket_item_rows(t.id) ir, jsonb_array_elements(ir.changes) with ordinality as c(c, ord)
       where ir.k >= p_from and ir.k <= p_to - 1 and c.c ->> 'field' = f
       order by ir.k, c.ord limit 1;
      if not coalesce(v_has, false) then
        v_why := v_why || jsonb_build_object(f, case when f = 'estimate_minutes' then '予定時間は戻せません' else c_generic end);
        continue;
      end if;
      if f = 'estimate_minutes' then
        v_est := coalesce(e -> 'raw_from', 'null'::jsonb);
        if v_est is distinct from coalesce(to_jsonb(t.estimate_minutes), 'null'::jsonb) then v_est_go := true; end if;
      else
        k := substr(f, 7);
        select fv.value into v_cur from ticket_field_values fv
         where fv.ticket_id = t.id and fv.field_id::text = k and fv.deleted_at is null;
        if coalesce(e -> 'raw_from', 'null'::jsonb) is distinct from coalesce(v_cur, 'null'::jsonb) then
          v_fields := v_fields || jsonb_build_object(k, coalesce(e -> 'raw_from', 'null'::jsonb));
        end if;
      end if;
    end if;
  end loop;

  -- ① 期限と開始日（1 回。断られたら別々に試す）。理由は決まった文
  if v_due <> '{}'::jsonb then
    r := app.ticket_due_set(t.id, v_due || case when v_due ? 'due_on'
           then jsonb_build_object('due_reason', '版 ' || p_from || ' に戻した') else '{}'::jsonb end);
    if r ? 'error' and (select count(*) from jsonb_object_keys(v_due)) > 1 then
      foreach f in array array['due_on', 'start_on'] loop
        r := app.ticket_due_set(t.id, jsonb_build_object(f, v_due -> f) || case when f = 'due_on'
               then jsonb_build_object('due_reason', '版 ' || p_from || ' に戻した') else '{}'::jsonb end);
        if r ? 'error' then
          if not c_due_why ? (r ->> 'error') then perform app.ticket_item_restore_stop(r ->> 'error'); end if;
          v_why := v_why || jsonb_build_object(f, c_due_why ->> (r ->> 'error'));
        elsif (r ->> 'changed')::boolean then
          v_done := v_done || f;
        end if;
      end loop;
    elsif r ? 'error' then
      if not c_due_why ? (r ->> 'error') then perform app.ticket_item_restore_stop(r ->> 'error'); end if;
      for f in select kk from jsonb_object_keys(v_due) kk loop
        v_why := v_why || jsonb_build_object(f, c_due_why ->> (r ->> 'error'));
      end loop;
    elsif (r ->> 'changed')::boolean then
      v_done := v_done || array(select kk from jsonb_object_keys(v_due) kk);
    end if;
  end if;

  -- ② 優先度
  if v_prio is not null then
    r := app.ticket_sort_set(t.id, case when v_prio = 'high'
           then jsonb_build_object('priority', 'high', 'priority_reason', v_prio_reason)
           else jsonb_build_object('priority', 'mid') end);
    if r ? 'error' then
      if (r ->> 'error') <> 'reason_required' then perform app.ticket_item_restore_stop(r ->> 'error'); end if;
      v_why := v_why || jsonb_build_object('priority', '優先度を高に戻す理由が残っていないので戻せません');
    elsif (r ->> 'changed')::boolean then
      v_done := v_done || 'priority'::text;
    end if;
  end if;

  -- ③ 予定時間
  if v_est_go then
    r := app.ticket_estimate_set(t.id, jsonb_build_object('estimate_minutes', v_est));
    if r ? 'error' then
      if (r ->> 'error') <> 'bad_minutes' then perform app.ticket_item_restore_stop(r ->> 'error'); end if;
      v_why := v_why || jsonb_build_object('estimate_minutes', '予定時間は戻せません');
    elsif (r ->> 'changed')::boolean then
      v_done := v_done || 'estimate_minutes'::text;
    end if;
  end if;

  -- ④ 会社の項目（まず全部を 1 回で。断られたら項目ごとに 1 つずつ試す。組の関数は断るとき何も書かない）
  if v_fields <> '{}'::jsonb then
    r := app.ticket_fields_set(t.id, v_fields, false);
    if r ? 'error' then
      if not c_field_why ? (r ->> 'error') then perform app.ticket_item_restore_stop(r ->> 'error'); end if;
      for k in select kk from jsonb_object_keys(v_fields) kk order by lower(kk), kk loop
        r := app.ticket_fields_set(t.id, jsonb_build_object(k, v_fields -> k), false);
        if r ? 'error' then
          if not c_field_why ? (r ->> 'error') then perform app.ticket_item_restore_stop(r ->> 'error'); end if;
          v_why := v_why || jsonb_build_object('field:' || k, c_field_why ->> (r ->> 'error'));
        elsif (r ->> 'changed')::boolean then
          v_done := v_done || ('field:' || k);
        end if;
      end loop;
    elsif (r ->> 'changed')::boolean then
      v_done := v_done || array(select 'field:' || kk from jsonb_object_keys(v_fields) kk);
    end if;
  end if;

  -- 答えの並びは正味の変わりの並び
  for e in select x from jsonb_array_elements(v_diff) x loop
    f := e ->> 'field';
    if f = any (v_done) then
      v_restored := v_restored || jsonb_build_array(jsonb_build_object('field', f, 'name', v_names ->> f));
    elsif v_why ? f then
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object('field', f, 'name', v_names ->> f, 'why', v_why ->> f));
    end if;
  end loop;
  if jsonb_array_length(v_restored) = 0 then
    return jsonb_build_object('changed', false, 'restored', v_restored, 'skipped', v_skipped);
  end if;

  -- まとめの行（項目の変更の点には数えない・K-433 の除外の表）と証跡（関門 C2・欄の名前だけ・値の字を残さない）
  insert into ticket_messages (tenant_id, ticket_id, author_member_id, kind, body, changes, created_by)
    values (t.tenant_id, t.id, v_me, 'change',
            coalesce(app.member_name(v_me), '') || 'が項目を点 ' || p_from || ' の形に戻しました',
            jsonb_build_array(jsonb_build_object('field', 'item_restore', 'from', p_from::text, 'to', p_to::text,
                                                 'note', '点 ' || p_from || ' の形に戻した')),
            v_me);
  insert into audit_events (tenant_id, actor_member_id, actor_role, action, target_type, target_id, choke_point_id, payload, created_by)
    values (t.tenant_id, v_me, 'member', 'ticket.item_restore', 'tickets', t.id::text, 'C2',
            jsonb_build_object('from', p_from, 'to', p_to,
                               'restored', (select coalesce(jsonb_agg(x ->> 'field'), '[]'::jsonb) from jsonb_array_elements(v_restored) x),
                               'skipped', (select coalesce(jsonb_agg(x ->> 'field'), '[]'::jsonb) from jsonb_array_elements(v_skipped) x)),
            v_me);
  return jsonb_build_object('changed', true, 'restored', v_restored, 'skipped', v_skipped);
end $$;
revoke all on function app.ticket_item_restore(uuid, int, int) from public;
grant execute on function app.ticket_item_restore(uuid, int, int) to kaname_app;
