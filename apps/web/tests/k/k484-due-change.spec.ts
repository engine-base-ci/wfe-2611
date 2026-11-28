// K-484「画面：詳細の「期限」の ▾ から期限を変える（理由が必須・延ばすと承認する人にお知らせ・期限をなくす・失敗の出し方）と、期限切れの炎」の画面の試験
//   （実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f7 の f7-tidy-due・f7-tidy-due-error（本番と同じ部品 features/F7/due/views.tsx の DuePopover・LateMark）。
//   口は網の手前で差し替える（前からの土台 mockApi の上に tests/k/due-mock.ts の mockDue）。口の形と番号は K-483 の md に合わせる（体は due_on・due_reason・expected_due_on）。
//   時計は 2026-11-02（月）日本時間 10:00 に固定する（今日・明日・今週の金曜・来週の月曜の値と炎の有無を決めるため）。
//   ▾ は getTicket の can.due が真のときだけ押せる（役の名前では決めない）。成功の答えの中身は使わず、getTicket を読み直して描く。
//   押した直後の口の数は expect.poll で待つ（台が混んでも口の差し替えに届く前に数えない）。固定の待ちは使わない（要素と答えを待つ）。
//   文は正本 errors.json の 1 件（番号で引く。画面で文を作らない）。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  AHEAD,
  DUE_PAIRS,
  NOW,
  OVERDUE,
  REASON,
  TICKET,
  TODAY,
  clearBtn,
  dayBtn,
  dayName,
  dueBtn,
  errReply,
  errsOf,
  fieldsOf,
  flame,
  md,
  mdw,
  mockDue,
  noteOf,
  noticeOf,
  openDetail,
  openPop,
  popup,
  quickBtn,
  reasonBox,
  submitBtn,
  timeBox,
  type DueMock,
  type DueOptions,
} from "./due-mock";
import { ROOT, overflowX } from "./kit";
import { idOf, mockList, open as openList, rowsOf } from "./list-mock";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";

test.use({ timezoneId: "Asia/Tokyo" });

const ERRORS = JSON.parse(readFileSync(join(ROOT, "07_qa/test-specs/errors.json"), "utf8")) as {
  errors: { id: string; message: string }[];
};
const msg = (id: string): string => {
  const m = ERRORS.errors.find((e) => e.id === id)?.message;
  if (!m)
    throw new Error(`正本 errors.json に無い番号：${id}（E-DUE- は K-483・E-VAL-012・E-VAL-028 は K-437 が足す）`);
  return m;
};
const firstSentence = (id: string) => {
  const m = msg(id);
  const i = m.indexOf("。");
  return i < 0 ? m : m.slice(0, i + 1);
};
/** K-483 の番号（文は errors.json から引く。手元の過去日の確かめも口の答え（409）も同じ番号 E-VAL-012・同じ字。開始日と期限の前後は E-VAL-028。どちらも段 5 の K-437 が定義した文） */
const T = {
  reasonEmpty: () => msg("E-DUE-001"),
  reasonLong: () => msg("E-DUE-002"),
  past: () => msg("E-VAL-012"),
  pastServer: () => msg("E-VAL-012"),
  order: () => msg("E-VAL-028"),
  overParent: () => msg("E-DUE-005"),
  underChild: () => msg("E-DUE-006"),
  done: () => msg("E-DUE-007"),
  conflict: () => msg("E-DUE-008"),
};

async function setup(page: Page, o: DueOptions = {}, now: Date = NOW): Promise<DueMock> {
  await page.clock.setFixedTime(now);
  return mockDue(page, o);
}
/** 同じ試験の中で別の答えにして開き直す（前の差し替えを外してから） */
async function again(page: Page, o: DueOptions = {}, now: Date = NOW): Promise<DueMock> {
  await page.unrouteAll({ behavior: "ignoreErrors" });
  return setup(page, o, now);
}
const fillReason = (page: Page, v: string) => reasonBox(page).fill(v);
const send = (page: Page, ymd: string) => submitBtn(page, `${md(ymd)} にする`);

test("K484-UI-001 ▾ を押すと小窓が開く：期限を過ぎた詳細は炎と「1 日過ぎ」・小窓は すぐ選ぶ 4 つ・月・理由（空・必須）・時刻・注・ボタン。今日が選ばれ、開く前も開いた後も口は呼ばない", async ({
  page,
}) => {
  const d = await setup(page);
  await openDetail(page);
  expect(await fieldsOf(page, "日付と時間")).toEqual({
    開始日: mdw("2026-10-30"),
    期限: `${mdw(OVERDUE)}1 日過ぎ`,
    予定時間: "",
    実績時間: "",
  });
  await expect(flame(page)).toHaveCount(1);
  expect(d.patches).toEqual([]);
  await dueBtn(page).click();
  await expect(popup(page)).toBeVisible();
  await expect(popup(page).getByRole("group", { name: "すぐ選ぶ", exact: true }).getByRole("button")).toHaveText([
    "今日",
    "明日",
    "今週の金曜",
    "来週の月曜",
  ]);
  await expect(quickBtn(page, "今日")).toHaveAttribute("aria-pressed", "true");
  await expect(popup(page).getByText("2026年 11月", { exact: true })).toBeVisible();
  await expect(reasonBox(page)).toHaveValue("");
  await expect(reasonBox(page)).toHaveAttribute("aria-required", "true");
  await expect(timeBox(page)).toHaveValue("18:00");
  await expect(noteOf(page)).toHaveText("期限を延ばすと、承認する人（高本）にお知らせが出る");
  await expect(clearBtn(page)).toBeVisible();
  await expect(send(page, TODAY)).toBeVisible();
  await expect(popup(page).getByText(/先方の締め/)).toHaveCount(0);
  expect(d.patches).toEqual([]);
});

test("K484-UI-002 すぐ選ぶ 4 つ：固定の時計 11/02（月）で 今日 11/02・明日 11/03・今週の金曜 11/06・来週の月曜 11/09。押すと選んだ日と「〇〇 にする」の字が同じ日に替わり、押した 1 つだけ aria-pressed", async ({
  page,
}) => {
  await setup(page);
  await openPop(page);
  const want: [string, string][] = [
    ["今日", "2026-11-02"],
    ["明日", "2026-11-03"],
    ["今週の金曜", "2026-11-06"],
    ["来週の月曜", "2026-11-09"],
  ];
  for (const [label, ymd] of want) {
    await quickBtn(page, label).click();
    await expect(quickBtn(page, label)).toHaveAttribute("aria-pressed", "true");
    await expect(popup(page).locator('.k-f7-due-quick-item[aria-pressed="true"]')).toHaveCount(1);
    await expect(send(page, ymd)).toBeVisible();
    await expect(dayBtn(page, dayName(ymd))).toHaveAttribute("aria-pressed", "true");
  }
});

test("K484-UI-003 月のカレンダー：「2026年 11月」の 30 日・選んだ日だけ aria-pressed・今日に印。次の月・前の月で月だけが替わり、選んだ日は変わらない。日を押すとその日が選ばれる", async ({
  page,
}) => {
  await setup(page);
  await openPop(page);
  const grid = (name: string) => popup(page).getByRole("group", { name, exact: true });
  await expect(grid("2026年 11月の日付").getByRole("button")).toHaveCount(30);
  await expect(dayBtn(page, "11月2日")).toHaveAttribute("aria-pressed", "true");
  await expect(dayBtn(page, "11月2日")).toHaveAttribute("aria-current", "date");
  await popup(page).getByRole("button", { name: "次の月", exact: true }).click();
  await expect(popup(page).getByText("2026年 12月", { exact: true })).toBeVisible();
  await expect(grid("2026年 12月の日付").getByRole("button")).toHaveCount(31);
  await expect(popup(page).locator('.k-f7-due-day[aria-pressed="true"]')).toHaveCount(0);
  await expect(send(page, TODAY)).toBeVisible();
  await popup(page).getByRole("button", { name: "前の月", exact: true }).click();
  await expect(dayBtn(page, "11月2日")).toHaveAttribute("aria-pressed", "true");
  await dayBtn(page, "11月20日").click();
  await expect(dayBtn(page, "11月20日")).toHaveAttribute("aria-pressed", "true");
  await expect(dayBtn(page, "11月2日")).toHaveAttribute("aria-pressed", "false");
  await expect(send(page, "2026-11-20")).toBeVisible();
});

test("K484-UI-004 時刻は読むだけ（18:00）・先方の締めの欄は無い：口に送る中身は日付と理由だけで、時刻の字は入らない", async ({
  page,
}) => {
  const d = await setup(page);
  await openPop(page);
  await expect(timeBox(page)).toHaveJSProperty("readOnly", true);
  await expect(popup(page).getByText(/先方の締め/)).toHaveCount(0);
  await dayBtn(page, "11月5日").click();
  await fillReason(page, REASON);
  await send(page, "2026-11-05").click();
  await expect.poll(() => d.patches.length).toBe(1);
  expect(JSON.stringify(d.patches[0]!.body)).not.toContain("18:00");
  expect(Object.keys(d.patches[0]!.body)).toEqual(expect.arrayContaining(["due_on", "due_reason"]));
  expect(d.patches[0]!.body).not.toHaveProperty("start_on");
});

test("K484-UI-005 理由が空：日を選んで理由を書かずに押すと口に 0 回・理由の欄の下に E-DUE-001 の文・欄は aria-invalid・小窓は開いたまま・選んだ日は残る", async ({
  page,
}) => {
  const d = await setup(page);
  await openPop(page);
  await dayBtn(page, "11月5日").click();
  await send(page, "2026-11-05").click();
  await expect.poll(() => errsOf(page)).toContain(T.reasonEmpty());
  await expect(reasonBox(page)).toHaveAttribute("aria-invalid", "true");
  await expect(popup(page)).toBeVisible();
  await expect(dayBtn(page, "11月5日")).toHaveAttribute("aria-pressed", "true");
  expect(d.patches).toEqual([]);
});

test("K484-UI-006 表記ゆらぎ：理由が全角の空白だけ・半角の空白だけ・改行だけは空と同じ（口に 0 回・同じ文）。前後の空白は取り、全角の数字は半角にそろえて送る", async ({
  page,
}) => {
  const d = await setup(page);
  await openPop(page);
  await dayBtn(page, "11月5日").click();
  for (const v of ["　", " ", "\n", "　 \n　"]) {
    await fillReason(page, v);
    await send(page, "2026-11-05").click();
    await expect.poll(() => errsOf(page), JSON.stringify(v)).toContain(T.reasonEmpty());
  }
  expect(d.patches).toEqual([]);
  await fillReason(page, "　１日待ちます　");
  await send(page, "2026-11-05").click();
  await expect.poll(() => d.patches.length).toBe(1);
  expect(d.patches[0]!.body).toMatchObject({ due_on: "2026-11-05", due_reason: "1日待ちます" });
});

test("K484-UI-007 過去日：10/30 を選ぶとその場で格子の下に E-VAL-012 の文が出て、押しても口に 0 回。今日に戻すと文が消える", async ({
  page,
}) => {
  const d = await setup(page);
  await openPop(page);
  await popup(page).getByRole("button", { name: "前の月", exact: true }).click();
  await dayBtn(page, "10月30日").click();
  await expect.poll(() => errsOf(page)).toContain(T.past());
  await expect(popup(page).locator(".k-f7-due-grid + .k-err")).toHaveCount(1);
  await fillReason(page, REASON);
  await send(page, "2026-10-30").click();
  await expect(popup(page)).toBeVisible();
  expect(d.patches).toEqual([]);
  await quickBtn(page, "今日").click();
  await expect.poll(() => errsOf(page)).not.toContain(T.past());
});

test("K484-UI-008 期限を延ばす（正常）：11/05 と理由を書いて押すと口に 1 回（due_on と due_reason）。小窓が閉じ、お知らせ「期限を 11/05 に変えました」・期限の行が「11/05（木）」・炎と「過ぎ」が消える（getTicket の読み直しで）", async ({
  page,
}) => {
  const d = await setup(page);
  await openPop(page);
  await dayBtn(page, "11月5日").click();
  await fillReason(page, REASON);
  await send(page, "2026-11-05").click();
  await expect.poll(() => d.patches.length).toBe(1);
  expect(d.patches[0]!.body).toMatchObject({ due_on: "2026-11-05", due_reason: REASON, expected_due_on: OVERDUE });
  await expect(popup(page)).toHaveCount(0);
  await expect(page.getByText("期限を 11/05 に変えました")).toBeVisible();
  await expect.poll(() => d.ticketReads).toBeGreaterThan(1);
  await expect.poll(async () => (await fieldsOf(page, "日付と時間"))["期限"]).toBe(mdw("2026-11-05"));
  await expect(flame(page)).toHaveCount(0);
});

test("K484-UI-009 承認待ちで延ばす：承認する人の名前は approval の名前・無ければ担当者の名前・どちらも無ければ注の行が無い。送ると通る", async ({
  page,
}) => {
  const d = await setup(page, { stage: "awaiting_approval", approver: "高本" });
  await openPop(page);
  await expect(noteOf(page)).toHaveText("期限を延ばすと、承認する人（高本）にお知らせが出る");
  await dayBtn(page, "11月5日").click();
  await fillReason(page, REASON);
  await send(page, "2026-11-05").click();
  await expect.poll(() => d.patches.length).toBe(1);
  await expect(popup(page)).toHaveCount(0);
  await again(page, { stage: "doing", approver: null, assignee: "鈴木" });
  await openPop(page);
  await expect(noteOf(page)).toHaveText("期限を延ばすと、承認する人（鈴木）にお知らせが出る");
  await again(page, { stage: "doing", approver: null, assignee: null });
  await openPop(page);
  await expect(noteOf(page)).toHaveCount(0);
});

test("K484-UI-010 期限をなくす・理由が空：口に 0 回・理由の欄の下に E-DUE-001 の文", async ({ page }) => {
  const d = await setup(page);
  await openPop(page);
  await clearBtn(page).click();
  await expect.poll(() => errsOf(page)).toContain(T.reasonEmpty());
  expect(d.patches).toEqual([]);
  await expect(popup(page)).toBeVisible();
});

test("K484-UI-011 期限をなくす（正常）：理由を書いて押すと口に due_on null と due_reason を 1 回。小窓が閉じ、お知らせ「期限をなくしました」・期限の行の値が空・炎が消える。開き直しても同じ（再取得）", async ({
  page,
}) => {
  const d = await setup(page);
  await openPop(page);
  await fillReason(page, REASON);
  await clearBtn(page).click();
  await expect.poll(() => d.patches.length).toBe(1);
  expect(d.patches[0]!.body).toMatchObject({ due_on: null, due_reason: REASON, expected_due_on: OVERDUE });
  await expect(popup(page)).toHaveCount(0);
  await expect(page.getByText("期限をなくしました")).toBeVisible();
  await expect.poll(async () => (await fieldsOf(page, "日付と時間"))["期限"]).toBe("");
  await expect(flame(page)).toHaveCount(0);
  const before = d.ticketReads;
  await openDetail(page);
  await expect.poll(() => d.ticketReads).toBeGreaterThan(before);
  expect((await fieldsOf(page, "日付と時間"))["期限"]).toBe("");
  await expect(flame(page)).toHaveCount(0);
});

test("K484-UI-012 炎の出方：期限が昨日は炎 1 つ（role=img 名前「期限切れ」）と「1 日過ぎ」・今日と先は炎なし・期限なしは炎なし・完了のチケットは期限が過ぎていても炎なし", async ({
  page,
}) => {
  await setup(page, { due: OVERDUE });
  await openDetail(page);
  await expect(flame(page)).toHaveCount(1);
  expect((await fieldsOf(page, "日付と時間"))["期限"]).toBe(`${mdw(OVERDUE)}1 日過ぎ`);
  await again(page, { due: TODAY });
  await openDetail(page);
  await expect(flame(page)).toHaveCount(0);
  expect((await fieldsOf(page, "日付と時間"))["期限"]).toBe(mdw(TODAY));
  await again(page, { due: AHEAD });
  await openDetail(page);
  await expect(flame(page)).toHaveCount(0);
  await again(page, { due: null });
  await openDetail(page);
  await expect(flame(page)).toHaveCount(0);
  await again(page, { due: OVERDUE, stage: "done", approver: null });
  await openDetail(page);
  await expect(flame(page)).toHaveCount(0);
});

test("K484-UI-013 期限なしのチケット：初めの選びは今日・「期限をなくす」は押せない（aria-disabled・押しても口に 0 回）。理由を書いて今日にすると口に due_on 11/02 と due_reason を 1 回", async ({
  page,
}) => {
  const d = await setup(page, { due: null });
  await openPop(page);
  await expect(quickBtn(page, "今日")).toHaveAttribute("aria-pressed", "true");
  await expect(clearBtn(page)).toHaveAttribute("aria-disabled", "true");
  await clearBtn(page).click({ force: true });
  await expect(popup(page)).toBeVisible();
  expect(d.patches).toEqual([]);
  await fillReason(page, REASON);
  await send(page, TODAY).click();
  await expect.poll(() => d.patches.length).toBe(1);
  expect(d.patches[0]!.body).toMatchObject({ due_on: TODAY, due_reason: REASON, expected_due_on: null });
});

test("K484-UI-014 別のタブで先に変えられた（409・E-DUE-008）：小窓の上の赤い箱に正本の文・理由と選んだ日は残る。getTicket が読み直され、小窓を閉じて開き直すと新しい期限が出る", async ({
  page,
}) => {
  const d = await setup(page);
  d.on.patch = () => errReply(409, "E-DUE-008");
  await openPop(page);
  d.due = "2026-11-04"; // 別のタブで先に変えられた
  await dayBtn(page, "11月5日").click();
  await fillReason(page, REASON);
  const before = d.ticketReads;
  await send(page, "2026-11-05").click();
  await expect(noticeOf(page)).toHaveText(T.conflict());
  await expect(reasonBox(page)).toHaveValue(REASON);
  await expect(dayBtn(page, "11月5日")).toHaveAttribute("aria-pressed", "true");
  await expect(popup(page)).toBeVisible();
  await expect.poll(() => d.ticketReads).toBeGreaterThan(before);
  await page.keyboard.press("Escape");
  await expect(popup(page)).toHaveCount(0);
  await expect.poll(async () => (await fieldsOf(page, "日付と時間"))["期限"]).toBe(mdw("2026-11-04"));
  await dueBtn(page).click();
  await expect(dayBtn(page, "11月4日")).toHaveAttribute("aria-pressed", "true");
  await expect(reasonBox(page)).toHaveValue("");
  await expect(noticeOf(page)).toHaveCount(0);
});

test("K484-UI-015 口の断り：完了した（409・E-DUE-007）は赤い箱・権限が無い（403）は E-PAGE-002 の 1 文目・消えた（404）は小窓が閉じて見つからない画面・日付に関わる断り（子の期限が親より後 E-DUE-005・子より前 E-DUE-006・開始日と期限の前後 E-VAL-028・口が見た過去日 E-VAL-012（409））は日付の欄（格子の下）で赤い箱は出ない。理由は残る", async ({
  page,
}) => {
  const d = await setup(page);
  d.on.patch = () => errReply(409, "E-DUE-007");
  await openPop(page);
  await dayBtn(page, "11月5日").click();
  await fillReason(page, REASON);
  await send(page, "2026-11-05").click();
  await expect(noticeOf(page)).toHaveText(T.done());
  await expect(reasonBox(page)).toHaveValue(REASON);
  // 権限が無い
  const e = await again(page);
  e.on.patch = () => errReply(403, "FORBIDDEN");
  await openPop(page);
  await dayBtn(page, "11月5日").click();
  await fillReason(page, REASON);
  await send(page, "2026-11-05").click();
  await expect(noticeOf(page)).toContainText(firstSentence("E-PAGE-002"));
  await expect(reasonBox(page)).toHaveValue(REASON);
  // 日付に関わる断り（赤い箱ではなく日付の欄の下）
  for (const [status, code, text] of [
    [409, "E-DUE-005", T.overParent()],
    [409, "E-DUE-006", T.underChild()],
    [409, "E-VAL-028", T.order()],
    [409, "E-VAL-012", T.pastServer()],
  ] as const) {
    const f = await again(page);
    f.on.patch = () => errReply(status, code);
    await openPop(page);
    await dayBtn(page, "11月5日").click();
    await fillReason(page, REASON);
    await send(page, "2026-11-05").click();
    await expect.poll(async () => (await errsOf(page)).join(""), code).toContain(text);
    await expect(popup(page).locator(".k-f7-due-grid + .k-err")).toHaveCount(1);
    await expect(noticeOf(page)).toHaveCount(0);
    await expect(reasonBox(page)).toHaveValue(REASON);
  }
  // 消えた
  const g = await again(page);
  g.on.patch = () => {
    g.api.on.ticket = () => ({ status: 404, body: { error: "not_found", code: "E-PAGE-001", message: "E-PAGE-001" } });
    return { status: 404, body: { error: "not_found", code: "E-PAGE-001", message: "E-PAGE-001" } };
  };
  await openPop(page);
  await dayBtn(page, "11月5日").click();
  await fillReason(page, REASON);
  await send(page, "2026-11-05").click();
  await expect(popup(page)).toHaveCount(0);
  await expect(page.getByText(firstSentence("E-PAGE-001")).first()).toBeVisible();
});

test("K484-UI-016 書けない人：getTicket の can.due が無い・偽のときは ▾ が押せない形（aria-disabled・薄さ 0.55）で、押しても Enter でも小窓は開かず口を呼ばない。真のときだけ押せる（役の名前では決まらない）", async ({
  page,
}) => {
  for (const canDue of [undefined, false] as const) {
    const d = await again(page, { canDue });
    await openDetail(page);
    const b = dueBtn(page);
    await expect(b).toHaveAttribute("aria-disabled", "true");
    expect(Number.parseFloat(await b.evaluate((e) => getComputedStyle(e).opacity))).toBeCloseTo(0.55, 2);
    await b.click({ force: true });
    await b.focus();
    await page.keyboard.press("Enter");
    await expect(popup(page)).toHaveCount(0);
    expect(d.patches).toEqual([]);
  }
  await again(page, { canDue: true });
  await openDetail(page);
  await expect(dueBtn(page)).not.toHaveAttribute("aria-disabled", "true");
  await dueBtn(page).click();
  await expect(popup(page)).toBeVisible();
});

test("K484-UI-017 一覧の右の詳細（layout side）には期限の ▾ も炎も出ない：パネルが無い今のまま", async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  await mockList(page);
  await page.route(new RegExp(`/api/v1/tickets/${idOf(1)}$`), (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          ticket: {
            id: idOf(1),
            number: "EG-101",
            title: "チケット 1",
            due_on: OVERDUE,
            start_on: null,
            priority: "mid",
          },
          sections: [{ key: "purpose", label: "目的", body: { text: "目的の本文" }, version: 1 }],
          kind: { name: "タスク" },
          stage: { name: "作業中", key: "doing" },
          assignee: { display_name: "高本" },
          can: { due: true },
        },
      }),
    }),
  );
  await openList(page, "/tickets?view=all");
  await rowsOf(page).first().getByRole("link", { name: "チケット 1" }).click();
  const side = page.getByRole("complementary", { name: "チケットの詳細" });
  await expect(side).toContainText("チケット 1");
  await expect(side.getByRole("button", { name: "期限を変える", exact: true })).toHaveCount(0);
  await expect(side.getByRole("img", { name: "期限切れ", exact: true })).toHaveCount(0);
});

test("K484-UI-018 送れない（500）：小窓の上の赤い箱に E-PAGE-007 の 1 文目・理由と選んだ日は残る。押し直すと 2 回目を送り、通れば閉じる（口は 2 回）", async ({
  page,
}) => {
  const d = await setup(page);
  const ok = d.on.patch;
  let n = 0;
  d.on.patch = (req) => {
    n++;
    return n === 1 ? { status: 500, body: { error: "internal", code: "INTERNAL" } } : ok(req);
  };
  await openPop(page);
  await dayBtn(page, "11月5日").click();
  await fillReason(page, REASON);
  await send(page, "2026-11-05").click();
  await expect(noticeOf(page)).toContainText(firstSentence("E-PAGE-007"));
  await expect(reasonBox(page)).toHaveValue(REASON);
  await expect(dayBtn(page, "11月5日")).toHaveAttribute("aria-pressed", "true");
  await send(page, "2026-11-05").click();
  await expect(popup(page)).toHaveCount(0);
  await expect.poll(() => d.patches.length).toBe(2);
});

test("K484-UI-019 二度押し：答えを止めた間に押すと口に 1 回届き、ボタンは押せない（busy）。もう 1 回押しても口は 1 回だけ。答えると小窓が閉じる", async ({
  page,
}) => {
  const d = await setup(page);
  await openPop(page);
  await dayBtn(page, "11月5日").click();
  await fillReason(page, REASON);
  const release = d.hold();
  const go = send(page, "2026-11-05");
  await go.click();
  await expect.poll(() => d.patches.length).toBe(1);
  await expect(go).toBeDisabled();
  await go.click({ force: true });
  release();
  await expect(popup(page)).toHaveCount(0);
  expect(d.patches.length).toBe(1);
});

test("K484-UI-020 キーボード：▾ に焦点 → Enter で開き → Esc で閉じて焦点は ▾ に戻る（口に 0 回）。開いて理由を書き、外（本文）を押すと閉じ、開き直すと理由は空に戻る", async ({
  page,
}) => {
  const d = await setup(page);
  await openDetail(page);
  await dueBtn(page).focus();
  await page.keyboard.press("Enter");
  await expect(popup(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(popup(page)).toHaveCount(0);
  await expect(dueBtn(page)).toBeFocused();
  await dueBtn(page).click();
  await fillReason(page, "書きかけ");
  await page.getByRole("heading", { level: 1 }).click();
  await expect(popup(page)).toHaveCount(0);
  await dueBtn(page).click();
  await expect(reasonBox(page)).toHaveValue("");
  expect(d.patches).toEqual([]);
});

test("K484-UI-021 同じ日・今の期限：期限が先（11/09）の ▾ を開くと初めの選びは 11/09・「11/09 にする」は押せない（aria-disabled・口に 0 回・指を置くと「いまの期限と同じです」）。別の日にすると押せる", async ({
  page,
}) => {
  const d = await setup(page, { due: AHEAD });
  await openPop(page);
  await expect(dayBtn(page, "11月9日")).toHaveAttribute("aria-pressed", "true");
  const go = send(page, AHEAD);
  await expect(go).toHaveAttribute("aria-disabled", "true");
  await expect(go).toHaveAttribute("title", "いまの期限と同じです");
  await fillReason(page, REASON);
  await go.click({ force: true });
  expect(d.patches).toEqual([]);
  await dayBtn(page, "11月10日").click();
  await expect(send(page, "2026-11-10")).not.toHaveAttribute("aria-disabled", "true");
});

for (const w of MATCH_WIDTHS) {
  test(`K484-UI-022 幅 ${w}：小窓を開いた詳細も、断りが出ている形も、横溢れ 0 で小窓は画面の中（左の端 0 以上・右の端が幅以下）`, async ({
    page,
  }) => {
    const d = await setup(page);
    d.on.patch = () => errReply(409, "E-DUE-008");
    await openPop(page, w);
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
    await dayBtn(page, "11月5日").click();
    await fillReason(page, REASON);
    await send(page, "2026-11-05").click();
    await expect(noticeOf(page)).toBeVisible();
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
    const b = (await popup(page).boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(w);
  });
}

test("K484-UI-023 口の数（速さ）：詳細を開くと getTicket は 1 回で、▾ を押して小窓を開いても口は増えない。送ったあとは更新 1 回と getTicket の読み直し 1 回だけ", async ({
  page,
}) => {
  const api: string[] = [];
  page.on("request", (r) => {
    if (/\/api\//.test(r.url()) && r.method() !== "OPTIONS") api.push(`${r.method()} ${new URL(r.url()).pathname}`);
  });
  const d = await setup(page);
  await openDetail(page);
  expect(d.ticketReads).toBe(1);
  const opened = api.length;
  await dueBtn(page).click();
  await expect(popup(page)).toBeVisible();
  expect(api.length).toBe(opened);
  await dayBtn(page, "11月5日").click();
  await fillReason(page, REASON);
  await send(page, "2026-11-05").click();
  await expect(popup(page)).toHaveCount(0);
  await expect.poll(() => d.ticketReads).toBe(2);
  const sent = api.slice(opened);
  expect(sent.filter((x) => x.startsWith("PATCH"))).toHaveLength(1);
  expect(sent.filter((x) => x === `GET /api/v1/tickets/${TICKET}`)).toHaveLength(1);
  expect(d.patches.length).toBe(1);
});

test("K484-UI-024 日本時間の日付の境目：23:59:59（11/01）は今日が 11/01・明日が 11/02・11/01 の期限は炎なし・初めの選びは 11/01。0:00:00（11/02）は今日が 11/02・11/01 の期限は炎あり・初めの選びは今日", async ({
  page,
}) => {
  await setup(page, { due: OVERDUE }, new Date("2026-11-01T14:59:59Z"));
  await openDetail(page);
  await expect(flame(page)).toHaveCount(0);
  await dueBtn(page).click();
  await expect(popup(page)).toBeVisible();
  await expect(quickBtn(page, "今日")).toHaveAttribute("aria-pressed", "true");
  await expect(dayBtn(page, "11月1日")).toHaveAttribute("aria-pressed", "true");
  await expect(dayBtn(page, "11月1日")).toHaveAttribute("aria-current", "date");
  await again(page, { due: OVERDUE }, new Date("2026-11-01T15:00:00Z"));
  await openDetail(page);
  await expect(flame(page)).toHaveCount(1);
  await dueBtn(page).click();
  await expect(dayBtn(page, "11月2日")).toHaveAttribute("aria-pressed", "true");
  await expect(dayBtn(page, "11月2日")).toHaveAttribute("aria-current", "date");
});

test("K484-UI-026 理由は 200 字まで（K-483 の上限）：201 字は手元で止めて口に 0 回・理由の欄の下に E-DUE-002 の文。200 字ちょうどは通る（字の数は文字の数）", async ({
  page,
}) => {
  const d = await setup(page);
  await openPop(page);
  await dayBtn(page, "11月5日").click();
  await fillReason(page, "あ".repeat(201));
  await send(page, "2026-11-05").click();
  await expect.poll(() => errsOf(page)).toContain(T.reasonLong());
  await expect(reasonBox(page)).toHaveAttribute("aria-invalid", "true");
  expect(d.patches).toEqual([]);
  await fillReason(page, "あ".repeat(200));
  await send(page, "2026-11-05").click();
  await expect.poll(() => d.patches.length).toBe(1);
  expect([...String((d.patches[0]!.body as { due_reason: string }).due_reason)].length).toBe(200);
});

// ---------------------------------------------------------------- モックとの突き合わせ（共通の道具 matchMock）
/** 本番をモックの状態にする手順 */
const DRIVE: Record<string, { skip?: string[]; go: (p: Page, w: number) => Promise<void> }> = {
  "f7-tidy-due": {
    go: async (p, w) => {
      await setup(p);
      await openPop(p, w);
      await fillReason(p, REASON);
    },
  },
  "f7-tidy-due-error": {
    // モックは 3 つの誤り（日・理由・口の断り）を 1 枚に並べるが、本番は手元の確かめ（日・理由）と口の断りが別の回に出る。
    // 字は UI-005・007・014 が見る。選んだ日が前の月に在るので、押した日の役と赤い箱の役は数を比べない
    skip: ["due-day-on:当たった数", "due-notice:当たった数"],
    go: async (p, w) => {
      await setup(p, { stage: "doing" });
      await openPop(p, w);
      await popup(p).getByRole("button", { name: "前の月", exact: true }).click();
      await dayBtn(p, "10月30日").click();
      await send(p, "2026-10-30").click();
      await expect.poll(() => errsOf(p)).toContain(T.reasonEmpty());
    },
  },
};
for (const [id, c] of Object.entries(DRIVE)) {
  for (const w of MATCH_WIDTHS) {
    test(`K484-UI-025 ${id} 幅 ${w}：期限を変える小窓の値（箱・すぐ選ぶ・押した日・注・ボタン・誤りの字）がモックと同じ（共通の道具 matchMock・役は DUE_PAIRS）`, async ({
      browser,
    }) => {
      const { rows, bad } = await matchMock(browser, id, w, (p) => c.go(p, w), {
        base: "/dev/mock/f7",
        pairs: DUE_PAIRS,
        blur: true,
        ...(c.skip ? { skip: c.skip } : {}),
      });
      expect(rows.length, "比べた役が 1 つも無い").toBeGreaterThan(1);
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}
