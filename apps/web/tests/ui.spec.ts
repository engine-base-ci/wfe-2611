// 部品（T-US-05）：操作の状態・的の大きさ・スマホの入力欄 16px（G14）。4 幅の横溢れ
import { expect, test } from "@playwright/test";
import { WIDTHS } from "./_lib/browser";

test("USH-05-001 /dev/ui：4 幅で横溢れ 0", async ({ page }) => {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    const res = await page.goto("/dev/ui");
    expect(res?.status()).toBe(200);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
      `幅 ${width}`,
    ).toBeLessThanOrEqual(0);
  }
});
test("USH-05-002 押せるものは 24px 以上・focus-visible の輪郭・hover で色が変わる", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/dev/ui");
  const small = await page.$$eval("button, a[href]", (els) =>
    els
      .filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && (r.width < 24 || r.height < 24);
      })
      .map((e) => e.textContent?.trim() ?? e.tagName),
  );
  expect(small, "24px 未満の的").toEqual([]);
  const btn = page.getByRole("button", { name: "承認する" });
  const before = await btn.evaluate((e) => getComputedStyle(e).backgroundColor);
  await btn.hover();
  await expect.poll(() => btn.evaluate((e) => getComputedStyle(e).backgroundColor)).not.toBe(before);
  await page.keyboard.press("Tab");
  const focused = await page.evaluate(() => {
    const e = document.activeElement as HTMLElement;
    return getComputedStyle(e).outlineStyle !== "none" && getComputedStyle(e).outlineWidth !== "0px";
  });
  expect(focused).toBe(true);
});
test("スマホ 375 の入力欄は 16px 以上（拡大を起こさない）・エラー文は何が起きた＋次の一手", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/dev/ui");
  const fs = await page
    .locator("input")
    .first()
    .evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  expect(fs).toBeGreaterThanOrEqual(16);
  await expect(page.locator("p[role=alert]")).toContainText("会社名を入れてください");
});
