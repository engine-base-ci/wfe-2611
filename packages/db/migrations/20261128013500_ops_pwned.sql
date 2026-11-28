-- 20261128013500 照合が使えなかった登録の回収（K-995・契約の口 listOpsPwned・ackOpsPwned・D-128.134・D-128.146・D-156.35）
--   新しい表・列は作らない。運営の関数を 2 つ足す（読む 1 つ・書く 1 つ・関門 C2）。型は K-947（app.ops_require・app.ops_target）。
--   1 行は会社ごと：security_events の pwned_check_unavailable が、その会社の最後の pwned_check_acknowledged より後にある会社（0086 と同じ見方）。
--   数える会社は K-963 と同じ（tenants の deleted_at is null・half_made_at is null・運営の会社でない）。
--   登録の前の失敗は運営の会社に残る（0086・メールの判定だけに使う）ので、一覧には出さない。
--   security_events は追記専用（0003）なので、「確かめた」も同じ表への追記（pwned_check_acknowledged）で持つ。
--   索引は security_events_tenant_time_idx（0003）を使う

-- 一覧：まだ確かめていない会社を 1 行ずつ（workspace { id, name }・member { id, name } か null・last_at・count）。並びは last_at の新しい順。
--   出来事の中身（detail の理由・メール）は答えに入れない。人の名前だけ
create or replace function app.ops_pwned_list() returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_data jsonb;
begin
  perform app.ops_require('any');
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
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'workspace', jsonb_build_object('id', ws.id, 'name', ws.name),
           'member', case when m.id is null then null else jsonb_build_object('id', m.id, 'name', m.display_name) end,
           'last_at', ev.last_at,
           'count', ev.n
         ) order by ev.last_at desc, ws.id), '[]'::jsonb)
    into v_data
    from ev
    join ws on ws.id = ev.tenant_id
    left join members m on m.id = ev.member_id;
  return jsonb_build_object('data', v_data);
end $$;
revoke all on function app.ops_pwned_list() from public;
grant execute on function app.ops_pwned_list() to kaname_app;

-- 確かめた：その会社に確かめた印を 1 行書き、運営の記録に残す。確かめていない会社が 0 になったら運営の会社にも印を書く
--   （0086 の app.record_security_event_opening は運営の会社の最後の印から数えるので、照合が次に落ちたときにまた 1 通メールが出る）。
--   同じ会社の出来事の順と 0086 の落ち始めの判定がぶつからないよう、0086 と同じ鍵の advisory lock を取ってから見る。
--   印の時刻は「今」と「確かめる出来事のいちばん新しい時刻」の遅い方（その時刻までの出来事を確かめたことにする）。
--   答え：{ acknowledged_at, remaining }／確かめる物が無い（もう確かめた・出来事が無い）は { error: "none" }（口が 409 E-OPS-026）
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
  -- 残りを数える前に、運営の会社の鍵をいつも取る（順はいつも「会社 → 運営の会社」・0086 は鍵を 1 つしか取らないので待ち合っても止まらない）。
  --   最後の 2 社を 2 人がほぼ同時に確かめても、後の取引は前の取引の確定を待ってから数え直すので、最後の方が 0 を見て運営の会社に印を書く
  perform pg_advisory_xact_lock(hashtext('security_event_opening:' || v_ops_tenant::text || ':pwned_check_unavailable'));
  -- 残りの会社の数（K-963 の getOpsShell の pwned.unchecked と同じ数え方）
  select count(*) into v_left
    from tenants t
   where t.deleted_at is null and t.half_made_at is null and t.id <> v_ops_tenant
     and exists (
       select 1 from security_events e
        where e.tenant_id = t.id and e.kind_id = 'pwned_check_unavailable'
          and e.occurred_at > coalesce(
            (select max(a.occurred_at) from security_events a where a.tenant_id = t.id and a.kind_id = 'pwned_check_acknowledged'),
            '-infinity'::timestamptz));
  if v_left = 0 then
    insert into security_events (tenant_id, kind_id, member_id, detail, occurred_at)
    values (v_ops_tenant, 'pwned_check_acknowledged', null, jsonb_build_object('ops_member_id', app.user_id(), 'last_tenant_id', p_tenant), now());
  end if;
  return jsonb_build_object('acknowledged_at', v_at, 'remaining', v_left);
end $$;
revoke all on function app.ops_pwned_ack(uuid) from public;
grant execute on function app.ops_pwned_ack(uuid) to kaname_app;
