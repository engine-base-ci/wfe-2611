// 見た目の突き合わせ（visual-fidelity の段 2）：キャンバスの画面と新しい画面を同じ幅で実ブラウザに描き、
//   同じ役割の要素の見た目の値（大きさ・色・角丸・書体・位置・字の一覧）を比べる。両方のスクリーンショットも残す
//   node scripts/ci/visual_fidelity.mjs .qa/visual-fidelity/K-28/pairs.json [BASE_URL] [--strict]
//   node scripts/ci/visual_fidelity.mjs --group <組の id> --width <幅> [BASE_URL] [--strict] [--out <フォルダ>]
//     （--group は 04_design/fidelity.json の組を読む。画面を整える道具 fidelity-states.ts は通さない＝K-238 の試験が通す）
//   --storage <道>：画面の側だけ、Playwright の storageState（ログインの印など）を読んで開く
//   出力：result.json・canvas.png・app.png。比べ方は fidelity_compare.mjs（K-216）。
//   --strict：違う値が 1 つでもあれば 1 で終わる（無ければ 0。弱い形は数えるだけで 0）
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { compareFonts, compareRows, exitCode, loadedFonts, mismatches, readVals } from "./fidelity_compare.mjs";
// 実ブラウザは画面（apps/web）の Playwright を使う（版を 1 つにそろえる）
const { chromium } = createRequire(resolve("apps/web/package.json"))("@playwright/test");

const WAIT_MS = 15_000;
const HEIGHT = 900;

function parseArgs(argv) {
  const o = { strict: false, rest: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--strict") o.strict = true;
    else if (a === "--group") o.group = argv[++i];
    else if (a === "--width") o.width = Number(argv[++i]);
    else if (a === "--out") o.out = argv[++i];
    else if (a === "--storage") o.storage = argv[++i];
    else o.rest.push(a);
  }
  return o;
}

/** 設定を 1 つの形（canvas の道・app の道・viewport・pairs・extra・出力の置き場）にそろえる */
function loadConfig(o) {
  if (o.group) {
    const all = JSON.parse(readFileSync(resolve("04_design/fidelity.json"), "utf8"));
    const g = all.groups.find((x) => x.id === o.group);
    if (!g) throw new Error(`04_design/fidelity.json に組 ${o.group} が無い`);
    const width = o.width || g.widths[0];
    if (!g.widths.includes(width)) throw new Error(`組 ${o.group} の幅に ${width} が無い（${g.widths.join("・")}）`);
    return {
      canvas: `04_design/canvas/${g.canvas}.dc.html`,
      app: g.app,
      viewport: { width, height: HEIGHT },
      pairs: g.pairs,
      extra: [],
      outDir: o.out ?? `.qa/visual-fidelity/${g.id}-${width}`,
      base: o.rest[0],
    };
  }
  const cfgPath = o.rest[0];
  if (!cfgPath) throw new Error("設定の道（pairs.json）か --group が要る");
  const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
  // 前の形（K-28）：pairs の canvas・app がセレクタ
  return { ...cfg, outDir: o.out ?? dirname(cfgPath), base: o.rest[1] };
}

/** 組の要素が描かれるまで待つ（決めた時間だけ待つのはやめた）。描かれない要素は「（無い）」として比べる */
async function waitForParts(page, sels) {
  await page
    .waitForFunction((list) => list.every((s) => document.querySelector(s)), sels, { timeout: WAIT_MS })
    .catch(() => undefined);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

async function read(browser, cfg, url, side, storageState) {
  const page = await browser.newPage({ viewport: cfg.viewport, colorScheme: "light", ...(storageState ? { storageState } : {}) });
  await page.goto(url, { waitUntil: "load" });
  await waitForParts(page, cfg.pairs.map((p) => p[side]));
  await page.screenshot({ path: `${cfg.outDir}/${side}.png`, fullPage: true });
  const vals = await readVals(page, cfg.pairs, side);
  const loaded = await loadedFonts(page);
  await page.close();
  return { vals, loaded };
}

const fmt = (v) => (Array.isArray(v) ? `[${v.join("・")}]` : v);

async function main() {
  const o = parseArgs(process.argv.slice(2));
  const cfg = loadConfig(o);
  const base = cfg.base ?? "http://127.0.0.1:3123";
  mkdirSync(cfg.outDir, { recursive: true });
  const browser = await chromium.launch();
  try {
    const C = await read(browser, cfg, pathToFileURL(resolve(cfg.canvas)).href, "canvas");
    const A = await read(browser, cfg, new URL(cfg.app, base).href, "app", o.storage);
    // 新しい画面だけ、明るい・暗い・スマホも残す（比べる相手のキャンバスは明るいテーマだけ）
    for (const [name, scheme, w] of cfg.extra ?? []) {
      const page = await browser.newPage({
        viewport: { width: w, height: cfg.viewport.height },
        colorScheme: scheme,
        ...(o.storage ? { storageState: o.storage } : {}),
      });
      await page.goto(new URL(cfg.app, base).href, { waitUntil: "load" });
      await waitForParts(page, cfg.pairs.map((p) => p.app));
      await page.screenshot({ path: `${cfg.outDir}/app-${name}.png` });
      await page.close();
    }
    const rows = [...compareRows(cfg.pairs, C.vals, A.vals), compareFonts(C.loaded, A.loaded)];
    const bad = mismatches(rows);
    writeFileSync(
      `${cfg.outDir}/result.json`,
      JSON.stringify({ at: new Date().toISOString(), canvas: cfg.canvas, app: cfg.app, viewport: cfg.viewport, rows, mismatches: bad }, null, 1) + "\n",
    );
    for (const r of rows) console.log(`${r.ok ? "OK  " : "DIFF"} ${r.part}・${r.prop}：キャンバス ${fmt(r.canvas)} ／ 新しい画面 ${fmt(r.app)}`);
    console.log(`違う値 ${bad} / ${rows.length}`);
    return exitCode(rows, o.strict);
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
