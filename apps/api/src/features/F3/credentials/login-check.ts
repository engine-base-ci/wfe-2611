// 預けた後のログインの確かめの口（K-355・D-117・関門 C2）：
//   checkCredentialLogin（本人・もう一度確かめる）・answerCredentialLoginCheck（本人・PC が頼んだコードに答える）・
//   reportCredentialCheck（PC・途中と結果を知らせる）。前の道すじ（apps/api/src/auth/ext.ts の /vault/credentials/:id/login-check・
//   /vault/credentials/:id/answer・/bridge/credentials/check-result・/bridge/code）の中身を、契約の口へ移した（前の道すじは K-358 まで残る）。
//   書くのはどれも DB の関数 1 回（1 つの取引・20261119120600）。人の口は本人（ctx の member）で、PC の口は ctx.sessionId（入口 op.ts が x-bridge-session から入れる）で呼ぶ。
//   コードは答えの行に一時的に置き、PC が取った時点で消える。答え・ログ・証跡にコードと文を出さない（ログは場所と例外の種類だけ）。
//   Cache-Control: private, no-store は入口（app.ts）が全部の答えに付ける
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { fail, invalid } from "./input.js";
import { kindOf, unavailable } from "./vault.js";

/** 口が使う材料 */
export interface LoginCheckDeps {
  appPool: pg.Pool;
}

/** PC が送れる途中と結果の種類（08_api の契約の enum と同じ） */
export const REPORT_STATES = [
  "ok",
  "bad_password",
  "needs_2fa",
  "bad_code",
  "captcha",
  "unreachable",
  "no_form",
  "stopped",
  "no_answer",
  "asking",
  "waiting",
] as const;
const REPORT_STATE_SET: ReadonlySet<string> = new Set(REPORT_STATES);
export const ASK_KINDS = ["code", "approve"] as const;
export const DETAIL_MAX = 400;
export const TEXT_MAX = 300;
export const REQUEST_ID_MAX = 100;
export const CODE_MAX = 64;
/** コードから落とす字：空白とハイフンの仲間（NFKC の後） */
const CODE_DROP = /[\s\-‐‑‒–—―ー−－]/g;

const notFound = (): HookReply => ({ status: 404, body: { error: "not_found", code: "NOT_FOUND" } });
const gone = (): HookReply => ({ status: 401, body: { error: "unauthenticated", code: "UNAUTHENTICATED" } });
const created = (data: Record<string, unknown>): HookReply => ({ status: 201, body: { data } });
const charLength = (s: string): number => [...s].length;
/** 状態の番号を口の決まりで決める答え（E-CRED-010 は類 gate だが、この口では「待てば変わる」なので 409・K-354 の取り出しの口は 403） */
const coded = (status: number, code: string): HookReply => ({ status, body: kanameError(code).toJSON() });

/** 関数の誤りの答え（誤りでない結果は呼ぶ側が 201 にする） */
const ERROR_REPLIES: Readonly<Record<string, () => HookReply>> = {
  not_found: notFound,
  revoked: () => fail("E-CRED-011"),
  not_login: () => fail("E-CRED-013"),
  busy: () => fail("E-CRED-012"),
  not_asked: () => fail("E-CRED-014"),
  not_running: () => coded(409, "E-CRED-010"),
};
const errorReply = (code: unknown): HookReply | null => {
  const make = typeof code === "string" ? ERROR_REPLIES[code] : undefined;
  return make ? make() : null;
};

/** request_id：1〜100 字の文字列。無い・空・長すぎるは null */
function parseRequestId(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length > 0 && charLength(s) <= REQUEST_ID_MAX ? s : null;
}

/** 答える体：code と approved はどちらか 1 つ。code は NFKC と空白・ハイフンを落として 1〜64 字。approved true は "approved" として置く */
export function parseAnswer(input: Record<string, unknown>): { request: string; code: string } | HookReply {
  const request = parseRequestId(input["request_id"]);
  if (!request) return invalid("request_id", "頼みの id（1〜100 文字）を入れてください");
  const hasCode = input["code"] !== undefined && input["code"] !== null;
  const hasApproved = input["approved"] !== undefined && input["approved"] !== null;
  if (hasCode === hasApproved) return invalid("code", "コードか「スマホで承認した」のどちらか 1 つを送ってください");
  if (hasApproved) {
    if (input["approved"] !== true) return invalid("approved", "スマホで承認したときだけ true を送ってください");
    return { request, code: "approved" };
  }
  const raw = typeof input["code"] === "string" ? input["code"] : "";
  const code = raw.normalize("NFKC").replace(CODE_DROP, "");
  if (code.length === 0 || charLength(code) > CODE_MAX) return fail("E-VAL-009", "code");
  return { request, code };
}

export interface ReportInput {
  job: string;
  state: string;
  detail: string | null;
  request: string | null;
  askKind: string;
  text: string | null;
}

/** PC の知らせの体：state は決まった 11 種・detail は 400 字まで・asking と waiting は request_id・asking の ask_kind は code か approve・text は 300 字まで */
export function parseReport(input: Record<string, unknown>): ReportInput | HookReply {
  const job = typeof input["job_id"] === "string" ? input["job_id"] : "";
  if (!job) return invalid("job_id", "仕事の id が要ります");
  const state = typeof input["state"] === "string" ? input["state"] : "";
  if (!REPORT_STATE_SET.has(state)) return invalid("state", "知らない種類です");
  const detail = typeof input["detail"] === "string" ? input["detail"] : null;
  if (detail !== null && charLength(detail) > DETAIL_MAX) return invalid("detail", `文は ${DETAIL_MAX} 文字までです`);
  const text = typeof input["text"] === "string" ? input["text"] : null;
  if (text !== null && charLength(text) > TEXT_MAX) return invalid("text", `文は ${TEXT_MAX} 文字までです`);
  const askKind = input["ask_kind"] === undefined || input["ask_kind"] === null ? "code" : input["ask_kind"];
  if (typeof askKind !== "string" || !(ASK_KINDS as readonly string[]).includes(askKind))
    return invalid("ask_kind", "code か approve です");
  const needsRequest = state === "asking" || state === "waiting";
  const request = input["request_id"] === undefined ? null : parseRequestId(input["request_id"]);
  if (input["request_id"] !== undefined && request === null)
    return invalid("request_id", "頼みの id（1〜100 文字）を入れてください");
  if (needsRequest && request === null) return invalid("request_id", "頼みの id が要ります");
  return { job, state, detail, request, askKind, text };
}

const isReply = (v: unknown): v is HookReply => typeof v === "object" && v !== null && "status" in v && "body" in v;

export function createLoginCheckHooks(d: LoginCheckDeps): {
  check: (a: HookArgs) => Promise<HookReply>;
  answer: (a: HookArgs) => Promise<HookReply>;
  report: (a: HookArgs) => Promise<HookReply>;
} {
  /** 本人の文脈で関数を 1 回呼ぶ（1 つの取引） */
  const asMember = async <T>(a: HookArgs, sql: string, args: unknown[]): Promise<T | undefined> =>
    withTenant(d.appPool, a.ctx, async (cl) => (await cl.query<{ v: T }>(sql, args)).rows[0]?.v);

  const check = async (a: HookArgs): Promise<HookReply> => {
    if (!a.id) return notFound();
    let v: Record<string, unknown> | undefined;
    try {
      v = await asMember<Record<string, unknown>>(a, "select app.credential_check_start(app.user_id(), $1) as v", [
        a.id,
      ]);
    } catch (e) {
      console.error(`[credentials] もう一度確かめるを積めなかった（${kindOf(e)}）`);
      return unavailable();
    }
    if (!v) return unavailable();
    const err = errorReply(v["error"]);
    if (err) return err;
    return created({ state: v["state"], job_id: v["job_id"] ?? null });
  };

  const answer = async (a: HookArgs): Promise<HookReply> => {
    if (!a.id) return notFound();
    const p = parseAnswer(a.input);
    if (isReply(p)) return p;
    let v: string | undefined;
    try {
      v = await asMember<string>(a, "select app.credential_check_answer(app.user_id(), $1, $2, $3) as v", [
        a.id,
        p.request,
        p.code,
      ]);
    } catch (e) {
      console.error(`[credentials] 頼まれたコードの答えを置けなかった（${kindOf(e)}）`);
      return unavailable();
    }
    if (v === "ok" || v === "already") return created({ accepted: true });
    return errorReply(v) ?? unavailable();
  };

  const report = async (a: HookArgs): Promise<HookReply> => {
    const sid = a.ctx.sessionId ?? null;
    if (!sid) return gone();
    if (!a.id) return notFound();
    const p = parseReport(a.input);
    if (isReply(p)) return p;
    let v: Record<string, unknown> | undefined;
    try {
      v = (
        await d.appPool.query<{ v: Record<string, unknown> }>(
          "select app.bridge_credential_check_report($1, $2, $3, $4, $5, $6, $7, $8) as v",
          [sid, p.job, a.id, p.state, p.detail, p.request, p.askKind, p.text],
        )
      ).rows[0]?.v;
    } catch (e) {
      console.error(`[credentials] PC の確かめの知らせを書けなかった（${kindOf(e)}）`);
      return unavailable();
    }
    if (!v) return unavailable();
    const err = errorReply(v["error"]);
    if (err) return err;
    return created({ accepted: true, code: typeof v["code"] === "string" ? v["code"] : null });
  };

  return { check, answer, report };
}
