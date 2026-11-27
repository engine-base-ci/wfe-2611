-- 20261126003800 ワークスペースから抜ける（K-838・K-70 の葉・D-128.65・D-128.96・D-154.15・D-154.19・D-154.21・D-154.25・D-154.61・関門 C2）
--   新しい表・列は作らない。関数を 1 つ足す（書く）。口 leaveWorkspace（DELETE /api/v1/me/workspaces/:id・:id は抜ける会社の id）が 1 回呼ぶ。
--
-- app.me_leave(p_tenant uuid) returns jsonb：今のログインの人が、同じログインで入っている会社 p_tenant から自分で抜ける。全部を呼び手の 1 取引で。
--   ① 今のログインの人（app.me_rows()・K-833：同じログインで active か suspended で入っている行）が p_tenant に居なければ { error: not_found }
--      （入っていない・もう抜けた・無い・別の人の会社は同じ答え。在るかを漏らさない）
--   ② 会社ごとの錠（K-800 の app.admin_lock と同じ鍵 'f10:' || 会社の id。admin_lock は今の会社しか取れないので同じ式を p_tenant で書く）
--   ③ 抜けられるか：app.me_leave_state(p_tenant)（K-833）だけで判定する（同じ判定を 2 か所に書かない）。
--      最後の管理者 → { error: last_admin }（担当が残っていてもこちらが先）／担当が残っている → { error: assigned }。どちらも何も書かない
--   ④ 会社の文脈を p_tenant・人を抜ける人に一時的に切り替える（記録・お知らせ・セッションを切る引き金がその会社に書くため）。最後に元に戻す
--   ⑤ app.member_erase(抜ける人, 抜ける人)（K-849）：個人の物・セッションと PC・所属・外した印（外す口 K-848 と同じ）。member_gone は not_found
--   ⑥ その会社の会社の記録に member.left を 1 行（payload は id と数だけ・名前・メールを入れない・D-154.25）
--   ⑦ その会社の有効な管理者（抜ける本人以外・止めた管理者は除く）に受け箱の行 member.left を 1 人 1 行（inapp・メールなし）。
--      dedupe_key は抜ける人・相手・抜けた時刻（30 日の招き直しで戻った人がもう一度抜けた知らせが前の行と重ならない）
--   ⑧ { ok, tenant_id, restorable_until }
--   security definer・search_path に pg_temp。public から外し、kaname_app にだけ渡す。
--   app.me_rows・app.me_leave_state（K-833）・app.member_erase（K-849）は後の migration だが、plpgsql なので呼ぶ時に在れば足りる

create or replace function app.me_leave(p_tenant uuid) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_member uuid;
  v_state jsonb;
  v_erase jsonb;
  v_prev_tenant text := current_setting('app.tenant_id', true);
  v_prev_user text := current_setting('app.user_id', true);
  v_at timestamptz := now();
begin
  -- ① 今のログインの人が p_tenant に入っているか（同じログインの行）
  select r.member_id into v_member from app.me_rows() r where r.tenant_id = p_tenant limit 1;
  if v_member is null then
    return jsonb_build_object('error', 'not_found');
  end if;

  -- ② 会社ごとの錠（同時に 2 人の管理者が抜けても最後の 1 人を残す）
  perform pg_advisory_xact_lock(hashtextextended('f10:' || p_tenant::text, 0));

  -- ③ 抜けられるか（錠の後に読む）
  v_state := app.me_leave_state(p_tenant);
  if v_state is null then
    return jsonb_build_object('error', 'not_found');
  end if;
  if coalesce((v_state ->> 'last_admin')::boolean, false) then
    return jsonb_build_object('error', 'last_admin');
  end if;
  if coalesce((v_state ->> 'assigned_total')::int, 0) > 0 then
    return jsonb_build_object('error', 'assigned');
  end if;

  -- ④ 会社の文脈を抜ける会社と抜ける人に切り替える（⑧ の前に戻す）
  perform set_config('app.tenant_id', p_tenant::text, true);
  perform set_config('app.user_id', v_member::text, true);

  -- ⑤ 個人の物・セッションと PC・所属・外した印（K-849）
  v_erase := app.member_erase(v_member, v_member);
  if v_erase ? 'error' then
    perform set_config('app.tenant_id', coalesce(v_prev_tenant, ''), true);
    perform set_config('app.user_id', coalesce(v_prev_user, ''), true);
    return jsonb_build_object('error', 'not_found');
  end if;

  -- ⑥ 会社の記録（id と数だけ）
  perform app.record_audit('member.left', 'members', v_member::text, 'C2',
    jsonb_build_object('member_id', v_member,
      'memories', coalesce((v_erase ->> 'memories')::int, 0),
      'conversations', coalesce((v_erase ->> 'conversations')::int, 0),
      'credentials', coalesce((v_erase ->> 'credentials')::int, 0),
      'invitations', coalesce((v_erase ->> 'invitations')::int, 0),
      'sessions', coalesce((v_erase ->> 'sessions')::int, 0)));

  -- ⑦ ほかの有効な管理者への受け箱（所属の role が admin で active の人と、所属の行を持たない owner。止めた管理者は除く）
  insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, dedupe_key, created_by)
  select p_tenant, m.id, 'inapp', 'member.left',
         jsonb_build_object('member_id', v_member, 'name', (select x.display_name from members x where x.id = v_member)),
         'member_left:' || v_member || ':' || m.id || ':' || to_char(v_at at time zone 'UTC', 'YYYYMMDDHH24MISSUS'),
         v_member
    from members m
    left join tenant_memberships tm on tm.tenant_id = m.tenant_id and tm.member_id = m.id
   where m.tenant_id = p_tenant and m.id <> v_member and m.deleted_at is null and m.suspended_at is null
     and m.kind_id = 'human'
     and ((tm.id is not null and tm.role = 'admin' and tm.status = 'active' and tm.deleted_at is null)
          or (tm.id is null and m.role_id = 'owner'));

  -- 文脈を元に戻す
  perform set_config('app.tenant_id', coalesce(v_prev_tenant, ''), true);
  perform set_config('app.user_id', coalesce(v_prev_user, ''), true);

  -- ⑧ 答え
  return jsonb_build_object('ok', true, 'tenant_id', p_tenant, 'restorable_until', v_erase ->> 'restorable_until');
end $$;

revoke all on function app.me_leave(uuid) from public;
grant execute on function app.me_leave(uuid) to kaname_app;
