// 2 段階認証（TOTP）。有効化 → 確認、ログイン時のコード確認（契約の口 verifySignInCode・K-302）。
//   「この端末を信頼する」（30 日 6 けたを省く）は使わない（D-128.60：入るたびに 6 けた）
import { randomInt } from "node:crypto";
import type pg from "pg";
import { symmetricDecrypt } from "better-auth/crypto";
import { base32 } from "@better-auth/utils/base32";
import { createOTP } from "@better-auth/utils/otp";
import { uuidv7 } from "@kaname/db/id";
import { LOGIN_BLOCKED_CODES, type Auth } from "./index.js";
import { recordLoginEvent } from "./signup.js";

// plugin（twoFactor）の endpoint は core の Auth 型に無いので、使う分だけをここで型に書く（zod の内部型を .d.ts に出さないため）
interface TwoFactorApi {
  enableTwoFactor(o: {
    headers: Headers;
    body: { password: string };
  }): Promise<{ totpURI: string; backupCodes: string[] }>;
  verifyTOTP(o: {
    headers: Headers;
    body: { code: string };
    returnHeaders: true;
  }): Promise<{ headers: Headers; response: { token: string } }>;
  verifyBackupCode(o: {
    headers: Headers;
    body: { code: string };
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

/** 有効化の確認（アプリのコードを 1 回入れる）。ログイン時の確認にも同じ endpoint を使う。信頼する端末は付けない（D-128.60） */
export async function verifyTotp(
  auth: Auth,
  headers: Headers,
  code: string,
): Promise<{ token: string; headers: Headers }> {
  const r = await tf(auth).verifyTOTP({ headers, body: { code }, returnHeaders: true });
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

// ---- 確認のコードで入る（契約の口 verifySignInCode・K-302） ----

/** 6 けたかバックアップコードを続けて違えたら止める回数と長さ（D-128.141：5 回で 15 分） */
export const CODE_LOCK = { maxFailedAttempts: 5, durationSeconds: 900 } as const;
/** 同じ 30 秒の使い回しの守りで、通った番号を覚えておく長さ（秒）。前後 1 つずつの幅（90 秒）を覆う */
const USED_STEP_TTL_SEC = 90;
const TOTP_PERIOD_SEC = 30;
const BACKUP_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** バックアップコードを作る：小文字と数字だけ・10 個・xxxxx-xxxxx（代表の答え answer=6bdcb125e8f7）。部品の設定 backupCodeOptions から呼ぶ */
export function generateBackupCodes(): string[] {
  const one = () => Array.from({ length: 10 }, () => BACKUP_ALPHABET[randomInt(BACKUP_ALPHABET.length)]).join("");
  return Array.from({ length: 10 }, () => {
    const c = one();
    return `${c.slice(0, 5)}-${c.slice(5)}`;
  });
}

/** 6 けたの書きゆれをそろえる：全角（NFKC）・空白・ハイフンを除く */
export const normalizeTotpCode = (v: string): string => v.normalize("NFKC").replace(/[\s-]+/g, "");
/** バックアップコードの書きゆれをそろえる：全角（NFKC）・空白を除き、ハイフンが無ければ 5 文字目の後に入れ、英字は小文字 */
export function normalizeBackupCode(v: string): string {
  const c = v.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
  return !c.includes("-") && c.length === 10 ? `${c.slice(0, 5)}-${c.slice(5)}` : c;
}

export type SignInCodeOutcome =
  | { ok: true; token: string; userId: string; backupCodesLeft: number }
  /** 待ちの印が無い・切れた・使った・でたらめ（E-AUTH-013） */
  | { ok: false; reason: "expired" }
  /** コードが違う・使ったバックアップコード・同じ 30 秒の使い回し（E-AUTH-004） */
  | { ok: false; reason: "wrong"; userId: string }
  /** 6 けたの止め（E-AUTH-014）。retryAfterSec は止めの終わりまでの秒 */
  | { ok: false; reason: "locked"; userId: string; retryAfterSec: number }
  /** セッションを作る所で止めの 1 か所（K-303）に断られた。状態コードと code をそのまま答える */
  | { ok: false; reason: "refused"; status: number; code: string };

export interface SignInCodeInput {
  /** パスワードの段で受け取った待ちの印（部品の 2 段階の待ちの Cookie の値） */
  pending: string;
  /** 6 けた（そろえる前の値）。backupCode とどちらか 1 つ */
  code?: string;
  /** バックアップコード（そろえる前の値） */
  backupCode?: string;
  userAgent?: string;
  /** 国（x-vercel-ip-country）。記録に入れる。IP そのものは渡さない */
  country: string | null;
}

/** 部品の APIError の形（status は名前・statusCode は数・body.code）。部品の版で型が変わっても形で見る */
function apiError(e: unknown): { statusCode: number; code: string | null } | null {
  const x = e as { status?: unknown; statusCode?: unknown; body?: { code?: unknown } } | null;
  if (!x || typeof x !== "object" || typeof x.status !== "string") return null;
  return {
    statusCode: typeof x.statusCode === "number" ? x.statusCode : 0,
    code: typeof x.body?.code === "string" ? x.body.code : null,
  };
}
const PENDING_GONE = new Set(["INVALID_TWO_FACTOR_COOKIE", "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE"]);
const WRONG = new Set(["INVALID_CODE", "INVALID_BACKUP_CODE"]);

/** 待ちの印から、その待ちの行（kaname_auth.verification の 2fa-…）がまだ生きていれば本人の id を返す（期限は DB の now()）。
 *  待ちの印を使い終わりにしない。管理者に頼む口（K-305）も同じ引き方で本人を引く */
export async function pendingUser(authPool: pg.Pool, pending: string): Promise<string | null> {
  let v: string;
  try {
    v = decodeURIComponent(pending);
  } catch {
    return null;
  }
  const dot = v.lastIndexOf(".");
  const identifier = dot > 0 ? v.slice(0, dot) : "";
  if (!/^2fa-[A-Za-z0-9_-]+$/.test(identifier) || identifier.startsWith("2fa-attempts-")) return null;
  const r = await authPool.query<{ value: string }>(
    'select value from kaname_auth.verification where identifier = $1 and "expiresAt" > now() limit 1',
    [identifier],
  );
  return r.rows[0]?.value ?? null;
}

/** 部品の待ちの Cookie の名前（本番の https では __Secure- が頭に付く）。部品の文脈から引く */
async function pendingCookieName(auth: Auth): Promise<string> {
  const ctx = (await (auth as unknown as { $context: Promise<{ createAuthCookie: (n: string) => { name: string } }> })
    .$context) as { createAuthCookie: (n: string) => { name: string } };
  return ctx.createAuthCookie("two_factor").name;
}
async function secretConfig(auth: Auth): Promise<Parameters<typeof symmetricDecrypt>[0]["key"]> {
  const ctx = (await (auth as unknown as { $context: Promise<unknown> }).$context) as {
    secretConfig: Parameters<typeof symmetricDecrypt>[0]["key"];
  };
  return ctx.secretConfig;
}

/** その 6 けたが、今の 30 秒の前後 1 つずつのどの番号のコードか（どれでもなければ null）。鍵は部品の表から解く */
async function stepOfCode(auth: Auth, authPool: pg.Pool, userId: string, code: string): Promise<number | null> {
  const r = await authPool.query<{ secret: string }>('select secret from kaname_auth."twoFactor" where "userId" = $1', [
    userId,
  ]);
  if (!r.rows[0]) return null;
  const plain = await symmetricDecrypt({ key: await secretConfig(auth), data: r.rows[0].secret });
  // 外の道具から入れた鍵は base32: が頭に付く（部品の decryptTOTPSecret と同じ）
  const secret = plain.startsWith("base32:") ? base32.decode(plain.slice(7).toUpperCase()) : plain;
  const otp = createOTP(secret as string, { digits: 6, period: TOTP_PERIOD_SEC });
  const now = Math.floor(Date.now() / (TOTP_PERIOD_SEC * 1000));
  for (const step of [now - 1, now, now + 1]) if ((await otp.hotp(step)) === code) return step;
  return null;
}

const usedKey = (userId: string) => `totp-used-${userId}`;
/** 同じ 30 秒の使い回しの守り：前に通った番号と同じか前の番号のコードなら true */
async function stepUsed(authPool: pg.Pool, userId: string, step: number): Promise<boolean> {
  const r = await authPool.query<{ value: string }>(
    'select value from kaname_auth.verification where identifier = $1 and "expiresAt" > now()',
    [usedKey(userId)],
  );
  return r.rows.some((x) => Number(x.value) >= step);
}
/** 通った番号を覚える（本人ごとに 1 行・90 秒） */
async function rememberStep(authPool: pg.Pool, userId: string, step: number): Promise<void> {
  await authPool.query("delete from kaname_auth.verification where identifier = $1", [usedKey(userId)]);
  await authPool.query(
    `insert into kaname_auth.verification (id, identifier, value, "expiresAt")
     values ($1, $2, $3, now() + make_interval(secs => $4))`,
    [uuidv7(), usedKey(userId), String(step), USED_STEP_TTL_SEC],
  );
}

/** 6 けたの止めの状態（止まっていれば終わりまでの秒） */
async function lockLeft(authPool: pg.Pool, userId: string): Promise<number | null> {
  const r = await authPool.query<{ left: number | null }>(
    `select ceil(extract(epoch from ("lockedUntil" - now())))::int as left
       from kaname_auth."twoFactor" where "userId" = $1 and "lockedUntil" > now()`,
    [userId],
  );
  const left = r.rows[0]?.left;
  return left == null ? null : Math.min(CODE_LOCK.durationSeconds, Math.max(1, left));
}

/** 残りのバックアップコードの数（部品の表の暗号を解いて数える） */
async function backupCodesLeft(auth: Auth, authPool: pg.Pool, userId: string): Promise<number> {
  const r = await authPool.query<{ codes: string }>(
    'select "backupCodes" as codes from kaname_auth."twoFactor" where "userId" = $1',
    [userId],
  );
  if (!r.rows[0]) return 0;
  const list = JSON.parse(await symmetricDecrypt({ key: await secretConfig(auth), data: r.rows[0].codes })) as unknown;
  return Array.isArray(list) ? list.length : 0;
}

/** 確認のコードで入る：待ちの印 → 同じ 30 秒の使い回し → 部品の確かめ の順。
 *  6 けたで入った・違った・止めたを会社の security_events に残す（login_succeeded・login_code_failed・login_code_locked・app.record_login_event）。
 *  DB が落ちた・セッションを写す所の失敗は投げ直す（呼ぶ側が 500 にする。部品の側で半分だけ入ったセッションは消してある） */
export async function verifySignInCode(
  auth: Auth,
  appPool: pg.Pool,
  authPool: pg.Pool,
  input: SignInCodeInput,
): Promise<SignInCodeOutcome> {
  const userId = await pendingUser(authPool, input.pending);
  if (!userId) return { ok: false, reason: "expired" };
  const record = (kind: string) => recordLoginEvent(appPool, userId, kind, input.country);
  const totpCode = input.code === undefined ? null : normalizeTotpCode(input.code);
  let step: number | null = null;
  if (totpCode !== null) {
    step = await stepOfCode(auth, authPool, userId, totpCode);
    if (step !== null && (await stepUsed(authPool, userId, step))) {
      await record("login_code_failed");
      return { ok: false, reason: "wrong", userId };
    }
  }
  const headers = new Headers({ cookie: `${await pendingCookieName(auth)}=${input.pending}` });
  if (input.userAgent) headers.set("user-agent", input.userAgent);
  let token: string;
  try {
    const r =
      totpCode !== null
        ? await tf(auth).verifyTOTP({ headers, body: { code: totpCode }, returnHeaders: true })
        : await tf(auth).verifyBackupCode({
            headers,
            body: { code: normalizeBackupCode(input.backupCode ?? "") },
            returnHeaders: true,
          });
    token = r.response.token;
  } catch (e) {
    const x = apiError(e);
    if (!x) throw e;
    if (x.code && PENDING_GONE.has(x.code)) return { ok: false, reason: "expired" };
    if (x.code === "ACCOUNT_TEMPORARILY_LOCKED") {
      return { ok: false, reason: "locked", userId, retryAfterSec: (await lockLeft(authPool, userId)) ?? 1 };
    }
    if (x.code && WRONG.has(x.code)) {
      const left = await lockLeft(authPool, userId);
      if (left !== null) {
        await record("login_code_locked");
        return { ok: false, reason: "locked", userId, retryAfterSec: left };
      }
      await record("login_code_failed");
      return { ok: false, reason: "wrong", userId };
    }
    // セッションを作る所の止めの 1 か所（K-303 の session.create.before）の断り：人・会社の止め・抜けた（403）・止めの確かめが落ちた（503）。
    //   状態コードと code をそのまま答える（文は口が目録から引く）。セッションは作られておらず、6 けたの失敗の数にも入らない
    if (x.code && LOGIN_BLOCKED_CODES.has(x.code))
      return { ok: false, reason: "refused", status: x.statusCode || 503, code: x.code };
    throw e;
  }
  if (step !== null) await rememberStep(authPool, userId, step);
  await record("login_succeeded");
  return { ok: true, token, userId, backupCodesLeft: await backupCodesLeft(auth, authPool, userId) };
}
