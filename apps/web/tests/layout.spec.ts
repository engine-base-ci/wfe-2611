// 横溢れ（G-05）：375・768・1024・1440 で scrollWidth − clientWidth を数値で測る。共通シェルが入ったら（T-US-01）全画面で回す
import { expect, test } from "@playwright/test";
import { measureOverflow, WIDTHS } from "./_lib/browser";

test(`/ は ${WIDTHS.join("・")} の 4 幅で横に溢れない（数値 0）`, async ({ page }) => {
  const r = await measureOverflow(page, "/");
  expect(r.map((x) => x.width)).toEqual([...WIDTHS]);
  for (const x of r) expect(x.overflow, `幅 ${x.width} で ${x.overflow}px 溢れ`).toBeLessThanOrEqual(0);
});
