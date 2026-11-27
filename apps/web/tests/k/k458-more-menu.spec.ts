// K-458「画面：詳細の頭の「…」のメニュー（複製する・版と差分を見るの 2 つだけが動く。ほかは押せない形）」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f4 の f4-more-menu（下絵・2026-11-20・部品は features/F4/detail-more/views.tsx の MoreMenu）。
//   「複製する」は K-446 の複製の小窓（DuplicateFlow）を開き、「版と差分を見る」は K-449 の版と差分の頁（/tickets/:id/versions・小窓ではなく頁）へ移るだけ（2026-11-22 の作り直し）。
//   小窓・頁の中身の細かい確かめ（題名・期限・チェック・戻す・差分）は K-446・K-449 の試験が持つ。この試験は「…」から開いた複製の小窓と、移った先の頁が
//   最後まで動く（死にボタンでない）ことと、押せない 7 項目・メニューの開閉・キー操作・焦点・幅・見た目を見る。
//   口は網の手前で差し替える（道具 more-mock.ts：K-449 の mockVersions と K-446 の routeCreate を重ねる）。
//   固定の待ちは使わない（要素と答えを待つ）。getByRole の name は exact（頭が決まった名前は正規表現）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Page } from "@playwright/test";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
import { TICKET } from "../features/F5/approve-complete.harness";
import { NEW_ID, settledDetail } from "./create-mock";
import { NUMBER, TITLE, firstOf } from "./duplicate-mock";
import { countWrites, opacityOf } from "./kit";
import { dupBody, openDetail, setupMore } from "./more-mock";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";
import { WIDTHS, alertWith, failed, msg, overflowX, verItems, versionsUrl } from "./versions-mock";

test.use({ timezoneId: "Asia/Tokyo" });

const INERT_TITLE = "まだ使えません";
/** 開いた一覧の項目の字（下絵の順）。区切りは 4 つ目の後と 7 つ目の後 */
const LABELS = [
  "複製する",
  "ほかのグループへ移す",
  "種別を変える",
  "ひな形にする",
  "リンクをコピー",
  "版と差分を見る",
  "実行の記録を見る",
  "消す",
];
/** 押せない 5 つ（名前は字の頭で引く。「種別を変える」「ひな形にする」は下に補足の字がつく）。
 *  「消す」は段 8 の K-590 が DetailMore に onDelete を渡して押せる項目にした（K-590 が carry して替えた・2026-11-27）ので、ここに入れない */
const INERT = [/^ほかのグループへ移す/, /^種別を変える/, /^ひな形にする/, /^リンクをコピー/, /^実行の記録を見る/];
/** 押せる 3 つ（「複製する」「版と差分を見る」は K-458・「消す」は K-590） */
const USABLE = ["複製する", "版と差分を見る", "消す"];

const more = (p: Page) => p.getByRole("button", { name: "ほかの操作", exact: true });
const menu = (p: Page) => p.getByRole("menu");
const item = (p: Page, name: string | RegExp) => menu(p).getByRole("menuitem", { name });
const dupBtn = (p: Page) => p.getByRole("button", { name: "複製", exact: true });
const dlg = (p: Page) => p.getByRole("dialog", { name: "複製する", exact: true });
const go = (p: Page) => dlg(p).getByRole("button", { name: "複製して開く", exact: true });
const cancel = (p: Page) => dlg(p).getByRole("button", { name: "やめる", exact: true });
const titleBox = (p: Page) => dlg(p).getByRole("textbox", { name: "題名", exact: true });
const alertOf = (p: Page) => dlg(p).getByRole("alert");
const versionsHeading = (p: Page) => p.getByRole("heading", { level: 1, name: "版と差分", exact: true });
const openMenu = async (p: Page) => {
  await more(p).click();
  await expect(menu(p)).toBeVisible();
};

// ================================================================ 入口・項目

test("K458-UI-001 入口：詳細の頭の「…」（名前「ほかの操作」）は押せる（aria-disabled なし）。開く前はメニューが無く、口は増えない。押すとメニューが開き、項目は「複製する」「ほかのグループへ移す」「種別を変える」「ひな形にする」｜「リンクをコピー」「版と差分を見る」「実行の記録を見る」｜「消す」の順（区切り 2 本）。開いても getTicket は 1 回のまま・書く口 0", async ({
  page,
}) => {
  const { v, post } = await setupMore(page);
  await openDetail(page);
  const writes = countWrites(page);
  await expect(more(page)).toBeVisible();
  await expect(more(page)).not.toHaveAttribute("aria-disabled", "true");
  await expect(menu(page)).toHaveCount(0);
  await openMenu(page);
  await expect(menu(page).getByRole("menuitem")).toHaveCount(8);
  await expect(menu(page).locator(".k-f4-more-main > span:first-child")).toHaveText(LABELS);
  const order = await menu(page)
    .locator('[role="menuitem"], [role="separator"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute("role")));
  expect(order).toEqual([
    ...Array<string>(4).fill("menuitem"),
    "separator",
    ...Array<string>(4).fill("menuitem"),
    "separator",
    "menuitem",
  ]);
  expect(v.ticketReads).toBe(1);
  expect(v.lists).toHaveLength(0);
  expect(writes.n).toBe(0);
  expect(post.posts).toEqual([]);
});

test("K458-UI-002 対象の状態：使えるのは「複製する」「版と差分を見る」「消す」の 3 つ（「消す」は段 8 の K-590 が onDelete を渡して押せる）。ほかの 5 つは aria-disabled・薄さ 0.55・title「まだ使えません」で、隠さずに出る。⌘D・⌘L の字と「準備中」の字は出ない（動かないキーの字を出さない・D-150.25）", async ({
  page,
}) => {
  await setupMore(page);
  await openDetail(page);
  await openMenu(page);
  for (const name of USABLE) {
    await expect(item(page, name), name).toHaveCount(1);
    await expect(item(page, name), name).not.toHaveAttribute("aria-disabled", "true");
    expect(await opacityOf(item(page, name)), `${name} の薄さ`).toBeCloseTo(1, 3);
  }
  for (const re of INERT) {
    const it = item(page, re);
    await expect(it, String(re)).toHaveCount(1);
    await expect(it, String(re)).toHaveAttribute("aria-disabled", "true");
    expect(await opacityOf(it), `${re} の薄さ`).toBeCloseTo(0.55, 3);
  }
  await expect(menu(page).locator(`[title="${INERT_TITLE}"]`)).toHaveCount(5);
  await expect(menu(page)).not.toContainText("⌘");
  await expect(menu(page)).not.toContainText("準備中");
});

test("K458-UI-003 操作の揺れ：押せない 5 つ（「消す」は K-590 で押せる物になったので外す。押したときの動きは K590-UI-001・002 が見る）を 1 つずつ押しても、Enter を押しても、何も起きない（小窓は開かず・メニューは開いたまま・道は変わらず・口は 1 回も呼ばれない）", async ({
  page,
}) => {
  const { v, post } = await setupMore(page);
  await openDetail(page);
  const writes = countWrites(page);
  await openMenu(page);
  const url = page.url();
  for (const re of INERT) {
    await item(page, re).click({ force: true });
    await expect(menu(page), `${re} を押した後`).toBeVisible();
  }
  await page.keyboard.press("Enter");
  await expect(menu(page)).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  expect(page.url()).toBe(url);
  expect(writes.n).toBe(0);
  expect(post.posts).toEqual([]);
  expect(v.ticketReads).toBe(1);
  expect(v.lists).toHaveLength(0);
});

// ================================================================ 複製する

test("K458-UI-004 入口：「複製する」を押すとメニューが閉じ、複製の小窓「複製する」が開く（頭の行「EG-119 から新しいチケットを作る」・題名は元のまま）。開いても getTicket は 1 回のまま・createTicket は 0 回・書く口 0", async ({
  page,
}) => {
  const { v, post } = await setupMore(page);
  await openDetail(page);
  const writes = countWrites(page);
  await openMenu(page);
  await item(page, "複製する").click();
  await expect(dlg(page)).toBeVisible();
  await expect(menu(page)).toHaveCount(0);
  await expect(dlg(page)).toContainText(`${NUMBER} から新しいチケットを作る`);
  await expect(titleBox(page)).toHaveValue(TITLE);
  expect(v.ticketReads).toBe(1);
  expect(post.posts).toEqual([]);
  expect(writes.n).toBe(0);
});

test("K458-UI-005 結果：「…」から開いた複製の小窓で「複製して開く」を押すと、createTicket が 1 回（体はちょうど 7 つ：元の scope・kind・題名・担当者・期限・duplicate_of＝見ているチケットの id・copy 6 つの名前。Idempotency-Key あり）届き、小窓が閉じて、作った詳細（題名「作った」）へ移る", async ({
  page,
}) => {
  const { post } = await setupMore(page);
  await openDetail(page);
  await openMenu(page);
  await item(page, "複製する").click();
  await expect(dlg(page)).toBeVisible();
  await go(page).click();
  await settledDetail(page);
  expect(page.url()).toContain(`/tickets/${NEW_ID}`);
  expect(post.posts).toHaveLength(1);
  expect(post.posts[0]!.body).toEqual(dupBody());
  expect(post.posts[0]!.body["duplicate_of"]).toBe(TICKET);
  expect(post.posts[0]!.key).toBeTruthy();
});

test("K458-UI-006 利用者の状態：S1 失敗：書けない人（複製の口が失敗＝403）が「…」から複製を送ると、小窓の上の赤い箱にページ共通の権限の文の 1 文目が出る。書いた題名は残り、小窓は開いたまま。「…」の項目の並びは役で変わらない（閉じて開き直しても 8 つ）", async ({
  page,
}) => {
  const { post } = await setupMore(page);
  post.on.create = () => ({ status: 403, body: { error: "forbidden", code: "FORBIDDEN" } });
  await openDetail(page);
  await openMenu(page);
  await item(page, "複製する").click();
  await titleBox(page).fill("直した題名");
  await go(page).click();
  await expect(alertOf(page)).toHaveText(firstOf("E-PAGE-002"));
  await expect(dlg(page)).toBeVisible();
  await expect(titleBox(page)).toHaveValue("直した題名");
  expect(post.posts).toHaveLength(1);
  await cancel(page).click();
  await expect(dlg(page)).toHaveCount(0);
  await openMenu(page);
  await expect(menu(page).getByRole("menuitem")).toHaveCount(8);
});

// ================================================================ 版と差分を見る

test("K458-UI-007 入口：「版と差分を見る」を押すとメニューが閉じ、版と差分の頁（/tickets/:id/versions）へ移る（小窓は開かない）。頁の見出しは「版と差分」・版の一覧の口に 1 回（頁が読む）・項目の変更の口は 0 回。戻す口は 0 回・書く口 0", async ({
  page,
}) => {
  const { v } = await setupMore(page);
  await openDetail(page);
  const writes = countWrites(page);
  await openMenu(page);
  await item(page, "版と差分を見る").click();
  await expect(page).toHaveURL(new RegExp(`${versionsUrl()}$`));
  await expect(versionsHeading(page)).toBeVisible();
  await expect(menu(page)).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(verItems(page)).toHaveCount(3);
  expect(v.lists).toHaveLength(1);
  expect(v.itemLists).toHaveLength(0);
  expect(v.restores).toHaveLength(0);
  expect(writes.n).toBe(0);
});

test("K458-UI-008 操作の揺れ：複製の小窓は、詳細の「複製」ボタンと「…」の「複製する」のどちらから開いても常に 1 つ。「…」から版と差分の頁へ移って、ブラウザの「戻る」で詳細へ戻ると、「…」はまた開け、小窓は開いていない", async ({
  page,
}) => {
  await setupMore(page);
  await openDetail(page);
  const dialogs = page.getByRole("dialog");
  await dupBtn(page).click();
  await expect(dlg(page)).toBeVisible();
  await expect(dialogs).toHaveCount(1);
  await cancel(page).click();
  await expect(dialogs).toHaveCount(0);
  await openMenu(page);
  await item(page, "複製する").click();
  await expect(dlg(page)).toBeVisible();
  await expect(dialogs).toHaveCount(1);
  await cancel(page).click();
  await expect(dialogs).toHaveCount(0);

  await openMenu(page);
  await item(page, "版と差分を見る").click();
  await expect(versionsHeading(page)).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/tickets/${TICKET}$`));
  await expect(more(page)).toBeVisible();
  await expect(dialogs).toHaveCount(0);
  await openMenu(page);
  await expect(menu(page).getByRole("menuitem")).toHaveCount(8);
});

test("K458-UI-009 失敗：S2 失敗：「…」から移った版と差分の頁で、版の一覧を読む口が失敗（503・E-PAGE-003）しても、頁へは移り、見出し「版と差分」と正本の文の赤い箱・「もう一度読む」が出る（空のまま固まらない）。「もう一度読む」で版の一覧が出る。口は 2 回", async ({
  page,
}) => {
  const { v } = await setupMore(page);
  v.nextList = [failed()];
  await openDetail(page);
  await openMenu(page);
  await item(page, "版と差分を見る").click();
  await expect(versionsHeading(page)).toBeVisible();
  await expect(alertWith(page, msg("E-PAGE-003"))).toBeVisible();
  await page.getByRole("button", { name: "もう一度読む", exact: true }).click();
  await expect(verItems(page)).toHaveCount(3);
  expect(v.lists).toHaveLength(2);
});

// ================================================================ キー操作・焦点

test("K458-UI-010 入口：キーボードだけで複製まで行ける：「…」に焦点して Enter でメニューが開く → Home で最初の項目「複製する」に焦点 → Enter で小窓「複製する」が開き、焦点は小窓の中。Esc で小窓を閉じると焦点が「…」に戻る（ページの先頭に落ちない）。メニューは閉じたまま", async ({
  page,
}) => {
  const { post } = await setupMore(page);
  await openDetail(page);
  await more(page).focus();
  await page.keyboard.press("Enter");
  await expect(menu(page)).toBeVisible();
  await page.keyboard.press("Home");
  await expect(item(page, "複製する")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dlg(page)).toBeVisible();
  expect(await dlg(page).evaluate((e) => e.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dlg(page)).toHaveCount(0);
  await expect(menu(page)).toHaveCount(0);
  await expect(more(page)).toBeFocused();
  expect(post.posts).toEqual([]);
});

test("K458-UI-011 入口：メニューを開いて Esc を押すと、メニューだけが閉じ、焦点が「…」に戻る。何も開かず、口は 0 回", async ({
  page,
}) => {
  const { v } = await setupMore(page);
  await openDetail(page);
  const writes = countWrites(page);
  await openMenu(page);
  await page.keyboard.press("Escape");
  await expect(menu(page)).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(more(page)).toBeFocused();
  expect(writes.n).toBe(0);
  expect(v.lists).toHaveLength(0);
});

test("K458-UI-012 操作の揺れ：メニューを開いて外（題名）を押すと閉じる。何も開かず・道は変わらない。そのあと「…」でまた開ける", async ({
  page,
}) => {
  await setupMore(page);
  await openDetail(page);
  await openMenu(page);
  const url = page.url();
  const b = (await page.getByRole("heading", { level: 1, name: TITLE, exact: true }).boundingBox())!;
  await page.mouse.click(b.x + 4, b.y + b.height / 2);
  await expect(menu(page)).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(page.url()).toBe(url);
  await openMenu(page);
  await expect(menu(page).getByRole("menuitem")).toHaveCount(8);
});

test("K458-UI-013 入口：「…」から開いた複製の小窓を閉じると、焦点が「…」に戻る（「やめる」でも Esc でも頭の「閉じる」でも）。ページの先頭に落ちない", async ({
  page,
}) => {
  await setupMore(page);
  await openDetail(page);
  await openMenu(page);
  await item(page, "複製する").click();
  await expect(dlg(page)).toBeVisible();
  await cancel(page).click();
  await expect(dlg(page)).toHaveCount(0);
  await expect(more(page)).toBeFocused();

  await openMenu(page);
  await item(page, "複製する").click();
  await expect(dlg(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dlg(page)).toHaveCount(0);
  await expect(more(page)).toBeFocused();

  await openMenu(page);
  await item(page, "複製する").click();
  await expect(dlg(page)).toBeVisible();
  await dlg(page).getByRole("button", { name: "閉じる", exact: true }).click();
  await expect(dlg(page)).toHaveCount(0);
  await expect(more(page)).toBeFocused();
});

// ================================================================ 幅・見た目

test("K458-UI-014 入力：幅 375・768・1440：「…」が見え、メニューを開いても横溢れ 0。メニューは画面の中（左が 0 以上・右が幅以下・下が高さ以下）で、どの項目も右が幅以下。幅 3 つを 1 本で流すので 180 秒", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await setupMore(page);
  for (const w of WIDTHS) {
    await openDetail(page, w);
    await expect(more(page), `幅 ${w}`).toBeVisible();
    await openMenu(page);
    const r = (await menu(page).boundingBox())!;
    const h = page.viewportSize()!.height;
    expect(r.x, `幅 ${w} のメニューの左`).toBeGreaterThanOrEqual(0);
    expect(r.x + r.width, `幅 ${w} のメニューの右`).toBeLessThanOrEqual(w);
    expect(r.y + r.height, `幅 ${w} のメニューの下`).toBeLessThanOrEqual(h);
    for (const it of await menu(page).getByRole("menuitem").all()) {
      const x = (await it.boundingBox())!;
      expect(x.x + x.width, `幅 ${w} の項目の右`).toBeLessThanOrEqual(w);
    }
    expect(await overflowX(page), `幅 ${w} の横溢れ`).toBe(0);
    await page.keyboard.press("Escape");
    await expect(menu(page)).toHaveCount(0);
  }
});

// ---------------------------------------------------------------- 見た目の突き合わせの組（モック f4-more-menu と同じ部品・同じセレクタ）
const TXT = ["font-size", "font-weight", "color", "line-height", "texts"];
const mk = (rows: readonly (readonly [string, string, readonly string[]])[]): FidelityPair[] =>
  rows.map(([role, sel, props]) => ({ name: role, role, canvas: sel, app: sel, props: [...props] }));
const M_PAIRS = mk([
  [
    "trigger",
    ".k-f4-more-btn",
    ["width", "height", "x", "font-size", "color", "background-color", "border-top-color", "texts"],
  ],
  [
    "popup",
    ".k-f4-more-popup",
    ["width", "height", "x", "background-color", "border-top-color", "border-top-left-radius"],
  ],
  ["item", ".k-f4-more-item", ["width", "height", "x", "background-color", "texts"]],
  // 押せない形の組は「消す」を除いた 5 つで比べる：モック f4-more-menu（K-458 の下絵）は onDelete を渡さないので「消す」が押せない形のまま、
  // 本番は K-590 が onDelete を渡して押せる。「消す」の字と色は danger の組、箱の幅と高さは item の組で比べ続ける（K-590 が carry して替えた）
  ["inert", ".k-f4-more-item[data-disabled]:not(:has(.k-f4-more-danger))", ["opacity", "texts"]],
  ["label", ".k-f4-more-main > span", TXT],
  ["sub", ".k-f4-more-main small", TXT],
  ["danger", ".k-f4-more-danger", ["color", "texts"]],
  ["sep", ".k-f4-more-sep", ["width", "height", "border-top-color"]],
]);

async function driveMenu(page: Page, width: number): Promise<void> {
  await setupMore(page);
  await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
  expect((await page.goto(`/tickets/${TICKET}`))?.status()).toBe(200);
  await expect(page.locator(".k-detail-doc")).toBeVisible();
  await openMenu(page);
}

test("K458-UI-015 見た目：モック f4-more-menu と本番の同じ状態を幅 375・768・1440 で比べる：「…」の箱・開いた一覧の箱・項目の幅と高さ・項目の字と補足の字・押せない項目の薄さ（本番で押せる「消す」を除いた 5 つ）・「消す」の色・区切り線の値が同じ（px は ±2）", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  for (const w of MATCH_WIDTHS) {
    const { bad } = await matchMock(browser, "f4-more-menu", w, (app) => driveMenu(app, w), {
      pairs: M_PAIRS,
      base: "/dev/mock/f4",
    });
    expect(bad, bad.join("\n")).toEqual([]);
  }
});
