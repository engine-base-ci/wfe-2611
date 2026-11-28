-- 20261123082900 消したチケットを戻す（K-489・契約の口 restoreTicket・P7・D-128.84・D-128.116・D-129.43・D-130.4・D-136.2・D-148.5・D-151.14・D-151.16・D-151.20）
--   新しい表・列は作らない。関数を 1 つ足す（書く・関門 C2）。K-488 の app.ticket_delete（消す）の逆。
--
-- app.ticket_restore(p_ticket)：1 つの取引の中で、消したチケット（と一緒に消えた子・孫）を戻す。
--   呼んだ人は app.user_id() で引く（引数で人を受けない）。戻せる人は、消した本人（いまの権限は問わない）と、そのグループのマネージャー・会社の管理者（app.manages_scope）。edit は要らない。
--   答えを決める順（先に当たった物で答える）：
--     ① 同じ会社に行が無い → NOT_FOUND
--     ② その人にグループが見えない（visible_scopes）かつ消した本人でもない → NOT_FOUND（別の会社・見えないグループ・無い id と同じ答え。消した物が有ることも漏らさない）
--     ③ 消した本人でも、グループのマネージャー・管理者でもない → FORBIDDEN
--     ④ 消えていない → NOT_DELETED（消えていない物は消した本人が空になるので、作った人・マネージャー・管理者に返す。ほかの人は ③ の 403。同時の 2 回目で負けた消した本人に 409 を返すため）
--     ⑤ 消した時刻の 30 日後を過ぎている → EXPIRED
--     ⑥ 親が消えている → PARENT_DELETED（親を先に戻す）
--     ⑦ 戻す
--   一緒に戻すのは、再帰で子孫（子・孫の 2 段下まで）をたどり、deleted_at が同じで deleted_by も同じ物だけ（cascade は 1 つの取引で now() が同じ・K-488）。
--   途中が別の時に消えていれば、そこから先はたどらない。付け替え（move・detach）・取り下げた承認・止めた AI の実行・取り消した渡しは戻さない。
--   戻したら deleted_at・deleted_by を空に、updated_by を戻した人に。番号・題名・親・担当者・段は変えない。
--   答え：{ ok: true, id, restored_count }
--         { ok: false, code: NOT_FOUND | FORBIDDEN | NOT_DELETED | EXPIRED | PARENT_DELETED }

create or replace function app.ticket_restore(p_ticket uuid) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_me uuid := app.user_id();
  v_tenant uuid := app.tenant_id();
  v_t tickets%rowtype;
  v_parent_deleted boolean;
  v_ids uuid[];
  v_id uuid;
begin
  if v_me is null or v_tenant is null or not app.member_ok() then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  -- 行を for update で取る（消した物も含める。同時の 2 回は 1 回だけ通り、もう 1 回は戻った行を見て NOT_DELETED になる）
  select * into v_t from tickets where id = p_ticket and tenant_id = v_tenant for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  if v_t.deleted_by is distinct from v_me and not (v_t.scope_id = any(visible_scopes(v_me))) then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  if v_t.deleted_at is null then
    -- 消えていない（もう戻っている・別のタブが先に戻した）：消した本人はもう空なので、作った人にも「もう戻っている」を返す（同時の 2 回目）。それ以外は 403
    if v_t.created_by is distinct from v_me and not app.manages_scope(v_t.scope_id) then
      return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
    end if;
    return jsonb_build_object('ok', false, 'code', 'NOT_DELETED');
  end if;
  if v_t.deleted_by is distinct from v_me and not app.manages_scope(v_t.scope_id) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  if v_t.deleted_at + interval '30 days' < now() then
    return jsonb_build_object('ok', false, 'code', 'EXPIRED');
  end if;
  if v_t.parent_ticket_id is not null then
    select p.deleted_at is not null into v_parent_deleted from tickets p
     where p.id = v_t.parent_ticket_id and p.tenant_id = v_tenant;
    if coalesce(v_parent_deleted, false) then
      return jsonb_build_object('ok', false, 'code', 'PARENT_DELETED');
    end if;
  end if;

  -- 一緒に消えた子・孫（親と同じ時刻・同じ人。途中が別の時に消えていればそこで切れる）
  with recursive d as (
    select c.id, 1 as lv from tickets c
     where c.parent_ticket_id = p_ticket and c.tenant_id = v_tenant
       and c.deleted_at = v_t.deleted_at and c.deleted_by is not distinct from v_t.deleted_by
    union all
    select c.id, d.lv + 1 from tickets c join d on c.parent_ticket_id = d.id
     where d.lv < 2 and c.tenant_id = v_tenant
       and c.deleted_at = v_t.deleted_at and c.deleted_by is not distinct from v_t.deleted_by
  )
  select array[p_ticket] || coalesce(array_agg(id), '{}') into v_ids from d;
  perform 1 from tickets where id = any(v_ids) order by id for update;

  update tickets set deleted_at = null, deleted_by = null, updated_by = v_me
   where id = any(v_ids) and tenant_id = v_tenant and deleted_at is not null;

  -- 証跡は 1 枚ずつ（同じ取引・書けなければ全部戻る）
  foreach v_id in array v_ids loop
    perform app.record_audit('tickets.restore', 'tickets', v_id::text, 'C2',
      jsonb_build_object('cause', case when v_id = p_ticket then 'direct' else 'cascade' end));
  end loop;

  return jsonb_build_object('ok', true, 'id', p_ticket, 'restored_count', coalesce(array_length(v_ids, 1), 0));
end $$;
revoke all on function app.ticket_restore(uuid) from public;
grant execute on function app.ticket_restore(uuid) to kaname_app;
