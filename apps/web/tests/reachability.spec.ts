// 到達性（G-04）：ナビ・カード・ボタンの href 集合 ⇔ 実在ルート集合。全画面共通ヘッダのナビが 404、を機械で捕まえる
import { expect, test } from "@playwright/test";
import { collectInternalHrefs, existingPageRoutes, hrefViolations, unimplementedFlowRoutes } from "./_lib/browser";
import { bridgeRow, loginAs, signupViaApi, viewerViaApi } from "./_lib/api";

test("GET / が 200 で、土台（html・body・h1）が描かれる", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.status()).toBe(200);
  await expect(page.locator("h1")).toBeVisible();
});

test("USH-00-002 / の内部リンクは全部 実在ルート（page.tsx）を指す", async ({ page }) => {
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

// 入口と行き先の規則（D-086）。画面ではなく規則なので、画面の導出（G1〜G10）では守れない
test("USH-00-012 入っていない人が / を開くと 入る画面（/login）へ送られる", async ({ page }) => {
  await page.goto("/");
  await page.waitForURL(/\/login$/, { timeout: 15_000 });
  await expect(page.locator("form[data-state='n'] h1")).toHaveText("ログイン");
});
test("USH-00-013 入っている人（PC 未接続）が / を開くと 自分のPCをつなぐ へ送られる", async ({ page }) => {
  const u = await signupViaApi();
  await loginAs(page, u.token);
  await page.goto("/");
  await page.waitForURL(/\/setup\/bridge$/, { timeout: 15_000 });
  await expect(page.locator("h1")).toHaveText("自分のPCをつなぐ");
});
test("USH-00-014 入っている人（PC 接続済み）が / を開くと 今日 へ送られる", async ({ page }) => {
  const u = await signupViaApi();
  await loginAs(page, u.token);
  await bridgeRow(u);
  await page.goto("/");
  await page.waitForURL(/\/today$/, { timeout: 15_000 });
  expect(page.url()).toMatch(/\/today$/); // 今日の画面そのものは T-U-13（今は 404 の中身）
});
test("USH-00-015 無いパスは「この画面はありません」と戻る導線（素の 404 にしない）", async ({ page }) => {
  await page.goto("/no-such-page");
  await expect(page.locator("[data-state='not-found'] h1")).toHaveText("この画面はありません");
  await page.getByRole("link", { name: "ログインへ戻る" }).click();
  await expect(page).toHaveURL(/\/login$/);
  const u = await signupViaApi();
  await loginAs(page, u.token);
  await page.goto("/no-such-page");
  await page.getByRole("link", { name: "入口へ戻る" }).click();
  await page.waitForURL(/\/setup\/bridge$/, { timeout: 15_000 });
});
test("USH-00-016 その権限で見えない画面は「この権限では見えない」と導線（無言の空画面にしない）", async ({ page }) => {
  const v = await viewerViaApi();
  await loginAs(page, v.token);
  await page.goto("/settings/credentials");
  await expect(page.locator("[data-state='forbidden'] h1")).toHaveText("この権限では見えない");
  await expect(page.getByRole("link", { name: "見える画面へ" })).toBeVisible();
});
