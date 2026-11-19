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
import { HOOK_MODULES } from "../../src/hooks/all.generated.js";
import { buildHooks, type HookDeps } from "../../src/hooks/registry.js";
import { resetWorkIdle } from "../../src/features/F1/password-reset/index.js";
import { migrateAuth } from "@kaname/auth/migrate";
import { createAuth } from "@kaname/auth";
import { ActionGateway, RateLimiter } from "@kaname/actions";
import type { Config } from "@kaname/config";

const port = Number(process.env["FUZZ_PORT"] ?? 4791);
const h = await makeHarness();
// 認証の表（kaname_auth）は認証の接続からしか触れない（0059）。認証の接続は下のログインの部品の 1 つ（login.pool）にそろえる
const DB_URL = process.env["DATABASE_URL"]!;
await migrateAuth(DB_URL);
// ログイン（K-301）は本物のログインの部品（Better Auth・kaname_auth の表）で回す。偽のセッション（Bearer boss）は入口だけが読み、
//   ログインの口は送られたメールとパスワードを部品で確かめる（登録の無いメールは 401・形の違うメールは 422・数の上限で 429）
const login = createAuth({
  authDatabaseUrl: DB_URL.replace(/\/\/[^@]*@/, "//kaname_auth:kaname_auth@"),
  appPool: h.pool,
  secret: "fuzz-test-secret-0123456789-abcdefghij",
  baseURL: `http://127.0.0.1:${port}`,
  poolMax: 2,
});
// 新しいパスワードを決める口（K-314）は、部品と同じ形でハッシュを作るためにログインと同じ本物の認証の部品を、漏れの照合に関門 C1 を使う。
//   照合の外への口は落ちている扱い（外に出ない・照合が落ちている間は通す D-128.134 の道を回る）
const actions = new ActionGateway(h.repo, {}, new RateLimiter(600), 1_000, async () => {
  throw new Error("fuzz の的は外に出ない");
});
// 本物のサーバー（src/server.ts）と同じ一覧（apps/api/src/hooks/all.generated.ts）を差す（K-326）。的から外す工場と、的だけ違う引数で作る工場は、
//   各 hooks のファイルの register の fuzz に書く（理由つき・scripts/ci/fuzz_targets.py が見る・K-62・D-095）
//   PC をつなぐ（K-57）の置き場は試験の一時フォルダの偽物。外の置き場の署名は作らない（配布物の受け取りは 404 の形で回る）
const objects = new ObjectStore(h.repo, localDriver(mkdtempSync(join(tmpdir(), "fuzz-obj-"))), {
  signingSecret: "fuzz-test-files",
  externalSigner: { presignGet: async () => null },
});
// 的の設定は口の答えに効く値だけを持つ（Config の全部の欄は持たない）。送出先（mailer）は差さない（外に送らず、ログの道を通る）
const fuzzConfig = {
  opsEmail: "ops-fuzz@example.com",
  webBaseUrl: "http://127.0.0.1",
  baseUrl: "http://127.0.0.1",
  bridgeReleaseDir: "",
  bridgeReleaseBase: "",
} as unknown as Config;
const fuzzDeps: HookDeps = {
  auth: login.auth,
  appPool: h.pool,
  authPool: login.pool,
  repo: h.repo,
  actions,
  objects,
  config: fuzzConfig,
};
Object.assign(h.hooks, buildHooks(HOOK_MODULES, fuzzDeps, "fuzz"));
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
  await resetWorkIdle(); // 答えの後の仕事（再設定の送り）が終わってから接続を閉じる
  await login.pool.end();
  await h.close();
  process.exit(0);
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
