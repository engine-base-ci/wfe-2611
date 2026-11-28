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
  // 2 段階を付ける確認（ログイン中）では、部品が新しいセッションを作って前のセッションを消すのに、答えの token は前の物を返す（better-auth 1.7.15）。
  //   新しいセッションの印（set-auth-token・署名つき）があれば、その印の本体を返す（ログインの確認でも同じ値・K-308）
  const fresh = r.headers.get("set-auth-token")?.split(".")[0];
  return { token: fresh || r.response.token, headers: r.headers };
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
/** 番号を取る前にあった覚えの行（戻すときに元に戻す） */
interface StepClaim {
  step: number;
  prev: { value: string; expiresAt: Date } | null;
}
/** 本人ごとの覚えの行を、錠（advisory lock）を張った 1 つの取引の中で読み書きする。同じ人の要求はここで 1 本ずつになる */
async function underStepLock<T>(authPool: pg.Pool, userId: string, fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await authPool.connect();
  try {
    await c.query("begin");
    await c.query("select pg_advisory_xact_lock(hashtext($1))", [usedKey(userId)]);
    const out = await fn(c);
    await c.query("commit");
    return out;
  } catch (e) {
    await c.query("rollback").catch(() => undefined); // 元の例外を投げ直す（取引を閉じるだけ）
    throw e;
  } finally {
    c.release();
  }
}
/** 同じ 30 秒の使い回しの守り：部品を呼ぶ前に、通す番号を本人ごとに先に取る（K-322）。
 *  前に取った番号と同じか後の番号なら null（使い回し）。取れたら前の行を控えて返す（断られたら releaseStep で戻す） */
async function claimStep(authPool: pg.Pool, userId: string, step: number): Promise<StepClaim | null> {
  return underStepLock(authPool, userId, async (c) => {
    const r = await c.query<{ value: string; expiresAt: Date }>(
      'select value, "expiresAt" from kaname_auth.verification where identifier = $1 and "expiresAt" > now()',
      [usedKey(userId)],
    );
    if (r.rows.some((x) => Number(x.value) >= step)) return null;
    const prev = r.rows[0] ? { value: r.rows[0].value, expiresAt: r.rows[0].expiresAt } : null;
    await c.query("delete from kaname_auth.verification where identifier = $1", [usedKey(userId)]);
    await c.query(
      `insert into kaname_auth.verification (id, identifier, value, "expiresAt")
       values ($1, $2, $3, now() + make_interval(secs => $4))`,
      [uuidv7(), usedKey(userId), String(step), USED_STEP_TTL_SEC],
    );
    return { step, prev };
  });
}
/** 取った番号を戻す（入れなかったコードは使ったことにしない）。自分の番号の行だけを消し、控えた前の行がまだ期限内なら戻す */
async function releaseStep(authPool: pg.Pool, userId: string, claim: StepClaim): Promise<void> {
  await underStepLock(authPool, userId, async (c) => {
    const d = await c.query("delete from kaname_auth.verification where identifier = $1 and value = $2", [
      usedKey(userId),
      String(claim.step),
    ]);
    if ((d.rowCount ?? 0) > 0 && claim.prev && claim.prev.expiresAt.getTime() > Date.now())
      await c.query(
        `insert into kaname_auth.verification (id, identifier, value, "expiresAt") values ($1, $2, $3, $4)`,
        [uuidv7(), usedKey(userId), claim.prev.value, claim.prev.expiresAt],
      );
  });
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

/** 確認のコードで入る：待ちの印 → 同じ 30 秒の使い回し（番号を先に取る）→ 部品の確かめ の順（K-302・K-322）。
 *  6 けたで入った・違った・止めたを会社の security_events に残す（login_succeeded・login_code_failed・login_code_locked・app.record_login_event。
 *  記録が書けなくてもログインは止めない）。番号を取った後に部品が断った・落ちたら、取った番号を戻す。
 *  部品が通った後の後処理（残りの数）が落ちたら、その場でサインアウトし、取った番号を戻してから投げ直す（呼ぶ側が 500 にする。生きたセッションを残さない） */
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
  let claim: StepClaim | null = null;
  if (totpCode !== null) {
    const step = await stepOfCode(auth, authPool, userId, totpCode);
    if (step !== null) {
      claim = await claimStep(authPool, userId, step);
      if (!claim) {
        await record("login_code_failed");
        return { ok: false, reason: "wrong", userId };
      }
    }
  }
  // 取った番号を戻す。戻すのが落ちても元の答えは変えない（種類だけを出す。番号は 90 秒で切れる）
  const release = async () => {
    if (!claim) return;
    try {
      await releaseStep(authPool, userId, claim);
    } catch (e) {
      console.error(`[auth] 確認のコードの番号を戻せなかった（${errKind(e)}）`);
    }
  };
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
    await release();
    return refusal(e, authPool, userId, record);
  }
  await record("login_succeeded");
  try {
    return { ok: true, token, userId, backupCodesLeft: await backupCodesLeft(auth, authPool, userId) };
  } catch (e) {
    // 閉じ切れたときだけ番号を戻す（生きたセッションが残ったまま同じコードをもう一度通さない）
    if (await closeHalfOpen(auth, appPool, token, input.userAgent)) await release();
    throw e;
  }
}

/** 部品の断りを答えに振り分ける。知らない例外は投げ直す（呼ぶ側が 500 にする） */
async function refusal(
  e: unknown,
  authPool: pg.Pool,
  userId: string,
  record: (kind: string) => Promise<void>,
): Promise<SignInCodeOutcome> {
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

/** 例外の種類だけ（DB の番号か名前）。文や値はログに出さない */
function errKind(e: unknown): string {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
}

/** 部品が通った後に落ちた：作られたセッションをその場で閉じる。sessions の行と認証側のセッションを別々に閉じ、
 *  片方が落ちてももう片方は閉じる（DB が不調で sessions の行を閉じられなくても、認証側を消せば印は解けない）。
 *  全部閉じ切れたら true。落ちた段は種類だけを出す（呼ぶ側は元の例外で 500 にする。印・コードは出さない） */
async function closeHalfOpen(
  auth: Auth,
  appPool: pg.Pool,
  token: string,
  userAgent: string | undefined,
): Promise<boolean> {
  const h = new Headers({ authorization: `Bearer ${token}` });
  if (userAgent) h.set("user-agent", userAgent);
  let closed = true;
  const step = async (what: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      closed = false;
      console.error(`[auth] 確認のコードで入った後に落ち、${what}を閉じられなかった（${errKind(e)}）`);
    }
  };
  let sessionId: string | null = null;
  await step("セッションの読み取り", async () => {
    sessionId = (await auth.api.getSession({ headers: h }))?.session.id ?? null;
  });
  if (sessionId)
    await step("画面のセッション", () => appPool.query("select app.close_session($1, 'logout')", [sessionId]));
  await step("認証側のセッション", () => auth.api.signOut({ headers: h }));
  return closed;
}

// ---- 2 段階を付ける（契約の口 startTwoFactor・confirmTwoFactor・K-311） ----

export type StartTotpOutcome =
  /** 始めた（まだ付いていない）。secret は認証アプリに手で入れる鍵の文字（URI の secret と同じ・この 1 回だけ渡す） */
  | { ok: true; otpauthUri: string; secret: string }
  /** もう付いている（鍵は変えない・E-AUTH-017） */
  | { ok: false; reason: "already" }
  /** パスワードが違う（鍵を作らない） */
  | { ok: false; reason: "wrong_password" }
  /** 同じ人の付ける操作がほかで走っている */
  | { ok: false; reason: "busy" };

export type ConfirmTotpOutcome =
  /** 付いた。backupCodes は区切りの無い小文字と数字の 10 文字（この 1 回だけ渡す）。token は作り直したセッションの印（無ければ null） */
  | { ok: true; backupCodes: string[]; token: string | null }
  /** 始めていない（E-AUTH の外・409 CONFLICT） */
  | { ok: false; reason: "not_started" }
  /** もう付いている（コードは返さない・E-AUTH-017） */
  | { ok: false; reason: "already" }
  /** 6 けたの数字でない（そろえた後） */
  | { ok: false; reason: "format" }
  /** コードが違う（E-AUTH-004） */
  | { ok: false; reason: "wrong" }
  /** バックアップコードを引けない（付けない・503） */
  | { ok: false; reason: "codes_unavailable" }
  /** 同じ人の付ける操作がほかで走っている（2 回同時に送った後の 1 本） */
  | { ok: false; reason: "busy" };

const setupKey = (userId: string) => `totp-setup-${userId}`;
/** 付ける操作の札の長さ（秒）。途中で落ちて札が残っても、この長さで切れる */
const SETUP_CLAIM_TTL_SEC = 120;

/** 同じ人の「付ける」操作を 1 本ずつにする：札（kaname_auth.verification の totp-setup-<人>）を短い取引の中で取る（取れなければ false・待たない）。
 *  錠は札を取る取引の中だけで持ち、付ける操作の間は接続を持たない（中で部品が同じ接続の束を使っても待ちで詰まらない・G-16） */
async function claimSetup(authPool: pg.Pool, userId: string): Promise<boolean> {
  const c = await authPool.connect();
  try {
    await c.query("begin");
    await c.query("select pg_advisory_xact_lock(hashtext($1))", [setupKey(userId)]);
    const r = await c.query('select 1 from kaname_auth.verification where identifier = $1 and "expiresAt" > now()', [
      setupKey(userId),
    ]);
    if ((r.rowCount ?? 0) > 0) {
      await c.query("rollback");
      return false;
    }
    await c.query("delete from kaname_auth.verification where identifier = $1", [setupKey(userId)]);
    await c.query(
      `insert into kaname_auth.verification (id, identifier, value, "expiresAt")
       values ($1, $2, $3, now() + make_interval(secs => $4))`,
      [uuidv7(), setupKey(userId), userId, SETUP_CLAIM_TTL_SEC],
    );
    await c.query("commit");
    return true;
  } catch (e) {
    await c.query("rollback").catch(() => undefined); // 元の例外を投げ直す（取引を閉じるだけ）
    throw e;
  } finally {
    c.release();
  }
}

/** 札を取ってから fn を流し、終わったら札を返す（取れなければ null）。札を返すのが落ちても答えは変えない（札は長さで切れる） */
async function underSetupLock<T>(authPool: pg.Pool, userId: string, fn: () => Promise<T>): Promise<T | null> {
  if (!(await claimSetup(authPool, userId))) return null;
  try {
    return await fn();
  } finally {
    await authPool
      .query("delete from kaname_auth.verification where identifier = $1", [setupKey(userId)])
      .catch((e: unknown) => console.error(`[auth] 2 段階を付ける操作の札を返せなかった（${errKind(e)}）`));
  }
}

/** 部品の表の状態：無い・途中（確かめていない）・付いている */
async function setupState(authPool: pg.Pool, userId: string): Promise<"none" | "pending" | "enabled"> {
  const r = await authPool.query<{ on: boolean | null; verified: boolean | null; has_row: boolean }>(
    `select u."twoFactorEnabled" as on, t.verified, t.id is not null as has_row
       from kaname_auth."user" u left join kaname_auth."twoFactor" t on t."userId" = u.id
      where u.id = $1`,
    [userId],
  );
  const x = r.rows[0];
  if (x?.on === true || x?.verified === true) return "enabled";
  return x?.has_row ? "pending" : "none";
}

/** 2 段階を始める：パスワードを確かめて鍵を作る（まだ付かない）。確かめていない途中なら前の鍵を捨てて新しい鍵にする */
export async function startTotpSetup(
  auth: Auth,
  authPool: pg.Pool,
  headers: Headers,
  userId: string,
  password: string,
): Promise<StartTotpOutcome> {
  const out = await underSetupLock(authPool, userId, async (): Promise<StartTotpOutcome> => {
    if ((await setupState(authPool, userId)) === "enabled") return { ok: false, reason: "already" };
    let uri: string;
    try {
      uri = (await enableTotp(auth, headers, password)).totpURI; // 部品が作ったバックアップコードは確かめの後に引く（ここでは渡さない）
    } catch (e) {
      const x = apiError(e);
      if (x?.code === "INVALID_PASSWORD") return { ok: false, reason: "wrong_password" };
      if (x?.code === "TOTP_ALREADY_ENABLED") return { ok: false, reason: "already" };
      throw e;
    }
    const secret = new URL(uri).searchParams.get("secret") ?? "";
    return { ok: true, otpauthUri: uri, secret };
  });
  return out ?? { ok: false, reason: "busy" };
}

/** バックアップコードを見せる形にする：部品の形（xxxxx-xxxxx）から区切りを除く（代表の答え ⑭・入れる側は K-302 の normalizeBackupCode が区切りを戻す） */
const showBackupCode = (c: string): string => c.replace(/-/g, "");

/** 2 段階を確かめて付ける。先にバックアップコードを引き（引けなければ付けない）、部品で 6 けたを確かめる。
 *  部品は付けるときにセッションを作り直す：新しい印を返し、新しいセッションのログインの時刻は前のセッションのまま引き継ぐ
 *  （付けた操作でログインから 15 分の枠を新しくしない）。写し（public.sessions）の始まりの時刻の引き継ぎと前の写しを閉じるのは呼ぶ側 */
export async function confirmTotpSetup(
  auth: Auth,
  authPool: pg.Pool,
  headers: Headers,
  userId: string,
  rawCode: string,
): Promise<ConfirmTotpOutcome & { replacedSessionId?: string; newSessionId?: string }> {
  const out = await underSetupLock(
    authPool,
    userId,
    async (): Promise<ConfirmTotpOutcome & { replacedSessionId?: string; newSessionId?: string }> => {
      const state = await setupState(authPool, userId);
      if (state === "enabled") return { ok: false, reason: "already" };
      if (state === "none") return { ok: false, reason: "not_started" };
      const code = normalizeTotpCode(rawCode);
      if (!/^[0-9]{6}$/.test(code)) return { ok: false, reason: "format" };
      let codes: string[];
      try {
        const api = auth.api as unknown as {
          viewBackupCodes: (x: { body: { userId: string } }) => Promise<{ backupCodes?: unknown }>;
        };
        const r = await api.viewBackupCodes({ body: { userId } });
        if (!Array.isArray(r.backupCodes) || r.backupCodes.length === 0) throw new Error("NO_BACKUP_CODES");
        codes = r.backupCodes.map((c) => showBackupCode(String(c)));
      } catch (e) {
        console.error(`[auth] 2 段階を付ける前にバックアップコードを引けなかった（${errKind(e)}）`); // 種類だけ
        return { ok: false, reason: "codes_unavailable" };
      }
      const before = await auth.api.getSession({ headers });
      if (!before) return { ok: false, reason: "not_started" };
      let token: string;
      try {
        token = (await verifyTotp(auth, headers, code)).token;
      } catch (e) {
        const x = apiError(e);
        if (x?.code === "INVALID_CODE") return { ok: false, reason: "wrong" };
        if (x?.code === "TOTP_NOT_ENABLED") return { ok: false, reason: "not_started" };
        throw e;
      }
      const replaced = token !== before.session.token;
      // ここから先は付いた後。ログインの時刻の引き継ぎが落ちても、付いた事実とコードと新しい印は返す（コードを二度と返せなくしない）
      let newSessionId: string | undefined;
      if (replaced)
        newSessionId = await authPool
          .query<{ id: string }>(`update kaname_auth.session set "createdAt" = $2 where token = $1 returning id`, [
            token,
            before.session.createdAt,
          ])
          .then((r) => r.rows[0]?.id)
          .catch((e: unknown) => {
            console.error(`[auth] 2 段階を付けた後にログインの時刻を引き継げなかった（${errKind(e)}）`);
            return undefined;
          });
      return {
        ok: true,
        backupCodes: codes,
        token: replaced ? token : null,
        ...(replaced ? { replacedSessionId: before.session.id } : {}),
        ...(newSessionId ? { newSessionId } : {}),
      };
    },
  );
  return out ?? { ok: false, reason: "busy" };
}
