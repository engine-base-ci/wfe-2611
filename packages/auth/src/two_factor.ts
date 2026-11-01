// 2 段階認証（TOTP）。有効化 → 確認、ログイン時のコード確認、信頼する端末。
import type { Auth } from "./index.js";

// plugin（twoFactor）の endpoint は core の Auth 型に無いので、使う分だけをここで型に書く（zod の内部型を .d.ts に出さないため）
interface TwoFactorApi {
  enableTwoFactor(o: {
    headers: Headers;
    body: { password: string };
  }): Promise<{ totpURI: string; backupCodes: string[] }>;
  verifyTOTP(o: {
    headers: Headers;
    body: { code: string; trustDevice?: boolean };
    returnHeaders: true;
  }): Promise<{ headers: Headers; response: { token: string } }>;
  disableTwoFactor(o: { headers: Headers; body: { password: string } }): Promise<unknown>;
}
const tf = (auth: Auth) => auth.api as unknown as TwoFactorApi;

export async function enableTotp(
  auth: Auth,
  headers: Headers,
  password: string,
): Promise<{ totpURI: string; backupCodes: string[] }> {
  const r = await tf(auth).enableTwoFactor({ headers, body: { password } });
  return { totpURI: r.totpURI, backupCodes: r.backupCodes };
}

/** 有効化の確認（アプリのコードを 1 回入れる）。ログイン時の確認にも同じ endpoint を使う */
export async function verifyTotp(
  auth: Auth,
  headers: Headers,
  code: string,
  trustDevice = false,
): Promise<{ token: string; headers: Headers }> {
  const r = await tf(auth).verifyTOTP({ headers, body: { code, trustDevice }, returnHeaders: true });
  return { token: r.response.token, headers: r.headers };
}

export async function disableTotp(auth: Auth, headers: Headers, password: string): Promise<void> {
  await tf(auth).disableTwoFactor({ headers, body: { password } });
}

/** メール＋パスワードでログイン。2 段階が有効なら token は無く、pending の cookie を返す（次に verifyTotp） */
export async function signIn(
  auth: Auth,
  email: string,
  password: string,
  userAgent?: string,
): Promise<{ token: string | null; twoFactor: boolean; cookie: string }> {
  const h = new Headers();
  if (userAgent) h.set("user-agent", userAgent);
  const r = await auth.api.signInEmail({ headers: h, body: { email, password }, returnHeaders: true });
  const body = r.response as { token?: string | null; twoFactorRedirect?: boolean };
  const cookie = r.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  return { token: body.twoFactorRedirect ? null : (body.token ?? null), twoFactor: !!body.twoFactorRedirect, cookie };
}
