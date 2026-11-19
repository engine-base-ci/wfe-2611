// 預けたログイン情報の金庫の呼び方（K-352 預ける。K-353 の上書きと消すも使う）。金庫に触るのは秘密の関門（packages/secrets・関門 C8）だけ。
//   前の道すじ（apps/api/src/auth/ext.ts の預ける口）と同じ振る舞い：認証アプリの鍵は Base32（空白と小文字は直す）・
//   置けなければ 502・E-SEC-001、上限なら 503・E-SEC-003 と待つ秒数、staging／本番で消える保管先なら 503・E-SEC-002。
//   前の道すじは K-358 で消えるので、ext.ts は変えずにここへ同じ物を書いた（消した後はここ 1 か所になる）。
//   値（パスワード・鍵の値・認証アプリの鍵）はログにも答えにも出さない。ログに出してよいのは金庫の参照（sec_…）だけ
import type { TenantContext } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { SecretsGateway } from "@kaname/secrets";
import type { HookReply } from "../../../contract/deps.js";
import { fail, type SecretContent, type TwoFactor } from "./input.js";

/** 認証アプリの鍵の形：Base32（A〜Z・2〜7）の 16 文字以上 */
const TOTP_RE = /^[A-Z2-7]{16,}=*$/;

/** 例外の種類だけ（DB の番号か名前）。文や値はログに出さない */
export const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};
const withStatus = (status: number, code: string, extra: Record<string, unknown> = {}): HookReply => ({
  status,
  body: { ...kanameError(code).toJSON(), ...extra },
});
/** Kaname の側で落ちた（DB に書けない など）。何も残さなかったときに返す */
export const unavailable = (): HookReply => withStatus(503, "E-PAGE-003");

/** ⑥ 認証アプリの鍵：2 段階が認証アプリのときだけ要る。空白と小文字は直す。無い・Base32 でない・認証アプリでないのに付ける → 422・E-VAL-003 */
export function parseTotpSecret(twoFactor: TwoFactor, v: unknown): string | null | HookReply {
  if (twoFactor !== "totp") return v === undefined ? null : fail("E-VAL-003", "totp_secret");
  const secret = typeof v === "string" ? v.normalize("NFKC").replace(/\s+/g, "").toUpperCase() : "";
  return TOTP_RE.test(secret) ? secret : fail("E-VAL-003", "totp_secret");
}

/** 金庫に入れる種類（credential_kinds の key）：認証アプリつきのログイン・ほかのログイン・鍵の値 */
export function vaultKind(content: SecretContent): "password_totp" | "basic" | "api_key" {
  if (content.kind === "key") return "api_key";
  return content.twoFactor === "totp" ? "password_totp" : "basic";
}
/** 金庫に入れる中身（暗号化の前の JSON）。取り出すのは PC の実行器だけ */
export function vaultPayload(content: SecretContent, totpSecret: string | null): string {
  return content.kind === "key"
    ? JSON.stringify({ value: content.value })
    : JSON.stringify({ login: content.login, password: content.password, totp_secret: totpSecret });
}

/** staging／本番で、再起動で消える保管先のままなら預からない（D-097.8）。env と durable は要求ごとに読む */
export function notDurable(env: string, secrets: SecretsGateway): HookReply | undefined {
  return (env === "staging" || env === "production") && !secrets.durable ? withStatus(503, "E-SEC-002") : undefined;
}

/** 手順 S1：金庫に入れる。入れば参照、入らなければ答え（上限は 503・E-SEC-003 と待つ秒数／ほかは 502・E-SEC-001）。金庫には何も残らない */
export async function storeSecret(
  secrets: SecretsGateway,
  ctx: TenantContext,
  kindId: string,
  payload: string,
): Promise<{ ref: string } | HookReply> {
  const stored = await secrets.store(ctx, kindId, payload);
  if (stored.status === "done") return { ref: typeof stored.value === "string" ? stored.value : stored.value.ref };
  if (stored.retryAfterSec) {
    const e = kanameError("E-SEC-003");
    return {
      status: 503,
      body: {
        ...e.toJSON(),
        message: e.entry.message.replace("◯", String(stored.retryAfterSec)),
        retry_after_sec: stored.retryAfterSec,
      },
    };
  }
  return withStatus(502, "E-SEC-001", { handoff: stored.handoff });
}

/** 手順 S1 の後片付け：後の手順が落ちたとき、置いた金庫の物を失効させる。失効も落ちたら、ログに参照と訳を残す（運営が消す・値は出さない） */
export async function revokeStored(
  secrets: SecretsGateway,
  ctx: TenantContext,
  ref: string,
  why: string,
): Promise<void> {
  try {
    if (await secrets.revoke(ctx, ref)) return;
    console.error(`[credentials] 後片付け：${why}の後、金庫の物を失効できなかった（参照 ${ref}・金庫に見つからない）`);
  } catch (e) {
    console.error(`[credentials] 後片付け：${why}の後、金庫の物を失効できなかった（参照 ${ref}・${kindOf(e)}）`);
  }
}
