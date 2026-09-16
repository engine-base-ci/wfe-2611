import { defineConfig, devices } from "@playwright/test";

// 流れ（L2・journeys/plan.json の J-xx）を staging で最後まで通す（T-I-09〜17）。BASE_URL は staging の Vercel Preview。ローカルでは流さない（規約 test-ladder §5）
export default defineConfig({
  testDir: "./journeys",
  timeout: 60_000,
  fullyParallel: false,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: process.env["BASE_URL"] ?? "http://127.0.0.1:3123", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
