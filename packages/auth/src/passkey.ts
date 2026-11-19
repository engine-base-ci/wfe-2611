// パスキーで入る（K-304・D-125.137・D-128.59）。暗号の中身は Better Auth のパスキーの部品（中で @simplewebauthn/server）に任せ、
//   Kaname は 次の 3 つだけを足す（チャレンジを JSON と頭で受け渡す所は apps/api/src/auth/passkey-challenge.ts）:
//   1. rpID と origin を画面の URL（webBaseURL）から決める（画面は別の origin。API の URL ではない）
//   2. Kaname の決まり（最後の入り方は外せない・本人確認の取り直し）を通らない部品の口を閉じる（PASSKEY_DISABLED_PATHS）
//   3. 署名の回数が戻った応答（写されたパスキーの疑い）を部品に渡す前に断り、本人の会社に記録を残す（関門 C2）。
//      記録は「チャレンジ・origin・rpID・署名が正しく、回数だけが戻っている」ときだけ（作り物の応答で記録を積ませない・二度送りを写しにしない）
// 境界 B2：@better-auth/passkey を import してよいのはこのパッケージだけ（CI G7）。
import { passkey } from "@better-auth/passkey";
import { verifyAuthenticationResponse, type AuthenticatorTransportFuture } from "@simplewebauthn/server";
import { APIError, createAuthMiddleware } from "better-auth/api";
import type { BetterAuthPlugin } from "better-auth";
import type pg from "pg";
import { countryOf } from "./device.js";
import { duplicatePasskey, passkeyExists } from "./passkeys.js";

/** 部品の既定のチャレンジの Cookie の名前（接頭辞の前）。実際の名前は createAuthCookie で引く（passkey-challenge.ts） */
export const PASSKEY_CHALLENGE_COOKIE = "better-auth-passkey";
/** 閉じる部品の道：一覧・名前・外すは契約の口（K-308 の getMySecurity・K-309 の renamePasskey／deletePasskey）で作る。
 *  付ける 2 つの口（generate-register-options・verify-registration）は K-309 で開けた。始めの口の前で本人確認の取り直し
 *  （直前 15 分か、ログインから 15 分の内・D-128.141）を API の入口（apps/api/src/app.ts）が確かめる */
export const PASSKEY_DISABLED_PATHS = [
  "/passkey/delete-passkey",
  "/passkey/update-passkey",
  "/passkey/list-user-passkeys",
] as const;
const VERIFY_AUTHENTICATION = "/passkey/verify-authentication";
/** 写されたパスキーの疑いの記録の種類（security_events.kind_id） */
export const PASSKEY_COUNTER_ROLLBACK = "passkey_counter_rollback";
/** authenticatorData の署名の回数の場所（rpIdHash 32 バイト・フラグ 1 バイトの後ろの 4 バイト・WebAuthn §6.1） */
const COUNTER_OFFSET = 33;

export interface PasskeyOptions {
  /** 画面の URL（rpID と origin の元） */
  webBaseURL: string;
  /** 認証の表（kaname_auth）を読む接続 */
  authPool: pg.Pool;
  /** 記録の関数（app.record_login_event）を呼ぶ接続（kaname_app） */
  appPool: pg.Pool;
}

/** 応答の authenticatorData（base64url）から署名の回数を読む。読めなければ null（部品が断る） */
export function signCountOf(authenticatorData: unknown): number | null {
  if (typeof authenticatorData !== "string") return null;
  const b = Buffer.from(authenticatorData, "base64url");
  return b.length >= COUNTER_OFFSET + 4 ? b.readUInt32BE(COUNTER_OFFSET) : null;
}

/** 戻りか：保存か応答のどちらかが 0 でなく、応答 ≤ 保存（@simplewebauthn が断る条件と同じ。同じ回数も写しの疑い） */
export const isCounterRollback = (stored: number, received: number): boolean =>
  (stored > 0 || received > 0) && received <= stored;

interface StoredPasskey {
  userId: string;
  counter: number;
  publicKey: string;
  credentialID: string;
  transports: string | null;
}
interface AuthResponse {
  id?: unknown;
  response?: { authenticatorData?: unknown };
}

/** 部品（パスキー）と、その前で署名の回数を見る見張りの 2 つを返す。createAuth の plugins に足す */
export function kanamePasskey(o: PasskeyOptions): BetterAuthPlugin[] {
  const web = new URL(o.webBaseURL);
  const guard: BetterAuthPlugin = {
    id: "kaname-passkey-counter",
    hooks: {
      before: [
        {
          matcher: (ctx) => ctx.path === VERIFY_AUTHENTICATION,
          handler: createAuthMiddleware(async (ctx) => {
            const resp = (ctx.body as { response?: AuthResponse } | undefined)?.response;
            const received = signCountOf(resp?.response?.authenticatorData);
            if (typeof resp?.id !== "string" || received === null) return; // 形の違う応答は部品が断る
            const row = (
              await o.authPool.query<StoredPasskey>(
                'select "userId", counter, "publicKey", "credentialID", transports from kaname_auth.passkey where "credentialID" = $1',
                [resp.id],
              )
            ).rows[0];
            if (!row || !isCounterRollback(Number(row.counter), received)) return;
            // 回数のほかが正しいか（チャレンジ・origin・rpID・署名）を、回数を 0 にして部品と同じ道具で確かめる。
            //   チャレンジは消費せずに読む（正しくなければ部品に渡して、部品が断る）
            const cookie = ctx.context.createAuthCookie(PASSKEY_CHALLENGE_COOKIE).name;
            const token = await ctx.getSignedCookie(cookie, ctx.context.secret);
            if (!token) return;
            const v = await ctx.context.internalAdapter.findVerificationValue(token);
            if (!v || v.expiresAt < new Date()) return;
            const { type, expectedChallenge } = JSON.parse(v.value) as { type?: string; expectedChallenge?: string };
            if (type !== "authentication" || !expectedChallenge) return;
            const ok = await verifyAuthenticationResponse({
              response: resp as Parameters<typeof verifyAuthenticationResponse>[0]["response"],
              expectedChallenge,
              expectedOrigin: web.origin,
              expectedRPID: web.hostname,
              credential: {
                id: row.credentialID,
                publicKey: new Uint8Array(Buffer.from(row.publicKey, "base64")),
                counter: 0,
                ...(row.transports ? { transports: row.transports.split(",") as AuthenticatorTransportFuture[] } : {}),
              },
              requireUserVerification: false,
            }).then(
              (r) => r.verified,
              () => false,
            );
            if (!ok) return;
            // ここからは本物の鍵の、回数だけが戻った応答。チャレンジを使い終わりにし、その人の今いる会社ごとに 1 行
            //   （detail は空・credential id を入れない・国だけ）。書けなくても断る（守りを先に）
            await ctx.context.internalAdapter.consumeVerificationValue(token);
            await o.appPool
              .query("select app.record_login_event($1, $2, $3)", [
                row.userId,
                PASSKEY_COUNTER_ROLLBACK,
                countryOf(ctx.headers ?? new Headers()),
              ])
              .catch((e: unknown) =>
                console.error("[auth] パスキーの戻りを記録できなかった", (e as { code?: string }).code ?? "unknown"),
              );
            throw new APIError("UNAUTHORIZED", { message: "Authentication failed", code: "AUTHENTICATION_FAILED" });
          }),
        },
      ],
    },
  };
  // 登録の確かめが通った後・行を作る前：同じ認証器（credential id）がもう付いていれば 409・E-AUTH-018 で作らない（K-309）
  const registration = {
    afterVerification: async ({
      verification,
    }: {
      verification: { registrationInfo?: { credential?: { id?: string } } };
    }) => {
      const id = verification.registrationInfo?.credential?.id;
      if (id && (await passkeyExists(o.authPool, id))) throw duplicatePasskey();
      return undefined;
    },
  };
  return [
    passkey({ rpID: web.hostname, rpName: "Kaname", origin: web.origin, registration }) as unknown as BetterAuthPlugin,
    guard,
  ];
}
