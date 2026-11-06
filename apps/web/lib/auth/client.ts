// 認証の配管（T-US-04）。Better Auth の client（apps/api の /api/auth/*）。トークンは bearer（D-051.2）で、Cookie に頼らない
import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";
import { apiBase, getToken, setToken } from "@/lib/api/client";
import { noticeTermsRequired } from "@/lib/terms-gate";

/** 認証の部品の要求を出した時刻（要求の文脈ごと） */
const SENT = new WeakMap<object, number>();

export const authClient = createAuthClient({
  baseURL: apiBase(),
  basePath: "/api/auth",
  plugins: [twoFactorClient()],
  fetchOptions: {
    credentials: "omit", // Cookie は使わない（Bearer だけ・D-051.2）
    auth: { type: "Bearer", token: () => getToken() ?? "" },
    // 同意し直しが要る（K-53）：ほかの口と同じく、同意し直しの画面へ移す。要求を出した時刻を覚え、同意できた時刻より前の要求の 403 は見ない
    onRequest: (ctx) => {
      SENT.set(ctx, Date.now());
    },
    onError: (ctx) => {
      const b = ctx.error as { code?: unknown; message?: unknown } | null;
      noticeTermsRequired(ctx.response.status, b?.code, b?.message, SENT.get(ctx.request));
    },
    onSuccess: (ctx) => {
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
