// 契約 fuzz（G36・KN-55）の的：実 Postgres（migration＋場合表の種）＋偽のセッション解決（Bearer boss／staff／ops）を HTTP で立てる。
//   認証そのものは packages/auth の試験が持つ。ここは「契約どおりの入力でも、契約の外の入力でも、サーバーが落ちない（500 を返さない）・返す形が契約どおり」を見る
import { serve } from "@hono/node-server";
import { writeFileSync } from "node:fs";
import { ENDPOINTS } from "@kaname/contracts";
import type { TableName } from "@kaname/db/repository";
import { makeHarness } from "../harness.js";
import { agentHooks } from "../../src/hooks/agent.js";

const port = Number(process.env["FUZZ_PORT"] ?? 4791);
const h = await makeHarness();
Object.assign(h.hooks, agentHooks(h.pool)); // 本物のサーバー（src/server.ts）と同じ hooks を差す
// 作った口（入口が 501 で止めない口）：op.ts の 3.5 と同じ決め方。fuzz はこの口だけを回す（まだの口が 501 で止まることは生成の試験が見る）
const built = ENDPOINTS.filter(
  (e) => h.hooks[e.operationId] || (e.generic && h.repo.hasColumn(e.table as TableName, "id")),
);
if (process.env["FUZZ_BUILT"])
  writeFileSync(process.env["FUZZ_BUILT"], JSON.stringify(built.map((e) => e.operationId)));
const srv = serve({ fetch: h.fetch, port, hostname: "127.0.0.1" }, () =>
  console.log(`[fuzz] 的を立てた http://127.0.0.1:${port}`),
);
const stop = async () => {
  srv.close();
  await h.close();
  process.exit(0);
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
