// 画面の試験の汎用の道具（K-257 が運ぶ。K-226・K-227・K-228・K-229・K-231 の試験が、ここか detail-kit.ts を通して読む）。
//   口の差し替えは前からの土台 tests/features/F5/approve-complete.harness.ts（mockApi・ticketOf など）を使い、ここには足りない物だけを置く。
//   ・押せない物の確かめ（expectInert）：在る・aria-disabled="true"・薄さ 0.55（正本の使えない状態の部品）・押しても Enter でも
//     道が変わらず、口が呼ばれず、小窓が開かない
//   ・キャンバスとの突き合わせ（fidelityConfigTest・fidelityCompareTests）：04_design/fidelity.json の組を読み、組の幅ごとにキャンバスと画面の値を比べる
//   詳細の本文だけの道具（DOC_TOOLS・DETAIL_INERT・detailRows）は detail-kit.ts（K-226 が運ぶ）に置く
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expect, test, type Locator, type Page, type Request } from "@playwright/test";
import {
  compareFonts,
  compareRows,
  groupAt,
  loadedFonts,
  mismatches,
  readVals,
  type FidelityAt,
  type FidelityPair,
} from "../../../../scripts/ci/fidelity_compare.mjs";
import { FIDELITY_STATES, routeCanvasFonts } from "../_lib/fidelity-states";

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, "../../../..");
export const WIDTHS = [320, 375, 768, 1024, 1440] as const;
/** 正本の使えない状態の部品（button-disabled・input-disabled・tab-disabled）の薄さ（本番の組み立てで「.55」になっても同じに数で比べる） */
export const DISABLED_OPACITY = 0.55;
/** 計算後の薄さを数で（祖先の薄さは掛けない・その要素の opacity だけ） */
export const opacityOf = async (loc: Locator) => Number.parseFloat(await cssOf(loc, "opacity"));
export const LINE = "rgb(221, 226, 233)";
export const WHITE = "rgb(255, 255, 255)";
export const RED_TEXT = "rgb(185, 28, 28)";

export const overflowX = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
/** 時計を止めた試験で、条件が満たされるまで 16 ミリ秒ずつ時計を進める。口の答え・動的に読む部品は止めた時計の
 *  setTimeout の上で描かれる（TanStack Query の知らせ・next/dynamic）ので、時計を進めないと出てこない */
export async function stepUntil(page: Page, done: () => Promise<boolean>, steps = 300): Promise<void> {
  for (let i = 0; i < steps; i++) {
    if (await done()) return;
    await page.clock.runFor(16);
  }
  expect(await done(), `時計を ${steps * 16} ミリ秒進めても出ない`).toBe(true);
}
export const box = async (loc: Locator) => (await loc.first().boundingBox())!;
export const cssOf = (loc: Locator, prop: string) =>
  loc.first().evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);
/** 要素の左の端（左へのはみ出しは scrollWidth − clientWidth に出ないので、箱の左の端で見る） */
export const leftOf = (loc: Locator) => loc.first().evaluate((e) => e.getBoundingClientRect().left);
/** 要素の文字の 1 文字目の左の端 */
export const firstCharLeft = (loc: Locator) =>
  loc.first().evaluate((e) => {
    const walk = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
    const t = walk.nextNode();
    if (!t) return Number.NaN;
    const r = document.createRange();
    r.setStart(t, 0);
    r.setEnd(t, 1);
    return r.getBoundingClientRect().left;
  });

/** 口に飛んだ要求を数える（押せない物を押しても数が増えないことを見る）。GET の読み直しは数えない */
export function countWrites(page: Page) {
  const c = { n: 0, paths: [] as string[] };
  page.on("request", (r: Request) => {
    if (!/\/api\//.test(r.url()) || r.method() === "GET" || r.method() === "OPTIONS") return;
    c.n++;
    c.paths.push(`${r.method()} ${new URL(r.url()).pathname}`);
  });
  return c;
}

/** 押せない物：在る・aria-disabled・薄さ 0.55・押しても Enter でも、道が変わらず・書く口が呼ばれず・小窓の数が変わらない（既定は 0。小窓の中の物は開いている数を渡す） */
export async function expectInert(page: Page, loc: Locator, name: string, writes: { n: number }, openDialogs = 0) {
  await expect(loc, name).toHaveCount(1);
  await expect(loc, name).toHaveAttribute("aria-disabled", "true");
  expect(await opacityOf(loc), `${name} の薄さ`).toBeCloseTo(DISABLED_OPACITY, 3);
  const url = page.url();
  const before = writes.n;
  await loc.click({ force: true });
  await loc.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Space");
  expect(page.url(), `${name} を押して道が変わった`).toBe(url);
  expect(writes.n, `${name} を押して書く口が呼ばれた`).toBe(before);
  // 押す前から開いていた小窓（openDialogs）の数のまま：新しく開かず、開いていた小窓も閉じない
  await expect(page.locator('[role="dialog"], [role="alertdialog"]'), `${name} を押して小窓の数が変わった`).toHaveCount(
    openDialogs,
  );
}

// ---------------------------------------------------------------- キャンバスとの突き合わせ
export interface FidelityGroup {
  id: string;
  kind: string;
  canvas: string;
  app: string;
  state: string;
  widths: number[];
  pairs: FidelityPair[];
  owner: string;
  enrolled: boolean;
  /** 幅ごとの絵（K-1301）：その幅だけ比べる絵とセレクタを替える */
  at?: Record<string, FidelityAt>;
}
const readGroups = () =>
  (JSON.parse(readFileSync(join(ROOT, "04_design/fidelity.json"), "utf8")) as { groups: FidelityGroup[] }).groups;
export const groupOf = (id: string) => readGroups().find((g) => g.id === id);

/** 突き合わせの設定：組が在り・enrolled・持ち主・画面を整える道具に鍵・画面の側のセレクタに外枠の右のパネル（.k-panel）が無い */
export function fidelityConfigTest(rowTitle: string, ids: string[], owner: string) {
  test(rowTitle, () => {
    for (const id of ids) {
      const g = groupOf(id);
      expect(g, `組 ${id}`).toBeTruthy();
      expect(g!.enrolled, `組 ${id} の enrolled`).toBe(true);
      expect(g!.owner, `組 ${id} の持ち主`).toBe(owner);
      for (const p of g!.pairs) expect(p.app, `${id}・${p.name}`).not.toContain(".k-panel");
      expect(FIDELITY_STATES[g!.state], `組 ${id} の画面を整える道具 ${g!.state}`).toBeTruthy();
    }
  });
}

/** 組の幅ごとに、キャンバスと画面の組の値と読み込んだ書体が同じ（違う所を全部出して赤） */
export function fidelityCompareTests(rowId: string, id: string, label: string) {
  const g = groupOf(id);
  for (const w of g?.widths ?? [1440, 375]) {
    test(`${rowId} ${id}（${label}）幅 ${w}：組の値と読み込んだ書体がキャンバスと同じ`, async ({ browser }) => {
      expect(g, `組 ${id}`).toBeTruthy();
      // 幅ごとの絵（組の at・K-1301）：その幅で比べる絵とセレクタ
      const at = groupAt(g!, w);
      const canvasPage = await browser.newPage({ viewport: { width: w, height: 1000 }, colorScheme: "light" });
      await routeCanvasFonts(canvasPage);
      await canvasPage.goto(pathToFileURL(join(ROOT, "04_design/canvas", `${at.canvas}.dc.html`)).href);
      for (const p of at.pairs) await canvasPage.locator(p.canvas).first().waitFor({ state: "visible" });
      await canvasPage.evaluate(() => document.fonts.ready);
      const canvasVals = await readVals(canvasPage, at.pairs, "canvas");
      const canvasFonts = await loadedFonts(canvasPage);
      await canvasPage.close();

      const appPage = await browser.newPage({ viewport: { width: w, height: 1000 }, colorScheme: "light" });
      await appPage.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
      await FIDELITY_STATES[g!.state]!(appPage, g!.app);
      for (const p of at.pairs) await appPage.locator(p.app).first().waitFor({ state: "visible" });
      await appPage.evaluate(() => document.fonts.ready);
      const appVals = await readVals(appPage, at.pairs, "app");
      const appFonts = await loadedFonts(appPage);
      await appPage.close();

      const rows = [...compareRows(at.pairs, canvasVals, appVals), compareFonts(canvasFonts, appFonts)];
      const bad = rows.filter((r) => !r.ok).map((r) => `${r.part}・${r.prop}：キャンバス ${r.canvas} ／ 画面 ${r.app}`);
      expect(mismatches(rows), bad.join("\n")).toBe(0);
    });
  }
}
