// 登録・ログインの補助（T-U-01／05）。表記ゆらぎはサーバで直す（NFKC・前後の空白・小文字）。ロックは app.login_attempts（5 回で 15 分）
import { createHash } from "node:crypto";
import type pg from "pg";
import type { Auth } from "./index.js";

/** メールアドレスの正規化：全角→半角（NFKC）・前後と途中の空白を除く・小文字 */
export const normalizeEmail = (v: string): string => v.normalize("NFKC").replace(/\s+/g, "").trim().toLowerCase();
export const emailHash = (email: string): string => createHash("sha256").update(normalizeEmail(email)).digest("hex");
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export interface SignInResult {
  ok: boolean;
  token?: string | null;
  twoFactor?: boolean;
  cookie?: string;
  /** 失敗：残り回数（0 ならロック） */
  remaining?: number;
  lockedUntil?: Date | null;
}
/** メール＋パスワードでログイン。連続失敗は app.login_attempts で数え、5 回で 15 分ロック（E-AUTH-001／002） */
export async function signInWithLock(
  auth: Auth,
  appPool: pg.Pool,
  email: string,
  password: string,
  userAgent?: string,
): Promise<SignInResult> {
  const e = normalizeEmail(email);
  const h = emailHash(e);
  const locked = await appPool.query<{ until: Date | null }>("select app.login_locked_until($1) as until", [h]);
  if (locked.rows[0]?.until) return { ok: false, remaining: 0, lockedUntil: locked.rows[0].until };
  const headers = new Headers();
  if (userAgent) headers.set("user-agent", userAgent);
  try {
    const r = await auth.api.signInEmail({ headers, body: { email: e, password }, returnHeaders: true });
    const body = r.response as { token?: string | null; twoFactorRedirect?: boolean };
    await appPool.query("select app.login_ok($1)", [h]);
    const cookie = r.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    return {
      ok: true,
      token: body.twoFactorRedirect ? null : (body.token ?? null),
      twoFactor: !!body.twoFactorRedirect,
      cookie,
    };
  } catch {
    const f = await appPool.query<{ remaining: number; locked_until: Date | null }>(
      "select * from app.login_failed($1)",
      [h],
    );
    return { ok: false, remaining: f.rows[0]?.remaining ?? 0, lockedUntil: f.rows[0]?.locked_until ?? null };
  }
}

/** 登録：会社名があれば hook が会社を作る。メールは正規化してから */
export async function signUp(
  auth: Auth,
  input: { email: string; password: string; name: string; companyName?: string },
): Promise<{ token: string | null; userId: string }> {
  const r = await auth.api.signUpEmail({
    body: {
      email: normalizeEmail(input.email),
      password: input.password,
      name: input.name.normalize("NFKC").trim(),
      ...(input.companyName ? { company_name: input.companyName.normalize("NFKC").trim() } : {}),
    } as never,
  });
  const body = r as { token: string | null; user: { id: string } };
  return { token: body.token, userId: body.user.id };
}
