// 見た目の突き合わせ（visual-fidelity の段 2）：キャンバスの画面と新しい画面を同じ幅で実ブラウザに描き、
//   同じ役割の要素の見た目の値（大きさ・色・角丸・書体）を比べる。両方のスクリーンショットも残す
//   node scripts/ci/visual_fidelity.mjs .qa/visual-fidelity/K-28/pairs.json [BASE_URL]
//   出力：同じフォルダの result.json・canvas.png・app.png。値が違う組を数える（色・角丸・書体は完全一致、大きさは ±2px）
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
// 実ブラウザは画面（apps/web）の Playwright を使う（版を 1 つにそろえる）
const { chromium } = createRequire(resolve("apps/web/package.json"))("@playwright/test");

const cfgPath = process.argv[2];
const base = process.argv[3] ?? "http://127.0.0.1:3123";
const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
const outDir = dirname(cfgPath);
const PX = /^-?\d+(\.\d+)?px$/;

const browser = await chromium.launch();
const read = async (url, side) => {
  const page = await browser.newPage({ viewport: cfg.viewport, colorScheme: "light" });
  await page.goto(url, { waitUntil: "networkidle" }).catch(() => page.goto(url));
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${outDir}/${side}.png` });
  const vals = await page.evaluate(
    (pairs) =>
      pairs.map((p) => {
        const el = document.querySelector(p.sel);
        if (!el) return null;
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return Object.fromEntries(
          p.props.map((k) => [k, k === "width" ? `${Math.round(r.width)}px` : k === "height" ? `${Math.round(r.height)}px` : cs.getPropertyValue(k)]),
        );
      }),
    cfg.pairs.map((p) => ({ sel: p[side], props: p.props })),
  );
  // 書体は「指定の名前」でなく、実際に読み込んだ書体で比べる（名前だけ合って、端末の別の書体で描いていることがある）
  const loaded = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...new Set([...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/["']/g, "")))];
  });
  await page.close();
  return { vals, loaded };
};
const C = await read(pathToFileURL(resolve(cfg.canvas)).href, "canvas");
const A = await read(new URL(cfg.app, base).href, "app");
const canvas = C.vals;
const app = A.vals;
// 新しい画面だけ、明るい・暗い・スマホも残す（比べる相手のキャンバスは明るいテーマの 1440 だけ）
for (const [name, scheme, w] of cfg.extra ?? []) {
  const page = await browser.newPage({ viewport: { width: w, height: cfg.viewport.height }, colorScheme: scheme });
  await page.goto(new URL(cfg.app, base).href);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${outDir}/app-${name}.png` });
  await page.close();
}
await browser.close();

const firstFont = (v) => v.split(",")[0].trim().replace(/["']/g, "").toLowerCase();
const rows = [];
cfg.pairs.forEach((p, i) => {
  for (const k of p.props) {
    const c = canvas[i]?.[k] ?? "（無い）";
    const a = app[i]?.[k] ?? "（無い）";
    let ok;
    if (PX.test(c) && PX.test(a)) ok = Math.abs(parseFloat(c) - parseFloat(a)) <= 2;
    else if (k === "font-family") ok = firstFont(c) === firstFont(a);
    else ok = c === a;
    rows.push({ part: p.name, prop: k, canvas: c, app: a, ok });
  }
});
const famOf = (f) => (f ?? "").replace(/ Variable$/, "").toLowerCase();
const cf = C.loaded.map(famOf), af = A.loaded.map(famOf);
rows.push({ part: "読み込んだ書体", prop: "document.fonts", canvas: C.loaded.join(", ") || "（無い）", app: A.loaded.join(", ") || "（無い）", ok: cf.length > 0 && cf.every((f) => af.includes(f)) });
const bad = rows.filter((r) => !r.ok);
writeFileSync(`${outDir}/result.json`, JSON.stringify({ at: new Date().toISOString(), canvas: cfg.canvas, app: cfg.app, viewport: cfg.viewport, rows, mismatches: bad.length }, null, 1) + "\n");
for (const r of rows) console.log(`${r.ok ? "OK  " : "DIFF"} ${r.part}・${r.prop}：キャンバス ${r.canvas} ／ 新しい画面 ${r.app}`);
console.log(`違う値 ${bad.length} / ${rows.length}`);
process.exit(0);
