// K-443「画面：親を決める小窓（作る面・詳細・探す・親の期限の注意・写すチェック）」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f4 の f4-parent-dialog・f4-parent-none・f4-parent-limit（下絵・2026-11-20）。
//   口は網の手前で差し替える（作る面は前からの土台 create-mock.ts の mockCreate ＋ tests/k/parent-mock.ts の候補の一覧・
//   詳細は前からの土台 mockApi ＋ parent-mock.ts の setupDetail）。口の形は K-440（updateTicket の親の組・E-TKT-001〜004）・K-92（一覧の口の q）の md と、
//   K-560 が足す口（一覧の行の scope・getTicket の parent）に合わせた。形が変わったら parent-mock.ts だけを直す。
//   作る面は下書きから戻した値（期限・担当者）で開く（期限の入れ方は K-444 で変わるので、この試験は期限の欄に触らない）。
//   置き場所（2026-11-21・新しい形）：作る面は見出しの上の入口 `.k-f4d-parent` と項目の表の「親」の行の 2 か所に同じ値（K-442 の `ParentSlot`）・
//   詳細は右のパネル「関連」の区の「親」の行（K-571 の項目の表の `slots.parent`）。下書きの形は K-442 の新しい形（`sections` は無い）。
//   時計は 2026-11-23（月）10:00（日本時間）に止める。画面は役の名前で出し分けず、口の答えで出し分ける（書けない人は押すと口が 403）。
//   固定の待ちは使わない（要素と答えを待つ・二度押しは答えを止めて見る）。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Page } from "@playwright/test";
import { TICKET } from "../features/F5/approve-complete.harness";
import { ME, MATE, SCOPE, TASK, loaded, mockCreate, openCreate, overflowX, settledDetail } from "./create-mock";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";
import {
  J150,
  PARENT_PAIRS,
  R124,
  R131,
  SERVER_ERROR,
  errReply,
  firstOf,
  msgOf,
  routeParents,
  setupDetail,
  type DetailOptions,
  type ListState,
} from "./parent-mock";

test.use({ timezoneId: "Asia/Tokyo" });

const NOW = "2026-11-23T10:00:00+09:00";
const ENTRY = "親チケットを決める";
const CHIP = "親：EG-124 【親】セイコー様 保守契約の更新";
const NOTE = (due: string) => `親にすると、親の期限（${due}）より後にはできない。親の進みにこの子が数えられる`;
const TITLE = "11 月分の請求書を送る";
/** 親を決める口の断り（控え帳：404・409 は欄なし。画面は 1 つの文を赤い箱に出し、どの欄かは出さない） */
const GONE = "その親は選べなくなりました。選び直してください";
const DEEP = "3 段目のチケットの下には作れません";
const DRAFT_BODY = {
  title: "請求書を送る",
  scope_id: SCOPE,
  kind_id: TASK,
  assignee_member_id: ME,
  due_on: "2026-12-01",
  start_on: "2026-11-30",
  priority: "mid",
  notify_member_ids: [],
};

const dlg = (p: Page) => p.getByRole("dialog", { name: ENTRY, exact: true });
const search = (p: Page) => dlg(p).getByRole("textbox", { name: "番号か題名で探す", exact: true });
const pick = (p: Page, name: RegExp | string) => dlg(p).getByRole("radio", { name });
const decide = (p: Page) => dlg(p).getByRole("button", { name: "親にする", exact: true });
const cancel = (p: Page) => dlg(p).getByRole("button", { name: "やめる", exact: true });
const copyBox = (p: Page) => dlg(p).getByRole("checkbox", { name: "親の担当・節目を写す", exact: true });
/** 作る面の見出しの上の入口と札（`.k-f4d-parent`）。項目の表の「親」の行は rowEntry・rowChip */
const entryBtn = (p: Page) => p.locator(".k-f4d-parent").getByRole("button", { name: ENTRY, exact: true });
const chip = (p: Page) => p.locator(".k-f4d-parent .k-f4-par-chip");
const createRow = (p: Page) =>
  p
    .getByRole("group", { name: "項目", exact: true })
    .locator(".k-f4d-pair")
    .filter({ has: p.locator(".k-f4d-name", { hasText: /^親$/ }) });
const rowEntry = (p: Page) => createRow(p).getByRole("button", { name: ENTRY, exact: true });
const rowChip = (p: Page) => createRow(p).locator(".k-f4-par-chip");
const makeBtn = (p: Page) => p.getByRole("button", { name: "作る", exact: true });
const assignee = (p: Page) => p.getByRole("combobox", { name: "担当者" });
/** 詳細の右のパネルの「親」の行（K-1153 の形：dt が名前の .k-detail-field） */
const panelRow = (p: Page) =>
  p
    .locator('aside[aria-label="チケットのパネル"] .k-detail-field')
    .filter({ has: p.locator("dt", { hasText: /^親$/ }) });

async function createWith(page: Page, body: Record<string, unknown> = {}, width = 1440, prep?: (l: ListState) => void) {
  await page.clock.setFixedTime(NOW);
  const m = await mockCreate(page, {
    drafts: [
      {
        draft_id: "0193c5a0-0000-7000-8000-00000000c4d0",
        body: { ...DRAFT_BODY, ...body },
        saved_at: "2026-11-16T01:42:00Z",
      },
    ],
  });
  const l = await routeParents(page);
  prep?.(l);
  await openCreate(page, width);
  await loaded(page);
  return { m, l };
}
async function openDlg(page: Page, q?: string) {
  await entryBtn(page).click();
  await expect(dlg(page)).toBeVisible();
  if (q !== undefined) await search(page).fill(q);
}
async function detailWith(page: Page, o: DetailOptions = {}, width = 1440) {
  await page.clock.setFixedTime(NOW);
  const r = await setupDetail(page, o);
  await page.setViewportSize({ width, height: width === 375 ? 812 : 1000 });
  const res = await page.goto(`/tickets/${TICKET}`);
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: TITLE })).toBeVisible();
  await expect(page.locator('#k-main [aria-busy="true"]')).toHaveCount(0);
  return r;
}
/** 詳細で小窓を開き、探して 1 つ選ぶ */
async function detailPick(page: Page, q: string, row: RegExp) {
  await panelRow(page).getByRole("button", { name: ENTRY, exact: true }).click();
  await expect(dlg(page)).toBeVisible();
  await search(page).fill(q);
  await pick(page, row).click();
}

// ================================================================ 作る面
test("K443-UI-001 入口：作る面の「親チケットを決める」は見出しの上と項目の表の「親」の行の 2 か所にあり、開く前も開いた直後も一覧の口を呼ばず、押すと小窓（説明・探す欄・やめる・親にする＝押せない）が開く", async ({
  page,
}) => {
  const { l } = await createWith(page);
  await expect(entryBtn(page)).toBeVisible();
  await expect(rowEntry(page)).toBeVisible();
  expect(l.calls).toEqual([]);
  await entryBtn(page).click();
  await expect(dlg(page)).toBeVisible();
  await expect(dlg(page)).toContainText("この子の親になるチケットを選びます");
  await expect(search(page)).toHaveValue("");
  await expect(cancel(page)).toBeEnabled();
  await expect(decide(page)).toBeDisabled();
  await expect(dlg(page).getByRole("radio")).toHaveCount(0);
  expect(l.calls).toEqual([]);
  // 項目の表の「親」の行の入口も、同じ小窓（空の探す欄）を開く
  await cancel(page).click();
  await expect(dlg(page)).toHaveCount(0);
  await rowEntry(page).click();
  await expect(dlg(page)).toBeVisible();
  await expect(search(page)).toHaveValue("");
  expect(l.calls).toEqual([]);
});

test("K443-UI-002 入力：打ち終わってから一覧の口を q・view=all・limit=20 で 1 回だけ引き、候補は番号・題名・グループ・段で出る（打つたびに引かない）", async ({
  page,
}) => {
  const { l } = await createWith(page);
  await openDlg(page);
  await search(page).pressSequentially("保守", { delay: 30 });
  await expect(pick(page, /EG-124/)).toBeVisible();
  await expect.poll(() => l.calls.length).toBe(1);
  expect(l.calls.map((q) => [q.get("q"), q.get("view"), q.get("limit")])).toEqual([["保守", "all", "20"]]);
  const items = dlg(page).getByRole("radio");
  await expect(items).toHaveCount(3);
  await expect(items.nth(0)).toContainText("EG-124");
  await expect(items.nth(0)).toContainText("【親】セイコー様 保守契約の更新");
  await expect(items.nth(0)).toContainText("営業 ・ 作業中");
  await expect(items.nth(1)).toContainText("営業 ・ 完了");
  await expect(items.nth(2)).toContainText("受託開発 ・ 作業中");
});

test("K443-UI-003 入力（表記ゆらぎ・長さ）：全角と前後の空白を入れても候補が出て、口へは前後の空白を除いた字を送る。101 字目からは入らず、口へ送る q は 100 字まで", async ({
  page,
}) => {
  const { l } = await createWith(page);
  await openDlg(page);
  await search(page).fill(" ＥＧ-124 ");
  await expect(pick(page, /^EG-124 /)).toBeVisible();
  expect(l.calls.at(-1)!.get("q")).toBe("ＥＧ-124");
  await search(page).fill("あ".repeat(120));
  expect([...(await search(page).inputValue())].length).toBe(100);
  await expect.poll(() => l.calls.length).toBeGreaterThan(1);
  expect(l.calls.every((q) => [...(q.get("q") ?? "")].length <= 100)).toBe(true);
});

test("K443-UI-004 対象の状態：合うチケットが無いと案内の文が出て「親にする」は押せず、「やめる」で閉じて親なしのまま作れる（親なしで作る口が 1 回）", async ({
  page,
}) => {
  const { m } = await createWith(page);
  await openDlg(page, "請求書 12月");
  await expect(dlg(page).getByRole("status")).toHaveText(
    "「請求書 12月」に合うチケットがありません。番号か題名の一部で探してください。親を決めずに作ることもできます",
  );
  await expect(dlg(page).getByRole("radio")).toHaveCount(0);
  await expect(decide(page)).toBeDisabled();
  await cancel(page).click();
  await expect(dlg(page)).toHaveCount(0);
  await expect(chip(page)).toHaveCount(0);
  await makeBtn(page).click();
  await expect.poll(() => m.creates.length).toBe(1);
  expect(m.creates[0]!["parent_ticket_id"] ?? null).toBeNull();
  await settledDetail(page);
});

test("K443-UI-005 守り：3 段目のチケットは選べない（押せない・理由が出る）。選べる 2 段目を選ぶと「親にする」が押せる", async ({
  page,
}) => {
  await createWith(page);
  await openDlg(page, "請求");
  const deep = pick(page, /EG-141/);
  await expect(deep).toHaveAttribute("aria-disabled", "true");
  await expect(deep).toContainText("3 段目のチケットの下には作れません");
  await expect(pick(page, /EG-131/)).toContainText("2 段目");
  await deep.click({ force: true });
  await expect(deep).toHaveAttribute("aria-checked", "false");
  await expect(decide(page)).toBeDisabled();
  await pick(page, /EG-131/).click();
  await expect(pick(page, /EG-131/)).toHaveAttribute("aria-checked", "true");
  await expect(dlg(page)).toContainText(NOTE("12/10（木）"));
  await expect(decide(page)).toBeEnabled();
});

test("K443-UI-006 入力：選ぶと親の期限の注意と「写す」チェック（既定は入っている）が出る。この子の期限が親より後なら注意の箱が出て、親より前なら出ない", async ({
  page,
}) => {
  await createWith(page);
  await openDlg(page, "保守");
  await pick(page, /EG-124/).click();
  await expect(dlg(page)).toContainText(NOTE("11/30（月）"));
  await expect(dlg(page).locator(".k-callout")).toHaveText(
    "この子の期限（12/01（火））が親の期限（11/30（月））より後です。親にしたあと、期限を 11/30 までに直してください",
  );
  await expect(copyBox(page)).toBeChecked();
  await pick(page, /JD-150/).click();
  await expect(dlg(page)).toContainText(NOTE("12/20（日）"));
  await expect(dlg(page).locator(".k-callout")).toHaveCount(0);
  await expect(decide(page)).toBeEnabled();
});

test("K443-UI-007 入力：「写す」が入ったまま「親にする」を押すと、札に番号と題名が 2 か所（見出しの上・項目の表の行）に出て担当者が親の担当者（山田）になり、作る口へ親と担当者が届く", async ({
  page,
}) => {
  const { m } = await createWith(page);
  await expect(assignee(page)).toContainText("高本");
  await openDlg(page, "保守");
  await pick(page, /EG-124/).click();
  await decide(page).click();
  await expect(dlg(page)).toHaveCount(0);
  await expect(chip(page)).toContainText(CHIP);
  await expect(rowChip(page)).toContainText(CHIP);
  await expect(assignee(page)).toContainText("山田");
  await makeBtn(page).click();
  await expect.poll(() => m.creates.length).toBe(1);
  expect(m.creates[0]!["parent_ticket_id"]).toBe(R124.id);
  expect(m.creates[0]!["assignee_member_id"]).toBe(MATE);
  await settledDetail(page);
});

test("K443-UI-008 入力：「写す」を外して「親にする」を押すと、担当者はそのまま（高本）。親には担当者がいないとき「写す」が入っていても担当者は変わらない", async ({
  page,
}) => {
  const { m } = await createWith(page);
  await openDlg(page, "保守");
  await pick(page, /EG-124/).click();
  await copyBox(page).uncheck();
  await decide(page).click();
  await expect(chip(page)).toContainText(CHIP);
  await expect(assignee(page)).toContainText("高本");
  // 担当者のいない親（EG-131）では、写すが入っていても担当者は変わらない
  await chip(page).getByRole("button", { name: "親を外す", exact: true }).click();
  await openDlg(page, "請求");
  await pick(page, /EG-131/).click();
  await expect(copyBox(page)).toBeChecked();
  await decide(page).click();
  await expect(chip(page)).toContainText("親：EG-131");
  await expect(assignee(page)).toContainText("高本");
  await makeBtn(page).click();
  await expect.poll(() => m.creates.length).toBe(1);
  expect(m.creates[0]!["parent_ticket_id"]).toBe(R131.id);
  expect(m.creates[0]!["assignee_member_id"]).toBe(ME);
  await settledDetail(page);
});

test("K443-UI-009 入力：決めた親を項目の表の行の「親を外す」で外すと、札が 2 か所とも消えて「親チケットを決める」が戻り、作る口へ親は届かない", async ({
  page,
}) => {
  const { m } = await createWith(page);
  await openDlg(page, "保守");
  await pick(page, /EG-124/).click();
  await decide(page).click();
  await expect(chip(page)).toContainText(CHIP);
  await expect(rowChip(page)).toContainText(CHIP);
  await rowChip(page).getByRole("button", { name: "親を外す", exact: true }).click();
  await expect(chip(page)).toHaveCount(0);
  await expect(rowChip(page)).toHaveCount(0);
  await expect(entryBtn(page)).toBeVisible();
  await expect(rowEntry(page)).toBeVisible();
  await makeBtn(page).click();
  await expect.poll(() => m.creates.length).toBe(1);
  expect(m.creates[0]!["parent_ticket_id"] ?? null).toBeNull();
  await settledDetail(page);
});

test("K443-UI-010 失敗：候補を読む口が落ちると小窓の中に「候補を読み込めませんでした」が出て選べず、打ち直すと直った口から読める。親なしで作れる", async ({
  page,
}) => {
  const { m, l } = await createWith(page);
  l.status = 500;
  await openDlg(page, "保守");
  await expect(dlg(page).getByText("候補を読み込めませんでした", { exact: true })).toBeVisible();
  await expect(dlg(page).getByRole("radio")).toHaveCount(0);
  await expect(decide(page)).toBeDisabled();
  l.status = 200;
  await search(page).fill("保守契約");
  await expect(pick(page, /EG-124/)).toBeVisible();
  await expect(dlg(page).getByText("候補を読み込めませんでした", { exact: true })).toHaveCount(0);
  await cancel(page).click();
  await makeBtn(page).click();
  await expect.poll(() => m.creates.length).toBe(1);
  expect(m.creates[0]!["parent_ticket_id"] ?? null).toBeNull();
  await settledDetail(page);
});

test("K443-UI-011 失敗：作る口が親を断ると（409・E-VAL-015・欄なし）、欄を特定できないので正本の文が作る面の赤い箱（問題の箱）に 1 つ出て、札と書いた中身は残り、作れない", async ({
  page,
}) => {
  const { m } = await createWith(page);
  await page.route(/\/api\/v1\/tickets$/, (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify(errReply(409, "E-VAL-015").body),
        })
      : route.fallback(),
  );
  await openDlg(page, "請求");
  await pick(page, /EG-131/).click();
  await decide(page).click();
  await makeBtn(page).click();
  await expect(page.getByText(firstOf("E-VAL-015")).first()).toBeVisible();
  await expect(chip(page)).toContainText("親：EG-131");
  await expect(page.getByRole("textbox", { name: "題名", exact: true })).toHaveValue("請求書を送る");
  expect(m.creates).toEqual([]);
});

test("K443-UI-012 入口：キーボードで開き（Enter）、探す欄に焦点が行き、Esc で閉じて焦点が「親チケットを決める」に戻る。「やめる」でも閉じて、口は呼ばない", async ({
  page,
}) => {
  const { l } = await createWith(page);
  await entryBtn(page).focus();
  await page.keyboard.press("Enter");
  await expect(dlg(page)).toBeVisible();
  await expect(search(page)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dlg(page)).toHaveCount(0);
  await expect(entryBtn(page)).toBeFocused();
  await openDlg(page);
  await cancel(page).click();
  await expect(dlg(page)).toHaveCount(0);
  await expect(chip(page)).toHaveCount(0);
  expect(l.calls).toEqual([]);
});

test("K443-UI-013 入口：下書きから戻した親は番号と題名の札で 2 か所に出る（候補の詳細を 1 回だけ読む）。決めた親は下書きに残り、再読み込みで札に戻る", async ({
  page,
}) => {
  const { m, l } = await createWith(page, { parent_ticket_id: J150.id });
  await expect(chip(page)).toContainText("親：JD-150 京蟻 保守運用（年間）");
  await expect(rowChip(page)).toContainText("親：JD-150 京蟻 保守運用（年間）");
  expect(l.reads).toBe(1);
  await chip(page).getByRole("button", { name: "親を外す", exact: true }).click();
  await openDlg(page, "保守");
  await pick(page, /EG-124/).click();
  await decide(page).click();
  await expect(chip(page)).toContainText(CHIP);
  await expect
    .poll(() => m.draftSaves.some((b) => (b["body"] as Record<string, unknown>)["parent_ticket_id"] === R124.id))
    .toBe(true);
  await page.reload();
  await loaded(page);
  await expect(chip(page)).toContainText(CHIP);
});

// ================================================================ 詳細
test("K443-UI-014 入口：詳細の右のパネルの「親」の行は、親が無ければ「親チケットを決める」、親が有れば札と「親を外す」。詳細を開く口は getTicket 1 回だけ（候補の一覧も親の詳細も読まない）", async ({
  page,
}) => {
  const a = await detailWith(page);
  await expect(panelRow(page).getByRole("button", { name: ENTRY, exact: true })).toBeVisible();
  await expect(panelRow(page).locator(".k-f4-par-chip")).toHaveCount(0);
  expect(a.p.ticketReads).toBe(1);
  expect(a.l.calls).toEqual([]);
  expect(a.l.reads).toBe(0);
});

test("K443-UI-015 入口：親が有る詳細では、行に札「親：EG-124 …」と「親を外す」が出て、口の数は同じ（getTicket 1 回・一覧 0・親の詳細 0）", async ({
  page,
}) => {
  const a = await detailWith(page, { parent: R124 });
  await expect(panelRow(page).locator(".k-f4-par-chip")).toContainText(CHIP);
  await expect(panelRow(page).getByRole("button", { name: "親を外す", exact: true })).toBeVisible();
  expect(a.p.ticketReads).toBe(1);
  expect(a.l.calls).toEqual([]);
  expect(a.l.reads).toBe(0);
});

test("K443-UI-016 入力：詳細で決める：小窓には「写す」が無く、探して選んで「親にする」を押すと updateTicket が 1 回（親だけ・Idempotency-Key つき）、小窓が閉じ、読み直した getTicket の親が行に出る", async ({
  page,
}) => {
  const a = await detailWith(page);
  await detailPick(page, "保守", /JD-150/);
  await expect(copyBox(page)).toHaveCount(0);
  await expect(dlg(page)).toContainText(NOTE("12/20（日）"));
  await decide(page).click();
  await expect(dlg(page)).toHaveCount(0);
  expect(a.p.patches).toHaveLength(1);
  expect(a.p.patches[0]!.body).toEqual({ parent_ticket_id: J150.id });
  expect(a.p.patches[0]!.key).toBeTruthy();
  await expect.poll(() => a.p.ticketReads).toBe(2);
  await expect(panelRow(page).locator(".k-f4-par-chip")).toContainText("親：JD-150 京蟻 保守運用（年間）");
  await expect(panelRow(page).getByRole("button", { name: ENTRY, exact: true })).toHaveCount(0);
});

test("K443-UI-017 入力：詳細で「親を外す」を押すと updateTicket が 1 回（親を null で）届き、行が「親チケットを決める」に戻る", async ({
  page,
}) => {
  const a = await detailWith(page, { parent: R124 });
  await panelRow(page).getByRole("button", { name: "親を外す", exact: true }).click();
  await expect.poll(() => a.p.patches.length).toBe(1);
  expect(a.p.patches[0]!.body).toEqual({ parent_ticket_id: null });
  await expect(panelRow(page).getByRole("button", { name: ENTRY, exact: true })).toBeVisible();
  await expect(panelRow(page).locator(".k-f4-par-chip")).toHaveCount(0);
});

test("K443-UI-018 入力：親を変える：札を押して小窓を開き、別の親（JD-150）を選んで「親にする」を押すと updateTicket は 1 回で、新しい親だけを送る", async ({
  page,
}) => {
  const a = await detailWith(page, { parent: R124 });
  await panelRow(page).getByRole("button", { name: CHIP, exact: true }).click();
  await expect(dlg(page)).toBeVisible();
  await search(page).fill("保守");
  await pick(page, /JD-150/).click();
  await decide(page).click();
  await expect(dlg(page)).toHaveCount(0);
  expect(a.p.patches).toHaveLength(1);
  expect(a.p.patches[0]!.body).toEqual({ parent_ticket_id: J150.id });
  await expect(panelRow(page).locator(".k-f4-par-chip")).toContainText("親：JD-150");
});

test("K443-UI-019 守り：詳細で、この子の期限（11/27）が親の期限（10/31）より後の候補を選ぶと注意が出て「親にする」は押せず、口へは送らない", async ({
  page,
}) => {
  const a = await detailWith(page);
  await detailPick(page, "保守", /EG-097/);
  await expect(dlg(page).locator(".k-callout")).toHaveText(
    "この子の期限（11/27（金））が親の期限（10/31（土））より後です。先に期限を 10/31 までに直してから、親にしてください",
  );
  await expect(decide(page)).toBeDisabled();
  expect(a.p.patches).toEqual([]);
  await pick(page, /EG-124/).click();
  await expect(dlg(page).locator(".k-callout")).toHaveCount(0);
  await expect(decide(page)).toBeEnabled();
});

test("K443-UI-020 失敗：口が親にできない（409・欄なし）と答えると、1 つの文が小窓の上の赤い箱に出る（E-TKT-001・002・004 は正本の文・E-TKT-003 は「3 段目のチケットの下には作れません」）。小窓は開いたまま・探した字も選んだ候補も残り、親は変わらない", async ({
  page,
}) => {
  const a = await detailWith(page);
  for (const code of ["E-TKT-001", "E-TKT-002", "E-TKT-003", "E-TKT-004"]) {
    a.p.on.patch = () => errReply(409, code);
    await detailPick(page, "保守", /EG-124/);
    const before = a.p.patches.length;
    await decide(page).click();
    await expect(dlg(page).getByRole("alert")).toHaveText(code === "E-TKT-003" ? DEEP : msgOf(code));
    expect(a.p.patches.length).toBe(before + 1);
    await expect(search(page)).toHaveValue("保守");
    await expect(pick(page, /EG-124/)).toHaveAttribute("aria-checked", "true");
    await expect(panelRow(page).locator(".k-f4-par-chip")).toHaveCount(0);
    await cancel(page).click();
    await expect(dlg(page)).toHaveCount(0);
  }
});

test("K443-UI-021 利用者の状態：書けない人の「親にする」は口が 403 で止め（ページ共通の権限の文の 1 文目）、選んだ親が消された・見えない（404・E-PAGE-001・欄なし）ときは「その親は選べなくなりました。選び直してください」が箱に出る。どちらも親は変わらない", async ({
  page,
}) => {
  const a = await detailWith(page);
  a.p.on.patch = () => ({ status: 403, body: { error: "forbidden", code: "FORBIDDEN" } });
  await detailPick(page, "保守", /EG-124/);
  await decide(page).click();
  await expect(dlg(page).getByRole("alert")).toHaveText(firstOf("E-PAGE-002"));
  await expect(panelRow(page).locator(".k-f4-par-chip")).toHaveCount(0);
  a.p.on.patch = () => errReply(404, "E-PAGE-001");
  await decide(page).click();
  await expect(dlg(page).getByRole("alert")).toHaveText(GONE);
  await expect(search(page)).toHaveValue("保守");
  await expect(panelRow(page).locator(".k-f4-par-chip")).toHaveCount(0);
});

test("K443-UI-022 失敗：口が 500 だと小窓の上の箱にページ共通の「読み込めませんでした」の 1 文目。押し直すと同じ Idempotency-Key で 2 回目を送り、通ると小窓が閉じる", async ({
  page,
}) => {
  const a = await detailWith(page);
  let n = 0;
  a.p.on.patch = (req) => (++n === 1 ? SERVER_ERROR : a.p.ok(req));
  await detailPick(page, "保守", /EG-124/);
  await decide(page).click();
  await expect(dlg(page).getByRole("alert")).toHaveText(firstOf("E-PAGE-007"));
  await expect(search(page)).toHaveValue("保守");
  await decide(page).click();
  await expect(dlg(page)).toHaveCount(0);
  expect(a.p.patches).toHaveLength(2);
  expect(a.p.patches[1]!.key).toBe(a.p.patches[0]!.key);
  await expect(panelRow(page).locator(".k-f4-par-chip")).toContainText(CHIP);
});

test("K443-UI-023 操作の揺れ：答えを止めた間に「親にする」を押し直しても口へは 1 回だけ届き（押せない形になる）、答えると小窓が閉じる", async ({
  page,
}) => {
  const a = await detailWith(page);
  const release = a.p.hold();
  await detailPick(page, "保守", /EG-124/);
  await decide(page).click();
  await expect.poll(() => a.p.patches.length).toBe(1);
  await expect(decide(page)).toBeDisabled();
  await decide(page).click({ force: true });
  expect(a.p.patches).toHaveLength(1);
  release();
  await expect(dlg(page)).toHaveCount(0);
  expect(a.p.patches).toHaveLength(1);
});

test("K443-UI-024 入力：幅 1440・768・375 のどれでも、作る面と詳細の小窓を開いても横溢れ 0 で、小窓は画面の中（左右の端と足のボタンが画面の内側）", async ({
  page,
}) => {
  await createWith(page);
  await openDlg(page, "保守");
  await pick(page, /EG-124/).click();
  const inside = async (w: number) => {
    const vh = page.viewportSize()!.height;
    const b = (await dlg(page).boundingBox())!;
    expect(b.x, `幅 ${w} の小窓の左`).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width, `幅 ${w} の小窓の右`).toBeLessThanOrEqual(w);
    const d = (await decide(page).boundingBox())!;
    expect(d.y + d.height, `幅 ${w} の足のボタン`).toBeLessThanOrEqual(vh);
    expect(await overflowX(page), `幅 ${w} の横溢れ`).toBe(0);
  };
  for (const w of [1440, 768, 375]) {
    await page.setViewportSize({ width: w, height: w === 375 ? 812 : 900 });
    await inside(w);
  }
  await cancel(page).click();
});

test("K443-UI-025 入力：詳細の小窓も幅 1440・768・375 で横溢れ 0・小窓は画面の中", async ({ page }) => {
  await detailWith(page);
  await detailPick(page, "保守", /EG-124/);
  for (const w of [1440, 768, 375]) {
    await page.setViewportSize({ width: w, height: w === 375 ? 812 : 900 });
    const vh = page.viewportSize()!.height;
    const b = (await dlg(page).boundingBox())!;
    expect(b.x, `幅 ${w} の小窓の左`).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width, `幅 ${w} の小窓の右`).toBeLessThanOrEqual(w);
    const d = (await decide(page).boundingBox())!;
    expect(d.y + d.height, `幅 ${w} の足のボタン`).toBeLessThanOrEqual(vh);
    expect(await overflowX(page), `幅 ${w} の横溢れ`).toBe(0);
  }
});

test("K443-UI-027 入口：見えない親（getTicket の parent が番号だけ・visible false）の詳細では、札は番号だけ「親：EG-124」（題名の字も null も出ない）で、「親を外す」と札を押して変えるが使える（変えるは新しい親を 1 回・外すは null を 1 回）", async ({
  page,
}) => {
  const a = await detailWith(page, { parent: R124, hidden: true });
  const chipBtn = panelRow(page).getByRole("button", { name: "親：EG-124", exact: true });
  await expect(chipBtn).toBeVisible();
  await expect(panelRow(page).locator(".k-f4-par-chip")).not.toContainText("【親】");
  await expect(panelRow(page).locator(".k-f4-par-chip")).not.toContainText("null");
  await expect(panelRow(page).getByRole("button", { name: "親を外す", exact: true })).toBeEnabled();
  await chipBtn.click();
  await expect(dlg(page)).toBeVisible();
  await search(page).fill("保守");
  await pick(page, /JD-150/).click();
  await decide(page).click();
  await expect(dlg(page)).toHaveCount(0);
  expect(a.p.patches).toHaveLength(1);
  expect(a.p.patches[0]!.body).toEqual({ parent_ticket_id: J150.id });
  await expect(panelRow(page).locator(".k-f4-par-chip")).toContainText("親：JD-150 京蟻 保守運用（年間）");
  await panelRow(page).getByRole("button", { name: "親を外す", exact: true }).click();
  await expect.poll(() => a.p.patches.length).toBe(2);
  expect(a.p.patches[1]!.body).toEqual({ parent_ticket_id: null });
});

test("K443-UI-028 失敗：詳細の「親を外す」は小窓を開かないので、口が断ったときは小さな知らせ（5 秒で消える）で出す。500 はページ共通の「読み込めませんでした。」・403 は権限の文の 1 文目・404（E-PAGE-001）は正本の文。札は残り、親は変わらない", async ({
  page,
}) => {
  const a = await detailWith(page, { parent: R124 });
  const out = panelRow(page).getByRole("button", { name: "親を外す", exact: true });
  a.p.on.patch = () => SERVER_ERROR;
  await out.click();
  await expect(page.getByText(firstOf("E-PAGE-007"), { exact: true })).toBeVisible();
  await expect(panelRow(page).locator(".k-f4-par-chip")).toContainText(CHIP);
  a.p.on.patch = () => ({ status: 403, body: { error: "forbidden", code: "FORBIDDEN" } });
  await out.click();
  await expect(page.getByText(firstOf("E-PAGE-002"), { exact: true })).toBeVisible();
  a.p.on.patch = () => errReply(404, "E-PAGE-001");
  await out.click();
  await expect(page.getByText(msgOf("E-PAGE-001"), { exact: true })).toBeVisible();
  await expect(panelRow(page).locator(".k-f4-par-chip")).toContainText(CHIP);
  expect(a.p.patches).toHaveLength(3);
  expect(a.p.ticketReads).toBe(1);
});

test("K443-UI-029 操作の揺れ：答えを止めた間に「親を外す」を押し直しても口へは 1 回だけ届き（押せない形になる）、答えると札が消えて「親チケットを決める」が戻る", async ({
  page,
}) => {
  const a = await detailWith(page, { parent: R124 });
  const out = panelRow(page).getByRole("button", { name: "親を外す", exact: true });
  const release = a.p.hold();
  await out.click();
  await expect.poll(() => a.p.patches.length).toBe(1);
  await expect(out).toBeDisabled();
  await out.click({ force: true });
  expect(a.p.patches).toHaveLength(1);
  release();
  await expect(panelRow(page).getByRole("button", { name: ENTRY, exact: true })).toBeVisible();
  expect(a.p.patches).toHaveLength(1);
  expect(a.p.patches[0]!.body).toEqual({ parent_ticket_id: null });
});

test("K443-UI-030 失敗：下書きから戻した親が読めない（親が消えた・見えない・口が落ちた）と、札は「親を読み込めませんでした」で「親を外す」が使える。外すと「親チケットを決める」が戻り、作ると親は届かない", async ({
  page,
}) => {
  const { m } = await createWith(page, { parent_ticket_id: J150.id }, 1440, (l) => {
    l.readStatus = 404;
  });
  await expect(chip(page)).toHaveText("親を読み込めませんでした");
  await chip(page).getByRole("button", { name: "親を外す", exact: true }).click();
  await expect(chip(page)).toHaveCount(0);
  await expect(entryBtn(page)).toBeVisible();
  await makeBtn(page).click();
  await expect.poll(() => m.creates.length).toBe(1);
  expect(m.creates[0]!["parent_ticket_id"] ?? null).toBeNull();
  await settledDetail(page);
});

// ================================================================ モックとの突き合わせ（共通の道具 matchMock・base は /dev/mock/f4）
const STATES: Record<string, { q: string; row?: RegExp }> = {
  "f4-parent-dialog": { q: "保守", row: /EG-124/ },
  "f4-parent-none": { q: "請求書 12月" },
  "f4-parent-limit": { q: "請求", row: /EG-131/ },
};
for (const [id, s] of Object.entries(STATES)) {
  for (const w of MATCH_WIDTHS) {
    test(`K443-UI-026 ${id} 幅 ${w}：小窓（箱・題・探す欄・候補・理由・案内・注意・チェック・ボタン）の値がモックと同じ`, async ({
      browser,
    }) => {
      const { rows, bad } = await matchMock(
        browser,
        id,
        w,
        async (page) => {
          await createWith(page, {}, w);
          await openDlg(page, s.q);
          if (s.row) await pick(page, s.row).click();
          else await expect(dlg(page).getByRole("status")).toBeVisible();
          await page.evaluate(() => {
            window.scrollTo(0, 0);
            document.querySelectorAll(".k-dialog-body").forEach((e) => {
              e.scrollTop = 0;
            });
          });
        },
        { pairs: PARENT_PAIRS, base: "/dev/mock/f4", blur: true },
      );
      expect(new Set(rows.map((r) => r.part)), "小窓の役で比べた").toContain("title");
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}
