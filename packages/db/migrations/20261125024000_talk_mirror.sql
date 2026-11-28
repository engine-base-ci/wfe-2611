-- 20261125024000 PC の側の会話の写しと取り戻す先（K-760・D-112・D-115・D-128.163・関門 C2）
--   新しい表・列は作らない。関数を 2 つ足す（どれも security definer・public から外し kaname_app だけが呼べる）。
--   前の道すじの app.bridge_entries（0055）・app.bridge_mirror_targets（0053）は直さず残す（/api/auth-ext/bridge/entries・mirror-targets が K-765 まで使う）。
--
-- app.talk_mirror_entries(p_session, p_job, p_entries)：その仕事を受け取った PC（app.bridge_job_of・0092）が、仕事の会話に文を写す。
--   会話は仕事から決める（体に会話の id を持たない）。吹き出しの書き方は前から在る app.bridge_entries を呼ぶ（1 か所のまま）。
--   答え：PC の印が生きていなければ null ／ { error: not_found }（受け取っていない・ほかの人の・無い仕事・消した会話・仕事の持ち主の会話でない）／
--         { error: no_conversation }（仕事に会話が無い）／ { inserted: 入れた数 }。仕事が動いているかは問わない（終わった後に取り戻す）
-- app.talk_mirror_targets(p_session, p_limit)：直近 14 日・session あり・消していない仕事のうち、その PC が受け取った仕事（写す口と同じ条件）の、
--   消していない本人の会話を、会話 × session ごとにいちばん新しい仕事で 1 つ・新しい順に p_limit 件。
--   答え：PC の印が生きていなければ null ／ [{ conversation_id, agent_session_id, job_id }]

create or replace function app.talk_mirror_entries(p_session uuid, p_job uuid, p_entries jsonb)
returns jsonb
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare j bridge_jobs%rowtype; v_conv uuid; v_n int;
begin
  if not exists (select 1 from sessions s where s.id = p_session and s.kind_id = 'bridge' and s.revoked_at is null) then
    return null;
  end if;
  select * into j from bridge_jobs where id = app.bridge_job_of(p_session, p_job);
  if j.id is null then return jsonb_build_object('error', 'not_found'); end if;
  if j.conversation_id is null then return jsonb_build_object('error', 'no_conversation'); end if;
  select c.id into v_conv from conversations c
   where c.id = j.conversation_id and c.owner_member_id = j.member_id and c.deleted_at is null;
  if v_conv is null then return jsonb_build_object('error', 'not_found'); end if;
  v_n := app.bridge_entries(p_session, v_conv, j.id, p_entries);
  return jsonb_build_object('inserted', coalesce(v_n, 0));
end $$;
revoke all on function app.talk_mirror_entries(uuid, uuid, jsonb) from public;
grant execute on function app.talk_mirror_entries(uuid, uuid, jsonb) to kaname_app;

create or replace function app.talk_mirror_targets(p_session uuid, p_limit integer)
returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare v_member uuid; v jsonb;
begin
  select s.member_id into v_member from sessions s where s.id = p_session and s.kind_id = 'bridge' and s.revoked_at is null;
  if v_member is null then return null; end if;
  with latest as (
    select distinct on (j.conversation_id, j.agent_session_id) j.conversation_id, j.agent_session_id, j.id, j.created_at
      from bridge_jobs j
      join conversations c on c.id = j.conversation_id and c.owner_member_id = j.member_id and c.deleted_at is null
     where j.member_id in (select app.account_members(v_member))
       and j.conversation_id is not null and j.agent_session_id is not null and j.deleted_at is null
       and j.created_at > now() - interval '14 days'
       and app.bridge_job_of(p_session, j.id) is not null
     order by j.conversation_id, j.agent_session_id, j.created_at desc, j.id desc
  ), picked as (
    select l.* from latest l order by l.created_at desc, l.id desc limit greatest(coalesce(p_limit, 50), 1)
  )
  select coalesce(jsonb_agg(jsonb_build_object('conversation_id', p.conversation_id, 'agent_session_id', p.agent_session_id,
                                               'job_id', p.id) order by p.created_at desc, p.id desc), '[]'::jsonb)
    into v from picked p;
  return v;
end $$;
revoke all on function app.talk_mirror_targets(uuid, integer) from public;
grant execute on function app.talk_mirror_targets(uuid, integer) to kaname_app;
