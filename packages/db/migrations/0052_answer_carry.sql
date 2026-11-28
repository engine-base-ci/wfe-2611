-- 0052 本人が答えた問い合わせを、届かないまま捨てない（2026-09-28 実例：答えたのに Bridge が途中で止まり、
--   「続けて」の後に自分のAI が同じ問いを最初から聞き直した）。
--   Bridge が答えを受け取ったら印（delivered）を付ける。印の無いまま仕事が止まった答えは、同じ会話で次に言ったときに
--   自分のAI への指示に添えて渡し、渡した印（carried）を付ける（二度渡さない）

create or replace function app.bridge_take_answer2(p_session uuid, p_job uuid, p_request_id text) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v_member uuid; v_id uuid; v jsonb;
begin
  select member_id into v_member from sessions where id = p_session and kind_id = 'bridge' and revoked_at is null;
  if v_member is null then return null; end if;
  select e.id, e.payload into v_id, v from bridge_job_events e join bridge_jobs j on j.id = e.job_id
   where e.job_id = p_job and j.member_id = v_member and e.kind = 'answer' and e.request_id = p_request_id
   order by e.created_at desc limit 1;
  if v_id is not null and not coalesce((v->>'delivered')::boolean, false) then
    update bridge_job_events set payload = payload || jsonb_build_object('delivered', true, 'delivered_at', now()) where id = v_id;
  end if;
  return v;
end $$;

-- 同じ会話の、止まった仕事に残った「届かなかった答え」を取り出し、渡した印を付ける。
-- 返すのは 問い（問い合わせの questions）と答え（answers）と一言（note）の並び
create or replace function app.agent_carry_answers(p_member uuid, p_conv uuid) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v jsonb;
begin
  with pick as (
    select a.id, a.created_at, a.payload as ans, q.payload as ask
      from bridge_job_events a
      join bridge_jobs j on j.id = a.job_id
      left join bridge_job_events q on q.job_id = a.job_id and q.kind = 'ask' and q.request_id = a.request_id
     where j.member_id = p_member and j.conversation_id = p_conv and j.state_id in ('stopped', 'cancelled') and j.deleted_at is null
       and a.kind = 'answer'
       and not coalesce((a.payload->>'delivered')::boolean, false)
       and not coalesce((a.payload->>'carried')::boolean, false)
  ), mark as (
    update bridge_job_events e set payload = e.payload || jsonb_build_object('carried', true, 'carried_at', now())
      from pick where e.id = pick.id
    returning e.id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'tool', pick.ask->>'tool',
           'questions', coalesce(pick.ask->'input'->'questions', '[]'::jsonb),
           'answers', coalesce(pick.ans->'answers', '{}'::jsonb),
           'allow', pick.ans->'allow',
           'note', pick.ans->>'note') order by pick.created_at), '[]'::jsonb)
    into v from pick where exists (select 1 from mark where mark.id = pick.id);
  return v;
end $$;
grant execute on function app.agent_carry_answers(uuid, uuid) to kaname_app;
