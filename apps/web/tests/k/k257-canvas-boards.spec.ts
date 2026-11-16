// K-257「詳細・帯・小窓の絵を起こし直す」の試験（実 Chrome・画面の側は開かない）。
//   詳細の形の絵 7 枚（TicketDetail・StRunning・StFailed・StBefore・StConfirmDone・StDone・StDelegated）が同じ形（右のパネル 380・題名の行・帯の場所）で、
//   幅 375 でも壊れないこと、小窓の絵が 1 枚に 1 つで置き場（上から 60px・真ん中）がそろうこと、突き合わせの組のセレクタが絵に当たることを数で見る。
//   キャンバスが外から読む書体は手元に差し替え（routeCanvasFonts）、外へは出ない。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { MISSING, readVals, type FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
import { routeCanvasFonts } from "../_lib/fidelity-states";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../../..");
const DETAIL = ["TicketDetail", "StRunning", "StFailed", "StBefore", "StConfirmDone", "StDone", "StDelegated"] as const;
const BAND = 'main article :is([role="status"], [role="alert"])';
interface Box {
  x: number;
  y: number;
  w: number;
}

async function open(browser: Browser, board: string, width: number): Promise<Page> {
  const page = await browser.newPage({ viewport: { width, height: 1000 }, colorScheme: "light" });
  await routeCanvasFonts(page);
  await page.goto(pathToFileURL(join(ROOT, `04_design/canvas/${board}.dc.html`)).href);
  await page.evaluate(() => document.fonts.ready);
  return page;
}
const boxOf = (page: Page, sel: string): Promise<Box> =>
  page
    .locator(sel)
    .filter({ visible: true })
    .first()
    .evaluate((e) => {
      const r = e.getBoundingClientRect();
      return { x: Math.round(r.x + window.scrollX), y: Math.round(r.y + window.scrollY), w: Math.round(r.width) };
    });
const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test("K257-UI-011 幅 375・768：TicketDetail・StRunning・StFailed は横溢れ 0、本文のカードは幅 300px 以上、右のパネルは見えていてカードの下（1023 以下）。幅 1024 はパネルがカードの右", async ({
  browser,
}) => {
  const bad: string[] = [];
  for (const b of ["TicketDetail", "StRunning", "StFailed"]) {
    for (const w of [375, 768, 1024]) {
      const page = await open(browser, b, w);
      const o = await overflow(page);
      if (o !== 0) bad.push(`${b} 幅 ${w}：横溢れ ${o}px`);
      const card = await boxOf(page, "main article");
      if (card.w < 300) bad.push(`${b} 幅 ${w}：カードの幅 ${card.w}px`);
      const side = page.locator('aside[aria-label="チケットのパネル"]').filter({ visible: true });
      if ((await side.count()) !== 1) {
        bad.push(`${b} 幅 ${w}：見えているパネルが ${await side.count()} 個`);
      } else {
        const s = await boxOf(page, 'aside[aria-label="チケットのパネル"]');
        const c = await page
          .locator("main article")
          .first()
          .evaluate((e) => {
            const r = e.getBoundingClientRect();
            return { right: r.right + window.scrollX, bottom: r.bottom + window.scrollY };
          });
        if (w <= 1023 && s.y < c.bottom - 1) bad.push(`${b} 幅 ${w}：パネルがカードの下に無い`);
        if (w === 1024 && s.x < c.right - 1) bad.push(`${b} 幅 ${w}：パネルがカードの右に無い`);
      }
      await page.close();
    }
  }
  expect(bad).toEqual([]);
});

for (const w of [1440, 375]) {
  test(`K257-UI-012 K257-UI-013 幅 ${w}：詳細の形の 7 枚は帯の箱の x・幅・y が TicketDetail の帯と同じ（±2px）。幅 1440 はどれも右のパネル 380`, async ({
    browser,
  }) => {
    const ref = await open(browser, "TicketDetail", w);
    const base = await boxOf(ref, BAND);
    await ref.close();
    const bad: string[] = [];
    for (const b of DETAIL) {
      const page = await open(browser, b, w);
      const band = await boxOf(page, BAND);
      for (const k of ["x", "w", "y"] as const)
        if (Math.abs(band[k] - base[k]) > 2) bad.push(`${b}：帯の ${k} ${band[k]}（TicketDetail は ${base[k]}）`);
      if (w === 1440) {
        const side = await boxOf(page, 'aside[aria-label="チケットのパネル"]');
        if (side.w !== 380) bad.push(`${b}：右のパネルの幅 ${side.w}`);
      }
      await page.close();
    }
    expect(bad).toEqual([]);
  });
}

test("K257-UI-014 詳細の形の 7 枚の題名 h1：20px・700・行の高さ 29px（1.45）で、幅 1440 の y がどれも同じ（±2px）", async ({
  browser,
}) => {
  const bad: string[] = [];
  let y0: number | null = null;
  for (const b of DETAIL) {
    const page = await open(browser, b, 1440);
    const h = page.locator("main article h1").first();
    const v = await h.evaluate((e) => {
      const cs = getComputedStyle(e);
      return [cs.fontSize, cs.fontWeight, cs.lineHeight, Math.round(e.getBoundingClientRect().y)] as const;
    });
    if (`${v[0]} ${v[1]} ${v[2]}` !== "20px 700 29px") bad.push(`${b}：${v[0]} ${v[1]} ${v[2]}`);
    y0 ??= v[3];
    if (Math.abs(v[3] - y0) > 2) bad.push(`${b}：h1 の y ${v[3]}（最初の絵は ${y0}）`);
    await page.close();
  }
  expect(bad).toEqual([]);
});

/** 小窓の絵：小窓がちょうど 1 つで、幅 1440 は幅 wide・上から 60・真ん中、幅 375 は幅 327・左 24・上から 60 */
async function expectOneModal(browser: Browser, board: string, role: "dialog" | "alertdialog", wide: number) {
  const bad: string[] = [];
  for (const [w, width, x] of [
    [1440, wide, (1440 - wide) / 2],
    [375, 327, 24],
  ] as const) {
    const page = await open(browser, board, w);
    const sel = `section[role="${role}"]`;
    const n = await page.locator('section[role="dialog"], section[role="alertdialog"]').count();
    if (n !== 1) bad.push(`幅 ${w}：小窓 ${n} 個`);
    const b = await boxOf(page, sel);
    if (Math.abs(b.w - width) > 2) bad.push(`幅 ${w}：小窓の幅 ${b.w}`);
    if (Math.abs(b.x - x) > 2) bad.push(`幅 ${w}：小窓の x ${b.x}`);
    if (Math.abs(b.y - 60) > 2) bad.push(`幅 ${w}：小窓の y ${b.y}`);
    if ((await overflow(page)) !== 0) bad.push(`幅 ${w}：横溢れ`);
    await page.close();
  }
  return bad;
}

test("K257-UI-015 承認の確かめの小窓の絵 StApproveModal：alertdialog が 1 つ・幅 380（375 は 327）・上から 60px・真ん中・× が無い", async ({
  browser,
}) => {
  const bad = await expectOneModal(browser, "StApproveModal", "alertdialog", 380);
  const page = await open(browser, "StApproveModal", 1440);
  if ((await page.locator('section[role="alertdialog"] [aria-label="閉じる"]').count()) !== 0) bad.push("× が在る");
  await page.close();
  expect(bad).toEqual([]);
});

test("K257-UI-016 差し戻しの小窓の絵 StReturnModal：dialog が 1 つ・幅 420（375 は 327）・上から 60px・真ん中・頭に × が 1 つ", async ({
  browser,
}) => {
  const bad = await expectOneModal(browser, "StReturnModal", "dialog", 420);
  const page = await open(browser, "StReturnModal", 1440);
  if ((await page.locator('section[role="dialog"] [aria-label="閉じる"]').count()) !== 1) bad.push("× が 1 つでない");
  await page.close();
  expect(bad).toEqual([]);
});

test("K257-UI-017 完了の小窓の絵 StCompleteModal：ふつうの小窓（role=dialog）が 1 つ・頭に × が 1 つ・幅 420（375 は 327）・上から 60px・真ん中", async ({
  browser,
}) => {
  const bad = await expectOneModal(browser, "StCompleteModal", "dialog", 420);
  const page = await open(browser, "StCompleteModal", 1440);
  if ((await page.locator('section[role="dialog"] [aria-label="閉じる"]').count()) !== 1) bad.push("× が 1 つでない");
  await page.close();
  expect(bad).toEqual([]);
});

interface Group {
  id: string;
  canvas: string;
  widths: number[];
  pairs: FidelityPair[];
}
const CFG = JSON.parse(readFileSync(join(ROOT, "04_design/fidelity.json"), "utf8")) as { groups: Group[] };
const MINE = new Set([
  ...DETAIL,
  "StApproveModal",
  "StReturnModal",
  "StCompleteModal",
  "Approvals",
  "EdPC",
  "MePC",
  "MePCInstalled",
]);

test("K257-UI-018 起こし直した絵を使う突き合わせの組：組の幅ごとに、canvas のセレクタが見えている要素に当たり（texts 以外はちょうど 1 つ）、比べる値が全部読める", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const bad: string[] = [];
  for (const g of CFG.groups.filter((x) => MINE.has(x.canvas))) {
    for (const w of g.widths) {
      const page = await open(browser, g.canvas, w);
      for (const p of g.pairs) {
        const n = await page.locator(p.canvas).filter({ visible: true }).count();
        const many = p.props.includes("texts") ? n >= 1 : n === 1;
        if (!many) bad.push(`${g.id} 幅 ${w}：${p.name} に当たった数 ${n}`);
      }
      const vals = (await readVals(page, g.pairs, "canvas")) as Record<string, unknown>[];
      g.pairs.forEach((p, i) => {
        for (const prop of p.props) {
          const got = vals[i]?.[prop];
          if (got === undefined || got === null || got === MISSING || (Array.isArray(got) && got.length === 0))
            bad.push(`${g.id} 幅 ${w}：${p.name}・${prop} が読めない`);
        }
      });
      await page.close();
    }
  }
  expect(bad).toEqual([]);
});

test("K257-UI-019 見比べの 1 枚（canvas-review/K-257.html）：幅 1440 と 375 で横溢れ 0、直す前と後の枠（iframe）が 30 個とも描かれる（変えた 14 枚の 28 と、題の大きさの区画の 2）", async ({
  browser,
}) => {
  for (const w of [1440, 375]) {
    const page = await browser.newPage({ viewport: { width: w, height: 1000 } });
    await routeCanvasFonts(page);
    await page.goto(pathToFileURL(join(ROOT, "04_design/canvas-review/K-257.html")).href);
    const frames = page.locator("section[data-board] iframe");
    await expect(frames).toHaveCount(30);
    for (let i = 0; i < 30; i++) {
      await frames.nth(i).scrollIntoViewIfNeeded();
      await expect(frames.nth(i)).toBeVisible();
    }
    expect(await overflow(page), `幅 ${w}`).toBe(0);
    await page.close();
  }
});

// 字が何行に割れているかを、字（テキストの節）の矩形だけで数える。飾りの svg・絶対配置の印は数えない。同じ行の大きさ違いの字は上の差が高さの 7 割未満
const ALL = [
  ...DETAIL,
  "StApproveModal",
  "StReturnModal",
  "StCompleteModal",
  "Approvals",
  "EdPC",
  "MePC",
  "MePCInstalled",
] as const;
const ONE_LINE: [string, string][] = [
  ["題", "main h1, section[role] > div:first-child b"],
  ["帯の文", 'main article :is([role="status"], [role="alert"]) > div:first-child > :is(b, div, ol li)'],
  ["ボタン", 'main button, main a[style*="height: 2"], main a[style*="height: 3"], section[role] button'],
  ["札", 'main span[style*="border-radius: 9999px"]'],
  ["表の見出し", "main th"],
];
const BAND_TEXT = 'main article :is([role="status"], [role="alert"]) > div:first-child > :is(b, div)';

async function linesOf(page: Page, sel: string): Promise<{ text: string; lines: number; cut: boolean }[]> {
  return page.locator(sel).evaluateAll((els) =>
    els
      .filter((e) => (e as HTMLElement).checkVisibility() && (e.textContent ?? "").trim() !== "")
      .map((e) => {
        const rects: [number, number][] = [];
        // 字と字の間で行が替わる所が、英数字（数・記号を含む）の途中か
        let cut = false;
        let prev: { ch: string; top: number } | null = null;
        const tw = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
        for (let t = tw.nextNode(); t; t = tw.nextNode()) {
          const pe = t.parentElement;
          if (pe && pe !== e && getComputedStyle(pe).position === "absolute") continue;
          const s = t.textContent ?? "";
          for (let i = 0; i < s.length; i++) {
            if (!s[i]!.trim()) {
              prev = null;
              continue;
            }
            const r = document.createRange();
            r.setStart(t, i);
            r.setEnd(t, i + 1);
            const q = r.getClientRects()[0];
            if (!q || q.width < 0.5) continue;
            rects.push([q.top, q.height]);
            if (
              prev &&
              q.top > prev.top + q.height * 0.7 &&
              /[0-9A-Za-z,.:/]/.test(prev.ch) &&
              /[0-9A-Za-z,.:/]/.test(s[i]!)
            )
              cut = true;
            prev = { ch: s[i]!, top: q.top };
          }
        }
        rects.sort((a, b) => a[0] - b[0]);
        let n = 0;
        let top = -1e9;
        let h = 0;
        for (const [t, hh] of rects)
          if (t >= top + h * 0.7) {
            n++;
            top = t;
            h = hh;
          }
        return { text: (e.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40), lines: n, cut };
      }),
  );
}

test("K257-UI-020 2 行に割らない：14 枚の 題・帯の文・ボタン・札・表の見出しは幅 1440 と 768 で 1 行。幅 375 は題が 1 行（切れたら「…」で、全文は title）・帯の文は 2 行までで英数字の途中で割らない", async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const bad: string[] = [];
  for (const w of [1440, 768, 375]) {
    for (const b of ALL) {
      const page = await open(browser, b, w);
      if (w !== 375) {
        for (const [kind, sel] of ONE_LINE)
          for (const r of await linesOf(page, sel))
            if (r.lines > 1) bad.push(`${b} 幅 ${w}：${kind}「${r.text}」が ${r.lines} 行`);
      } else {
        for (const r of await linesOf(page, "main h1"))
          if (r.lines > 1) bad.push(`${b} 幅 375：題「${r.text}」が ${r.lines} 行`);
        for (const r of await linesOf(page, BAND_TEXT)) {
          if (r.lines > 2) bad.push(`${b} 幅 375：帯の文「${r.text}」が ${r.lines} 行`);
          if (r.cut) bad.push(`${b} 幅 375：帯の文「${r.text}」が英数字の途中で割れている`);
        }
      }
      for (const h of await page.locator("main h1").all()) {
        const [title, text, over] = await h.evaluate((e) => [
          e.getAttribute("title"),
          (e.textContent ?? "").trim(),
          e.scrollWidth > e.clientWidth + 1,
        ]);
        if (over && title !== text) bad.push(`${b} 幅 ${w}：題が切れているのに title に全文が無い`);
        if (DETAIL.includes(b as (typeof DETAIL)[number]) && title !== text)
          bad.push(`${b} 幅 ${w}：題の title が全文でない`);
      }
      await page.close();
    }
  }
  expect(bad).toEqual([]);
});
