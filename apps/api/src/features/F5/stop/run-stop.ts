// 動いている AI の実行を止める口（K-731・契約の口 stopActionRun・POST /api/v1/action_runs/:id/stop・体は空・D-153.24・D-153.25・関門 C2・C5）。
//   書くのは DB の関数 app.run_stop の 1 取引だけ（実行を止まりに・待っている仕事は止める／動いている仕事には止める合図・段と旗・やり取りの 1 行・証跡）。
//   止められるのは担当者だけ（関数が判定する）。お知らせは書かない（D-153.7）。
//   失敗（関数が使えない・証跡が書けない・DB が落ちた）は取引ごと戻り、503・E-PAGE-003（止める側に倒す・ログに本文を出さない）。
//   201 の答えは止めた実行の小さな形 ActionRunStopped（6 欄）
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";

type RunStopped = {
  id: string;
  ticket_id: string;
  phase: string;
  status: string;
  stopped_reason: string | null;
  stopped_at: string | null;
};
type Stop = { ok: true; run: RunStopped } | { ok: false; code: "FORBIDDEN" | "NOT_FOUND" | "DECIDED" };

const fromCatalog = (code: string, status: number): HookReply => ({ status, body: kanameError(code).toJSON() });
const notFound = (): HookReply => ({ status: 404, body: { error: "not_found", code: "NOT_FOUND" } });
const down = (e: unknown): HookReply => {
  console.error(`[run-stop] 止める：止める側に倒した（${(e as Error)?.name ?? "Error"}）`);
  return fromCatalog("E-PAGE-003", 503);
};

export function createRunStop(pool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs): Promise<HookReply> => {
    let r: Stop | undefined;
    try {
      r = await withTenant(
        pool,
        a.ctx,
        async (cl) => (await cl.query<{ v: Stop }>("select app.run_stop($1) as v", [a.id])).rows[0]?.v,
      );
    } catch (e) {
      return down(e);
    }
    if (!r) return down(new Error("empty"));
    if (r.ok) return { status: 201, body: { data: r.run } };
    switch (r.code) {
      case "NOT_FOUND":
        return notFound();
      case "DECIDED":
        return fromCatalog("E-RUN-002", 409);
      default:
        return fromCatalog("E-RUN-001", 403);
    }
  };
}
