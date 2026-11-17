-- 0112 端末をなくした：ワークスペースの管理者に戻してもらうよう頼む（K-305・D-128.141・D-128.59・D-128.92・D-125.150・関門 C2）
--   番号は取り込む時点の次の空き（0111 の次）。新しい表・列は作らない。足す関数は 2 つ（口 requestAdminRecovery だけが呼ぶ）。
--   ログインの前（待ちの印しか無い）なので会社の文脈が無い。本人の認証の id から、今いる会社の人を app.current_members_of_auth_user（0111）で引く。
--
-- app.request_admin_recovery(本人の認証の id, 地域だけの ip_region) → jsonb { result, recipients: [{ member_id, tenant_id, email, requester_name }] }
--   ① 本人ごとの鍵（pg_advisory_xact_lock）を取る（同時に 2 つ来ても、後の 1 つは前の確定を待ってから見る）
--   ② 1 時間の内（DB の now()）に本人の admin_recovery_requested があれば、その回（同じ時刻に書いた行の組）を見る：
--        その回の受け箱の行に送れなかった印（failed_at）が残っていれば「送り直し」：記録も受け箱も足さず、送れなかった管理者だけを宛先に返す
--        （行の failed_at を空にし retry_count を 1 足す＝この回が引き受けた印。同時の押し直しは宛先が空になり already）。無ければ already（何も書かない）
--   ③ 新しい回：本人の会社ごとに security_events（admin_recovery_requested・member_id は本人・ip_region）を 1 行
--   ④ 宛先＝その会社の管理者（同じ組の所属の行が role = 'admin' かつ status = 'active'、か members.role_id = 'owner'）のうち本人でない人。
--        member が消えた・止められた、同じ組の所属の行が抜けた・止められた・招待中・消した人は除く（K-303 の止めと同じ組の見方）
--   ⑤ 宛先ごとに受け箱 notifications（security.admin_recovery_requested・inapp・payload は requester_member_id だけ・
--        dedupe_key は 'admin_recovery:<頼みの記録の id>:<管理者の member_id>'＝本人と管理者と頼みの回で 1 つ）
--   ⑥ 宛先が 0 人なら no_admin（③の記録だけ）。いれば sent（メールは口が関門 C6 で送る）
--   返すのは result と宛先（管理者の member_id・会社・メール・その会社での頼んだ人の名前）だけ。待ちの印・IP・頼んだ人のメールは返さない
--
-- app.admin_recovery_send_failed(本人の認証の id, 送れなかった管理者の member_id の並び) → int（送れなかった数）
--   口がメールを送り終えたら必ず 1 回呼ぶ（並びが空＝全部届いた）。今の回の受け箱の行のうち、まだ届いた印の無い行に：
--   送れなかった管理者は failed_at、届いた管理者は sent_at を入れ failed_at を空にする。1 つでも送れなければ本人の会社ごとに
--   admin_recovery_send_failed を 1 行（detail は送れなかった数だけ）
--
-- どちらも security definer・search_path に pg_temp。public から外し kaname_app にだけ渡す。認証の表 kaname_auth."user" は同じ DB（0067 と同じ）

create or replace function app.request_admin_recovery(p_auth_user_id text, p_ip_region text) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_last timestamptz;
  v_recipients jsonb;
begin
  if p_auth_user_id is null then
    raise exception '本人の id が要る' using errcode = 'invalid_parameter_value';
  end if;
  perform pg_advisory_xact_lock(hashtext('admin_recovery:' || p_auth_user_id));

  -- ② 1 時間の内の前の回（その回の記録は同じ取引の now() で書くので時刻がそろう）
  select max(e.occurred_at) into v_last
    from security_events e
   where e.kind_id = 'admin_recovery_requested'
     and e.occurred_at > now() - interval '1 hour'
     and e.member_id in (select c.member_id from app.current_members_of_auth_user(p_auth_user_id) c);

  if v_last is not null then
    -- 送り直し：前の回で送れなかった管理者の行を引き受ける（failed_at を空にして数を足す）
    with mine as (
      select e.id, e.member_id
        from security_events e
       where e.kind_id = 'admin_recovery_requested' and e.occurred_at = v_last
         and e.member_id in (select c.member_id from app.current_members_of_auth_user(p_auth_user_id) c)
    ), claimed as (
      update notifications n
         set failed_at = null, retry_count = coalesce(n.retry_count, 0) + 1
        from mine
       where n.event_kind_id = 'security.admin_recovery_requested'
         and n.dedupe_key = 'admin_recovery:' || mine.id || ':' || n.member_id
         and n.failed_at is not null and n.deleted_at is null
      returning n.member_id, n.tenant_id, mine.member_id as requester_id
    )
    select coalesce(jsonb_agg(jsonb_build_object(
             'member_id', cl.member_id, 'tenant_id', cl.tenant_id, 'email', u.email, 'requester_name', rq.display_name)
             order by cl.tenant_id, cl.member_id), '[]'::jsonb)
      into v_recipients
      from claimed cl
      join members am on am.id = cl.member_id
      left join tenant_memberships atm on atm.tenant_id = am.tenant_id and atm.member_id = am.id
      join kaname_auth."user" u on u.id = coalesce(atm.auth_user_id, am.auth_user_id)
      join members rq on rq.id = cl.requester_id;
    if jsonb_array_length(v_recipients) = 0 then
      return jsonb_build_object('result', 'already', 'recipients', '[]'::jsonb);
    end if;
    return jsonb_build_object('result', 'sent', 'recipients', v_recipients);
  end if;

  -- ③〜⑤ 新しい回
  with events as (
    insert into security_events (tenant_id, kind_id, member_id, ip_region, detail)
    select c.tenant_id, 'admin_recovery_requested', c.member_id, left(p_ip_region, 8), '{}'::jsonb
      from app.current_members_of_auth_user(p_auth_user_id) c
    returning id, tenant_id, member_id
  ), admins as (
    select ev.id as event_id, ev.tenant_id, ev.member_id as requester_id, am.id as member_id, u.email
      from events ev
      join members am on am.tenant_id = ev.tenant_id
      left join tenant_memberships atm on atm.tenant_id = am.tenant_id and atm.member_id = am.id
      join kaname_auth."user" u on u.id = coalesce(atm.auth_user_id, am.auth_user_id)
     where am.deleted_at is null and am.suspended_at is null
       and (atm.id is null or (atm.status = 'active' and atm.deleted_at is null))
       and ((atm.role = 'admin' and atm.status = 'active') or am.role_id = 'owner')
       and am.id <> ev.member_id
       and coalesce(atm.auth_user_id, am.auth_user_id) <> p_auth_user_id
  ), notices as (
    insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, dedupe_key)
    select a.tenant_id, a.member_id, 'inapp', 'security.admin_recovery_requested',
           jsonb_build_object('requester_member_id', a.requester_id), 'admin_recovery:' || a.event_id || ':' || a.member_id
      from admins a
    returning member_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'member_id', a.member_id, 'tenant_id', a.tenant_id, 'email', a.email, 'requester_name', rq.display_name)
           order by a.tenant_id, a.member_id), '[]'::jsonb)
    into v_recipients
    from admins a
    join members rq on rq.id = a.requester_id
   where a.member_id in (select member_id from notices);
  if jsonb_array_length(v_recipients) = 0 then
    return jsonb_build_object('result', 'no_admin', 'recipients', '[]'::jsonb);
  end if;
  return jsonb_build_object('result', 'sent', 'recipients', v_recipients);
end $$;
revoke all on function app.request_admin_recovery(text, text) from public;
grant execute on function app.request_admin_recovery(text, text) to kaname_app;

create or replace function app.admin_recovery_send_failed(p_auth_user_id text, p_failed uuid[]) returns int
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_last timestamptz;
  v_failed uuid[] := coalesce(p_failed, '{}');
begin
  if p_auth_user_id is null then
    raise exception '本人の id が要る' using errcode = 'invalid_parameter_value';
  end if;
  perform pg_advisory_xact_lock(hashtext('admin_recovery:' || p_auth_user_id));
  select max(e.occurred_at) into v_last
    from security_events e
   where e.kind_id = 'admin_recovery_requested'
     and e.member_id in (select c.member_id from app.current_members_of_auth_user(p_auth_user_id) c);
  if v_last is null then return 0; end if;
  update notifications n
     set failed_at = case when n.member_id = any (v_failed) then now() else null end,
         retry_count = case when n.member_id = any (v_failed) then coalesce(n.retry_count, 0) else n.retry_count end,
         sent_at = case when n.member_id = any (v_failed) then null else now() end
    from security_events e
   where e.kind_id = 'admin_recovery_requested' and e.occurred_at = v_last
     and e.member_id in (select c.member_id from app.current_members_of_auth_user(p_auth_user_id) c)
     and n.event_kind_id = 'security.admin_recovery_requested'
     and n.dedupe_key = 'admin_recovery:' || e.id || ':' || n.member_id
     and n.sent_at is null and n.deleted_at is null;
  if cardinality(v_failed) > 0 then
    insert into security_events (tenant_id, kind_id, member_id, detail)
    select c.tenant_id, 'admin_recovery_send_failed', c.member_id, jsonb_build_object('failed', cardinality(v_failed))
      from app.current_members_of_auth_user(p_auth_user_id) c;
  end if;
  return cardinality(v_failed);
end $$;
revoke all on function app.admin_recovery_send_failed(text, uuid[]) from public;
grant execute on function app.admin_recovery_send_failed(text, uuid[]) to kaname_app;

insert into app.schema_migrations (name) values ('0112_admin_recovery.sql') on conflict do nothing;
