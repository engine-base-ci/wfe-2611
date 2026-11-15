// K-238 キャンバスとの見た目の突き合わせ（実 Chrome・本番の形で組み立てた画面の上・CI の web の組の G70）。
//   設定 04_design/fidelity.json の組のうち、突き合わせに入れた組（enrolled）だけを、組の幅ごとに 1 本ずつ流す。
//   キャンバスの絵（04_design/canvas/<絵>.dc.html）と画面（組の app の道を、画面を整える道具 FIDELITY_STATES[組の state] で整えた後）を
//   同じ幅で描き、組の値（計算後の CSS の値・幅と高さ・位置 x と y・字の一覧）と、実際に読み込んだ書体を比べる。1 つでも違えば赤。
//   キャンバスが外から読む書体（fonts.googleapis.com・fonts.gstatic.com）は、画面と同じ手元の書体に差し替え、外へは出ない（G-11）。
//   待つのは組の要素が全部描かれるまで（決めた秒数で待たない）。比べ方は scripts/ci/fidelity_compare.mjs（K-216）。
//   値の読み方（K-216 の申し送り）：見えない要素は「無い」・隠れた字は数えない・読み込み中（aria-busy）が消え 2 回読んで同じになるまで待つ・
//   動き（animation・transition）を止める・値を先に読み写しは後・当たった数を毎回付ける。これを data: の頁で readVals と capture に当てる（012〜017）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import {
  capture,
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

test("K238-VF-002 キャンバスを開いても外（fonts.googleapis.com・fonts.gstatic.com などの手元でない所）へ 1 本も出ず、Noto Sans JP を読み込む", async ({
  browser,
}) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: "light" });
  // いちばん外の網：頁の差し替え（routeCanvasFonts）が受けずに落ちてきた手元でない要求を数えて止める（数えた物が外へ出る物）
  const outside: string[] = [];
  await context.route("**/*", async (route) => {
    const u = new URL(route.request().url());
    if (["127.0.0.1", "localhost"].includes(u.hostname)) return route.continue();
    outside.push(route.request().url());
    return route.abort();
  });
  const page = await context.newPage();
  await routeCanvasFonts(page);
  await page.goto(pathToFileURL(join(ROOT, "04_design/canvas/Main.dc.html")).href);
  await page.locator("h1").first().waitFor({ state: "visible" });
  await page.evaluate(() => document.fonts.ready);
  expect(outside).toEqual([]);
  const fonts = await loadedFonts(page);
  expect(fonts.some((f) => /^noto sans jp( variable)?$/i.test(f)), fonts.join(", ")).toBe(true);
  await context.close();
});

for (const g of ENROLLED) {
  for (const w of g.widths) {
    test(`K238-VF-003 ${g.id}（${g.canvas}）幅 ${w}：組の値と読み込んだ書体がキャンバスと同じ`, async ({ browser }) => {
      const canvasPage = await browser.newPage({ viewport: { width: w, height: 1000 }, colorScheme: "light" });
      await routeCanvasFonts(canvasPage);
      await canvasPage.goto(pathToFileURL(join(ROOT, `04_design/canvas/${g.canvas}.dc.html`)).href);
      await drawn(canvasPage, g.pairs, "canvas");
      const C = await capture(canvasPage, g.pairs, "canvas", { shot: test.info().outputPath(`${g.id}-${w}-canvas.png`) });
      await canvasPage.close();

      const appPage = await browser.newPage({ viewport: { width: w, height: 1000 }, colorScheme: "light" });
      await FIDELITY_STATES[g.state]!(appPage, g.app);
      await drawn(appPage, g.pairs, "app");
      const A = await capture(appPage, g.pairs, "app", { shot: test.info().outputPath(`${g.id}-${w}-app.png`) });
      await appPage.close();

      const rows = [...compareRows(g.pairs, C.vals, A.vals), compareFonts(C.fonts, A.fonts)];
      const bad = rows.filter((r) => !r.ok).map((r) => `${r.part}・${r.prop}：キャンバス ${r.canvas} ／ 画面 ${r.app}`);
      expect(mismatches(rows), bad.join("\n")).toBe(0);
    });
  }
}

// ── 値の読み方（K-216 の申し送り 6 つ）を data: の頁で確かめる。組が 0 でも毎回流れる ──
const dataUrl = (body: string) =>
  `data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><html><body style="margin:0">${body}</body></html>`)}`;
const pair = (sel: string, props: string[]): Pair => ({ name: sel, role: "試し", canvas: sel, app: sel, props });
const HIDDEN_COPIES = `
  <div class="t" style="display:none;width:10px;height:10px">A</div>
  <div class="t" style="visibility:hidden;width:20px;height:20px">B</div>
  <div class="t" style="width:0;height:0;overflow:hidden">C</div>
  <div class="t" style="width:120px;height:30px">D</div>
  <div class="t" style="width:120px;height:30px">E</div>`;

test("K238-VF-012 見えない要素（display:none・visibility:hidden・大きさ 0 の隠した複製）は無いにして、見えている方の値を読む", async ({
  page,
}) => {
  await page.goto(dataUrl(HIDDEN_COPIES));
  const [v] = await readVals(page, [pair(".t", ["width", "height"])], "app");
  expect(v).toMatchObject({ __count: 2, width: "120px", height: "30px" });
});

test("K238-VF-013 texts は隠れた要素の字を数えない（見えている D・E だけ）", async ({ page }) => {
  await page.goto(dataUrl(HIDDEN_COPIES));
  const [v] = await readVals(page, [pair(".t", ["texts"])], "app");
  expect(v).toMatchObject({ __count: 2, texts: ["D", "E"] });
});

test("K238-VF-014 読み込み中（aria-busy=true）が消え、さらに値が 2 回読んで同じになるまで待ってから読む", async ({ page }) => {
  // 300ms 後に aria-busy を外し、その後 10 コマ（requestAnimationFrame）続けて幅を 10px ずつ広げてから止まる。読むのは止まった後の 200px
  await page.goto(
    dataUrl(`<main aria-busy="true"><div class="v" style="width:50px;height:10px"></div></main>
      <script>
        const v = document.querySelector(".v");
        setTimeout(() => {
          v.style.width = "100px";
          document.querySelector("main").removeAttribute("aria-busy");
          let n = 0;
          const step = () => { n++; v.style.width = (100 + n * 10) + "px"; if (n < 10) requestAnimationFrame(step); };
          requestAnimationFrame(step);
        }, 300);
      </script>`),
  );
  const { vals } = await capture(page, [pair(".v", ["width"])], "app");
  expect(vals[0]).toMatchObject({ width: "200px" });
});

test("K238-VF-015 動き（animation・transition）を止める：動く小窓の x・y・幅は止まった後の値で読める", async ({ page }) => {
  await page.goto(
    dataUrl(`<style>
        @keyframes slide { from { transform: translateX(300px) scale(0.5) } to { transform: none } }
        .dlg { position: absolute; left: 100px; top: 50px; width: 200px; height: 80px; animation: slide 30s linear }
        .drop { position: absolute; left: 10px; top: 200px; width: 60px; height: 20px; transform: translateY(300px); transition: transform 30s linear }
        .drop.open { transform: none }
      </style>
      <div class="dlg"></div><div class="drop"></div>
      <script>requestAnimationFrame(() => requestAnimationFrame(() => document.querySelector(".drop").classList.add("open")));</script>`),
  );
  await page.waitForFunction(() => document.querySelector(".drop")?.classList.contains("open"));
  const { vals } = await capture(page, [pair(".dlg", ["x", "y", "width"]), pair(".drop", ["y"])], "app");
  expect(vals[0]).toMatchObject({ x: "100px", y: "50px", width: "200px" });
  expect(vals[1]).toMatchObject({ y: "200px" });
});

test("K238-VF-016 値を先に読み、写しは後（写しを撮る間に描き直されても値は揺れない）", async ({ page }) => {
  await page.goto(dataUrl(`<div class="v" style="width:120px;height:10px"></div>`));
  const shot = test.info().outputPath("vf-016.png");
  const original = page.screenshot.bind(page);
  let shotTaken = false;
  // 写しを撮る直前に描き直す：capture が写しの前に値を読んでいれば 120px のまま
  page.screenshot = (async (opts?: Parameters<Page["screenshot"]>[0]) => {
    await page.evaluate(() => {
      (document.querySelector(".v") as HTMLElement).style.width = "999px";
    });
    shotTaken = true;
    return original(opts);
  }) as Page["screenshot"];
  const { vals } = await capture(page, [pair(".v", ["width"])], "app", { shot });
  expect(shotTaken).toBe(true);
  expect(vals[0]).toMatchObject({ width: "120px" });
  expect(readFileSync(shot).length).toBeGreaterThan(0);
});

test("K238-VF-017 readVals は当たった数（__count）を毎回付け、0 個のときも当たった数の行が出る", async ({ page }) => {
  await page.goto(dataUrl(`<p class="two" style="color:rgb(1, 2, 3)">x</p><p class="two" style="color:rgb(1, 2, 3)">y</p>`));
  const pairs = [pair(".none", ["color"]), pair(".two", ["color"])];
  const vals = await readVals(page, pairs, "app");
  expect(vals[0]?.__count).toBe(0);
  expect(vals[1]?.__count).toBe(2);
  const counts = compareRows(pairs, vals, vals).filter((r) => r.prop === "当たった数");
  expect(counts.map((r) => [r.part, r.canvas, r.ok])).toEqual([
    [".none", 0, false],
    [".two", 2, false],
  ]);
});
