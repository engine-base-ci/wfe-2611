// 認証の配管（T-US-04）。Better Auth の client（apps/api の /api/auth/*）。トークンは bearer（D-051.2）で、Cookie に頼らない
import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";
import { apiBase, getToken, setToken } from "@/lib/api/client";
import { noticeTermsRequired } from "@/lib/terms-gate";

/** 認証の部品の要求を出した時刻（要求の文脈ごと） */
const SENT = new WeakMap<object, number>();

/** パスキーのチャレンジの受け渡し（K-304）：問いの答えの JSON の challenge_token を、応答の要求の頭 x-passkey-challenge で返す（Cookie は使わない） */
const PASSKEY_OPTIONS_PATH = "/passkey/generate-authenticate-options";
const PASSKEY_VERIFY_PATH = "/passkey/verify-authentication";
const CHALLENGE_FIELD = "challenge_token";
const CHALLENGE_HEADER = "x-passkey-challenge";
/** 今の問いの challenge_token（問いを受けてから応答を送るまでだけ持つ。送ったら捨てる） */
let passkeyChallenge: string | null = null;
const urlOf = (u: unknown): string => (typeof u === "string" ? u : u instanceof URL ? u.href : "");

// 口の住所が空（画面と同じ住所・K-262）なら baseURL を渡さない（Better Auth は画面の出どころの /api/auth を使う）
const base = apiBase();
export const authClient = createAuthClient({
  ...(base ? { baseURL: base } : {}),
  basePath: "/api/auth",
  plugins: [twoFactorClient(), passkeyClient()],
  fetchOptions: {
    credentials: "omit", // Cookie は使わない（Bearer だけ・D-051.2）
    auth: { type: "Bearer", token: () => getToken() ?? "" },
    // 同意し直しが要る（K-53）：ほかの口と同じく、同意し直しの画面へ移す。要求を出した時刻を覚え、同意できた時刻より前の要求の 403 は見ない
    onRequest: (ctx) => {
      SENT.set(ctx, Date.now());
      const url = urlOf(ctx.url);
      const isOptions = url.includes(PASSKEY_OPTIONS_PATH);
      const isVerify = url.includes(PASSKEY_VERIFY_PATH);
      if (!isOptions && !isVerify) return ctx;
      // パスキーで入る 2 つの道には今の印（Bearer）を付けない：ログイン中だと部品が選べるパスキーを今の人の物だけに絞り、
      //   別のアカウントのパスキーで入れなくなる（代表の答え ⑤・Q の指摘）
      const h = new Headers(ctx.headers);
      h.delete("authorization");
      if (isVerify && passkeyChallenge) {
        h.set(CHALLENGE_HEADER, passkeyChallenge);
        passkeyChallenge = null;
      }
      return { ...ctx, headers: h };
    },
    onError: (ctx) => {
      const b = ctx.error as { code?: unknown; message?: unknown } | null;
      noticeTermsRequired(ctx.response.status, b?.code, b?.message, SENT.get(ctx.request));
    },
    onSuccess: (ctx) => {
      if (urlOf(ctx.request.url).includes(PASSKEY_OPTIONS_PATH)) {
        const c = (ctx.data as Record<string, unknown> | null)?.[CHALLENGE_FIELD];
        passkeyChallenge = typeof c === "string" && c !== "" ? c : null;
      }
      const t = ctx.response.headers.get("set-auth-token");
      if (t) setToken(t);
    },
  },
});
export type SessionData = (typeof authClient.$Infer)["Session"];

/** 入り直した直後に、今のセッションを読み直させる。
 *  これを呼ばないと useSession が「入っていない」を持ったままで、守られた画面が入り直しへ跳ね返る（入り直し → 入る → また入り直し の輪） */
export function refreshSession(): void {
  (authClient as unknown as { $store: { notify: (k: string) => void } }).$store.notify("$sessionSignal");
}

/** 端末（セッション）の見え方：自分のセッション一覧は API（GET /api/v1/sessions）。失効は revoked_at で見せる */
export interface DeviceRow {
  id: string;
  kind_id?: string;
  device_label?: string | null;
  last_seen_at?: string;
  revoked_at?: string | null;
  revoke_reason_id?: string | null;
}

/** このブラウザがパスキー（WebAuthn）を使えるか。使えなければ「パスキーで入る」は出すがグレー（D-145.9） */
export const passkeySupported = (): boolean =>
  typeof window !== "undefined" && typeof window.PublicKeyCredential === "function";

/** パスキーで入った結果。crossPlatform＝この PC の外の認証器（スマホの QR・鍵）で入った（「この PC にも」を聞く） */
export type PasskeySignIn =
  | { ok: true; token: string; crossPlatform: boolean }
  | { ok: false; status: number; code: string; message: string | null };

/** パスキーで入る（K-304 の部品の口）：問い → ブラウザの手順（指・顔・PC のロック・スマホの QR はブラウザが出す）→ 応答。
 *  印は応答の頭 set-auth-token（上の onSuccess が置く）。本人がやめた・時間切れは status 400 の失敗で返る（応答の口は呼ばない） */
export async function signInWithPasskey(): Promise<PasskeySignIn> {
  passkeyChallenge = null;
  const before = getToken();
  const r = await authClient.signIn.passkey({ returnWebAuthnResponse: true });
  const err = r.error as { status?: unknown; code?: unknown; message?: unknown } | null;
  // 新しい印は応答の頭（onSuccess が置いた値）。頭が無ければ答えの session.token
  const now = getToken();
  const fromBody = (r.data as { session?: { token?: unknown } } | null)?.session?.token;
  const token = now && now !== before ? now : typeof fromBody === "string" && fromBody !== "" ? fromBody : null;
  if (err || !r.data || !token) {
    return {
      ok: false,
      status: typeof err?.status === "number" ? err.status : 0,
      code: typeof err?.code === "string" ? err.code : "",
      message: typeof err?.message === "string" ? err.message : null,
    };
  }
  const webauthn = (r as { webauthn?: { response?: { authenticatorAttachment?: unknown } } }).webauthn;
  return { ok: true, token, crossPlatform: webauthn?.response?.authenticatorAttachment === "cross-platform" };
}
