-- 0112 端末をなくした：ワークスペースの管理者に戻してもらうよう頼む（K-305・D-128.141・D-128.59・D-128.92・D-125.150・関門 C2）
--   番号は取り込む時点の次の空き（0111 の次）。新しい表・列は作らない。足す関数は 2 つ（口 requestAdminRecovery だけが呼ぶ）。
--   ログインの前（待ちの印しか無い）なので会社の文脈が無い。本人の認証の id から、今いる会社の人を app.current_members_of_auth_user（0111）で引く。
--
-- app.request_admin_recovery(本人の認証の id, 地域だけの ip_region) → jsonb { result, recipients: [{ member_id, tenant_id, email, requester_name }] }
--   ① 本人ごとの鍵（pg_advisory_xact_lock）を取る（同時に 2 つ来ても、後の 1 つは前の確定を待ってから見る）
--   ② 1 時間の内（DB の now()）に本人の admin_recovery_requested があれば、その回（同じ時刻に書いた行の組）を見る：
--        その回の受け箱の行のうち、送れなかった行（failed_at）と送り中のまま止まった行（どちらの印も無く、最後に触ってから 2 分を過ぎた）を、
--        いまの管理者の分だけ引き受けて「送り直し」：記録も受け箱も足さず、その管理者だけを宛先に返す（failed_at を空にし retry_count を 1 足す。
--        updated_at が今になる＝送り中の始まり。同時の押し直しは宛先が空になる）。引き受ける行が無ければ、届いた行か送り中の行があれば already、
--        どれも無ければ（前の回が no_admin＝detail.admins が 0・送れなかった管理者がみな抜けた／止められた）no_admin（何も書かない）
--   ③ 新しい回：本人の会社ごとに security_events（admin_recovery_requested・member_id は本人・ip_region・detail はその会社で選んだ宛先の数 admins だけ）を 1 行
--   ④ 宛先＝その会社の管理者（同じ組の所属の行が role = 'admin' かつ status = 'active'、か members.role_id = 'owner'）のうち本人でない人。
--        member が消えた・止められた、同じ組の所属の行が抜けた・止められた・招待中・消した人は除く（K-303 の止めと同じ組の見方）
--   ⑤ 宛先ごとに受け箱 notifications（security.admin_recovery_requested・inapp・payload は requester_member_id だけ・
--        dedupe_key は 'admin_recovery:<頼みの記録の id>:<管理者の member_id>'＝本人と管理者と頼みの回で 1 つ）
--   ⑥ 宛先が 0 人なら no_admin（③の記録だけ）。いれば sent（メールは口が関門 C6 で送る）
--   返すのは result と宛先（管理者の member_id・会社・メール・その会社での頼んだ人の名前）だけ。待ちの印・IP・頼んだ人のメールは返さない
--
-- app.admin_recovery_send_failed(本人の認証の id, 送れなかった管理者の member_id の並び) → int（送れなかった数）
--   口がメールを送り終えたら必ず 1 回呼ぶ（並びが空＝全部届いた）。今の回の受け箱の行のうち、どちらの印も無い行（いま送った行）に：
--   送れなかった管理者は failed_at、届いた管理者は sent_at を入れ failed_at を空にする。1 つでも送れなければ本人の会社ごとに
--   admin_recovery_send_failed を 1 行（detail は送れなかった数だけ）
--
-- 宛先を選ぶ中だけの関数 app.admin_recovery_admins は誰にも execute を渡さない。
-- どちらも security definer・search_path に pg_temp。public から外し kaname_app にだけ渡す。認証の表 kaname_auth."user" は同じ DB（0067 と同じ）

-- 中だけで使う：その会社の「いまの管理者」のうち本人でない人（新しい回と送り直しの両方がここで選ぶ・宛先を選ぶのはこの 1 か所）。
--   所属の行が role = 'admin' かつ active、か members.role_id = 'owner'。member が消えた・止められた、同じ組の所属の行が抜けた・止められた・
--   招待中・消した人は除く。本人は member の id と認証の id の両方で除く（owner の道でも）。誰にも execute を渡さない
create or replace function app.admin_recovery_admins(p_tenant uuid, p_requester uuid, p_auth_user_id text)
returns table (member_id uuid, email text)
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
begin
  return query
    select am.id, u.email::text
      from members am
      left join tenant_memberships atm on atm.tenant_id = am.tenant_id and atm.member_id = am.id
      join kaname_auth."user" u on u.id = coalesce(atm.auth_user_id, am.auth_user_id)
     where am.tenant_id = p_tenant
       and am.deleted_at is null and am.suspended_at is null
       and (atm.id is null or (atm.status = 'active' and atm.deleted_at is null))
       and ((atm.role = 'admin' and atm.status = 'active') or am.role_id = 'owner')
       and am.id <> p_requester
       and coalesce(atm.auth_user_id, am.auth_user_id) <> p_auth_user_id;
end $$;
revoke all on function app.admin_recovery_admins(uuid, uuid, text) from public;

create or replace function app.request_admin_recovery(p_auth_user_id text, p_ip_region text) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_last timestamptz;
  v_recipients jsonb;
  v_rows int;
  v_busy boolean;
  c_sending constant interval := interval '2 minutes';   -- 最後に触ってからこの間は送り中（それを過ぎて届いた印も送れなかった印も無い行は止まった）
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
    -- 送り直し：前の回の受け箱の行のうち、送れなかった行と送り中のまま止まった行を、いまの管理者の分だけ引き受ける
    --   （failed_at を空にして数を足す。updated_at は trigger が今にする＝送り中の始まり）
    with mine as (
      select e.id, e.tenant_id, e.member_id
        from security_events e
       where e.kind_id = 'admin_recovery_requested' and e.occurred_at = v_last
         and e.member_id in (select c.member_id from app.current_members_of_auth_user(p_auth_user_id) c)
    ), claimed as (
      update notifications n
         set failed_at = null, retry_count = coalesce(n.retry_count, 0) + 1
        from mine
       where n.event_kind_id = 'security.admin_recovery_requested'
         and n.dedupe_key = 'admin_recovery:' || mine.id || ':' || n.member_id
         and n.deleted_at is null
         and (n.failed_at is not null or (n.sent_at is null and n.updated_at < now() - c_sending))
         and n.member_id in (select a.member_id from app.admin_recovery_admins(mine.tenant_id, mine.member_id, p_auth_user_id) a)
      returning n.member_id, n.tenant_id, mine.member_id as requester_id
    )
    select coalesce(jsonb_agg(jsonb_build_object(
             'member_id', cl.member_id, 'tenant_id', cl.tenant_id, 'email', a.email, 'requester_name', rq.display_name)
             order by cl.tenant_id, cl.member_id), '[]'::jsonb)
      into v_recipients
      from claimed cl
      join members rq on rq.id = cl.requester_id
      join lateral app.admin_recovery_admins(cl.tenant_id, cl.requester_id, p_auth_user_id) a on a.member_id = cl.member_id;
    if jsonb_array_length(v_recipients) > 0 then
      return jsonb_build_object('result', 'sent', 'recipients', v_recipients);
    end if;
    -- 引き受ける行が無い：その回で誰かに届いたか、送り中の行があれば already。
    --   受け箱の行が 1 つも無い回は、記録の detail.admins（その回で選んだ宛先の数）がどの会社も 0 なら no_admin の回なので no_admin のまま。
    --   受け箱の行があって、どれも送れず宛先から外れた（送れなかった管理者がみな抜けた／止められた）なら、誰にも届いていないので no_admin。
    --   no_admin のときは何も書かない（運営が戻す）
    select count(*), coalesce(bool_or(n.sent_at is not null or n.failed_at is null), false) into v_rows, v_busy
      from notifications n
      join security_events e on n.dedupe_key = 'admin_recovery:' || e.id || ':' || n.member_id
     where e.kind_id = 'admin_recovery_requested' and e.occurred_at = v_last
       and e.member_id in (select c.member_id from app.current_members_of_auth_user(p_auth_user_id) c)
       and n.event_kind_id = 'security.admin_recovery_requested' and n.deleted_at is null;
    if v_rows = 0 then
      select coalesce(bool_and(e.detail ? 'admins' and (e.detail ->> 'admins')::int = 0), false) into v_busy
        from security_events e
       where e.kind_id = 'admin_recovery_requested' and e.occurred_at = v_last
         and e.member_id in (select c.member_id from app.current_members_of_auth_user(p_auth_user_id) c);
      if v_busy then
        return jsonb_build_object('result', 'no_admin', 'recipients', '[]'::jsonb);
      end if;
      return jsonb_build_object('result', 'already', 'recipients', '[]'::jsonb);
    end if;
    if v_busy then
      return jsonb_build_object('result', 'already', 'recipients', '[]'::jsonb);
    end if;
    return jsonb_build_object('result', 'no_admin', 'recipients', '[]'::jsonb);
  end if;

  -- ③〜⑤ 新しい回（宛先を先に選び、記録の detail.admins にその会社の宛先の数を残す）
  with me as (
    select c.tenant_id, c.member_id from app.current_members_of_auth_user(p_auth_user_id) c
  ), admins as (
    select me.tenant_id, me.member_id as requester_id, a.member_id, a.email
      from me
      cross join lateral app.admin_recovery_admins(me.tenant_id, me.member_id, p_auth_user_id) a
  ), events as (
    insert into security_events (tenant_id, kind_id, member_id, ip_region, detail)
    select me.tenant_id, 'admin_recovery_requested', me.member_id, left(p_ip_region, 8),
           jsonb_build_object('admins', (select count(*) from admins x where x.tenant_id = me.tenant_id and x.requester_id = me.member_id))
      from me
    returning id, tenant_id, member_id
  ), notices as (
    insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, dedupe_key)
    select a.tenant_id, a.member_id, 'inapp', 'security.admin_recovery_requested',
           jsonb_build_object('requester_member_id', a.requester_id), 'admin_recovery:' || ev.id || ':' || a.member_id
      from events ev
      join admins a on a.tenant_id = ev.tenant_id and a.requester_id = ev.member_id
    returning tenant_id, member_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'member_id', a.member_id, 'tenant_id', a.tenant_id, 'email', a.email, 'requester_name', rq.display_name)
           order by a.tenant_id, a.member_id), '[]'::jsonb)
    into v_recipients
    from admins a
    join members rq on rq.id = a.requester_id
   where (a.tenant_id, a.member_id) in (select tenant_id, member_id from notices);
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
     and n.sent_at is null and n.failed_at is null and n.deleted_at is null;
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
