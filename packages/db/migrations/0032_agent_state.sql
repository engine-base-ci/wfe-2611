-- 0032 画面が「いまどうなっているか」を 1 回で読む（D-090・T-B-04）。
--   会話の中身（言ったこと・返ってきたこと・止まりました）／動いている仕事／止まっている仕事
--   ＋ この PC が本当に生きているか（最後の知らせからの経過。90 秒「接続中」のままにしない：G-12）
-- 読む側で生の select をすると行レベルの制御に弾かれ、例外にならず「0 件」になる（0026・0027・0030 で 3 回踏んだ）。
-- 判定は定義の中でやり、結果だけ返す。

-- 会話 1 本のいま。conv が null なら「開いている会話」を見る（D-062）。会話が無ければ messages は空
create or replace function app.agent_state(p_member uuid, p_conv uuid)
returns jsonb language plpgsql security definer set search_path = public, app as $$
declare v_id uuid; v_msgs jsonb; v_stopped jsonb; v_running uuid;
begin
  if p_conv is not null then
    select c.id into v_id from conversations c
      where c.id = p_conv and c.owner_member_id = p_member and c.deleted_at is null;
  else
    select c.id into v_id from conversations c
      where c.owner_member_id = p_member and c.closed_at is null and c.deleted_at is null
      order by c.updated_at desc limit 1;
  end if;
  if v_id is null then
    return jsonb_build_object('conversation_id', null, 'messages', '[]'::jsonb, 'running_job_id', null, 'stopped', null);
  end if;
  select coalesce(jsonb_agg(x order by x->>'at'), '[]'::jsonb) into v_msgs from (
    select jsonb_build_object(
             'id', m.id,
             -- 画面の言葉に寄せる。'human' は自分、それ以外は自分のAI（'stopped' は止まりました）
             'who', case when m.kind = 'human' then 'me' when m.kind = 'stopped' then 'stopped' else 'ai' end,
             'text', coalesce(m.body, ''), 'at', m.created_at) as x
      from messages m where m.conversation_id = v_id and m.deleted_at is null
      order by m.created_at desc limit 50
  ) t;
  select j.id into v_running from bridge_jobs j
    where j.conversation_id = v_id and j.member_id = p_member and j.state_id in ('queued', 'running') and j.deleted_at is null
    order by j.created_at desc limit 1;
  select jsonb_build_object('job_id', j.id, 'reason', coalesce(j.stopped_reason, '理由は分かりません')) into v_stopped
    from bridge_jobs j
    where j.conversation_id = v_id and j.member_id = p_member and j.state_id = 'stopped' and j.deleted_at is null
    order by j.finished_at desc nulls last limit 1;
  return jsonb_build_object('conversation_id', v_id, 'messages', v_msgs, 'running_job_id', v_running, 'stopped', v_stopped);
end $$;
grant execute on function app.agent_state(uuid, uuid) to kaname_app;

-- この PC の今。live＝最後の知らせが 75 秒以内（知らせは 30 秒ごと。2 回落としたら切れたと見なす）。
-- 「つながりました」と出したまま、実は止まっている状態を作らない（G-12）
create or replace function app.bridge_state(p_member uuid)
returns jsonb language plpgsql security definer set search_path = public, app as $$
declare s record;
begin
  select id, device_label, last_seen_at, health, health_at into s from sessions
    where member_id = p_member and kind_id = 'bridge' and revoked_at is null and deleted_at is null
    order by last_seen_at desc limit 1;
  if s.id is null then return jsonb_build_object('connected', false, 'live', false); end if;
  return jsonb_build_object(
    'connected', true,
    'live', s.last_seen_at > now() - interval '75 seconds',
    'device_label', s.device_label,
    'last_seen_sec', floor(extract(epoch from (now() - s.last_seen_at)))::int,
    'health', s.health, 'health_at', s.health_at);
end $$;
grant execute on function app.bridge_state(uuid) to kaname_app;
