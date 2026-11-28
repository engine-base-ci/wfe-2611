// K-218「DESIGN.md をキャンバスに合わせる」の画面の試験（実 Chrome・実装より先に積む）。見本の画面 /dev/k/design に部品を並べ、
//   キャンバスの値（04_design/canvas の StModal・Create・AuthSignup・OnHome・OnLoading を読んだ値・2026-11-15）と同じかを数で測る。
//   見本の画面の形（実装の役が作る・data-testid）：
//     btn-disabled（Button primary「送る」disabled：使えない状態・answer=78cb822fc1f1）
//     btn-md（Button primary「作る」）・btn-lg（Button primary size lg「次へ」）・btn-outlined（Button outlined「下書きのまま閉じる」）
//     field-md（Field「題名」・入力欄 input-md）・field-lg（Field size lg「メール」・入力欄 input-lg）
//     dlg-open（押すと Dialog「完了にする」：.k-dialog-head に題と右上の「閉じる」・.k-dialog-actions に primary「完了にする」と outlined「やめる」）
//     dlg-plain-open（押すと actions の無い Dialog「共有の相手」）・confirm-open（押すと Confirm「チケットを消しますか」）
//     empty-wrap（幅 900px の箱に Empty「まだチケットがありません」）・loading-wrap（loading-start を押すと Loading を出す・既定の 3 秒）
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Locator, type Page } from "@playwright/test";

const INK = "rgb(19, 27, 39)";
const MUTED = "rgb(74, 85, 99)";
const LINE = "rgb(221, 226, 233)";
const LINE_STRONG = "rgb(184, 192, 204)";
const PRIMARY = "rgb(34, 52, 92)";
const WHITE = "rgb(255, 255, 255)";

const css = (l: Locator, prop: string) => l.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);
const box = async (l: Locator) => (await l.boundingBox())!;
const overflowX = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

async function open(page: Page, width: number) {
  await page.setViewportSize({ width, height: 1000 });
  const res = await page.goto("/dev/k/design");
  expect(res?.status()).toBe(200);
  await page.evaluate(() => document.fonts.ready);
}

async function expectStyle(l: Locator, want: Record<string, string>) {
  for (const [p, v] of Object.entries(want)) expect(await css(l, p), p).toBe(v);
}

test("K218-DS-008 幅 1440：主ボタン（md）は高さ 32・角丸 6px・13px・500・紺の地・左の余白 16px", async ({ page }) => {
  await open(page, 1440);
  const b = page.getByTestId("btn-md");
  await expect(b).toHaveText("作る");
  expect(Math.round((await box(b)).height)).toBe(32);
  await expectStyle(b, {
    "border-top-left-radius": "6px",
    "font-size": "13px",
    "font-weight": "500",
    "background-color": PRIMARY,
    "padding-left": "16px",
  });
  // 使えない状態は隠さず、薄くして押せない形で出す（決める人 answer=78cb822fc1f1・値は今の実装の 0.55 を正本に写した）
  const off = page.getByTestId("btn-disabled");
  await expect(off).toBeVisible();
  await expect(off).toBeDisabled();
  expect(await css(off, "opacity")).toBe("0.55");
});

test("K218-DS-009 幅 1440：主ボタン（lg・入口）は高さ 44・角丸 8px・14px・500", async ({ page }) => {
  await open(page, 1440);
  const b = page.getByTestId("btn-lg");
  await expect(b).toHaveText("次へ");
  expect(Math.round((await box(b)).height)).toBe(44);
  await expectStyle(b, { "border-top-left-radius": "8px", "font-size": "14px", "font-weight": "500" });
});

test("K218-DS-010 outlined のボタンは白地・1px の灰の線（#DDE2E9）・黒字（#131B27）・太さ 400・高さ 32", async ({
  page,
}) => {
  await open(page, 1440);
  const b = page.getByTestId("btn-outlined");
  expect(Math.round((await box(b)).height)).toBe(32);
  await expectStyle(b, {
    "font-weight": "400",
    "background-color": WHITE,
    "border-top-width": "1px",
    "border-top-style": "solid",
    "border-top-color": LINE,
    color: INK,
  });
});

test("K218-DS-011 入力欄（md）：幅 1440 は白地・1px #B8C0CC・角丸 6px・13px・左の余白 10px、幅 375 は 16px", async ({
  page,
}) => {
  await open(page, 1440);
  const i = page.getByTestId("input-md");
  await expectStyle(i, {
    "background-color": WHITE,
    "border-top-width": "1px",
    "border-top-color": LINE_STRONG,
    "border-top-left-radius": "6px",
    "font-size": "13px",
    "padding-left": "10px",
  });
  // D-144.7 の境目：幅 767 以下だけ 16px（iPhone の拡大を防ぐ）、768 から上はキャンバスどおり 13px
  for (const [w, size] of [
    [375, "16px"],
    [767, "16px"],
    [768, "13px"],
  ] as const) {
    await open(page, w);
    expect(await css(page.getByTestId("input-md"), "font-size"), `幅 ${w}`).toBe(size);
  }
});

test("K218-DS-012 幅 1440：入力欄（lg・入口）は高さ 42・1px #DDE2E9・角丸 8px・14px・左の余白 12px", async ({
  page,
}) => {
  await open(page, 1440);
  const i = page.getByTestId("input-lg");
  expect(Math.round((await box(i)).height)).toBe(42);
  await expectStyle(i, {
    "border-top-color": LINE,
    "border-top-left-radius": "8px",
    "font-size": "14px",
    "padding-left": "12px",
  });
});

test("K218-DS-013 項目名：md は 12px・400・灰・欄との間 4px、lg は 12px・500・黒・間 6px", async ({ page }) => {
  await open(page, 1440);
  for (const [id, input, weight, color, gap] of [
    ["field-md", "input-md", "400", MUTED, 4],
    ["field-lg", "input-lg", "500", INK, 6],
  ] as const) {
    const label = page.getByTestId(id).locator(".k-label");
    await expectStyle(label, { "font-size": "12px", "font-weight": weight, color });
    const l = await box(label);
    const i = await box(page.getByTestId(input));
    expect(Math.abs(i.y - (l.y + l.height) - gap), `${id} の間`).toBeLessThanOrEqual(1);
  }
});

test("K218-DS-014 小窓：角丸 12px・白地・題 15px・700・頭の下と足の上に 1px の線・右上の「閉じる」は 28×28 で頭の右の端から 18px", async ({
  page,
}) => {
  await open(page, 1440);
  await page.getByTestId("dlg-open").click();
  const dlg = page.getByRole("dialog");
  await expect(dlg).toBeVisible();
  await expectStyle(dlg, { "border-top-left-radius": "12px", "background-color": WHITE });
  const title = dlg.locator(".k-dialog-title");
  await expect(title).toHaveText("完了にする");
  await expectStyle(title, { "font-size": "15px", "font-weight": "700" });
  const head = dlg.locator(".k-dialog-head");
  await expectStyle(head, { "border-bottom-width": "1px", "border-bottom-color": LINE });
  await expectStyle(dlg.locator(".k-dialog-actions"), { "border-top-width": "1px", "border-top-color": LINE });
  const close = head.getByRole("button", { name: "閉じる" });
  const c = await box(close);
  const h = await box(head);
  expect(Math.round(c.width)).toBe(28);
  expect(Math.round(c.height)).toBe(28);
  expect(Math.abs(h.x + h.width - 18 - (c.x + c.width))).toBeLessThanOrEqual(2);
});

test("K218-DS-015 小窓の「閉じる」を押すと小窓が消え、フォーカスが開いたボタンに戻る", async ({ page }) => {
  await open(page, 1440);
  const opener = page.getByTestId("dlg-open");
  await opener.click();
  const dlg = page.getByRole("dialog");
  await expect(dlg).toBeVisible();
  await dlg.getByRole("button", { name: "閉じる" }).click();
  await expect(dlg).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test("K218-DS-016 幅 375：小窓が画面に収まり、横に溢れない", async ({ page }) => {
  await open(page, 375);
  await page.getByTestId("dlg-open").click();
  const d = await box(page.getByRole("dialog"));
  expect(d.x).toBeGreaterThanOrEqual(0);
  expect(d.x + d.width).toBeLessThanOrEqual(375);
  expect(await overflowX(page)).toBe(0);
});

test("K218-DS-017 空：幅 900 の箱で縮まず（max-width なし）・見出しの字が真ん中・白地・1px dashed #B8C0CC・角丸 12px・余白 36px 28px", async ({
  page,
}) => {
  await open(page, 1440);
  const wrap = await box(page.getByTestId("empty-wrap"));
  const empty = page.getByTestId("empty-wrap").locator('.k-state[data-state="empty"]');
  const e = await box(empty);
  expect(Math.abs(e.width - wrap.width)).toBeLessThanOrEqual(1);
  const title = empty.locator(".k-state-title");
  await expect(title).toHaveText("まだチケットがありません");
  // 見出しの箱でなく、字そのものの範囲の真ん中を測る（箱が伸びて字が左に寄ったままでも緑にしない）
  const ink = await title.evaluate((el) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    const b = r.getBoundingClientRect();
    return { x: b.x, width: b.width };
  });
  expect(Math.abs(ink.x + ink.width / 2 - (e.x + e.width / 2))).toBeLessThanOrEqual(2);
  await expectStyle(empty, {
    "border-top-style": "dashed",
    "border-top-width": "1px",
    "border-top-color": LINE_STRONG,
    "border-top-left-radius": "12px",
    "background-color": WHITE,
    "padding-top": "36px",
    "padding-left": "28px",
  });
});

test("K218-DS-018 読み込み：2.9 秒までは文言が出ず、3 秒を過ぎると「読み込んでいます…」", async ({ page }) => {
  const t0 = new Date("2026-11-16T09:00:00+09:00");
  await page.clock.install({ time: t0 });
  await open(page, 1440);
  // 時計を止めてから読み込みを出す（ページの用意にかかった時間で先に出て揺れないように）
  await page.clock.pauseAt(new Date(t0.getTime() + 60_000));
  const wrap = page.getByTestId("loading-wrap");
  await wrap.getByTestId("loading-start").click();
  await expect(wrap.locator('.k-state[data-state="loading"]')).toHaveCount(1);
  await page.clock.runFor(2900);
  await expect(wrap).not.toContainText("読み込んでいます");
  await page.clock.runFor(200);
  await expect(wrap).toContainText("読み込んでいます…");
});

test("K218-DS-019 暗いテーマ：入力欄の地は暗いテーマの --k-card・outlined の線は暗いテーマの --k-line", async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([{ name: "k-theme", value: "dark", url: baseURL! }]);
  await open(page, 1440);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await css(page.getByTestId("input-md"), "background-color")).toBe("rgb(23, 30, 41)");
  expect(await css(page.getByTestId("btn-outlined"), "border-top-color")).toBe("rgb(42, 52, 67)");
});

test("K218-DS-027 帯の中のボタン（K-217）は字が body（13px）になっても高さ 30、sm は 28 のまま", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const res = await page.goto("/dev/k/page-parts");
  expect(res?.status()).toBe(200);
  await page.evaluate(() => document.fonts.ready);
  const md = page.locator('header.k-page-head .k-btn:not([data-size="sm"])').first();
  const sm = page.locator('header.k-page-head .k-btn[data-size="sm"]').first();
  expect(Math.abs((await box(md)).height - 30)).toBeLessThanOrEqual(1);
  expect(Math.abs((await box(sm)).height - 28)).toBeLessThanOrEqual(1);
});

test("K218-DS-029 ふつうの小窓：「閉じる」は頭の × の 1 つだけ・開くとフォーカスは × でなく本文の最初の欄か足の最初のボタン。取り消せない確かめ（Confirm）は × を持たず、開くとフォーカスは「やめる」・Esc で閉じる", async ({
  page,
}) => {
  await open(page, 1440);
  // 足のある小窓：最初のフォーカスは足の最初のボタン（やめる）。× ではない
  await page.getByTestId("dlg-open").click();
  const done = page.getByRole("dialog", { name: "完了にする" });
  await expect(done).toBeVisible();
  await expect(done.getByRole("button", { name: "やめる" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(done).toHaveCount(0);

  const opener = page.getByTestId("dlg-plain-open");
  await opener.click();
  const dlg = page.getByRole("dialog", { name: "共有の相手" });
  await expect(dlg).toBeVisible();
  await expect(dlg.getByRole("button", { name: "閉じる" })).toHaveCount(1);
  await expect(dlg.locator(".k-dialog-head").getByRole("button", { name: "閉じる" })).toHaveCount(1);
  await expect(dlg.getByRole("button", { name: "閉じる" })).not.toBeFocused();
  await dlg.getByRole("button", { name: "閉じる" }).click();
  await expect(dlg).toHaveCount(0);
  await expect(opener).toBeFocused();

  const cfOpener = page.getByTestId("confirm-open");
  await cfOpener.click();
  const cf = page.getByRole("alertdialog", { name: "チケットを消しますか" });
  await expect(cf).toBeVisible();
  await expect(cf.getByRole("button", { name: "閉じる" })).toHaveCount(0);
  await expect(cf.getByRole("button", { name: "やめる" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(cf).toHaveCount(0);
});
