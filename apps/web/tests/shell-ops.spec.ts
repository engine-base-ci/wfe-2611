// 共通シェルの操作要素（T-US-01）：サイドバーの群を開閉する・実装済みの画面へのリンクを押す。行き先が未実装の項目は ops_block.py が BLOCKED（理由つき）
import { expect, test, type Page } from "@playwright/test";
import { loginAs, setupStep, signupViaApi } from "./_lib/api";

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
    // 見本の画面（/dev/shell）もログインが要る（2026-09-30：ログインせずに開いて落ちていた）
    const u = await signupViaApi();
    await setupStep(u.memberId, 6);
    await loginAs(page, u.token);
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
// /setup/bridge の見出しは「PC と使った量」。PC が無いときはつなぐ小窓の題「PC をつなぐ」が読み上げの h1（後ろは読み上げから外れる）
const BRIDGE_H1 = /^(PC と使った量|PC をつなぐ)$/;
for (const [id, href, h1] of [
  ["USH-01-042", "/setup/bridge", BRIDGE_H1],
  ["USH-01-043", "/settings/credentials", /^預けたログイン情報$/], // K-356：新しい画面の見出し（読み上げの見出しで見る）
] as [string, string, string | RegExp][]) {
  test(`${id} サイドバーのリンク ${href} を押すと開く（200・h1）`, async ({ page }) => {
    const u = await signupViaApi();
    await setupStep(u.memberId, 6); // アプリの枠の画面は、はじめの設定を通した人だけが開ける（D-089）。通していない人は設定の途中へ戻る
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
    if (typeof h1 === "string") await expect(page.locator("h1")).toContainText(h1.slice(0, 6));
    else await expect(page.getByRole("heading", { level: 1, name: h1 })).toBeVisible();
  });
}

// 会話モードへの入口（D-103：会話はどこで開いても同じ 1 本）。サイドバーと下タブの「〇〇AIと話す」
test("USH-01-011 サイドバーの「高本AIと話す」を押すと会話モード（/ai/chat）が開く", async ({ page }) => {
  const u = await signupViaApi();
  await setupStep(u.memberId, 6);
  await loginAs(page, u.token);
  await open(page);
  const link = page.locator('.side-nav a[href="/ai/chat"]').first();
  if (!(await link.isVisible()))
    await page
      .locator(".side-group", { has: page.locator('a[href="/ai/chat"]') })
      .first()
      .locator("button.side-grp")
      .click();
  await link.click();
  await expect(page).toHaveURL(/\/ai\/chat$/);
  await expect(page.getByRole("heading", { level: 1, name: "自分のAIと話す" }).first()).toBeVisible({
    timeout: 15_000,
  });
});
test("USH-01-050 スマホの下タブの「高本AIと話す」を押すと会話モード（/ai/chat）が開く", async ({ page }) => {
  const u = await signupViaApi();
  await setupStep(u.memberId, 6);
  await loginAs(page, u.token);
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/dev/shell?screen=today&role=R1&ps=PS3");
  await page.locator('.tabbar a[href="/ai/chat"]').first().click();
  await expect(page).toHaveURL(/\/ai\/chat$/);
  await expect(page.getByRole("heading", { level: 1, name: "自分のAIと話す" }).first()).toBeVisible({
    timeout: 15_000,
  });
});

// 押した群だけ開け閉めし、ほかの群は開いていればそのまま（2026-09-30 user「トグルで開閉・他を開いても開いたまま」）。画面を移っても開いたまま
test("USH-01-015 USH-01-020 開いている群は、ほかの群を開いても閉じない。押した群だけ閉じ、画面を開き直しても開いたまま", async ({
  page,
}) => {
  const u = await signupViaApi();
  await setupStep(u.memberId, 6);
  await loginAs(page, u.token);
  await open(page);
  const grp = (label: string) => page.locator(".side-nav button.side-grp", { hasText: label }).first();
  const set = async (label: string, want: boolean) => {
    if ((await grp(label).getAttribute("aria-expanded")) !== String(want)) await grp(label).click();
  };
  await set("仕事", false);
  await set("目標", false);
  await grp("仕事").click();
  await grp("目標").click();
  await expect(grp("仕事"), "目標を開いても仕事は開いたまま").toHaveAttribute("aria-expanded", "true");
  await expect(grp("目標")).toHaveAttribute("aria-expanded", "true");
  await grp("仕事").click();
  await expect(grp("仕事")).toHaveAttribute("aria-expanded", "false");
  await expect(grp("目標"), "押した群だけ閉じる").toHaveAttribute("aria-expanded", "true");
  await page.reload();
  await expect(grp("目標"), "開き直しても開いたまま").toHaveAttribute("aria-expanded", "true");
  await expect(grp("仕事")).toHaveAttribute("aria-expanded", "false");
});
