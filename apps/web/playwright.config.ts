import { defineConfig, devices } from "@playwright/test";

// 画面の L1（実ブラウザ）。BASE_URL があれば staging（規約：L1〜L3 は staging）。無ければローカルの next dev を立てる（土台の確認だけ。staging の行は BLOCKED）
const base = process.env["BASE_URL"];
export default defineConfig({
  testDir: "./tests",
  timeout: 60_000, // 開発機は DB が Docker の向こう。登録 1 件に十数秒かかる日がある（実機の遅さでテストを落とさない）
  expect: { timeout: 15_000 }, // next dev は初回描画が遅い。実機の待ちを既定 5 秒から上げる
  fullyParallel: false,
  workers: 1, // next dev は 1 本。並列で叩くと初回コンパイルが詰まってタイムアウトする
  reporter: [
    ["list"],
    ["html", { open: "never" }],
    ["json", { outputFile: process.env["PW_REPORT"] ?? "test-results/report.json" }],
    // CI の記録（ticket-flow が行 ID で判定する JUnit）。置き場は組の作業場所の絶対の道で渡す（K-176）
    ...(process.env["PLAYWRIGHT_JUNIT_OUTPUT_NAME"]
      ? [["junit", { outputFile: process.env["PLAYWRIGHT_JUNIT_OUTPUT_NAME"] }] as const]
      : []),
  ], // json は op_gate.py と write_results.mjs が読む
  use: {
    baseURL: base ?? "http://127.0.0.1:3123",
    trace: "retain-on-failure",
    // 押す・入れるの待ち（click・fill など）の上限。既定は 0（上限なし＝試験の 60 秒まで待つ）。CI は PW_ACTION_TIMEOUT に expect と同じ 15 秒を渡す：
    //   押せない部品を 60 秒待たずに expect と同じ長さで赤にする（緑の試験の意味は変えない・画面の移り（goto・waitForURL）は navigationTimeout 0 のまま・K-1304）
    actionTimeout: Number(process.env["PW_ACTION_TIMEOUT"] ?? 0),
  },
  // ローカルでダウンロードできないときは入っている Google Chrome を使う（PW_CHANNEL=chrome）。CI は playwright install chromium
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(process.env["PW_CHANNEL"] ? { channel: process.env["PW_CHANNEL"] } : {}),
      },
    },
  ],
  ...(base
    ? {}
    : {
        webServer: {
          command: "pnpm exec next dev --port 3123",
          url: "http://127.0.0.1:3123",
          reuseExistingServer: true,
          timeout: 120_000,
        },
      }),
});
