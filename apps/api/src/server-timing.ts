// 口の答えの Server-Timing（K-237・調べ .ticket-flow/perf-research.md の A-4）。
//   要求ごとに DB の数え器（@kaname/db/pool の withDbCount）を始め、答えに DB にかかった時間（ms）と流した文の数を書く。
//   文の中身・表の名前は出さない。手元の試験（K237-API-002）と staging の測り（scripts/ci/staging_perf.py）がこれを読む。
import type { MiddlewareHandler } from "hono";
import { withDbCount, type DbCount } from "@kaname/db/pool";

export const SERVER_TIMING = "Server-Timing";

export function serverTimingValue(count: DbCount): string {
  return `db;dur=${count.ms.toFixed(1)}, q;desc="statements";dur=${count.statements}`;
}

/** 全部の答え（/health・契約の口・認証の口の素の Response・404・onError の 500）に付ける。createApp の最初の middleware */
export function serverTiming(): MiddlewareHandler {
  return async (c, next) => {
    const count: DbCount = { statements: 0, ms: 0 };
    await withDbCount(count, () => next());
    const value = serverTimingValue(count);
    try {
      c.res.headers.set(SERVER_TIMING, value);
    } catch {
      // 頭を変えられない答え（外から受け取った Response）は写して付け直す
      c.res = new Response(c.res.body, c.res);
      c.res.headers.set(SERVER_TIMING, value);
    }
  };
}
