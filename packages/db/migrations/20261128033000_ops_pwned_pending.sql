-- 20261128033000 確定前に去った申し込みの照合落ち（K-1110・契約の口 ackOpsPwnedPending・D-156.69・D-156.79・D-156.35・D-128.146）
--   確定しないまま去った申し込み（kaname_auth.pending_signup）は会社の出来事にならない（K-1018 は確定したときに会社へ書く）ので、
--   運営の照合落ちの一覧（K-995 の app.ops_pwned_list）に、まとめて 1 行（workspace・member は null・数と時刻だけ）で出す。
--   確定前に去った＝照合落ちの印（K-1018 の pwned_unchecked_at）があり・確定していない（consumed_at が空）・期限が切れた・
--   まだ確かめていない（印の時刻が確かめた時刻 pwned_acked_at より後。同じメールでまた落ちたら印が新しくなって出直す）。
--   照合落ちの数（外枠の pwned.unchecked・K-995 と、この葉の確かめたの remaining）は app.ops_pwned_unchecked() の 1 か所で数える：
--   確かめていない会社の数 ＋ 確定前の 1 行（在れば 1）。0 になったら運営の会社に確かめた印（落ち始めのメールがまた出る・0086）。
--   申し込みのメール・名前・会社名は答えにも記録にも入れない。索引は要らない（期限が切れた申し込みは少なく、毎日の掃除で消える）

-- まとめて確かめた時刻（空なら一度も確かめていない）
alter table kaname_auth.pending_signup add column if not exists pwned_acked_at timestamptz;

-- 確定前に去った照合落ちの申し込み：{ count, last_at }（0 件なら count 0・last_at null）。内部用（kaname_app に出さない）
create or replace function app.pwned_pending() returns jsonb
language sql stable security definer set search_path = public, app, pg_temp as $$
  select jsonb_build_object('count', count(*), 'last_at', max(p.pwned_unchecked_at))
    from kaname_auth.pending_signup p
   where p.pwned_unchecked_at is not null
     and p.consumed_at is null
     and p.expires_at <= now()
     and p.pwned_unchecked_at > coalesce(p.pwned_acked_at, '-infinity'::timestamptz)
$$;
revoke all on function app.pwned_pending() from public;

-- 照合落ちの数（数えるのはここだけ）：確かめていない会社の数（K-963・K-995 と同じ見方）＋ 確定前の 1 行（在れば 1）。内部用
create or replace function app.ops_pwned_unchecked() returns integer
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_ws integer;
begin
  perform app.ops_require('any');
  select count(*)::integer into v_ws
    from tenants t
   where t.deleted_at is null and t.half_made_at is null and t.id <> app.ops_tenant_id()
     and exists (
       select 1 from security_events e
        where e.tenant_id = t.id and e.kind_id = 'pwned_check_unavailable'
          and e.occurred_at > coalesce(
            (select max(a.occurred_at) from security_events a where a.tenant_id = t.id and a.kind_id = 'pwned_check_acknowledged'),
            '-infinity'::timestamptz));
  return v_ws + case when (app.pwned_pending()->>'count')::integer > 0 then 1 else 0 end;
end $$;
revoke all on function app.ops_pwned_unchecked() from public;

-- 外枠の 6 欄（K-963）：本体は K-963 のまま。pwned.unchecked だけを app.ops_pwned_unchecked() に替える
create or replace function app.ops_shell() returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_ops uuid;
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_month timestamptz := date_trunc('month', now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo';
  v_prev timestamptz := (date_trunc('month', now() at time zone 'Asia/Tokyo') - interval '1 month') at time zone 'Asia/Tokyo';
  v_caps text[];
  v_inbox jsonb;
  v_invoices jsonb;
  v_ws jsonb;
  v_runs integer;
  v_runs_prev integer;
  v_pwned integer;
  v_counted uuid[];
begin
  v_ops := app.ops_require('any');
  select o.caps into v_caps from ops_members o where o.id = v_ops;

  select coalesce(array_agg(x.id), '{}'::uuid[]) into v_counted
    from tenants x
   where x.deleted_at is null and x.half_made_at is null and x.id <> app.ops_tenant_id();

  select jsonb_build_object(
           'unassigned', count(*) filter (where q.assignee_ops_member_id is null and q.state <> 'done'),
           'mine', count(*) filter (where q.assignee_ops_member_id = app.user_id() and q.state <> 'done'),
           'waiting', count(*) filter (where q.state = 'waiting'),
           'later', count(*) filter (where q.state = 'later'))
    into v_inbox
    from inquiries q
   where q.deleted_at is null and q.tenant_id = any(v_counted);

  if 'money' = any(coalesce(v_caps, '{}'::text[])) then
    select jsonb_build_object('overdue_count', count(*), 'overdue_amount', coalesce(sum(i.amount), 0)::bigint)
      into v_invoices
      from invoices i
     where i.issued_at is not null and i.deleted_at is null and i.status_id <> 'paid' and i.due_on < v_today
       and i.tenant_id = any(v_counted);
  end if;

  with f as (
    select app.workspace_facts(c.id) as j,
           (select p.key from plans p where p.id = app.tenant_plan_id(c.id)) as plan_key
      from unnest(v_counted) as c(id)
  )
  select jsonb_build_object(
           'total', count(*),
           'active', count(*) filter (where j->>'state' = 'active'),
           'stopped', count(*) filter (where j->>'state' = 'stopped'),
           'closing', count(*) filter (where j->>'state' = 'closing'),
           'attention', count(*) filter (where jsonb_array_length(j->'attention') > 0),
           'by_plan', jsonb_build_object(
             'free', count(*) filter (where plan_key = 'free'),
             'team', count(*) filter (where plan_key = 'team'),
             'business', count(*) filter (where plan_key = 'business')))
    into v_ws
    from f;

  select count(*) filter (where r.created_at >= v_month)::integer,
         count(*) filter (where r.created_at >= v_prev and r.created_at < v_month)::integer
    into v_runs, v_runs_prev
    from action_runs r
   where r.phase is not null and r.status_id is not null and r.deleted_at is null
     and r.created_at >= v_prev and r.tenant_id = any(v_counted);

  -- 照合落ちの数（確かめていない会社の数＋確定前の 1 行・K-1110 の 1 か所の数え方）
  v_pwned := app.ops_pwned_unchecked();

  return jsonb_build_object(
    'operator', jsonb_build_object('member_id', app.user_id(), 'caps', to_jsonb(coalesce(v_caps, '{}'::text[]))),
    'inbox', v_inbox,
    'invoices', v_invoices,
    'workspaces', v_ws,
    'runs_month', jsonb_build_object(
      'count', v_runs,
      'prev_ratio', case when v_runs_prev = 0 then null else round(v_runs::numeric / v_runs_prev, 2) end),
    'pwned', jsonb_build_object('unchecked', v_pwned));
end $$;
revoke all on function app.ops_shell() from public;
grant execute on function app.ops_shell() to kaname_app;

-- 一覧（K-995）：会社の行の後に、確定前の 1 行（workspace・member は null・last_at・count）を在れば足し、last_at の新しい順に並べ直す
create or replace function app.ops_pwned_list() returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_data jsonb;
  v_pending jsonb;
begin
  perform app.ops_require('any');
  v_pending := app.pwned_pending();
  with ws as (
    select t.id, t.name from tenants t
     where t.deleted_at is null and t.half_made_at is null and t.id <> app.ops_tenant_id()
  ), ack as (
    select e.tenant_id, max(e.occurred_at) as at
      from security_events e join ws on ws.id = e.tenant_id
     where e.kind_id = 'pwned_check_acknowledged'
     group by e.tenant_id
  ), ev as (
    select e.tenant_id, count(*) as n, max(e.occurred_at) as last_at,
           (array_agg(e.member_id order by e.occurred_at desc, e.id desc))[1] as member_id
      from security_events e
      join ws on ws.id = e.tenant_id
      left join ack a on a.tenant_id = e.tenant_id
     where e.kind_id = 'pwned_check_unavailable' and (a.at is null or e.occurred_at > a.at)
     group by e.tenant_id
  ), rows as (
    select jsonb_build_object(
             'workspace', jsonb_build_object('id', ws.id, 'name', ws.name),
             'member', case when m.id is null then null else jsonb_build_object('id', m.id, 'name', m.display_name) end,
             'last_at', ev.last_at,
             'count', ev.n
           ) as j, ev.last_at as at, ws.id::text as k
      from ev
      join ws on ws.id = ev.tenant_id
      left join members m on m.id = ev.member_id
    union all
    select jsonb_build_object(
             'workspace', null,
             'member', null,
             'last_at', (v_pending->>'last_at')::timestamptz,
             'count', (v_pending->>'count')::integer
           ), (v_pending->>'last_at')::timestamptz, ''
     where (v_pending->>'count')::integer > 0
  )
  select coalesce(jsonb_agg(rows.j order by rows.at desc, rows.k), '[]'::jsonb)
    into v_data
    from rows;
  return jsonb_build_object('data', v_data);
end $$;
revoke all on function app.ops_pwned_list() from public;
grant execute on function app.ops_pwned_list() to kaname_app;

-- 会社の確かめた（K-995）：残りの数を app.ops_pwned_unchecked() で数える（確定前の 1 行が残る間は 0 にならない）。ほかは K-995 のまま
create or replace function app.ops_pwned_ack(p_tenant uuid) returns jsonb
language plpgsql volatile security definer set search_path = public, app, pg_temp as $$
declare
  v_ops uuid;
  v_ops_tenant uuid := app.ops_tenant_id();
  v_name text;
  v_last_ack timestamptz;
  v_open int;
  v_newest timestamptz;
  v_at timestamptz;
  v_id uuid;
  v_left int;
begin
  v_ops := app.ops_require('any');
  perform app.ops_target(p_tenant);
  perform pg_advisory_xact_lock(hashtext('security_event_opening:' || p_tenant::text || ':pwned_check_unavailable'));
  select t.name into v_name from tenants t where t.id = p_tenant;
  select max(e.occurred_at) into v_last_ack from security_events e
   where e.tenant_id = p_tenant and e.kind_id = 'pwned_check_acknowledged';
  select count(*), max(e.occurred_at) into v_open, v_newest from security_events e
   where e.tenant_id = p_tenant and e.kind_id = 'pwned_check_unavailable' and (v_last_ack is null or e.occurred_at > v_last_ack);
  if v_open = 0 then
    return jsonb_build_object('error', 'none');
  end if;
  v_at := greatest(now(), v_newest);
  insert into security_events (tenant_id, kind_id, member_id, detail, occurred_at)
  values (p_tenant, 'pwned_check_acknowledged', null, jsonb_build_object('ops_member_id', app.user_id()), v_at)
  returning id into v_id;
  perform app.record_ops_audit(p_tenant, 'pwned.acknowledge', 'security_events', v_id::text, null, jsonb_build_object('target_label', v_name));
  -- 残りを数える前に、運営の会社の鍵をいつも取る（順はいつも「会社 → 運営の会社」。確定前の確かめた（下）も同じ鍵を取る）
  perform pg_advisory_xact_lock(hashtext('security_event_opening:' || v_ops_tenant::text || ':pwned_check_unavailable'));
  v_left := app.ops_pwned_unchecked();
  if v_left = 0 then
    insert into security_events (tenant_id, kind_id, member_id, detail, occurred_at)
    values (v_ops_tenant, 'pwned_check_acknowledged', null, jsonb_build_object('ops_member_id', app.user_id(), 'last_tenant_id', p_tenant), now());
  end if;
  return jsonb_build_object('acknowledged_at', v_at, 'remaining', v_left);
end $$;
revoke all on function app.ops_pwned_ack(uuid) from public;
grant execute on function app.ops_pwned_ack(uuid) to kaname_app;

-- まとめて確かめた（確定前に去った申し込みの全部）：確かめた時刻を書き、運営の記録に残す（1 つの取引）。
--   運営の会社の鍵（K-995 と同じ）を取ってから当たる申し込みを for update で取るので、2 人が同時に押しても後の取引は 0 件を見る。
--   時刻は「今」と「当たる印のいちばん新しい時刻」の遅い方（その時刻までの印を確かめたことにする・K-995 と同じ）。
--   答え：{ acknowledged_at, remaining }／確かめる物が無いは { error: "none" }（口が 409 E-OPS-026）
create or replace function app.ops_pwned_pending_ack() returns jsonb
language plpgsql volatile security definer set search_path = public, app, pg_temp as $$
declare
  v_ops uuid;
  v_ops_tenant uuid := app.ops_tenant_id();
  v_emails text[];
  v_newest timestamptz;
  v_n integer;
  v_at timestamptz;
  v_left integer;
begin
  v_ops := app.ops_require('any');
  perform pg_advisory_xact_lock(hashtext('security_event_opening:' || v_ops_tenant::text || ':pwned_check_unavailable'));
  select coalesce(array_agg(p.email), '{}'::text[]), max(p.pwned_unchecked_at)
    into v_emails, v_newest
    from (select s.email, s.pwned_unchecked_at
            from kaname_auth.pending_signup s
           where s.pwned_unchecked_at is not null
             and s.consumed_at is null
             and s.expires_at <= now()
             and s.pwned_unchecked_at > coalesce(s.pwned_acked_at, '-infinity'::timestamptz)
             for update) p;
  v_n := coalesce(array_length(v_emails, 1), 0);
  if v_n = 0 then
    return jsonb_build_object('error', 'none');
  end if;
  v_at := greatest(now(), v_newest);
  update kaname_auth.pending_signup s set pwned_acked_at = v_at where s.email = any(v_emails);
  perform app.record_ops_audit(v_ops_tenant, 'pwned.acknowledge_pending', 'pending_signup', null, null,
    jsonb_build_object('target_label', '登録が確定していない申し込み', 'count', v_n));
  v_left := app.ops_pwned_unchecked();
  if v_left = 0 then
    insert into security_events (tenant_id, kind_id, member_id, detail, occurred_at)
    values (v_ops_tenant, 'pwned_check_acknowledged', null, jsonb_build_object('ops_member_id', app.user_id(), 'pending', true), now());
  end if;
  return jsonb_build_object('acknowledged_at', v_at, 'remaining', v_left);
end $$;
revoke all on function app.ops_pwned_pending_ack() from public;
grant execute on function app.ops_pwned_pending_ack() to kaname_app;
