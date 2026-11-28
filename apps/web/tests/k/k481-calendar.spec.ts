// K-481「カレンダー：月の格子・日の小窓・期限が決まっていないもの・日を動かす（理由が必須）を口につなぐ」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f7 の f7-calendar・f7-calendar-day・f7-view-empty（本番と同じ部品 features/F7/calendar・代表 OK 待ち）。
//   口：月の範囲は listTickets（view=all・scope_id・due_from・due_to・sort=due_on・limit=100・K-473）を、答えの next_cursor が無くなるまで読む。
//   期限が決まっていないものは listTickets に due=none を付けて読む（仮の名前・K-473 に足してもらう物・K-481 の md「PM に確かめたいこと」1）。
//   期限を動かすのは updateTicket（PATCH /api/v1/tickets/:id・体は due_on・due_reason・expected_due_on・K-483。エラーは E-DUE-001・002・005〜008 と E-VAL-028・E-VAL-012〈E-DUE-003 は欠番・E-VAL-028 と E-VAL-012 は段 5 の K-437 が定義・どちらも 409・欄なし〉）。
//   外枠・一覧・口は前からの土台 list-mock.ts と K-478 の f7-list-mock.ts。固定の待ちは使わない。時計は page.clock で固定する（2026-11-02 月曜 10:00 日本時間）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Locator, type Page, type Route } from "@playwright/test";
import { countWrites, expectInert, overflowX, WIDTHS } from "./kit";
import { gate, item, ok, open } from "./list-mock";
import { SALES, mockMine, queryOf, type Reply } from "./f7-list-mock";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";

test.use({ timezoneId: "Asia/Tokyo" });

const NOW = "2026-11-02T10:00:00+09:00";
const PATH = `/tickets?view=calendar&scope=${SALES}`;
const TEXT = {
  noReason: "期限を変える理由を書いてください",
  past: "期限は今日か、それより後の日にしてください",
  overParent: "子のチケットの期限は、親のチケットの期限より後にできません",
  stale: "ほかの人が先に期限を変えました。開き直してから、もう一度変えてください",
  done: "完了したチケットの期限は変えられません",
  underChild: "この期限より後の期限を持つ子のチケットがあります。先に子の期限を変えてください",
  order: "開始日は期限より前の日にしてください",
  loadFailed: "読み込めませんでした。",
  forbidden: "この画面を見る権限がありません。",
} as const;

type Row = Omit<ReturnType<typeof item>, "due_on"> & { due_on: string | null };
const t = (i: number, due: string | null, o: Record<string, unknown> = {}): Row =>
  item(i, { number: `EG-${i}`, title: `チケット ${i}`, due_on: due, ...o });
// 月の格子に出る項目（1 日 2 件まで）は 17 個：モックの見本（f7-calendar）と同じ数にして、突き合わせの「当たった数」（項目・点）をそろえる。
//   11/1 1・11/2 2（3 件のうち 2 つ）・11/5 1・11/20 1 に、ほかの日の 10 個（3・4・6・7・8・10・12・14・15・18 日に 1 つずつ）と 11/30 の 3 件（2 つ）を足して 5＋10＋2＝17。
//   先頭の項目（11/1）はモックと同じ「期限切れ・種別 課題（橙の点）」
const MONTH_ROWS: Row[] = [
  t(100, "2026-11-01", { overdue: true, kind: { id: "k-issue", name: "課題" } }),
  t(101, "2026-11-02"),
  t(102, "2026-11-02"),
  t(103, "2026-11-02", { kind: { id: "k-qa", name: "QA" } }),
  t(105, "2026-11-05", { title: "セイコー様の締め" }),
  t(120, "2026-11-20"),
  t(106, "2026-11-03"),
  t(107, "2026-11-04"),
  t(108, "2026-11-06"),
  t(109, "2026-11-07"),
  t(110, "2026-11-08"),
  t(111, "2026-11-10"),
  t(112, "2026-11-12"),
  t(113, "2026-11-14"),
  t(114, "2026-11-15"),
  t(115, "2026-11-18"),
  t(140, "2026-11-30"),
  t(141, "2026-11-30"),
  t(142, "2026-11-30"),
];
const NO_DATE: Row[] = [
  t(131, null, { title: "セイコー様 来期の提案" }),
  t(132, null, { title: "展示会の出展を決める" }),
];

interface Cal {
  /** 月の範囲の問い合わせ・期限なしの問い合わせ・書き込み */
  month: URLSearchParams[];
  none: URLSearchParams[];
  patches: { id: string; body: Record<string, unknown> }[];
  /** 次の PATCH の答えを替える（1 回だけ） */
  next: () => Reply | undefined | Promise<Reply | undefined>;
  /** 範囲の答えの行・期限なしの行（成功した PATCH の後に動かす） */
  rows: Row[];
  none_rows: Row[];
  /** 範囲の口を失敗させる／期限なしの口を失敗させる（状態コード・null＝成功） */
  monthFail: number | null;
  noneFail: number | null;
}

async function setup(page: Page, o: { rows?: Row[]; none?: Row[] } = {}) {
  const c: Cal = {
    month: [],
    none: [],
    patches: [],
    next: () => undefined,
    rows: [...(o.rows ?? MONTH_ROWS)],
    none_rows: [...(o.none ?? NO_DATE)],
    monthFail: null,
    noneFail: null,
  };
  const m = await mockMine(page, {
    reply: (q) => {
      if (q.get("due") === "none") {
        c.none.push(q);
        if (c.noneFail !== null) return { status: c.noneFail, body: { error: "error", code: "INTERNAL" } };
        return ok(c.none_rows, { next_cursor: null });
      }
      c.month.push(q);
      if (c.monthFail !== null) return { status: c.monthFail, body: { error: "error", code: "INTERNAL" } };
      const from = q.get("due_from") ?? "0000-00-00";
      const to = q.get("due_to") ?? "9999-99-99";
      const hit = c.rows.filter((r) => r.due_on !== null && r.due_on >= from && r.due_on <= to);
      return ok(hit, { next_cursor: null });
    },
  });
  await page.route(/\/api\/v1\/tickets\/[^/]+$/, async (route: Route) => {
    const req = route.request();
    if (req.method() !== "PATCH") return route.fallback();
    const body = req.postDataJSON() as Record<string, unknown>;
    const id = new URL(req.url()).pathname.split("/").pop()!;
    c.patches.push({ id, body });
    const own = await c.next();
    c.next = () => undefined;
    if (own)
      return route.fulfill({ status: own.status, contentType: "application/json", body: JSON.stringify(own.body) });
    const due = body["due_on"] as string | null;
    c.rows = c.rows.map((r) => (r.id === id ? { ...r, due_on: due } : r));
    c.none_rows = c.none_rows.filter((r) => r.id !== id);
    if (due !== null && !c.rows.some((r) => r.id === id)) {
      const moved = NO_DATE.find((r) => r.id === id);
      if (moved) c.rows.push({ ...moved, due_on: due });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { changed: true } }),
    });
  });
  await page.clock.setFixedTime(new Date(NOW));
  return { c, m };
}
const fail = (status: number, code: string): Reply => ({ status, body: { error: "error", code } });
async function openCal(page: Page, width = 1440) {
  await open(page, PATH, width);
  await expect(page.getByRole("table", { name: "2026年 11月", exact: true })).toBeVisible();
}

const grid = (p: Page) => p.getByRole("table", { name: /^\d{4}年 \d{1,2}月$/ });
// 日の小窓は共通の Dialog（modal・後ろの格子は読み上げから隠れる）。小窓を開いたままセルを見るので隠れた物も探す
const dateBtn = (p: Page, label: string) =>
  p.getByRole("button", { name: `${label}を開く`, exact: true, includeHidden: true });
const cellOf = (p: Page, label: string): Locator => dateBtn(p, label).locator("xpath=ancestor::td");
const dlg = (p: Page, title: string) => p.getByRole("dialog", { name: title, exact: true });
const tray = (p: Page) => p.getByRole("complementary", { name: "期限が決まっていないもの", exact: true });
const moveBtn = (d: Locator, number: string) => d.getByRole("button", { name: `${number} の日を動かす`, exact: true });
const reasonBox = (d: Locator) => d.getByRole("textbox", { name: "理由", exact: true });

test("K481-UI-001 開く：/tickets?view=calendar&scope=営業 で、タブ「カレンダー」が今いる・月の見出し「2026年 11月」・曜日は 日 月 火 水 木 金 土。月の口は 1 回で view=all・scope_id・due_from＝格子の最初の日（11/01）・due_to＝最後の日（12/05）・sort=due_on・limit=100。期限なしの口は 1 回（due=none・done=false）", async ({
  page,
}) => {
  const { c } = await setup(page);
  const writes = countWrites(page);
  await openCal(page);
  await expect(page.getByRole("link", { name: "カレンダー", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(grid(page).getByRole("columnheader")).toHaveText(["日", "月", "火", "水", "木", "金", "土"]);
  await expect(tray(page)).toBeVisible();
  expect(c.month).toHaveLength(1);
  expect(queryOf(c.month[0]!)).toMatchObject({
    view: "all",
    scope_id: SALES,
    due_from: "2026-11-01",
    due_to: "2026-12-05",
    sort: "due_on",
    limit: "100",
  });
  expect(c.none).toHaveLength(1);
  expect(queryOf(c.none[0]!)).toMatchObject({ view: "all", scope_id: SALES, due: "none", done: "false" });
  expect(writes.n).toBe(0);
});

test("K481-UI-002 日のセル：1 日に 2 件まで「番号 題名」を出し、3 件目からは「ほか N 件」（11/02 は 3 件で「ほか 1 件」）。今日（11/02）は data-today・期限切れ（11/01）は淡い赤・題名は /tickets/<id> へのリンク。この月でない日は淡く、チケットを出さない", async ({
  page,
}) => {
  await setup(page);
  await openCal(page);
  const today = cellOf(page, "11月2日（月）");
  await expect(today).toHaveAttribute("data-today", "true");
  await expect(today.getByRole("link")).toHaveCount(2);
  await expect(today.getByRole("button", { name: /ほか 1 件/ })).toBeVisible();
  const late = cellOf(page, "11月1日（日）").getByRole("link", { name: /EG-100/ });
  await expect(late).toHaveAttribute("data-late", "true");
  await expect(late).toHaveAttribute("href", new RegExp(`^/tickets/`));
  await expect(cellOf(page, "11月5日（木）")).toContainText("EG-105 セイコー様の締め");
  await expect(cellOf(page, "12月1日（火）")).toHaveAttribute("data-out", "true");
});

test("K481-UI-020 今日は日付の丸だけ（セルの四角に枠・影を付けない）・選んだ日（小窓を開いている日）は日付の丸の外に細い輪（セルの四角は囲まない）", async ({
  page,
}) => {
  await setup(page);
  await openCal(page);
  const todayCell = cellOf(page, "11月2日（月）");
  const todayDate = dateBtn(page, "11月2日（月）");
  const css = (l: Locator, prop: string) => l.evaluate((e, p) => getComputedStyle(e).getPropertyValue(p), prop);
  expect(await css(todayDate, "background-color"), "今日の丸は濃い地").not.toBe("rgba(0, 0, 0, 0)");
  expect(await css(todayCell, "box-shadow"), "今日のセルを影で囲まない").toBe("none");
  expect(await css(todayCell, "outline-style"), "今日のセルを枠で囲まない").toBe("none");
  const other = cellOf(page, "11月5日（木）");
  await expect(other).not.toHaveAttribute("data-selected", /.*/);
  await dateBtn(page, "11月5日（木）").click();
  await expect(other).toHaveAttribute("data-selected", "true");
  const date = dateBtn(page, "11月5日（木）");
  expect(await css(date, "outline-style"), "選んだ日の丸の外に輪").toBe("solid");
  expect(await css(date, "outline-width")).toBe("2px");
  expect(await css(date, "outline-offset")).toBe("2px");
  expect(await css(other, "outline-style"), "選んだ日のセルを四角で囲まない").toBe("none");
  expect(await css(other, "box-shadow")).toBe("none");
});

test("K481-UI-003 前の月・次の月・今日：「次の月」で見出しが「2026年 12月」・口は due_from＝2026-11-29（12/01 を含む格子の最初の日）で読み直し、「前の月」「今日」で 11 月に戻る（口は月ごとに 1 回・戻ったときは読み直す）", async ({
  page,
}) => {
  const { c } = await setup(page);
  await openCal(page);
  await page.getByRole("button", { name: "次の月", exact: true }).click();
  await expect(page.getByRole("table", { name: "2026年 12月", exact: true })).toBeVisible();
  await expect.poll(() => queryOf(c.month[c.month.length - 1]!)["due_from"]).toBe("2026-11-29");
  await page.getByRole("button", { name: "今日", exact: true }).click();
  await expect(page.getByRole("table", { name: "2026年 11月", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "前の月", exact: true }).click();
  await expect(page.getByRole("table", { name: "2026年 10月", exact: true })).toBeVisible();
  expect(c.month.length).toBe(4);
  expect(new Set(c.month.map((q) => q.toString())).size).toBe(3);
});

test("K481-UI-004 期限が決まっていないもの（右の列）：見出し「期限が決まっていない」・「2 件」・「カレンダーに置くと期限が決まる」・番号と題名の行は つかめる（draggable）。月を替えても口は読み直さない（期限なしは月に依らない）", async ({
  page,
}) => {
  const { c } = await setup(page);
  await openCal(page);
  await expect(tray(page).getByRole("heading", { name: /^期限が決まっていない/ })).toContainText("2 件");
  await expect(tray(page)).toContainText("カレンダーに置くと期限が決まる");
  const row = tray(page).getByRole("listitem").filter({ hasText: "EG-131" });
  await expect(row).toHaveAttribute("draggable", "true");
  await expect(row).toContainText("セイコー様 来期の提案");
  await page.getByRole("button", { name: "次の月", exact: true }).click();
  await expect(page.getByRole("table", { name: "2026年 12月", exact: true })).toBeVisible();
  expect(c.none).toHaveLength(1);
});

test("K481-UI-005 日の小窓：日の数字を押すと題「11/2（月）」の小窓に その日のチケットが全部（3 件・種別の点・番号と題名のリンク・状態の札・「日を動かす」）。「ほか 1 件」を押しても同じ小窓。Esc で閉じて焦点が日の数字に戻る", async ({
  page,
}) => {
  await setup(page);
  await openCal(page);
  await dateBtn(page, "11月2日（月）").click();
  const d = dlg(page, "11/2（月）");
  await expect(d.getByRole("listitem").filter({ has: page.getByRole("link") })).toHaveCount(3);
  await expect(d.getByRole("link", { name: /EG-103/ })).toHaveAttribute("href", /^\/tickets\//);
  await expect(moveBtn(d, "EG-101")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(d).toHaveCount(0);
  await expect(dateBtn(page, "11月2日（月）")).toBeFocused();
  await cellOf(page, "11月2日（月）")
    .getByRole("button", { name: /ほか 1 件/ })
    .click();
  await expect(d).toBeVisible();
});

test("K481-UI-006 日を動かす（成功）：「日を動かす」→ 動かす先と理由の欄 → 理由を入れて「動かす」で、口に PATCH が 1 回 { due_on: 2026-11-09, due_reason: 入れた字, expected_due_on: 2026-11-02 }。editor は閉じ、「期限を 11/09 に変えました」が出て、月を読み直して 11/09 のセルに出る（11/02 は 2 件になる）", async ({
  page,
}) => {
  const { c } = await setup(page);
  await openCal(page);
  await dateBtn(page, "11月2日（月）").click();
  const d = dlg(page, "11/2（月）");
  await moveBtn(d, "EG-101").click();
  await d.getByLabel("動かす先", { exact: true }).fill("2026-11-09");
  await reasonBox(d).fill("山田様の返事待ちで 11/9 まで延びる");
  await d.getByRole("button", { name: "動かす", exact: true }).click();
  await expect(page.getByText("期限を 11/09 に変えました", { exact: true })).toBeVisible();
  expect(c.patches).toHaveLength(1);
  expect(c.patches[0]!.body).toEqual({
    due_on: "2026-11-09",
    due_reason: "山田様の返事待ちで 11/9 まで延びる",
    expected_due_on: "2026-11-02",
  });
  await expect(reasonBox(d)).toHaveCount(0);
  await expect(cellOf(page, "11月9日（月）")).toContainText("EG-101");
  expect(c.month.length).toBeGreaterThanOrEqual(2);
});

test("K481-UI-007 理由が空（全角の空白だけも）：「動かす」を押しても口に 0 回で、理由の欄の下に「期限を変える理由を書いてください」（aria-invalid）。editor は開いたまま・動かす先は残る", async ({
  page,
}) => {
  const { c } = await setup(page);
  await openCal(page);
  await dateBtn(page, "11月2日（月）").click();
  const d = dlg(page, "11/2（月）");
  await moveBtn(d, "EG-101").click();
  await d.getByLabel("動かす先", { exact: true }).fill("2026-11-09");
  await d.getByRole("button", { name: "動かす", exact: true }).click();
  await expect(d.getByText(TEXT.noReason, { exact: true })).toBeVisible();
  await expect(reasonBox(d)).toHaveAttribute("aria-invalid", "true");
  await reasonBox(d).fill("　 ");
  await d.getByRole("button", { name: "動かす", exact: true }).click();
  await expect(d.getByText(TEXT.noReason, { exact: true })).toBeVisible();
  await expect(d.getByLabel("動かす先", { exact: true })).toHaveValue("2026-11-09");
  expect(c.patches).toEqual([]);
});

test("K481-UI-008 動かす先が今日より前・今の期限と同じ：前なら「期限は今日か、それより後の日にしてください」を動かす先の下に出し口に 0 回。同じ日なら「動かす」は押せない形（aria-disabled・口に 0 回）", async ({
  page,
}) => {
  const { c } = await setup(page);
  await openCal(page);
  await dateBtn(page, "11月2日（月）").click();
  const d = dlg(page, "11/2（月）");
  await moveBtn(d, "EG-101").click();
  await reasonBox(d).fill("前倒し");
  await d.getByLabel("動かす先", { exact: true }).fill("2026-10-30");
  await d.getByRole("button", { name: "動かす", exact: true }).click();
  await expect(d.getByText(TEXT.past, { exact: true })).toBeVisible();
  await d.getByLabel("動かす先", { exact: true }).fill("2026-11-02");
  await expect(d.getByRole("button", { name: "動かす", exact: true })).toHaveAttribute("aria-disabled", "true");
  await d.getByRole("button", { name: "動かす", exact: true }).click({ force: true });
  expect(c.patches).toEqual([]);
  // 手元の確かめを抜けた日を、口が 409 E-VAL-012（今日より前）で断った：同じ文が動かす先の欄の下に出て、理由と動かす先は残る
  await d.getByLabel("動かす先", { exact: true }).fill("2026-11-09");
  c.next = () => fail(409, "E-VAL-012");
  await d.getByRole("button", { name: "動かす", exact: true }).click();
  await expect.poll(() => c.patches.length).toBe(1);
  await expect(d.getByText(TEXT.past, { exact: true })).toBeVisible();
  await expect(reasonBox(d)).toHaveValue("前倒し");
  await expect(d.getByLabel("動かす先", { exact: true })).toHaveValue("2026-11-09");
});

test("K481-UI-009 口が断った・落ちた：409 E-DUE-005（親より後）・E-DUE-006（子より前）・E-VAL-028（開始日と期限の前後）・E-DUE-008（先に変えられた）・E-DUE-007（完了）は editor の上の role=alert に正本の文、403 は E-PAGE-002 の文、500 は E-PAGE-007 の 1 文目。どれも理由と動かす先は残り、editor は開いたまま。E-DUE-008 のあとは月を読み直す", async ({
  page,
}) => {
  const { c } = await setup(page);
  await openCal(page);
  await dateBtn(page, "11月2日（月）").click();
  const d = dlg(page, "11/2（月）");
  await moveBtn(d, "EG-101").click();
  await d.getByLabel("動かす先", { exact: true }).fill("2026-11-09");
  await reasonBox(d).fill("理由");
  const cases: [Reply, string][] = [
    [fail(409, "E-DUE-005"), TEXT.overParent],
    [fail(409, "E-DUE-006"), TEXT.underChild],
    [fail(409, "E-VAL-028"), TEXT.order],
    [fail(409, "E-DUE-007"), TEXT.done],
    [fail(403, "FORBIDDEN"), TEXT.forbidden],
    [fail(500, "INTERNAL"), TEXT.loadFailed],
  ];
  for (const [r, text] of cases) {
    c.next = () => r;
    await d.getByRole("button", { name: "動かす", exact: true }).click();
    await expect(d.getByRole("alert")).toContainText(text);
    await expect(reasonBox(d)).toHaveValue("理由");
    await expect(d.getByLabel("動かす先", { exact: true })).toHaveValue("2026-11-09");
  }
  const reads = c.month.length;
  c.next = () => fail(409, "E-DUE-008");
  await d.getByRole("button", { name: "動かす", exact: true }).click();
  await expect(d.getByRole("alert")).toContainText(TEXT.stale);
  await expect.poll(() => c.month.length).toBe(reads + 1);
});

test("K481-UI-021 日を動かす で送ったら口が 404 E-PAGE-001（チケットが消された・見えなくなった）：editor が閉じ、小窓に role=alert は出ず、月の口がもう 1 回呼ばれ、読み直した月に無い EG-101 は小窓とセルから消える（EG-102 は残り小窓は開いたまま）", async ({
  page,
}) => {
  const { c } = await setup(page);
  await openCal(page);
  await dateBtn(page, "11月2日（月）").click();
  const d = dlg(page, "11/2（月）");
  await moveBtn(d, "EG-101").click();
  await d.getByLabel("動かす先", { exact: true }).fill("2026-11-09");
  await reasonBox(d).fill("理由");
  const reads = c.month.length;
  c.next = () => {
    c.rows = c.rows.filter((r) => r.number !== "EG-101");
    return fail(404, "E-PAGE-001");
  };
  await d.getByRole("button", { name: "動かす", exact: true }).click();
  await expect.poll(() => c.patches.length).toBe(1);
  await expect.poll(() => c.month.length).toBe(reads + 1);
  await expect(reasonBox(d)).toHaveCount(0);
  await expect(d.getByRole("alert")).toHaveCount(0);
  await expect(moveBtn(d, "EG-101")).toHaveCount(0);
  await expect(moveBtn(d, "EG-102")).toBeVisible();
  await expect(cellOf(page, "11月2日（月）").getByRole("link", { name: /EG-101/ })).toHaveCount(0);
  expect(c.patches).toHaveLength(1);
});

test("K481-UI-010 二度押し：答えを止めた間に「動かす」を押し、口に 1 回届いたのを待ってから、ボタンが押せない（busy）のを見てもう 1 回押す：口は 1 回だけ。答えを返すと editor が閉じる", async ({
  page,
}) => {
  const { c } = await setup(page);
  const hold = gate();
  await openCal(page);
  await dateBtn(page, "11月2日（月）").click();
  const d = dlg(page, "11/2（月）");
  await moveBtn(d, "EG-101").click();
  await d.getByLabel("動かす先", { exact: true }).fill("2026-11-09");
  await reasonBox(d).fill("二度押し");
  c.next = async () => {
    await hold.wait;
    return undefined;
  };
  const go = d.getByRole("button", { name: "動かす", exact: true });
  await go.click();
  await expect.poll(() => c.patches.length).toBe(1);
  await expect(go).toBeDisabled();
  await go.click({ force: true });
  expect(c.patches).toHaveLength(1);
  hold.open();
  await expect(reasonBox(d)).toHaveCount(0);
  expect(c.patches).toHaveLength(1);
});

test("K481-UI-011 つかんで別の日へ動かす：11/05 の「EG-105」を 11/09 のセルへ落とすと、日の小窓（11/5）が開いて EG-105 の動かす先が 2026-11-09 になった editor が開く。この時点で口は 0 回。理由を入れて「動かす」で PATCH が 1 回", async ({
  page,
}) => {
  const { c } = await setup(page);
  await openCal(page);
  await cellOf(page, "11月5日（木）")
    .getByRole("link", { name: /EG-105/ })
    .dragTo(cellOf(page, "11月9日（月）"));
  const d = dlg(page, "11/5（木）");
  await expect(d).toBeVisible();
  await expect(d.getByLabel("動かす先", { exact: true })).toHaveValue("2026-11-09");
  expect(c.patches).toEqual([]);
  await reasonBox(d).fill("先方の都合");
  await d.getByRole("button", { name: "動かす", exact: true }).click();
  await expect.poll(() => c.patches.length).toBe(1);
  expect(c.patches[0]!.body).toMatchObject({ due_on: "2026-11-09", expected_due_on: "2026-11-05" });
});

test("K481-UI-012 期限が決まっていないものを日へ落とす：「EG-131」を 11/20 のセルへ落とすと、日の小窓（11/20）に EG-131 の editor（動かす先 2026-11-20）が開く。理由を入れて動かすと PATCH は { due_on: 2026-11-20, due_reason, expected_due_on: null }、右の列から消えて 11/20 のセルに出る", async ({
  page,
}) => {
  const { c } = await setup(page);
  await openCal(page);
  await tray(page).getByRole("listitem").filter({ hasText: "EG-131" }).dragTo(cellOf(page, "11月20日（金）"));
  const d = dlg(page, "11/20（金）");
  await expect(d.getByLabel("動かす先", { exact: true })).toHaveValue("2026-11-20");
  await reasonBox(d).fill("来期の提案日を決めた");
  await d.getByRole("button", { name: "動かす", exact: true }).click();
  await expect.poll(() => c.patches.length).toBe(1);
  expect(c.patches[0]!.body).toEqual({
    due_on: "2026-11-20",
    due_reason: "来期の提案日を決めた",
    expected_due_on: null,
  });
  await expect(tray(page).getByRole("listitem").filter({ hasText: "EG-131" })).toHaveCount(0);
  await expect(cellOf(page, "11月20日（金）")).toContainText("EG-131");
});

test("K481-UI-013 押せない物：日の小窓の「この日が期限のチケットを作る」（入力と「作る」）、道具の「週」と「並べる日付：開始日〜期限」は aria-disabled・押しても口を呼ばず切り替わらない。「担当者」は人を選ぶと口に assignee_id が付く", async ({
  page,
}) => {
  const { c } = await setup(page);
  const writes = countWrites(page);
  await openCal(page);
  await expectInert(
    page,
    page.getByRole("group", { name: "月か週か", exact: true }).getByRole("button", { name: "週", exact: true }),
    "週",
    writes,
  );
  await expect(
    page.getByRole("combobox", { name: "並べる日付", exact: true }).getByRole("option", { name: "開始日〜期限" }),
  ).toHaveJSProperty("disabled", true); // option の disabled は toBeDisabled が見ない（Playwright 1.63）
  await dateBtn(page, "11月2日（月）").click();
  const d = dlg(page, "11/2（月）");
  await expect(d.getByRole("textbox", { name: "この日が期限のチケットを作る", exact: true })).toBeDisabled();
  await expectInert(page, d.getByRole("button", { name: "作る", exact: true }), "作る", writes, 1);
  await page.keyboard.press("Escape");
  await page.getByRole("combobox", { name: "担当者", exact: true }).selectOption({ label: "鈴木" });
  await expect.poll(() => queryOf(c.month[c.month.length - 1]!)["assignee_id"]).toBeTruthy();
});

test("K481-UI-014 チケットが 1 件も無いグループ（月も期限なしも空・最初に開いたとき）：「カレンダーに出すチケットがありません」と「期限が決まったチケットが、その日に並びます」の空の画面（格子は出さない）。次の月へ移った先で空のときは、格子を出したまま", async ({
  page,
}) => {
  await setup(page, { rows: [], none: [] });
  await open(page, PATH);
  await expect(page.getByText("カレンダーに出すチケットがありません", { exact: true })).toBeVisible();
  await expect(page.getByText("期限が決まったチケットが、その日に並びます", { exact: true })).toBeVisible();
  await expect(grid(page)).toHaveCount(0);
});

test("K481-UI-015 読めない：月の口が 500 なら正本 E-PAGE-007 の文と「もう一度」（押すと読み直して格子が出る）。期限なしの口だけ 500 なら格子は出て、右の列だけ「読み込めませんでした」と「もう一度」（月の口は呼び直さない）", async ({
  page,
}) => {
  const { c } = await setup(page);
  c.monthFail = 500;
  await open(page, PATH);
  await expect(page.getByText(TEXT.loadFailed)).toBeVisible();
  c.monthFail = null;
  await page.getByRole("button", { name: "もう一度", exact: true }).click();
  await expect(grid(page)).toBeVisible();
  const months = c.month.length;
  c.noneFail = 500;
  await page.reload();
  await expect(grid(page)).toBeVisible();
  await expect(tray(page)).toContainText("読み込めませんでした");
  c.noneFail = null;
  await tray(page).getByRole("button", { name: "もう一度", exact: true }).click();
  await expect(tray(page).getByRole("listitem")).toHaveCount(2);
  expect(c.month.length).toBe(months + 1);
});

test("K481-UI-016 答えが 100 件を超える月：next_cursor が付いている間は読み続け、全部のチケットを格子に出す（口は cursor を付けて 2 回）", async ({
  page,
}) => {
  const many = Array.from({ length: 130 }, (_, i) => t(300 + i, "2026-11-12"));
  const { c } = await setup(page, { rows: [] });
  await page.route(/\/api\/v1\/tickets(\?|$)/, async (route: Route) => {
    const q = new URL(route.request().url()).searchParams;
    if (q.get("due") === "none")
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [], meta: { next_cursor: null } }),
      });
    c.month.push(q);
    const first = !q.get("cursor");
    const data = first ? many.slice(0, 100) : many.slice(100);
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data, meta: { next_cursor: first ? "c2" : null } }),
    });
  });
  await open(page, PATH);
  await expect(grid(page)).toBeVisible();
  await expect(cellOf(page, "11月12日（木）").getByRole("button", { name: /ほか 128 件/ })).toBeVisible();
  expect(c.month).toHaveLength(2);
  expect(c.month[1]!.get("cursor")).toBe("c2");
});

test("K481-UI-017 幅 320・375・768・1024・1440：横溢れ 0。767 以下は件名を出さず種別の色の点だけ並べ、「ほか N 件」は「+N」で、日の数字を押すと日の小窓で見られる。右の列は格子の下", async ({
  page,
}) => {
  await setup(page);
  for (const w of WIDTHS) {
    await openCal(page, w);
    expect(await overflowX(page), `幅 ${w}`).toBe(0);
    if (w <= 767) {
      await expect(cellOf(page, "11月5日（木）").locator(".k-f7-calendar-item-text")).toBeHidden();
      await expect(cellOf(page, "11月2日（月）").getByText("+1", { exact: true })).toBeVisible();
      const g = (await grid(page).boundingBox())!;
      const s = (await tray(page).boundingBox())!;
      expect(s.y, `幅 ${w} 右の列は下`).toBeGreaterThanOrEqual(g.y + g.height - 1);
    }
  }
  await openCal(page, 375);
  await dateBtn(page, "11月5日（木）").click();
  await expect(dlg(page, "11/5（木）")).toBeVisible();
  expect(await overflowX(page)).toBe(0);
});

test("K481-UI-018 キーボード：日の数字に Tab で届き Enter で小窓が開く。小窓の中は Tab で「日を動かす」→ 動かす先 → 理由 → 動かす の順に届き、Esc で閉じて焦点が日の数字に戻る", async ({
  page,
}) => {
  await setup(page);
  await openCal(page);
  await dateBtn(page, "11月5日（木）").focus();
  await page.keyboard.press("Enter");
  const d = dlg(page, "11/5（木）");
  await expect(d).toBeVisible();
  await moveBtn(d, "EG-105").focus();
  await page.keyboard.press("Enter");
  // 動かす先は日付の欄（年・月・日の区切りの中を Tab で進む）。順は理由から Shift+Tab で戻って見る
  await reasonBox(d).focus();
  await page.keyboard.press("Shift+Tab");
  await expect(d.getByLabel("動かす先", { exact: true })).toBeFocused();
  await reasonBox(d).focus();
  await expect(reasonBox(d)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(d).toHaveCount(0);
  await expect(dateBtn(page, "11月5日（木）")).toBeFocused();
});

// ---------------------------------------------------------------- モックとの突き合わせ（共通の道具 matchMock・base は /dev/mock/f7）
const BOXP = ["width", "x", "background-color", "border-top-color", "border-top-left-radius"];
const pair = (role: string, sel: string, props: string[]) => ({ name: role, role, canvas: sel, app: sel, props });
const CAL_PAIRS = [
  pair("card", ".k-f7-calendar-card", BOXP),
  pair("tools", ".k-f7-calendar-tools", ["height", "x"]),
  pair("th", ".k-f7-calendar-table th", ["height", "font-size", "color", "background-color"]),
  pair("cell", ".k-f7-calendar-cell", ["height", "background-color", "border-top-color"]),
  pair("date", ".k-f7-calendar-date", ["width", "height", "font-size", "color"]),
  pair("item", ".k-f7-calendar-item", ["height", "font-size", "color"]),
  pair("dot", ".k-f7-calendar-dot", ["width", "height", "background-color"]),
  pair("tray", ".k-f7-calendar-tray", ["width"]),
];
const DAY_PAIRS = [
  pair("dialog", '[role="dialog"]', ["width", "background-color", "border-top-left-radius"]),
  pair("day-row", ".k-f7-calendar-day-row", ["height", "x"]),
  pair("stage", ".k-f7-calendar-stage", ["height", "font-size", "color", "background-color"]),
  pair("move", ".k-f7-calendar-move", ["x", "width"]),
];
const EMPTY_PAIRS = [pair("empty", ".k-f7-overview-empty", ["width", "x"])];

for (const w of MATCH_WIDTHS.filter((x) => x !== 768)) {
  test(`K481-UI-019 モック f7-calendar・f7-calendar-day・f7-view-empty 幅 ${w}：月の格子（箱・曜日・セル・日の数字・項目・点・右の列）・日の小窓（箱・行・状態の札・日を動かす）・空の画面の値（位置・大きさ・色。字と見本の中身は比べない）が本番と同じ`, async ({
    browser,
  }) => {
    const bad: string[] = [];
    const run = async (id: string, pairs: ReturnType<typeof pair>[], drive: (p: Page) => Promise<void>) => {
      const r = await matchMock(browser, id, w, drive, { pairs, base: "/dev/mock/f7" });
      bad.push(...r.bad);
    };
    await run("f7-calendar", CAL_PAIRS, async (p) => {
      // 見本と同じく、最初の週の日は 2 件まで（3 件目の「ほか N 件」で行の高さが変わる。中身は比べない）
      await setup(p, { rows: MONTH_ROWS.filter((r) => r.number !== "EG-103") });
      await openCal(p, w);
    });
    await run("f7-calendar-day", DAY_PAIRS, async (p) => {
      // 見本の最初の行（EG-126 更新の見積を作る・確認中）と同じ状態・題名の長さにする（状態の札の色と行の高さは中身で決まる）
      const first = { title: "更新の見積を作る", stage: { id: "st-review", name: "確認中", key: "review" } };
      await setup(p, { rows: MONTH_ROWS.map((r) => (r.number === "EG-101" ? { ...r, ...first } : r)) });
      await openCal(p, w);
      await dateBtn(p, "11月2日（月）").click();
      await moveBtn(dlg(p, "11/2（月）"), "EG-101").click();
    });
    await run("f7-view-empty", EMPTY_PAIRS, async (p) => {
      await setup(p, { rows: [], none: [] });
      await open(p, PATH, w);
      await expect(p.getByText("カレンダーに出すチケットがありません", { exact: true })).toBeVisible();
    });
    expect(bad, bad.join("\n")).toEqual([]);
  });
}
