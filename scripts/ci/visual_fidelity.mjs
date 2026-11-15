// 見た目の突き合わせ（visual-fidelity の段 2）：キャンバスの画面と新しい画面を同じ幅で実ブラウザに描き、
//   同じ役割の要素の見た目の値（大きさ・色・角丸・書体・位置・字の一覧・当たった数）を比べる。両方のスクリーンショットも残す
//   node scripts/ci/visual_fidelity.mjs --group <組の id> [--width <幅>] [BASE_URL] [--report-only] [--out <フォルダ>] [--storage <道>]
//   node scripts/ci/visual_fidelity.mjs .qa/visual-fidelity/K-28/pairs.json [BASE_URL] [--report-only]   （前の形・K-28）
//     --group：04_design/fidelity.json の組を読む。--width を省くと組の全部の幅を回す。画面を整える道具 fidelity-states.ts は通さない（K-238 の試験が通す）
//     --storage：画面の側だけ、Playwright の storageState（ログインの印など）を読んで開く
//     --report-only：数えるだけ（違いがあっても 0）。付けなければ、違う値が 1 つでもあれば 1。引数が不正なら 2
//   出力：既定は .qa/visual-fidelity/out/<組>-<幅>/（版に入らない）の result.json・canvas.png・app.png。比べ方は fidelity_compare.mjs（K-216）
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import {
  ArgError,
  compareFonts,
  compareRows,
  defaultOutDir,
  exitFor,
  loadedFonts,
  mismatches,
  parseArgs,
  readVals,
  waitRows,
  widthsFor,
} from "./fidelity_compare.mjs";
// 実ブラウザは画面（apps/web）の Playwright を使う（版を 1 つにそろえる）
const { chromium } = createRequire(resolve("apps/web/package.json"))("@playwright/test");

const WAIT_MS = 15_000;
const SETTLE_MS = 250;
const SETTLE_TRIES = 8;
const HEIGHT = 900;
// 動きを止める（小窓が出てくるときの transform が x・y・幅に乗らないように）。キャンバスと画面の両方に入れる
const STILL_CSS = "*,*::before,*::after{animation:none !important;transition:none !important;caret-color:transparent !important}";

/** 回す組と幅の一覧（設定を 1 つの形にそろえる） */
function loadRuns(o) {
  if (o.group) {
    const all = JSON.parse(readFileSync(resolve("04_design/fidelity.json"), "utf8"));
    const g = all.groups.find((x) => x.id === o.group);
    if (!g) throw new ArgError(`04_design/fidelity.json に組 ${o.group} が無い`);
    const widths = widthsFor(g, o.width);
    return widths.map((width) => ({
      name: `${g.id}-${width}`,
      canvas: `04_design/canvas/${g.canvas}.dc.html`,
      app: g.app,
      viewport: { width, height: HEIGHT },
      pairs: g.pairs,
      extra: [],
      outDir: o.out ? (widths.length > 1 ? `${o.out}/${width}` : o.out) : defaultOutDir(g.id, width),
      base: o.rest[0],
    }));
  }
  const cfgPath = o.rest[0];
  if (!cfgPath) throw new ArgError("設定の道（pairs.json）か --group が要る");
  const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
  // 前の形（K-28）：pairs の canvas・app がセレクタ
  return [{ ...cfg, name: basename(dirname(cfgPath)), outDir: o.out ?? defaultOutDir(basename(dirname(cfgPath))), base: o.rest[1] }];
}

/** 組の要素が描かれるまで待つ。時間切れなら出なかったセレクタを返す（黙って比べ始めない） */
async function waitForParts(page, sels) {
  const ok = await page
    .waitForFunction((list) => list.every((s) => document.querySelector(s)), sels, { timeout: WAIT_MS })
    .then(() => true)
    .catch(() => false);
  if (ok) return [];
  return page.evaluate((list) => list.filter((s) => !document.querySelector(s)), sels);
}

/** 読み込みが済むのを待つ：読み込み中の印（aria-busy）が消え、値を 2 回読んで同じになるまで */
async function settle(page, pairs, side) {
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: WAIT_MS }).catch(() => undefined);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  let prev = JSON.stringify(await readVals(page, pairs, side));
  for (let i = 0; i < SETTLE_TRIES; i++) {
    await page.waitForTimeout(SETTLE_MS);
    const now = JSON.stringify(await readVals(page, pairs, side));
    if (now === prev) return JSON.parse(now);
    prev = now;
  }
  return JSON.parse(prev);
}

async function open(browser, cfg, url, storageState) {
  const page = await browser.newPage({
    viewport: cfg.viewport,
    colorScheme: "light",
    reducedMotion: "reduce",
    ...(storageState ? { storageState } : {}),
  });
  await page.goto(url, { waitUntil: "load" });
  await page.addStyleTag({ content: STILL_CSS });
  return page;
}

async function read(browser, cfg, url, side, storageState) {
  const page = await open(browser, cfg, url, storageState);
  const missing = await waitForParts(page, cfg.pairs.map((p) => p[side]));
  const vals = await settle(page, cfg.pairs, side);
  const loaded = await loadedFonts(page);
  // 値を先に読み、写しは後（写しを撮る間に描き直されても値は揺れない）
  await page.screenshot({ path: `${cfg.outDir}/${side}.png`, fullPage: true });
  await page.close();
  return { vals, loaded, missing };
}

const fmt = (v) => (Array.isArray(v) ? `[${v.join("・")}]` : v);

async function runOne(browser, cfg, o) {
  const base = cfg.base ?? "http://127.0.0.1:3123";
  mkdirSync(cfg.outDir, { recursive: true });
  const C = await read(browser, cfg, pathToFileURL(resolve(cfg.canvas)).href, "canvas");
  const A = await read(browser, cfg, new URL(cfg.app, base).href, "app", o.storage);
  // 新しい画面だけ、明るい・暗い・スマホも残す（比べる相手のキャンバスは明るいテーマだけ）
  for (const [name, scheme, w] of cfg.extra ?? []) {
    const page = await open(browser, { ...cfg, viewport: { width: w, height: cfg.viewport.height } }, new URL(cfg.app, base).href, o.storage);
    await page.emulateMedia({ colorScheme: scheme });
    await waitForParts(page, cfg.pairs.map((p) => p.app));
    await page.screenshot({ path: `${cfg.outDir}/app-${name}.png` });
    await page.close();
  }
  const rows = [
    ...waitRows("canvas", C.missing),
    ...waitRows("app", A.missing),
    ...compareRows(cfg.pairs, C.vals, A.vals),
    compareFonts(C.loaded, A.loaded),
  ];
  const bad = mismatches(rows);
  writeFileSync(
    `${cfg.outDir}/result.json`,
    JSON.stringify({ at: new Date().toISOString(), canvas: cfg.canvas, app: cfg.app, viewport: cfg.viewport, rows, mismatches: bad }, null, 1) + "\n",
  );
  console.log(`== ${cfg.name}（幅 ${cfg.viewport.width}）`);
  for (const r of rows) console.log(`${r.ok ? "OK  " : "DIFF"} ${r.part}・${r.prop}：キャンバス ${fmt(r.canvas)} ／ 新しい画面 ${fmt(r.app)}`);
  console.log(`違う値 ${bad} / ${rows.length}`);
  return rows;
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  const runs = loadRuns(o);
  const browser = await chromium.launch();
  try {
    const all = [];
    for (const cfg of runs) all.push(...(await runOne(browser, cfg, o)));
    return exitFor(all, o);
  } finally {
    await browser.close();
  }
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error(`visual_fidelity：${e instanceof Error ? e.message : String(e)}`);
    process.exit(2);
  },
);
