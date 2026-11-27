// staging の住所と鍵（K-65）。環境の値の名前で受ける。値はどこにも出さない（投げる文には名前だけ）。
//   名前は staging-e2e.yml の統合テストの段が渡す物と同じ（K-204）。読むのはこの 1 か所（と、設定・伏せる台本）だけ。
//   DB の接続（STAGING_DATABASE_READ_URL）は読まない：確かめは画面・口の読み直し・Resend の記録だけでする（PM の決め 2）
function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`環境の値 ${name} が無い（staging-e2e.yml の統合テストの段が渡す。手元では流さない）`);
  return v;
}
function site(name: string): string {
  let u: URL;
  try {
    u = new URL(need(name));
  } catch {
    throw new Error(`環境の値 ${name} が住所の形でない`);
  }
  // 手元の開発のサーバー（http・127.0.0.1）には当てない。staging は https だけ
  if (u.protocol !== "https:") throw new Error(`環境の値 ${name} が https でない（手元のサーバーには当てない）`);
  return u.origin;
}

/** 画面の出どころ（https://…・末尾の / なし） */
export const WEB = site("STAGING_BASE_URL");
/** 口の出どころ */
export const API = site("STAGING_API_BASE");
/** Resend の送った記録を読む鍵（K-202） */
export const resendKey = (): string => need("STAGING_RESEND_READ_KEY");
/** staging の試験だけの運営の人のパスキー（K-1101 の秘密）。関数の中で読む（秘密が無い回でも K-65・K-999 は落ちない）。
 *   受けるのは道具 ops-steps.ts の addOpsPasskey だけ（CDP の WebAuthn.addCredential へ。画面・ページ・投げる文に出さない・K-1102） */
export const opsPasskey = (): { key: string; id: string; user: string } => ({
  key: need("STAGING_OPS_PASSKEY_KEY"),
  id: need("STAGING_OPS_PASSKEY_ID"),
  user: need("STAGING_OPS_PASSKEY_USER"),
});
