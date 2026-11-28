// 横溢れ（G-05）：375・768・1024・1440 で scrollWidth − clientWidth を数値で測る。共通シェルが入ったら（T-US-01）全画面で回す
import { expect, test } from "@playwright/test";
import { measureOverflow, WIDTHS } from "./_lib/browser";

test(`/ は ${WIDTHS.join("・")} の 4 幅で横に溢れない（数値 0）`, async ({ page }) => {
  const r = await measureOverflow(page, "/");
  expect(r.map((x) => x.width)).toEqual([...WIDTHS]);
  for (const x of r) expect(x.overflow, `幅 ${x.width} で ${x.overflow}px 溢れ`).toBeLessThanOrEqual(0);
});

// 無い画面（404）と権限なしの本文が潰れていないこと。
// 由来：tokens.css が @theme に --spacing-2xl:96px を置いていたため Tailwind の
// max-w-2xl が var(--spacing-2xl) を引き、本文が 96px（1 行 1 文字）になっていた。
// 名前空間の衝突なので、値ではなく「実際に描かれた幅」で見張る。
test("無い画面（404）の本文が潰れていない（幅 1400 で 400px 以上・横溢れ 0）", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/this-route-does-not-exist");
  await expect(page.locator('[data-state="not-found"]')).toBeVisible();
  const m = await page.evaluate(() => {
    const el = document.querySelector("main") as HTMLElement;
    return {
      w: Math.round(el.getBoundingClientRect().width),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  expect(m.w, `本文が ${m.w}px（トークンの名前空間が Tailwind と衝突していないか）`).toBeGreaterThan(400);
  expect(m.overflow).toBeLessThanOrEqual(0);
});
