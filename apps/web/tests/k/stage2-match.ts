// 段 2 の画面の葉（K-316・K-317 …）の試験の道具：モック /dev/mock/f1/<状態> と本番の画面を同じ幅で開き、同じ役の要素の値を比べる。
//   モックと本番は同じ部品（features/F1/*/views・components/k）を使うので、セレクタは両方で同じ。値は fidelity_compare の readVals で読み、
//   compareRows で比べる（px は ±2）。写しは test-results/stage2-match/ に両方を撮って残す（人が見比べる用・判定には使わない）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
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

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "../../test-results/stage2-match");

export const MATCH_WIDTHS = [375, 768, 1440] as const;
const BOX_PROPS = ["width", "height", "x", "y", "background-color", "border-top-color", "border-top-left-radius"];
const TEXT_PROPS = ["font-size", "font-weight", "color", "line-height", "texts"];
const CTRL_PROPS = [
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

/** 入口の画面の役（どの状態でも同じセレクタ。当たらない役は両方 0 個なら一致） */
export const AUTH_PAIRS: FidelityPair[] = [
  ["box", '[data-part="auth-box"]', BOX_PROPS],
  ["h1", '[data-part="auth-box"] h1', ["x", "y", ...TEXT_PROPS]],
  ["lead", '[data-part="auth-box"] .k-auth-lead', ["x", "y", "width", ...TEXT_PROPS]],
  ["alert", '[data-part="auth-box"] [role="alert"]', ["x", "y", "width", ...TEXT_PROPS, "background-color"]],
  ["result", '[data-part="auth-box"] .k-auth-result', [...BOX_PROPS, "texts"]],
  ["note", '[data-part="auth-box"] .k-auth-note', ["x", "y", ...TEXT_PROPS]],
  ["note-box", '[data-part="auth-box"] .k-auth-note-box', [...BOX_PROPS, "texts"]],
  ["primary", '[data-part="auth-box"] button[data-variant="primary"]', CTRL_PROPS],
  ["outlined", '[data-part="auth-box"] button[data-variant="outlined"]', CTRL_PROPS],
  ["input", '[data-part="auth-box"] input:not(.k-login-code-box)', CTRL_PROPS.filter((p) => p !== "texts")],
  [
    "code-box",
    '[data-part="auth-box"] .k-login-code-box',
    ["width", "height", "x", "y", "font-size", "border-top-color"],
  ],
  ["choice", '[data-part="auth-box"] .k-auth-choice', [...BOX_PROPS, "opacity", "texts"]],
  ["links", '[data-part="auth-box"] .k-login-links', ["x", "y", "width", "texts"]],
  ["alt", '[data-part="auth-box"] .k-auth-alt', ["x", "y", ...TEXT_PROPS]],
  ["strip", ".k-status-strip", [...BOX_PROPS, ...TEXT_PROPS]],
].map(([role, sel, props]) => ({
  name: String(role),
  role: String(role),
  canvas: String(sel),
  app: String(sel),
  props: props as string[],
}));

/** 切り替わりの途中を読まない：動いている transition（短くしても次の描画までは前の値のまま）が全部終わるのを待つ（K-316） */
const settle = (p: Page) =>
  p.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));

export interface MatchOptions {
  /** 比べる役割の組（既定は入口の箱の AUTH_PAIRS）。外枠の中・小窓・困ったときの区画は、画面の葉が自分の組を渡す */
  pairs?: FidelityPair[];
  /** 比べない「役・値」（例："primary:opacity"）。訳は呼ぶ側の試験の名前と注に書く */
  skip?: readonly string[];
  /** 本番の側の入力欄の値を読む前にそろえる（モックの値と同じにする）・フォーカスを外す */
  blur?: boolean;
}

/** モックの状態 id と、本番の画面をその状態にする手順を受け、同じ幅で値を比べた行を返す */
export async function matchMock(
  browser: Browser,
  id: string,
  width: number,
  drive: (page: Page) => Promise<void>,
  opts: MatchOptions = {},
): Promise<{ rows: FidelityRow[]; bad: string[] }> {
  const pairs = opts.pairs ?? AUTH_PAIRS;
  const vp = { width, height: width === 375 ? 812 : 900 };
  // 動きを止めて開く（globals.css が transition を 0.01ms にする）。フォーカスを外した直後・ボタンの形が変わった直後に、切り替わりの途中の色や薄さを読まない（K-316）
  const blockBridge = (p: Page) => p.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  mkdirSync(OUT, { recursive: true });

  const mock = await browser.newPage({ viewport: vp, colorScheme: "light", reducedMotion: "reduce" });
  await blockBridge(mock);
  expect((await mock.goto(`/dev/mock/f1/${id}`))?.status(), `モック ${id}`).toBe(200);
  await expect(mock.locator(`[data-mock="${id}"] h1`).first()).toBeVisible();
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
  if (opts.blur) await app.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await app.mouse.move(0, 0);
  await settle(app);
  const appVals = await readVals(app, pairs, "app");
  const appFonts = await loadedFonts(app);
  await app.screenshot({ path: join(OUT, `${id}-${width}-app.png`), fullPage: true });
  await app.close();

  const skip = new Set(opts.skip ?? []);
  // 役ごとに：両方 0 個なら比べない（その状態に無い役）。数が違えば違う。同じ数なら最初の 1 つの値（texts は全部）を比べる
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
