// 欄の組「段・実績・保留」（K-387・段 7 F6「自分で進める」）。チケットを直す口（updateTicket）の欄ごとの処理の表に登録する（ticket-update/fields.ts）。
//   書くのは関門 C2 の DB の関数 app.ticket_progress_set（段・保留の列・実績・やり取りの変更の 1 行・担当者の受け箱の行・証跡を 1 つの処理で）だけ。
//   受け箱の知らせ（担当者でない人が段を変えたときだけ・画面の中だけ・D-125.130）も、その関数の中で書く（宛先を口に任せない＝守りの 2 層目）。
//   答え：200 { ticket, stage, changed, message_id }（関数の changes・notify_assignee は書き込みと一緒に呼ぶ K-389 のためで、口は返さない）
import type pg from "pg";
import type { Row } from "@kaname/db/repository";
import type { GroupResult, TicketFieldGroup } from "../../ticket-update/fields.js";
import { replyOf } from "./errors.js";

/** この組が受ける欄（段は stage_id か stage_key のどちらか 1 つ） */
export const PROGRESS_FIELDS = ["stage_id", "stage_key", "actual_minutes", "hold_reason", "resume_condition"] as const;

type Progress = Row & { error?: unknown; fields?: unknown };

async function apply(cl: pg.PoolClient, ticketId: string, input: Row): Promise<GroupResult> {
  const where = "段・実績・保留を変える";
  const r = (
    await cl.query<{ v: Progress | null }>("select app.ticket_progress_set($1, $2::jsonb) as v", [
      ticketId,
      JSON.stringify(input),
    ])
  ).rows[0]?.v;
  if (!r) return { ok: false, reply: replyOf({ error: "empty" }, where) };
  if (r.error !== undefined) return { ok: false, reply: replyOf(r, where) };
  return {
    ok: true,
    data: { ticket: r["ticket"], stage: r["stage"], changed: r["changed"], message_id: r["message_id"] ?? null },
  };
}

export const progressFields: TicketFieldGroup = { name: "progress", fields: PROGRESS_FIELDS, apply };
