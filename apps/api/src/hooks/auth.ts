// ログインの部品（Better Auth）に頼る契約の口の振る舞い（KN-56）。暗号の中身はログインの部品に任せる（D-128.91）
//   stepUp：本人確認の取り直し（D-125.139）。パスワードで確かめ直し、2 段階を使う人はコードも。通ったらセッションに時刻を付ける（15 分効く）。
//   パスキーで取り直すのは画面の土台（KN-5・ブラウザの WebAuthn）と一緒に足す
import type pg from "pg";
import type { Auth } from "@kaname/auth";
import type { Hook } from "../contract/deps.js";

const STEP_UP_MS = 15 * 60 * 1000;
const fail = (status: number, code: string, message: string) => ({
  status,
  body: { error: status === 401 ? "unauthenticated" : "validation_failed", code, message },
});

export function authHooks(auth: Auth, appPool: pg.Pool): Record<string, Hook> {
  return {
    stepUp: {
      before: async (a) => {
        const headers = a.c.req.raw.headers;
        const s = await auth.api.getSession({ headers });
        if (!s) return fail(401, "UNAUTHENTICATED", "入り直してから");
        const password = typeof a.input["password"] === "string" ? a.input["password"] : "";
        const code = typeof a.input["code"] === "string" ? a.input["code"] : "";
        if (!password) return fail(422, "VALIDATION_ERROR", "パスワードを入れて");
        const okPassword = await auth.api
          .verifyPassword({ body: { password }, headers })
          .then(() => true)
          .catch(() => false);
        const twoFactor = (s.user as { twoFactorEnabled?: boolean | null }).twoFactorEnabled === true;
        let okCode = !twoFactor;
        if (twoFactor) {
          if (!code) return fail(422, "VALIDATION_ERROR", "2 段階のコードを入れて");
          okCode = await (auth.api as unknown as { verifyTOTP: (x: unknown) => Promise<unknown> })
            .verifyTOTP({ body: { code }, headers })
            .then(() => true)
            .catch(() => false);
        }
        const ok = okPassword && okCode;
        // 取り直しの成功・失敗はセキュリティの出来事に残し、通ったらセッションに時刻を付ける（運営の証跡・会社の「できること」の両方が読む）
        const marked = await appPool.query<{ ok: boolean }>("select app.record_step_up($1, $2, $3) as ok", [
          s.session.id,
          ok,
          JSON.stringify({ two_factor: twoFactor }),
        ]);
        if (!ok) return fail(401, "STEP_UP_FAILED", "パスワードかコードが違う");
        if (marked.rows[0]?.ok !== true) return fail(401, "UNAUTHENTICATED", "入り直してから");
        const at = new Date();
        return {
          status: 201,
          body: {
            data: { step_up_at: at.toISOString(), valid_until: new Date(at.getTime() + STEP_UP_MS).toISOString() },
          },
        };
      },
    },
  };
}
