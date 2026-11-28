// K-254「キャンバスを正本と決定にそろえる」の絵の幅の試験（実 Chrome・画面の側は開かない）。
//   04_design/canvas の全部の絵を幅 375・768・1440 で開き、数で見る：
//     ・横溢れ（scrollWidth − clientWidth）が 0
//     ・潰れた箱が無い：見えている本文の箱（main の article・section・aside・table と role=status・alert・dialog・alertdialog）で、
//       字（5 字以上）を持つのに幅が 60px 未満の物が 0（「カードの幅 2px」を機械で拾う）
//     ・幅 767 以下では入力欄（チェックとラジオを除く input・textarea・select）の文字が 16px 以上（D-144.7）。広い幅では絵の大きさのまま
//   今の時点で直せない絵は幅の台帳 scripts/ci/canvas_layout_ledger.json に理由つきで載せ、台帳は減らすだけ（形は K254-CV-006）。
//   キャンバスが外から読む書体は手元に差し替え、外へは出ない（G-11）。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { routeCanvasFonts } from "../_lib/fidelity-states";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../../..");
const CANVAS = join(ROOT, "04_design/canvas");
const BOARDS = readdirSync(CANVAS)
  .filter((f) => f.endsWith(".dc.html"))
  .map((f) => f.replace(/\.dc\.html$/, ""))
  .sort();
const WIDTHS = [375, 768, 1440] as const;
interface Entry {
  board: string;
  widths: number[];
  reason: string;
}
const LEDGER = (
  JSON.parse(readFileSync(join(ROOT, "scripts/ci/canvas_layout_ledger.json"), "utf8")) as { entries: Entry[] }
).entries;
const excused = (board: string, w: number) => LEDGER.some((e) => e.board === board && e.widths.includes(w));

interface Shape {
  overflow: number;
  thin: string[];
  smallInputs: number[];
}
/** 絵を開いて、横溢れ・潰れた箱・入力欄の文字の大きさを数で読む */
async function shapeOf(page: Page, board: string): Promise<Shape> {
  await page.goto(pathToFileURL(join(CANVAS, `${board}.dc.html`)).href);
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate(() => {
    const visible = (e: Element) => {
      const r = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      return cs.display !== "none" && cs.visibility !== "hidden" && r.height > 0;
    };
    const boxes = [
      ...document.querySelectorAll(
        'main article, main section, main aside, main table, [role="status"], [role="alert"], [role="dialog"], [role="alertdialog"]',
      ),
    ];
    const thin = boxes
      .filter((e) => visible(e) && e.getBoundingClientRect().width < 60 && (e.textContent ?? "").trim().length >= 5)
      .map((e) => `${e.tagName.toLowerCase()}${e.getAttribute("role") ? `[role=${e.getAttribute("role")}]` : ""}`);
    const inputs = [
      ...document.querySelectorAll(
        'input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]), textarea, select',
      ),
    ].filter((e) => e.getBoundingClientRect().width > 0);
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      thin,
      smallInputs: inputs.map((e) => Number.parseFloat(getComputedStyle(e).fontSize)).filter((x) => x < 16),
    };
  });
}

for (const w of WIDTHS) {
  test(`K254-UI-008 K254-UI-009 幅 ${w}：台帳に無い絵はどれも横溢れ 0・潰れた箱（字を持つのに幅 60px 未満）が 0`, async ({
    browser,
  }) => {
    test.setTimeout(300_000);
    const page = await browser.newPage({ viewport: { width: w, height: 900 }, colorScheme: "light" });
    await routeCanvasFonts(page);
    const bad: string[] = [];
    for (const b of BOARDS) {
      if (excused(b, w)) continue;
      const s = await shapeOf(page, b);
      if (s.overflow !== 0) bad.push(`${b}：横溢れ ${s.overflow}px`);
      if (s.thin.length) bad.push(`${b}：潰れた箱 ${s.thin.join("・")}`);
    }
    await page.close();
    expect(bad).toEqual([]);
  });
}

test("K254-UI-010 幅の台帳の行は、その幅で今も横溢れか潰れた箱がある（直った絵は台帳から消す）", async ({
  browser,
}) => {
  test.setTimeout(300_000);
  const stale: string[] = [];
  for (const w of WIDTHS) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 }, colorScheme: "light" });
    await routeCanvasFonts(page);
    for (const e of LEDGER.filter((x) => x.widths.includes(w))) {
      const s = await shapeOf(page, e.board);
      if (s.overflow === 0 && s.thin.length === 0) stale.push(`${e.board}（幅 ${w}）`);
    }
    await page.close();
  }
  expect(stale).toEqual([]);
});

test("K254-UI-011 幅 375 と境目の 767：どの絵も（台帳の絵も）入力欄の文字が 16px 以上（D-144.7）", async ({
  browser,
}) => {
  test.setTimeout(400_000);
  const bad: string[] = [];
  for (const w of [375, 767]) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 }, colorScheme: "light" });
    await routeCanvasFonts(page);
    for (const b of BOARDS) {
      const s = await shapeOf(page, b);
      if (s.smallInputs.length) bad.push(`幅 ${w} ${b}：${s.smallInputs.join("・")}px`);
    }
    await page.close();
  }
  expect(bad).toEqual([]);
});

test("K254-UI-012 幅 1440 と 768：入力欄は絵の大きさのまま（AuthLogin のメールの欄は 14px・幅 767 より広いと 16px にしない・D-144.7）", async ({
  browser,
}) => {
  for (const w of [1440, 768]) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 }, colorScheme: "light" });
    await routeCanvasFonts(page);
    await page.goto(pathToFileURL(join(CANVAS, "AuthLogin.dc.html")).href);
    const mail = page.locator('input[placeholder="メール"]');
    expect(await mail.evaluate((e) => getComputedStyle(e).fontSize), `幅 ${w}`).toBe("14px");
    await page.close();
  }
});

test("K254-UI-013 段 1 の PC の絵（EdPC・MePC）は幅 375 で横溢れ 0、本文の箱は画面の幅の半分以上（設定の画面の左の列は本文の上か隠れる）", async ({
  browser,
}) => {
  const page = await browser.newPage({ viewport: { width: 375, height: 900 }, colorScheme: "light" });
  await routeCanvasFonts(page);
  for (const b of ["EdPC", "MePC"]) {
    const s = await shapeOf(page, b);
    expect(s.overflow, b).toBe(0);
    const widest = await page.evaluate(() =>
      Math.max(...[...document.querySelectorAll("main section")].map((e) => e.getBoundingClientRect().width)),
    );
    expect(widest, `${b} の本文の箱の幅`).toBeGreaterThanOrEqual(375 / 2);
  }
  await page.close();
});
