// K-1301 の試験（実 Chrome）：絵 MobileList に足した 2 つの包み（見出しの帯 header.kn-mlist-head・本文の箱 div.kn-mlist-body）は見た目を変えない。
//   幅 375・高さ 844（絵の大きさ）で開き、包んだままの写しと、頁の中で包みを外しタブに下の罫線を戻した写しが 1 点も違わないことを見る。
//   書体は手元の物に差し替える（routeCanvasFonts・外へ出ない）。待つのは見出しと書体が描かれるまで（決めた秒数で待たない）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { readVals } from "../../../../scripts/ci/fidelity_compare.mjs";
import { routeCanvasFonts } from "../_lib/fidelity-states";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const URL_ML = pathToFileURL(join(ROOT, "04_design/canvas/MobileList.dc.html")).href;

async function open(page: Page) {
  await routeCanvasFonts(page);
  await page.goto(URL_ML);
  await page.locator("h1").filter({ visible: true }).first().waitFor({ state: "visible" });
  await page.evaluate(() => document.fonts.ready);
}

test.use({ viewport: { width: 375, height: 844 }, colorScheme: "light" });

test("K1301-FA-017 幅 375：包みを外しタブに下の罫線を戻した写しと、包んだままの写しが 1 点も違わない（見た目を変えない）", async ({
  page,
}) => {
  await open(page);
  const wrapped = await page.screenshot({ animations: "disabled" });
  const found = await page.evaluate(() => {
    const head = document.querySelector("header.kn-mlist-head");
    const body = document.querySelector("div.kn-mlist-body");
    const tabs = head?.querySelector('[role="tablist"]') as HTMLElement | null;
    if (!head || !body || !tabs) return false;
    tabs.style.borderBottom = "1px solid #DDE2E9";
    head.replaceWith(...Array.from(head.childNodes));
    body.replaceWith(...Array.from(body.childNodes));
    return true;
  });
  expect(found, "包み（header.kn-mlist-head・div.kn-mlist-body）とその中のタブが無い").toBe(true);
  await page.evaluate(() => document.fonts.ready);
  const plain = await page.screenshot({ animations: "disabled" });
  expect(Buffer.compare(wrapped, plain), "包むと見た目が変わった").toBe(0);
});

test("K1301-FA-018 幅 375：見出しの帯と本文の箱はどちらも 1 つ見え、帯は見出しとタブを、箱は絞りの札と 1 件 1 行を中に持つ", async ({
  page,
}) => {
  await open(page);
  const pair = (sel: string) => ({ name: sel, role: "試し", canvas: sel, app: sel, props: ["height", "width"] });
  const vals = await readVals(page, [pair("header.kn-mlist-head"), pair("div.kn-mlist-body")], "canvas");
  for (const v of vals) {
    expect(v?.__count).toBe(1);
    expect(parseFloat(String(v?.height))).toBeGreaterThan(0);
  }
  const head = page.locator("header.kn-mlist-head");
  await expect(head.locator("h1")).toHaveText("チケット");
  await expect(head.getByRole("tablist")).toBeVisible();
  const body = page.locator("div.kn-mlist-body");
  await expect(body.getByRole("button", { name: /^すべて/ })).toBeVisible();
  await expect(body.locator('a[href="MobileDetail.dc.html"]').first()).toBeVisible();
});
