// K-367「前の PC をつなぐ画面 /setup/bridge/legacy を消す」の画面の試験（実 Chrome）。行 ID（K367-UI-…）は 11_tickets/K-367.md の表と 1 対 1。
//   口は網の手前で差し替える（つないでいる PC の一覧は空）。本人の Bridge（127.0.0.1:38617）にも届かせない（網の手前で 404）。
//   テストはチケットを切る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Request, type Route } from "@playwright/test";
// 作り物の秘密の値は apps/web/test/_fake/secrets.ts に置いて import する（.gitleaks.toml が置き場だけを外す・K-328）
import { K367_WEB_TOKEN } from "../../test/_fake/secrets";

const BODY = 'section[aria-labelledby="pc-list-title"]';

test.beforeEach(async ({ page }) => {
  await page.addInitScript((t) => window.localStorage.setItem("kaname.token", t), K367_WEB_TOKEN);
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(/\/api\/(v1|auth-ext|auth)\//, async (route: Route, req: Request) => {
    const p = new URL(req.url()).pathname;
    const ok = req.method() === "GET" && p === "/api/v1/bridge/devices";
    await route.fulfill({
      status: ok ? 200 : 404,
      contentType: "application/json",
      body: JSON.stringify(ok ? { data: [], meta: {} } : { error: "not_found", code: "NOT_FOUND" }),
    });
  });
});

test("K367-UI-001 前の画面の道 /setup/bridge/legacy を開くと 404（見つからないのページ）", async ({ page }) => {
  const res = await page.goto("/setup/bridge/legacy");
  expect(res?.status()).toBe(404);
});

test("K367-UI-002 今の画面 /setup/bridge に「前の設定の画面」の文もリンクも無い（legacy へのリンク 0）", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const res = await page.goto("/setup/bridge");
  expect(res?.status()).toBe(200);
  await expect(page.locator(BODY)).toBeVisible();
  await expect(page.locator('a[href*="/setup/bridge/legacy"]')).toHaveCount(0);
  await expect(page.locator('[data-act="legacy"]')).toHaveCount(0);
  await expect(page.getByText("前の設定の画面")).toHaveCount(0);
});
