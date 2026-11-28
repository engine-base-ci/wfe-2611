// 欄の組「予定時間」（K-583・段 5 F4「チケットを作って中身を決める」）。チケットを直す口（updateTicket）の欄ごとの処理の表に登録する（ticket-update/fields.ts）。
//   前処理（inputIssues）：契約に書ける形の決まり（422）だけを、DB を引く前に断る。estimate_minutes は整数 0〜100000（分）か null（空にする）。
//     型の違い（小数・文字・真偽・並び）は入口の契約の確かめが 422 にし、値域（入口は読まない）はここで断る。
//   書くのは関門 C2 の DB の関数 app.ticket_estimate_set（列・やり取りの変更の 1 行・担当者の受け箱の行・証跡を 1 つの処理で）だけ。
//   完了したチケットでも仕組みの段（承認待ち・実行中）の間でも変えられる（段は見ない・K-387 の実績と同じ）。
//   受け箱の知らせ（担当者でない人が変えたときだけ・画面の中だけ・D-150.32）も、その関数の中で書く（宛先を口に任せない＝守りの 2 層目）。
//   答え：200 { ticket, changed, message_id }（ticket は id・number・updated_at・estimate_minutes）
import type pg from "pg";
import type { Row } from "@kaname/db/repository";
import type { HookReply } from "../../../contract/deps.js";
import type { GroupResult, TicketFieldGroup } from "../../ticket-update/fields.js";
import { ESTIMATE_MAX, ESTIMATE_MESSAGE, invalid, replyOf } from "./errors.js";

/** この組が受ける欄 */
export const ESTIMATE_FIELDS = ["estimate_minutes"] as const;

/** 形の決まり（契約に書ける物だけ）。違えば 422 の答え、合えば null */
export function estimateIssues(raw: Row): HookReply | null {
  if (!Object.prototype.hasOwnProperty.call(raw, "estimate_minutes")) return null;
  const m = raw["estimate_minutes"];
  if (m === null) return null;
  if (typeof m === "number" && Number.isInteger(m) && m >= 0 && m <= ESTIMATE_MAX) return null;
  return invalid([{ field: "estimate_minutes", message: ESTIMATE_MESSAGE }]);
}

type Estimated = Row & { error?: unknown };

async function apply(cl: pg.PoolClient, ticketId: string, input: Row): Promise<GroupResult> {
  const where = "予定時間を変える";
  const r = (
    await cl.query<{ v: Estimated | null }>("select app.ticket_estimate_set($1, $2::jsonb) as v", [
      ticketId,
      JSON.stringify({ estimate_minutes: input["estimate_minutes"] }),
    ])
  ).rows[0]?.v;
  if (!r) return { ok: false, reply: replyOf({ error: "empty" }, where) };
  if (r.error !== undefined) return { ok: false, reply: replyOf(r, where) };
  return { ok: true, data: { ticket: r["ticket"], changed: r["changed"], message_id: r["message_id"] ?? null } };
}

export const ticketEstimateFields: TicketFieldGroup = {
  name: "ticketEstimate",
  fields: ESTIMATE_FIELDS,
  inputIssues: estimateIssues,
  apply,
};
