// ワークスペースの管理の中の画面（段 10・F9：チケットの設定 K-707〜K-709・メンバー K-710）の試験の道具：
//   モック /dev/mock/f9/<状態> と本番の画面を同じ幅で開き、同じ役の要素の値を比べる。比べ方は f9-match.ts の matchF9 と同じ。
//   違うのは待つ物だけ：matchF9 はナレッジの本文 .k-f9-main を待つが、この画面の本文は .k-me-page（ワークスペースの管理の骨組み）。
//   matchF9 が待つ物を選べるようになれば、この 1 枚は消せる（まとめ役に頼む）。
//   写しは test-results/f9-match/ に両方を撮って残す（人が見比べる用・判定には使わない）。テストはチケットを作る人が書き、実装する人は変えない
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Browser, type Page } from "@playwright/test";
import {
  compareFonts,
  compareRows,
  loadedFonts,
  readVals,
  type FidelityPair,
  type FidelityRow,
} from "../../../../scripts/ci/fidelity_compare.mjs";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "../../test-results/f9-match");
export const WS_WIDTHS = [375, 768, 1440] as const;
const BOX = ["width", "height", "x", "y", "background-color", "border-top-color", "border-top-left-radius"];
const TEXT = ["font-size", "font-weight", "color", "line-height", "texts"];
const CTRL = [
  "width",
  "height",
  "x",
  "y",
  "font-size",
  "color",
  "background-color",
  "border-top-color",
  "opacity",
  "texts",
];
const pair = (role: string, sel: string, props: string[]): FidelityPair => ({
  name: role,
  role,
  canvas: sel,
  app: sel,
  props,
});

/** 本文（外枠の中）の役割の組。外枠・第 2 ナビは比べない（外枠は別の部品 K-138・第 2 ナビは K-707 が別に見る） */
export const WS_PAIRS: FidelityPair[] = [
  pair("head", ".k-page-head", [...BOX, "texts"]),
  pair("h1", ".k-page-head h1", ["x", "y", ...TEXT]),
  pair("sub", ".k-page-sub", ["x", ...TEXT]),
  pair("head-btn", ".k-page-acts button", CTRL),
  pair("tab", ".k-tab", ["width", "height", "x", "y", "font-size", "font-weight", "color", "texts"]),
  pair("hint", ".k-f9s-hint", ["x", ...TEXT]),
  pair("list", ".k-f9s-list", BOX),
  pair("item", ".k-f9s-item", ["x", "height", "font-size", "color", "texts"]),
  pair("dot", ".k-f9s-dot", ["width", "height", "background-color"]),
  pair("form", ".k-f9s-form", ["x", "width"]),
  pair("swatch", ".k-f9s-swatch", ["width", "height", "x", "y", "background-color", "border-top-color"]),
  pair("template", ".k-f4d-editor", BOX),
  pair("stage-row", ".k-f9s-stage-row", [...BOX, "texts"]),
  pair("pill", ".k-f9s-pill", ["height", "x", "background-color", ...TEXT]),
  pair("grip", ".k-f9s-grip", ["width", "height", "x"]),
  pair("lock", ".k-f9s-lock", TEXT),
  pair("stage-edit", ".k-f9s-stage-edit", BOX),
  pair("options", ".k-f9s-options", BOX),
  pair("acts", ".k-f9s-acts button", CTRL),
  pair("group", ".k-f9m-group", BOX),
  pair("group-head", ".k-f9m-head", [...BOX, "texts"]),
  pair("code", ".k-inv-code", ["width", "height", "background-color", "texts"]),
  pair("row", ".k-inv-row", ["height", "x", "texts"]),
  pair("state", "[role='status'], [role='alert']", ["x", "width", ...TEXT]),
  pair("dialog", ".k-dialog", ["width", "x", "y", "background-color", "border-top-left-radius"]),
  pair("dialog-title", ".k-dialog h2", ["x", "y", ...TEXT]),
  pair("dialog-btn", ".k-dialog button[data-variant]", ["x", "y", ...CTRL]),
];

// 本文の編集欄（K-567 の DocEditor）は遅く読む。読み込みの間の枠（aria-busy）と読み終えた欄は高さが違うので、読み終えてから比べる
const settle = async (p: Page) => {
  await expect(p.locator('.k-f4d-ed2[aria-busy="true"]')).toHaveCount(0);
  await p.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
};

/** モックの状態 id と、本番の画面をその状態にする手順を受け、同じ幅で値を比べた行を返す */
export async function matchWs(
  browser: Browser,
  id: string,
  width: number,
  drive: (page: Page) => Promise<void>,
  opts: { pairs?: FidelityPair[]; skip?: readonly string[] } = {},
): Promise<{ rows: FidelityRow[]; bad: string[] }> {
  const pairs = opts.pairs ?? WS_PAIRS;
  const vp = { width, height: width === 375 ? 812 : 900 };
  const blockBridge = (p: Page) => p.route(/127\.0\.0\.1:38617/, (r) => r.fulfill({ status: 404, body: "" }));
  mkdirSync(OUT, { recursive: true });

  const mock = await browser.newPage({ viewport: vp, colorScheme: "light", reducedMotion: "reduce" });
  await blockBridge(mock);
  expect((await mock.goto(`/dev/mock/f9/${id}`))?.status(), `モック ${id}`).toBe(200);
  await expect(mock.locator(`[data-mock="${id}"] .k-me-page`)).toBeVisible();
  await mock.evaluate(() => document.fonts.ready);
  await mock.mouse.move(0, 0);
  await settle(mock);
  const mockVals = await readVals(mock, pairs, "canvas");
  const mockFonts = await loadedFonts(mock);
  await mock.screenshot({ path: join(OUT, `${id}-${width}-mock.png`), fullPage: true });
  await mock.close();

  const app = await browser.newPage({ viewport: vp, colorScheme: "light", reducedMotion: "reduce" });
  await blockBridge(app);
  await drive(app);
  await app.evaluate(() => document.fonts.ready);
  await app.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await app.mouse.move(0, 0);
  await settle(app);
  const appVals = await readVals(app, pairs, "app");
  const appFonts = await loadedFonts(app);
  await app.screenshot({ path: join(OUT, `${id}-${width}-app.png`), fullPage: true });
  await app.close();

  const skip = new Set(opts.skip ?? []);
  const rows: FidelityRow[] = [];
  pairs.forEach((p, i) => {
    const n = mockVals[i]?.__count ?? 0;
    const m = appVals[i]?.__count ?? 0;
    if (n === 0 && m === 0) return;
    rows.push({ part: p.name, prop: "当たった数", canvas: n, app: m, ok: n === m });
    if (n !== m) return;
    rows.push(...compareRows([p], [mockVals[i]!], [appVals[i]!]).filter((r) => r.prop !== "当たった数"));
  });
  rows.push(compareFonts(mockFonts, appFonts));
  const kept = rows.filter((r) => !skip.has(`${r.part}:${r.prop}`));
  const bad = kept
    .filter((r) => !r.ok)
    .map((r) => `${id} 幅 ${width}・${r.part}・${r.prop}：モック ${r.canvas} ／ 本番 ${r.app}`);
  return { rows: kept, bad };
}
