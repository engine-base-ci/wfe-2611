// 試験の作り物の値（本物の秘密ではない）。秘密の検査は .gitleaks.toml がこの置き場だけを外す。
// 次から作り物の秘密を書く試験は、値をここに足して import する（.gitleaksignore に行を足さない・K-328）。
// 値は前からの試験に書かれた値と 1 文字も変えない（前からの試験はまだ自分の文字のまま持つ）。

/** 中継（edge）の秘密の代わり */
export const K262_EDGE_SECRET = "k262-edge-secret-0123456789abcdef";
/** K-335：短すぎて断られるパスワード */
export const K335_SHORT_PASSWORD = "short-pw-11";
/** K-335：下見の口が 429 を返す招待の札（口は route で差し替える） */
export const K335_WAIT_INVITE_TOKEN = "wait-token";
/** K-335：下見の口が 503 を返す招待の札（口は route で差し替える） */
export const K335_DOWN_INVITE_TOKEN = "down-token";
/** K-335（k259 を運ぶ）：参加の口の答えの作り物のログインの印 */
export const K259_SESSION_TOKEN = "tok-k259";
/** パスワードの再設定の試験の札 */
export const K320_RESET_TOKEN = "rp_k320_0123456789abcdefghijklmnopqrstuv";

// ---- 段 4 の葉ごとの区切り（葉は自分の区切りの中だけを足す・取り込みは足した区切りの和）----

// ---- K-356（預けたログイン情報の画面の試験の道具 tests/k/credentials-mock.ts・K-372 も使う）----
/** 預けるパスワード */
export const K356_FAKE_PW = "plain-k356-login";
/** 預ける API キーの値 */
export const K356_FAKE_VALUE = "value-k356-key";
/** 認証アプリの鍵（Base32） */
export const K356_FAKE_TOTP = "JBSWY3DPEHPK3PXP";
/** 本人確認の小窓に入れる自分のパスワード */
export const K356_STEP_PW = "step-k356-ok";
// ---- K-356 ここまで ----

// ---- K-372（預ける小窓の試験）----
/** 本人確認の小窓に入れる違うパスワード */
export const K372_WRONG_STEP_PW = "wrong-k356";
// ---- K-372 ここまで ----

// ---- K-357（上書き・消す・確かめの画面の試験）----
/** 上書きの後の API キーの値 */
export const K357_FAKE_VALUE = "value-k357-new";
/** 上書きの後のパスワード */
export const K357_FAKE_PW = "plain-k357-new";
/** 本人確認の小窓に入れる自分のパスワード */
export const K357_STEP_PW = "step-k357-ok";
// ---- K-357 ここまで ----

// ---- K-370（預けたログイン情報の通しの画面の試験 tests/screens/credential-e2e.ts）----
/** 的（/dev/fake-login）が通すパスワード（apps/web/app/(dev)/dev/fake-login/page.tsx の頭の注と同じ） */
export const K370_PASSWORD = "S3cret-Plain!";
/** 的が通す認証アプリの鍵（Base32） */
export const K370_TOTP_KEY = "JBSWY3DPEHPK3PXP";
/** 的が通さないパスワード */
export const K370_WRONG_PASSWORD = "wrong-password-k370";
// ---- K-370 ここまで ----

// ---- K-361（PC の行の Claude Code の区画の画面の試験）----
/** 画面に入れる作り物のログインの札（kaname.token） */
export const K361_WEB_TOKEN = "tok-aaaaaaaa-0000-4000-8000-000000000361";
// ---- K-361 ここまで ----

// ---- K-363（PC を外す画面の試験）----
/** 本人確認の小窓に入れる自分のパスワード */
export const K363_STEP_PW = "correct-horse-battery-1";
/** 本人確認の小窓に入れる違うパスワード */
export const K363_WRONG_STEP_PW = "wrong-password-123";
/** 画面に入れる作り物のログインの札（kaname.token） */
export const K363_WEB_TOKEN = "k363-web-token";
// ---- K-363 ここまで ----

// ---- K-367（前の画面 /setup/bridge/legacy を消す試験）----
/** 画面に入れる作り物のログインの札（kaname.token） */
export const K367_WEB_TOKEN = "k367-web-token";
// ---- K-367 ここまで ----

// ---- K-368（PC の行の AI が使うブラウザの画面の試験）----
/** 画面に入れる作り物のログインの札（kaname.token） */
export const K368_WEB_TOKEN = "k368-web-token";
// ---- K-368 ここまで ----

// ---- K-374（つなぐ小窓の OS の警告の越え方の画面の試験）----
/** 画面に入れる作り物のログインの札（kaname.token） */
export const K374_WEB_TOKEN = "k374-web-token";
// ---- K-374 ここまで ----

// ---- K-375（Bridge が古い PC の行の入れ直す一手の画面の試験）----
/** 画面に入れる作り物のログインの札（kaname.token） */
export const K375_WEB_TOKEN = "k375-web-token";
// ---- K-375 ここまで ----
/** K-336：切れたログインの印（口の答えで signed_in が null になる） */
export const K336_EXPIRED_SESSION_TOKEN = "expired-token-k336";
