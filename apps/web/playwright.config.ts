import { defineConfig, devices } from "@playwright/test";

// 画面の L1（実ブラウザ）。BASE_URL があれば staging（規約：L1〜L3 は staging）。無ければローカルの next dev を立てる（土台の確認だけ。staging の行は BLOCKED）
const base = process.env["BASE_URL"];
export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: { timeout: 15_000 }, // next dev は初回描画が遅い。実機の待ちを既定 5 秒から上げる
  fullyParallel: false,
  workers: 1, // next dev は 1 本。並列で叩くと初回コンパイルが詰まってタイムアウトする
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: base ?? "http://127.0.0.1:3123", trace: "retain-on-failure" },
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
