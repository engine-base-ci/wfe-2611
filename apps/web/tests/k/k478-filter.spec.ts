// K-478「絞る：自分に関わるものの数の札・絞りの札・並び・見え方の設定／一覧のかんたん・条件を組む・表示設定」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f7 の f7-mine・f7-mine-mobile・f7-filter-advanced・f7-view-settings・f7-mine-settings・f7-tidy-numbers（本番と同じ部品・代表 OK 待ち）。
//   絞りは全部、一覧の口（listTickets）の問い合わせの欄で行う（K-472・K-473・K-474）。状態は URL の問い合わせ（?overdue=true など）が正。
//   札の数は答えの meta.counts（K-474）。「AI に任せている」「自分が承認」の欄の名前 delegated・approving は K-473 が足す欄（札は完了を数えないので done=false も付ける）。
//   口は網の手前で差し替える（tests/k/f7-list-mock.ts）。固定の待ちは使わない（答えと移り終わりを待つ）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { groupAt } from "../../../../scripts/ci/fidelity_compare.mjs";
import { routeCanvasFonts } from "../_lib/fidelity-states";
import { countWrites, expectInert, overflowX, WIDTHS } from "./kit";
import { CFG, ROOT, gate, item, ok, open, rowsOf, table } from "./list-mock";
import { COUNTS, KIND_QA, ME, STAGE_DOING, SUZUKI, mockMine, queryOf, todayJst } from "./f7-list-mock";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";

test.use({ timezoneId: "Asia/Tokyo" });

const cards = (p: Page) => p.getByRole("group", { name: "数の札", exact: true });
const card = (p: Page, label: string) => cards(p).getByRole("button", { name: new RegExp(`^${label}\\s*\\d*$`) });
const chips = (p: Page) => p.getByRole("group", { name: "絞りの札", exact: true });
const chip = (p: Page, label: string) => chips(p).getByRole("button", { name: new RegExp(`^${label}\\s*\\d*$`) });
const bar = (p: Page) => p.getByRole("group", { name: "自分に関わるものの絞り込み", exact: true });
const sortBtn = (p: Page) => bar(p).getByRole("button", { name: /^並び：/ });
const settingsBtn = (p: Page) => p.getByRole("button", { name: "表示設定", exact: true });
const side = (p: Page) => p.locator("aside.k-list-side");
const box = (p: Page) => p.getByRole("region", { name: "検索条件", exact: true });
const builder = (p: Page) => p.getByRole("region", { name: "条件を組む", exact: true });
const lastQuery = (m: { listCalls: URLSearchParams[] }) => queryOf(m.listCalls[m.listCalls.length - 1]!);
const NONE_FOUND = "条件に合うチケットはありません";
const MINE_KEY = "kaname.f7.mine-view";

/** 今週（月曜〜日曜）の最初と最後の日（日本時間の今日から） */
function weekOf(today: string): { from: string; to: string } {
  const d = new Date(`${today}T00:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7;
  const mon = new Date(d.getTime() - back * 86_400_000);
  const sun = new Date(mon.getTime() + 6 * 86_400_000);
  return { from: mon.toISOString().slice(0, 10), to: sun.toISOString().slice(0, 10) };
}

// ---------------------------------------------------------------- 自分に関わるもの：札・チップ・並び
test("K478-UI-001 数の札：期限切れ・今日まで・自分が承認・AI が動いている の 4 つが押せるボタンで、数は答えの meta.counts（2・3・2・5）。「渡されたもの」の札は無い。開いたときの口は 1 回", async ({
  page,
}) => {
  const m = await mockMine(page);
  await open(page, "/tickets");
  await expect(rowsOf(page)).toHaveCount(3);
  await expect(cards(page).getByRole("button")).toHaveCount(4);
  const want: [string, number][] = [
    ["期限切れ", COUNTS.overdue],
    ["今日まで", COUNTS.today],
    ["自分が承認", COUNTS.approve],
    ["AI が動いている", COUNTS.ai],
  ];
  for (const [label, n] of want) {
    const c = card(page, label);
    await expect(c, label).toHaveText(new RegExp(`^${label}\\s*${n}$`));
    await expect(c, label).not.toHaveAttribute("aria-disabled", "true");
    await expect(c, label).toHaveAttribute("aria-pressed", "false");
  }
  await expect(cards(page).getByText("渡されたもの")).toHaveCount(0);
  expect(m.listCalls).toHaveLength(1);
  expect(queryOf(m.listCalls[0]!)["view"] ?? "mine").toBe("mine");
});

test("K478-UI-002 期限切れの札を押す：口に overdue=true（view は mine のまま）が 1 回飛び、表は答えの行に替わり、札は押した形（aria-pressed）、札の下に「期限切れで絞っています。もう一度押すと戻ります」、URL に overdue=true", async ({
  page,
}) => {
  const m = await mockMine(page, {
    rows: (q) =>
      q.get("overdue") === "true" ? [item(1, { due_on: "2026-01-05", overdue: true })] : [item(1), item(2), item(3)],
  });
  await open(page, "/tickets");
  await expect(rowsOf(page)).toHaveCount(3);
  await card(page, "期限切れ").click();
  await expect(rowsOf(page)).toHaveCount(1);
  await expect(card(page, "期限切れ")).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("status").filter({ hasText: "期限切れで絞っています。もう一度押すと戻ります" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/[?&]overdue=true(&|$)/);
  expect(m.listCalls).toHaveLength(2);
  await expect.poll(() => lastQuery(m)).toMatchObject({ overdue: "true" });
  await expect.poll(() => lastQuery(m)["cursor"]).toBeUndefined();
});

test("K478-UI-003 今日まで・自分が承認・AI が動いている の札：口の問い合わせは 今日まで＝due_from と due_to が日本時間の今日・done=false／自分が承認＝approving=true・done=false／AI が動いている＝delegated=true・done=false（欄の名前は K-473 のとおり）。押した札だけが押した形", async ({
  page,
}) => {
  const m = await mockMine(page);
  await open(page, "/tickets");
  await expect(rowsOf(page)).toHaveCount(3);
  const today = todayJst();
  await card(page, "今日まで").click();
  await expect(card(page, "今日まで")).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => lastQuery(m)).toMatchObject({ due_from: today, due_to: today, done: "false" });
  await card(page, "自分が承認").click();
  await expect(card(page, "自分が承認")).toHaveAttribute("aria-pressed", "true");
  await expect(card(page, "今日まで")).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => lastQuery(m)).toMatchObject({ approving: "true", done: "false" });
  await expect.poll(() => lastQuery(m)["due_from"]).toBeUndefined();
  await card(page, "AI が動いている").click();
  await expect(card(page, "AI が動いている")).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => lastQuery(m)).toMatchObject({ delegated: "true", done: "false" });
  await expect.poll(() => lastQuery(m)["approving"]).toBeUndefined();
});

test("K478-UI-004 押している札をもう一度押す：絞りが外れ、口は元の問い合わせ（絞りの欄なし）で読み直し、行は元に戻り、札の数は押す前と同じ（数は絞りで変わらない）・「絞っています」の一言は消え、URL から欄が消える", async ({
  page,
}) => {
  const m = await mockMine(page, {
    rows: (q) => (q.get("overdue") === "true" ? [item(9)] : [item(1), item(2), item(3)]),
  });
  await open(page, "/tickets");
  await expect(rowsOf(page)).toHaveCount(3);
  const before = await cards(page).innerText();
  await card(page, "期限切れ").click();
  await expect(rowsOf(page)).toHaveCount(1);
  expect(await cards(page).innerText()).toBe(before);
  await card(page, "期限切れ").click();
  await expect(rowsOf(page)).toHaveCount(3);
  await expect(card(page, "期限切れ")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("status").filter({ hasText: "絞っています" })).toHaveCount(0);
  await expect.poll(() => lastQuery(m)["overdue"]).toBeUndefined();
  await expect(page).not.toHaveURL(/overdue=/);
  expect(await cards(page).innerText()).toBe(before);
});

test("K478-UI-005 絞りの札：すべて・自分が担当 11・AI に任せている 5・自分が承認 2 の 4 つが押せ、「渡されたもの」は押せない形（aria-disabled・薄さ 0.55・押しても口を呼ばない）。「自分が担当」は assignee_id=自分・done=false", async ({
  page,
}) => {
  const m = await mockMine(page);
  const writes = countWrites(page);
  await open(page, "/tickets");
  await expect(rowsOf(page)).toHaveCount(3);
  await expect(chip(page, "すべて")).toHaveAttribute("aria-pressed", "true");
  for (const [label, n] of [
    ["自分が担当", COUNTS.assigned],
    ["AI に任せている", COUNTS.ai],
    ["自分が承認", COUNTS.approve],
  ] as const)
    await expect(chip(page, label), label).toHaveText(new RegExp(`^${label}\\s*${n}$`));
  const calls = m.listCalls.length;
  await expectInert(
    page,
    chips(page).getByRole("button", { name: "渡されたもの", exact: true }),
    "渡されたもの",
    writes,
  );
  expect(m.listCalls.length).toBe(calls);
  // 「条件を保存」は K-479 が動かすまで押せない形のボタン（button の役・aria-disabled・Tab で止まらない・title に準備中）
  const save = bar(page).getByRole("button", { name: "条件を保存", exact: true });
  await expectInert(page, save, "条件を保存", writes);
  await expect(save).toHaveAttribute("tabindex", "-1");
  expect(await save.getAttribute("title")).toContain("準備中");
  await chip(page, "自分が担当").click();
  await expect(chip(page, "自分が担当")).toHaveAttribute("aria-pressed", "true");
  await expect(chip(page, "すべて")).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => lastQuery(m)).toMatchObject({ assignee_id: ME, done: "false" });
  await chip(page, "すべて").click();
  await expect(chip(page, "すべて")).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => lastQuery(m)["assignee_id"]).toBeUndefined();
});

test("K478-UI-006 札と絞りの札は同じ絞り：期限切れの札を押すと絞りの札は「すべて」から外れ、絞りの札「自分が担当」を押すと期限切れの札が押した形でなくなる（絞りは同時に 1 つ）", async ({
  page,
}) => {
  const m = await mockMine(page);
  await open(page, "/tickets");
  await expect(rowsOf(page)).toHaveCount(3);
  await card(page, "期限切れ").click();
  await expect(chip(page, "すべて")).toHaveAttribute("aria-pressed", "false");
  await chip(page, "自分が担当").click();
  await expect(card(page, "期限切れ")).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => lastQuery(m)["overdue"]).toBeUndefined();
  await expect.poll(() => lastQuery(m)).toMatchObject({ assignee_id: ME });
});

test("K478-UI-007 数を返さない口（meta.counts が無い）：札と絞りの札の数は空（0 と書かない・D-144.3）で、札は押せて絞れる。数が無いのに「0」「NaN」は出ない", async ({
  page,
}) => {
  const m = await mockMine(page, { counts: null });
  await open(page, "/tickets");
  await expect(rowsOf(page)).toHaveCount(3);
  const text = await cards(page).innerText();
  expect(text).not.toMatch(/\d/);
  expect(await chips(page).innerText()).not.toMatch(/\d/);
  await card(page, "期限切れ").click();
  await expect(card(page, "期限切れ")).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => lastQuery(m)).toMatchObject({ overdue: "true" });
});

test("K478-UI-008 絞って 0 件：表は空になり「条件に合うチケットはありません」が出る。札をもう一度押すと戻る。空の答えのときも札の数は変わらない", async ({
  page,
}) => {
  await mockMine(page, { rows: (q) => (q.get("overdue") === "true" ? [] : [item(1), item(2), item(3)]) });
  await open(page, "/tickets");
  await expect(rowsOf(page)).toHaveCount(3);
  await card(page, "期限切れ").click();
  await expect(rowsOf(page)).toHaveCount(0);
  await expect(page.getByText(NONE_FOUND, { exact: true })).toBeVisible();
  await expect(card(page, "期限切れ")).toHaveText(/^期限切れ\s*2$/);
  await card(page, "期限切れ").click();
  await expect(rowsOf(page)).toHaveCount(3);
  await expect(page.getByText(NONE_FOUND, { exact: true })).toHaveCount(0);
});

test("K478-UI-009 絞った読み直しが失敗（500）：正本のエラー（E-PAGE-007）と「もう一度」が出て、押すと同じ絞りで読み直して表が戻る。札は押した形のまま", async ({
  page,
}) => {
  let fail = true;
  const m = await mockMine(page, {
    reply: (q) =>
      q.get("overdue") === "true" && fail
        ? { status: 500, body: { error: "server_error", code: "INTERNAL" } }
        : undefined,
  });
  await open(page, "/tickets");
  await expect(rowsOf(page)).toHaveCount(3);
  await card(page, "期限切れ").click();
  await expect(page.getByText("読み込めませんでした。")).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "もう一度", exact: true }).click();
  await expect(rowsOf(page)).toHaveCount(3);
  await expect.poll(() => lastQuery(m)).toMatchObject({ overdue: "true" });
});

test("K478-UI-010 並び：「並び：期限の近い順」を押すとメニューに 4 つ（期限の近い順・更新が新しい順・作った順・開始日の近い順）。「更新が新しい順」を選ぶと口に sort=updated_at・ボタンの字が替わる・URL に sort=updated_at。Esc で閉じて焦点がボタンに戻る", async ({
  page,
}) => {
  const m = await mockMine(page);
  await open(page, "/tickets");
  await expect(rowsOf(page)).toHaveCount(3);
  await expect(sortBtn(page)).toHaveText(/^並び：期限の近い順/);
  await sortBtn(page).click();
  await expect(page.getByRole("menuitem")).toHaveText(["期限の近い順", "更新が新しい順", "作った順", "開始日の近い順"]);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(sortBtn(page)).toBeFocused();
  await sortBtn(page).click();
  await page.getByRole("menuitem", { name: "更新が新しい順", exact: true }).click();
  await expect(sortBtn(page)).toHaveText(/^並び：更新が新しい順/);
  await expect.poll(() => lastQuery(m)).toMatchObject({ sort: "updated_at" });
  await expect(page).toHaveURL(/[?&]sort=updated_at(&|$)/);
});

test("K478-UI-011 URL が正：?overdue=true を直に開くと、最初の口の問い合わせから overdue=true で（絞りなしを先に読まない）札が押した形。再読み込みしても同じ。?sort=updated_at も同じ", async ({
  page,
}) => {
  const m = await mockMine(page);
  await open(page, "/tickets?overdue=true&sort=updated_at");
  await expect(rowsOf(page)).toHaveCount(3);
  expect(queryOf(m.listCalls[0]!)).toMatchObject({ overdue: "true", sort: "updated_at" });
  await expect(card(page, "期限切れ")).toHaveAttribute("aria-pressed", "true");
  await expect(sortBtn(page)).toHaveText(/^並び：更新が新しい順/);
  await page.reload();
  await expect(rowsOf(page)).toHaveCount(3);
  await expect(card(page, "期限切れ")).toHaveAttribute("aria-pressed", "true");
  const first = m.listCalls[m.listCalls.length - 1]!;
  expect(queryOf(first)).toMatchObject({ overdue: "true", sort: "updated_at" });
});

test("K478-UI-012 速く 2 つ押す：先に押した札（期限切れ）の答えが後から届いても描かない。後に押した札（今日まで）の答えの行だけが残る", async ({
  page,
}) => {
  const hold = gate();
  await mockMine(page, {
    reply: async (q) => {
      if (q.get("overdue") === "true") {
        await hold.wait;
        return ok([item(7, { title: "古い答え" })], { next_cursor: null });
      }
      if (q.get("due_from")) return ok([item(8, { title: "新しい答え" })], { next_cursor: null });
      return undefined;
    },
  });
  await open(page, "/tickets");
  await expect(rowsOf(page)).toHaveCount(3);
  await card(page, "期限切れ").click();
  await card(page, "今日まで").click();
  await expect(table(page)).toContainText("新しい答え");
  hold.open();
  await expect(card(page, "今日まで")).toHaveAttribute("aria-pressed", "true");
  await expect(table(page)).toContainText("新しい答え");
  await expect(table(page)).not.toContainText("古い答え");
});

test("K478-UI-013 キーボード：札に焦点を置いて Space で押せ、もう一度 Enter で戻る。表示設定は Enter で開き Esc で閉じて焦点がボタンに戻る", async ({
  page,
}) => {
  const m = await mockMine(page);
  await open(page, "/tickets");
  await expect(rowsOf(page)).toHaveCount(3);
  await card(page, "期限切れ").focus();
  await page.keyboard.press("Space");
  await expect(card(page, "期限切れ")).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Enter");
  await expect(card(page, "期限切れ")).toHaveAttribute("aria-pressed", "false");
  expect(m.listCalls).toHaveLength(3);
  await settingsBtn(page).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "自分に関わるものの見え方", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "自分に関わるものの見え方", exact: true })).toHaveCount(0);
  await expect(settingsBtn(page)).toBeFocused();
});

// ---------------------------------------------------------------- 自分に関わるもの：見え方の設定（自分だけ・端末に覚える）
test("K478-UI-014 自分に関わるものの見え方：「上の数字」の「期限切れ」を外すと札が 3 つになり、「右に出すもの」の「最近のお知らせ」を外すと右の列の見出しが消える。開き直しても残り、「はじめに戻す」で元に戻る（口は呼ばない）", async ({
  page,
}) => {
  const m = await mockMine(page);
  const writes = countWrites(page);
  await open(page, "/tickets");
  await expect(rowsOf(page)).toHaveCount(3);
  const calls = m.listCalls.length;
  await settingsBtn(page).click();
  const dlg = page.getByRole("dialog", { name: "自分に関わるものの見え方", exact: true });
  await dlg.getByRole("checkbox", { name: "期限切れ", exact: true }).uncheck();
  await dlg.getByRole("checkbox", { name: "最近のお知らせ", exact: true }).uncheck();
  await expect(cards(page).getByRole("button")).toHaveCount(3);
  await expect(card(page, "期限切れ")).toHaveCount(0);
  await expect(side(page).getByRole("heading", { name: "最近のお知らせ", exact: true })).toHaveCount(0);
  await expect(side(page).getByRole("heading", { name: "自分の承認を待っているもの", exact: true })).toBeVisible();
  await page.reload();
  await expect(rowsOf(page)).toHaveCount(3);
  await expect(cards(page).getByRole("button")).toHaveCount(3);
  await settingsBtn(page).click();
  await dlg.getByRole("button", { name: "はじめに戻す", exact: true }).click();
  await expect(cards(page).getByRole("button")).toHaveCount(4);
  await expect(side(page).getByRole("heading", { name: "最近のお知らせ", exact: true })).toBeVisible();
  expect(writes.n).toBe(0);
  expect(m.listCalls.length).toBeGreaterThanOrEqual(calls);
  expect(await page.evaluate((k) => window.localStorage.getItem(k), MINE_KEY)).not.toBeNull();
});

test("K478-UI-015 見え方の設定で、まだ使えない項目は押せない形：「今週まで」「自分が担当・承認するものの動き」「表の分け方」の グループ・状態、「入れるもの」の 3 つ。チェックも選びも付かず、口を呼ばず、押しても札と右の列は変わらない", async ({
  page,
}) => {
  await mockMine(page);
  const writes = countWrites(page);
  await open(page, "/tickets");
  await expect(rowsOf(page)).toHaveCount(3);
  await settingsBtn(page).click();
  const dlg = page.getByRole("dialog", { name: "自分に関わるものの見え方", exact: true });
  const before = await cards(page).innerText();
  const pending: [string, string][] = [
    ["上の数字（つかんで並べ替え）", "今週まで"],
    ["右に出すもの（つかんで並べ替え）", "自分が担当・承認するものの動き"],
    ["表の分け方", "グループ"],
    ["表の分け方", "状態"],
    ["入れるもの", "担当しているもの"],
    ["入れるもの", "承認するもの・渡されたもの"],
    ["入れるもの", "自分が担当・承認するもの"],
  ];
  for (const [group, name] of pending) {
    const it = dlg
      .getByRole("group", { name: group, exact: true })
      .locator('[aria-disabled="true"]', { hasText: name });
    await expectInert(page, it, name, writes, 1);
  }
  expect(await cards(page).innerText()).toBe(before);
});

// ---------------------------------------------------------------- 一覧：かんたん・条件を組む・表示設定
test("K478-UI-016 一覧のかんたん：状態の札（作業中・完了以外）・親子（親だけ・子だけ）・担当者・種別・AI に任せている を選ぶと口に stage_id・done=false・parent=none/any・assignee_id・kind_id・delegated=true。全部は同時に重なり（AND）、「すべて」で外れる", async ({
  page,
}) => {
  const m = await mockMine(page);
  await open(page, "/tickets?view=all");
  await expect(rowsOf(page)).toHaveCount(3);
  const b = box(page);
  await b
    .getByRole("group", { name: "状態", exact: true })
    .getByRole("button", { name: "作業中", exact: true })
    .click();
  await expect.poll(() => lastQuery(m)).toMatchObject({ view: "all", stage_id: STAGE_DOING });
  await b
    .getByRole("group", { name: "状態", exact: true })
    .getByRole("button", { name: "完了以外", exact: true })
    .click();
  await expect.poll(() => lastQuery(m)).toMatchObject({ done: "false" });
  await expect.poll(() => lastQuery(m)["stage_id"]).toBeUndefined();
  await b
    .getByRole("group", { name: "親子", exact: true })
    .getByRole("button", { name: "親だけ", exact: true })
    .click();
  await expect.poll(() => lastQuery(m)).toMatchObject({ done: "false", parent: "none" });
  await b
    .getByRole("group", { name: "親子", exact: true })
    .getByRole("button", { name: "子だけ", exact: true })
    .click();
  await expect.poll(() => lastQuery(m)).toMatchObject({ parent: "any" });
  await b.getByRole("combobox", { name: "担当者", exact: true }).selectOption({ label: "鈴木" });
  await b.getByRole("combobox", { name: "種別", exact: true }).selectOption({ label: "QA" });
  await b.getByRole("combobox", { name: "AI に任せている", exact: true }).selectOption({ label: "任せている" });
  await expect
    .poll(() => lastQuery(m))
    .toMatchObject({
      done: "false",
      parent: "any",
      assignee_id: SUZUKI,
      kind_id: KIND_QA,
      delegated: "true",
    });
  await b
    .getByRole("group", { name: "状態", exact: true })
    .getByRole("button", { name: "すべて", exact: true })
    .click();
  await expect.poll(() => lastQuery(m)["done"]).toBeUndefined();
  expect(m.reads.members).toBeLessThanOrEqual(1);
  expect(m.reads.stages).toBeLessThanOrEqual(1);
  expect(m.reads.kinds).toBeLessThanOrEqual(1);
});

test("K478-UI-017 一覧のかんたん：分類・節目の選びは押せない形のまま（口に絞りの欄が無い）。言葉の欄（題名か番号）は前からのとおり打ち終わってから 1 回だけ口を呼び、状態の札と重なる", async ({
  page,
}) => {
  const m = await mockMine(page);
  const writes = countWrites(page);
  await open(page, "/tickets?view=all");
  await expect(rowsOf(page)).toHaveCount(3);
  for (const t of ["分類", "節目"]) {
    const it = box(page).locator('[aria-disabled="true"]', { hasText: t }).first();
    await expectInert(page, it, t, writes);
  }
  // 「検索条件を保存」（scope の無い一覧で押せない形）は K-479 の SaveViewButton の物で、K479-UI-024 が見る（持ち主を 1 つに）
  await box(page)
    .getByRole("group", { name: "状態", exact: true })
    .getByRole("button", { name: "完了以外", exact: true })
    .click();
  const calls = m.listCalls.length;
  await box(page)
    .getByRole("textbox", { name: "題名か番号で絞る", exact: true })
    .pressSequentially("EG-102", { delay: 30 });
  await expect.poll(() => m.listCalls.length).toBe(calls + 1);
  await expect.poll(() => lastQuery(m)).toMatchObject({ q: "EG-102", done: "false" });
});

test("K478-UI-018 「詳しく」を押すと「条件を組む」が開き、「かんたんに戻す」で閉じる。条件を足して「この条件で見る」を押すと口に条件の欄が飛ぶ。「いま N 件」は出さない（口が総数を返さない）", async ({
  page,
}) => {
  const m = await mockMine(page);
  await open(page, "/tickets?view=all");
  await expect(rowsOf(page)).toHaveCount(3);
  await expect(builder(page)).toHaveCount(0);
  await box(page).getByRole("button", { name: "詳しく", exact: true }).click();
  await expect(builder(page)).toBeVisible();
  await expect(builder(page)).not.toContainText("いま");
  await builder(page).getByRole("button", { name: "＋ 条件", exact: true }).click();
  const row = builder(page).getByRole("list", { name: "条件", exact: true }).getByRole("listitem").first();
  await row.getByRole("combobox", { name: "項目", exact: true }).selectOption("担当者");
  await row.getByRole("combobox", { name: "値", exact: true }).selectOption({ label: "鈴木" });
  const calls = m.listCalls.length;
  await builder(page).getByRole("button", { name: "この条件で見る", exact: true }).click();
  await expect.poll(() => m.listCalls.length).toBe(calls + 1);
  await expect.poll(() => lastQuery(m)).toMatchObject({ view: "all", assignee_id: SUZUKI });
  await builder(page).getByRole("button", { name: "かんたんに戻す", exact: true }).click();
  await expect(builder(page)).toHaveCount(0);
});

test("K478-UI-019 条件の期限：「今週」を選ぶと due_from＝今週の月曜・due_to＝日曜、「状態 でない 完了」は done=false、「種別 が QA」は kind_id。条件の × で外すと欄が口から消える", async ({
  page,
}) => {
  const m = await mockMine(page);
  await open(page, "/tickets?view=all");
  await expect(rowsOf(page)).toHaveCount(3);
  await box(page).getByRole("button", { name: "詳しく", exact: true }).click();
  const list = () => builder(page).getByRole("list", { name: "条件", exact: true }).getByRole("listitem");
  await builder(page).getByRole("button", { name: "＋ 条件", exact: true }).click();
  await list().nth(0).getByRole("combobox", { name: "項目", exact: true }).selectOption("期限");
  await list().nth(0).getByRole("combobox", { name: "値", exact: true }).selectOption({ label: "今週" });
  await builder(page).getByRole("button", { name: "＋ 条件", exact: true }).click();
  await list().nth(1).getByRole("combobox", { name: "項目", exact: true }).selectOption("状態");
  await list().nth(1).getByRole("combobox", { name: "言い方", exact: true }).selectOption("でない");
  await list().nth(1).getByRole("combobox", { name: "値", exact: true }).selectOption({ label: "完了" });
  await builder(page).getByRole("button", { name: "＋ 条件", exact: true }).click();
  await list().nth(2).getByRole("combobox", { name: "項目", exact: true }).selectOption("種別");
  await list().nth(2).getByRole("combobox", { name: "値", exact: true }).selectOption({ label: "QA" });
  await builder(page).getByRole("button", { name: "この条件で見る", exact: true }).click();
  const week = weekOf(todayJst());
  await expect.poll(() => lastQuery(m)["kind_id"]).toBe(KIND_QA);
  await expect.poll(() => lastQuery(m)).toMatchObject({ due_from: week.from, due_to: week.to, done: "false" });
  await list().nth(2).getByRole("button", { name: "外す：種別", exact: true }).click();
  await builder(page).getByRole("button", { name: "この条件で見る", exact: true }).click();
  await expect.poll(() => lastQuery(m)["kind_id"]).toBeUndefined();
  await expect.poll(() => lastQuery(m)).toMatchObject({ due_from: week.from, done: "false" });
});

test("K478-UI-020 条件の誤り：期限を「範囲」にして始めが終わりより後なら、欄の下に「期限の始めは終わりより前にしてください」・口は呼ばない。値を選んでいない条件は「値を選んでください」で、押しても口は呼ばない", async ({
  page,
}) => {
  const m = await mockMine(page);
  await open(page, "/tickets?view=all");
  await expect(rowsOf(page)).toHaveCount(3);
  await box(page).getByRole("button", { name: "詳しく", exact: true }).click();
  const calls = m.listCalls.length;
  await builder(page).getByRole("button", { name: "＋ 条件", exact: true }).click();
  const row = builder(page).getByRole("list", { name: "条件", exact: true }).getByRole("listitem").first();
  await row.getByRole("combobox", { name: "項目", exact: true }).selectOption("担当者");
  await builder(page).getByRole("button", { name: "この条件で見る", exact: true }).click();
  await expect(row.getByText("値を選んでください", { exact: true })).toBeVisible();
  await row.getByRole("combobox", { name: "項目", exact: true }).selectOption("期限");
  await row.getByRole("combobox", { name: "値", exact: true }).selectOption({ label: "範囲を決める" });
  await row.getByLabel("から", { exact: true }).fill("2026-12-05");
  await row.getByLabel("まで", { exact: true }).fill("2026-12-01");
  await builder(page).getByRole("button", { name: "この条件で見る", exact: true }).click();
  await expect(row.getByText("期限の始めは終わりより前にしてください", { exact: true })).toBeVisible();
  expect(m.listCalls.length).toBe(calls);
});

test("K478-UI-021 条件を組むの押せない物：「まとまり」を足す・「ことばで探す」の「条件にする」・項目の「分類」は押せない形（口が AND だけ・分類の欄が無い）。押しても口を呼ばず、条件の行は増えない", async ({
  page,
}) => {
  await mockMine(page);
  const writes = countWrites(page);
  await open(page, "/tickets?view=all");
  await expect(rowsOf(page)).toHaveCount(3);
  await box(page).getByRole("button", { name: "詳しく", exact: true }).click();
  await expectInert(
    page,
    builder(page).getByRole("button", { name: "＋ まとまり", exact: true }),
    "＋ まとまり",
    writes,
  );
  await expectInert(page, builder(page).getByRole("button", { name: "条件にする", exact: true }), "条件にする", writes);
  await builder(page).getByRole("button", { name: "＋ 条件", exact: true }).click();
  const row = builder(page).getByRole("list", { name: "条件", exact: true }).getByRole("listitem").first();
  await expect(
    row.getByRole("combobox", { name: "項目", exact: true }).getByRole("option", { name: "分類" }),
  ).toBeDisabled();
  await expect(builder(page).getByRole("list", { name: "条件", exact: true }).getByRole("listitem")).toHaveCount(1);
});

test("K478-UI-022 一覧の表示設定（箱の名前は前からの「一覧の見え方」・列の group は「表に出す列」）：「1 行の高さ」を「詰める」にすると行が低くなり、開き直しても残る。「並べ方」は口の sort に出る。「まとめる」の 4 つと「この見え方をグループの全員の既定にする」は押せない形。箱は 1 つで「はじめに戻す」も 1 つ", async ({
  page,
}) => {
  const m = await mockMine(page);
  const writes = countWrites(page);
  await open(page, "/tickets?view=all");
  await expect(rowsOf(page)).toHaveCount(3);
  const h = () =>
    rowsOf(page)
      .first()
      .evaluate((e) => e.getBoundingClientRect().height);
  const before = await h();
  await settingsBtn(page).click();
  const dlg = page.getByRole("dialog", { name: "一覧の見え方", exact: true });
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(dlg.getByRole("button", { name: "はじめに戻す", exact: true })).toHaveCount(1);
  await expect(dlg.getByRole("group", { name: "表に出す列", exact: true }).getByRole("checkbox")).toHaveCount(9);
  await dlg.getByRole("button", { name: "詰める", exact: true }).click();
  await expect(dlg.getByRole("button", { name: "詰める", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(await h()).toBeLessThan(before);
  await page.reload();
  await expect(rowsOf(page)).toHaveCount(3);
  expect(await h()).toBeLessThan(before);
  await settingsBtn(page).click();
  const sel = dlg.getByRole("combobox", { name: "並べ方", exact: true });
  await expect(sel).toHaveValue("updated_at");
  await sel.selectOption({ label: "期限の近い順" });
  await expect.poll(() => lastQuery(m)["sort"]).toBe("due_on");
  for (const t of ["親子", "状態", "担当", "なし"]) {
    const it = dlg
      .getByRole("group", { name: "まとめる", exact: true })
      .locator('[aria-disabled="true"]', { hasText: t });
    await expectInert(page, it, `まとめる ${t}`, writes, 1);
  }
  await expectInert(
    page,
    dlg.getByRole("switch", { name: "この見え方をグループの全員の既定にする", exact: true }),
    "グループの全員の既定",
    writes,
    1,
  );
});

test("K478-UI-026 並びの既定の字：自分に関わるものは「期限の近い順」・一覧（view=all）は「更新が新しい順」で、どちらも既定のときは口に sort を付けない。既定と違う並びを選ぶと sort が付き、既定に戻すと外れる（URL も同じ）", async ({
  page,
}) => {
  const m = await mockMine(page);
  await open(page, "/tickets");
  await expect(rowsOf(page)).toHaveCount(3);
  await expect(sortBtn(page)).toHaveText(/^並び：期限の近い順/);
  expect(queryOf(m.listCalls[0]!)["sort"]).toBeUndefined();
  await sortBtn(page).click();
  await page.getByRole("menuitem", { name: "更新が新しい順", exact: true }).click();
  await expect.poll(() => lastQuery(m)["sort"]).toBe("updated_at");
  await sortBtn(page).click();
  await page.getByRole("menuitem", { name: "期限の近い順", exact: true }).click();
  await expect(sortBtn(page)).toHaveText(/^並び：期限の近い順/);
  await expect.poll(() => lastQuery(m)["sort"]).toBeUndefined();
  await expect(page).not.toHaveURL(/sort=/);
  const p2 = await page.context().newPage();
  const m2 = await mockMine(p2);
  await open(p2, "/tickets?view=all");
  await expect(rowsOf(p2)).toHaveCount(3);
  expect(queryOf(m2.listCalls[0]!)["sort"]).toBeUndefined();
  await settingsBtn(p2).click();
  const sel = p2.getByRole("dialog", { name: "一覧の見え方", exact: true }).getByRole("combobox", {
    name: "並べ方",
    exact: true,
  });
  await expect(sel).toHaveValue("updated_at");
  await sel.selectOption({ label: "期限の近い順" });
  await expect.poll(() => lastQuery(m2)["sort"]).toBe("due_on");
  await expect(p2).toHaveURL(/[?&]sort=due_on(&|$)/);
  await sel.selectOption({ label: "更新が新しい順" });
  await expect.poll(() => lastQuery(m2)["sort"]).toBeUndefined();
  await expect(p2).not.toHaveURL(/sort=/);
});

test("K478-UI-027 URL に絞りの欄が付いて直に開く：かんたんの欄（担当者・種別・状態の完了以外・親子・AI に任せている）は最初の口の問い合わせから付き、操作の部品が同じ値を指す（絞りなしを先に読まない）。stage_id が付いたときは口にそのまま送り、状態の札は押した形にせず、段の口は読まない（「すべて」を押すと外れる）", async ({
  page,
}) => {
  const m = await mockMine(page);
  await open(page, `/tickets?view=all&assignee_id=${SUZUKI}&kind_id=${KIND_QA}&done=false&parent=none&delegated=true`);
  await expect(rowsOf(page)).toHaveCount(3);
  expect(queryOf(m.listCalls[0]!)).toMatchObject({
    view: "all",
    assignee_id: SUZUKI,
    kind_id: KIND_QA,
    done: "false",
    parent: "none",
    delegated: "true",
  });
  const b = box(page);
  await expect(b.getByRole("combobox", { name: "担当者", exact: true })).toHaveValue(SUZUKI);
  await expect(b.getByRole("combobox", { name: "種別", exact: true })).toHaveValue(KIND_QA);
  await expect(b.getByRole("combobox", { name: "AI に任せている", exact: true })).toHaveValue("true");
  await expect(
    b.getByRole("group", { name: "状態", exact: true }).getByRole("button", { name: "完了以外", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    b.getByRole("group", { name: "親子", exact: true }).getByRole("button", { name: "親だけ", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const p2 = await page.context().newPage();
  const m2 = await mockMine(p2);
  await open(p2, `/tickets?view=all&stage_id=${STAGE_DOING}`);
  await expect(rowsOf(p2)).toHaveCount(3);
  expect(queryOf(m2.listCalls[0]!)).toMatchObject({ view: "all", stage_id: STAGE_DOING });
  const states = box(p2).getByRole("group", { name: "状態", exact: true });
  await expect(states.locator('[aria-pressed="true"]')).toHaveCount(0);
  expect(m2.reads.stages).toBe(0);
  await states.getByRole("button", { name: "すべて", exact: true }).click();
  await expect.poll(() => lastQuery(m2)["stage_id"]).toBeUndefined();
  expect(m2.reads.stages).toBe(0);
});

// ---------------------------------------------------------------- 幅・書く口・口の数・モック
test("K478-UI-023 幅 320・375・768・1024・1440：自分に関わるもの・一覧（条件を組む・表示設定を開いたまま）とも横溢れ 0。375 以下の自分に関わるものは 1 件 1 行で、絞りの札が押せ、ガントのタブは出ない", async ({
  page,
}) => {
  await mockMine(page);
  for (const w of WIDTHS) {
    await open(page, "/tickets", w);
    await expect(rowsOf(page).or(page.locator(".k-f7-overview-mrow")).first()).toBeVisible();
    expect(await overflowX(page), `自分に関わるもの 幅 ${w}`).toBe(0);
    await open(page, "/tickets?view=all", w);
    await expect(rowsOf(page)).toHaveCount(3);
    await box(page).getByRole("button", { name: "詳しく", exact: true }).click();
    await settingsBtn(page).click();
    expect(await overflowX(page), `一覧 幅 ${w}`).toBe(0);
  }
  await open(page, "/tickets", 375);
  await expect(page.getByRole("link", { name: "ガント", exact: true })).toBeHidden();
  await chip(page, "自分が担当").click();
  await expect(chip(page, "自分が担当")).toHaveAttribute("aria-pressed", "true");
});

test("K478-UI-029 タブと数の札の間は 16px（自分に関わるもの・幅 1440）／幅 375 は一覧の並びだけが縦に送れる（頁の全体は送れず、上の帯と絞りの札は並びを送っても動かない）", async ({
  page,
}) => {
  await mockMine(page);
  await open(page, "/tickets", 1440);
  await expect(cards(page)).toBeVisible();
  const tabs = (await page.locator(".k-list-views").boundingBox())!;
  const top = (await cards(page).boundingBox())!;
  expect(Math.round(top.y - (tabs.y + tabs.height)), "タブの下から数の札の上まで").toBe(16);
  await open(page, "/tickets", 375);
  await expect(page.locator(".k-f7-overview-mrow").first()).toBeVisible();
  const list = page.locator(".k-f7-overview-phone-list");
  expect(await list.evaluate((e) => getComputedStyle(e).overflowY), "一覧の並びが縦に送れる").toBe("auto");
  const page375 = await page.evaluate(
    () => document.documentElement.scrollHeight - document.documentElement.clientHeight,
  );
  expect(page375, "頁の全体は縦に送れない").toBeLessThanOrEqual(0);
  const chipsY = (await page.locator(".k-f7-overview-phone-chips").boundingBox())!.y;
  const barY = (await page.locator("header.k-bar").boundingBox())!.y;
  await list.evaluate((e) => e.scrollTo(0, e.scrollHeight));
  expect((await page.locator(".k-f7-overview-phone-chips").boundingBox())!.y, "絞りの札は動かない").toBe(chipsY);
  expect((await page.locator("header.k-bar").boundingBox())!.y, "上の帯は動かない").toBe(barY);
});

test("K478-UI-024 絞るのは読むだけ：札・絞りの札・並び・条件・表示設定をひととおり操作しても、書く口（POST・PATCH・DELETE）は 0 回。口の数は 開いたとき一覧 1 回・絞るたびに 1 回で、人・段・種別の口は多くて 1 回ずつ（同じ口を二重に読まない）", async ({
  page,
}) => {
  const m = await mockMine(page);
  const writes = countWrites(page);
  await open(page, "/tickets");
  await expect(rowsOf(page)).toHaveCount(3);
  expect(m.listCalls).toHaveLength(1);
  expect(m.reads.stages, "段の口は開いたときには読まない（状態の札を押したとき 1 回だけ）").toBe(0);
  await card(page, "期限切れ").click();
  await expect.poll(() => m.listCalls.length).toBe(2);
  await chip(page, "自分が担当").click();
  await expect.poll(() => m.listCalls.length).toBe(3);
  await sortBtn(page).click();
  await page.getByRole("menuitem", { name: "作った順", exact: true }).click();
  await expect.poll(() => m.listCalls.length).toBe(4);
  const keys = m.listCalls.map((q) => q.toString());
  expect(new Set(keys).size, "同じ問い合わせを二重に読んでいない").toBe(keys.length);
  expect(writes.n).toBe(0);
  expect(m.reads.members).toBeLessThanOrEqual(1);
});

// ---------------------------------------------------------------- モックとの突き合わせ（共通の道具 matchMock・base は /dev/mock/f7）
const CTRL = ["width", "height", "x", "y", "font-size", "color", "background-color", "border-top-color"];
const BOXP = ["width", "x", "y", "background-color", "border-top-color", "border-top-left-radius"];
const pair = (role: string, sel: string, props: string[]) => ({ name: role, role, canvas: sel, app: sel, props });
const MINE_PAIRS = [
  pair("tabs", ".k-list-views", ["y", "height"]),
  pair("cards", '[aria-label="数の札"]', BOXP),
  pair("card", '[aria-label="数の札"] > button', CTRL),
  pair("chips", '[aria-label="絞りの札"]', ["x", "y", "width"]),
  pair("chip", '[aria-label="絞りの札"] > button', CTRL),
  pair("filter-bar", '[aria-label="自分に関わるものの絞り込み"]', BOXP),
];
// 設定の箱は 1 つ（本番は前からの箱 `.k-list-columns` に class `k-f7-saved-pop` を足す）。本番の箱には「表に出す列」の group も入るので、
// group は class の数でなく役の名前で当てる：自分に関わるもの＝モックと同じ 3 つの group の名前／一覧＝箱の直下の role=group（モックの「出す列」・本番の「表に出す列」の 1 つ）
const MINE_SET_PAIRS = [
  pair("pop", ".k-f7-saved-pop", BOXP),
  pair("pop-cards", '[role="group"][aria-label="上の数字（つかんで並べ替え）"]', ["x", "width"]),
  pair("pop-side", '[role="group"][aria-label="右に出すもの（つかんで並べ替え）"]', ["x", "width"]),
  pair("pop-include", '[role="group"][aria-label="入れるもの"]', ["x", "width"]),
];
const VIEW_SET_PAIRS = [
  pair("pop", ".k-f7-saved-pop", BOXP),
  pair("pop-group", '.k-f7-saved-pop > [role="group"]', ["x", "width"]),
];
// モックの見本の行は 3 行（担当者が 鈴木・期限が 今週・状態でない 完了。まとまりの行は無い）。本番も同じ 3 行を組んで数をそろえる
const COND_PAIRS = [pair("cond", ".k-f7-saved-cond", BOXP), pair("cond-row", ".k-f7-saved-cond-row", ["x", "height"])];
const BASE = "/dev/mock/f7";
/** モックの見本と同じ 3 行（担当者が 鈴木・期限が 今週・状態でない 完了）を組む（口には飛ばさない） */
async function addSampleRows(p: Page): Promise<void> {
  const list = () => builder(p).getByRole("list", { name: "条件", exact: true }).getByRole("listitem");
  const add = () => builder(p).getByRole("button", { name: "＋ 条件", exact: true }).click();
  await add();
  await list().nth(0).getByRole("combobox", { name: "項目", exact: true }).selectOption("担当者");
  await list().nth(0).getByRole("combobox", { name: "値", exact: true }).selectOption({ label: "鈴木" });
  await add();
  await list().nth(1).getByRole("combobox", { name: "項目", exact: true }).selectOption("期限");
  await list().nth(1).getByRole("combobox", { name: "値", exact: true }).selectOption({ label: "今週" });
  await add();
  await list().nth(2).getByRole("combobox", { name: "項目", exact: true }).selectOption("状態");
  await list().nth(2).getByRole("combobox", { name: "言い方", exact: true }).selectOption("でない");
  await list().nth(2).getByRole("combobox", { name: "値", exact: true }).selectOption({ label: "完了" });
  await expect(list()).toHaveCount(3);
}

for (const w of MATCH_WIDTHS.filter((x) => x !== 768)) {
  test(`K478-UI-025 モックとの突き合わせ 幅 ${w}：f7-mine・f7-tidy-numbers・f7-mine-settings（1440）／f7-mine-mobile（375）／f7-view-settings・f7-filter-advanced（375・1440）の、数の札・絞りの札・絞りの行・設定の箱・条件を組むの値（位置・大きさ・色・角丸。数と字は見本の値なので比べない）が本番と同じ`, async ({
    browser,
  }) => {
    const bad: string[] = [];
    const run = async (id: string, pairs: ReturnType<typeof pair>[], drive: (p: Page) => Promise<void>) => {
      const r = await matchMock(browser, id, w, drive, { pairs, base: BASE });
      bad.push(...r.bad);
    };
    const mine = async (p: Page, then?: () => Promise<void>) => {
      await mockMine(p);
      await open(p, "/tickets", w);
      await expect(rowsOf(p).or(p.locator(".k-f7-overview-mrow")).first()).toBeVisible();
      await then?.();
    };
    const all = async (p: Page, then: () => Promise<void>) => {
      await mockMine(p);
      await open(p, "/tickets?view=all", w);
      await expect(rowsOf(p)).toHaveCount(3);
      await then();
    };
    if (w === 1440) {
      await run("f7-mine", MINE_PAIRS, (p) => mine(p));
      await run("f7-tidy-numbers", MINE_PAIRS, (p) =>
        mine(p, async () => {
          await card(p, "期限切れ").click();
          await expect(card(p, "期限切れ")).toHaveAttribute("aria-pressed", "true");
        }),
      );
      await run("f7-mine-settings", MINE_SET_PAIRS, (p) =>
        mine(p, async () => {
          await settingsBtn(p).click();
          await expect(p.getByRole("dialog", { name: "自分に関わるものの見え方", exact: true })).toBeVisible();
        }),
      );
    } else {
      await run("f7-mine-mobile", [pair("phone-chips", ".k-f7-overview-phone-chips", ["x", "width"])], (p) => mine(p));
    }
    await run("f7-view-settings", VIEW_SET_PAIRS, (p) =>
      all(p, async () => {
        await settingsBtn(p).click();
        await expect(p.getByRole("dialog", { name: "一覧の見え方", exact: true })).toBeVisible();
      }),
    );
    await run("f7-filter-advanced", COND_PAIRS, (p) =>
      all(p, async () => {
        await box(p).getByRole("button", { name: "詳しく", exact: true }).click();
        await expect(builder(p)).toBeVisible();
        await addSampleRows(p);
      }),
    );
    expect(bad, bad.join("\n")).toEqual([]);
  });
}

test("K478-UI-028 「もっと見る」の続きの鍵が読めない（口が 409・E-LST-001）：続きを足さず（行は 3 のまま）、鍵なしで最初の分を 1 回読み直し、表の下に正本の文が出る。「もっと見る」はもう一度押せて、押すと続きが足される", async ({
  page,
}) => {
  let broken = true;
  const FIRST = [item(1), item(2), item(3)];
  const m = await mockMine(page, {
    // 体は口の答えと同じ形で message を持たない（画面は code から正本の文を引く）
    reply: (q) => {
      if (!q.get("cursor")) return ok(FIRST, { next_cursor: "QUJD" });
      if (broken) {
        broken = false;
        return { status: 409, body: { error: "conflict", code: "E-LST-001" } };
      }
      return ok([item(4)], { next_cursor: null });
    },
  });
  await open(page, "/tickets");
  await expect(rowsOf(page)).toHaveCount(3);
  const more = page.getByRole("button", { name: "もっと見る", exact: true });
  await more.click();
  await expect(page.getByText("一覧の続きを読めませんでした。最初から読み直してください")).toBeVisible();
  await expect(rowsOf(page)).toHaveCount(3);
  expect(m.listCalls).toHaveLength(3);
  expect(queryOf(m.listCalls[1]!)["cursor"]).toBe("QUJD");
  expect(queryOf(m.listCalls[2]!)["cursor"]).toBeUndefined();
  await expect(more).toBeEnabled();
  await more.click();
  await expect(rowsOf(page)).toHaveCount(4);
});

// ---------------------------------------------------------------- 幅 375 の正の絵（組 tickets-main の at・K-1301）
test("K478-UI-030 幅 375 の tickets-main の正は絵 MobileList とスマホの本文（組の at の 375・ticket K-478・決定 D-143.5）：groupAt で解いた絵は MobileList、対 3 つ（見出し・見出しの帯・本文の箱）は絵の側が包み header.kn-mlist-head・div.kn-mlist-body（K-1301）で画面の側は組のまま。その絵で対の要素が 1 つずつ見える。幅 1440 は組のまま（Main）", async ({
  browser,
}) => {
  const g = CFG.groups.find((x) => x.id === "tickets-main");
  expect(g, "組 tickets-main が設定に無い").toBeTruthy();
  const rec = g!.at?.["375"];
  expect(rec, "tickets-main に幅 375 の記録（at）が無い").toBeTruthy();
  expect([rec!.canvas, rec!.ticket, rec!.decision]).toEqual(["MobileList", "K-478", "D-143.5"]);
  const m = groupAt(g!, 375);
  expect(m.canvas).toBe("MobileList");
  expect(Object.fromEntries(m.pairs.map((p) => [p.name, [p.canvas, p.app]]))).toEqual({
    見出し: ["header.kn-mlist-head h1", ".k-page-head h1"],
    見出しの帯: ["header.kn-mlist-head", ".k-list-head"],
    本文の箱: ["div.kn-mlist-body", ".k-list-body"],
  });
  const wide = groupAt(g!, 1440);
  expect(wide.canvas).toBe("Main");
  expect(wide.pairs).toEqual(g!.pairs);
  const page = await browser.newPage({ viewport: { width: 375, height: 1000 }, colorScheme: "light" });
  await routeCanvasFonts(page);
  await page.goto(pathToFileURL(join(ROOT, "04_design/canvas/MobileList.dc.html")).href);
  for (const p of m.pairs) await expect(page.locator(p.canvas).filter({ visible: true }), p.name).toHaveCount(1);
  await page.close();
});
