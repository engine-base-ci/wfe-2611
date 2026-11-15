// K-238 キャンバスとの見た目の突き合わせ（実 Chrome・本番の形で組み立てた画面の上・CI の web の組の G70）。
//   設定 04_design/fidelity.json の組のうち、突き合わせに入れた組（enrolled）だけを、組の幅ごとに 1 本ずつ流す。
//   キャンバスの絵（04_design/canvas/<絵>.dc.html）と画面（組の app の道を、画面を整える道具 FIDELITY_STATES[組の state] で整えた後）を
//   同じ幅で描き、組の値（計算後の CSS の値・幅と高さ・位置 x と y・字の一覧）と、実際に読み込んだ書体を比べる。1 つでも違えば赤。
//   キャンバスが外から読む書体（fonts.googleapis.com・fonts.gstatic.com）は、画面と同じ手元の書体に差し替え、外へは出ない（G-11）。
//   待つのは組の要素が全部描かれるまで（決めた秒数で待たない）。比べ方は scripts/ci/fidelity_compare.mjs（K-216）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import {
  compareFonts,
  compareRows,
  loadedFonts,
  mismatches,
  readVals,
} from "../../../../scripts/ci/fidelity_compare.mjs";
import { FIDELITY_STATES, routeCanvasFonts } from "../_lib/fidelity-states";

interface Pair {
  name: string;
  role: string;
  canvas: string;
  app: string;
  props: string[];
}
interface Group {
  id: string;
  kind: string;
  canvas: string;
  app: string;
  state: string;
  widths: number[];
  pairs: Pair[];
  owner: string;
  enrolled: boolean;
}

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../../..");
const CFG = JSON.parse(readFileSync(join(ROOT, "04_design/fidelity.json"), "utf8")) as { groups: Group[] };
const ENROLLED = CFG.groups.filter((g) => g.enrolled);

/** 組の要素が全部（キャンバスの側か画面の側のセレクタで）描かれるまで待つ */
async function drawn(page: Page, pairs: Pair[], side: "canvas" | "app") {
  for (const p of pairs) await page.locator(p[side]).first().waitFor({ state: "visible" });
  await page.evaluate(() => document.fonts.ready);
}

test("K238-VF-001 設定を読み、組が 1 つ以上在り、入れた組はどれも画面を整える道具を持つ（入れた組の数を注記に出す）", () => {
  expect(CFG.groups.length).toBeGreaterThan(0);
  for (const g of ENROLLED) expect(FIDELITY_STATES[g.state], `${g.id} の state ${g.state}`).toBeTruthy();
  test
    .info()
    .annotations.push({ type: "突き合わせに入れた組", description: `${ENROLLED.length} / ${CFG.groups.length}` });
});

test("K238-VF-002 キャンバスを開いても外（fonts.googleapis.com・fonts.gstatic.com などの手元でない所）へ 1 本も出ず、書体は読み込める", async ({
  browser,
}) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, colorScheme: "light" });
  const outside: string[] = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (!["file:", "data:"].includes(u.protocol) && !["127.0.0.1", "localhost"].includes(u.hostname))
      outside.push(r.url());
  });
  await routeCanvasFonts(page);
  await page.goto(pathToFileURL(join(ROOT, "04_design/canvas/Main.dc.html")).href);
  await page.locator("h1").first().waitFor({ state: "visible" });
  await page.evaluate(() => document.fonts.ready);
  expect(outside).toEqual([]);
  expect((await loadedFonts(page)).length).toBeGreaterThan(0);
  await page.close();
});

for (const g of ENROLLED) {
  for (const w of g.widths) {
    test(`K238-VF-003 ${g.id}（${g.canvas}）幅 ${w}：組の値と読み込んだ書体がキャンバスと同じ`, async ({ browser }) => {
      const canvasPage = await browser.newPage({ viewport: { width: w, height: 1000 }, colorScheme: "light" });
      await routeCanvasFonts(canvasPage);
      await canvasPage.goto(pathToFileURL(join(ROOT, `04_design/canvas/${g.canvas}.dc.html`)).href);
      await drawn(canvasPage, g.pairs, "canvas");
      const canvasVals = await readVals(canvasPage, g.pairs, "canvas");
      const canvasFonts = await loadedFonts(canvasPage);
      await canvasPage.close();

      const appPage = await browser.newPage({ viewport: { width: w, height: 1000 }, colorScheme: "light" });
      await FIDELITY_STATES[g.state]!(appPage, g.app);
      await drawn(appPage, g.pairs, "app");
      const appVals = await readVals(appPage, g.pairs, "app");
      const appFonts = await loadedFonts(appPage);
      await appPage.close();

      const rows = [...compareRows(g.pairs, canvasVals, appVals), compareFonts(canvasFonts, appFonts)];
      const bad = rows.filter((r) => !r.ok).map((r) => `${r.part}・${r.prop}：キャンバス ${r.canvas} ／ 画面 ${r.app}`);
      expect(mismatches(rows), bad.join("\n")).toBe(0);
    });
  }
}
