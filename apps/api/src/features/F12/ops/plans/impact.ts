// K-989 値段を変える案の影響を見る口（getPlanProposalImpact・関門 C2・D-128.72・D-156.12・D-156.17）。
//   opsTx で app.ops_plan_impact(:id)（運営の人か・値段の印か・案が在るかは関数の中で見る）→ 200 { data }（7 欄）・Cache-Control: private, no-store
//   DB の断りは opsErrorReply（42501 → 403／P0002 → 404 欄なし／ほか → 503 E-PAGE-003）。
//   ただし関数を呼ぶ権限そのものがアプリの接続に無い（PostgreSQL の aclcheck_error＝配備の誤り）は 403 にせず 503（止める側に倒す・K989-API-009）
import type pg from "pg";
import type { HookArgs, HookReply } from "../../../../contract/deps.js";
import { opsErrorReply, opsTx } from "../db.js";

export interface OpsPlanImpactDeps {
  appPool: pg.Pool;
}

/** 関数の実行の権限がアプリの接続に無い（ops_require の断りとは別・PostgreSQL が出す 42501） */
const isExecuteDenied = (e: unknown): boolean => {
  const err = e as { code?: unknown; routine?: unknown } | null;
  return err?.code === "42501" && err.routine === "aclcheck_error";
};

export function createGetPlanProposalImpact(d: OpsPlanImpactDeps): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    try {
      const r = await opsTx(d.appPool, a.ctx, (c) =>
        c.query<{ r: Record<string, unknown> }>("select app.ops_plan_impact($1) as r", [a.id]),
      );
      a.c.header("Cache-Control", "private, no-store");
      return { status: 200, body: { data: r.rows[0]?.r ?? null } };
    } catch (e) {
      if (isExecuteDenied(e)) {
        console.error("[ops] plans の DB が失敗した（実行の権限が無い）");
        return { status: 503, body: { error: "unavailable", code: "E-PAGE-003" } };
      }
      return opsErrorReply(e, "plans");
    }
  };
}
