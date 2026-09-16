// タイムラインと見え方の切替（T-US-06）：棒を押すと右に詳細・1023 以下は切替・リスト／カンバン／カレンダー
import { expect, test } from "@playwright/test";
import { WIDTHS } from "./_lib/browser";

test("USH-06-001 /dev/views：4 幅で横溢れ 0", async ({ page }) => {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    const res = await page.goto("/dev/views");
    expect(res?.status()).toBe(200);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
      `幅 ${width}`,
    ).toBeLessThanOrEqual(0);
  }
});
test("USH-06-002 タイムライン：3 段が描かれ、棒（行）を押すと右に詳細が出る。1023 以下は一覧と詳細を切り替える", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/dev/views");
  const tl = page.locator("[data-timeline]");
  await expect(tl).toBeVisible();
  await expect(tl.getByText("目標：受注 10 件").first()).toBeVisible();
  await expect(tl.getByText("検証：追い提案の返信率").first()).toBeVisible();
  await tl.getByText("施策：既存客への追い提案").first().click();
  await expect(page.locator("[data-timeline-detail]")).toContainText("施策：既存客への追い提案");
  await page.setViewportSize({ width: 800, height: 900 });
  await expect(page.locator(".timeline-chart")).toBeHidden();
  await page.getByRole("button", { name: "一覧へ" }).click();
  await expect(page.locator(".timeline-chart")).toBeVisible();
});
test("見え方の切替：リスト → カンバン（列に件数）→ カレンダー（同じデータ）", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/dev/views");
  await expect(page.locator('[data-view="list"] li')).toHaveCount(3);
  await page.getByRole("tab", { name: "カンバン" }).click();
  await expect(page.locator('[data-view="kanban"] section')).toHaveCount(3);
  await expect(page.locator('[data-view="kanban"]').getByText("セイコー様 追いメール")).toBeVisible();
  await page.getByRole("tab", { name: "カレンダー" }).click();
  await expect(page.locator('[data-view="calendar"]')).toContainText("2026年9月");
  await expect(page.locator('[data-view="calendar"]').getByText("京蟻 請求書")).toBeVisible();
});
