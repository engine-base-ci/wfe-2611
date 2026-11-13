// 完了にする（K-165）の書く口：completeTicket。そのチケットを直せる人なら誰でも（行の決まり write＝app.ticket_writable・D-128.138）。
//   書くのは関門 C2 の app.ticket_complete（段・完了の時刻と押した人・実施事項の新しい版・やり取りの 1 行・証跡を 1 つの処理で・0100）だけ。
//   知らせは関門 C6 の NotifyGateway.notify だけ（受け箱・宛先は担当者と作った人のうち押した人でない人・D-128.92）。
//     受け箱の行を書くのは app.ticket_completed_notice（宛先と「完了にした人か」は関数の中でもう一度確かめる＝守りの 2 層目。宛先を口に任せない）。
//     本文はチケットの id・番号・リンクだけ。同じチケットの完了の知らせは 1 人に 1 つ（dedupe_key ticket.completed:<チケットの id>）。
//   知らせを書けなくても完了は残す（送れたとは言わない。ログは場所と、書けなかった数か例外の種類だけ）。書く所の DB の失敗は 500（何も残らない）。
//   ログに実施事項の中身・題名を出さない
import type pg from "pg";
import { withTenant, type TenantContext } from "@kaname/db/context";
import type { Repository } from "@kaname/db/repository";
import { NotifyGateway, type NotifyEvent, type Transport } from "@kaname/notify";
import type { Hook, HookArgs, HookReply } from "../../../contract/deps.js";
import { fromCatalog, invalid, replyOf } from "./errors.js";

export const COMPLETED_KIND = "ticket.completed";
/** 完了のときのナレッジの候補は、骨格では出さない（D-128.138） */
export const SKIPPED_REASON = "候補はまだ出していません";
/** DB の integer に入る番号だけを関数に渡す（入らない数は入口で断る） */
const INT_MAX = 2 ** 31 - 1;

/** DB の関数の答え（完了した行）か、だめな理由の言葉 */
type Completed = Record<string, unknown> & { error?: unknown };

/** 完了の知らせ（関門 C6）。受け箱の書き手は DB の関数 1 つ（何度呼んでも 1 人に 1 つ）。答えは書けなかった宛先の数 */
async function notifyCompleted(pool: pg.Pool, repo: Repository, ctx: TenantContext, t: Completed): Promise<number> {
  const memberIds = Array.isArray(t["notify_member_ids"]) ? t["notify_member_ids"].map((x) => String(x)) : [];
  if (!memberIds.length) return 0;
  const ticketId = String(t["ticket_id"]);
  const inbox: Transport = {
    send: async () => {
      await withTenant(pool, ctx, (cl) => cl.query("select app.ticket_completed_notice($1)", [ticketId]));
    },
  };
  const event: NotifyEvent = {
    kind: COMPLETED_KIND,
    payload: { ticket_id: ticketId, number: t["number"], url: `/tickets/${ticketId}` },
    dedupeKey: `${COMPLETED_KIND}:${ticketId}`,
  };
  const gw = new NotifyGateway(
    repo,
    inbox,
    { resolve: async () => memberIds.map((memberId) => ({ memberId, kind: "human" as const, address: null })) },
    { channelsOf: () => ["inapp"], maxAttempts: 2 },
  );
  // 送り先の失敗は投げられずに deliveries の failed で返る（関門の中で再送まで済んでいる）
  const { deliveries } = await gw.notify(event, { memberIds }, ctx);
  return deliveries.filter((d) => d.status === "failed").length;
}

/** 完了した答え（201 TicketCompletion） */
const completedReply = (t: Completed): HookReply => ({
  status: 201,
  body: {
    data: {
      ticket: {
        id: t["ticket_id"],
        number: t["number"],
        stage_key: "done",
        completed_at: t["completed_at"],
        completed_by: t["completed_by"],
      },
      knowledge_candidates: [],
      skipped_reason: SKIPPED_REASON,
    },
  },
});

async function complete(pool: pg.Pool, a: HookArgs): Promise<HookReply> {
  const where = "完了にする";
  // 欄があること・型（並び・整数・真偽）は入口が契約の形で確かめ済み。並びの中身（整数か）はここで確かめる。
  //   範囲の外の番号（負・項目の数を超える）は DB の関数が実施事項と比べて断る（E-VAL-022・D-131.8）
  const checked = a.input["todo_checked"];
  if (!Array.isArray(checked) || !checked.every((x) => Number.isInteger(x) && Math.abs(x as number) <= INT_MAX))
    return invalid("todo_checked", "実施事項の番号（0 からの整数）の並びで送ってください");
  const version = a.input["todo_version"];
  if (!Number.isInteger(version) || (version as number) < 0 || (version as number) > INT_MAX)
    return invalid("todo_version", "実施事項の版（0 以上の整数）を送ってください");
  let r: Completed | undefined;
  try {
    r = await withTenant(
      pool,
      a.ctx,
      async (cl) =>
        (
          await cl.query<{ v: Completed }>("select app.ticket_complete($1, $2::integer[], $3, $4) as v", [
            a.id,
            checked,
            version,
            a.input["conditions_confirmed"] === true,
          ])
        ).rows[0]?.v,
    );
  } catch (e) {
    // 書く所の失敗（1 つの処理なので何も残らない・知らせも出さない）。中身を返さず、ログは場所と例外の種類だけ
    console.error(`[approve-complete] ${where}：書く所で失敗した（${(e as Error)?.name ?? "Error"}）`);
    return fromCatalog("E-PAGE-003", 500);
  }
  if (!r) return replyOf({ error: "empty" }, where);
  if (r.error !== undefined) return replyOf(r, where);
  try {
    const failed = await notifyCompleted(pool, a.repo, a.ctx, r);
    // 宛先の名前・チケットの中身は出さない（場所と数だけ）
    if (failed > 0) console.error(`[approve-complete] ${where}：完了の知らせを書けなかった（${failed} 件）`);
  } catch (e) {
    console.error(`[approve-complete] ${where}：完了の知らせを書けなかった（${(e as Error)?.name ?? "Error"}）`);
  }
  return completedReply(r);
}

export function completeHooks(pool: pg.Pool): Record<string, Hook> {
  return {
    // 入力の形の確かめ → DB の関数を 1 回 → 知らせ（1 要求＝書き込みは 1 回・関門 C2）
    completeTicket: { before: (a: HookArgs) => complete(pool, a) },
  };
}
