// 欄の組「期限・開始日」（K-483・段 8）。チケットを直す口（updateTicket）の欄ごとの処理の表に登録する（ticket-update/fields.ts の末尾）。
//   前処理（inputIssues）：契約に書ける形の決まり（422）だけを、DB を引く前に断る（日付の形・理由の有無と長さ・対の欄なし）。
//     今日より前の期限・開始日と期限の前後・親子・完了・画面が見ていた値は DB の関数に任せる（日付の境で食い違わないよう 1 か所）。
//   書くのは関門 C2 の DB の関数 app.ticket_due_set（列・変更の 1 行・受け箱の行・証跡を 1 つの処理で）だけ。
//   答え：{ ticket（id・number・updated_at と送った欄の列）, changed, message_id }（stage は付けない）
import type pg from "pg";
import type { Row } from "@kaname/db/repository";
import type { HookReply } from "../../../contract/deps.js";
import type { GroupResult, TicketFieldGroup } from "../../ticket-update/fields.js";
import { DATE_MESSAGE, ONLY_WITH_DUE, PAIR_MESSAGE, invalid, replyOf, withField } from "./errors.js";

/** この組が受ける欄 */
export const DUE_FIELDS = ["due_on", "start_on", "due_reason", "expected_due_on", "expected_start_on"] as const;
const DATE_FIELDS = ["due_on", "start_on", "expected_due_on", "expected_start_on"] as const;
export const REASON_MAX = 200;

const has = (raw: Row, k: string) => Object.prototype.hasOwnProperty.call(raw, k);

/** 暦にある YYYY-MM-DD の字か（時刻つき・斜線・2 月 30 日は違う） */
export function isCalendarDate(v: unknown): boolean {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number) as [number, number, number];
  if (y < 1 || m < 1 || m > 12 || d < 1) return false;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= last;
}

/** 制御文字を除き、前後の空白（全角も）を落とした理由 */
const cleanReason = (s: string) => s.replace(/[\u0000-\u001f\u007f-\u009f]/g, "").replace(/^[\s　]+|[\s　]+$/g, "");

/** 形の決まり（契約に書ける物だけ）。違えば 422 の答え、合えば null */
export function dueIssues(raw: Row): HookReply | null {
  const bad = DATE_FIELDS.filter((k) => has(raw, k) && raw[k] !== null && !isCalendarDate(raw[k]));
  if (bad.length) return invalid(bad.map((field) => ({ field, message: DATE_MESSAGE })));
  if (has(raw, "due_reason") && !has(raw, "due_on")) return invalid([{ field: "due_reason", message: ONLY_WITH_DUE }]);
  if (has(raw, "expected_due_on") && !has(raw, "due_on"))
    return invalid([{ field: "expected_due_on", message: PAIR_MESSAGE }]);
  if (has(raw, "expected_start_on") && !has(raw, "start_on"))
    return invalid([{ field: "expected_start_on", message: PAIR_MESSAGE }]);
  if (has(raw, "due_on")) {
    const r = raw["due_reason"];
    if (r === undefined || r === null) return withField("E-DUE-001", "due_reason");
    if (typeof r !== "string") return invalid([{ field: "due_reason", message: "字で送ってください" }]);
    if (cleanReason(r) === "") return withField("E-DUE-001", "due_reason");
    if ([...r].length > REASON_MAX) return withField("E-DUE-002", "due_reason");
  }
  return null;
}

type Due = Row & { error?: unknown; field?: unknown };

async function apply(cl: pg.PoolClient, ticketId: string, input: Row): Promise<GroupResult> {
  const where = "期限・開始日を変える";
  const r = (
    await cl.query<{ v: Due | null }>("select app.ticket_due_set($1, $2::jsonb) as v", [
      ticketId,
      JSON.stringify(input),
    ])
  ).rows[0]?.v;
  if (!r) return { ok: false, reply: replyOf({ error: "empty" }, where) };
  if (r.error !== undefined) return { ok: false, reply: replyOf(r, where) };
  return { ok: true, data: { ticket: r["ticket"], changed: r["changed"], message_id: r["message_id"] ?? null } };
}

export const dueFields: TicketFieldGroup = {
  name: "due",
  fields: DUE_FIELDS,
  inputIssues: dueIssues,
  apply,
};
