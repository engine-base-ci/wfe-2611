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
  // 画面の .tsx は Next と同じ自動の JSX（import React なし）。既定の古い形だと、単体の試験が .tsx を読んだとき
  //   上の階で JSX を作る部品（components/k/shell.tsx など）が「React is not defined」で落ちる（K-691）
  esbuild: { jsx: "automatic" },
  test: {
    include: [
      "packages/*/src/**/*.test.ts",
      "packages/*/test/**/*.test.ts",
      "apps/*/src/**/*.test.ts",
      "apps/*/test/**/*.test.ts",
    ],
    fileParallelism: false, // DB のテストは同じ表を種で入れ替えるので直列（RLS は実表・モックしない）
    // 起動（beforeAll・makeHarness など）の上限。式は「実測 × 3」（D-133.2）。実測は 2026-11-13 の CI の記録 23 回
    //   （GitHub の回 43352218866〜43405479104・1 回の中で 3 台の VM が同時に走る）：unit の組は 920 ファイルで 10.47 秒まで
    //   （43375496021・authz_rows）、spec の組は 2 回（43381413825・43400367373）が 11 秒で切れた。
    //   切れた回の下限を入れて、実測は 最大 11 秒 × 3 ＝ 33 秒。CI の記録が変わったら scripts/ci/hook_timeout.py measure で引き直す
    hookTimeout: 33_000,
    // 試験の本体の上限（既定は 5 秒）。CI の台が混むと（CI を 3 本同時に流すと）、パスワードを確かめる重い計算を含む口の試験が
    //   5 秒を超えて赤になった（ログインの試験 13 本）。確かめの中身は変えず、口の試験と DB を使う試験の全部をここ 1 か所で 30 秒にする
    //   （決める人の答え answer=c58ca37bdab7）。もっと長く要る試験（何十回も続けて口を叩く など）だけ、試験の最後の引数で長くする
    testTimeout: 30_000,
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
