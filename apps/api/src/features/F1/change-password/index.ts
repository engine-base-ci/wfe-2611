// K-312 パスワードを変える・決める（契約の口 changePassword・PATCH /api/v1/me/password／setMyPassword・POST /api/v1/me/password）。
//   上限（1 分に 60 回・人ごと）・認証（401）・同意し直しの止め・入力の形（strict）は契約の入口（op.ts）が先に確かめる。本人だけの口で役を見ない。
//   変える：① 取り直しが直前 15 分の内か、ログインから 15 分の内でなければ 403・STEP_UP_REQUIRED（K-308 の requireStepUpOrFreshLogin・代表の答え ⑬）
//           ② 新しいパスワードの決まり：12 文字より短い 422・E-VAL-005／128 文字を超える 422・E-VAL-026／漏れたもの 422・E-VAL-011（欄 new_password。
//              照合は K-51 の関門 C1。照合が落ちている間は通す・D-128.134）。ほかの端末を切るより前に断る
//           ③ 今のパスワードを確かめる。違えば 422・欄 current_password（401 にしない：画面の 401 はログアウト扱い）。security_events に password_change_failed
//           ④ 先にほかを切ってから変える（packages/auth の changePassword・D-128.141）。切る所か変える所で落ちたら 503・E-PAGE-003
//           ⑤ その人の全部のワークスペース（今いる会社）の security_events に password_changed → 200 { revoked }
//   決める：パスワードの無い人（パスキーだけで入る人・代表の答え ②）だけ。取り直しは変えると同じ → もうある人は 409・CONFLICT →
//           新しいパスワードの決まりは変えると同じ → 部品の setPassword（サーバーだけ）→ password_set → 201 { ok }。ほかの端末は切らない（前の秘密が無い）
//   パスワードは契約の入口が表記ゆらぎを直す前の値を使う（打ったとおりに預ける・登録と再設定と同じ）。
//   ログにパスワードを出さない（例外は種類だけ）
import type pg from "pg";
import type { Auth } from "@kaname/auth";
import type { ActionGateway } from "@kaname/actions";
import { changePassword } from "@kaname/auth/resolver";
import { NEW_PASSWORD_MAX, NEW_PASSWORD_MIN } from "@kaname/auth/reset";
import { kanameError } from "@kaname/errors";
import { checkPwned, registerPwned } from "../sign-up/pwned.js";
import type { HookArgs, HookReply } from "../../../contract/deps.js";

export interface ChangePasswordDeps {
  auth: Auth;
  /** 業務の接続（ほかを切る関数・入り方を数える関数・記録） */
  appPool: pg.Pool;
  /** 外への口（関門 C1）。漏れたパスワードの照合（K-51 の行為をそのまま使う） */
  actions: ActionGateway;
}

const unauthenticated: HookReply = { status: 401, body: { error: "unauthenticated", code: "UNAUTHENTICATED" } };
const STEP_UP_REQUIRED: HookReply = {
  status: 403,
  body: { error: "step_up_required", code: "STEP_UP_REQUIRED", message: "本人確認を取り直してから" },
};
/** 正本のエラーを答えにする。欄があれば、画面が欄ごとに出せるよう details にも同じ文を入れる（入口の 422 と同じ形） */
const fromCatalog = (status: number, code: string, field?: string): HookReply => {
  const e = kanameError(code, field ? { field } : {});
  return { status, body: field ? { ...e.toJSON(), details: [{ field, message: e.message }] } : e.toJSON() };
};
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
/** 文字の数（下限は人が数える文字＝コードポイント）。上限は部品が UTF-16 の長さで比べるので、両方の大きい方で比べる（ほかを切った後に部品が断らない） */
const chars = (s: string): number => [...s].length;
const longest = (s: string): number => Math.max([...s].length, s.length);

export function changePasswordFeature(d: ChangePasswordDeps) {
  registerPwned(d.actions);

  /** 取り直しの守りはこの口の 1 層だけ（契約の login_or_step_up は入口が見ない）。判定が渡されなければ閉じた側に倒す */
  const guard = (a: HookArgs): HookReply | void =>
    a.requireStepUpOrFreshLogin ? a.requireStepUpOrFreshLogin() : STEP_UP_REQUIRED;

  /** 体の欄を、入口が表記ゆらぎを直す前の値で読む（無ければ入口の値） */
  const rawFields = async (a: HookArgs): Promise<Record<string, unknown>> => {
    const raw = (await a.c.req.json().catch(() => ({}))) as Record<string, unknown>;
    return raw && typeof raw === "object" ? raw : {};
  };
  const pick = (raw: Record<string, unknown>, a: HookArgs, k: string): unknown =>
    typeof raw[k] === "string" ? raw[k] : a.input[k];

  /** 新しいパスワードの決まり（変えると決めるで同じ）。通れば undefined */
  const checkNew = async (a: HookArgs, pw: unknown): Promise<HookReply | undefined> => {
    if (typeof pw !== "string") return invalid("new_password", "新しいパスワードが要る");
    const n = chars(pw);
    if (n < NEW_PASSWORD_MIN) return fromCatalog(422, "E-VAL-005", "new_password");
    if (longest(pw) > NEW_PASSWORD_MAX) return fromCatalog(422, "E-VAL-026", "new_password");
    const r = await checkPwned(d.actions, a.ctx, pw);
    if (r.kind === "leaked") return fromCatalog(422, "E-VAL-011", "new_password");
    if (r.kind === "unavailable") console.warn(`[password] 漏れの照合が使えないので、照合せずに通す: ${r.reason}`);
    return undefined;
  };

  /** その人の全部のワークスペース（今いる会社）に残す。中身は空（パスワードを入れない） */
  const recordAll = (userId: string, kind: "password_changed" | "password_set") =>
    d.appPool.query("select app.record_security_event_for_auth_user($1, $2, '{}'::jsonb)", [userId, kind]);

  const change = async (a: HookArgs): Promise<HookReply> => {
    const stale = guard(a);
    if (stale) return stale;
    const raw = await rawFields(a);
    const current = pick(raw, a, "current_password");
    const next = pick(raw, a, "new_password");
    const bad = await checkNew(a, next);
    if (bad) return bad;
    if (typeof current !== "string" || current === "") return invalid("current_password", "今のパスワードが違います");
    try {
      const r = await changePassword(d.auth, d.appPool, a.c.req.raw.headers, current, next as string);
      if (!r.ok) {
        if (r.reason === "no_session") return unauthenticated;
        // パスワードの無い人（パスキーだけ）は、今のパスワードが合うことが無い。同じ 422・欄 current_password で決める口へ案内する
        if (r.reason === "no_password")
          return invalid("current_password", "パスワードがまだありません。先にパスワードを決めてください");
        await d.appPool
          .query("select app.record_security_event($1, 'password_change_failed', $2, null, '{}'::jsonb)", [
            a.ctx.tenantId,
            a.ctx.userId,
          ])
          .catch((e: unknown) => console.error(`[password] 違った記録を残せなかった（${kindOf(e)}）`));
        return invalid("current_password", "今のパスワードが違います");
      }
      for (const e of r.followUpErrors)
        console.error(`[password] 変えた後に認証の側のほかのセッションの期限を切れなかった（${kindOf(e)}）`);
      await recordAll(r.userId, "password_changed").catch((e: unknown) =>
        console.error(`[password] 変えた記録を残せなかった（${kindOf(e)}）`),
      );
      return { status: 200, body: { data: { revoked: r.revoked } } };
    } catch (e) {
      console.error(`[password] パスワードを変えられなかった（${kindOf(e)}）`);
      return fromCatalog(503, "E-PAGE-003");
    }
  };

  const set = async (a: HookArgs): Promise<HookReply> => {
    const stale = guard(a);
    if (stale) return stale;
    try {
      const headers = a.c.req.raw.headers;
      const s = await d.auth.api.getSession({ headers });
      if (!s) return unauthenticated;
      const m = await d.appPool.query<{ has_password: boolean }>("select has_password from app.login_methods($1)", [
        s.user.id,
      ]);
      if (m.rows[0]?.has_password !== false)
        return conflict("もうパスワードがあります。変えるときは今のパスワードを入れてください");
      const raw = await rawFields(a);
      const next = pick(raw, a, "new_password");
      const bad = await checkNew(a, next);
      if (bad) return bad;
      try {
        await d.auth.api.setPassword({ headers, body: { newPassword: next as string } });
      } catch (e) {
        // 同時に決めた・前の確かめの後に決まった（部品の PASSWORD_ALREADY_SET）は 409
        const code = (e as { body?: { code?: unknown } } | null)?.body?.code;
        if (code === "PASSWORD_ALREADY_SET")
          return conflict("もうパスワードがあります。変えるときは今のパスワードを入れてください");
        throw e;
      }
      await recordAll(s.user.id, "password_set").catch((e: unknown) =>
        console.error(`[password] 決めた記録を残せなかった（${kindOf(e)}）`),
      );
      return { status: 201, body: { data: { ok: true } } };
    } catch (e) {
      console.error(`[password] パスワードを決められなかった（${kindOf(e)}）`);
      return fromCatalog(503, "E-PAGE-003");
    }
  };

  return { change, set };
}
