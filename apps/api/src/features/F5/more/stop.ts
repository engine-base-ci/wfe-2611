// 承認待ちを使わずに止める口（K-732・契約の口 stopApproval・POST /api/v1/approvals/:id/stop・体は空・D-153.26・関門 C2）。
//   書くのは DB の関数 app.approval_stop の 1 取引だけ（承認の行を stop で決める・段を作業中に・旗を下ろす・やり取りの 1 行・証跡）。
//   成果物は残す。止められるのは承認する人（今の担当者）だけ（関数が判定する）。お知らせは書かない（D-153.7）。
//   DB の答えの言葉は K-63 の replyOf で読み替える（not_found 404・not_member/not_approver/not_writable 403・decided 409 E-CONF-003・
//   guard_failed と知らない言葉 503）。関数が例外（DB・証跡）は 503・E-PAGE-003（ログに本文を出さない・取引ごと戻る）
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { fromCatalog, replyOf } from "../approve-complete/errors.js";

type Stopped = {
  error?: string;
  id?: string;
  decision?: string;
  decided_at?: string;
  status_id?: string;
  ticket_id?: string;
};

export function createApprovalStop(pool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs): Promise<HookReply> => {
    let r: Stopped | undefined;
    try {
      r = await withTenant(
        pool,
        a.ctx,
        async (cl) => (await cl.query<{ v: Stopped }>("select app.approval_stop($1) as v", [a.id])).rows[0]?.v,
      );
    } catch (e) {
      console.error(`[approval-stop] 止める：止める側に倒した（${(e as Error)?.name ?? "Error"}）`);
      return fromCatalog("E-PAGE-003", 503);
    }
    if (!r) return fromCatalog("E-PAGE-003", 503);
    if (r.error !== undefined) return replyOf(r, "承認待ちを止める");
    const { id, decision, decided_at, status_id, ticket_id } = r;
    return { status: 201, body: { data: { id, decision, decided_at, status_id, ticket_id } } };
  };
}
