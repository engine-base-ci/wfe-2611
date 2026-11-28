-- 20261128041500 PC が取った会話の仕事の種類を読む（K-737・関門 C2・読むだけ・統合の枝）
--   K-737 は取る口の答えに会話の種類 talk_kind を足すのに、PC の印の文脈（app.role = device）で conversations を直に読んでいた。
--   会話の行の守り（conversations_self_read）は app.member_ok（role member だけ）なので、PC の文脈では行が見えず、いつも null になっていた。
--   取る口と同じ道（app.bridge_job_of：その PC が取った仕事か、その PC の人の仕事）で仕事を確かめてから、その会話の種類だけを返す。
--   会話の中身・持ち主は返さない。会話の無い仕事は null（消した会話も種類は読む・前の読みと同じ）。kaname_app だけが呼べる。もう 1 度当てても壊れない。
create or replace function app.bridge_job_talk_kind(p_session uuid, p_job uuid) returns text
language sql stable security definer set search_path = public, app, pg_temp as $$
  select c.talk_kind
    from bridge_jobs j
    join conversations c on c.id = j.conversation_id and c.tenant_id = j.tenant_id
   where j.id = app.bridge_job_of(p_session, p_job)
$$;
revoke all on function app.bridge_job_talk_kind(uuid, uuid) from public;
grant execute on function app.bridge_job_talk_kind(uuid, uuid) to kaname_app;
