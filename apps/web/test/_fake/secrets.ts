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
/** K-336：切れたログインの印（口の答えで signed_in が null になる） */
export const K336_EXPIRED_SESSION_TOKEN = "expired-token-k336";
