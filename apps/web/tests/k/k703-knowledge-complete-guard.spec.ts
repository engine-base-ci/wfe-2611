// K-703「確認項目の出どころの印（ナレッジ：ページの名前）と『まだ完了にできません』の小窓」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f9/tk-blocked（本番と同じ部品 features/F9/knowledge/ticket-views.tsx・代表 OK 2026-11-22・決め 12）。字・並びは下絵が正。
//   詳細・帯・実行・完了の口は段 5 の道具 complete-mock.ts（K-572）で開き、確認項目の口（出どころ knowledge と source_page つき）と完了の口の 409 は knowledge-guard-mock.ts で重ねる。
//   完了を止めるのは「必ず守る」から入った確認項目（source_page がある行）で、人が足した行は止めずに注意の 1 行だけ（決め 12・段 5 のとおり）。
//   行の形の正は口の葉 K-434（listTestSpecs）・K-701（source_page・409 E-KNW-240 の体 detail.left）の md。固定の待ちは使わない。name は exact。
//   純粋な形は apps/web/test/k703-spec-guard-shape.test.ts（K703-UN-001〜005）。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
import { bandOf, dialog, openComplete, openTicketSettled } from "../features/F5/approve-complete.harness";
import { msg } from "./complete-mock";
import { matchF9 } from "./f9-match";
import {
  MOCK_ROWS,
  P_INV,
  P_MAIL,
  P_OUT,
  human,
  kn,
  knwLeft,
  leftRow,
  mockGuard,
  sid,
  uid,
  type KRow,
} from "./knowledge-guard-mock";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, "../..");
const WIDTHS = [320, 375, 768, 1024, 1440] as const;
const MATCH_WIDTHS = [375, 768, 1440] as const;
const TARGET = "EG-133 11 月分の請求書を送る";
const TITLE = "まだ完了にできません";
const BACK = "確認項目に戻る";
const CLOSE = "閉じる";
const GO = "このまま完了にする";
const blockTitle = (n: number): string =>
  `「必ず守る」から入った確認項目に、チェックの付いていない物が ${n} つあります`;
const cautionNote = (n: number): string =>
  `人が足した確認項目にも、チェックの付いていない物が ${n} つあります。完了は止めませんが、見直してください。`;
const KEEP_LINE = "メールを送るなど、外に出る操作は、チェックとは別に人の承認が要ります。";

const completeBtn = (page: Page) => page.getByRole("button", { name: "完了にする", exact: true });
const panelOf = (page: Page) => page.getByRole("complementary", { name: "チケットのパネル", exact: true });
const overflowX = (p: Page) =>
  p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
/** 右のパネルの「項目」を開き、確認項目の「開く」を押して行を出す（口は 1 回） */
const openSpecs = async (page: Page): Promise<void> => {
  await panelOf(page).getByRole("button", { name: "項目", exact: true }).click();
  await panelOf(page).getByRole("button", { name: "開く", exact: true }).click();
  await expect(panelOf(page).getByRole("checkbox").first()).toBeVisible();
};
const TWO = (): KRow[] => [
  kn(1, P_INV, "請求書の送り方"),
  kn(2, P_OUT, "外に出す前の確かめ"),
  kn(3, P_MAIL, "メールの書き方", true),
  human(4, "先月と同じ書式になっている", true),
];

// ---------------------------------------------------------------- 確認項目の印

test("K703-UI-001 右のパネルの確認項目（開いた形）：ナレッジから入った行に「ナレッジ：ページの名前」の印が付き（4 つ）、人が足した行（先月と同じ書式）には付かない", async ({
  page,
}) => {
  await mockGuard(page, MOCK_ROWS());
  await openTicketSettled(page);
  await openSpecs(page);
  const marks = panelOf(page).locator(".k-f9-spec-from");
  await expect(marks).toHaveText([
    "ナレッジ：請求書の送り方",
    "ナレッジ：請求書の送り方",
    "ナレッジ：メールの書き方",
    "ナレッジ：外に出す前の確かめ",
  ]);
  const human5 = panelOf(page)
    .getByRole("checkbox", { name: "先月と同じ書式になっている", exact: true })
    .locator("xpath=ancestor::li[1]");
  await expect(human5.locator(".k-f9-spec-from")).toHaveCount(0);
});

test("K703-UI-002 印の字はページへのリンク：href は /knowledge/<ページの id>・新しいタブで開く（target=_blank・rel に noopener）", async ({
  page,
}) => {
  await mockGuard(page, MOCK_ROWS());
  await openTicketSettled(page);
  await openSpecs(page);
  const link = panelOf(page).getByRole("link", { name: "ナレッジ：メールの書き方", exact: true });
  await expect(link).toHaveAttribute("href", `/knowledge/${P_MAIL}`);
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", /noopener/);
});

test("K703-UI-003 ナレッジから入った行は文と「外す」が押せない形のまま（段 5 の決め）で、箱は押せる：外す（チェックを外す）と口に { version, checked: false } が 1 回届く", async ({
  page,
}) => {
  const g = await mockGuard(page, MOCK_ROWS());
  await openTicketSettled(page);
  await openSpecs(page);
  await expect(
    panelOf(page).getByRole("button", { name: "『メールの書き方』を守ったを直す", exact: true }),
  ).toHaveAttribute("aria-disabled", "true");
  await expect(
    panelOf(page).getByRole("button", { name: "『メールの書き方』を守ったを外す", exact: true }),
  ).toHaveAttribute("aria-disabled", "true");
  await panelOf(page).getByRole("checkbox", { name: "『メールの書き方』を守った", exact: true }).click();
  await expect.poll(() => g.patches.length).toBe(1);
  expect(g.patches[0]!.body).toEqual({ version: 1, checked: false });
});

// ---------------------------------------------------------------- 完了を止める小窓

test("K703-UI-004 「完了にする」で、必ず守るから入った確認項目にチェックの無い行が 2 つ：小窓「まだ完了にできません」（対象の行つき）に注意「…物が 2 つあります」「これにチェックが付くと、完了にできます。」・2 つの行（文と「ナレッジ：ページの名前」）・外に出る操作は別に人の承認の 1 行・足は「閉じる」「確認項目に戻る」。この時点で完了の口は 0 回・確認項目の口は 1 回", async ({
  page,
}) => {
  const g = await mockGuard(page, TWO());
  await openTicketSettled(page);
  await openComplete(page);
  const d = dialog(page);
  await expect(d.getByRole("heading", { name: TITLE, exact: true })).toBeVisible();
  await expect(d.locator(".k-dialog-target")).toHaveText(TARGET);
  await expect(d.getByText(blockTitle(2), { exact: true })).toBeVisible();
  await expect(d.getByText("これにチェックが付くと、完了にできます。", { exact: true })).toBeVisible();
  const list = d.getByRole("list", { name: "チェックの付いていない、必ず守る確認項目", exact: true });
  await expect(list.locator("li")).toHaveText([
    /『請求書の送り方』を守った\s*ナレッジ：請求書の送り方/,
    /『外に出す前の確かめ』を守った\s*ナレッジ：外に出す前の確かめ/,
  ]);
  await expect(d.getByText(KEEP_LINE, { exact: true })).toBeVisible();
  await expect(d.locator(".k-dialog-actions").getByRole("button")).toHaveText([CLOSE, BACK]);
  expect(g.complete.api.completes).toHaveLength(0);
  expect(g.reads).toBe(1);
});

test("K703-UI-005 人が足した確認項目だけが未チェックなら止めない：小窓は段 5 の「完了にする」（止めない注意）で、「このまま完了にする」で完了の口が 1 回届く（「まだ完了にできません」は出ない）", async ({
  page,
}) => {
  const g = await mockGuard(page, [human(1, "先月と同じ書式になっている"), kn(2, P_INV, "請求書の送り方", true)]);
  await openTicketSettled(page);
  await openComplete(page);
  const d = dialog(page);
  await expect(d.getByRole("heading", { name: "完了にする", exact: true })).toBeVisible();
  await expect(d.getByRole("heading", { name: TITLE, exact: true })).toHaveCount(0);
  await d.getByRole("button", { name: GO, exact: true }).click();
  await expect.poll(() => g.complete.api.completes.length).toBe(1);
});

test("K703-UI-006 止める行と人が足した未チェックの行が混ざる：小窓に並ぶのは止める行だけ・人が足した行には「完了は止めませんが、見直してください」の 1 行（件数つき・仮の字）。人が足した未チェックが無ければその 1 行は出ない", async ({
  page,
}) => {
  await mockGuard(page, [
    kn(1, P_OUT, "外に出す前の確かめ"),
    human(2, "先月と同じ書式になっている"),
    human(3, "宛名を見た"),
  ]);
  await openTicketSettled(page);
  await openComplete(page);
  const d = dialog(page);
  await expect(
    d.getByRole("list", { name: "チェックの付いていない、必ず守る確認項目", exact: true }).locator("li"),
  ).toHaveCount(1);
  await expect(d.getByText("先月と同じ書式になっている", { exact: true })).toHaveCount(0);
  await expect(d.getByText(cautionNote(2), { exact: true })).toBeVisible();
  await d.getByRole("button", { name: CLOSE, exact: true }).click();

  await page.unrouteAll({ behavior: "ignoreErrors" });
  await mockGuard(page, [kn(1, P_OUT, "外に出す前の確かめ")]);
  await openTicketSettled(page);
  await openComplete(page);
  await expect(dialog(page).getByText(/人が足した確認項目にも/)).toHaveCount(0);
});

test("K703-UI-007 ナレッジから入った行が全部チェック済みで、人が足した行だけ未チェック：「まだ完了にできません」は出ず、段 5 の小窓になる", async ({
  page,
}) => {
  await mockGuard(page, [
    kn(1, P_INV, "請求書の送り方", true),
    kn(2, P_OUT, "外に出す前の確かめ", true),
    human(3, "宛名を見た"),
  ]);
  await openTicketSettled(page);
  await openComplete(page);
  await expect(dialog(page).getByRole("heading", { name: TITLE, exact: true })).toHaveCount(0);
  await expect(dialog(page).getByRole("heading", { name: "完了にする", exact: true })).toBeVisible();
});

test("K703-UI-008 一覧を読んだ後に口が止めた（出どころが生きていると一覧に出ず、口は 409 E-KNW-240）：「このまま完了にする」の後、段 5 の小窓が閉じて「まだ完了にできません」が開き、口の答えの残りの行（行の文・ページの題名）が並ぶ。完了の口は 1 回・赤い知らせは出ない", async ({
  page,
}) => {
  const rows: KRow[] = [{ ...kn(1, P_INV, "請求書の送り方"), source_page: null }, human(2, "宛名を見た", true)];
  const g = await mockGuard(page, rows);
  g.complete.api.on.complete = () => knwLeft([leftRow(rows[0]!, "請求書の送り方", P_INV)]);
  await openTicketSettled(page);
  await openComplete(page);
  await expect(dialog(page).getByRole("heading", { name: "完了にする", exact: true })).toBeVisible();
  await dialog(page).getByRole("button", { name: GO, exact: true }).click();
  const d = dialog(page);
  await expect(d.getByRole("heading", { name: TITLE, exact: true })).toBeVisible();
  await expect(d.getByRole("heading", { name: "完了にする", exact: true })).toHaveCount(0);
  await expect(
    d.getByRole("list", { name: "チェックの付いていない、必ず守る確認項目", exact: true }).locator("li"),
  ).toHaveText([/『請求書の送り方』を守った\s*ナレッジ：請求書の送り方/]);
  expect(g.complete.api.completes).toHaveLength(1);
  await expect(bandOf(page).getByRole("alert")).toHaveCount(0);
});

test("K703-UI-009 409 E-KNW-240 の体が読めない（detail が無い・残りの行が 0）：小窓にせず、前からの赤い知らせ（正本 E-KNW-240 の文）に任せる・完了は動かない", async ({
  page,
}) => {
  const g = await mockGuard(page, [human(1, "宛名を見た")]);
  g.complete.api.on.complete = () => ({ status: 409, body: { error: "conflict", code: "E-KNW-240" } });
  await openTicketSettled(page);
  await openComplete(page);
  await dialog(page).getByRole("button", { name: GO, exact: true }).click();
  // 部分一致は意図：正本の文（msg）は赤い知らせの中の 1 文として出る（前後に別の字が付いてよい）
  await expect(page.getByText(msg("E-KNW-240"), { exact: false }).first()).toBeVisible();
  await expect(dialog(page).getByRole("heading", { name: TITLE, exact: true })).toHaveCount(0);
  expect(g.complete.api.completes).toHaveLength(1);
});

test("K703-UI-010 小窓の「閉じる」・右上の ×・Esc：口を呼ばずに閉じ、キーボードの場所は「完了にする」に戻る。押し直すとまた最初から（確認項目の口が 1 回増える）", async ({
  page,
}) => {
  const g = await mockGuard(page, TWO());
  await openTicketSettled(page);
  let reads = 0;
  for (const how of ["close", "x", "esc"] as const) {
    await openComplete(page);
    reads += 1;
    expect(g.reads).toBe(reads);
    if (how === "close") await dialog(page).getByRole("button", { name: CLOSE, exact: true }).click();
    else if (how === "x")
      await dialog(page)
        .getByRole("button", { name: /閉じる|×/ })
        .first()
        .click();
    else await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);
    await expect(completeBtn(page)).toBeFocused();
    expect(g.complete.api.completes).toHaveLength(0);
  }
});

test("K703-UI-011 「確認項目に戻る」：口を呼ばずに閉じ、キーボードの場所は「完了にする」に戻る（右のパネルを開く・切り替える動きは足さない＝勧め）", async ({
  page,
}) => {
  const g = await mockGuard(page, TWO());
  await openTicketSettled(page);
  await openComplete(page);
  await dialog(page).getByRole("button", { name: BACK, exact: true }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(completeBtn(page)).toBeFocused();
  expect(g.complete.api.completes).toHaveLength(0);
});

test("K703-UI-012 止められた後、確認項目にチェックを付けると（箱を押す・口に { version, checked: true } が届く）、もう一度「完了にする」で小窓なしに完了の口が 1 回届く（本文に未チェックの箱が無いとき）", async ({
  page,
}) => {
  const g = await mockGuard(page, TWO());
  await openTicketSettled(page);
  await openComplete(page);
  await dialog(page).getByRole("button", { name: BACK, exact: true }).click();
  await openSpecs(page);
  for (const t of ["『請求書の送り方』を守った", "『外に出す前の確かめ』を守った"])
    await panelOf(page).getByRole("checkbox", { name: t, exact: true }).click();
  await expect.poll(() => g.patches.length).toBe(2);
  expect(g.patches.map((p) => p.body)).toEqual([
    { version: 1, checked: true },
    { version: 1, checked: true },
  ]);
  await completeBtn(page).click();
  await expect.poll(() => g.complete.api.completes.length).toBe(1);
  await expect(dialog(page)).toHaveCount(0);
});

test("K703-UI-013 出どころが knowledge でも source_page が null の行（必ず守るから外れた・ページが無い）：印は出ず、完了を止めず（段 5 の小窓）、文と「外す」は押せない形のまま", async ({
  page,
}) => {
  await mockGuard(page, [{ ...kn(1, P_INV, "請求書の送り方"), source_page: null }]);
  await openTicketSettled(page);
  await openSpecs(page);
  await expect(panelOf(page).locator(".k-f9-spec-from")).toHaveCount(0);
  await expect(
    panelOf(page).getByRole("button", { name: "『請求書の送り方』を守ったを直す", exact: true }),
  ).toHaveAttribute("aria-disabled", "true");
  await openComplete(page);
  await expect(dialog(page).getByRole("heading", { name: TITLE, exact: true })).toHaveCount(0);
});

test("K703-UI-014 口が source_page の鍵を持たない（K-701 より前の答え）：印は出ず、完了を止めず、段 5 のとおり動く（落ちない）", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const rows: KRow[] = [{ id: sid(1), title: "『請求書の送り方』を守った", checked: false, source: "knowledge" }];
  await mockGuard(page, rows);
  await openTicketSettled(page);
  await openSpecs(page);
  await expect(panelOf(page).locator(".k-f9-spec-from")).toHaveCount(0);
  await openComplete(page);
  await expect(dialog(page).getByRole("heading", { name: "完了にする", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("K703-UI-015 ページの題名に HTML が入っていても、印と小窓に字として出て動かない（img・script が作られず alert も出ない）", async ({
  page,
}) => {
  let alerts = 0;
  page.on("dialog", (d) => {
    alerts += 1;
    void d.dismiss();
  });
  const bad = '<img src=x onerror="alert(1)">';
  await mockGuard(page, [kn(1, P_INV, bad)]);
  await openTicketSettled(page);
  await openSpecs(page);
  await expect(panelOf(page).locator(".k-f9-spec-from").first()).toContainText(bad);
  await openComplete(page);
  // 部分一致は意図：壊れた字（bad）は題名の文の一部として出る（前後に別の字が付いてよい）
  await expect(dialog(page).getByText(bad, { exact: false }).first()).toBeVisible();
  await expect(page.locator("img[src='x']")).toHaveCount(0);
  await expect(page.locator("script:not([src])", { hasText: "alert(1)" })).toHaveCount(0);
  expect(alerts).toBe(0);
});

test("K703-UI-016 「完了にする」の二度押し（確認項目の答えを止めた間）：口は 1 回・小窓は 1 つ・完了の口は 0 回", async ({
  page,
}) => {
  const g = await mockGuard(page, TWO());
  await openTicketSettled(page);
  const release = g.hold();
  await completeBtn(page).click();
  // 答えを待つ間は「完了にする」を押せない形（K-572 のまま）：二度目を押す代わりに、押せない形であることを確かめる
  await expect(completeBtn(page)).toBeDisabled();
  release();
  await expect(dialog(page).getByRole("heading", { name: TITLE, exact: true })).toBeVisible();
  await expect(dialog(page)).toHaveCount(1);
  expect(g.reads).toBe(1);
  expect(g.complete.api.completes).toHaveLength(0);
});

test("K703-UI-017 幅 320・375・768・1024・1440 × 止める行 15 つ・長い文と長い題名：小窓が画面の中に収まり、横のはみ出し 0（数値）・折り返す", async ({
  page,
}) => {
  const long = "とても長い確認項目の文".repeat(10);
  const rows = Array.from({ length: 15 }, (_, i) => kn(i + 1, uid(0xe000 + i), `${long}${i}`));
  for (const w of WIDTHS) {
    await mockGuard(page, rows);
    await openTicketSettled(page, w);
    await openComplete(page);
    const box = await dialog(page).boundingBox();
    expect(box, `幅 ${w}`).not.toBeNull();
    expect(box!.x, `幅 ${w}`).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width, `幅 ${w}`).toBeLessThanOrEqual(w);
    expect(await overflowX(page), `幅 ${w}`).toBe(0);
    await page.keyboard.press("Escape");
    await page.unrouteAll({ behavior: "ignoreErrors" });
  }
});

test("K703-UI-018 キーボードだけ：小窓が開くと焦点は小窓の中・Tab を 20 回押しても外へ出ず・Esc で閉じて焦点は「完了にする」に戻り・Enter でまた開く", async ({
  page,
}) => {
  await mockGuard(page, TWO());
  await openTicketSettled(page);
  await completeBtn(page).focus();
  await page.keyboard.press("Enter");
  await expect(dialog(page).getByRole("heading", { name: TITLE, exact: true })).toBeVisible();
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("Tab");
    expect(await dialog(page).evaluate((el) => el.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(completeBtn(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog(page).getByRole("heading", { name: TITLE, exact: true })).toBeVisible();
});

// ---------------------------------------------------------------- 下絵との突き合わせ・口の数

const px = (name: string, sel: string, props: string[]): FidelityPair => ({
  name,
  role: name,
  canvas: sel,
  app: sel,
  props,
});
const TXT = ["font-size", "color", "texts"];
const BLOCK_PAIRS: FidelityPair[] = [
  px("dialog", ".k-dialog", ["width", "x", "background-color", "border-top-left-radius"]),
  px("dialog-title", ".k-dialog h2", ["x", ...TXT]),
  px("pick-row", ".k-f9-pick-row", ["x", "width", "height"]),
  px("pick-main", ".k-f9-pick-main b", ["x", ...TXT]),
  px("pick-from", ".k-f9-pick-main small", ["x", ...TXT]),
  px("note", ".k-f9-note", ["x", ...TXT]),
  px("dialog-btn", ".k-dialog-actions button", ["width", "height", "x", "font-size", "texts"]),
];

test("K703-UI-019 下絵 tk-blocked との突き合わせ（幅 375・768・1440）：小窓の大きさ・見出し・止める行（文と出どころ）・注意の 1 行・足のボタンの位置・大きさ・字がモックと同じ（matchF9 の bad が 0。対象の行の字は比べない）", async ({
  browser,
}) => {
  for (const w of MATCH_WIDTHS) {
    const { bad } = await matchF9(
      browser,
      "tk-blocked",
      w,
      async (p) => {
        await mockGuard(p, MOCK_ROWS());
        await openTicketSettled(p, w);
        await openComplete(p);
      },
      { pairs: BLOCK_PAIRS },
    );
    expect(bad, `幅 ${w}`).toEqual([]);
  }
});

test("K703-UI-020 口の数が増えない：確認項目を開く 1 回・「完了にする」を押すとさらに 1 回（段 5 の決めのまま）・小窓を出すために口を増やさない・完了の口 0 回・ナレッジの口 0 回", async ({
  page,
}) => {
  const knowledge: string[] = [];
  page.on("request", (r) => {
    if (/\/api\/v1\/knowledge/.test(r.url())) knowledge.push(r.url());
  });
  const g = await mockGuard(page, MOCK_ROWS());
  await openTicketSettled(page);
  await openSpecs(page);
  expect(g.reads).toBe(1);
  await openComplete(page);
  expect(g.reads).toBe(2);
  expect(g.complete.api.completes).toHaveLength(0);
  expect(knowledge).toEqual([]);
});

// ---------------------------------------------------------------- 部品の置き方

const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const read = (rel: string): string => strip(readFileSync(join(WEB, rel), "utf8"));

test("K703-MK-001 完了の流れ（approve-complete）は F9 の同じ小窓の部品（CompleteBlockedDialog）を使い、二つ目の小窓を持たない。確認項目の行（F4 の spec-row）は F9 の印の部品（SpecFrom）を使い、下絵の SpecList も同じ部品", () => {
  const flow = read("features/F5/approve-complete/use-complete.ts") + read("features/F5/approve-complete/band.tsx");
  expect(flow).toMatch(/CompleteBlockedDialog/);
  expect(flow).toMatch(/spec-guard-shape/);
  expect(flow).not.toMatch(/まだ完了にできません/);
  expect(read("features/F4/specs/spec-row.tsx")).toMatch(/SpecFrom/);
  expect(read("features/F9/knowledge/ticket-views.tsx")).toMatch(/SpecFrom/);
});

test("K703-MK-002 部品（spec-from・spec-guard-shape）は口を呼ばず、HTML を直に差さず、編集の部品を読まない。F4 の部品は F9 の印を出す 1 か所だけを足す（出どころの字を F4 に書かない）", () => {
  for (const f of ["spec-from.tsx", "spec-guard-shape.ts"]) {
    const src = read(`features/F9/knowledge/${f}`);
    expect(src, `${f} が口を呼ぶ`).not.toMatch(/\bfetch\(|apiFetch|\/api\/v1|from "@\/lib\/api/);
    expect(src, `${f} が HTML を差す`).not.toMatch(/dangerouslySetInnerHTML|innerHTML/);
    expect(src, `${f} が編集の部品を読む`).not.toMatch(/@tiptap\/|prosemirror-/);
  }
  expect(read("features/F4/specs/spec-row.tsx")).not.toMatch(/ナレッジ：/);
});
