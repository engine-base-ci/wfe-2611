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
export const REPORT_STATES: readonly string[] = [
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
];
export const ASK_KINDS: readonly string[] = ["code", "approve"];
export const DETAIL_MAX = 400;
export const TEXT_MAX = 300;
export const REQUEST_REF_MAX = 100;
export const CODE_MAX = 64;
/** コードの区切りの字（空白とハイフンの仲間）とコードの字（英数字・全角の英数字）。契約の形（05_flow/screen_api.d/K-355.py の pattern）と同じ */
const CODE_SEP = "\\s\\-‐‑‒–—―ー−－";
const CODE_CHAR = "0-9A-Za-z０-９Ａ-Ｚａ-ｚ";
/** 送られたままのコード：区切りを挟んだコードの字が 1〜64 個（契約の pattern と同じ式） */
const CODE_RE = new RegExp(`^[${CODE_SEP}]*(?:[${CODE_CHAR}][${CODE_SEP}]*){1,${CODE_MAX}}$`);
const CODE_DROP = new RegExp(`[${CODE_SEP}]`, "g");
const HAS_TEXT = /\S/;

const notFound = (): HookReply => ({ status: 404, body: { error: "not_found", code: "NOT_FOUND" } });
const gone = (): HookReply => ({ status: 401, body: { error: "unauthenticated", code: "UNAUTHENTICATED" } });
const created = (data: Record<string, unknown>): HookReply => ({ status: 201, body: { data } });
const charLength = (s: string): number => [...s].length;
/** 状態の番号を口の決まりで決める答え（E-CRED-010 は類 gate だが、この口では「待てば変わる」なので 409・K-354 の取り出しの口は 403） */
const coded = (status: number, code: string): HookReply => ({ status, body: kanameError(code).toJSON() });
/** 入口と同じ揃え方（NFKC と前後の空白）。決まりの確かめは揃える前の値（契約の形と同じ値）で行い、置く値はこれで揃える */
const tidy = (s: string): string => s.normalize("NFKC").trim();

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

/** request_ref（PC が頼みごとに付ける印・Claude の CLI の control_request の request_id の値）：
 *  送られたままで空白でない字を含み 100 字まで（契約の pattern \S・maxLength 100）。合わなければ null */
function parseRequestRef(v: unknown): string | null {
  if (typeof v !== "string" || !HAS_TEXT.test(v) || charLength(v) > REQUEST_REF_MAX) return null;
  return tidy(v);
}

/** 答える体（送られたまま）：code と approved はどちらか 1 つ（契約の oneOf）。code は区切りを挟んだ英数字 1〜64 個（契約の pattern）で、
 *  置く値は NFKC にして区切りを落とした物。approved は true だけ（"approved" として置く） */
export function parseAnswer(raw: Record<string, unknown>): { request: string; code: string } | HookReply {
  const request = parseRequestRef(raw["request_ref"]);
  if (!request) return invalid("request_ref", "頼みの印（空白でない 1〜100 文字）を入れてください");
  const hasCode = raw["code"] !== undefined && raw["code"] !== null;
  const hasApproved = raw["approved"] !== undefined && raw["approved"] !== null;
  if (hasCode === hasApproved) return invalid("code", "コードか「スマホで承認した」のどちらか 1 つを送ってください");
  if (hasApproved) {
    if (raw["approved"] !== true) return invalid("approved", "スマホで承認したときだけ true を送ってください");
    return { request, code: "approved" };
  }
  const code = typeof raw["code"] === "string" ? raw["code"] : "";
  if (!CODE_RE.test(code)) return fail("E-VAL-009", "code");
  return { request, code: code.normalize("NFKC").replace(CODE_DROP, "") };
}

export interface ReportInput {
  job: string;
  state: string;
  detail: string | null;
  request: string | null;
  askKind: string;
  text: string | null;
}

/** 決まった字のどれか（送られたまま・契約の enum） */
const oneOf = (v: unknown, allowed: readonly string[]): v is string => typeof v === "string" && allowed.includes(v);

/** PC の知らせの体（送られたまま）：state は決まった 11 種・detail は 400 字まで・asking と waiting は request_ref が要る（契約の oneOf）・
 *  ask_kind は code か approve（無ければ code）・text は 300 字まで。置く値は入口と同じに揃える */
export function parseReport(raw: Record<string, unknown>, jobId: unknown): ReportInput | HookReply {
  const job = typeof jobId === "string" ? jobId : "";
  if (!job) return invalid("job_id", "仕事の id が要ります");
  if (!oneOf(raw["state"], REPORT_STATES)) return invalid("state", "知らない種類です");
  const state = raw["state"];
  const detail = typeof raw["detail"] === "string" ? raw["detail"] : null;
  if (detail !== null && charLength(detail) > DETAIL_MAX) return invalid("detail", `文は ${DETAIL_MAX} 文字までです`);
  const text = typeof raw["text"] === "string" ? raw["text"] : null;
  if (text !== null && charLength(text) > TEXT_MAX) return invalid("text", `文は ${TEXT_MAX} 文字までです`);
  const askKind = raw["ask_kind"] === undefined || raw["ask_kind"] === null ? "code" : raw["ask_kind"];
  if (!oneOf(askKind, ASK_KINDS)) return invalid("ask_kind", "code か approve です");
  const request = raw["request_ref"] === undefined ? null : parseRequestRef(raw["request_ref"]);
  if (raw["request_ref"] !== undefined && request === null)
    return invalid("request_ref", "頼みの印（空白でない 1〜100 文字）を入れてください");
  if ((state === "asking" || state === "waiting") && request === null)
    return invalid("request_ref", "頼みの印が要ります");
  return {
    job,
    state,
    detail: detail === null ? null : tidy(detail),
    request,
    askKind,
    text: text === null ? null : tidy(text),
  };
}

/** 入口が揃える前の体（契約の形の値そのもの）。形（欄の型・知らない欄）は入口が契約の strict な形で確かめ済み */
async function rawBody(a: HookArgs): Promise<Record<string, unknown>> {
  const raw = (await a.c.req.json().catch(() => ({}))) as unknown;
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
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
    const p = parseAnswer(await rawBody(a));
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
    const p = parseReport(await rawBody(a), a.input["job_id"]);
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
