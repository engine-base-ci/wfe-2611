// 試験の作り物の値（本物の秘密ではない）。秘密の検査は .gitleaks.toml がこの置き場だけを外す。
// 次から作り物の秘密を書く試験は、値をここに足して import する（.gitleaksignore に行を足さない・K-328）。
// 値は前からの試験に書かれた値と 1 文字も変えない（前からの試験はまだ自分の文字のまま持つ）。
// Bridge（apps/bridge/test）の置き場。api・web の置き場（apps/{api,web}/test/_fake/secrets.ts）と同じ形で K-350 が作った。

// ---- 段 4 の葉ごとの区切り（葉は自分の区切りの中だけを足す・取り込みは足した区切りの和）----

// ---- K-354（PC が取り出す口と Bridge の取り出し・ログインの確かめの試験）----
/** 的（偽のサービス）が通すパスワード（k354-credential-bridge・login-check・login-check-2fa の試験。/dev/fake-login と同じ値） */
export const K354_PASSWORD = "S3cret-Plain!";
/** 預けた認証アプリの鍵（Base32・k354-credential-bridge の試験） */
export const K354_TOTP_SECRET = "JBSWY3DPEHPK3PXP";
/** 偽のサービスが通さないパスワード（login-check の試験） */
export const K354_WRONG_PASSWORD = "wrong-pass-1234";
/** RFC 6238 の見本の鍵「12345678901234567890」の Base32（two-factor の試験・login-check-2fa の違う鍵） */
export const K354_RFC_KEY = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
// ---- K-354 ここまで ----

// ---- K-359（Bridge の Claude Code の自己診断と直し方の試験）----
/** 環境変数 ANTHROPIC_API_KEY に入れる作り物の値（鍵ではない） */
export const K359_FAKE_API_KEY = "k359-not-a-key";
// ---- K-359 ここまで ----

// ---- K-366（Bridge の窓で選び直す browser-choice の試験）----
/** 形は正しい作り物の PC の札（kpc_ と 43 字） */
export const K366_BRIDGE_TOKEN = "kpc_ccccccccccccccccccccccccccccccccccccccccccc";
// ---- K-366 ここまで ----
