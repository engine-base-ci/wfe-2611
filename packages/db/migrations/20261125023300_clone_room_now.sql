-- 20261125023300 分身の部屋の頭と「ようす」を読む（K-753・関門 C2 は読むだけ）
--   新しい表・列は作らない。読む関数を 3 つ足す（どれも security definer・stable・public から外す）。
-- app.clone_pc(p_member)：その人のアカウントの PC の状態 { state: none|live|asleep, label }（中だけ・誰にも渡さない）
-- app.clone_me()：部屋の頭 { name, full_name, since, pc }。今のメンバーでなければ null
-- app.clone_runs(p_me)：自分の分身の実行（中だけ・誰にも渡さない）
-- app.clone_now()：ようす { pc, current, next[], waiting_approvals, stopped }。今のメンバーでなければ null
--   「自分の分身の実行」＝そのチケットのいちばん新しい実行（作った時刻・id の降順）を作った人が自分・チケットが消されていない・見える

create or replace function app.clone_pc(p_member uuid)
returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  select jsonb_build_object(
    'state', case
      when not exists (select 1 from sessions s
                        where s.member_id in (select app.account_members(p_member)) and s.kind_id = 'bridge'
                          and s.revoked_at is null and s.deleted_at is null and s.alive_at is not null) then 'none'
      when app.account_pc_live(p_member) then 'live'
      else 'asleep' end,
    'label', (select s.device_label from sessions s
               where s.member_id in (select app.account_members(p_member)) and s.kind_id = 'bridge'
                 and s.revoked_at is null and s.deleted_at is null and s.alive_at is not null
               order by s.last_seen_at desc nulls last, s.id desc limit 1))
$$;
revoke all on function app.clone_pc(uuid) from public;

create or replace function app.clone_me()
returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare v_me uuid := app.user_id(); m members%rowtype; v_since timestamptz;
begin
  -- 今のメンバーでない（外された・止められた）なら null（口は 403）
  if v_me is null or not app.member_ok()
     or exists (select 1 from members x where x.id = v_me and x.suspended_at is not null) then
    return null;
  end if;
  select * into m from members where id = v_me;
  select least(m.created_at, coalesce(min(c.created_at), m.created_at)) into v_since
    from clones c where c.owner_member_id = v_me and c.deleted_at is null;
  return jsonb_build_object(
    'name', coalesce(nullif(btrim(coalesce(m.call_name, ''), E' \t\r\n　'), ''), m.display_name),
    'full_name', m.display_name,
    'since', to_char(coalesce(v_since, m.created_at) at time zone 'Asia/Tokyo', 'YYYY-MM-DD'),
    'pc', app.clone_pc(v_me));
end $$;
revoke all on function app.clone_me() from public;
grant execute on function app.clone_me() to kaname_app;

-- 自分の分身の実行（チケットごとにいちばん新しい実行・作った人が自分・チケットが消されていない・見える）。中だけで使う
create or replace function app.clone_runs(p_me uuid)
returns table (run_id uuid, ticket_id uuid, phase text, status_id text, job_id uuid, created_at timestamptz,
               started_at timestamptz, finished_at timestamptz, taken_over_at timestamptz,
               ticket_number text, title text, completed_at timestamptz)
language sql stable security definer set search_path = public, app, pg_temp as $$
  select r.id, r.ticket_id, r.phase, r.status_id, r.bridge_job_id, r.created_at, r.started_at, r.finished_at, r.taken_over_at,
         t.number, t.title, t.completed_at
    from tickets t
    join lateral (select x.* from action_runs x
                   where x.ticket_id = t.id and x.deleted_at is null and x.phase is not null and x.status_id is not null
                   order by x.created_at desc, x.id desc limit 1) r on true
   where t.tenant_id = app.tenant_id() and t.deleted_at is null and r.created_by = p_me and app.ticket_visible(t.id)
$$;
revoke all on function app.clone_runs(uuid) from public;

create or replace function app.clone_now()
returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare v_me uuid := app.user_id(); v_current jsonb; v_cur_ticket uuid; v_next jsonb; v_stopped int;
begin
  -- 今のメンバーでない（外された・止められた）なら null（口は 403）
  if v_me is null or not app.member_ok()
     or exists (select 1 from members x where x.id = v_me and x.suspended_at is not null) then
    return null;
  end if;
  select jsonb_build_object('ticket_id', k.ticket_id, 'ticket_number', k.ticket_number, 'title', k.title,
           'started_at', coalesce(k.started_at, k.created_at),
           'progress', (select e.payload->>'text' from bridge_job_events e
                         where e.job_id = k.job_id and e.kind in ('status', 'progress')
                         order by e.created_at desc, e.seq desc limit 1)),
         k.ticket_id
    into v_current, v_cur_ticket
    from app.clone_runs(v_me) k where k.status_id in ('running', 'asking')
   order by coalesce(k.started_at, k.created_at) desc, k.run_id desc limit 1;
  select count(*) into v_stopped from app.clone_runs(v_me) k
   where k.status_id = 'stopped' and k.completed_at is null and k.taken_over_at is null;
  select coalesce(jsonb_agg(x.j order by x.grp, x.ord1, x.ord2 desc, x.rid), '[]'::jsonb) into v_next from (
    select jsonb_build_object('ticket_id', k.ticket_id, 'ticket_number', k.ticket_number, 'title', k.title,
             'state', case when k.status_id = 'queued' then (case when k.phase = 'execute' then 'approved' else 'queued' end) else 'stopped' end) as j,
           case when k.status_id = 'queued' then 1 else 2 end as grp,
           case when k.status_id = 'queued' then k.created_at end as ord1,
           case when k.status_id = 'stopped' then coalesce(k.finished_at, k.created_at) end as ord2,
           k.run_id as rid
      from app.clone_runs(v_me) k
     where k.ticket_id is distinct from v_cur_ticket
       and (k.status_id = 'queued' or (k.status_id = 'stopped' and k.completed_at is null and k.taken_over_at is null))
     order by grp, ord1, ord2 desc, rid limit 10) x;
  return jsonb_build_object('pc', app.clone_pc(v_me), 'current', v_current, 'next', v_next,
                            'waiting_approvals', coalesce(app.approval_queue_count(), 0), 'stopped', v_stopped);
end $$;
revoke all on function app.clone_now() from public;
grant execute on function app.clone_now() to kaname_app;
