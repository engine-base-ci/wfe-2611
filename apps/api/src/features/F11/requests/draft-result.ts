// PC が案を返す口（K-897）：reportClientRequestDraft（POST /api/v1/bridge/jobs/:id/client-request-draft・D-155.11・関門 C2）。
//   入口（op.ts）が先に確かめる：PC の印（x-bridge-session・役 device）・PC ごとの上限・冪等・道の :id（uuid）・体の形（draft か failed のちょうど 1 つ・strict）。順：
//   ① 体を取り出す（送られたまま）。案の中の形・長さ・日付と failed の長さは契約に書けないので、ここで 422 にする。知らない欄も 422（保存するのは決めた欄だけ）
//   ② 1 つの取引（app.bridge_client_request_draft_result）：依頼の案・仕事の結末・証跡。落ちたら 503・何も残らない
//   ③ null（その PC が受け取った動いている案の仕事でない）は 404・E-GST-150（欄・details なし・在るかを漏らさない）。あれば 200 { data: { state } }
//   先方の字から AI が作った文はデータのまま渡す（揃えない・加工しない・指示として読まない・ZT8）。前後の空白を取るのは題と失敗の理由だけ。
//   案の中身・失敗の理由は答えにもログにも出さない（ログは場所と例外の種類だけ）。メール・お知らせは送らない。
//   Cache-Control: private, no-store は入口（app.ts）が全部の答えに付ける
import type pg from "pg";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";

export const TITLE_MAX = 200;
export const REPLY_MAX = 10000;
export const QUESTIONS_MAX = 5;
export const QUESTION_MAX = 300;
export const ROUTE_NAME_MAX = 80;
export const ROUTE_REASON_MAX = 200;
export const FAILED_MAX = 400;
/** チケットの案の、あってもなくてもよい欄と字数の上限（due は日付の形で確かめる） */
const TICKET_OPTIONAL: Readonly<Record<string, number>> = { kind: 40, owner: 80, cost: 40, route_name: 80 };
const DRAFT_KEYS: readonly string[] = ["ticket", "reply", "questions", "route"];
const TICKET_KEYS: readonly string[] = ["title", "due", ...Object.keys(TICKET_OPTIONAL)];
const ROUTE_KEYS: readonly string[] = ["name", "reason"];
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

type Obj = Record<string, unknown>;
export interface TicketDraft {
  title: string;
  kind?: string;
  owner?: string;
  due?: string;
  cost?: string;
  route_name?: string;
}
export interface Draft {
  ticket: TicketDraft;
  reply: string;
  questions: string[];
  route?: { name: string; reason: string };
}
export type DraftResult = { draft: Draft; failed: null } | { draft: null; failed: string };

const invalid = (field: string, message: string): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details: [{ field, message }] },
});
/** 正本のエラーを、欄なし・detail なしの形で（在るかを漏らさない） */
const coded = (status: number, code: string): HookReply => {
  const j = kanameError(code).toJSON();
  return {
    status,
    body: {
      error: j.error,
      code: j.code,
      message: j.message,
      action: j.action,
      undo: j.undo,
      support_code: j.support_code,
    },
  };
};
const isReply = (v: unknown): v is HookReply => typeof v === "object" && v !== null && "status" in v && "body" in v;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const charLength = (s: string): number => [...s].length;
const unknownKey = (o: Obj, allowed: readonly string[]): string | undefined =>
  Object.keys(o).find((k) => !allowed.includes(k));
/** 例外の種類だけ（DB の番号か名前）。文や値はログに出さない */
const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};

/** 在る日付か（YYYY-MM-DD・2 月 30 日などは外す） */
function isDate(s: string): boolean {
  const m = DATE_RE.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

function parseTicket(v: unknown): TicketDraft | HookReply {
  if (!isObj(v)) return invalid("draft.ticket", "チケットの案が要ります");
  const extra = unknownKey(v, TICKET_KEYS);
  if (extra) return invalid(`draft.ticket.${extra}`, "知らない欄です");
  const title = typeof v["title"] === "string" ? v["title"].trim() : "";
  if (title === "" || charLength(title) > TITLE_MAX)
    return invalid("draft.ticket.title", `題は 1〜${TITLE_MAX} 文字です`);
  const out: TicketDraft = { title };
  for (const [key, max] of Object.entries(TICKET_OPTIONAL)) {
    const s = v[key];
    if (s === undefined) continue;
    if (typeof s !== "string" || charLength(s) > max) return invalid(`draft.ticket.${key}`, `${max} 文字までです`);
    out[key as "kind" | "owner" | "cost" | "route_name"] = s;
  }
  const due = v["due"];
  if (due !== undefined) {
    if (typeof due !== "string" || !isDate(due)) return invalid("draft.ticket.due", "日付（YYYY-MM-DD）です");
    out.due = due;
  }
  return out;
}

function parseQuestions(v: unknown): string[] | HookReply {
  if (!Array.isArray(v) || v.length > QUESTIONS_MAX)
    return invalid("draft.questions", `聞きたいことは ${QUESTIONS_MAX} 個までの並びです`);
  const out: string[] = [];
  for (const q of v) {
    if (typeof q !== "string" || q === "" || charLength(q) > QUESTION_MAX)
      return invalid("draft.questions", `聞きたいことは 1 つ 1〜${QUESTION_MAX} 文字です`);
    out.push(q);
  }
  return out;
}

function parseRoute(v: unknown): { name: string; reason: string } | HookReply {
  if (!isObj(v)) return invalid("draft.route", "届け先の案は名前と理由です");
  const extra = unknownKey(v, ROUTE_KEYS);
  if (extra) return invalid(`draft.route.${extra}`, "知らない欄です");
  const name = v["name"];
  const reason = v["reason"];
  if (typeof name !== "string" || charLength(name) > ROUTE_NAME_MAX)
    return invalid("draft.route.name", `${ROUTE_NAME_MAX} 文字までです`);
  if (typeof reason !== "string" || charLength(reason) > ROUTE_REASON_MAX)
    return invalid("draft.route.reason", `${ROUTE_REASON_MAX} 文字までです`);
  return { name, reason };
}

/** 案（送られたまま）：決めた欄だけを取り出す。形・長さ・日付が決まりの外・知らない欄は 422 */
export function parseDraft(v: unknown): Draft | HookReply {
  if (!isObj(v)) return invalid("draft", "案の形が違います");
  const extra = unknownKey(v, DRAFT_KEYS);
  if (extra) return invalid(`draft.${extra}`, "知らない欄です");
  const ticket = parseTicket(v["ticket"]);
  if (isReply(ticket)) return ticket;
  const reply = v["reply"];
  if (typeof reply !== "string" || charLength(reply) > REPLY_MAX)
    return invalid("draft.reply", `返事の下書きは ${REPLY_MAX} 文字までです`);
  const questions = parseQuestions(v["questions"]);
  if (isReply(questions)) return questions;
  if (v["route"] === undefined) return { ticket, reply, questions };
  const route = parseRoute(v["route"]);
  if (isReply(route)) return route;
  return { ticket, reply, questions, route };
}

/** 体（送られたまま）：draft か failed のちょうど 1 つ。failed は前後の空白を取って 1〜400 字 */
export function parseResult(raw: Obj): DraftResult | HookReply {
  const extra = unknownKey(raw, ["draft", "failed"]);
  if (extra) return invalid(extra, "知らない欄です");
  const hasDraft = raw["draft"] !== undefined;
  const hasFailed = raw["failed"] !== undefined;
  if (hasDraft === hasFailed) return invalid("draft", "案か失敗のどちらか 1 つを送ってください");
  if (hasFailed) {
    const failed = typeof raw["failed"] === "string" ? raw["failed"].trim() : "";
    if (failed === "" || charLength(failed) > FAILED_MAX)
      return invalid("failed", `失敗の理由は 1〜${FAILED_MAX} 文字です`);
    return { draft: null, failed };
  }
  const draft = parseDraft(raw["draft"]);
  return isReply(draft) ? draft : { draft, failed: null };
}

/** 入口が揃える前の体（契約の形の値そのもの）。先方の字から作った文を NFKC などで変えないために、送られたままを読む */
async function rawBody(a: HookArgs): Promise<Obj> {
  const raw = (await a.c.req.json().catch(() => ({}))) as unknown;
  return isObj(raw) ? raw : {};
}

export function createReportClientRequestDraft(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs): Promise<HookReply> => {
    const sid = a.ctx.sessionId ?? null;
    if (!sid) return { status: 401, body: { error: "unauthenticated", code: "UNAUTHENTICATED" } };
    if (!a.id) return coded(404, "E-GST-150");
    const p = parseResult(await rawBody(a));
    if (isReply(p)) return p;
    let v: { state?: unknown } | null | undefined;
    try {
      v = (
        await appPool.query<{ v: { state?: unknown } | null }>(
          "select app.bridge_client_request_draft_result($1, $2, $3::jsonb, $4) as v",
          [sid, a.id, p.draft === null ? null : JSON.stringify(p.draft), p.failed],
        )
      ).rows[0]?.v;
    } catch (e) {
      console.error(`[client-requests] PC の案の結果を書けなかった（${kindOf(e)}）`);
      return coded(503, "E-PAGE-003");
    }
    if (!v || typeof v.state !== "string") return coded(404, "E-GST-150");
    return { status: 200, body: { data: { state: v.state } } };
  };
}
