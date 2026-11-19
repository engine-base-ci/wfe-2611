-- 0117 招待の送り直しを頼む（K-334・契約の口 requestInvitationResend・D-128.63・answer=7fe1f09fdab4 ⑤・関門 C2）
--   期限（7 日）が過ぎた招待を開いた人が「送り直しを頼む」を押すと、招いた人（もう居なければそのワークスペースの管理者全員）に知らせる。
--   同じ招待で 1 日 1 回。送り直すのは招いた人が新しい招待を出すことで、この口は招待そのものを変えない（頼んだ時刻だけを書く）。
--
-- ① invitations.resend_requested_at：最後に頼まれて、知らせが全員に届いた時刻（1 日 1 回の判定に使う）。空を許す
-- ② app.invitation_resend_targets(p_token_hash)：宛て（招いた人か管理者）を引くだけ（何も書かない）。口が最初に呼ぶ
--      招いた人（invitations.created_by）が生きていて（消していない・止められていない・所属の行があれば active で消していない）メールが引ければその人だけ。
--      そうでなければ管理者全員：所属の行が role admin・status active・消していない人と、会社を作った人（members.role_id = 'owner'・
--      所属の行を持たない・0111）で消していない・止められていない人。
--      宛てのメールは coalesce(members.auth_user_id, tenant_memberships.auth_user_id) の kaname_auth."user".email（2 つ目のワークスペースの人は
--      members.auth_user_id が空・K-333）。招待の状態は見ない（状態は口が下見の関数 app.invitation_preview2 で先に見る）
-- ③ app.invitation_resend_record(p_token_hash)：知らせの行（notifications・inapp・invitation_resend_requested）を宛てごとに入れて返す。
--      招待の行を for update で取り（同時に 2 回押しても後の 1 つは前の確定を待つ）、期限切れでない・24 時間の内に頼まれた・
--      送り中（どちらの印も無く、最後に触ってから 2 分の内）の知らせがある、のどれかなら何も入れず空を返す（口は already）。
--      前の回に送れなかった宛てがあれば、新しい行を入れずに、その行だけを引き受けて返す（届いた人に 2 通目を出さない・0112 と同じ形）。
--      payload は招待の id・宛ての招待のメール・招いた日・期限・ワークスペースの名前だけ（トークン・リンクは入れない・TP-MAIL-03）
-- ④ app.invitation_resend_mark(p_token_hash, p_sent, p_failed)：口がメールを送り終えたら、その回の知らせの行に届いた（sent_at）・
--      届かなかった（failed_at）を入れる（送り中の印を外す）
-- ⑤ app.invitation_resend_stamp(p_token_hash)：全員に届いたときだけ、頼んだ時刻を書く（2 分の内に届いた知らせがある招待だけ）。送れなかった回は書かない（1 日 1 回に数えない）
--
-- mark・stamp もトークンで引く（招待の id だけで書かせない）。どれも security definer・search_path に pg_temp。public から外し kaname_app にだけ渡す。認証の表 kaname_auth."user" は同じ DB（0112 と同じ）
alter table invitations add column if not exists resend_requested_at timestamptz;

create or replace function app.invitation_resend_targets(p_token_hash text)
returns table (invitation_id uuid, tenant_id uuid, member_id uuid, email text, invitee_email text,
               invited_at timestamptz, expires_at timestamptz, last_requested_at timestamptz)
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_inv invitations%rowtype;
  v_found boolean := false;
begin
  select * into v_inv from invitations i where i.token_hash = p_token_hash;
  if not found then return; end if;
  -- 招いた人が生きていてメールが引ければ、その人だけ
  for member_id, email in
    select m.id, u.email::text
      from members m
      left join tenant_memberships tm on tm.tenant_id = m.tenant_id and tm.member_id = m.id
      join kaname_auth."user" u on u.id = coalesce(m.auth_user_id, tm.auth_user_id)
     where m.id = v_inv.created_by and m.tenant_id = v_inv.tenant_id
       and m.deleted_at is null and m.suspended_at is null
       and (tm.id is null or (tm.status = 'active' and tm.deleted_at is null))
     limit 1
  loop
    v_found := true;
    invitation_id := v_inv.id; tenant_id := v_inv.tenant_id; invitee_email := v_inv.email;
    invited_at := v_inv.created_at; expires_at := v_inv.expires_at; last_requested_at := v_inv.resend_requested_at;
    return next;
  end loop;
  if v_found then return; end if;
  -- 居なければ管理者全員（所属の行が admin で active・会社を作った人）
  for member_id, email in
    select m.id, u.email::text
      from members m
      left join tenant_memberships tm on tm.tenant_id = m.tenant_id and tm.member_id = m.id
      join kaname_auth."user" u on u.id = coalesce(m.auth_user_id, tm.auth_user_id)
     where m.tenant_id = v_inv.tenant_id
       and m.deleted_at is null and m.suspended_at is null
       and (tm.id is null or (tm.status = 'active' and tm.deleted_at is null))
       and ((tm.role = 'admin' and tm.status = 'active') or m.role_id = 'owner')
     order by m.id
  loop
    invitation_id := v_inv.id; tenant_id := v_inv.tenant_id; invitee_email := v_inv.email;
    invited_at := v_inv.created_at; expires_at := v_inv.expires_at; last_requested_at := v_inv.resend_requested_at;
    return next;
  end loop;
end $$;
revoke all on function app.invitation_resend_targets(text) from public;
grant execute on function app.invitation_resend_targets(text) to kaname_app;

create or replace function app.invitation_resend_record(p_token_hash text)
returns table (notification_id uuid, member_id uuid, email text, invitation_id uuid, invitee_email text,
               invited_at timestamptz, expires_at timestamptz, workspace_name text)
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_inv invitations%rowtype;
  v_name text;
  c_day constant interval := interval '24 hours';
  c_sending constant interval := interval '2 minutes';   -- どちらの印も無い行は、この間だけ送り中として扱う（それを過ぎた行は止まった）
begin
  select * into v_inv from invitations i where i.token_hash = p_token_hash for update;
  if not found then return; end if;
  -- 期限切れの招待だけ（使われた・取り消した・消した・まだ使える は頼めない。口が先に断るが、ここでも見る）
  if v_inv.accepted_member_id is not null or v_inv.revoked_at is not null or v_inv.deleted_at is not null
     or v_inv.expires_at >= now() then
    return;
  end if;
  if v_inv.resend_requested_at is not null and v_inv.resend_requested_at > now() - c_day then return; end if;
  -- 送り中（どちらの印も無く、最後に触ってから 2 分の内）の知らせがあれば入れない（同時に 2 回押しても 2 通出さない）
  if exists (select 1 from notifications n
              where n.tenant_id = v_inv.tenant_id and n.event_kind_id = 'invitation_resend_requested'
                and n.payload ->> 'invitation_id' = v_inv.id::text
                and n.sent_at is null and n.failed_at is null and n.deleted_at is null
                and n.updated_at > now() - c_sending) then
    return;
  end if;
  select t.name into v_name from tenants t where t.id = v_inv.tenant_id;
  -- 前の回（頼んだ時刻を書いた後の回）に送れなかった宛てがあれば、いまも宛てである人の分だけを引き受けて送り直す
  --   （届いた人には 2 通目を出さない。failed_at を空にして数を足す。updated_at は trigger が今にする＝送り中の始まり・0112 と同じ形）
  return query
    with targets as (
      select t.member_id, t.email from app.invitation_resend_targets(p_token_hash) t
    ), claimed as (
      update notifications n
         set failed_at = null, retry_count = coalesce(n.retry_count, 0) + 1
       where n.tenant_id = v_inv.tenant_id and n.event_kind_id = 'invitation_resend_requested'
         and n.payload ->> 'invitation_id' = v_inv.id::text
         and n.failed_at is not null and n.sent_at is null and n.deleted_at is null
         and n.created_at > coalesce(v_inv.resend_requested_at, '-infinity'::timestamptz)
         and n.member_id in (select tg.member_id from targets tg)
      returning n.id, n.member_id
    )
    select cl.id, cl.member_id, tg.email, v_inv.id, v_inv.email, v_inv.created_at, v_inv.expires_at, v_name
      from claimed cl join targets tg on tg.member_id = cl.member_id
     order by cl.member_id;
  if found then return; end if;
  -- 新しい回：宛てごとに知らせの行を 1 つ
  return query
    with targets as (
      select t.member_id, t.email from app.invitation_resend_targets(p_token_hash) t
    ), ins as (
      insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, dedupe_key)
      select v_inv.tenant_id, tg.member_id, 'inapp', 'invitation_resend_requested',
             jsonb_build_object('invitation_id', v_inv.id, 'invitee_email', v_inv.email, 'invited_at', v_inv.created_at,
                                'expires_at', v_inv.expires_at, 'workspace_name', v_name),
             'invitation_resend:' || v_inv.id || ':' || tg.member_id || ':' || extract(epoch from now())::text
        from targets tg
      returning id, notifications.member_id
    )
    select ins.id, ins.member_id, tg.email, v_inv.id, v_inv.email, v_inv.created_at, v_inv.expires_at, v_name
      from ins join targets tg on tg.member_id = ins.member_id
     order by ins.member_id;
end $$;
revoke all on function app.invitation_resend_record(text) from public;
grant execute on function app.invitation_resend_record(text) to kaname_app;

create or replace function app.invitation_resend_mark(p_token_hash text, p_sent uuid[], p_failed uuid[]) returns int
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_inv invitations%rowtype;
  v_n int;
begin
  select * into v_inv from invitations i where i.token_hash = p_token_hash;
  if not found then return 0; end if;
  update notifications n
     set sent_at = case when n.id = any (coalesce(p_sent, '{}')) then now() else null end,
         failed_at = case when n.id = any (coalesce(p_failed, '{}')) then now() else null end
   where n.tenant_id = v_inv.tenant_id and n.event_kind_id = 'invitation_resend_requested'
     and n.payload ->> 'invitation_id' = v_inv.id::text
     and n.id = any (coalesce(p_sent, '{}') || coalesce(p_failed, '{}'))
     and n.sent_at is null and n.failed_at is null and n.deleted_at is null;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function app.invitation_resend_mark(text, uuid[], uuid[]) from public;
grant execute on function app.invitation_resend_mark(text, uuid[], uuid[]) to kaname_app;

-- 頼んだ時刻は、この招待にいま届いた知らせ（2 分の内に sent_at を書いた行）があるときだけ書く（トークンで引く・届いていない招待は止めない）
create or replace function app.invitation_resend_stamp(p_token_hash text) returns boolean
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_inv invitations%rowtype;
begin
  select * into v_inv from invitations i where i.token_hash = p_token_hash;
  if not found then return false; end if;
  if not exists (select 1 from notifications n
                  where n.tenant_id = v_inv.tenant_id and n.event_kind_id = 'invitation_resend_requested'
                    and n.payload ->> 'invitation_id' = v_inv.id::text
                    and n.sent_at > now() - interval '2 minutes' and n.deleted_at is null) then
    return false;
  end if;
  update invitations set resend_requested_at = now() where id = v_inv.id;
  return true;
end $$;
revoke all on function app.invitation_resend_stamp(text) from public;
grant execute on function app.invitation_resend_stamp(text) to kaname_app;

insert into app.schema_migrations (name) values ('0117_invitation_resend.sql') on conflict do nothing;
