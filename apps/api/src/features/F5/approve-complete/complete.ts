// 承認して完了する（K-63）の完了：completeTicket。そのチケットを直せる人なら誰でも（D-128.138）。
//   書くのは関門 C2 の app.ticket_complete（段・完了の時刻と押した人・実施事項の版・やり取り・証跡を 1 つの処理で・0092）だけ。
//   知らせは関門 C6 の NotifyGateway.notify だけ（受け箱・宛先は担当者と作った人のうち押した人でない人・D-128.92）。
//   本文はチケットの id・番号・リンクだけ（TP-MAIL-03）。送れなくても完了は残し、受け箱の行に failed_at・retry_count を残す（送れたとは言わない）
import type pg from "pg";
import { withTenant, type TenantContext } from "@kaname/db/context";
import type { Repository } from "@kaname/db/repository";
import { NotifyGateway, type Channel, type NotifyEvent, type Transport } from "@kaname/notify";
import type { Hook, HookArgs } from "../../../contract/deps.js";
import { down, invalid, replyOf } from "./errors.js";

export const COMPLETED_KIND = "ticket.completed";
export const SKIPPED_REASON = "候補はまだ出していません";
/** 受け箱は DB の行そのもの（送り先は何もしない）。試験は失敗する送り先を差し込む */
const INBOX_NOOP: Transport = { send: async () => undefined };

interface Completed {
  ticket_id: string;
  number: string;
  completed_at: string;
  completed_by: string;
  notify_member_ids: string[];
}

/** 完了の知らせ（関門 C6）。宛先ごとの結末を受け箱の行に残す */
async function notifyCompleted(
  pool: pg.Pool,
  repo: Repository,
  inbox: Transport,
  ctx: TenantContext,
  t: Completed,
): Promise<void> {
  if (!t.notify_member_ids.length) return;
  const dedupe = `${COMPLETED_KIND}:${t.ticket_id}`;
  const keyOf = (memberId: string, ch: Channel) => `${ctx.tenantId}:${memberId}:${ch}:${dedupe}`;
  const record = (memberId: string, sent: boolean, attempts: number) =>
    withTenant(pool, ctx, (cl) =>
      cl.query("select app.ticket_completed_notice($1, $2, $3, $4, $5)", [
        t.ticket_id,
        memberId,
        keyOf(memberId, "inapp"),
        sent,
        attempts,
      ]),
    );
  const event: NotifyEvent = {
    kind: COMPLETED_KIND,
    payload: { ticket_id: t.ticket_id, number: t.number, url: `/tickets/${t.ticket_id}` },
    dedupeKey: dedupe,
  };
  const gw = new NotifyGateway(
    repo,
    inbox,
    {
      resolve: async () => t.notify_member_ids.map((memberId) => ({ memberId, kind: "human" as const, address: null })),
      seen: async (key, c) =>
        withTenant(pool, c, async (cl) => {
          const r = await cl.query(
            "select 1 from notifications where dedupe_key = $1 and sent_at is not null limit 1",
            [key],
          );
          return (r.rowCount ?? 0) > 0;
        }),
    },
    { channelsOf: () => ["inapp"], maxAttempts: 2, backoffMs: 50 },
  );
  const r = await gw.notify(event, { memberIds: t.notify_member_ids }, ctx);
  for (const d of r.deliveries)
    if (d.status === "sent" || d.status === "failed") await record(d.memberId, d.status === "sent", d.attempts);
}

export function completeHooks(pool: pg.Pool, o: { inbox?: Transport } = {}): Record<string, Hook> {
  const inbox = o.inbox ?? INBOX_NOOP;
  return {
    completeTicket: {
      before: async (a: HookArgs) => {
        // 形は入口が契約の strict な形で確かめ済み。並びの中身（番号）はここで確かめる
        const checked = a.input["todo_checked"] ?? [];
        if (!Array.isArray(checked) || !checked.every((x) => Number.isInteger(x)))
          return invalid("todo_checked", "実施事項の番号（0 からの整数）の並び");
        const version = a.input["todo_version"];
        if (version !== undefined && !Number.isInteger(version)) return invalid("todo_version", "整数");
        const r = await withTenant(
          pool,
          a.ctx,
          async (cl) =>
            (
              await cl.query<{ v: Record<string, unknown> }>("select app.ticket_complete($1, $2, $3, $4) as v", [
                a.id,
                (checked as number[]).filter((x) => x >= 0 && x < 2 ** 31),
                version ?? 0,
                a.input["conditions_confirmed"] === true,
              ])
            ).rows[0]?.v,
        );
        if (!r || r["error"] === "guard_failed") return down("完了");
        if (r["error"]) return replyOf(r, "完了");
        const t = r as unknown as Completed;
        try {
          await notifyCompleted(pool, a.repo, inbox, a.ctx, t);
        } catch (e) {
          console.error(`[approve-complete] 完了の知らせを残せなかった（${(e as Error)?.name ?? "Error"}）`);
        }
        return {
          status: 201,
          body: {
            data: {
              ticket: {
                id: t.ticket_id,
                number: t.number,
                stage_key: "done",
                completed_at: t.completed_at,
                completed_by: t.completed_by,
              },
              knowledge_candidates: [],
              skipped_reason: SKIPPED_REASON,
            },
          },
        };
      },
    },
  };
}
