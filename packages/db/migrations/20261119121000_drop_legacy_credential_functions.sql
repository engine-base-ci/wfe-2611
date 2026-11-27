-- K-371: 前の道すじ（K-358 が消した預けたログイン情報の口・K-367 が消したブラウザの口）だけが呼んでいた関数を消す（cascade は使わない）
drop function if exists app.my_credentials(uuid);
drop function if exists app.bridge_credential(uuid, uuid, uuid);
drop function if exists app.credential_login_check_retry(uuid, uuid);
drop function if exists app.agent_answer_code(uuid, uuid, text, text);
drop function if exists app.bridge_take_code(uuid, uuid, text);
drop function if exists app.bridge_login_check_result(uuid, uuid, text, text);
drop function if exists app.agent_set_browser(uuid, text);
drop function if exists app.agent_browser_check(uuid, text);
