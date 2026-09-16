// 共通シェル（T-US-01・02）：4 幅で横溢れ 0・本文の最小幅（D-070）・役割で主ナビが変わる・枠の導出（D-065）・自分のAIのパネル（D-062）
import { expect, test, type Page } from "@playwright/test";
import { WIDTHS } from "./_lib/browser";

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const mainWidth = (page: Page) =>
  page.evaluate(
    () =>
      (document.querySelector(".threepane .detail, main.main .content") as HTMLElement | null)?.getBoundingClientRect()
        .width ?? 0,
  );

for (const screen of ["today", "goals", "clone-memory"]) {
  test(`/dev/shell?screen=${screen}：${WIDTHS.join("・")} で横溢れ 0`, async ({ page }) => {
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      const res = await page.goto(`/dev/shell?screen=${screen}`);
      expect(res?.status()).toBe(200);
      await expect(page.locator(".shell")).toBeVisible();
      expect(await overflow(page), `幅 ${width}`).toBeLessThanOrEqual(0);
    }
  });
}

test("幅 1440（パネル開）と 1180 で本文が 720px 以上（三画面の中央は 640 以上・D-070）", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/dev/shell?screen=goals");
  await expect(page.locator(".shell")).toBeVisible();
  expect(await mainWidth(page)).toBeGreaterThanOrEqual(720);
  await page.setViewportSize({ width: 1180, height: 900 });
  await page.goto("/dev/shell?screen=goals");
  expect(await mainWidth(page)).toBeGreaterThanOrEqual(720);
  await page.goto("/dev/shell?screen=today");
  await expect(page.locator("[data-threepane]")).toBeVisible();
  await page.locator(".threepane .queue button").first().click();
  expect(await mainWidth(page)).toBeGreaterThanOrEqual(640);
});

test("役割で主ナビの本数が変わる（R1＝6・R4＝4・R6＝運営 1）。無い役割の画面は錠前ではなく入口ごと無い", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const count = async (role: string) => {
    await page.goto(`/dev/shell?screen=today&role=${role}`);
    return page.locator(".side-nav > .side-item, .side-nav > .side-group").count();
  };
  expect(await count("R1")).toBe(6);
  expect(await count("R4")).toBe(4);
  await page.goto("/dev/shell?screen=today&role=R6");
  await expect(page.locator("main.norole")).toBeVisible(); // 運営に「今日」は無い
  expect(await page.locator(".side-nav > .side-item, .side-nav > .side-group").count()).toBe(1);
});

test("役割ごとの中身（data-roles）：R1 には代表の段、R3 には担当者の段だけ", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/dev/shell?screen=goals&role=R1");
  await expect(page.locator('[data-roles="R1 R2"]')).toBeVisible();
  await expect(page.locator('[data-roles="R3"]')).toHaveCount(0);
  await page.goto("/dev/shell?screen=goals&role=R3");
  await expect(page.locator('[data-roles="R3"]')).toBeVisible();
  await expect(page.locator('[data-roles="R1 R2"]')).toHaveCount(0);
});

test("枠の導出：PS0（PC 前）は はじめの設定の枠＝サイドバー・下タブ無し。PS3 はアプリの枠。PS4 は止まっている帯", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/dev/shell?screen=goals&ps=PS0");
  await expect(page.locator('.shell[data-frame="wizard"]')).toBeVisible();
  await expect(page.locator(".side")).toHaveCount(0);
  await expect(page.locator("[data-requires='data']")).toHaveCount(0); // データが無い時点で件数を出さない
  await page.goto("/dev/shell?screen=goals&ps=PS3");
  await expect(page.locator('.shell[data-frame="app"] .side')).toBeVisible();
  await page.goto("/dev/shell?screen=goals&ps=PS4");
  await expect(page.locator("[data-stopped]")).toBeVisible();
});

test("自分のAIのパネル：会話全体が読めて続けて話せる。閉じる／開く。PC 前は話せない理由が出る", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/dev/shell?screen=goals&ps=PS3");
  const panel = page.locator(".aipanel");
  await expect(panel).toBeVisible();
  await page.getByPlaceholder("続けて話す").fill("受注 10 件いける？");
  await page.getByRole("button", { name: "送る" }).click();
  await expect(panel.locator(".pm.u")).toContainText("受注 10 件いける？");
  await expect(panel.locator(".pm.a").last()).toContainText("受け取りました");
  await panel.locator(".ap-close").click();
  await expect(panel).toBeHidden();
  await page.locator(".ap-toggle").click();
  await expect(panel).toBeVisible();
  await page.goto("/dev/shell?screen=goals&ps=PS0");
  await expect(page.locator(".aipanel")).toHaveCount(0); // AI が無い時点にパネルは無い（data-requires="ai app"）
});

test("会話の部品：選択肢に「その他」「あとで」・承認カードに 承認／直す／止める・受領カードに取り消し", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/dev/shell?screen=today");
  await page.locator(".threepane .queue button").first().click();
  await expect(
    page.locator('[data-part="choices"]').getByRole("button", { name: "その他（自由に書く）" }),
  ).toBeVisible();
  await expect(page.locator('[data-part="choices"]').getByRole("button", { name: "あとで" })).toBeVisible();
  const ap = page.locator('[data-part="approval"]');
  for (const n of ["承認する", "直す", "止める"]) await expect(ap.getByRole("button", { name: n })).toBeVisible();
  await page.locator('[data-part="receipt"]').getByRole("button", { name: "取り消す" }).click();
  await expect(page.getByText("取り消しました")).toBeVisible();
});

test("スマホ 375：下タブが出て、三画面は一覧→中身→一覧へ を切り替える", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/dev/shell?screen=today");
  await expect(page.locator(".tabbar")).toBeVisible();
  await expect(page.locator(".threepane .detail")).toBeHidden();
  await page.locator(".threepane .queue button").first().click();
  await expect(page.locator(".threepane .detail")).toBeVisible();
  await page.getByRole("button", { name: "一覧へ" }).click();
  await expect(page.locator(".threepane .queue")).toBeVisible();
});
