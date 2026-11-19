// 試験の作り物の値（本物の秘密ではない）。秘密の検査は .gitleaks.toml がこの置き場だけを外す。
// 次から作り物の秘密を書く試験は、値をここに足して import する（.gitleaksignore に行を足さない・K-328）。
// 値は前からの試験に書かれた値と 1 文字も変えない（前からの試験はまだ自分の文字のまま持つ）。

/** 中継（edge）の秘密の代わり */
export const K262_EDGE_SECRET = "k262-edge-secret-0123456789abcdef";
/** パスワードの再設定の試験の札 */
export const K320_RESET_TOKEN = "rp_k320_0123456789abcdefghijklmnopqrstuv";
