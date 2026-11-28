-- 20261125024800_approval_bulk まとめて承認の確かめの読み（K-768・契約の口 previewBulkApproval・bulkApprove・関門 C2・読むだけ・D-153.11・D-153.5・D-128.171）
--   列も表も引き金も足さない。足すのは読むだけの関数 1 本（app.approval_bulk_scan）。
--   承認そのものは 1 件ずつ、1 件承認する口と同じ app.approval_decide（直さない）を口が 1 件 1 取引で呼ぶ。
--   p_all が真：呼んだ人が承認する（今の担当者が自分）承認待ちの成果物の全部を古い順に（50 件を超えたら too_many）。
--   p_all が偽：p_ids（重複は 1 つに・50 個を超えたら too_many）を、承認できる物（items）とできない物（excluded）に分ける。
--   できない理由は在るかを漏らさないよう 4 つに畳む：unavailable（無い・別の会社・消えた・成果物でない・見えない）／
--   decided（決まった・取り下げた）／not_approver（担当者が自分でない）／not_writable（書けない）。
--   app.ticket_writable が例外のときは承認できる側に残す（承認の関数の守りが fail-closed で止める・503）。
--   呼んだ人（要求の文脈）が無ければ null。今のメンバーでなければ {"error":"not_member"}。何も書かない。
--   security definer・search_path に pg_temp・public から外す（D-128.171）。

create or replace function app.approval_bulk_scan(p_ids uuid[], p_all boolean) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := app.tenant_id();
  v_me uuid := app.user_id();
  v_max constant integer := 50;
  v_ids uuid[];
  v_total integer;
  v_id uuid;
  v_ok boolean;
  v_reason text;
  a approvals%rowtype;
  t tickets%rowtype;
  v_eligible uuid[] := '{}';
  v_excluded jsonb := '[]'::jsonb;
  v_items jsonb;
begin
  if v_tenant is null or v_me is null then
    return null;
  end if;
  if not app.approval_member_now() then
    return jsonb_build_object('error', 'not_member');
  end if;

  if coalesce(p_all, false) then
    select coalesce(array_agg(x.id order by x.created_at, x.id), '{}'), count(*)::integer into v_eligible, v_total
      from (
        select ap.id, ap.created_at
          from approvals ap
          join tickets tk on tk.id = ap.ticket_id and tk.tenant_id = v_tenant
         where ap.tenant_id = v_tenant
           and ap.kind = 'artifact'
           and ap.deleted_at is null
           and ap.decision is null and ap.withdrawn_at is null and ap.resolved_at is null
           and tk.deleted_at is null
           and tk.assignee_member_id = v_me
           and app.ticket_visible(tk.id)
      ) x;
    if v_total > v_max then
      return jsonb_build_object('error', 'too_many', 'total', v_total);
    end if;
  else
    select coalesce(array_agg(u.id order by u.n), '{}') into v_ids
      from (select d.id, min(d.n) as n
              from unnest(coalesce(p_ids, '{}'::uuid[])) with ordinality as d(id, n)
             where d.id is not null
             group by d.id) u;
    if coalesce(array_length(v_ids, 1), 0) > v_max then
      return jsonb_build_object('error', 'too_many', 'total', array_length(v_ids, 1));
    end if;
    foreach v_id in array v_ids loop
      a := null;
      t := null;
      v_reason := null;
      select * into a from approvals where id = v_id and tenant_id = v_tenant;
      if a.id is not null and a.ticket_id is not null then
        select * into t from tickets where id = a.ticket_id and tenant_id = v_tenant;
      end if;
      if a.id is null or a.deleted_at is not null or a.ticket_id is null or a.kind is distinct from 'artifact'
         or t.id is null or t.deleted_at is not null or not app.ticket_visible(t.id) then
        v_reason := 'unavailable';
      elsif a.decision is not null or a.withdrawn_at is not null or a.resolved_at is not null then
        v_reason := 'decided';
      elsif t.assignee_member_id is null or t.assignee_member_id <> v_me then
        v_reason := 'not_approver';
      else
        begin
          v_ok := app.ticket_writable(t.id);
        exception when others then
          v_ok := true;   -- 守りの判定が例外なら承認できる側に残す（承認の関数が止める）
        end;
        if not coalesce(v_ok, false) then
          v_reason := 'not_writable';
        end if;
      end if;
      if v_reason is null then
        v_eligible := v_eligible || v_id;
      else
        v_excluded := v_excluded || jsonb_build_array(jsonb_build_object(
          'approval_id', v_id, 'reason', v_reason,
          'number', case when v_reason = 'unavailable' then null else t.number end,
          'title', case when v_reason = 'unavailable' then null else t.title end));
      end if;
    end loop;
  end if;

  -- 承認できる物：承認待ちになった順（古い順）。unchecked はそのチケットの確認項目のうちチェックの無い数（K-739・無ければ 0）
  select coalesce(jsonb_agg(jsonb_build_object(
           'approval_id', ap.id, 'ticket_id', tk.id, 'number', tk.number, 'title', tk.title,
           'irreversible', coalesce(ap.irreversible, false),
           'unchecked', greatest(coalesce((s.v -> 'counts' ->> 'total')::integer, 0)
                                 - coalesce((s.v -> 'counts' ->> 'done')::integer, 0), 0))
           order by ap.created_at, ap.id), '[]'::jsonb)
    into v_items
    from approvals ap
    join tickets tk on tk.id = ap.ticket_id and tk.tenant_id = v_tenant
    cross join lateral (select app.approval_check_summary(tk.id, false) as v) s
   where ap.id = any(v_eligible) and ap.tenant_id = v_tenant;

  return jsonb_build_object('items', v_items, 'excluded', v_excluded);
end
$$;
revoke all on function app.approval_bulk_scan(uuid[], boolean) from public;
grant execute on function app.approval_bulk_scan(uuid[], boolean) to kaname_app;
