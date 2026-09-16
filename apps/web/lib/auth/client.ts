// 認証の配管（T-US-04）。Better Auth の client（apps/api の /api/auth/*）。トークンは bearer（D-051.2）で、Cookie に頼らない
import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";
import { apiBase, getToken, setToken } from "@/lib/api/client";

export const authClient = createAuthClient({
  baseURL: apiBase(),
  basePath: "/api/auth",
  plugins: [twoFactorClient()],
  fetchOptions: {
    auth: { type: "Bearer", token: () => getToken() ?? "" },
    onSuccess: (ctx) => {
      const t = ctx.response.headers.get("set-auth-token");
      if (t) setToken(t);
    },
  },
});
export type SessionData = (typeof authClient.$Infer)["Session"];

/** 端末（セッション）の見え方：自分のセッション一覧は API（GET /api/v1/sessions）。失効は revoked_at で見せる */
export interface DeviceRow {
  id: string;
  kind_id?: string;
  device_label?: string | null;
  last_seen_at?: string;
  revoked_at?: string | null;
  revoke_reason_id?: string | null;
}
