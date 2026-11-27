-- K-371: 前の道すじ（K-358 が消した預けたログイン情報の口・K-367 が消したブラウザの口）だけが呼んでいた関数を消す（cascade は使わない）
-- 消す訳：K-371（前の道すじ K-358・K-367 を消した後、呼ぶ所の無い関数。どの口・関数からも呼ばれない）
-- squawk-ignore ban-drop-function
drop function if exists app.my_credentials(uuid);
-- squawk-ignore ban-drop-function
drop function if exists app.bridge_credential(uuid, uuid, uuid);
-- squawk-ignore ban-drop-function
drop function if exists app.credential_login_check_retry(uuid, uuid);
-- squawk-ignore ban-drop-function
drop function if exists app.agent_answer_code(uuid, uuid, text, text);
-- squawk-ignore ban-drop-function
drop function if exists app.bridge_take_code(uuid, uuid, text);
-- squawk-ignore ban-drop-function
drop function if exists app.bridge_login_check_result(uuid, uuid, text, text);
-- squawk-ignore ban-drop-function
drop function if exists app.agent_set_browser(uuid, text);
-- squawk-ignore ban-drop-function
drop function if exists app.agent_browser_check(uuid, text);
