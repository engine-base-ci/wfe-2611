// K-311 2 段階認証を付ける（契約の口 startTwoFactor・confirmTwoFactor・POST /api/v1/me/two-factor/enable・/confirm）。
//   上限（1 分に 60 回・人ごと）・認証（401）・同意し直しの止め・入力の形（strict）は契約の入口（op.ts）が先に確かめる。本人だけの口で役を見ない。
//   始める：① パスワードの無い人（パスキーだけ）→ 409・E-AUTH-020（取り直しや入力より先・鍵を作らない）
//           ② 取り直しが直前 15 分の内か、ログインから 15 分の内でなければ 403・STEP_UP_REQUIRED（K-308 の requireStepUpOrFreshLogin）
//           ③ もう付いている → 409・E-AUTH-017 ④ パスワードが空・違う → 422・欄 password（401 にしない：画面の 401 はログアウト扱い）
//           ⑤ 部品で鍵を作る（まだ付かない）→ 201 { otpauth_uri, secret }・security_events に two_factor_started（中身に鍵を入れない）
//   確かめる：始めていない → 409・CONFLICT／もう付いている → 409・E-AUTH-017／6 けたでない → 422・欄 code／
//           バックアップコードを引けない → 503・E-PAGE-003（付けない）／違う → 422・E-AUTH-004／
//           付いた → 201 { backup_codes, token }・security_events に two_factor_enabled・app.settle_mfa_pending（その人の全部のセッションの印を下ろす）。
//           部品が作り直したセッションの印を token で返し、前のセッションの写し（public.sessions）も閉じる
//   ログに鍵の文字・otpauth の URI・6 けた・バックアップコード・パスワードを出さない（例外は種類だけ）。鍵とコードは部品が包んで持つ（関門 C8）
import type pg from "pg";
import type { Auth } from "@kaname/auth";
import { confirmTotpSetup, startTotpSetup } from "@kaname/auth/two_factor";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";

export interface TwoFactorDeps {
  auth: Auth;
  /** 業務の接続（入り方を数える関数・記録・印を下ろす関数・セッションの写しを閉じる） */
  appPool: pg.Pool;
  /** 認証の接続（部品の 2 段階の表を読む・錠・新しいセッションのログインの時刻） */
  authPool: pg.Pool;
}

/** 入口（op.ts）の 401 と同じ形 */
const unauthenticated: HookReply = { status: 401, body: { error: "unauthenticated", code: "UNAUTHENTICATED" } };
const fromCatalog = (status: number, code: string): HookReply => ({ status, body: kanameError(code).toJSON() });
const invalid = (field: string, message: string): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details: [{ field, message }] },
});
const conflict = (message: string): HookReply => ({
  status: 409,
  body: { error: "conflict", code: "CONFLICT", message },
});
/** 例外の種類だけ（DB の番号か名前）。文や値はログに出さない */
const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};
const str = (v: unknown): string => (typeof v === "string" ? v : "");

export function twoFactorFeature(d: TwoFactorDeps) {
  /** security_events に残す（今いる会社・本人の行・中身は空。鍵やコードを入れない） */
  const record = (a: HookArgs, kind: "two_factor_started" | "two_factor_enabled") =>
    d.appPool.query("select app.record_security_event($1, $2, $3, null, '{}'::jsonb)", [
      a.ctx.tenantId,
      kind,
      a.ctx.userId,
    ]);

  const start = async (a: HookArgs): Promise<HookReply> => {
    try {
      const headers = a.c.req.raw.headers;
      const s = await d.auth.api.getSession({ headers });
      if (!s) return unauthenticated;
      const userId = s.user.id;
      const m = await d.appPool.query<{ has_password: boolean }>("select has_password from app.login_methods($1)", [
        userId,
      ]);
      if (m.rows[0]?.has_password !== true) return fromCatalog(409, "E-AUTH-020");
      const guard = a.requireStepUpOrFreshLogin?.();
      if (guard) return guard;
      const password = str(a.input["password"]);
      const r = await startTotpSetup(d.auth, d.authPool, headers, userId, password);
      if (!r.ok) {
        if (r.reason === "already") return fromCatalog(409, "E-AUTH-017");
        if (r.reason === "busy") return conflict("2 段階認証を付ける操作がほかで進んでいます");
        return invalid("password", "パスワードが違います");
      }
      await record(a, "two_factor_started");
      return { status: 201, body: { data: { otpauth_uri: r.otpauthUri, secret: r.secret } } };
    } catch (e) {
      console.error(`[two-factor] 2 段階を始められなかった（${kindOf(e)}）`);
      return fromCatalog(503, "E-PAGE-003");
    }
  };

  const confirm = async (a: HookArgs): Promise<HookReply> => {
    try {
      const headers = a.c.req.raw.headers;
      const s = await d.auth.api.getSession({ headers });
      if (!s) return unauthenticated;
      const r = await confirmTotpSetup(d.auth, d.authPool, headers, s.user.id, str(a.input["code"]));
      if (!r.ok) {
        switch (r.reason) {
          case "already":
            return fromCatalog(409, "E-AUTH-017");
          case "not_started":
            return conflict("2 段階認証を始めてから確かめてください");
          case "busy":
            return conflict("2 段階認証を付ける操作がほかで進んでいます");
          case "format":
            return invalid("code", "認証アプリの 6 けたの数字を入れてください");
          case "wrong":
            return fromCatalog(422, "E-AUTH-004");
          case "codes_unavailable":
            return fromCatalog(503, "E-PAGE-003");
        }
      }
      // ここから先は付いた後。記録・印・前の写しが落ちても、付いた事実とコードは返す（コードを二度と返せなくしない）
      if (r.replacedSessionId)
        await settle(
          () => d.appPool.query("select app.close_session($1, 'logout')", [r.replacedSessionId]),
          "前のセッションの写し",
        );
      await settle(() => record(a, "two_factor_enabled"), "付いた記録");
      await settle(() => d.appPool.query("select app.settle_mfa_pending($1)", [s.user.id]), "付けるまで進めない印");
      return { status: 201, body: { data: { backup_codes: r.backupCodes, token: r.token } } };
    } catch (e) {
      console.error(`[two-factor] 2 段階を確かめられなかった（${kindOf(e)}）`);
      return fromCatalog(503, "E-PAGE-003");
    }
  };

  return { start, confirm };
}

/** 付いた後の後片付け：落ちても答えは止めない（種類だけをログに出す） */
async function settle(fn: () => Promise<unknown>, what: string): Promise<void> {
  try {
    await fn();
  } catch (e) {
    console.error(`[two-factor] 付いた後の${what}を書けなかった（${kindOf(e)}）`);
  }
}
