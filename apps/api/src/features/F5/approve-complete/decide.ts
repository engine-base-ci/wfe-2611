// 承認して完了する（K-63）の承認・差し戻し：approveApproval・returnApproval。
//   書くのは関門 C2 の app.approval_decide（承認の行・実行の記録と仕事・段・やり取り・証跡を 1 つの処理で・0092）だけ。
//   承認する人＝今の担当者（口の入口の行の決まり＋関数の中の判定の 2 層）。本人確認は取り直さない（D-128.177）。
//   守りの所で例外になったら関数が guard_failed を返し、ここで 503（fail-closed）。書く所の DB の失敗は 500（記録は残らない）
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import type { Hook, HookArgs, HookReply } from "../../../contract/deps.js";
import { down, fromCatalog, isDecidedViolation, replyOf } from "./errors.js";

async function decide(pool: pg.Pool, a: HookArgs, decision: "approve" | "return", reason: string | null) {
  let r: Record<string, unknown> | undefined;
  try {
    r = await withTenant(
      pool,
      a.ctx,
      async (cl) =>
        (
          await cl.query<{ v: Record<string, unknown> }>("select app.approval_decide($1, $2, $3) as v", [
            a.id,
            decision,
            reason,
          ])
        ).rows[0]?.v,
    );
  } catch (e) {
    if (isDecidedViolation(e)) return fromCatalog("E-CONF-003", 409);
    throw e;
  }
  if (!r) return down(decision);
  if (r["error"] === "guard_failed") return down(decision);
  if (r["error"]) return replyOf(r, decision);
  const data = {
    id: r["id"],
    decision: r["decision"],
    decided_at: r["decided_at"],
    status_id: r["status_id"],
    ticket_id: r["ticket_id"],
    run_id: r["run_id"],
    pc: r["pc"] === "live" ? "live" : "asleep",
  };
  return { status: 201, body: { data } } satisfies HookReply;
}

export function decideHooks(pool: pg.Pool): Record<string, Hook> {
  return {
    approveApproval: { before: (a: HookArgs) => decide(pool, a, "approve", null) },
    returnApproval: {
      before: async (a: HookArgs) => {
        // 入口が NFKC と前後の空白を揃えた後の理由。空・長すぎるは関数が守りの判定の後に見る（E-VAL-020・021）
        const note = typeof a.input["note"] === "string" ? a.input["note"] : "";
        return decide(pool, a, "return", note);
      },
    },
  };
}
