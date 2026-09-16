// 共通シェルの操作要素（T-US-01）：サイドバーの群を開閉する・実装済みの画面へのリンクを押す。行き先が未実装の項目は ops_block.py が BLOCKED（理由つき）
import { expect, test, type Page } from "@playwright/test";
import { loginAs, signupViaApi } from "./_lib/api";

const open = async (page: Page) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/dev/shell?screen=today&role=R1&ps=PS3");
  await expect(page.locator(".shell .side")).toBeVisible();
};
for (const [id, label] of [
  ["USH-01-010", "自分のAI"],
  ["USH-01-015", "仕事"],
  ["USH-01-020", "目標"],
  ["USH-01-026", "会社モデル"],
  ["USH-01-034", "設定と記録"],
] as const) {
  test(`${id} サイドバーの群「${label}」を押すと開き、もう一度押すと閉じる`, async ({ page }) => {
    await open(page);
    const btn = page.locator(".side-nav button.side-grp", { hasText: label }).first();
    await expect(btn).toBeVisible();
    const was = (await btn.getAttribute("aria-expanded")) === "true";
    await btn.click();
    await expect(btn).toHaveAttribute("aria-expanded", String(!was));
    await btn.click();
    await expect(btn).toHaveAttribute("aria-expanded", String(was));
  });
}
for (const [id, href, h1] of [
  ["USH-01-042", "/setup/bridge", "自分のPCをつなぐ"],
  ["USH-01-043", "/settings/credentials", "ログイン情報を預ける"],
] as const) {
  test(`${id} サイドバーのリンク ${href} を押すと開く（200・h1）`, async ({ page }) => {
    const u = await signupViaApi();
    await loginAs(page, u.token);
    await open(page);
    const link = page.locator(`.side-nav a[href="${href}"]`);
    if (!(await link.isVisible()))
      await page
        .locator(".side-group", { has: page.locator(`a[href="${href}"]`) })
        .locator("button.side-grp")
        .click();
    await link.click();
    await expect(page).toHaveURL(new RegExp(href.replace(/\//g, "\\/") + "$"));
    await expect(page.locator("h1")).toContainText(h1.slice(0, 6));
  });
}
