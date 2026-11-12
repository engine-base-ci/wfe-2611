// 契約 fuzz（G36・K-35）の的：実 Postgres（migration＋場合表の種）＋偽のセッション解決（Bearer boss／staff／ops）を HTTP で立てる。
//   認証そのものは packages/auth の試験が持つ。ここは「契約どおりの入力でも、契約の外の入力でも、サーバーが落ちない（500 を返さない）・返す形が契約どおり」を見る
import { serve } from "@hono/node-server";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ObjectStore } from "@kaname/storage";
import { localDriver } from "@kaname/storage/local";
import { ENDPOINTS } from "@kaname/contracts";
import type { TableName } from "@kaname/db/repository";
import { makeHarness } from "../harness.js";
import { agentHooks } from "../../src/hooks/agent.js";
import { bridgeHooks } from "../../src/hooks/bridge.js";
import { ticketHooks } from "../../src/hooks/tickets.js";
import { delegateHooks } from "../../src/hooks/delegate.js";
import { approveHooks } from "../../src/hooks/approve-complete.js";

const port = Number(process.env["FUZZ_PORT"] ?? 4791);
const h = await makeHarness();
// 本物のサーバー（src/server.ts）と同じ hooks を差す。差さない工場は scripts/ci/fuzz_targets.py の EXEMPT（理由つき）だけ（K-62・D-095）
//   PC をつなぐ（K-57）の置き場は試験の一時フォルダの偽物。外の置き場の署名は作らない（配布物の受け取りは 404 の形で回る）
const objects = new ObjectStore(h.repo, localDriver(mkdtempSync(join(tmpdir(), "fuzz-obj-"))), {
  signingSecret: "fuzz-test-files",
  externalSigner: { presignGet: async () => null },
});
Object.assign(
  h.hooks,
  agentHooks(h.pool),
  bridgeHooks({ appPool: h.pool, release: { dir: "", base: "" }, objects }),
  ticketHooks(h.pool),
  delegateHooks(h.pool),
  approveHooks(h.pool),
);
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
