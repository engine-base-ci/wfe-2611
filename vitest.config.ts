import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// 単体試験の DB（実 Postgres・RLS はモックしない）。接続先はここだけで決める（試験のファイルは DATABASE_URL を読むだけ）。
//   CI は段の env の DATABASE_URL だけを使う（手元の開発 DB に黙ってつなぎに行かない）。
//   手元で DATABASE_URL が無ければ、開発の Postgres（infra/docker-compose.dev.yml・scripts/dev/up.sh が作る 127.0.0.1:55433 の kaname_test）
const DEV_TEST_DATABASE_URL = "postgres://postgres:postgres@127.0.0.1:55433/kaname_test";
const databaseUrl = process.env["DATABASE_URL"] || (process.env["CI"] ? undefined : DEV_TEST_DATABASE_URL);
if (databaseUrl) process.env["DATABASE_URL"] = databaseUrl; // globalSetup（DB の排他）も同じ接続先を見る

// G3 unit test + coverage。閾値は 03_architecture/foundation_gates.json（lines 80 / branches 70）。
export default defineConfig({
  // 画面（apps/web）の「@/〜」は apps/web の中を指す（tsconfig の paths と同じ）。@kaname/〜 は workspace のまま
  resolve: { alias: [{ find: /^@\//, replacement: fileURLToPath(new URL("./apps/web/", import.meta.url)) }] },
  test: {
    include: [
      "packages/*/src/**/*.test.ts",
      "packages/*/test/**/*.test.ts",
      "apps/*/src/**/*.test.ts",
      "apps/*/test/**/*.test.ts",
    ],
    fileParallelism: false, // DB のテストは同じ表を種で入れ替えるので直列（RLS は実表・モックしない）
    // 起動（beforeAll・makeHarness など）の上限。式は「実測の最大 × 3」（D-133.2）：実測は CI の記録（2026-11-09 の緑の 3 回の vitest の blob・
    //   流れた 276 ファイル全部）の beforeAll の最大 3.6 秒（packages/auth/test/session_watch.test.ts）× 3 ＝ 10.7 秒 → 11 秒。CI の記録が変わったら引き直す
    hookTimeout: 11_000,
    env: databaseUrl ? { DATABASE_URL: databaseUrl } : {},
    // 別の vitest（別の段・別の端末）が同じ DB を同時に使わないよう、試験の間は DB に勧告ロックを持つ（取れるまで待つ）
    globalSetup: ["packages/db/test/global-lock.ts"],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.ts", "apps/*/src/**/*.ts"],
      exclude: [
        "**/*.test.ts",
        "**/*.d.ts",
        "**/cli.ts",
        "packages/contracts/src/types.ts",
        "packages/errors/src/catalog.ts",
      ], // 生成物は測らない
      thresholds: { lines: 80, branches: 70, functions: 80, statements: 80 },
      reporter: ["text", "json-summary"],
    },
  },
});
