// 試験の作り物の値（本物の秘密ではない）。秘密の検査は .gitleaks.toml がこの置き場だけを外す。
// 次から作り物の秘密を書く試験は、値をここに足して import する（.gitleaksignore に行を足さない・K-328）。
// 値は前からの試験に書かれた値と 1 文字も変えない（前からの試験はまだ自分の文字のまま持つ）。

/** Better Auth の試験の鍵（前からの試験の多くと同じ値） */
export const TEST_AUTH_SECRET = "test-secret-0123456789-abcdefghijklmnop";
/** パスワードを忘れたときの試験の鍵 */
export const K313_AUTH_SECRET = "test-secret-k313-0123456789-abcdefghij";
/** パスワードの再設定の試験の鍵 */
export const K314_AUTH_SECRET = "test-secret-k314-0123456789-abcdefghij";
/** K-333：ログイン中の参加で送っても使わないパスワード（使われないことを確かめる） */
export const K333_UNUSED_PASSWORD = "unused-password-1234";
/** K-333：無い招待の札（404 を確かめる） */
export const K333_MISSING_INVITE_TOKEN = "no-such-token-k333";
/** 中継（edge）の秘密の代わり */
export const K262_EDGE_SECRET = "k262-edge-secret-0123456789abcdef";
/** 契約の fuzz の的の鍵 */
export const FUZZ_AUTH_SECRET = "fuzz-test-secret-0123456789-abcdefghij";
/** K-337：前の道すじに送る招待の札（どんな札でも 404） */
export const K337_ANY_INVITE_TOKEN = "any-token-k337";
