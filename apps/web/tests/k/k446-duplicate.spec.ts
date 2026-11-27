// K-446「画面：複製（詳細の複製の小窓・作る面の「過去のチケットから複製」の元を選ぶ小窓）」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f4 の f4-dup-pick・f4-dup-dialog・f4-dup-error（下絵・2026-11-20。写す物の見本は 2026-11-21 に D-150.6 の新しい並びへ：本文・担当者と承認する人・項目・確認項目・つながり・子チケット）。
//   口は網の手前で差し替える（作る面は前からの土台 create-mock.ts の mockCreate・詳細は前からの土台 mockApi ＋ tests/k/duplicate-mock.ts）。
//   口の形は K-438（createTicket の duplicate_of・copy[]〔body・assignee・fields・specs・links・children〕・E-DUP-001・002）の md と、K-560 が足す口（一覧の行の scope・getTicket の child_count）に合わせた。
//   形が変わったら duplicate-mock.ts だけを直す。時計は 2026-11-23（月）10:00（日本時間）に止める。
//   作る面の「過去のチケットから複製」は、元を選んだら詳細と同じ「複製する」小窓（写す物を選ぶ）を開き、「複製して開く」で作った詳細へ移る（作った後の着地は K-60 と同じ）。
//   複製の小窓は詳細の「複製」ボタン（K-571 の題の行の入れ物 DuplicateEntry）からも・外（K-458 の「…」のメニュー）からも開ける（開く・閉じるを props で受ける）。この試験はボタンと作る面の入口を見る。
//   画面は役の名前で出し分けず、口の答えで出し分ける（書けない人は押すと口が 403）。
//   固定の待ちは使わない（要素と答えを待つ・二度押しは答えを止めて見る）。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Locator, type Page } from "@playwright/test";
import { TICKET } from "../features/F5/approve-complete.harness";
import { BOSS, ME, SCOPE, TASK, loaded, mockCreate, openCreate, overflowX, settledDetail } from "./create-mock";
import {
  D128,
  DUP_PAIRS,
  FAILED_TEXT,
  NUMBER,
  SERVER_ERROR,
  TITLE,
  errReply,
  firstOf,
  msgOf,
  routeCreate,
  routeSources,
  setupDetail,
  type DetailOptions,
} from "./duplicate-mock";
import { countWrites } from "./kit";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";

test.use({ timezoneId: "Asia/Tokyo" });

const NOW = "2026-11-23T10:00:00+09:00";
const ENTRY = "過去のチケットから複製";
/** 複製の元が無い・見えない（K-438：404 E-DUP-001・欄なし）と、元の詳細が読めない（入口の 404）のときの 1 つの文 */
const SRC_GONE = "元のチケットが見つかりません";
/** 口の copy の名前（K-438）。小窓の並び（本文・担当者・承認する人・項目・確認項目・つながり・子チケット）と 1 対 1。添付は無い */
const ALL = ["body", "assignee", "fields", "specs", "links", "children"];
/** 小窓の「写すもの」の字（下絵 f4-dup-dialog の COPIES）。子チケットは元の子の数で字が変わる */
const LABELS = ["本文", "担当者・承認する人", "項目（期限・優先度・会社の項目）", "確認項目", "つながり"] as const;
const KIDS = (n: number): string => `子チケット（${n} 件）`;

const dupBtn = (p: Page) => p.getByRole("button", { name: "複製", exact: true });
const dlg = (p: Page) => p.getByRole("dialog", { name: "複製する", exact: true });
const pickDlg = (p: Page) => p.getByRole("dialog", { name: ENTRY, exact: true });
const dateDlg = (p: Page) => p.getByRole("dialog", { name: "期限を決める", exact: true });
const entryBtn = (p: Page) => p.getByRole("button", { name: ENTRY, exact: true });
const go = (p: Page) => dlg(p).getByRole("button", { name: "複製して開く", exact: true });
const cancel = (d: Locator) => d.getByRole("button", { name: "やめる", exact: true });
const titleBox = (p: Page) => dlg(p).getByRole("textbox", { name: "題名", exact: true });
const dueBtn = (p: Page) => dlg(p).locator(".k-f4-dup-due");
const check = (p: Page, name: string) => dlg(p).getByRole("checkbox", { name, exact: true });
const search = (p: Page) => pickDlg(p).getByRole("textbox", { name: "番号か題名で探す", exact: true });
const pickItem = (p: Page, re: RegExp) => pickDlg(p).getByRole("radio", { name: re });
const fromHere = (p: Page) => pickDlg(p).getByRole("button", { name: "この元から作る", exact: true });
const alertOf = (p: Page) => dlg(p).getByRole("alert");

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
async function openDup(page: Page) {
  await dupBtn(page).click();
  await expect(dlg(page)).toBeVisible();
}
async function createWith(page: Page, width = 1440) {
  await page.clock.setFixedTime(NOW);
  const m = await mockCreate(page, {});
  const s = await routeSources(page);
  const p = await routeCreate(page);
  await openCreate(page, width);
  await loaded(page);
  return { m, s, p };
}
async function openPick(page: Page, q?: string) {
  await entryBtn(page).click();
  await expect(pickDlg(page)).toBeVisible();
  if (q !== undefined) await search(page).fill(q);
}
const full = (o: Record<string, unknown> = {}) => ({
  scope_id: SCOPE,
  kind_id: TASK,
  title: TITLE,
  // 担当者・承認する人を写すときは元の担当者（佐藤）・外したときは複製した本人（見ている人＝高本）を送る
  assignee_member_id: BOSS,
  due_on: "2026-11-27",
  duplicate_of: TICKET,
  copy: ALL,
  ...o,
});

// ================================================================ 詳細の複製
test("K446-UI-001 入口：詳細の「複製」は押せて、押すと小窓「複製する」（頭の対象の行は「EG-119 から新しいチケットを作る」・やめる・複製して開く）が開く。開いても口は増えない", async ({
  page,
}) => {
  const a = await detailWith(page);
  const writes = countWrites(page);
  await expect(dupBtn(page)).not.toHaveAttribute("aria-disabled", "true");
  expect(a.d.ticketReads).toBe(1);
  await openDup(page);
  await expect(dlg(page)).toContainText(`${NUMBER} から新しいチケットを作る`);
  await expect(cancel(dlg(page))).toBeEnabled();
  await expect(go(page)).toBeEnabled();
  expect(a.d.ticketReads).toBe(1);
  expect(writes.n).toBe(0);
  expect(a.d.post.posts).toEqual([]);
});

test("K446-UI-002 入力：小窓の中身は、題名（元のまま・「元の題名のままです。直せます」）・グループ（営業（EG））・期限（元のまま 11/27（金））・写すもの（本文・担当者・承認する人・項目・確認項目・つながり・子チケット（2 件）が入り、添付は押せない形で外れている）・写さないもの", async ({
  page,
}) => {
  await detailWith(page);
  await openDup(page);
  await expect(titleBox(page)).toHaveValue(TITLE);
  await expect(dlg(page)).toContainText("元の題名のままです。直せます");
  await expect(dlg(page).getByRole("combobox", { name: "グループ" })).toContainText("営業（EG）");
  await expect(dueBtn(page)).toContainText("11/27（金）");
  for (const n of [...LABELS, KIDS(2)]) await expect(check(page, n)).toBeChecked();
  await expect(dlg(page).locator(".k-f4-dup-row").filter({ hasText: "本文" }).first()).toContainText(
    "本文の中のチェックの箱は外して写します。日付や金額は、写したあとで直してください",
  );
  await expect(dlg(page).locator(".k-f4-dup-row").filter({ hasText: "確認項目" })).toContainText(
    "チェックは外して写します",
  );
  const files = check(page, "添付");
  await expect(files).not.toBeChecked();
  await expect(files).toBeDisabled();
  await expect(dlg(page).locator(".k-f4-dup-row[aria-disabled='true']")).toHaveAttribute("title", "まだ使えません");
  await expect(dlg(page)).toContainText("やり取りと記録は写さず、元のチケットへのつながりだけ残します");
});

test("K446-UI-003 入力：既定のまま「複製して開く」を押すと createTicket が 1 回（体はちょうど 元の scope・kind・題名・担当者・期限・duplicate_of と copy の 6 つの名前。開始日・優先度・本文は送らない・Idempotency-Key あり）。小窓が閉じ、作った詳細へ移る", async ({
  page,
}) => {
  const a = await detailWith(page);
  await openDup(page);
  await go(page).click();
  await settledDetail(page);
  expect(a.d.post.posts).toHaveLength(1);
  expect(a.d.post.posts[0]!.body).toEqual(full());
  expect(a.d.post.posts[0]!.key).toBeTruthy();
});

test("K446-UI-004 入力：写すもののチェックを外すと copy から外れる（名前の並びは本文・担当者・項目・確認項目・つながり・子の順）。全部外すと空の並び。入れ直した確認項目と本文は決まった順で送る。添付は送らない", async ({
  page,
}) => {
  const a = await detailWith(page);
  let n = 0;
  a.d.post.on.create = () => (++n === 1 ? SERVER_ERROR : a.d.post.ok());
  await openDup(page);
  for (const name of [...LABELS, KIDS(2)]) await check(page, name).uncheck();
  await go(page).click();
  await expect(alertOf(page)).toBeVisible();
  expect(a.d.post.posts[0]!.body["copy"]).toEqual([]);
  expect(a.d.post.posts[0]!.body["assignee_member_id"]).toBe(ME);
  await check(page, "確認項目").check();
  await check(page, "本文").check();
  await go(page).click();
  await settledDetail(page);
  expect(a.d.post.posts).toHaveLength(2);
  expect(a.d.post.posts[1]!.body["copy"]).toEqual(["body", "specs"]);
  expect(a.d.post.posts[1]!.body["assignee_member_id"]).toBe(ME);
  expect(a.d.post.posts[1]!.body["copy"]).not.toContain("attachments");
});

test("K446-UI-005 入力：題名を直した字で送る。空（空白だけも）にすると口へ送らず題名の下に「題名を入れてください」・201 字は「題名は 200 文字までです」（欄は aria-invalid）", async ({
  page,
}) => {
  const a = await detailWith(page);
  await openDup(page);
  await titleBox(page).fill("   ");
  await go(page).click();
  await expect(dlg(page).getByText("題名を入れてください", { exact: true })).toBeVisible();
  await expect(titleBox(page)).toHaveAttribute("aria-invalid", "true");
  await titleBox(page).fill("あ".repeat(201));
  await go(page).click();
  await expect(dlg(page).getByText("題名は 200 文字までです", { exact: true })).toBeVisible();
  expect(a.d.post.posts).toEqual([]);
  await titleBox(page).fill("12 月分の請求書を送る");
  await go(page).click();
  await settledDetail(page);
  expect(a.d.post.posts).toHaveLength(1);
  expect(a.d.post.posts[0]!.body["title"]).toBe("12 月分の請求書を送る");
});

test("K446-UI-006 時間の流れ：元の期限が過去（11/01）だと、小窓を開いた時点で期限の下に正本の理由が出て、「複製して開く」は口へ送らない。期限を押して日付の小窓で 12/01 を選ぶと理由が消え、その日で送れる", async ({
  page,
}) => {
  const a = await detailWith(page, { due_on: "2026-11-01" });
  await openDup(page);
  await expect(dueBtn(page)).toContainText("11/01（日）");
  await expect(dlg(page).getByText(msgOf("E-VAL-012"), { exact: true })).toBeVisible();
  await go(page).click();
  expect(a.d.post.posts).toEqual([]);
  await dueBtn(page).click();
  await expect(dateDlg(page)).toBeVisible();
  await dateDlg(page).getByRole("button", { name: "次の月", exact: true }).click();
  await dateDlg(page).getByRole("button", { name: "12月1日（火）", exact: true }).click();
  await dateDlg(page).getByRole("button", { name: "12/01 にする", exact: true }).click();
  await expect(dateDlg(page)).toHaveCount(0);
  await expect(dueBtn(page)).toContainText("12/01（火）");
  await expect(dlg(page).getByText(msgOf("E-VAL-012"), { exact: true })).toHaveCount(0);
  await go(page).click();
  await settledDetail(page);
  expect(a.d.post.posts).toHaveLength(1);
  expect(a.d.post.posts[0]!.body["due_on"]).toBe("2026-12-01");
});

test("K446-UI-027 失敗：小窓を開いたまま日が替わり、口が期限を断る（409・E-VAL-012・欄なし）と、画面が code で決めて正本の理由を期限の欄の下に出す（小窓の上の赤い箱は出ない・K-431・K-444 と同じ出し方）。欄は aria-invalid・書いた題名と外したチェックは残る。期限を選び直して押し直すと作れる", async ({
  page,
}) => {
  const a = await detailWith(page);
  let n = 0;
  a.d.post.on.create = () => (++n === 1 ? errReply(409, "E-VAL-012") : a.d.post.ok());
  await openDup(page);
  await titleBox(page).fill("12 月分の請求書を送る");
  await check(page, "確認項目").uncheck();
  await go(page).click();
  await expect(dlg(page).getByText(msgOf("E-VAL-012"), { exact: true })).toBeVisible();
  await expect(alertOf(page)).toHaveCount(0);
  await expect(dueBtn(page)).toHaveAttribute("aria-invalid", "true");
  await expect(titleBox(page)).toHaveValue("12 月分の請求書を送る");
  await expect(check(page, "確認項目")).not.toBeChecked();
  expect(page.url()).toContain(`/tickets/${TICKET}`);
  await dueBtn(page).click();
  await dateDlg(page).getByRole("button", { name: "次の月", exact: true }).click();
  await dateDlg(page).getByRole("button", { name: "12月1日（火）", exact: true }).click();
  await dateDlg(page).getByRole("button", { name: "12/01 にする", exact: true }).click();
  await expect(dlg(page).getByText(msgOf("E-VAL-012"), { exact: true })).toHaveCount(0);
  await go(page).click();
  await settledDetail(page);
  expect(a.d.post.posts).toHaveLength(2);
  expect(a.d.post.posts[1]!.body["due_on"]).toBe("2026-12-01");
});

test("K446-UI-007 失敗：元が消えた・見えない（404・E-DUP-001）と、「元のチケットが見つかりません」が小窓の上の赤い箱に出て、小窓は開いたまま・直した題名と外したチェックは残り、移らない", async ({
  page,
}) => {
  const a = await detailWith(page);
  a.d.post.on.create = () => errReply(404, "E-DUP-001");
  await openDup(page);
  await titleBox(page).fill("12 月分の請求書を送る");
  await check(page, "確認項目").uncheck();
  await go(page).click();
  await expect(alertOf(page)).toHaveText(SRC_GONE);
  await expect(titleBox(page)).toHaveValue("12 月分の請求書を送る");
  await expect(check(page, "確認項目")).not.toBeChecked();
  expect(page.url()).toContain(`/tickets/${TICKET}`);
  expect(a.d.post.posts).toHaveLength(1);
});

test("K446-UI-008 失敗：写すと親子が 3 段を超える（409・E-DUP-002）と正本の文が箱に出る。「子チケット」を外して押し直すと、子を含まない copy で作れる", async ({
  page,
}) => {
  const a = await detailWith(page);
  let n = 0;
  a.d.post.on.create = () => (++n === 1 ? errReply(409, "E-DUP-002") : a.d.post.ok());
  await openDup(page);
  await go(page).click();
  await expect(alertOf(page)).toHaveText(msgOf("E-DUP-002"));
  await check(page, KIDS(2)).uncheck();
  await go(page).click();
  await settledDetail(page);
  expect(a.d.post.posts).toHaveLength(2);
  expect(a.d.post.posts[0]!.body["copy"]).toEqual(ALL);
  expect(a.d.post.posts[1]!.body["copy"]).toEqual(["body", "assignee", "fields", "specs", "links"]);
});

test("K446-UI-009 失敗：元に値が無い会社の必須の項目があり、項目を写して作ると口が断る（409・E-FLD-004・欄なし）と、正本の文が小窓の上の赤い箱に出る。小窓に項目の値を入れる欄は無く、直した題名は残り、押し直しても同じ文のまま移らない（作る面から書いて作るしかない）", async ({
  page,
}) => {
  const a = await detailWith(page);
  a.d.post.on.create = () => errReply(409, "E-FLD-004");
  await openDup(page);
  await titleBox(page).fill("12 月分の請求書を送る");
  await go(page).click();
  await expect(alertOf(page)).toHaveText(msgOf("E-FLD-004"));
  await expect(titleBox(page)).toHaveValue("12 月分の請求書を送る");
  await expect(dlg(page).getByRole("textbox")).toHaveCount(1);
  await go(page).click();
  await expect(alertOf(page)).toHaveText(msgOf("E-FLD-004"));
  expect(a.d.post.posts).toHaveLength(2);
  expect(a.d.post.posts[1]!.body["copy"]).toEqual(ALL);
  expect(page.url()).toContain(`/tickets/${TICKET}`);
});

test("K446-UI-010 利用者の状態：選び先（元の担当者など）が選べなくなった（404・E-PAGE-001・欄なし）は正本の E-PAGE-001 の文が箱に出る。書けない人は 403 でページ共通の権限の文の 1 文目。「担当者・承認する人」を外すと担当者を写さずに作れる", async ({
  page,
}) => {
  const a = await detailWith(page);
  a.d.post.on.create = () => errReply(404, "E-PAGE-001");
  await openDup(page);
  await go(page).click();
  await expect(alertOf(page)).toHaveText(msgOf("E-PAGE-001"));
  a.d.post.on.create = () => ({ status: 403, body: { error: "forbidden", code: "FORBIDDEN" } });
  await go(page).click();
  await expect(alertOf(page)).toHaveText(firstOf("E-PAGE-002"));
  a.d.post.on.create = () => a.d.post.ok();
  await check(page, "担当者・承認する人").uncheck();
  await go(page).click();
  await settledDetail(page);
  expect(a.d.post.posts).toHaveLength(3);
  expect(a.d.post.posts[0]!.body["assignee_member_id"]).toBe(BOSS);
  expect(a.d.post.posts[2]!.body["copy"]).toEqual(["body", "fields", "specs", "links", "children"]);
  expect(a.d.post.posts[2]!.body["assignee_member_id"]).toBe(ME);
});

test("K446-UI-011 失敗：口が 500 だと下絵の失敗の文（「複製できませんでした。…もう一度「複製して開く」を押してください」）が小窓の上の赤い箱に出て、書いた中身は残る。押し直すと同じ Idempotency-Key で 2 回目を送り、通ると作った詳細へ移る", async ({
  page,
}) => {
  const a = await detailWith(page);
  let n = 0;
  a.d.post.on.create = () => (++n === 1 ? SERVER_ERROR : a.d.post.ok());
  await openDup(page);
  await titleBox(page).fill("12 月分の請求書を送る");
  await go(page).click();
  await expect(alertOf(page)).toHaveText(FAILED_TEXT);
  await expect(titleBox(page)).toHaveValue("12 月分の請求書を送る");
  await go(page).click();
  await settledDetail(page);
  expect(a.d.post.posts).toHaveLength(2);
  expect(a.d.post.posts[1]!.key).toBe(a.d.post.posts[0]!.key);
  expect(a.d.post.posts[1]!.body["title"]).toBe("12 月分の請求書を送る");
});

test("K446-UI-012 操作の揺れ：答えを止めた間に「複製して開く」を押し直しても口へは 1 回だけ届き（押せない形になる）、答えると作った詳細へ移る（複製は 1 つ）", async ({
  page,
}) => {
  const a = await detailWith(page);
  const release = a.d.post.hold();
  await openDup(page);
  await go(page).click();
  await expect.poll(() => a.d.post.posts.length).toBe(1);
  await expect(go(page)).toBeDisabled();
  await go(page).click({ force: true });
  expect(a.d.post.posts).toHaveLength(1);
  release();
  await settledDetail(page);
  expect(a.d.post.posts).toHaveLength(1);
});

test("K446-UI-013 入口：「やめる」・Esc・頭の × で閉じ、口は呼ばず、焦点は「複製」に戻る。開き直すと入れ直した題名は元に戻っている", async ({
  page,
}) => {
  const a = await detailWith(page);
  await openDup(page);
  await titleBox(page).fill("別の題名");
  await cancel(dlg(page)).click();
  await expect(dlg(page)).toHaveCount(0);
  await openDup(page);
  await expect(titleBox(page)).toHaveValue(TITLE);
  await page.keyboard.press("Escape");
  await expect(dlg(page)).toHaveCount(0);
  await expect(dupBtn(page)).toBeFocused();
  await openDup(page);
  await dlg(page).getByRole("button", { name: "閉じる", exact: true }).click();
  await expect(dlg(page)).toHaveCount(0);
  expect(a.d.post.posts).toEqual([]);
  expect(a.d.ticketReads).toBe(1);
});

test("K446-UI-014 入力：子チケットが 0 件の元では「子チケット（0 件）」が入ったままで、既定のまま送ると copy は 6 つ（子の複製は口が 0 件として扱う）", async ({
  page,
}) => {
  const a = await detailWith(page, { children: 0 });
  await openDup(page);
  await expect(check(page, "子チケット（0 件）")).toBeChecked();
  await go(page).click();
  await settledDetail(page);
  expect(a.d.post.posts[0]!.body["copy"]).toEqual(ALL);
});

// ================================================================ 作る面の「過去のチケットから複製」
test("K446-UI-015 入口：作る面の作り方は「自分で書く」（今いる）・「AI と話して作る」（押せない形）・「過去のチケットから複製」（押せる）。押すと元を選ぶ小窓（説明・探す欄・やめる・「この元から作る」は押せない）が開き、口は呼ばない", async ({
  page,
}) => {
  const { s } = await createWith(page);
  const how = page.locator('[aria-label="作り方"]');
  await expect(how.getByText("自分で書く", { exact: true })).toHaveAttribute("aria-current", "true");
  await expect(how.getByText("AI と話して作る", { exact: true })).toHaveAttribute("aria-disabled", "true");
  await expect(entryBtn(page)).toBeVisible();
  await entryBtn(page).click();
  await expect(pickDlg(page)).toBeVisible();
  await expect(pickDlg(page)).toContainText("元にするチケットを選ぶと、その中身を写して書き始められます");
  await expect(search(page)).toHaveValue("");
  await expect(cancel(pickDlg(page))).toBeEnabled();
  await expect(fromHere(page)).toBeDisabled();
  await expect(pickDlg(page).getByRole("radio")).toHaveCount(0);
  expect(s.calls).toEqual([]);
  expect(s.reads).toBe(0);
});

test("K446-UI-016 入力：打ち終わって 1 回だけ一覧の口（q・view=all・limit=20）を引き、候補は番号・題名・「グループ ・ 段 ・ 期限」で出る。合うものが無い・口が落ちたときの文も出る", async ({
  page,
}) => {
  const { s } = await createWith(page);
  await openPick(page);
  await search(page).pressSequentially("請求書", { delay: 30 });
  await expect(pickItem(page, /EG-128/)).toBeVisible();
  await expect.poll(() => s.calls.length).toBe(1);
  expect(s.calls.map((q) => [q.get("q"), q.get("view"), q.get("limit")])).toEqual([["請求書", "all", "20"]]);
  const items = pickDlg(page).getByRole("radio");
  await expect(items).toHaveCount(3);
  await expect(items.nth(0)).toContainText("セイコー様へ 11月分の請求書を送る");
  await expect(items.nth(0)).toContainText("営業 ・ 完了 ・ 期限 11/01");
  await expect(items.nth(1)).toContainText("営業 ・ 完了 ・ 期限 10/01");
  await expect(items.nth(2)).toContainText("経理 ・ 完了 ・ 期限 10/25");
  await search(page).fill("存在しない題名");
  await expect(pickDlg(page).getByRole("status")).toHaveText(
    "「存在しない題名」に合うチケットがありません。番号か題名の一部で探してください",
  );
  s.status = 500;
  await search(page).fill("請求書の宛名");
  await expect(pickDlg(page).getByText("候補を読み込めませんでした", { exact: true })).toBeVisible();
  await expect(fromHere(page)).toBeDisabled();
});

test("K446-UI-017 入力：元（EG-128）を選んで「この元から作る」を押すと、元の詳細を 1 回読んで複製の小窓（対象「EG-128 から…」・題名は元の題名・期限は過去なので理由つき・子チケット（2 件））が開く。期限を選び直して「複製して開く」で作る口に元と copy が届き、作った詳細へ移る。書きかけの下書きは消さない", async ({
  page,
}) => {
  const { m, s, p } = await createWith(page);
  await openPick(page, "請求書");
  await pickItem(page, /EG-128/).click();
  await expect(pickItem(page, /EG-128/)).toHaveAttribute("aria-checked", "true");
  await expect(fromHere(page)).toBeEnabled();
  await fromHere(page).click();
  await expect(dlg(page)).toBeVisible();
  await expect(pickDlg(page)).toHaveCount(0);
  expect(s.reads).toBe(1);
  await expect(dlg(page)).toContainText("EG-128 から新しいチケットを作る");
  await expect(titleBox(page)).toHaveValue(D128.title);
  await expect(dueBtn(page)).toContainText("11/01（日）");
  await expect(dlg(page).getByText(msgOf("E-VAL-012"), { exact: true })).toBeVisible();
  await expect(check(page, "子チケット（2 件）")).toBeChecked();
  await go(page).click();
  expect(p.posts).toEqual([]);
  await dueBtn(page).click();
  await dateDlg(page).getByRole("button", { name: "11月24日（火）", exact: true }).click();
  await dateDlg(page).getByRole("button", { name: "11/24 にする", exact: true }).click();
  await go(page).click();
  await settledDetail(page);
  expect(p.posts).toHaveLength(1);
  expect(p.posts[0]!.body).toEqual({
    scope_id: SCOPE,
    kind_id: TASK,
    title: D128.title,
    assignee_member_id: BOSS,
    due_on: "2026-11-24",
    duplicate_of: D128.id,
    copy: ALL,
  });
  expect(m.draftDeletes).toBe(0);
});

test("K446-UI-018 失敗：選んだ元の詳細が読めない（404）と、元を選ぶ小窓の上の箱に「元のチケットが見つかりません」が出て、選びは残り、複製の小窓は開かない。500 はページ共通の「読み込めませんでした。」。直った後に押し直すと進める", async ({
  page,
}) => {
  const { s } = await createWith(page);
  await openPick(page, "請求書");
  await pickItem(page, /EG-128/).click();
  s.detailStatus = 404;
  await fromHere(page).click();
  await expect(pickDlg(page).getByRole("alert")).toHaveText(SRC_GONE);
  await expect(pickItem(page, /EG-128/)).toHaveAttribute("aria-checked", "true");
  await expect(dlg(page)).toHaveCount(0);
  s.detailStatus = 500;
  await fromHere(page).click();
  await expect(pickDlg(page).getByRole("alert")).toHaveText(firstOf("E-PAGE-007"));
  s.detailStatus = null;
  await fromHere(page).click();
  await expect(dlg(page)).toBeVisible();
  await expect(pickDlg(page)).toHaveCount(0);
});

test("K446-UI-024 入力：元に担当者がいない詳細では、「担当者・承認する人」は外れたまま押せない形（title「元に担当者がいません」）。「複製して開く」で送る担当者は複製した本人（高本）で、copy に assignee は無い", async ({
  page,
}) => {
  const a = await detailWith(page, { assignee: null });
  await openDup(page);
  const box = check(page, "担当者・承認する人");
  await expect(box).not.toBeChecked();
  await expect(box).toBeDisabled();
  await expect(
    dlg(page).locator(".k-f4-dup-row[aria-disabled='true']").filter({ hasText: "担当者・承認する人" }),
  ).toHaveAttribute("title", "元に担当者がいません");
  await go(page).click();
  await settledDetail(page);
  expect(a.d.post.posts).toHaveLength(1);
  expect(a.d.post.posts[0]!.body).toEqual(
    full({ assignee_member_id: ME, copy: ["body", "fields", "specs", "links", "children"] }),
  );
});

test("K446-UI-025 入力：元の期限が空（null）の詳細では、期限は「日付を選ぶ」で開き、「複製して開く」を押しても口へ送らず期限の下に「期限を入れてください」。日付の小窓で 11/24 を選ぶと理由が消え、その日で送れる", async ({
  page,
}) => {
  const a = await detailWith(page, { due_on: null });
  await openDup(page);
  await expect(dueBtn(page)).toContainText("日付を選ぶ");
  await go(page).click();
  await expect(dlg(page).getByText("期限を入れてください", { exact: true })).toBeVisible();
  expect(a.d.post.posts).toEqual([]);
  await dueBtn(page).click();
  await dateDlg(page).getByRole("button", { name: "11月24日（火）", exact: true }).click();
  await dateDlg(page).getByRole("button", { name: "11/24 にする", exact: true }).click();
  await expect(dueBtn(page)).toContainText("11/24（火）");
  await expect(dlg(page).getByText("期限を入れてください", { exact: true })).toHaveCount(0);
  await go(page).click();
  await settledDetail(page);
  expect(a.d.post.posts).toHaveLength(1);
  expect(a.d.post.posts[0]!.body["due_on"]).toBe("2026-11-24");
});

test("K446-UI-026 失敗：元の種別が選べなくなった（404・E-PAGE-001・欄なし）と、正本の E-PAGE-001 の文が箱に出る。小窓に種別を選び直す欄は無く、直した題名は残り、押し直しても送る種別は元のまま（黙って変えない）", async ({
  page,
}) => {
  const a = await detailWith(page);
  a.d.post.on.create = () => errReply(404, "E-PAGE-001");
  await openDup(page);
  await titleBox(page).fill("12 月分の請求書を送る");
  await go(page).click();
  await expect(alertOf(page)).toHaveText(msgOf("E-PAGE-001"));
  await expect(dlg(page).getByRole("combobox", { name: "種別" })).toHaveCount(0);
  await go(page).click();
  await expect(alertOf(page)).toHaveText(msgOf("E-PAGE-001"));
  expect(a.d.post.posts).toHaveLength(2);
  expect(a.d.post.posts[1]!.body["kind_id"]).toBe(TASK);
  expect(a.d.post.posts[1]!.body["title"]).toBe("12 月分の請求書を送る");
  expect(page.url()).toContain(`/tickets/${TICKET}`);
});

// ================================================================ 幅・突き合わせ・口の数・キーボード
test("K446-UI-019 入力：幅 1440・768・375 のどれでも、詳細の複製の小窓（6 つのチェック・題名・期限）を開いても横溢れ 0・小窓は画面の中（左右の端と足のボタンが画面の内側）", async ({
  page,
}) => {
  await detailWith(page);
  await openDup(page);
  for (const w of [1440, 768, 375]) {
    await page.setViewportSize({ width: w, height: w === 375 ? 812 : 900 });
    const vh = page.viewportSize()!.height;
    const b = (await dlg(page).boundingBox())!;
    expect(b.x, `幅 ${w} の小窓の左`).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width, `幅 ${w} の小窓の右`).toBeLessThanOrEqual(w);
    const f = (await go(page).boundingBox())!;
    expect(f.y + f.height, `幅 ${w} の足のボタン`).toBeLessThanOrEqual(vh);
    expect(await overflowX(page), `幅 ${w} の横溢れ`).toBe(0);
  }
});

test("K446-UI-020 入力：作る面の元を選ぶ小窓も幅 1440・768・375 で横溢れ 0・小窓は画面の中", async ({ page }) => {
  await createWith(page);
  await openPick(page, "請求書");
  await pickItem(page, /EG-128/).click();
  for (const w of [1440, 768, 375]) {
    await page.setViewportSize({ width: w, height: w === 375 ? 812 : 900 });
    const vh = page.viewportSize()!.height;
    const b = (await pickDlg(page).boundingBox())!;
    expect(b.x, `幅 ${w} の小窓の左`).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width, `幅 ${w} の小窓の右`).toBeLessThanOrEqual(w);
    const f = (await fromHere(page).boundingBox())!;
    expect(f.y + f.height, `幅 ${w} の足のボタン`).toBeLessThanOrEqual(vh);
    expect(await overflowX(page), `幅 ${w} の横溢れ`).toBe(0);
  }
});

// モックとの突き合わせ（共通の道具 matchMock・base は /dev/mock/f4）
const STATES: Record<string, (page: Page, w: number) => Promise<void>> = {
  "f4-dup-pick": async (page, w) => {
    await createWith(page, w);
    await openPick(page, "請求書");
    await pickItem(page, /EG-128/).click();
  },
  "f4-dup-dialog": async (page, w) => {
    await detailWith(page, { children: 0 }, w);
    await openDup(page);
  },
  "f4-dup-error": async (page, w) => {
    const a = await detailWith(page, { children: 0 }, w);
    a.d.post.on.create = () => SERVER_ERROR;
    await openDup(page);
    await go(page).click();
    await expect(alertOf(page)).toHaveText(FAILED_TEXT);
  },
};
for (const [id, drive] of Object.entries(STATES)) {
  for (const w of MATCH_WIDTHS) {
    test(`K446-UI-021 ${id} 幅 ${w}：小窓（箱・頭・知らせ・題名・期限・写すもの・補足・候補・ボタン）の値がモックと同じ`, async ({
      browser,
    }) => {
      const { rows, bad } = await matchMock(
        browser,
        id,
        w,
        async (page) => {
          await drive(page, w);
          await page.evaluate(() => {
            window.scrollTo(0, 0);
            document.querySelectorAll(".k-dialog-body").forEach((e) => {
              e.scrollTop = 0;
            });
          });
        },
        { pairs: DUP_PAIRS, base: "/dev/mock/f4", blur: true },
      );
      expect(new Set(rows.map((r) => r.part)), "小窓の役で比べた").toContain("dialog");
      expect(bad, bad.join("\n")).toEqual([]);
    });
  }
}

test("K446-UI-022 守り（口の数）：詳細は getTicket 1 回のまま複製の小窓を開き（元の詳細を読み直さない・書く要求 0）、「複製して開く」で書く要求は createTicket の 1 つだけ", async ({
  page,
}) => {
  const a = await detailWith(page);
  const writes = countWrites(page);
  await openDup(page);
  expect(a.d.ticketReads).toBe(1);
  expect(writes.n).toBe(0);
  await go(page).click();
  await settledDetail(page);
  expect(writes.paths).toEqual(["POST /api/v1/tickets"]);
});

test("K446-UI-023 入口：作る面の「過去のチケットから複製」にキーボードで焦点して Enter で小窓が開き、探す欄に焦点が行く。Esc で閉じ、焦点が「過去のチケットから複製」に戻る。口は呼ばない", async ({
  page,
}) => {
  const { s } = await createWith(page);
  await entryBtn(page).focus();
  await page.keyboard.press("Enter");
  await expect(pickDlg(page)).toBeVisible();
  await expect(search(page)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(pickDlg(page)).toHaveCount(0);
  await expect(entryBtn(page)).toBeFocused();
  expect(s.calls).toEqual([]);
});
