// 最後にやり取りを開いた時刻を書く口（K-384）：markTicketTimelineSeen（POST /api/v1/tickets/:id/timeline/seen）。
//   書くのは自分の 1 行（app.ticket_thread_seen）だけ。体 { seen_at?: ISO の日時 }（無ければ今）。人・チケットは道とセッションから決める。
//   取引は 1 つ（withTenant）・文は 2 つ（見えるかを引く・関数を 1 回）。守りの判定で例外・書く所で例外のどちらも 503（E-PAGE-003・何も変わらない・11-22 の決め）。
//   見られない・消したチケットは 404（D-136.2）。知らせ・証跡は書かない（自分の画面の都合の値）。Cache-Control は入口（app.ts）が付ける
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { broke, down, invalid, notFound } from "./reply.js";

/** ISO の日時（暦に無い日・時差の範囲外は断る）。契約の VALUE_RANGES の pattern と同じ字（screen_api.d/K-384.py）。形の決まりは口の前で決まり、DB の中身では断らない */
const TIME_RE =
  /^(?:[1-9]\d{3}-(?:0[13578]|1[02])-(?:0[1-9]|[12]\d|3[01])|[1-9]\d{3}-(?:0[469]|11)-(?:0[1-9]|[12]\d|30)|[1-9]\d{3}-02-(?:0[1-9]|1\d|2[0-8])|(?:[1-9]\d(?:0[48]|[2468][048]|[13579][26])|(?:[2468][048]|[13579][26])00)-02-29)T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:0\d|1[0-5])(?::?[0-5]\d)?)$/;

type Phase = "guard" | "write";

export function createMarkTicketTimelineSeen(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs) => {
    const raw = a.input["seen_at"];
    if (raw !== undefined && (typeof raw !== "string" || !TIME_RE.test(raw))) return invalid("seen_at", "日時");
    const at = typeof raw === "string" ? raw : null;
    let phase = "guard" as Phase; // 取引の中で書き換わる（型の絞り込みを外す）
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
      return phase === "guard" ? down("やり取りを開いた時刻を書く（守り）", e) : broke("やり取りを開いた時刻を書く", e);
    }
    if (!v) return notFound();
    return { status: 201, body: { data: { ticket_id: v.ticket_id, seen_at: v.seen_at } } };
  };
}
