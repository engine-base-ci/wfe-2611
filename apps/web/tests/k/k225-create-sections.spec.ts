// K-225「作る画面の区画を文書の見た目に」の画面の試験（実 Chrome・実装より先に積む）。正のモック：04_design/canvas/Create.dc.html の本文の箱。
//   画面の形（実装の役が作る）：section[aria-label="本文"]（K-224 の白い箱の 2 つめ）の中に .k-create-doc（padding 8px 28px 24px・max-width 900）。
//     種別の区画ごとに h2（区画の名前の span[id]・必須なら b「必須」・ひな形の補足は span）と、区画の名前だけを名前に持つ欄（textbox・aria-labelledby で h2 の中の名前の span に結ぶ）。
//   期待は決める人の答え（D-145.8・D-145.9）：文書の道具の帯（14 個）は出すが押せない（グレー）。「＋ 見出しを足す」も押せない。
//   区画の見出しの値は正本の部品 section-title-form（作る画面・22・6。最初の見出しは section-title-form-first の 20・6）。詳細の画面は前からの section-title（28・8）のまま（名前を分けて正本に持つ・PM の決め）。
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
import { css, loaded, mockCreate, openCreate, overflowX } from "./create-mock";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../../..");
const LINE = "rgb(221, 226, 233)";
const RED = "rgb(185, 28, 28)";
const doc = (page: Page) => page.getByRole("region", { name: "本文" });
const DISABLED_OPACITY = 0.55; // 数で比べる（本番の組み立ては CSS を縮めて ".55" と書くことがある）
const TOOLS = [
  "太字",
  "斜体",
  "見出し",
  "箇条書き",
  "番号つき",
  "チェックリスト",
  "表",
  "画像・添付",
  "引用",
  "コード",
  "注意の枠",
  "チケットを引く",
  "人を呼ぶ",
  "リンク",
];

test("K225-UI-001 本文の箱：白・線 1px #DDE2E9・角丸 8。中の文書は padding 8px 28px 24px・幅は 900 まで", async ({
  page,
}) => {
  await mockCreate(page);
  await openCreate(page);
  await loaded(page);
  const sec = doc(page);
  expect(await sec.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe("rgb(255, 255, 255)");
  expect(await sec.evaluate((e) => getComputedStyle(e).borderTopColor)).toBe(LINE);
  expect(await sec.evaluate((e) => getComputedStyle(e).borderTopLeftRadius)).toBe("8px");
  const inner = sec.locator(".k-create-doc");
  for (const [p, v] of [
    ["padding-top", "8px"],
    ["padding-left", "28px"],
    ["padding-bottom", "24px"],
    ["max-width", "900px"],
  ] as const)
    expect(await inner.evaluate((e, x) => getComputedStyle(e).getPropertyValue(x), p), p).toBe(v);
});

test("K225-UI-002 区画の見出し：種別の区画の順に h2（タスク：目的・完了の条件・実施事項・リスクと懸念）。16px・700・下に 1px の線・下の余白 6px", async ({
  page,
}) => {
  await mockCreate(page);
  await openCreate(page);
  await loaded(page);
  const h2 = doc(page).locator("h2");
  const names = await h2.evaluateAll((els) => els.map((e) => e.firstChild?.textContent?.trim()));
  expect(names).toEqual(["目的", "完了の条件", "実施事項", "リスクと懸念"]);
  const want: Record<string, string> = {
    "font-size": "16px",
    "font-weight": "700",
    "border-bottom-width": "1px",
    "border-bottom-color": LINE,
    "padding-bottom": "6px",
    "margin-bottom": "6px",
  };
  for (const [p, v] of Object.entries(want))
    expect(await h2.nth(1).evaluate((e, x) => getComputedStyle(e).getPropertyValue(x), p), p).toBe(v);
  expect(await h2.nth(1).evaluate((e) => getComputedStyle(e).marginTop)).toBe("22px");
  expect(await h2.nth(0).evaluate((e) => getComputedStyle(e).marginTop)).toBe("20px");
});

test("K225-UI-003 必須の印：必須の区画の h2 にだけ「必須」（12px・赤 #B91C1C）。任意の区画には無い", async ({
  page,
}) => {
  await mockCreate(page);
  await openCreate(page);
  await loaded(page);
  const h2 = doc(page).locator("h2");
  for (const i of [0, 1, 2]) {
    const mark = h2.nth(i).locator("b", { hasText: "必須" });
    await expect(mark).toHaveCount(1);
    expect(await mark.evaluate((e) => getComputedStyle(e).fontSize)).toBe("12px");
    expect(await mark.evaluate((e) => getComputedStyle(e).color)).toBe(RED);
  }
  await expect(h2.nth(3).locator("b", { hasText: "必須" })).toHaveCount(0);
});

test("K225-UI-004 ひな形の補足：h2 の中に 11px・灰で出す（欄の下に張り付けない）", async ({ page }) => {
  await mockCreate(page);
  await openCreate(page);
  await loaded(page);
  const hint = doc(page).locator("h2").nth(1).locator("span", { hasText: "ここからテスト仕様の案ができる" });
  await expect(hint).toHaveCount(1);
  expect(await hint.evaluate((e) => getComputedStyle(e).fontSize)).toBe("11px");
  expect(await hint.evaluate((e) => getComputedStyle(e).color)).toBe("rgb(74, 85, 99)");
  expect(await hint.evaluate((e) => getComputedStyle(e).fontWeight)).toBe("400");
});

test("K225-UI-005 区画の欄は h2 を名前に持つ（読み上げで「目的」の欄と分かる）・書いた字が作る口に届く形で残る", async ({
  page,
}) => {
  const m = await mockCreate(page);
  await openCreate(page);
  await loaded(page);
  const box = doc(page).getByRole("textbox", { name: "目的", exact: true });
  await expect(box).toHaveCount(1);
  const labelled = await box.getAttribute("aria-labelledby");
  expect(labelled).toBeTruthy();
  // 名前は h2 の中の区画の名前だけ（「必須」の印や補足を名前に入れない）
  const target = page.locator(`[id="${labelled!.split(/\s+/)[0]}"]`);
  await expect(target).toHaveText("目的");
  expect(await target.evaluate((e) => e.closest("h2") !== null)).toBe(true);
  await box.fill("月末の請求を出す");
  await expect.poll(() => JSON.stringify(m.draftSaves.at(-1) ?? {})).toContain("月末の請求を出す");
});

test("K225-UI-006 必須の区画が空のまま「作る」：その区画の中に理由が出て、作る口は呼ばれない", async ({ page }) => {
  const m = await mockCreate(page);
  await openCreate(page);
  await loaded(page);
  await page.getByRole("button", { name: "作る", exact: true }).click();
  const box = doc(page).getByRole("textbox", { name: "目的", exact: true });
  await expect(box).toHaveAttribute("aria-invalid", "true");
  const ids = ((await box.getAttribute("aria-describedby")) ?? "").split(/\s+/).filter(Boolean);
  const texts = await Promise.all(ids.map((id) => page.locator(`[id="${id}"]`).innerText()));
  expect(texts.join(" ")).toContain("この区画は書かないと作れません"); // 正本の E-VAL-013
  await expect(doc(page).locator(`[id="${ids[0]}"]`)).toHaveCount(1); // 理由は本文の箱の中（その区画の下）
  expect(m.creates).toHaveLength(0);
});

test("K225-UI-007 種別を課題に替えると、区画の見出しが課題の区画（起きていること・影響・完了の条件）に替わる", async ({
  page,
}) => {
  await mockCreate(page);
  await openCreate(page);
  await loaded(page);
  await page.getByRole("combobox", { name: "種別" }).click();
  await page.getByRole("option", { name: "課題", exact: true }).click();
  const names = await doc(page)
    .locator("h2")
    .evaluateAll((els) => els.map((e) => e.firstChild?.textContent?.trim()));
  expect(names).toEqual(["起きていること", "影響", "完了の条件"]);
});

test("K225-UI-008 文書の道具の帯：14 個がキャンバスの順に在るが押せない（aria-disabled・グレー・押しても Enter でも欄の字も下書きも変わらない）・「＋ 見出しを足す」も押せない（D-145.8）", async ({
  page,
}) => {
  const m = await mockCreate(page);
  await openCreate(page);
  await loaded(page);
  const bar = doc(page).getByRole("toolbar", { name: "文書の道具" });
  const names = await bar.locator("button").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  expect(names).toEqual(TOOLS);
  await expect(bar).toContainText("種別「タスク」のひな形");
  // 帯の見た目（キャンバス：地は表の頭の色・下に薄い線・ボタンの高さ 28）
  expect(await bar.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe("rgb(250, 251, 252)");
  expect(await bar.evaluate((e) => getComputedStyle(e).borderBottomColor)).toBe("rgb(237, 240, 244)");
  const h = await bar
    .locator("button")
    .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
  expect(new Set(h)).toEqual(new Set([28]));
  const box = doc(page).getByRole("textbox", { name: "目的", exact: true });
  await box.fill("書いた字");
  await expect.poll(() => m.draftSaves.length).toBeGreaterThan(0);
  const saves = m.draftSaves.length;
  for (const name of TOOLS) {
    const b = bar.getByRole("button", { name, exact: true });
    await expect(b, name).toHaveAttribute("aria-disabled", "true");
    expect(Number(await b.evaluate((e) => getComputedStyle(e).opacity)), name).toBeCloseTo(DISABLED_OPACITY, 3);
    await b.click({ force: true });
    await b.press("Enter");
  }
  await expect(box).toHaveValue("書いた字");
  expect(m.draftSaves.length).toBe(saves);
  const add = doc(page).getByRole("button", { name: /＋ 見出しを足す/ });
  await expect(add).toHaveAttribute("aria-disabled", "true");
  await expect(add).toHaveCount(1);
  expect(Number(await add.evaluate((e) => getComputedStyle(e).opacity))).toBeCloseTo(DISABLED_OPACITY, 3);
  const heads = await doc(page).locator("h2").count();
  await add.click({ force: true });
  await expect(doc(page).locator("h2")).toHaveCount(heads);
});

test("K225-UI-009 幅 320・375・768・1024・1440：本文の箱が横に溢れない・375 で欄が箱の内に収まる", async ({ page }) => {
  await mockCreate(page);
  const bad: string[] = [];
  for (const w of [320, 375, 768, 1024, 1440]) {
    await openCreate(page, w);
    await loaded(page);
    const o = await overflowX(page);
    if (o !== 0) bad.push(`幅 ${w}：${o}px`);
  }
  expect(bad).toEqual([]);
  await openCreate(page, 375);
  await loaded(page);
  const sec = (await doc(page).boundingBox())!;
  const box = (await doc(page).getByRole("textbox", { name: "目的", exact: true }).boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(sec.x);
  expect(box.x + box.width).toBeLessThanOrEqual(sec.x + sec.width);
  // 767 以下はキャンバスどおり、道具の帯と文書の左右が 16px
  for (const sel of [".k-create-doc", '[role="toolbar"][aria-label="文書の道具"]']) {
    const pl = await doc(page)
      .locator(sel)
      .evaluate((e) => getComputedStyle(e).paddingLeft);
    const pr = await doc(page)
      .locator(sel)
      .evaluate((e) => getComputedStyle(e).paddingRight);
    expect([pl, pr], sel).toEqual(["16px", "16px"]);
  }
});

test("K225-UI-010 暗いテーマ：本文の箱の地は暗いテーマの --k-card（白でない）・必須の印は暗いテーマの --k-error", async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([{ name: "k-theme", value: "dark", url: baseURL! }]);
  await mockCreate(page);
  await openCreate(page);
  await loaded(page);
  expect(await doc(page).evaluate((e) => getComputedStyle(e).backgroundColor)).toBe("rgb(23, 30, 41)");
  expect(await css(page, 'section[aria-label="本文"] h2 b', "color")).toBe("rgb(242, 139, 130)");
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
const G = CFG.groups.find((x) => x.id === "tickets-new-sections");

test('K225-UI-011 突き合わせの設定：tickets-new-sections が enrolled・持ち主 K-225・本文の箱の画面の側は section[aria-label="本文"]・鍵が在る', () => {
  expect(G).toBeTruthy();
  expect(G!.enrolled).toBe(true);
  expect(G!.owner).toBe("K-225");
  expect(G!.pairs.find((p) => p.role === "body")?.app).toBe('section[aria-label="本文"]');
  for (const p of G!.pairs) expect(p.app, p.name).not.toContain(".k-panel");
  expect(FIDELITY_STATES[G!.state]).toBeTruthy();
});

for (const w of G?.widths ?? [1440]) {
  test(`K225-UI-012 tickets-new-sections（Create）幅 ${w}：組の値と読み込んだ書体がキャンバスと同じ`, async ({
    browser,
  }) => {
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

test("K225-UI-013 正本に区画の見出しの部品が 2 つ（詳細は前からの section-title：上 28／作る画面は section-title-form：上 22・下 6、最初の見出しは section-title-form-first：上 20）・作る画面の見出しはその値", async ({
  page,
}) => {
  const design = readFileSync(join(ROOT, "04_design/DESIGN-kaname.md"), "utf8");
  const front = design.split(/^---$/m)[1] ?? "";
  expect(front).toMatch(/\n {2}section-title:\n(?: {4}.*\n)*? {4}margin: "28px 0 \{spacing\.sm\}"\n/);
  expect(front).toMatch(/\n {2}section-title-form:\n(?: {4}.*\n)*? {4}margin: "22px 0 6px"\n/);
  expect(front).toMatch(/\n {2}section-title-form-first:\n(?: {4}.*\n)*? {4}margin: "20px 0 6px"\n/);
  await mockCreate(page);
  await openCreate(page);
  await loaded(page);
  const tokens = await page.evaluate(() => {
    const st = getComputedStyle(document.documentElement);
    return ["section-title-margin", "section-title-form-margin", "section-title-form-first-margin"].map((k) =>
      st.getPropertyValue(`--k-c-${k}`).trim(),
    );
  });
  expect(tokens[0]).not.toBe(""); // 詳細の画面（.k-section h2）が読む前からのトークンは消さない
  // トークンの字は本番の組み立てで縮むことがある（"0px"→"0" など）ので、数にして比べる
  const nums = (v: string) => v.split(/\s+/).map((x) => Number.parseFloat(x));
  expect(tokens.slice(1).map(nums)).toEqual([
    [22, 0, 6],
    [20, 0, 6],
  ]);
  const m = (n: number) =>
    doc(page)
      .locator("h2")
      .nth(n)
      .evaluate((e) => {
        const st = getComputedStyle(e);
        return [st.marginTop, st.marginBottom].map((x) => Number.parseFloat(x));
      });
  expect(await m(0)).toEqual([20, 6]);
  expect(await m(1)).toEqual([22, 6]);
});

test("K225-UI-014 本文の箱の「テスト仕様」（D-145.9）：見出しと空の箱が在り、「＋ 項目を足す」「抜けを点検する」はグレーで押しても Enter でも何も起きない・AI の文は出ない", async ({
  page,
}) => {
  const m = await mockCreate(page);
  await openCreate(page);
  await loaded(page);
  const spec = doc(page).getByRole("region", { name: "テスト仕様" });
  await expect(spec).toBeVisible();
  await expect(spec).not.toContainText("AI が案を出した");
  const saves = m.draftSaves.length;
  const url = page.url();
  for (const name of ["＋ 項目を足す", "抜けを点検する"]) {
    const b = spec.getByRole("button", { name, exact: true });
    await expect(b, name).toHaveAttribute("aria-disabled", "true");
    expect(Number(await b.evaluate((e) => getComputedStyle(e).opacity)), name).toBeCloseTo(DISABLED_OPACITY, 3);
    await b.click({ force: true });
    await b.press("Enter");
  }
  expect(page.url()).toBe(url);
  expect(m.draftSaves.length).toBe(saves);
  expect(m.creates).toHaveLength(0);
});
