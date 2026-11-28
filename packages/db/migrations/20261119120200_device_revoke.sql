-- 20261119120200_device_revoke PC を外す（K-362・契約の口 revokeMyDevice・関門 C2・D-128.155・D-128.156・D-128.163・D-128.166）
--   PC はアカウントのもの（D-128.156）。どのワークスペースの画面からでも自分の PC を外せ、他の人の PC には触れない。
--   持ち主の確かめは口（app.device_owned）と、外す関数の中（app.account_members）の 2 重（D-128.166）。
--   外した PC の印は app.bridge_device_check が revoked_at の付いた行を引かないので、次の知らせから全部の口で 401（K-57 の作り）。
--   新しい表・列は作らない（仕事を受け取った PC の列 bridge_jobs.taken_session_id は 0092 からある）。

-- ① 外した理由（ログアウトと見分ける・D-128.155）
insert into revoke_reasons (key, label) values ('device_removed', '端末を外した') on conflict (key) do nothing;

-- ② その人のアカウントの、外していない・消していない Bridge の PC か（口の 1 つ目の確かめ）
create or replace function app.device_owned(p_member uuid, p_session uuid) returns boolean
language sql stable security definer set search_path = public, app, pg_temp as $$
  select exists (
    select 1 from sessions s
     where s.id = p_session and s.kind_id = 'bridge' and s.revoked_at is null and s.deleted_at is null
       and s.member_id in (select app.account_members(p_member))
  )
$$;
revoke all on function app.device_owned(uuid, uuid) from public;
grant execute on function app.device_owned(uuid, uuid) to kaname_app;

-- ③ 外す（1 つの取引）：PC の行を錠で取り、外した印・セキュリティの出来事 1 件・その PC が受け取って動いていた仕事を止める。
--   行が無い（他の人の PC・外した PC・消した PC・画面のログインの行・無い PC）はどれも null（区別を漏らさない・2 つ目の確かめ）。
--   revoked_at は行の錠を取った後の時刻（clock_timestamp）。同時に届いた生きている知らせの last_seen_at より前にならない。
--   出来事の持ち主は PC の行（別のワークスペースでつないだ PC では、その会社のその人）。
--   止めるのは taken_session_id がこの PC の running・asking の仕事だけ（仕事の種類で分けない・待ちの仕事ともう 1 台の仕事は変えない・D-128.163）。
--   会話の仕事は会話に止まった発言を 1 つ（0051 の bridge_sweep_orphans と同じ）。
--   チケットの作る段（phase make）の仕事は、実行の記録・段（作業中）・旗・やり取りの 1 行をここで書く（0092 の on_member_stopped と同じ）。
--   承認の後の実行（phase execute）の仕事は、仕事を stopped にした時点で引き金 app.ticket_execute_job_end（0098）が書くので、ここでは書かない（2 重に書かない）
create or replace function app.device_revoke(p_member uuid, p_session uuid) returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare s sessions%rowtype; g record; r action_runs%rowtype;
        v_why constant text := 'PC を外したので止まりました';
begin
  select * into s from sessions x
   where x.id = p_session and x.kind_id = 'bridge' and x.revoked_at is null and x.deleted_at is null
     and x.member_id in (select app.account_members(p_member))
   for update;
  if s.id is null then return null; end if;
  update sessions set revoked_at = clock_timestamp(), revoke_reason_id = 'device_removed', updated_at = now(), updated_by = p_member
   where id = s.id returning * into s;
  perform app.record_security_event(s.tenant_id, 'device_removed', s.member_id, null, jsonb_build_object('device_id', s.id));
  for g in
    update bridge_jobs bj set state_id = 'stopped', finished_at = now(), partial = null, stopped_reason = v_why
     where bj.taken_session_id = s.id and bj.state_id in ('running', 'asking') and bj.deleted_at is null
    returning bj.id, bj.tenant_id, bj.kind, bj.conversation_id, bj.agent_session_id
  loop
    if g.conversation_id is not null then
      if g.agent_session_id is not null then
        update conversations set agent_session_id = g.agent_session_id, updated_at = now() where id = g.conversation_id;
      end if;
      insert into messages (tenant_id, conversation_id, body, kind, job_id) values (g.tenant_id, g.conversation_id, v_why, 'stopped', g.id);
    end if;
    if g.kind = 'ticket' then
      select * into r from action_runs where bridge_job_id = g.id order by created_at desc limit 1;
      -- 承認の後の実行は引き金が先に閉じている（status が stopped）。閉じていない作る段の記録だけを書く
      if r.id is not null and r.phase = 'make' and r.status_id in ('queued', 'running', 'asking') then
        update action_runs set status_id = 'stopped', error_summary = v_why, finished_at = now() where id = r.id;
        perform app.ticket_stage_to(r.ticket_id, 'doing', r.created_by);
        update tickets set delegated_to_clone = false where id = r.ticket_id;
        perform app.ticket_system_line(r.ticket_id, r.created_by, app.member_name(r.created_by) || 'のAI が止まりました（' || v_why || '）');
      end if;
    end if;
  end loop;
  return jsonb_build_object('id', s.id, 'device_label', s.device_label, 'revoked_at', s.revoked_at, 'revoke_reason', '端末を外した');
end $$;
revoke all on function app.device_revoke(uuid, uuid) from public;
grant execute on function app.device_revoke(uuid, uuid) to kaname_app;
