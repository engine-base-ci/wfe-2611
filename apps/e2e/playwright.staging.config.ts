import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

// 統合テスト（staging）の設定（K-65・K-204）。流す命令は pnpm e2e:staging（main から手で起こす staging-e2e.yml の回だけ）。
//   前の通し（./journeys・playwright.config.ts）とは置き場も設定も分ける。
//   記録：JUnit だけ（出し先は回が渡す PLAYWRIGHT_JUNIT_OUTPUT_NAME）。標準出力は試験の名前と結果だけ、JUnit は書いた後に伏せ直す（_lib/scrub-reporter.ts）。
//   list・line・dot・html の報告は使わない（落ちた試験の文に staging の住所・確認のリンクが乗る）。画面の写し・動画・trace は残さない
//   （staging の画面には登録した宛先が写る・K-186）。流し直しで通さない（retries 0）。1 本ずつ順に（workers 1：送り元ごとの回数の上限と、輪の間合いを混ぜない）
const HERE = dirname(fileURLToPath(import.meta.url));
const JUNIT = process.env["PLAYWRIGHT_JUNIT_OUTPUT_NAME"] ?? join(HERE, "..", "..", "junit", "e2e-staging.xml");
const BASE_URL = process.env["STAGING_BASE_URL"];
if (!BASE_URL)
  throw new Error("環境の値 STAGING_BASE_URL が無い（staging-e2e.yml の統合テストの段が渡す。手元では流さない）");

export default defineConfig({
  testDir: "./staging",
  testMatch: /k\d+-[^/]*\.spec\.ts$/,
  outputDir: "./test-results/staging",
  timeout: 240_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  reporter: [
    ["junit", { outputFile: JUNIT }],
    ["./staging/_lib/scrub-reporter.ts", { junit: JUNIT }],
  ],
  use: {
    baseURL: BASE_URL,
    viewport: { width: 1440, height: 1000 },
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } }],
});
