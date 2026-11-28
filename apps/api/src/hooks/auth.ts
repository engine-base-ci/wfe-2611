// ログインの部品（Better Auth）に頼る契約の口の振る舞い（K-19）。暗号の中身はログインの部品に任せる（D-128.91）
//   stepUp：本人確認の取り直し（D-125.139）。通ったらセッションに時刻を付ける（15 分効く）。道は 2 つ:
//     パスワード：パスワードで確かめ直し、2 段階を使う人はコードも
//     パスキー（K-309・代表の答え ① answer=9177d9dbe0d9）：体 { passkey: <認証器の応答> }・頭 x-passkey-challenge（ログイン中に
//       GET /api/auth/passkey/generate-authenticate-options でもらった challenge_token）。今のセッションの人のパスキーで、
//       チャレンジが生きていて署名が通れば時刻を付ける（新しいセッションは作らない・packages/auth の verifyPasskeyStepUp）
//   失敗は 401・STEP_UP_FAILED。文は正本：6 けたが違う → E-AUTH-004、パスワードが違う・パスキーで確かめられない → E-AUTH-021。
//   画面は欄の下に出し、ログアウトにしない（K-318）
import type pg from "pg";
import { verifyPasskeyStepUp, type Auth } from "@kaname/auth";
import { kanameError } from "@kaname/errors";
import type { Hook } from "../contract/deps.js";
import { defineHooks } from "./registry.js";

const STEP_UP_MS = 15 * 60 * 1000;
/** パスキーのチャレンジの頭（apps/api/src/auth/passkey-challenge.ts と同じ） */
const CHALLENGE_HEADER = "x-passkey-challenge";
const fail = (status: number, code: string, message: string) => ({
  status,
  body: { error: status === 401 ? "unauthenticated" : "validation_failed", code, message },
});
/** 取り直しの失敗（401・STEP_UP_FAILED）。文は正本から引く */
const stepUpFailed = (errorId: "E-AUTH-004" | "E-AUTH-021") =>
  fail(401, "STEP_UP_FAILED", kanameError(errorId).toJSON().message);

export function authHooks(auth: Auth, appPool: pg.Pool): Record<string, Hook> {
  return {
    stepUp: {
      before: async (a) => {
        const headers = a.c.req.raw.headers;
        const s = await auth.api.getSession({ headers });
        if (!s) return fail(401, "UNAUTHENTICATED", "入り直してから");
        const passkey = a.input["passkey"];
        const password = typeof a.input["password"] === "string" ? a.input["password"] : "";
        const code = typeof a.input["code"] === "string" ? a.input["code"] : "";
        const twoFactor = (s.user as { twoFactorEnabled?: boolean | null }).twoFactorEnabled === true;
        let ok: boolean;
        let failure: "E-AUTH-004" | "E-AUTH-021" = "E-AUTH-021";
        let detail: Record<string, unknown>;
        if (passkey !== undefined && passkey !== null && !password) {
          if (typeof passkey !== "object" || Array.isArray(passkey))
            return fail(422, "VALIDATION_ERROR", "パスキーの応答の形が違う");
          ok = await verifyPasskeyStepUp(auth as unknown as Parameters<typeof verifyPasskeyStepUp>[0], {
            userId: s.user.id,
            response: passkey,
            challengeToken: headers.get(CHALLENGE_HEADER),
          });
          detail = { method: "passkey" };
        } else {
          if (!password) return fail(422, "VALIDATION_ERROR", "パスワードを入れて");
          const okPassword = await auth.api
            .verifyPassword({ body: { password }, headers })
            .then(() => true)
            .catch(() => false);
          let okCode = !twoFactor;
          if (twoFactor) {
            if (!code) return fail(422, "VALIDATION_ERROR", "2 段階のコードを入れて");
            okCode = await (auth.api as unknown as { verifyTOTP: (x: unknown) => Promise<unknown> })
              .verifyTOTP({ body: { code }, headers })
              .then(() => true)
              .catch(() => false);
          }
          ok = okPassword && okCode;
          if (okPassword && !okCode) failure = "E-AUTH-004";
          detail = { two_factor: twoFactor };
        }
        // 取り直しの成功・失敗はセキュリティの出来事に残し、通ったらセッションに時刻を付ける（運営の証跡・会社の「できること」の両方が読む）
        const marked = await appPool.query<{ ok: boolean }>("select app.record_step_up($1, $2, $3) as ok", [
          s.session.id,
          ok,
          JSON.stringify(detail),
        ]);
        if (!ok) return stepUpFailed(failure);
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

// 契約 fuzz の的からは外す（理由は skip に書く・scripts/ci/fuzz_targets.py が理由の空を赤にする）
export const register = defineHooks({
  name: "authHooks",
  make: (d) => authHooks(d.auth, d.appPool),
  fuzz: {
    skip: "Better Auth の本物の部品が要り、偽のセッション（Bearer boss）の的では回せない。口の振る舞いは K-51〜K-53 と packages/auth の試験が持つ",
  },
});
