// 到達性（G-04）：ナビ・カード・ボタンの href 集合 ⇔ 実在ルート集合。全画面共通ヘッダのナビが 404、を機械で捕まえる
import { expect, test } from "@playwright/test";
import { collectInternalHrefs, existingPageRoutes, hrefViolations, unimplementedFlowRoutes } from "./_lib/browser";

test("GET / が 200 で、土台（html・body・h1）が描かれる", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.status()).toBe(200);
  await expect(page.locator("h1")).toBeVisible();
});

test("/ の内部リンクは全部 実在ルート（page.tsx）を指す", async ({ page }) => {
  await page.goto("/");
  const hrefs = await collectInternalHrefs(page);
  const existing = existingPageRoutes();
  expect(
    hrefViolations(hrefs, existing),
    `404 になる href: ${JSON.stringify(hrefViolations(hrefs, existing))}`,
  ).toEqual([]);
});

test("検査そのものが赤になれる（無いルートを指す href を 1 つ入れると違反として出る）", () => {
  const existing = existingPageRoutes();
  expect(existing).toContain("/");
  expect(hrefViolations(["/", "/no-such-route"], existing)).toEqual(["/no-such-route"]);
  expect(hrefViolations(["/goals/abc"], ["/goals/:id"])).toEqual([]);
});

test("flow の route のうち page.tsx が無いものを数で報告する（T-U-* の残り。0 になるまで画面は完了でない）", async () => {
  const left = unimplementedFlowRoutes(existingPageRoutes());
  test.info().annotations.push({
    type: "未実装の route",
    description: `${left.length} 件：${left.slice(0, 8).join(" ")}${left.length > 8 ? " …" : ""}`,
  });
  expect(Array.isArray(left)).toBe(true);
});
