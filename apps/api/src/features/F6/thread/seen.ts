// 最後にやり取りを開いた時刻を書く口（K-384）：markTicketTimelineSeen（POST /api/v1/tickets/:id/timeline/seen）。
//   書くのは自分の 1 行（app.ticket_thread_seen）だけ。体 { seen_at?: ISO の日時 }（無ければ今）。人・チケットは道とセッションから決める。
//   取引は 1 つ（withTenant）・文は 2 つ（見えるかを引く・関数を 1 回）。守りの判定で例外 → 503、書く所で例外 → 500（どちらも E-PAGE-003・何も変わらない）。
//   見られない・消したチケットは 404（D-136.2）。知らせ・証跡は書かない（自分の画面の都合の値）。Cache-Control は入口（app.ts）が付ける
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { broke, down, invalid, notFound } from "./reply.js";

/** ISO の日時（日付 T 時刻 と時差）。Postgres が受ける ‘now’ や ‘きのう’ の字は通さない */
const TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}(:?\d{2})?)$/;
/** DB が日時の字を受け付けなかった（形・範囲・時差）。422 にする（障害の 500・503 と分ける） */
const BAD_TIME_CODES = new Set(["22007", "22008", "22009"]);
const isBadTime = (e: unknown): boolean => BAD_TIME_CODES.has(String((e as { code?: unknown })?.code ?? ""));

type Phase = "guard" | "write";

export function createMarkTicketTimelineSeen(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs) => {
    const raw = a.input["seen_at"];
    if (raw !== undefined && (typeof raw !== "string" || !TIME_RE.test(raw) || Number.isNaN(Date.parse(raw))))
      return invalid("seen_at", "日時");
    const at = typeof raw === "string" ? raw : null;
    let phase: Phase = "guard";
    let v: { ticket_id: string; seen_at: string } | null;
    try {
      v = await withTenant(appPool, a.ctx, async (cl) => {
        const g = await cl.query<{ ok: boolean }>("select app.ticket_visible($1) as ok", [a.id]);
        if (!g.rows[0]?.ok) return null;
        phase = "write";
        const r = await cl.query<{ v: { ticket_id: string; seen_at: string } | null }>(
          "select app.ticket_thread_seen_mark($1, $2::timestamptz) as v",
          [a.id, at],
        );
        return r.rows[0]?.v ?? null;
      });
    } catch (e) {
      if (phase === "write" && at !== null && isBadTime(e)) return invalid("seen_at", "日時");
      return phase === "guard" ? down("やり取りを開いた時刻を書く（守り）", e) : broke("やり取りを開いた時刻を書く", e);
    }
    if (!v) return notFound();
    return { status: 201, body: { data: { ticket_id: v.ticket_id, seen_at: v.seen_at } } };
  };
}
