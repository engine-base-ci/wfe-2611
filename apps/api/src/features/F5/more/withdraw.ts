// 承認を取り下げる口（K-733・契約の口 withdrawApproval・POST /api/v1/approvals/:id/withdraw・体は空・D-125.105・D-131.14・D-153.21・D-153.27・関門 C2）。
//   書くのは DB の関数 app.approval_withdraw の 1 取引だけ（承認の行に取り下げの印・同じ成果物の新しい承認待ち・実行と仕事の取り消し・
//   チケットを承認待ちに・旗を下ろす・やり取りの 1 行・今の担当者の受け箱に 1 件〔取り下げた本人なら出さない〕・証跡）。
//   取り下げられるのは承認した本人が、PC がまだ仕事を受け取っていない間だけ（関数が判定する）。
//   間に合わなかったのは 3 つに分ける：動いている late → 409 E-APR-010／終わった・受け取った後に止まった ended → 409 E-APR-012／
//   取り下げられない not_withdrawable → 409 E-APR-011。ほかの言葉は K-63 の replyOf（not_found 404・not_member/not_approver/not_writable 403・
//   guard_failed と知らない言葉 503）。関数が例外（DB・証跡・受け箱）は 503・E-PAGE-003（ログに本文を出さない・取引ごと戻る）
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { fromCatalog, replyOf } from "../approve-complete/errors.js";

type Withdrawn = {
  error?: string;
  id?: string;
  withdrawn_at?: string;
  ticket_id?: string;
  approval_id?: string;
};

/** 間に合わなかった・取り下げられないの言葉 → 409 の番号 */
const CONFLICTS: Readonly<Record<string, string>> = {
  late: "E-APR-010",
  not_withdrawable: "E-APR-011",
  ended: "E-APR-012",
};

export function createApprovalWithdraw(pool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs): Promise<HookReply> => {
    let r: Withdrawn | undefined;
    try {
      r = await withTenant(
        pool,
        a.ctx,
        async (cl) => (await cl.query<{ v: Withdrawn }>("select app.approval_withdraw($1) as v", [a.id])).rows[0]?.v,
      );
    } catch (e) {
      console.error(`[approval-withdraw] 取り下げる：止める側に倒した（${(e as Error)?.name ?? "Error"}）`);
      return fromCatalog("E-PAGE-003", 503);
    }
    if (!r) return fromCatalog("E-PAGE-003", 503);
    if (r.error !== undefined) {
      const conflict = CONFLICTS[r.error];
      return conflict ? fromCatalog(conflict, 409) : replyOf(r, "承認を取り下げる");
    }
    const { id, withdrawn_at, ticket_id, approval_id } = r;
    return { status: 201, body: { data: { id, withdrawn_at, ticket_id, approval_id } } };
  };
}
