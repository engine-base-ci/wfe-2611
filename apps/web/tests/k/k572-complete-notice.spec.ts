// K-572「画面：完了にする小窓の注意（本文のチェックの箱と確認項目の未チェックを数えて出す・戻って付ける／このまま完了にする）。F5 の帯の区画読みを外す」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f4v2/f4v2-complete（代表が OK を出した下絵 v2・部品 features/F4/doc/detail-views.tsx の CompleteDialog）。字・並び・ボタンは下絵が正。
//   詳細と帯は前からの土台（approve-complete.harness.ts の mockApi）。本文（getTicket の body.doc）・確認項目の一覧 listTestSpecs・完了の口 completeTicket は
//   網の手前で重ねる（口の葉 K-560・K-434・K-566 と同時に書いているため。答えの形は 11_tickets/K-566.md・K-560.md・K-434.md）。道具は complete-mock.ts（この葉が持つ）。
//   完了の口は { conditions_confirmed: true } だけを受ける（todo_checked・todo_version は送らない）。固定の待ちは使わない。name は exact。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
import {
  ALL_DONE_DOC,
  CHILD,
  DEFAULT_DOC,
  NO_ATTRS,
  NO_TASK_DOC,
  S1,
  T1,
  T2,
  WIDTHS,
  childrenLeft,
  conflict,
  docOf,
  failed,
  mockComplete,
  msg,
  noOverflow,
  notFound,
  serverCount,
  spec,
  task,
  taskList,
} from "./complete-mock";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";
import {
  MSG,
  TICKET,
  bandOf,
  dialog,
  openComplete,
  openTicket,
  openTicketSettled,
} from "../features/F5/approve-complete.harness";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../.."); // apps/web
const GO = "このまま完了にする";
const BACK = "戻って付ける";
const KEEP = "完了にしても止めません。このままでよいかを決めてください。";
const bodyTitle = (n: number): string => `本文に、チェックのないやることが ${n} つ残っています`;
const specTitle = (n: number): string => `確認項目にチェックの付いていない物が ${n} つあります`;
const completeBtn = (page: Page) => page.getByRole("button", { name: "完了にする", exact: true });
const go = (page: Page) => dialog(page).getByRole("button", { name: GO, exact: true });
const back = (page: Page) => dialog(page).getByRole("button", { name: BACK, exact: true });
const listItems = (page: Page) => dialog(page).locator(".k-f4d-unchecked li");

// ---------------------------------------------------------------- 注意を出す

test("K572-UI-001 入口：「完了にする」を押すと、本文に未チェックが 2 つ・確認項目に未チェックが 1 つ残るとき、小窓「完了にする」（対象の行つき）が開き、「本文に、チェックのないやることが 2 つ残っています」（「完了にしても止めません。このままでよいかを決めてください。」）と未チェックの行（☐ 付き）・「確認項目にチェックの付いていない物が 1 つあります」と ☐ 付きの文が出る。足は「戻って付ける」「このまま完了にする」。この時点で完了の口は 0 回・確認項目の口は 1 回", async ({
  page,
}) => {
  const m = await mockComplete(page, { specs: [spec(1, S1)] });
  await openTicketSettled(page);
  await openComplete(page);
  const d = dialog(page);
  await expect(d.getByRole("heading", { name: "完了にする", exact: true })).toBeVisible();
  await expect(d.locator(".k-dialog-target")).toHaveText("EG-133 11 月分の請求書を送る");
  await expect(d.getByText(bodyTitle(2), { exact: true })).toBeVisible();
  await expect(d.getByText(KEEP, { exact: true })).toBeVisible();
  await expect(d.getByText(specTitle(1), { exact: true })).toBeVisible();
  await expect(d.getByText(`☐ ${S1}`, { exact: true })).toBeVisible();
  await expect(listItems(page)).toHaveText([`☐ ${T1}`, `☐ ${T2}`]);
  await expect(d.locator(".k-dialog-actions").getByRole("button")).toHaveText([BACK, GO]);
  expect(m.api.completes).toHaveLength(0);
  expect(m.specReads).toBe(1);
});

test("K572-UI-002 入力：本文だけ・確認項目だけに未チェックが残る形：本文だけなら確認項目の注意は出ない。確認項目だけなら本文の注意と「完了にしても止めません…」の文は出ず、確認項目の注意に未チェックの文が 2 行並ぶ", async ({
  page,
}) => {
  const m = await mockComplete(page, { specs: [spec(1, S1, true)] });
  await openTicketSettled(page);
  await openComplete(page);
  await expect(dialog(page).getByText(bodyTitle(2), { exact: true })).toBeVisible();
  await expect(dialog(page).getByText(/確認項目にチェックの付いていない物が/)).toHaveCount(0);
  await back(page).click();
  m.doc = ALL_DONE_DOC();
  m.specs = [spec(1, S1), spec(2, "宛名が登録した連絡先と合っている")];
  await openTicketSettled(page); // 本文は詳細の読みから数えるので、読み直してから押す
  await openComplete(page);
  await expect(dialog(page).getByText(specTitle(2), { exact: true })).toBeVisible();
  await expect(dialog(page).getByText(`☐ ${S1}`, { exact: true })).toBeVisible();
  await expect(dialog(page).getByText("☐ 宛名が登録した連絡先と合っている", { exact: true })).toBeVisible();
  await expect(dialog(page).getByText(/本文に、チェックのないやること/)).toHaveCount(0);
  await expect(dialog(page).getByText(KEEP, { exact: true })).toHaveCount(0);
});

test('K572-UI-003 入力：本文の数え方は口と同じ（K-566）。真偽の true だけが済み。attrs が無い箱・checked が文字の "true"・null・入れ子の中の未チェックも数え、段落の字の「[ ]」は数えない。小窓の数と行は、完了の口が返す unchecked.body と同じ', async ({
  page,
}) => {
  const doc = docOf(
    taskList([
      task("A"),
      task("B", true),
      task("C", "true"),
      task("D", null),
      task("E", NO_ATTRS),
      task("F", true, [task("F1"), task("F2", true)]),
    ]),
    { type: "paragraph", content: [{ type: "text", text: "[ ] G" }] },
  );
  expect(serverCount(doc)).toBe(5);
  await mockComplete(page, { doc });
  await openTicketSettled(page);
  await openComplete(page);
  await expect(dialog(page).getByText(bodyTitle(5), { exact: true })).toBeVisible();
  await expect(listItems(page)).toHaveText(["☐ A", "☐ C", "☐ D", "☐ E", "☐ F1"]);
  const shown = await listItems(page).count();
  expect(shown).toBe(5);
  const answered = page.waitForResponse(
    (r) => r.request().method() === "POST" && r.url().endsWith(`/tickets/${TICKET}/complete`),
  );
  await go(page).click();
  const res = (await (await answered).json()) as { data: { unchecked: { body: number; specs: number } } };
  expect(res.data.unchecked.body).toBe(shown);
  expect(res.data.unchecked).toEqual({ body: 5, specs: 0 });
});

test("K572-UI-004 入力：本文に body が無い（前の形の口の答え）なら、本文の未チェックは 0 と数えて確認項目だけを見る。確認項目に未チェックが無ければ小窓なしで完了する", async ({
  page,
}) => {
  const m = await mockComplete(page, { doc: null, specs: [spec(1, S1)] });
  await openTicketSettled(page);
  await openComplete(page);
  await expect(dialog(page).getByText(specTitle(1), { exact: true })).toBeVisible();
  await expect(dialog(page).getByText(/本文に、チェックのないやること/)).toHaveCount(0);
  await back(page).click();
  m.specs = [spec(1, S1, true)];
  await completeBtn(page).click();
  await expect.poll(() => m.api.completes.length).toBe(1);
  await expect(dialog(page)).toHaveCount(0);
});

// ---------------------------------------------------------------- 決める

test("K572-UI-005 入力：「このまま完了にする」で、完了の口に 1 回（体は { conditions_confirmed: true } だけ・todo_checked・todo_version は送らない）。小窓が閉じ、帯が「完了しました（高本・11/21 12:00）」に替わり、「完了にする」が消える（詳細の読み直しで）", async ({
  page,
}) => {
  const m = await mockComplete(page, { specs: [spec(1, S1)] });
  await openTicketSettled(page);
  await openComplete(page);
  await go(page).click();
  await expect.poll(() => m.api.completes.length).toBe(1);
  expect(m.api.completes[0]).toEqual({ conditions_confirmed: true });
  await expect(dialog(page)).toHaveCount(0);
  await expect(bandOf(page).getByText(/完了しました（高本・/)).toBeVisible();
  await expect(completeBtn(page)).toHaveCount(0);
  expect(m.ticketReads).toBeGreaterThanOrEqual(2);
});

test("K572-UI-006 操作：「戻って付ける」を押すと、完了の口を呼ばずに小窓が閉じ、「完了にする」に焦点が戻る。確認項目をチェックして開き直すと、読み直した確認項目で数え直す（押すたびに確認項目の口を 1 回）", async ({
  page,
}) => {
  const m = await mockComplete(page, { doc: ALL_DONE_DOC(), specs: [spec(1, S1)] });
  await openTicketSettled(page);
  await openComplete(page);
  await back(page).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(completeBtn(page)).toBeFocused();
  expect(m.api.completes).toHaveLength(0);
  m.specs = [spec(1, S1, true)];
  await completeBtn(page).click();
  await expect.poll(() => m.api.completes.length).toBe(1);
  expect(m.specReads).toBe(2);
});

test("K572-UI-007 入力：未チェックが無い（本文の箱が全部済み・確認項目も全部チェック済み）、または本文に箱が 1 つも無く確認項目も 0 件のとき、「完了にする」を押すと小窓を出さずにそのまま完了にする。完了の口 1 回・帯は「完了しました」。「実施事項は全部終わりました」の一文は出ない", async ({
  page,
}) => {
  const m = await mockComplete(page, { doc: ALL_DONE_DOC(), specs: [spec(1, S1, true)] });
  await openTicketSettled(page);
  await expect(bandOf(page).getByText(MSG.completeHint)).toBeVisible();
  await expect(bandOf(page).getByText("実施事項は全部終わりました")).toHaveCount(0);
  await completeBtn(page).click();
  await expect.poll(() => m.api.completes.length).toBe(1);
  expect(m.api.completes[0]).toEqual({ conditions_confirmed: true });
  await expect(dialog(page)).toHaveCount(0);
  await expect(bandOf(page).getByText(/完了しました/)).toBeVisible();
  const m2 = await mockComplete(page, { doc: NO_TASK_DOC(), specs: [] });
  await openTicketSettled(page);
  await completeBtn(page).click();
  await expect.poll(() => m2.api.completes.length).toBe(1);
  await expect(dialog(page)).toHaveCount(0);
});

test("K572-UI-008 操作：小窓を Esc・頭の右上の ×「閉じる」で閉じると、完了の口は 0 回で「完了にする」が残る（小窓の中で名前「閉じる」のボタンは 1 つ）", async ({
  page,
}) => {
  const m = await mockComplete(page);
  await openTicketSettled(page);
  await openComplete(page);
  await expect(dialog(page).getByRole("button", { name: "閉じる" })).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  await openComplete(page);
  await dialog(page).locator(".k-dialog-head").getByRole("button", { name: "閉じる" }).click();
  await expect(dialog(page)).toHaveCount(0);
  expect(m.api.completes).toHaveLength(0);
  await expect(completeBtn(page)).toBeVisible();
});

test("K572-UI-009 操作の揺れ：「このまま完了にする」の二度押し（答えを止めた間に続けて 2 回）は、完了の口 1 回。送っている間は押せない形で、小窓は閉じない。答えが来ると完了になる", async ({
  page,
}) => {
  const m = await mockComplete(page);
  await openTicketSettled(page);
  await openComplete(page);
  const release = m.api.hold();
  await go(page).click();
  await expect.poll(() => m.api.completes.length).toBe(1);
  await expect(go(page)).toBeDisabled();
  await go(page).dispatchEvent("click");
  await expect(dialog(page)).toBeVisible();
  release();
  await expect(bandOf(page).getByText(/完了しました/)).toBeVisible();
  expect(m.api.completes).toHaveLength(1);
});

// ---------------------------------------------------------------- 失敗

test("K572-UI-010 失敗：小窓から完了して口が 422（E-VAL-024・終わっていない子）：小窓の中に口の文と子の番号・題名（その子へのリンク）が出て、小窓は閉じない。未チェックの注意はそのまま残る", async ({
  page,
}) => {
  const m = await mockComplete(page);
  m.api.on.complete = () => childrenLeft();
  await openTicketSettled(page);
  await openComplete(page);
  await go(page).click();
  await expect(dialog(page).getByText(/終わっていない子のチケットがあります/)).toBeVisible();
  await expect(dialog(page).getByRole("link", { name: /EG-134 宛名を確かめる/ })).toHaveAttribute(
    "href",
    new RegExp(`/tickets/${CHILD}$`),
  );
  await expect(dialog(page).getByText(bodyTitle(2), { exact: true })).toBeVisible();
  await expect(dialog(page)).toBeVisible();
});

test("K572-UI-011 失敗：未チェックが無くて小窓なしで完了し、口が 422（E-VAL-024）：未チェックの注意は出さず、小窓を開いて口の文と子のリンクを出す（押し直せる）", async ({
  page,
}) => {
  const m = await mockComplete(page, { doc: ALL_DONE_DOC(), specs: [] });
  m.api.on.complete = () => childrenLeft();
  await openTicketSettled(page);
  await completeBtn(page).click();
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByText(/終わっていない子のチケットがあります/)).toBeVisible();
  await expect(dialog(page).getByRole("link", { name: /EG-134 宛名を確かめる/ })).toHaveAttribute(
    "href",
    new RegExp(`/tickets/${CHILD}$`),
  );
  await expect(dialog(page).getByText(/チェックのない|チェックの付いていない/)).toHaveCount(0);
  expect(m.api.completes).toHaveLength(1);
});

test("K572-UI-012 失敗：完了の口が 409（承認待ち・実行中は完了にできない E-CONF-016）・もう完了している（E-CONF-018）：小窓が閉じ、帯に赤い知らせ（口の文）が出て、詳細を読み直す（2 回目）。もう完了していた場合は「完了にする」が消える", async ({
  page,
}) => {
  const m = await mockComplete(page);
  m.api.on.complete = () => conflict("E-CONF-016", MSG.stage);
  await openTicketSettled(page);
  await openComplete(page);
  await go(page).click();
  await expect(page.getByRole("alert").filter({ hasText: MSG.stage })).toBeVisible();
  await expect(dialog(page)).toHaveCount(0);
  await expect.poll(() => m.ticketReads).toBeGreaterThanOrEqual(2);
  m.api.on.complete = () => {
    m.done = true;
    return conflict("E-CONF-018", msg("E-CONF-018"));
  };
  await page.reload();
  await expect(completeBtn(page)).toBeVisible();
  await openComplete(page);
  await go(page).click();
  await expect(page.getByRole("alert").filter({ hasText: msg("E-CONF-018") })).toBeVisible();
  await expect(completeBtn(page)).toHaveCount(0);
});

test("K572-UI-013 失敗：確認項目の一覧の口が 503（E-PAGE-003）：未チェックが分からないので小窓も完了もなく、帯に赤い知らせ（正本の文）。完了の口は 0 回。もう一度押すと読み直して先へ進む（確認項目の口は合計 2 回）", async ({
  page,
}) => {
  const m = await mockComplete(page, { doc: ALL_DONE_DOC(), specs: [spec(1, S1, true)] });
  m.nextSpecs = [failed()];
  await openTicketSettled(page);
  await completeBtn(page).click();
  await expect(page.getByRole("alert").filter({ hasText: msg("E-PAGE-003") })).toBeVisible();
  await expect(dialog(page)).toHaveCount(0);
  expect(m.api.completes).toHaveLength(0);
  await completeBtn(page).click();
  await expect.poll(() => m.api.completes.length).toBe(1);
  expect(m.specReads).toBe(2);
});

test("K572-UI-014 失敗：確認項目の一覧の口が 404（E-PAGE-001）：帯に赤い知らせ（正本の文）・詳細を読み直す（2 回目）・完了の口は 0 回", async ({
  page,
}) => {
  const m = await mockComplete(page);
  m.nextSpecs = [notFound()];
  await openTicketSettled(page);
  await completeBtn(page).click();
  await expect(page.getByRole("alert").filter({ hasText: msg("E-PAGE-001") })).toBeVisible();
  await expect.poll(() => m.ticketReads).toBeGreaterThanOrEqual(2);
  expect(m.api.completes).toHaveLength(0);
  await expect(dialog(page)).toHaveCount(0);
});

test("K572-UI-015 失敗：小窓なしの完了で口が 503（E-PAGE-003）：帯に赤い知らせ。何も変わらず、押し直すと通る（完了の口は合計 2 回）。401 は入り直しへ（/login）", async ({
  page,
}) => {
  const m = await mockComplete(page, { doc: ALL_DONE_DOC(), specs: [] });
  m.api.on.complete = () => failed();
  await openTicketSettled(page);
  await completeBtn(page).click();
  await expect(page.getByRole("alert").filter({ hasText: msg("E-PAGE-003") })).toBeVisible();
  await expect(completeBtn(page)).toBeVisible();
  m.api.on.complete = () => ({
    status: 201,
    body: {
      data: {
        ticket: { id: TICKET, stage_key: "done" },
        knowledge_candidates: [],
        skipped_reason: "",
        unchecked: { body: 0, specs: 0 },
      },
    },
  });
  await completeBtn(page).click();
  await expect.poll(() => m.api.completes.length).toBe(2);
  await expect(bandOf(page).getByText(/完了しました/)).toBeVisible();
  const m2 = await mockComplete(page, { doc: ALL_DONE_DOC(), specs: [] });
  m2.api.on.complete = () => ({ status: 401, body: { error: "unauthorized", code: "E-PAGE-005" } });
  await openTicketSettled(page);
  await completeBtn(page).click();
  await expect(page).toHaveURL(/\/login/);
});

// ---------------------------------------------------------------- 画面

test("K572-UI-016 画面：幅 375・768・1440 で小窓を開いても横溢れ 0。小窓が画面の中（左が 0 以上・右が幅以下）で、「戻って付ける」「このまま完了にする」「閉じる」が画面の中", async ({
  page,
}) => {
  await mockComplete(page, { specs: [spec(1, S1), spec(2, "宛名が登録した連絡先と合っている")] });
  for (const w of WIDTHS) {
    await openTicket(page, w);
    await openComplete(page);
    await noOverflow(page, w);
    const box = await dialog(page).boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(w);
    for (const b of [back(page), go(page), dialog(page).getByRole("button", { name: "閉じる" })]) {
      const r = await b.boundingBox();
      expect(r, `幅 ${w}：画面の外`).not.toBeNull();
      expect(r!.x + r!.width).toBeLessThanOrEqual(w);
    }
    await page.keyboard.press("Escape");
  }
});

test("K572-UI-017 画面：キーボードだけで、「完了にする」を Enter で押すと小窓が開き、焦点は小窓の中（「戻って付ける」）。Tab で「このまま完了にする」→ 閉じる。Esc で閉じると焦点は「完了にする」へ戻る。完了の口は 0 回", async ({
  page,
}) => {
  const m = await mockComplete(page);
  await openTicketSettled(page);
  await completeBtn(page).focus();
  await page.keyboard.press("Enter");
  await expect(dialog(page)).toBeVisible();
  await expect(back(page)).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(go(page)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  await expect(completeBtn(page)).toBeFocused();
  expect(m.api.completes).toHaveLength(0);
});

const pair = (name: string, sel: string, props: string[]): FidelityPair => ({
  name,
  role: name,
  canvas: sel,
  app: sel,
  props,
});
const TXT = ["font-size", "font-weight", "color", "line-height"];
const D_PAIRS: FidelityPair[] = [
  pair("dialog", ".k-dialog", ["x", "width", "background-color", "border-top-left-radius"]),
  pair("title", ".k-dialog-title", [...TXT, "x", "texts"]),
  pair("target", ".k-dialog-target", [...TXT, "x"]),
  pair("callout", ".k-callout", ["x", "width", "background-color", "border-top-color"]),
  pair("callout-title", ".k-callout-title", [...TXT, "texts"]),
  pair("unchecked", ".k-f4d-unchecked li", [...TXT, "x", "texts"]),
  pair("acts", ".k-dialog-actions .k-btn", [
    "width",
    "height",
    "font-size",
    "color",
    "background-color",
    "border-top-color",
    "texts",
  ]),
];
test("K572-UI-018 画面：下絵との突き合わせ（f4v2-complete）：幅 375・768・1440 で小窓の箱・題・注意の 2 つの箱（色・幅）・題・未チェックの行・足のボタンの字と色が下絵と同じ（対象の行の字は番号・題名の違いを除く）", async ({
  browser,
}) => {
  for (const w of MATCH_WIDTHS) {
    const { rows, bad } = await matchMock(
      browser,
      "f4v2-complete",
      w,
      async (page) => {
        await mockComplete(page, { doc: DEFAULT_DOC(), specs: [spec(1, S1)] });
        await openTicket(page, w);
        await openComplete(page);
        await expect(dialog(page).getByText(specTitle(1), { exact: true })).toBeVisible();
      },
      { base: "/dev/mock/f4v2", pairs: D_PAIRS, blur: true },
    );
    expect(rows.length, `幅 ${w}：比べた値が 0 件`).toBeGreaterThan(0);
    expect(bad, bad.join("\n")).toEqual([]);
  }
});

// ---------------------------------------------------------------- 口の数・区画読みを外した確認

test("K572-UI-019 守り：詳細を開くだけでは確認項目の口は 0 回。「完了にする」を押すたびに 1 回（押す前の数をためない）。完了の口以外の書く口は 0 回で、本人の Bridge（38617）に飛ばない", async ({
  page,
}) => {
  const bridge: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("127.0.0.1:38617")) bridge.push(r.url());
  });
  const m = await mockComplete(page, { specs: [spec(1, S1)] });
  await openTicketSettled(page);
  expect(m.specReads).toBe(0);
  await completeBtn(page).click();
  await expect(dialog(page)).toBeVisible();
  expect(m.specReads).toBe(1);
  await back(page).click();
  await completeBtn(page).click();
  await expect(dialog(page)).toBeVisible();
  expect(m.specReads).toBe(2);
  expect(m.otherWrites).toEqual([]);
  expect(bridge).toEqual([]);
});

test("K572-UI-020 入口の確かめ（ブラウザを使わない）：F5 の完了の帯と小窓が、区画の読み（sectionOf・todoItems・checkedNumbers・todo_checked・todo_version・sections）をもう持たない。小窓の古い部品（確かめのチェック・E-VAL-022）も無い", async () => {
  const dir = join(ROOT, "features/F5/approve-complete");
  for (const f of ["band.tsx", "complete-dialog.tsx", "complete-model.ts"]) {
    expect(existsSync(join(dir, f)), `${f} が無い`).toBe(true);
    const src = readFileSync(join(dir, f), "utf8");
    for (const word of [
      "sectionOf",
      "todoItems",
      "checkedNumbers",
      "todo_checked",
      "todo_version",
      "sections",
      "E-VAL-022",
      "完了の条件を満たしたことを確かめました",
      "確かめて完了にする",
    ]) {
      expect(src.includes(word), `${f} に「${word}」が残っている`).toBe(false);
    }
  }
  expect(existsSync(join(dir, "unchecked.ts")), "unchecked.ts（uncheckedTasks）が無い").toBe(true);
});

// X8：「完了にする」は下絵 v2 のとおり題の行に出る（F5 の帯は状態の知らせだけ）
test("K572-UI-021 入口の置き場：「完了にする」は題の行（header.k-page-head の中）に 1 つだけ出て、帯（region「承認と実行」）の中には無い。帯の案内文は帯に残る。題の行で押すと同じ流れ（小窓）が開く", async ({
  page,
}) => {
  await mockComplete(page, { specs: [spec(1, S1)] });
  await openTicketSettled(page);
  await expect(page.locator("header.k-page-head").getByRole("button", { name: "完了にする", exact: true })).toHaveCount(
    1,
  );
  await expect(completeBtn(page)).toHaveCount(1);
  await expect(bandOf(page).getByRole("button", { name: "完了にする", exact: true })).toHaveCount(0);
  await expect(bandOf(page).getByText(MSG.completeHint)).toBeVisible();
  await openComplete(page);
  await expect(dialog(page)).toBeVisible();
});
