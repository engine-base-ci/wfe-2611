-- 0054 会話のいまが変わったら、その人の画面に知らせる（D-113）。
--   画面は 1.2 秒ごとに見に行っていた。自分のAI の会話が読む 4 つの表（仕事・途中経過・会話・言ったこと）に
--   書き込みがあったら、書いた取引の終わりに pg_notify('kaname_agent', <その人の member id>) を出す。
--   中身は送らない（誰の会話が変わったかだけ）。受けた API はその人の画面に「変わった」とだけ伝え、画面はいつもの /agent/state を読み直す。
--   同じ取引の中で同じ人への知らせは Postgres が 1 つにまとめる。

create or replace function app.agent_notify_member(p_member uuid) returns void
language sql as $$
  select pg_notify('kaname_agent', p_member::text) where p_member is not null
$$;

create or replace function app.agent_notify_job() returns trigger
language plpgsql as $$
begin
  perform app.agent_notify_member(coalesce(new.member_id, old.member_id));
  return null;
end $$;

create or replace function app.agent_notify_job_event() returns trigger
language plpgsql security definer set search_path = public, app as $$
begin
  perform app.agent_notify_member((select member_id from bridge_jobs where id = coalesce(new.job_id, old.job_id)));
  return null;
end $$;

create or replace function app.agent_notify_conversation() returns trigger
language plpgsql as $$
begin
  perform app.agent_notify_member(coalesce(new.owner_member_id, old.owner_member_id));
  return null;
end $$;

create or replace function app.agent_notify_message() returns trigger
language plpgsql security definer set search_path = public, app as $$
begin
  perform app.agent_notify_member((select owner_member_id from conversations where id = coalesce(new.conversation_id, old.conversation_id)));
  return null;
end $$;

drop trigger if exists agent_notify on bridge_jobs;
create trigger agent_notify after insert or update or delete on bridge_jobs
  for each row execute function app.agent_notify_job();
drop trigger if exists agent_notify on bridge_job_events;
create trigger agent_notify after insert or update on bridge_job_events
  for each row execute function app.agent_notify_job_event();
drop trigger if exists agent_notify on conversations;
create trigger agent_notify after insert or update on conversations
  for each row execute function app.agent_notify_conversation();
drop trigger if exists agent_notify on messages;
create trigger agent_notify after insert or update or delete on messages
  for each row execute function app.agent_notify_message();
