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

// ---- 段 4 の葉ごとの区切り（葉は自分の区切りの中だけを足す・取り込みは足した区切りの和）----

// ---- K-352（預ける口 createCredential の試験）----
/** 預けるパスワード */
export const K352_PASSWORD = "Pass-word-K352-zz";
/** 預ける API キーの値 */
export const K352_KEY_VALUE = "sk_live_k352_value_zz";
/** 認証アプリの鍵（Base32） */
export const K352_TOTP_SECRET = "JBSWY3DPEHPK3PXP";
/** 同じ鍵を小文字・空白入りで書いた物（整えると K352_TOTP_SECRET になる） */
export const K352_TOTP_SECRET_SPACED = "jbsw y3dp ehpk 3pxp";
// ---- K-352 ここまで ----

// ---- K-353（上書き updateCredential・消す deleteCredential の試験）----
/** 上書きの前のパスワード */
export const K353_OLD_PW = "Old-pass-K353-zz";
/** 上書きの後のパスワード */
export const K353_NEW_PW = "New-pass-K353-yy";
/** 上書きの前の API キーの値 */
export const K353_OLD_VALUE = "sk_old_value";
/** 上書きの後の API キーの値 */
export const K353_NEW_VALUE = "sk_live_k353_new_value";
/** 同時に 2 つ上書きする値 */
export const K353_RACE_VALUE_1 = "sk_race_1";
export const K353_RACE_VALUE_2 = "sk_race_2";
// ---- K-353 ここまで ----

// ---- K-355（PC の確かめの土台 credential-device.harness.ts の既定の値）----
/** 土台が預けるパスワードの既定（的 /dev/fake-login が通す値と同じ） */
export const K355_PASSWORD = "S3cret-Plain!";
/** 土台が預ける API キーの値の既定 */
export const K355_KEY_VALUE = "sk_test_value_0000";
// ---- K-355 ここまで ----

// ---- K-354（PC が取り出す口 resolveCredential の試験・既定の値は K-355 の区切りを使う）----
/** 記録に出ないことを見るための、ほかと重ならないパスワード */
export const K354_UNIQUE_PASSWORD = "Zq9-unique-pass-777";
// ---- K-354 ここまで ----

// ---- K-358（前の道すじを消す試験と、前からの試験 mfa-gate の書き直した行）----
/** 形は正しいが、どの PC にも無い PC の札 */
export const K358_UNKNOWN_DEVICE_TOKEN = "kpc_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
/** K321-API-011 が預けようとするパスワード（mfa-gate.test.ts・K-358 が契約の口に書き直した行） */
export const K358_K321_PASSWORD = "k321-secret-0000";
// ---- K-358 ここまで ----

// ---- K-366（Bridge の窓で選び直す口 setBridgeBrowser の試験）----
/** 形は正しいが、どの PC にも無い PC の札 */
export const K366_UNKNOWN_DEVICE_TOKEN = "kpc_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
// ---- K-366 ここまで ----
/** K-337：前の道すじに送る招待の札（どんな札でも 404） */
export const K337_ANY_INVITE_TOKEN = "any-token-k337";
