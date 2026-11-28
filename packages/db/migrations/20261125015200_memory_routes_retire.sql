-- K-712 記憶の口と旧い記憶の道を消す（D-152.1・D-152.8・D-152.20：記憶は物として無くし、AI に覚えさせたいことはナレッジのページで受ける）
--   旧い記憶の道 9（/api/auth-ext/agent/memory/…）と会話の仕事への記憶の渡し（bridge_job_memories）だけが使っていた DB の関数 12 を消す。
--   残す 5（agent_remember・agent_remember_tool・agent_digest_start・digest_of_job・agent_digest_apply）は消さない：
--   「覚えて」の印を記憶に入れる所と、前の道で始まったまとめの仕事の結末を受ける所（残す関数は消す関数を呼ばない・0043 の定義で確かめた）。
--   表・行・索引・権限は変えない（凍結の印は K-722）。関数ごとに if exists で消すので、もう一度当てても失敗しない
-- 消す訳：K-712（D-152.1・D-152.8・記憶の口と旧い記憶の道を消した。残す 5 つはこの関数を呼ばない）
-- squawk-ignore ban-drop-function
drop function if exists app.agent_digest_status(uuid);
-- squawk-ignore ban-drop-function
drop function if exists app.agent_digest_source(uuid, date, date);
-- squawk-ignore ban-drop-function
drop function if exists app.agent_memory_edit(uuid, uuid, text, text);
-- squawk-ignore ban-drop-function
drop function if exists app.agent_memory_delete(uuid, uuid);
-- squawk-ignore ban-drop-function
drop function if exists app.agent_digest_undo_merge(uuid, uuid, uuid);
-- squawk-ignore ban-drop-function
drop function if exists app.agent_digest_pick(uuid, uuid, int);
-- squawk-ignore ban-drop-function
drop function if exists app.agent_proposal_send(uuid, uuid, uuid);
-- squawk-ignore ban-drop-function
drop function if exists app.agent_memory_reviews(uuid);
-- squawk-ignore ban-drop-function
drop function if exists app.agent_proposal_decide(uuid, uuid, boolean, text);
-- squawk-ignore ban-drop-function
drop function if exists app.agent_my_proposals(uuid);
-- squawk-ignore ban-drop-function
drop function if exists app.bridge_job_memories(uuid, uuid);
-- squawk-ignore ban-drop-function
drop function if exists app.memory_reviewer(uuid, uuid, uuid);
