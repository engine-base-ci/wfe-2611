// K-232「規約の文面の画面をキャンバス（LegalPage）に合わせる」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：04_design/canvas/LegalPage.dc.html（白い箱 720px・余白 26px 28px・段の間 14px・「← 戻る」・題 20px・版の行 12px・条の見出し 15px・本文 13px／1.9・足元 3 つ）。
//   文面のページは口（API）を読まない（ひな形 apps/web/content/legal/*.md と設定だけ）。本人の Bridge（127.0.0.1:38617）にも届かせない（網の手前で 404）。
//   画面の形（実装の役が作る）：入口の枠の箱 [data-part="auth-box"]（K-255 が付ける）の中に「← 戻る」のリンク・h1・版の行（.k-legal-version）・
//     条の見出し（h2）・本文（p・ol）。足元は 利用規約・プライバシー・困ったとき の 3 つ。
//   期待は PM の決め（題は 20px：絵を 20px の段に寄せる K-254 に依存）と、決める人の答え（answer=fd9dcd7a7cc8）：「← 戻る」は前の画面、履歴が無ければログインへ。
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
  type FidelityPair,
} from "../../../../scripts/ci/fidelity_compare.mjs";
import { FIDELITY_STATES, routeCanvasFonts } from "../_lib/fidelity-states";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../../..");
const WEB = join(HERE, "../..");
const INK = "rgb(19, 27, 39)";
const MUTED = "rgb(74, 85, 99)";
const WIDTHS = [320, 375, 768, 1024, 1440] as const;
const BOX = '[data-part="auth-box"]';

async function open(page: Page, path = "/legal/terms", width = 1440) {
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.setViewportSize({ width, height: 1000 });
  const res = await page.goto(path);
  expect(res?.status(), `${path} は 200`).toBe(200);
  await expect(page.locator(`${BOX} h1`)).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}
const css = (page: Page, sel: string, prop: string) =>
  page
    .locator(sel)
    .first()
    .evaluate((e, p) => getComputedStyle(e).getPropertyValue(p), prop);
const box = async (page: Page, sel: string) => (await page.locator(sel).first().boundingBox())!;
const overflowX = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test("K232-UI-001 題名：h1「Kaname 利用規約」は 20px・700・行の高さ 32px（キャンバスの 1.6・絵は 20px の段に寄せて直る）・#131B27・左寄せ（今の 18px・真ん中をやめる）", async ({
  page,
}) => {
  await open(page);
  const h1 = `${BOX} h1`;
  await expect(page.locator(h1)).toHaveText("Kaname 利用規約");
  expect(await css(page, h1, "font-size")).toBe("20px");
  expect(await css(page, h1, "font-weight")).toBe("700");
  expect(Math.abs(parseFloat(await css(page, h1, "line-height")) - 32)).toBeLessThan(0.5);
  expect(await css(page, h1, "color")).toBe(INK);
  expect(["left", "start"]).toContain(await css(page, h1, "text-align"));
  await expect(page.locator("h1")).toHaveCount(1);
});

test("K232-UI-002 版の行：「第 1 版（… 施行）」は 12px・行の高さ 19.2px（キャンバスの 1.6）・灰（#4A5563）で、本文の段落と同じ大きさではない", async ({
  page,
}) => {
  await open(page);
  const v = page.locator(`${BOX} .k-legal-version`);
  await expect(v).toHaveCount(1);
  await expect(v).toHaveText(/^第 1 版（.+施行）$/);
  expect(await v.evaluate((e) => getComputedStyle(e).fontSize)).toBe("12px");
  expect(Math.abs(parseFloat(await v.evaluate((e) => getComputedStyle(e).lineHeight)) - 19.2)).toBeLessThan(0.5);
  expect(await v.evaluate((e) => getComputedStyle(e).color)).toBe(MUTED);
});

test("K232-UI-003 条の見出しと番号：「第 1 条（適用）」は 15px・700・行の高さ 24px。番号（decimal）は見え、キャンバスどおり字下げせず箱の中の左端から始まる（±2）", async ({
  page,
}) => {
  await open(page);
  const h2 = page.locator(`${BOX} h2`, { hasText: "第 1 条（適用）" });
  await expect(h2).toBeVisible();
  expect(await h2.evaluate((e) => getComputedStyle(e).fontSize)).toBe("15px");
  expect(await h2.evaluate((e) => getComputedStyle(e).fontWeight)).toBe("700");
  expect(Math.abs(parseFloat(await h2.evaluate((e) => getComputedStyle(e).lineHeight)) - 24)).toBeLessThan(0.5);
  const ol = page.locator(`${BOX} ol`).first();
  expect(await ol.evaluate((e) => getComputedStyle(e).listStyleType)).toBe("decimal");
  expect(await ol.evaluate((e) => getComputedStyle(e).listStylePosition)).toBe("inside");
  const d = await page.locator(BOX).evaluate((b) => {
    const cs = getComputedStyle(b);
    const inner = b.getBoundingClientRect().left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft);
    const li = b.querySelector("ol > li")!.getBoundingClientRect().left;
    return li - inner;
  });
  expect(Math.abs(d), `番号の左端と箱の中の左端の差 ${d}`).toBeLessThanOrEqual(2);
});

test("K232-UI-004 段の間：版の行・最初の段落・条の見出しの間はどれも 14px（±2）。段落の margin で詰まらない", async ({
  page,
}) => {
  await open(page);
  const gaps = await page.locator(BOX).evaluate((b) => {
    const v = b.querySelector(".k-legal-version")!.getBoundingClientRect();
    const p = b.querySelector(".k-legal-version ~ p")!.getBoundingClientRect();
    const h2 = b.querySelector("h2")!;
    const prev = h2.previousElementSibling?.getBoundingClientRect();
    const top = h2.getBoundingClientRect().top;
    return { vp: p.top - v.bottom, ph: prev ? top - prev.bottom : -1 };
  });
  expect(Math.abs(gaps.vp - 14), `版の行と段落の間 ${gaps.vp}`).toBeLessThanOrEqual(2);
  expect(Math.abs(gaps.ph - 14), `段落と条の見出しの間 ${gaps.ph}`).toBeLessThanOrEqual(2);
});

test("K232-UI-005 本文：段落と番号の並びは 13px・行の高さ 1.9（24.7px）", async ({ page }) => {
  await open(page);
  for (const sel of [`${BOX} .k-legal-version ~ p`, `${BOX} ol li`]) {
    expect(await css(page, sel, "font-size"), sel).toBe("13px");
    expect(parseFloat(await css(page, sel, "line-height")), sel).toBeCloseTo(24.7, 0);
  }
});

test("K232-UI-006 幅 1440：箱は幅 720・余白 26px 28px・画面の横の真ん中（±2）", async ({ page }) => {
  await open(page);
  const b = await box(page, BOX);
  expect(Math.round(b.width)).toBe(720);
  expect(Math.abs(b.x + b.width / 2 - 720)).toBeLessThanOrEqual(2);
  expect(await css(page, BOX, "padding-top")).toBe("26px");
  expect(await css(page, BOX, "padding-left")).toBe("28px");
});

test("K232-UI-007 「← 戻る」：箱の頭に 12px のリンク。登録の画面から来たら押すと登録の画面へ戻り、履歴が無い（直に開いた）ときはログインへ", async ({
  page,
}) => {
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/signup");
  // 登録の画面から同じタブで来た形（goto は referrer を付けないので、元の画面を referer に渡す）
  await page.goto("/legal/terms", { referer: new URL("/signup", page.url()).href });
  const back = page.locator(BOX).getByRole("link", { name: "← 戻る" });
  await expect(back).toBeVisible();
  expect(await back.evaluate((e) => getComputedStyle(e).fontSize)).toBe("12px");
  const first = await page
    .locator(`${BOX} > *`)
    .first()
    .evaluate((e) => e.textContent?.trim());
  expect(first, "箱の中の最初の要素が「← 戻る」").toBe("← 戻る");
  await back.click();
  await expect(page).toHaveURL(/\/signup$/);

  const fresh = await page.context().newPage();
  await fresh.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await fresh.goto("/legal/privacy");
  await fresh.locator(BOX).getByRole("link", { name: "← 戻る" }).click();
  await expect(fresh).toHaveURL(/\/login$/);
  await fresh.close();
});

test("K232-UI-008 足元：利用規約（/legal/terms）・プライバシー（/legal/privacy）・困ったとき の 3 つが並ぶ", async ({
  page,
}) => {
  await open(page);
  const foot = page.getByRole("navigation", { name: "Kaname について" });
  const names = (await foot.getByRole("link").allInnerTexts()).map((x) => x.trim());
  expect(names).toEqual(["利用規約", "プライバシー", "困ったとき"]);
  await expect(foot.getByRole("link", { name: "利用規約" })).toHaveAttribute("href", /\/legal\/terms/);
  await expect(foot.getByRole("link", { name: "プライバシー" })).toHaveAttribute("href", /\/legal\/privacy/);
});

test("K232-UI-009 文面を準備している間のお知らせは Callout の部品（素の div に k-callout の字を書かない）", () => {
  const src = readFileSync(join(WEB, "features/F1/consent-terms/legal-page.tsx"), "utf8");
  expect(src, "Callout を部品から使う").toMatch(
    /import\s*\{[^}]*\bCallout\b[^}]*\}\s*from\s*"@\/components\/k(\/notice)?"/,
  );
  expect(src, "素の k-callout の字が無い").not.toMatch(/className="k-callout"/);
  expect(src, "E-PAGE-003 の文を出す").toContain("E-PAGE-003");
});

interface Group {
  id: string;
  canvas: string;
  app: string;
  state: string;
  widths: number[];
  pairs: FidelityPair[];
  owner: string;
  enrolled: boolean;
}
const CFG = JSON.parse(readFileSync(join(ROOT, "04_design/fidelity.json"), "utf8")) as { groups: Group[] };
const G = CFG.groups.find((x) => x.id === "legal");

test("K232-UI-010 突き合わせの設定：legal が enrolled・持ち主 K-232・箱と見出しの画面の側は入口の箱（.k-legal ではない）・画面を整える道具に鍵", () => {
  expect(G).toBeTruthy();
  expect(G!.enrolled).toBe(true);
  expect(G!.owner).toBe("K-232");
  const card = G!.pairs.find((p) => p.role === "card")!;
  const h1 = G!.pairs.find((p) => p.role === "h1")!;
  expect(card.app).toBe(BOX);
  expect(h1.app).toBe(`${BOX} h1`);
  // 見出しの y は外す（キャンバスは短い文面を縦の真ん中に置き、本物の文面は上から始まる）。ほかの値は残す
  expect(h1.props).not.toContain("y");
  for (const p of ["font-size", "font-weight", "line-height", "color", "x"]) expect(h1.props, p).toContain(p);
  expect(FIDELITY_STATES[G!.state]).toBeTruthy();
});

for (const w of G?.widths ?? [1440]) {
  test(`K232-UI-011 legal（LegalPage）幅 ${w}：組の値と読み込んだ書体がキャンバスと同じ`, async ({ browser }) => {
    expect(G).toBeTruthy();
    const canvasPage = await browser.newPage({ viewport: { width: w, height: 1000 }, colorScheme: "light" });
    await routeCanvasFonts(canvasPage);
    await canvasPage.goto(pathToFileURL(join(ROOT, `04_design/canvas/${G!.canvas}.dc.html`)).href);
    for (const p of G!.pairs) await canvasPage.locator(p.canvas).first().waitFor({ state: "visible" });
    await canvasPage.evaluate(() => document.fonts.ready);
    const canvasVals = await readVals(canvasPage, G!.pairs, "canvas");
    const canvasFonts = await loadedFonts(canvasPage);
    await canvasPage.close();

    const appPage = await browser.newPage({ viewport: { width: w, height: 1000 }, colorScheme: "light" });
    await appPage.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
    await FIDELITY_STATES[G!.state]!(appPage, G!.app);
    for (const p of G!.pairs) await appPage.locator(p.app).first().waitFor({ state: "visible" });
    await appPage.evaluate(() => document.fonts.ready);
    const appVals = await readVals(appPage, G!.pairs, "app");
    const appFonts = await loadedFonts(appPage);
    await appPage.close();

    const rows = [...compareRows(G!.pairs, canvasVals, appVals), compareFonts(canvasFonts, appFonts)];
    const bad = rows.filter((r) => !r.ok).map((r) => `${r.part}・${r.prop}：キャンバス ${r.canvas} ／ 画面 ${r.app}`);
    expect(mismatches(rows), bad.join("\n")).toBe(0);
  });
}

test("K232-UI-012 幅 320・375・768・1024・1440：横溢れ 0・題の 1 文字目が画面の中・プライバシーの表は箱の中で横に送る", async ({
  page,
}) => {
  const bad: string[] = [];
  for (const w of WIDTHS) {
    for (const path of ["/legal/terms", "/legal/privacy"]) {
      await open(page, path, w);
      const o = await overflowX(page);
      if (o !== 0) bad.push(`${path} 幅 ${w}：横溢れ ${o}px`);
      const left = await page.locator(`${BOX} h1`).evaluate((e) => {
        const r = document.createRange();
        r.setStart(e.firstChild!, 0);
        r.setEnd(e.firstChild!, 1);
        return r.getBoundingClientRect().left;
      });
      if (left < 0) bad.push(`${path} 幅 ${w}：題の 1 文字目が左に切れる（${left}）`);
      if (path === "/legal/privacy") {
        const t = await page.locator(`${BOX} table`).first().boundingBox();
        const b = await box(page, BOX);
        if (t && t.x + t.width > b.x + b.width + 1) bad.push(`幅 ${w}：表が箱の外へ出る`);
      }
    }
  }
  expect(bad).toEqual([]);
});

test("K232-UI-013 プライバシーポリシーも同じ形：題 20px・版の行 12px・本文 13px", async ({ page }) => {
  await open(page, "/legal/privacy");
  await expect(page.locator(`${BOX} h1`)).toHaveText("Kaname プライバシーポリシー");
  expect(await css(page, `${BOX} h1`, "font-size")).toBe("20px");
  expect(await css(page, `${BOX} .k-legal-version`, "font-size")).toBe("12px");
  expect(await css(page, `${BOX} .k-legal-version ~ p`, "font-size")).toBe("13px");
});

test("K232-UI-014 幅 375：箱は左右 16px 内側（幅 343）で、余白は 26px 28px のまま", async ({ page }) => {
  await open(page, "/legal/terms", 375);
  const b = await box(page, BOX);
  expect(Math.round(b.x)).toBe(16);
  expect(Math.round(b.width)).toBe(343);
  expect(await css(page, BOX, "padding-left")).toBe("28px");
});

test("K232-UI-015 問い合わせ：箱の一番下に、上の線 1px #EDF0F4・線と字の間 12px・12px・灰（#4A5563）の 1 段で会社とメールが出る（節の見出しは目に見えない）", async ({
  page,
}) => {
  await open(page);
  const c = page.locator(`${BOX} .k-legal-contact`);
  await expect(c).toHaveCount(1);
  await expect(c).toContainText("メール：");
  expect(await c.evaluate((e) => getComputedStyle(e).borderTopColor)).toBe("rgb(237, 240, 244)");
  expect(await c.evaluate((e) => getComputedStyle(e).borderTopWidth)).toBe("1px");
  expect(await c.evaluate((e) => getComputedStyle(e).paddingTop)).toBe("12px");
  expect(await c.evaluate((e) => getComputedStyle(e).fontSize)).toBe("12px");
  expect(await c.evaluate((e) => getComputedStyle(e).color)).toBe(MUTED);
  const last = await page.locator(`${BOX} .k-legal`).evaluate((a) => a.lastElementChild?.className ?? "");
  expect(last).toContain("k-legal-contact");
  // 節の見出し「問い合わせ」は読み上げだけに残す（目に見える大きさが 1px 以下）
  const heading = c.locator("h2", { hasText: "問い合わせ" });
  await expect(heading).toHaveCount(1);
  expect((await heading.boundingBox())?.height ?? 0).toBeLessThanOrEqual(1);
});

test("K232-UI-016 点の並び（ul）：点（disc）が字の頭に出て（inside）・13px・行の高さ 24.7px。字下げしない：上の段の点は箱の中の左端・入れ子の点の並びも番号の並びと同じ左端（決める人の答え answer=fd9dcd7a7cc8）", async ({
  page,
}) => {
  await open(page, "/legal/privacy");
  const ul = page.locator(`${BOX} .k-legal > ul`).first();
  expect(await ul.evaluate((e) => getComputedStyle(e).listStyleType)).toBe("disc");
  expect(await ul.evaluate((e) => getComputedStyle(e).listStylePosition)).toBe("inside");
  const li = ul.locator("li").first();
  expect(await li.evaluate((e) => getComputedStyle(e).fontSize)).toBe("13px");
  expect(Math.abs(parseFloat(await li.evaluate((e) => getComputedStyle(e).lineHeight)) - 24.7)).toBeLessThan(0.5);
  const top = await page.locator(BOX).evaluate((b) => {
    const cs = getComputedStyle(b);
    const inner = b.getBoundingClientRect().left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft);
    return b.querySelector(".k-legal > ul > li")!.getBoundingClientRect().left - inner;
  });
  expect(Math.abs(top), `上の段の点の左端と箱の中の左端の差 ${top}`).toBeLessThanOrEqual(2);
  await open(page, "/legal/terms");
  const nested = page.locator(`${BOX} ol > li > ul`).first();
  expect(await nested.evaluate((e) => getComputedStyle(e).listStylePosition)).toBe("inside");
  const shift = await nested.evaluate((e) => {
    const parent = e.closest("li")!.getBoundingClientRect().left;
    return e.querySelector(":scope > li")!.getBoundingClientRect().left - parent;
  });
  expect(Math.abs(shift), `入れ子の点の左端と番号の段の左端の差 ${shift}（字下げしない）`).toBeLessThanOrEqual(2);
});

test("K232-UI-017 「← 戻る」の守り：外の origin から来た（referer が外）ときは前の画面に戻らず、ログイン（/login）へ移る", async ({
  page,
}) => {
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/signup");
  await page.goto("/legal/terms", { referer: "https://example.com/" });
  await page.locator(BOX).getByRole("link", { name: "← 戻る" }).click();
  await expect(page).toHaveURL(/\/login$/);
});
