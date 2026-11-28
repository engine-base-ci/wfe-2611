-- 20261120143736_bridge_set_browser_acl Bridge の窓から AI が使うブラウザを書く関数を、誰でも呼べる権限（PUBLIC）から外す（K-366・関門 C2）
--   0057 の app.bridge_set_browser は security definer なのに PUBLIC の実行権が残っていた（どの役からでも、どの PC の値でも書けた）。
--   呼ぶのは kaname_app（契約の口 setBridgeBrowser と前の道すじ /api/auth-ext/bridge/browser）だけなので、kaname_app の実行権は残す。
--   前例：app.bridge_beat（0089）・app.device_set_browser（20261119120100）と同じ形。関数の中身は変えない
revoke all on function app.bridge_set_browser(uuid, text) from public;
grant execute on function app.bridge_set_browser(uuid, text) to kaname_app;
