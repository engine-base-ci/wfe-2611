-- 20261126003700 知らせの設定（K-837・契約の口 getNotificationSettings・updateNotificationSettings・copyNotificationSettings・D-125.150・D-154.24・D-154.27・D-154.55・関門 C2）
--
-- 知らせの受け方はワークスペースごと：会社ごと・人ごとの notification_settings（0075）1 行と、出来事の行 notification_preferences（0015・event_kind_id が出来事の鍵・
-- channel_id が bell／mail・enabled）。保存だけ（受け箱の行・メール・会社の記録は作らない・D-154.24・D-154.55）。行が無い項目は口が既定をかぶせる。
--
-- ⓪ notification_preferences に (tenant_id, member_id, event_kind_id, channel_id) の一意の索引（消していない行）。作る前に、重なる行は updated_at の新しい 1 行を残して消す
-- ① app.me_notify_member(p_tenant uuid) returns uuid：今のログインの人と同じログイン（app.account_members）で、その会社に active か suspended で入っている人の id。
--      入っていなければ null。中で使うだけ。今のログインの人が止められている・抜けている・消えているときは ②③④ が { error: 'forbidden' }
-- ② app.me_notify_read(p_tenant uuid) returns jsonb：p_tenant（null なら今の会社）に入っていなければ null。入っていれば
--      { workspace_id, email_digest, quiet_hours, paused_until, urgent_override, rows: [{ key, channel, enabled }] }（設定の行が無ければ既定）
-- ③ app.me_notify_update(p_tenant uuid, p_patch jsonb) returns jsonb：入っていなければ null。送った項目だけを書く（設定は (tenant_id, member_id)・出来事は
--      (tenant_id, member_id, event_kind_id, channel_id) で upsert）。p_patch の鍵：email_digest・quiet_hours・paused_until（鍵が在れば null も書く）・urgent_override・
--      events [{ key, bell?, mail? }]。書いた後の ② を返す
-- ④ app.me_notify_copy(p_from uuid, p_to uuid[]) returns jsonb：写し先に写し元を含めれば { error: 'same' }・写し元か写し先のどれかに入っていなければ { error: 'not_found' }。
--      1 つの取引で、写し先の email_digest・quiet_hours・urgent_override を写し元に合わせ（paused_until は触らない）、出来事の行は写し先の今の行を消して写し元の行を写す。
--      { ok: true, copied_to: [...] }
--
-- どれも security definer・search_path に pg_temp・public から外す。口が呼ぶ ②③④ だけ kaname_app に渡す

update notification_preferences p set deleted_at = now()
 where p.deleted_at is null and p.member_id is not null
   and exists (select 1 from notification_preferences q
                where q.deleted_at is null and q.tenant_id = p.tenant_id and q.member_id = p.member_id
                  and q.event_kind_id is not distinct from p.event_kind_id and q.channel_id is not distinct from p.channel_id
                  and (q.updated_at, q.id) > (p.updated_at, p.id));
create unique index if not exists notification_preferences_member_event_ch_uq
  on notification_preferences (tenant_id, member_id, event_kind_id, channel_id)
  where deleted_at is null and member_id is not null;

create or replace function app.me_notify_member(p_tenant uuid) returns uuid
language sql stable security definer set search_path = public, app, pg_temp as $$
  select m.id
    from app.account_members(app.user_id()) a(member_id)
    join members m on m.id = a.member_id and m.deleted_at is null and m.tenant_id = p_tenant
    left join tenant_memberships tm on tm.tenant_id = m.tenant_id and tm.member_id = m.id
   where app.user_id() is not null
     and (tm.id is null or (tm.status in ('active', 'suspended') and tm.deleted_at is null))
   limit 1
$$;
revoke all on function app.me_notify_member(uuid) from public;

-- 今のログインの人が呼べるか（消えていない・止めていない・所属が active）。呼べなければ口は 403
create or replace function app.me_notify_usable() returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select exists (select 1 from members me
                   left join tenant_memberships mt on mt.tenant_id = me.tenant_id and mt.member_id = me.id
                  where me.id = app.user_id() and me.tenant_id = app.tenant_id()
                    and me.deleted_at is null and me.suspended_at is null
                    and (mt.id is null or (mt.status = 'active' and mt.deleted_at is null)))
$$;
revoke all on function app.me_notify_usable() from public;

create or replace function app.me_notify_read(p_tenant uuid) returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := coalesce(p_tenant, app.tenant_id());
  v_member uuid;
  v_out jsonb;
begin
  if app.tenant_id() is null or app.user_id() is null then
    raise exception 'ワークスペースの文脈が無い' using errcode = 'insufficient_privilege';
  end if;
  if not app.me_notify_usable() then
    return jsonb_build_object('error', 'forbidden');
  end if;
  v_member := app.me_notify_member(v_tenant);
  if v_member is null then
    return null;
  end if;
  select jsonb_build_object(
           'workspace_id', v_tenant,
           'email_digest', s.email_digest,
           'quiet_hours', s.quiet_hours,
           'paused_until', case when s.paused_until is not null
                                then to_char(s.paused_until at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') end,
           'urgent_override', s.urgent_override)
    into v_out
    from notification_settings s
   where s.tenant_id = v_tenant and s.member_id = v_member and s.deleted_at is null;
  return coalesce(v_out, jsonb_build_object('workspace_id', v_tenant))
         || jsonb_build_object('rows', coalesce((
              select jsonb_agg(jsonb_build_object('key', p.event_kind_id, 'channel', p.channel_id, 'enabled', p.enabled)
                               order by p.event_kind_id, p.channel_id)
                from notification_preferences p
               where p.tenant_id = v_tenant and p.member_id = v_member and p.deleted_at is null), '[]'::jsonb));
end $$;
revoke all on function app.me_notify_read(uuid) from public;
grant execute on function app.me_notify_read(uuid) to kaname_app;

create or replace function app.me_notify_update(p_tenant uuid, p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_tenant uuid := coalesce(p_tenant, app.tenant_id());
  v_member uuid;
  v_ev jsonb;
  v_ch text;
begin
  if app.tenant_id() is null or app.user_id() is null then
    raise exception 'ワークスペースの文脈が無い' using errcode = 'insufficient_privilege';
  end if;
  if not app.me_notify_usable() then
    return jsonb_build_object('error', 'forbidden');
  end if;
  v_member := app.me_notify_member(v_tenant);
  if v_member is null then
    return null;
  end if;
  if p_patch ?| array['email_digest', 'quiet_hours', 'paused_until', 'urgent_override'] then
    insert into notification_settings as s (tenant_id, member_id, email_digest, quiet_hours, paused_until, urgent_override, created_by, updated_by)
    values (v_tenant, v_member,
            coalesce((p_patch ->> 'email_digest')::boolean, true),
            coalesce(p_patch -> 'quiet_hours', '{"preset": "weekdays_night_weekend"}'::jsonb),
            (p_patch ->> 'paused_until')::timestamptz,
            coalesce(p_patch -> 'urgent_override', '["approval_due_today", "clone_stopped"]'::jsonb),
            v_member, v_member)
    on conflict (tenant_id, member_id) do update set
      email_digest = case when p_patch ? 'email_digest' then excluded.email_digest else s.email_digest end,
      quiet_hours = case when p_patch ? 'quiet_hours' then excluded.quiet_hours else s.quiet_hours end,
      paused_until = case when p_patch ? 'paused_until' then excluded.paused_until else s.paused_until end,
      urgent_override = case when p_patch ? 'urgent_override' then excluded.urgent_override else s.urgent_override end,
      deleted_at = null,
      updated_at = now(),
      updated_by = v_member;
  end if;
  for v_ev in select e from jsonb_array_elements(coalesce(p_patch -> 'events', '[]'::jsonb)) e loop
    foreach v_ch in array array['bell', 'mail'] loop
      if v_ev ? v_ch then
        insert into notification_preferences as p (tenant_id, member_id, event_kind_id, channel_id, enabled, created_by, updated_by)
        values (v_tenant, v_member, v_ev ->> 'key', v_ch, (v_ev ->> v_ch)::boolean, v_member, v_member)
        on conflict (tenant_id, member_id, event_kind_id, channel_id) where deleted_at is null and member_id is not null
        do update set enabled = excluded.enabled, updated_at = now(), updated_by = v_member;
      end if;
    end loop;
  end loop;
  return app.me_notify_read(v_tenant);
end $$;
revoke all on function app.me_notify_update(uuid, jsonb) from public;
grant execute on function app.me_notify_update(uuid, jsonb) to kaname_app;

create or replace function app.me_notify_copy(p_from uuid, p_to uuid[]) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_from uuid;
  v_to uuid;
  v_target uuid;
  v_src notification_settings%rowtype;
begin
  if app.tenant_id() is null or app.user_id() is null then
    raise exception 'ワークスペースの文脈が無い' using errcode = 'insufficient_privilege';
  end if;
  if not app.me_notify_usable() then
    return jsonb_build_object('error', 'forbidden');
  end if;
  if p_from = any(p_to) then
    return jsonb_build_object('error', 'same');
  end if;
  v_from := app.me_notify_member(p_from);
  if v_from is null or exists (select 1 from unnest(p_to) t(id) where app.me_notify_member(t.id) is null) then
    return jsonb_build_object('error', 'not_found');
  end if;
  select * into v_src from notification_settings s
   where s.tenant_id = p_from and s.member_id = v_from and s.deleted_at is null;
  foreach v_to in array p_to loop
    v_target := app.me_notify_member(v_to);
    insert into notification_settings as s (tenant_id, member_id, email_digest, quiet_hours, urgent_override, created_by, updated_by)
    values (v_to, v_target,
            coalesce(v_src.email_digest, true),
            coalesce(v_src.quiet_hours, '{"preset": "weekdays_night_weekend"}'::jsonb),
            coalesce(v_src.urgent_override, '["approval_due_today", "clone_stopped"]'::jsonb),
            v_target, v_target)
    on conflict (tenant_id, member_id) do update set
      email_digest = excluded.email_digest,
      quiet_hours = excluded.quiet_hours,
      urgent_override = excluded.urgent_override,
      deleted_at = null,
      updated_at = now(),
      updated_by = v_target;
    update notification_preferences p set deleted_at = now(), updated_by = v_target
     where p.tenant_id = v_to and p.member_id = v_target and p.deleted_at is null;
    insert into notification_preferences (tenant_id, member_id, event_kind_id, channel_id, enabled, created_by, updated_by)
    select v_to, v_target, p.event_kind_id, p.channel_id, p.enabled, v_target, v_target
      from notification_preferences p
     where p.tenant_id = p_from and p.member_id = v_from and p.deleted_at is null;
  end loop;
  return jsonb_build_object('ok', true, 'copied_to', to_jsonb(p_to));
end $$;
revoke all on function app.me_notify_copy(uuid, uuid[]) from public;
grant execute on function app.me_notify_copy(uuid, uuid[]) to kaname_app;
