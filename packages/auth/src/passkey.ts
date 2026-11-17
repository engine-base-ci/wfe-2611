// パスキーで入る（K-304・D-125.137・D-128.59）。暗号の中身は Better Auth のパスキーの部品（中で @simplewebauthn/server）に任せ、
//   Kaname は 次の 3 つだけを足す（チャレンジを JSON と頭で受け渡す所は apps/api/src/auth/passkey-challenge.ts）:
//   1. rpID と origin を画面の URL（webBaseURL）から決める（画面は別の origin。API の URL ではない）
//   2. Kaname の決まり（最後の入り方は外せない・本人確認の取り直し）を通らない部品の口を閉じる（PASSKEY_DISABLED_PATHS）
//   3. 署名の回数が戻った応答（写されたパスキーの疑い）を部品に渡す前に断り、本人の会社に記録を残す（関門 C2）
// 境界 B2：@better-auth/passkey を import してよいのはこのパッケージだけ（CI G7）。
import { passkey } from "@better-auth/passkey";
import { APIError, createAuthMiddleware } from "better-auth/api";
import type { BetterAuthPlugin } from "better-auth";
import type pg from "pg";
import { countryOf } from "./device.js";

/** 部品の既定のチャレンジの Cookie の名前（接頭辞の前）。実際の名前は createAuthCookie で引く（passkey-challenge.ts） */
export const PASSKEY_CHALLENGE_COOKIE = "better-auth-passkey";
/** 閉じる部品の道：一覧・名前・外すは契約の口（K-308 の getMySecurity・K-309 の renamePasskey／deletePasskey）で作る */
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
            const resp = (ctx.body as { response?: { id?: unknown; response?: { authenticatorData?: unknown } } })
              ?.response;
            const received = signCountOf(resp?.response?.authenticatorData);
            if (typeof resp?.id !== "string" || received === null) return; // 形の違う応答は部品が断る
            const row = (
              await o.authPool.query<{ userId: string; counter: number }>(
                'select "userId", counter from kaname_auth.passkey where "credentialID" = $1',
                [resp.id],
              )
            ).rows[0];
            if (!row || !isCounterRollback(Number(row.counter), received)) return;
            // その人の今いる会社ごとに 1 行（detail は空・credential id を入れない・国だけ）。書けなくても断る（守りを先に）
            const headers = ctx.headers ?? new Headers();
            await o.appPool
              .query("select app.record_login_event($1, $2, $3)", [
                row.userId,
                PASSKEY_COUNTER_ROLLBACK,
                countryOf(headers),
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
  return [passkey({ rpID: web.hostname, rpName: "Kaname", origin: web.origin }) as unknown as BetterAuthPlugin, guard];
}
