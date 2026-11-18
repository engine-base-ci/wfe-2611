// パスキーを足す・名前を変える・外す・パスキーで本人確認を取り直す（K-309・D-128.141・D-128.61）。
//   足す：部品（@better-auth/passkey）の登録の 2 つの口をそのまま使い、前と後に Kaname の決まりを足す（下の kanamePasskeyManage）:
//     確かめの前：名前（送られれば NFKC・前後の空白を除いて 1〜40 文字・制御文字なし。無ければ端末から「Mac（Chrome）」の形）
//     確かめの後・行を作る前：同じ認証器（credential id が同じ）がもう付いていれば 409・E-AUTH-018（部品の afterVerification・passkey.ts）
//     作った後：security_events に passkey_added（そのセッションの会社と人）、付けるまで進めない印を下ろす（app.settle_mfa_pending）
//   名前を変える・外すは契約の口（renamePasskey・deletePasskey）が呼ぶ。認証の表は認証の接続（kaname_auth）で触る（D-128.119）。
//   外すは部品の deletePasskey を使わず、認証の接続 1 本のトランザクションで「その人を押さえる → 数える → 消す」（同時に外して 0 本にしない）。
//   取り直し（代表の答え ① answer=9177d9dbe0d9）：部品の verify-authentication はセッションを作るので使わず、
//     同じ確かめ（チャレンジ・origin・rpID・署名・回数）だけをする内部の口（道は閉じる・サーバーの中から auth.api で呼ぶ）で確かめる。
// 境界 B2：部品を import してよいのはこのパッケージだけ（CI G7）。ログに公開鍵・credential id・チャレンジを出さない
import { verifyAuthenticationResponse, type AuthenticatorTransportFuture } from "@simplewebauthn/server";
import { APIError, createAuthEndpoint, createAuthMiddleware } from "better-auth/api";
import type { BetterAuthPlugin } from "better-auth";
import type pg from "pg";
import * as z from "zod";
import { deviceOf } from "./device.js";
import { PASSKEY_CHALLENGE_COOKIE } from "./passkey.js";

/** 名前の長さの上限（文字・D-128.141） */
export const PASSKEY_NAME_MAX = 40;
/** 同じ認証器をもう一度足した（errors.json） */
export const PASSKEY_DUPLICATE = "E-AUTH-018";
/** 外すと入り方が無くなる／パスワードだけで 2 段階が無くなる（errors.json） */
export const PASSKEY_LAST_METHOD = "E-AUTH-015";
export const PASSKEY_NEED_TWO_FACTOR = "E-AUTH-016";
/** パスキーで取り直す内部の口（道は閉じる：index.ts の disabledPaths。auth.api からだけ呼ぶ） */
export const PASSKEY_STEP_UP_PATH = "/kaname/passkey/step-up";
const VERIFY_REGISTRATION = "/passkey/verify-registration";
/** 制御文字（C0 と DEL）を含むか。見えない文字を名前に残さない */
const hasControl = (s: string): boolean =>
  [...s].some((ch) => {
    const c = ch.codePointAt(0) ?? 0;
    return c < 0x20 || c === 0x7f;
  });

/** 名前を決まりに合わせる（前後の空白を除き NFKC・1〜40 文字・制御文字なし）。合わなければ null */
export function normalizePasskeyName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.normalize("NFKC").trim();
  const len = [...name].length;
  if (len < 1 || len > PASSKEY_NAME_MAX || hasControl(name)) return null;
  return name;
}

const OS_LABEL: Record<string, string> = {
  macos: "Mac",
  windows: "Windows",
  linux: "Linux",
  android: "Android",
  chromeos: "ChromeOS",
};
const BROWSER_LABEL: Record<string, string> = {
  chrome: "Chrome",
  edge: "Edge",
  firefox: "Firefox",
  safari: "Safari",
};
/** 名前の既定：端末の種類から `<OS>（<ブラウザ>）`（例「Mac（Chrome）」「iPhone（Safari）」・K-318 の欄の既定と同じ） */
export function defaultPasskeyName(ua: string | null | undefined): string {
  const d = deviceOf(ua) ?? "other/other";
  const [browser = "other", os = "other"] = d.split("/");
  const osLabel = os === "ios" ? (/iPad/.test(ua ?? "") ? "iPad" : "iPhone") : (OS_LABEL[os] ?? "この端末");
  const browserLabel = BROWSER_LABEL[browser] ?? "ブラウザ";
  return `${osLabel}（${browserLabel}）`;
}

/** 422 の答え（契約の入口と同じ形・欄 name） */
const nameRejected = () =>
  new APIError("UNPROCESSABLE_ENTITY", {
    error: "validation_failed",
    code: "VALIDATION_ERROR",
    message: "名前は 1〜40 文字で、改行などの見えない文字は使えません",
    details: [{ field: "name", message: "1〜40 文字・制御文字なし" }],
  });

export interface PasskeyManageOptions {
  /** 画面の URL（rpID と origin の元・passkey.ts と同じ） */
  webBaseURL: string;
  /** 認証の表（kaname_auth）を読む接続 */
  authPool: pg.Pool;
  /** 記録と印の関数（app.*）を呼ぶ接続（kaname_app） */
  appPool: pg.Pool;
}

/** 例外の種類だけ（DB の番号か名前）。文や値はログに出さない */
const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};

/** 同じ認証器（credential id）が、もうどれかの人に付いているか。部品の afterVerification（passkey.ts）から呼ぶ */
export async function passkeyExists(authPool: pg.Pool, credentialId: string): Promise<boolean> {
  const r = await authPool.query('select 1 from kaname_auth.passkey where "credentialID" = $1 limit 1', [credentialId]);
  return (r.rowCount ?? 0) > 0;
}
/** 同じ認証器を足そうとした（409・E-AUTH-018） */
export const duplicatePasskey = () =>
  new APIError("CONFLICT", { code: PASSKEY_DUPLICATE, message: "このパスキーは、もうこの端末に付いています" });

/** 登録の確かめの前（名前）と後（記録・印）、パスキーでの取り直しの内部の口。createAuth の plugins に足す */
export function kanamePasskeyManage(o: PasskeyManageOptions): BetterAuthPlugin {
  const web = new URL(o.webBaseURL);
  return {
    id: "kaname-passkey-manage",
    endpoints: {
      kanamePasskeyStepUp: createAuthEndpoint(
        PASSKEY_STEP_UP_PATH,
        {
          method: "POST",
          body: z.object({ userId: z.string().min(1), response: z.record(z.string(), z.any()) }),
          metadata: { SERVER_ONLY: true },
        },
        async (ctx) => {
          const ok = await verifyStepUp(ctx, o.authPool, web, ctx.body.userId, ctx.body.response);
          return ctx.json({ ok });
        },
      ),
    },
    hooks: {
      before: [
        {
          // 名前：送られれば決まりに合わせ、合わなければ 422（行を作らない）。無ければ端末から既定を付ける
          matcher: (ctx) => ctx.path === VERIFY_REGISTRATION,
          handler: createAuthMiddleware(async (ctx) => {
            const body = (ctx.body ?? {}) as Record<string, unknown>;
            const sent = body["name"];
            let name: string;
            if (sent === undefined || sent === null) name = defaultPasskeyName(ctx.headers?.get("user-agent"));
            else {
              const n = normalizePasskeyName(sent);
              if (n === null) throw nameRejected();
              name = n;
            }
            return { context: { body: { ...body, name } } };
          }),
        },
      ],
      after: [
        {
          // 足せたら：その画面のセッションの会社と人に passkey_added を 1 行、付けるまで進めない印を下ろす。
          //   どちらも書けなくてもパスキーは付いている（答えは変えない）。種類だけをログに出す
          matcher: (ctx) => ctx.path === VERIFY_REGISTRATION,
          handler: createAuthMiddleware(async (ctx) => {
            const returned = ctx.context.returned as { id?: unknown; userId?: unknown } | undefined;
            if (!returned || returned instanceof Error || typeof returned.userId !== "string") return;
            const sessionId = (ctx.context.session as { session?: { id?: string } } | null)?.session?.id;
            try {
              if (sessionId)
                await o.appPool.query(
                  "select app.record_security_event(x.tenant_id, 'passkey_added', x.member_id, null, '{}'::jsonb) from app.session_alive($1) x",
                  [sessionId],
                );
              await o.appPool.query("select app.settle_mfa_pending($1)", [returned.userId]);
            } catch (e) {
              console.error(`[auth] パスキーを足した後の記録か印を書けなかった（${kindOf(e)}）`);
            }
          }),
        },
      ],
    },
  };
}

interface StoredKey {
  userId: string;
  counter: number;
  publicKey: string;
  credentialID: string;
  transports: string | null;
}

/** パスキーでの取り直しの確かめ：チャレンジ（ログイン中に作った authentication の 1 回だけのもの・この人の分）・
 *  応答の credential がこの人のパスキー・origin と rpID・署名と回数。通れば回数を進めて true。どれか違えば false（セッションは作らない） */
async function verifyStepUp(
  ctx: {
    getSignedCookie: (name: string, secret: string) => Promise<string | null | false>;
    context: {
      secret: string;
      createAuthCookie: (n: string) => { name: string };
      internalAdapter: {
        consumeVerificationValue: (id: string) => Promise<{ value: string; expiresAt: Date } | null | undefined>;
      };
    };
  },
  authPool: pg.Pool,
  web: URL,
  userId: string,
  response: Record<string, unknown>,
): Promise<boolean> {
  const token = await ctx.getSignedCookie(
    ctx.context.createAuthCookie(PASSKEY_CHALLENGE_COOKIE).name,
    ctx.context.secret,
  );
  if (!token) return false;
  const v = await ctx.context.internalAdapter.consumeVerificationValue(token);
  if (!v || new Date(v.expiresAt) < new Date()) return false;
  let parsed: { type?: string; expectedChallenge?: string; userData?: { id?: string } };
  try {
    parsed = JSON.parse(v.value) as typeof parsed;
  } catch {
    return false;
  }
  if (parsed.type !== "authentication" || !parsed.expectedChallenge || parsed.userData?.id !== userId) return false;
  if (typeof response["id"] !== "string") return false;
  const row = (
    await authPool.query<StoredKey>(
      'select "userId", counter, "publicKey", "credentialID", transports from kaname_auth.passkey where "credentialID" = $1',
      [response["id"]],
    )
  ).rows[0];
  if (!row || row.userId !== userId) return false;
  const r = await verifyAuthenticationResponse({
    response: response as unknown as Parameters<typeof verifyAuthenticationResponse>[0]["response"],
    expectedChallenge: parsed.expectedChallenge,
    expectedOrigin: web.origin,
    expectedRPID: web.hostname,
    credential: {
      id: row.credentialID,
      publicKey: new Uint8Array(Buffer.from(row.publicKey, "base64")),
      counter: Number(row.counter),
      ...(row.transports ? { transports: row.transports.split(",") as AuthenticatorTransportFuture[] } : {}),
    },
    requireUserVerification: false,
  }).catch(() => null);
  if (!r?.verified) return false;
  await authPool.query('update kaname_auth.passkey set counter = $2 where "credentialID" = $1', [
    row.credentialID,
    r.authenticationInfo.newCounter,
  ]);
  return true;
}

/** パスキーの頭のチャレンジの値の形（URL 符号化した署名つきの値。; や改行で別の Cookie を差し込ませない・passkey-challenge.ts と同じ） */
const TOKEN_SHAPE = /^[A-Za-z0-9%._~+/=-]{1,512}$/;
type StepUpApi = {
  kanamePasskeyStepUp: (x: {
    body: { userId: string; response: unknown };
    headers: Headers;
  }) => Promise<{ ok: boolean }>;
};
type AuthLike = { api: unknown; $context: Promise<{ createAuthCookie: (n: string) => { name: string } }> };

/** パスキーで本人確認を取り直す（取り直しの口 stepUp から呼ぶ）。challengeToken は始めの口の答えの challenge_token（頭 x-passkey-challenge）。
 *  通れば true。チャレンジが無い・形が違う・期限切れ・他人のパスキー・署名が違えば false（例外は投げない） */
export async function verifyPasskeyStepUp(
  auth: AuthLike,
  p: { userId: string; response: unknown; challengeToken: string | null },
): Promise<boolean> {
  if (!p.challengeToken || !TOKEN_SHAPE.test(p.challengeToken)) return false;
  if (!p.response || typeof p.response !== "object" || Array.isArray(p.response)) return false;
  const name = (await auth.$context).createAuthCookie(PASSKEY_CHALLENGE_COOKIE).name;
  const headers = new Headers({ cookie: `${name}=${p.challengeToken}` });
  try {
    const r = await (auth.api as StepUpApi).kanamePasskeyStepUp({
      body: { userId: p.userId, response: p.response },
      headers,
    });
    return r.ok === true;
  } catch (e) {
    console.error(`[auth] パスキーの取り直しを確かめられなかった（${kindOf(e)}）`);
    return false;
  }
}

/** 名前を変える（本人の行だけ）。無い・他人の行なら null（有ることも漏らさない） */
export async function renamePasskeyOf(
  authPool: pg.Pool,
  userId: string,
  id: string,
  name: string,
): Promise<{ id: string; name: string } | null> {
  const r = await authPool.query<{ id: string; name: string }>(
    'update kaname_auth.passkey set name = $3 where id = $1 and "userId" = $2 returning id, name',
    [id, userId, name],
  );
  return r.rows[0] ?? null;
}

export type RemovePasskeyResult = "removed" | "not_found" | "last_method" | "need_two_factor";
/** 外す（本人の行だけ）。認証の接続 1 本のトランザクションで、その人を押さえてから数え、最後の入り方なら外さない（D-128.61）:
 *  外すとパスキーが 0 本で、パスワードも 2 段階も無い → last_method（E-AUTH-015）／パスワードはあるが 2 段階が無い → need_two_factor（E-AUTH-016） */
export async function removePasskeyOf(authPool: pg.Pool, userId: string, id: string): Promise<RemovePasskeyResult> {
  const c = await authPool.connect();
  try {
    await c.query("begin");
    const u = await c.query<{ two_factor: boolean | null }>(
      'select "twoFactorEnabled" as two_factor from kaname_auth."user" where id = $1 for update',
      [userId],
    );
    if (!u.rows[0]) {
      await c.query("rollback");
      return "not_found";
    }
    const mine = await c.query('select 1 from kaname_auth.passkey where id = $1 and "userId" = $2', [id, userId]);
    if (!mine.rowCount) {
      await c.query("rollback");
      return "not_found";
    }
    const n = await c.query<{ passkeys: number; has_password: boolean }>(
      `select (select count(*)::int from kaname_auth.passkey where "userId" = $1) as passkeys,
              exists (select 1 from kaname_auth.account where "userId" = $1 and "providerId" = 'credential'
                        and coalesce(password, '') <> '') as has_password`,
      [userId],
    );
    const m = n.rows[0]!;
    if (m.passkeys <= 1 && u.rows[0].two_factor !== true) {
      await c.query("rollback");
      return m.has_password ? "need_two_factor" : "last_method";
    }
    await c.query('delete from kaname_auth.passkey where id = $1 and "userId" = $2', [id, userId]);
    await c.query("commit");
    return "removed";
  } catch (e) {
    await c.query("rollback").catch(() => undefined);
    throw e;
  } finally {
    c.release();
  }
}
