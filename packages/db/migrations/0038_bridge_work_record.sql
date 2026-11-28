-- 0038 自分のAI の仕事の記録（D-100）。仕事ごとに「使った量」（往復数・時間・入力と出力の量・費用の見込み）と、
-- 道具の呼び出し（名前・対象・成功／失敗・かかった時間）を残す。中身の全文（ファイルの中身・道具の返り値）は送らない・残さない（D-100.3）。
-- 会話の途中経過と同じ流れ（bridge_job_events）に kind を 2 つ足す。会話の画面が出すのは progress だけなので、会話は散らからない。
alter table bridge_job_events drop constraint if exists bridge_job_events_kind_check;
alter table bridge_job_events add constraint bridge_job_events_kind_check
  check (kind in ('init', 'progress', 'ask', 'answer', 'tool', 'usage'));

create or replace function app.bridge_progress(p_session uuid, p_job uuid, p_seq int, p_kind text, p_payload jsonb) returns boolean
language plpgsql security definer set search_path = public, app as $$
declare v_member uuid; j bridge_jobs%rowtype;
begin
  select member_id into v_member from sessions where id = p_session and kind_id = 'bridge' and revoked_at is null;
  if v_member is null then return false; end if;
  select * into j from bridge_jobs where id = p_job and member_id = v_member and state_id in ('running', 'asking');
  if j.id is null then return false; end if;
  if p_kind not in ('init', 'progress', 'tool', 'usage') then raise exception '途中経過は init／progress／tool／usage'; end if;
  insert into bridge_job_events (tenant_id, scope_id, member_id, job_id, kind, seq, payload)
    values (j.tenant_id, j.scope_id, j.member_id, j.id, p_kind, coalesce(p_seq, 0), coalesce(p_payload, '{}'::jsonb));
  if p_kind = 'init' and (p_payload->>'agent_session_id') is not null then
    update bridge_jobs set agent_session_id = p_payload->>'agent_session_id' where id = j.id;
    if j.conversation_id is not null then
      update conversations set agent_session_id = p_payload->>'agent_session_id'
        where id = j.conversation_id and agent_session_id is distinct from (p_payload->>'agent_session_id');
    end if;
  end if;
  return true;
end $$;
grant execute on function app.bridge_progress(uuid, uuid, int, text, jsonb) to kaname_app;
