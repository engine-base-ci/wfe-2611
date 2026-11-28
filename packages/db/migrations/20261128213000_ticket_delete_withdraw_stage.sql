-- 20261128213000 チケットを消して承認を取り下げたら、段を作業中に戻す（K-597・K-488・K489-API-012・answer=8b228b743062）
--   20261123082800 の app.ticket_delete を同じ形で置き換え、②（決まっていない承認を取り下げる）の後に 1 段だけ足す：
--   取り下げた承認があり、段が承認待ち（awaiting_approval）のチケットは app.ticket_stage_to(…,'doing') で作業中に戻す。
--   戻さないと、戻した（restore）チケットが承認待ちのまま固まり「AI に任せる」が出ない（K597-X1-05）。
--   ほかの段（作業中・終わり 等）と、決まった承認は触らない。

create or replace function app.ticket_delete(p_ticket uuid, p_children text, p_parent uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_me uuid := app.user_id();
  v_tenant uuid := app.tenant_id();
  v_at timestamptz := now();
  v_t tickets%rowtype;
  v_kids int;
  v_mode text;
  v_ids uuid[];
  v_dest tickets%rowtype;
  v_withdrawn int := 0;
  v_stopped int := 0;
  v_why constant text := 'チケットが消されたので止めました';
  v_id uuid;
  r action_runs%rowtype;
begin
  if v_me is null or v_tenant is null or not app.member_ok() then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  -- 行を for update で取る（同時の 2 回は 1 回だけ通り、もう 1 回は消えた物が見えない）
  select * into v_t from tickets where id = p_ticket and tenant_id = v_tenant and deleted_at is null for update;
  if not found or not app.ticket_visible(p_ticket) then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  if v_t.created_by is distinct from v_me and not has_permission(v_me, 'tickets', v_t.scope_id, 'edit') then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  select count(*) into v_kids from tickets
   where parent_ticket_id = p_ticket and tenant_id = v_tenant and deleted_at is null;
  if v_kids > 0 then
    if p_children is null then
      return jsonb_build_object('ok', false, 'code', 'CHILDREN_REQUIRED');
    end if;
    v_mode := p_children;
  end if;
  v_ids := array[p_ticket];

  if v_mode = 'move' then
    if p_parent is null then
      return jsonb_build_object('ok', false, 'code', 'PARENT_NOT_FOUND');
    end if;
    select * into v_dest from tickets where id = p_parent and tenant_id = v_tenant and deleted_at is null;
    if not found or not app.ticket_visible(p_parent) then
      return jsonb_build_object('ok', false, 'code', 'PARENT_NOT_FOUND');
    end if;
    if p_parent = p_ticket or exists (
      with recursive d as (
        select c.id, 1 as lv from tickets c where c.parent_ticket_id = p_ticket and c.tenant_id = v_tenant
        union all
        select c.id, d.lv + 1 from tickets c join d on c.parent_ticket_id = d.id where d.lv < 5 and c.tenant_id = v_tenant
      )
      select 1 from d where d.id = p_parent
    ) then
      return jsonb_build_object('ok', false, 'code', 'PARENT_INVALID');
    end if;
    begin
      update tickets set parent_ticket_id = p_parent, updated_by = v_me
       where parent_ticket_id = p_ticket and tenant_id = v_tenant and deleted_at is null;
    exception when sqlstate '22023' then   -- 親子 3 段の引き金（付け替えはこの中だけ巻き戻る）
      return jsonb_build_object('ok', false, 'code', 'TOO_DEEP');
    end;
  elsif v_mode = 'detach' then
    update tickets set parent_ticket_id = null, updated_by = v_me
     where parent_ticket_id = p_ticket and tenant_id = v_tenant and deleted_at is null;
  elsif v_mode = 'cascade' then
    with recursive d as (
      select c.id, 1 as lv from tickets c where c.parent_ticket_id = p_ticket and c.tenant_id = v_tenant and c.deleted_at is null
      union all
      select c.id, d.lv + 1 from tickets c join d on c.parent_ticket_id = d.id
       where d.lv < 2 and c.tenant_id = v_tenant and c.deleted_at is null
    )
    select v_ids || coalesce(array_agg(id), '{}') into v_ids from d;
    perform 1 from tickets where id = any(v_ids) order by id for update;
    -- 1 枚でも自分が消せない子・孫があれば、全部やめる
    if exists (
      select 1 from tickets x
       where x.id = any(v_ids) and x.id <> p_ticket
         and x.created_by is distinct from v_me and not has_permission(v_me, 'tickets', x.scope_id, 'edit')
    ) then
      return jsonb_build_object('ok', false, 'code', 'CASCADE_FORBIDDEN');
    end if;
  end if;

  -- ① 消す印を先に立てる（cascade の子・孫は親と同じ時刻・同じ人）
  update tickets set deleted_at = v_at, deleted_by = v_me, updated_by = v_me, delegated_to_clone = false
   where id = any(v_ids) and tenant_id = v_tenant and deleted_at is null;

  -- ② 決まっていない承認を取り下げる（決まった承認は触らない）
  update approvals set withdrawn_at = v_at, status_id = 'withdrawn', updated_by = v_me
   where ticket_id = any(v_ids) and tenant_id = v_tenant
     and decision is null and withdrawn_at is null and deleted_at is null;
  get diagnostics v_withdrawn = row_count;
  -- ②b 取り下げて承認待ちでなくなったチケットは、段を作業中に戻す（戻したときに任せ直せる・K489-API-012・K597-X1-05・answer=8b228b743062）
  if v_withdrawn > 0 then
    for v_id in
      select t.id from tickets t join ticket_stages s on s.id = t.stage_id
       where t.id = any(v_ids) and t.tenant_id = v_tenant and s.key = 'awaiting_approval'
         and exists (select 1 from approvals a where a.ticket_id = t.id and a.tenant_id = v_tenant and a.withdrawn_at = v_at)
    loop
      perform app.ticket_stage_to(v_id, 'doing', v_me);
    end loop;
  end if;

  -- ③ 走っている AI を止める（待っている・動いている・コードを待っている実行を、仕事と実行ごと）
  for r in
    select * from action_runs
     where ticket_id = any(v_ids) and tenant_id = v_tenant
       and status_id in ('queued', 'running', 'asking') and deleted_at is null
     order by created_at for update
  loop
    v_stopped := v_stopped + 1;
    if r.bridge_job_id is not null then
      -- 承認の後の実行（execute）の仕事は、この更新で引き金が実行・段・旗を書く
      update bridge_jobs set state_id = 'stopped', finished_at = now(), partial = null, stopped_reason = v_why
       where id = r.bridge_job_id and kind = 'ticket' and state_id in ('queued', 'running', 'asking') and deleted_at is null;
    end if;
    update action_runs set status_id = 'stopped', error_summary = v_why, finished_at = now()
     where id = r.id and status_id in ('queued', 'running', 'asking');
    if r.phase is distinct from 'execute' then
      perform app.ticket_stage_to(r.ticket_id, 'doing', r.created_by);   -- 「実行中」のまま固まらず、任せ直せる
    end if;
  end loop;

  -- 証跡は 1 枚ずつ（同じ取引・書けなければ全部戻る）
  foreach v_id in array v_ids loop
    perform app.record_audit('tickets.delete', 'tickets', v_id::text, 'C2',
      jsonb_build_object('reason', p_reason, 'children', v_mode,
                         'cause', case when v_id = p_ticket then 'direct' else 'cascade' end));
  end loop;

  return jsonb_build_object('ok', true, 'id', p_ticket, 'deleted_count', coalesce(array_length(v_ids, 1), 0),
    'withdrawn_approvals', v_withdrawn, 'stopped_runs', v_stopped,
    'deleted_at', to_char(date_trunc('milliseconds', v_at) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
end $$;
revoke all on function app.ticket_delete(uuid, text, uuid, text) from public;
grant execute on function app.ticket_delete(uuid, text, uuid, text) to kaname_app;
comment on function app.ticket_delete(uuid, text, uuid, text) is
  '取り下げた承認は withdrawn_at・status_id = ''withdrawn'' だけを書き、resolved_at は書かない（読む側は decision is null and withdrawn_at is null で見ている・0095・0100）。resolved_at で数える読み手を作るときはこの関数も直す';
