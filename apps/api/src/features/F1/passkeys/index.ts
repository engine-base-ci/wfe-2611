// K-309 パスキーの名前を変える（renamePasskey・PATCH /api/v1/me/passkeys/:id）と外す（deletePasskey・DELETE 同じ道）。
//   上限（1 分に 60 回・人ごと）・認証（401）・同意し直しの止め・id の形（uuid）は契約の入口（op.ts）が先に確かめる。本人だけの口で役を見ない。
//   名前：前後の空白を除き NFKC・1〜40 文字・制御文字は 422（欄 name）。HTML は文字のまま持つ（画面は文字として出す）。
//   外す：本人確認の取り直しか、ログインから 15 分の内（契約の step_up が login_or_step_up・K-308 の requireStepUpOrFreshLogin）。
//     最後の入り方は外さない（409・E-AUTH-015／E-AUTH-016・D-128.61）。外しても入っている端末は切らない（D-128.141）。
//   他人の id・外した id はどちらも 404（有ることも漏らさない）。認証の表は認証の接続（packages/auth の中）で触る（D-128.119）
import type pg from "pg";
import {
  normalizePasskeyName,
  removePasskeyOf,
  renamePasskeyOf,
  PASSKEY_LAST_METHOD,
  PASSKEY_NEED_TWO_FACTOR,
  type Auth,
} from "@kaname/auth";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";

export interface PasskeysDeps {
  auth: Auth;
  /** 業務の接続（kaname_app）。記録の関数を呼ぶ */
  appPool: pg.Pool;
  /** 認証の接続（kaname_auth）。パスキーの表を触る */
  authPool: pg.Pool;
}

const unauthenticated: HookReply = { status: 401, body: { error: "unauthenticated", code: "UNAUTHENTICATED" } };
const notFound: HookReply = { status: 404, body: { error: "not_found", code: "NOT_FOUND" } };
const nameRejected: HookReply = {
  status: 422,
  body: {
    error: "validation_failed",
    code: "VALIDATION_ERROR",
    details: [{ field: "name", message: "1〜40 文字・制御文字なし" }],
  },
};
/** 409 の答え：文は正本（errors.json）から引く */
const conflict = (code: string): HookReply => {
  const e = kanameError(code).toJSON();
  return { status: 409, body: { error: "conflict", code, message: e.message, action: e.action } };
};
/** 例外の種類だけ（DB の番号か名前）。文や値はログに出さない */
const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};

export function passkeysFeature(d: PasskeysDeps) {
  const userOf = async (a: HookArgs): Promise<string | null> =>
    (await d.auth.api.getSession({ headers: a.c.req.raw.headers }))?.user.id ?? null;

  const rename = async (a: HookArgs): Promise<HookReply> => {
    const userId = await userOf(a);
    if (!userId) return unauthenticated;
    const name = normalizePasskeyName(a.input["name"]);
    if (name === null) return nameRejected;
    const row = await renamePasskeyOf(d.authPool, userId, a.id ?? "", name);
    if (!row) return notFound;
    return { status: 200, body: { data: row } };
  };

  const remove = async (a: HookArgs): Promise<HookReply> => {
    const userId = await userOf(a);
    if (!userId) return unauthenticated;
    const stale = a.requireStepUpOrFreshLogin?.();
    if (stale) return stale;
    const id = a.id ?? "";
    const r = await removePasskeyOf(d.authPool, userId, id);
    if (r === "not_found") return notFound;
    if (r === "last_method") return conflict(PASSKEY_LAST_METHOD);
    if (r === "need_two_factor") return conflict(PASSKEY_NEED_TWO_FACTOR);
    // 外した記録（コミットの後・その画面のセッションの会社と人）。書けなくても外したことは返す（種類だけをログに）
    await d.appPool
      .query("select app.record_security_event($1, 'passkey_removed', $2, null, '{}'::jsonb)", [
        a.ctx.tenantId,
        a.ctx.userId,
      ])
      .catch((e: unknown) => console.error(`[security] パスキーを外した記録を書けなかった（${kindOf(e)}）`));
    return { status: 200, body: { data: { id } } };
  };

  return { rename, remove };
}
