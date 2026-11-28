// K-467「画面：ベルを押してお知らせの一覧（重なって開く・未読だけ・人で絞る・押すとチケットへ・既読・すべて既読・過去のお知らせ・空・読めない・スマホは全面）」の画面の試験
//   （実 Chrome・実装より先に積む）。正のモック：/dev/mock/f7 の f7-bell-open・f7-bell-past・f7-bell-filter・f7-bell-empty・f7-bell-failed・f7-bell-mobile
//   （下絵を見た会話で代表が OK）。本物にするのは features/F7/notice/ の差し込み口の先（K-599 の useNoticeSlot・NoticeSlot）。
//   口は網の手前で差し替える（土台 tests/k/list-mock.ts の上に tests/k/f7-shell-mock.ts の mockShell・mockNotices）。
//   口の形は K-461（一覧・鍵 12 個）・K-462（既読・PATCH { read }・POST read-all → { read: 件数 }）・K-465（getShell の notifications_unread）に合わせる。
//   お知らせの 1 行の文は種類（kind）と params・番号・題名・起こした人から画面が作る（features/F7/notice/notice-text.ts・11_tickets/K-467.md の文の表）。
//   時刻は page.clock で止めて（2026-11-02 17:30 JST）「1 時間前」「昨日」などを決める。固定の待ちは使わない（要素と答えを待つ）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Locator, type Page } from "@playwright/test";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
import {
  NOTICE_IDS,
  SATO,
  SUZUKI,
  TICKET_A,
  TICKET_B,
  TICKET_C,
  mockNotices,
  mockShell,
  type NoticeMock,
  type NoticeSeed,
  type ShellMock,
} from "./f7-shell-mock";
import { items, mockList, open } from "./list-mock";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";

/** 時計：2026-11-02 17:30 JST（08:30Z） */
const NOW = new Date("2026-11-02T08:30:00Z");
const jst = (iso: string) => new Date(`${iso}+09:00`).toISOString();
const EG128 = { id: TICKET_A, number: "EG-128", title: "セイコー様へ 11月分の請求書を送る" };
const EG119 = { id: TICKET_B, number: "EG-119", title: "問い合わせ（山田様）に一次返信する" };
const EG127 = { id: TICKET_C, number: "EG-127", title: "発注ナビに請求書を出す" };

/** モックのお知らせ（f7-bell-open）と同じ並び・同じ字になる種 */
const SEEDS: NoticeSeed[] = [
  {
    id: NOTICE_IDS[0]!,
    kind: "handover.requested",
    actor: SATO,
    ticket: EG119,
    params: { reply_due: "2026-11-03" },
    at: jst("2026-11-02T16:30:00"),
  },
  { id: NOTICE_IDS[1]!, kind: "approval.requested", ticket: EG128, at: jst("2026-11-02T13:30:00") },
  { id: NOTICE_IDS[2]!, kind: "ticket.mentioned", actor: SUZUKI, ticket: EG128, at: jst("2026-11-02T12:30:00") },
  {
    id: NOTICE_IDS[3]!,
    kind: "ticket.due_changed",
    actor: SATO,
    ticket: EG128,
    // K-483 のお知らせは日付を入れない（P13・K-461 の PARAM_KEYS に due_on は無い）。文の「（期限を … に）」の括弧は常に出ない
    at: jst("2026-11-02T10:41:00"),
    read: true,
  },
  {
    id: NOTICE_IDS[4]!,
    kind: "ticket.stopped",
    ticket: EG127,
    params: { reason: "発注ナビの画面が変わっていた" },
    at: jst("2026-11-01T15:00:00"),
    read: true,
  },
  { id: NOTICE_IDS[5]!, kind: "security.new_device", at: jst("2026-10-20T09:00:00"), read: true },
];
const TEXTS = [
  "佐藤さんが EG-119 を渡しました。返事の期限 11/03",
  "EG-128 の確認が終わり、あなたの承認を待っています",
  "鈴木さんが EG-128 であなたを @ しました",
  "佐藤さんが EG-128 に書き込みました",
  "EG-127 が止まりました：発注ナビの画面が変わっていた",
  "新しい PC からログインがありました。心当たりが無いときは設定で確かめてください",
];
const WHEN = ["1 時間前", "4 時間前", "5 時間前", "10:41", "昨日", "10/20"];
const TAGS = ["受ける？", "承認待ち", "@", "書き込み", "止まった", "設定"];

interface Ctx {
  n: NoticeMock;
  s: ShellMock;
}
async function setup(
  page: Page,
  seeds: NoticeSeed[] = SEEDS,
  o: { unread?: number; width?: number; notice?: Partial<NoticeMock>; pause?: boolean } = {},
): Promise<Ctx> {
  await page.clock.install({ time: NOW });
  // 時計を止めてから開く（実時間で流れると、遅い台では 3 秒の境目の前に時間が進んで揺れる・K-251 の UI-013 と同じ）。時間は runFor だけで進める
  if (o.pause) await page.clock.pauseAt(new Date(NOW.getTime() + 1000));
  await mockList(page, { list: () => ({ status: 200, body: { data: items(3), meta: { next_cursor: null } } }) });
  const unread = o.unread ?? seeds.filter((x) => !x.read).length;
  const s = await mockShell(page, { unread, approvals: 2 });
  const n = await mockNotices(page, seeds, o.notice ?? {});
  await open(page, "/tickets", o.width ?? 1440);
  await expect(page.getByRole("table", { name: "チケットの一覧" }).locator("tbody tr[data-ticket]")).toHaveCount(3);
  return { n, s };
}
const bell = (p: Page) => p.locator("header.k-bar .k-bell");
const panel = (p: Page) => p.locator("section.k-f7-notice");
const sheet = (p: Page) => p.locator("section.k-f7-notice-sheet");
const rowsOf = (scope: Locator) => scope.locator(".k-f7-notice-row");
const overflowX = (p: Page) =>
  p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
async function openBell(page: Page) {
  await bell(page).click();
  await expect(panel(page)).toBeVisible();
  await expect(rowsOf(panel(page)).first()).toBeVisible();
}
const link = (scope: Locator, name: string) => scope.getByRole("button", { name, exact: true });
const unreadCount = (n: NoticeMock) => n.rows.filter((r) => !n.readAt.has(r.id)).length;

test("K467-UI-001 鈴を押すと右上に重なって開く：題「お知らせ」・「未読 3」・行 6 つが新しい順・一覧の口は 1 回（unread なし・limit 20）・画面（URL・一覧の表）は動かない・鈴は aria-expanded true", async ({
  page,
}) => {
  const { n } = await setup(page);
  await expect(bell(page)).toHaveAttribute("aria-label", "お知らせ（3 件）");
  await expect(bell(page)).toHaveAttribute("aria-expanded", "false");
  expect(n.lists).toEqual([]); // 開く前は呼ばない
  const url = page.url();
  await openBell(page);
  await expect(bell(page)).toHaveAttribute("aria-expanded", "true");
  await expect(panel(page).locator("h2")).toHaveText("お知らせ");
  await expect(panel(page).locator(".k-f7-notice-count")).toHaveText("未読 3");
  await expect(rowsOf(panel(page))).toHaveCount(6);
  expect(n.lists).toHaveLength(1);
  expect(n.lists[0]!.get("limit")).toBe("20");
  expect(n.lists[0]!.has("unread")).toBe(false);
  expect(n.lists[0]!.has("actor_member_id")).toBe(false);
  expect(page.url()).toBe(url);
  await expect(page.getByRole("table", { name: "チケットの一覧" })).toBeVisible();
  // 画面の右上に重なる（帯の下・画面の右の内側・幅 420）
  const box = (await panel(page).boundingBox())!;
  const vp = page.viewportSize()!;
  expect(Math.round(box.width)).toBe(420);
  expect(box.y).toBeGreaterThanOrEqual(48);
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height);
});

test("K467-UI-002 行の中身：種類ごとの文・番号と時刻（1 時間前・4 時間前・5 時間前・10:41・昨日・10/20）・札（受ける？・承認待ち・@・書き込み・止まった・設定）。未読の行だけ読み上げに「未読、」", async ({
  page,
}) => {
  await setup(page);
  await openBell(page);
  const rows = rowsOf(panel(page));
  for (let i = 0; i < 6; i++) {
    const r = rows.nth(i);
    await expect(r.locator(".k-f7-notice-text")).toContainText(TEXTS[i]!);
    await expect(r.locator(".k-f7-notice-tag")).toHaveText(TAGS[i]!);
    const meta = await r.locator(".k-f7-notice-meta").innerText();
    expect(meta.endsWith(WHEN[i]!), `${i} の時刻 ${meta}`).toBe(true);
    const unread = i < 3;
    await expect(r.locator(".sr-only"), `${i} の未読の読み上げ`).toHaveCount(unread ? 1 : 0);
    if (unread) await expect(r).toHaveAttribute("data-unread", "true");
    else await expect(r).not.toHaveAttribute("data-unread", /./);
  }
  await expect(rows.nth(0).locator(".k-f7-notice-meta")).toHaveText("EG-119 ・ 1 時間前");
});

test("K467-UI-003 開け閉め：Esc・外を押す・鈴をもう一度で閉じ（aria-expanded false・焦点は鈴へ戻る）、開き直すたびに一覧を読み直す（開くたび 1 回）", async ({
  page,
}) => {
  const { n } = await setup(page);
  await openBell(page);
  await page.keyboard.press("Escape");
  await expect(panel(page)).toHaveCount(0);
  await expect(bell(page)).toHaveAttribute("aria-expanded", "false");
  await expect(bell(page)).toBeFocused();
  await openBell(page);
  await page
    .locator("#k-main h1")
    .first()
    .click({ position: { x: 4, y: 4 } });
  await expect(panel(page)).toHaveCount(0);
  await openBell(page);
  await bell(page).click();
  await expect(panel(page)).toHaveCount(0);
  expect(n.lists).toHaveLength(3);
});

test("K467-UI-004 行（行き先あり）を押すと既読の口（PATCH { read: true }）を 1 回呼んで、そのチケットの詳細（/tickets/<id>）へ移る。別の行に触らない", async ({
  page,
}) => {
  const { n } = await setup(page);
  await openBell(page);
  await rowsOf(panel(page)).nth(1).click();
  await expect(page).toHaveURL(new RegExp(`/tickets/${TICKET_A}$`));
  await expect.poll(() => n.patches.length).toBe(1);
  expect(n.patches[0]).toEqual({ id: NOTICE_IDS[1], body: { read: true } });
  expect([...n.readAt.keys()].sort()).toEqual([NOTICE_IDS[1]!, NOTICE_IDS[3]!, NOTICE_IDS[4]!, NOTICE_IDS[5]!].sort());
});

const NO_HREF: NoticeSeed = {
  id: NOTICE_IDS[6]!,
  kind: "invitation_resend_requested",
  at: jst("2026-11-02T16:50:00"),
  href: null,
};

test("K467-UI-005 行き先が無い行（読むだけ）：押すと既読になるだけで、画面もパネルも動かず、その行の未読の印が消え、鈴の数と「未読 N」が 1 つ減る。口が失敗なら未読のまま・鈴の数も戻り・赤いお知らせ（既読にできませんでした）が出る", async ({
  page,
}) => {
  const seeds = [NO_HREF, ...SEEDS];
  const { n } = await setup(page, seeds);
  await openBell(page);
  const first = rowsOf(panel(page)).first();
  await expect(first).toHaveAttribute("data-unread", "true");
  await expect(first.locator(".k-f7-notice-tag")).toHaveText("設定");
  await expect(bell(page)).toHaveAttribute("aria-label", "お知らせ（4 件）");
  const url = page.url();
  // 失敗：未読のまま・鈴の数も戻る
  n.patchStatus = 500;
  await first.click();
  await expect(page.getByText("既読にできませんでした")).toBeVisible();
  await expect(first).toHaveAttribute("data-unread", "true");
  await expect(panel(page).locator(".k-f7-notice-count")).toHaveText("未読 4");
  await expect(bell(page)).toHaveAttribute("aria-label", "お知らせ（4 件）");
  // 成功：既読になるだけ
  n.patchStatus = 200;
  await first.click();
  await expect(first).not.toHaveAttribute("data-unread", /./);
  await expect(panel(page).locator(".k-f7-notice-count")).toHaveText("未読 3");
  await expect(bell(page)).toHaveAttribute("aria-label", "お知らせ（3 件）");
  expect(page.url()).toBe(url);
  await expect(panel(page)).toBeVisible();
  expect(n.patches.map((x) => x.id)).toEqual([NO_HREF.id, NO_HREF.id]);
});

test("K467-UI-006 「すべて既読にする」：口（POST read-all）を 1 回呼び、全部の行が既読・「未読」の表示と鈴の数が消え・ボタンは押せなくなる。失敗なら全部未読のまま・赤いお知らせ", async ({
  page,
}) => {
  const { n } = await setup(page);
  await openBell(page);
  const all = link(panel(page), "すべて既読にする");
  await expect(all).toBeEnabled();
  n.readAllStatus = 500;
  await all.click();
  await expect(page.getByText("すべて既読にできませんでした")).toBeVisible();
  await expect(panel(page).locator(".k-f7-notice-count")).toHaveText("未読 3");
  expect(n.readAlls).toBe(1);
  n.readAllStatus = 200;
  await all.click();
  await expect.poll(() => n.readAlls).toBe(2);
  await expect(panel(page).locator(".k-f7-notice-count")).toHaveCount(0);
  await expect(rowsOf(panel(page)).locator("xpath=self::*[@data-unread]")).toHaveCount(0);
  await expect(all).toBeDisabled();
  await expect(bell(page)).toHaveAttribute("aria-label", "お知らせ");
  expect(unreadCount(n)).toBe(0);
});

test("K467-UI-007 「未読だけ」：チェックすると一覧の口を unread=true で読み直し、未読の 3 行だけ。外すと全部に戻る。未読が 0 のときは「未読のお知らせはありません」", async ({
  page,
}) => {
  const { n } = await setup(page);
  await openBell(page);
  const only = panel(page).getByRole("checkbox", { name: "未読だけ", exact: true });
  await only.check();
  await expect.poll(() => n.lists.at(-1)?.get("unread")).toBe("true");
  await expect(rowsOf(panel(page))).toHaveCount(3);
  await only.uncheck();
  await expect(rowsOf(panel(page))).toHaveCount(6);
  expect(n.lists.at(-1)!.has("unread")).toBe(false);
  await link(panel(page), "すべて既読にする").click();
  await only.check();
  await expect(panel(page).getByText("未読のお知らせはありません")).toBeVisible();
  await expect(panel(page).getByText("「未読だけ」を外すと、読んだお知らせも見られます")).toBeVisible();
});

test("K467-UI-008 「人で絞る ▾」：候補は 全員・佐藤 花子・鈴木 一郎（口の meta.actors）。鈴木を選ぶと actor_member_id で読み直し、その人の行だけ・ボタンは「鈴木 一郎 ▾」。全員に戻すと全部", async ({
  page,
}) => {
  const { n } = await setup(page);
  await openBell(page);
  const people = panel(page).locator(".k-f7-notice-people");
  await expect(people).toHaveText("人で絞る ▾");
  await people.click();
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem")).toHaveText(["全員", "佐藤 花子", "鈴木 一郎"]);
  await menu.getByRole("menuitem", { name: "鈴木 一郎", exact: true }).click();
  await expect.poll(() => n.lists.at(-1)?.get("actor_member_id")).toBe(SUZUKI);
  await expect(rowsOf(panel(page))).toHaveCount(1);
  await expect(rowsOf(panel(page)).first().locator(".k-f7-notice-text")).toContainText("鈴木さん");
  await expect(people).toHaveText("鈴木 一郎 ▾");
  await people.click();
  await page.getByRole("menu").getByRole("menuitem", { name: "全員", exact: true }).click();
  await expect(rowsOf(panel(page))).toHaveCount(6);
  expect(n.lists.at(-1)!.has("actor_member_id")).toBe(false);
});

/** 古い読んだお知らせ 25 件（20 件ずつ・続きの鍵がある） */
const MANY: NoticeSeed[] = Array.from({ length: 25 }, (_, i) => ({
  id: NOTICE_IDS[10 + i]!,
  kind: "ticket.message",
  actor: SATO,
  ticket: EG128,
  at: jst(`2026-10-${String(30 - Math.floor(i / 2)).padStart(2, "0")}T${String(10 + (i % 2)).padStart(2, "0")}:00:00`),
  read: true,
}));

test("K467-UI-009 過去のお知らせ：最初は 20 件だけ。「過去のお知らせ」を押すと続きの鍵で読み、残りを区切り「過去のお知らせ」の下に足す（押せるのは 1 回・続きが無ければ最初から押せない）", async ({
  page,
}) => {
  const { n } = await setup(page, MANY, { unread: 0 });
  await openBell(page);
  await expect(rowsOf(panel(page))).toHaveCount(20);
  const past = link(panel(page), "過去のお知らせ");
  await expect(past).toBeEnabled();
  await past.click();
  await expect(rowsOf(panel(page))).toHaveCount(25);
  await expect(panel(page).locator("h3.k-f7-notice-past-head")).toHaveText("過去のお知らせ");
  expect(n.lists.at(-1)!.get("cursor")).toBeTruthy();
  await expect(past).toBeDisabled();
  expect(n.lists).toHaveLength(2);
  // 続きが無い：最初から押せない
  await page.keyboard.press("Escape");
  await mockNotices(page, SEEDS);
  await openBell(page);
  await expect(link(panel(page), "過去のお知らせ")).toBeDisabled();
});

test("K467-UI-021 過去のお知らせの続きの鍵が読めない（口が 409・E-NTF-001）：続きを足さず、鍵なしで最初の分を 1 回読み直し、正本の文の赤いお知らせが出る。「過去のお知らせ」はもう一度押せて、押すと続きが読める", async ({
  page,
}) => {
  const { n } = await setup(page, MANY, { unread: 0 });
  // 続きの鍵つきの 1 回目だけ 409（体は口の答えと同じ形で message を持たない：画面は code から正本の文を引く）
  const cursors: (string | null)[] = [];
  let broken = true;
  await page.route(/\/api\/v1\/notifications(\?|$)/, async (route) => {
    const cursor = new URL(route.request().url()).searchParams.get("cursor");
    cursors.push(cursor);
    if (broken && cursor) {
      broken = false;
      return route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ error: "conflict", code: "E-NTF-001" }),
      });
    }
    return route.fallback();
  });
  await openBell(page);
  await expect(rowsOf(panel(page))).toHaveCount(20);
  const past = link(panel(page), "過去のお知らせ");
  await past.click();
  await expect(page.getByText("お知らせの続きを読めませんでした。最初から読み直してください")).toBeVisible();
  await expect(rowsOf(panel(page))).toHaveCount(20);
  await expect(panel(page).locator("h3.k-f7-notice-past-head")).toHaveCount(0);
  expect(cursors).toHaveLength(3);
  expect(cursors[0]).toBeNull();
  expect(cursors[1]).toBeTruthy();
  expect(cursors[2]).toBeNull();
  // 読み直した後は続きが読める
  await expect(past).toBeEnabled();
  await past.click();
  await expect(rowsOf(panel(page))).toHaveCount(25);
  await expect(panel(page).locator("h3.k-f7-notice-past-head")).toHaveText("過去のお知らせ");
  expect(n.lists.at(-1)!.get("cursor")).toBeTruthy();
});

test("K467-UI-010 お知らせが 1 件も無い：「お知らせはまだありません」と説明の 1 行・「すべて既読にする」と「過去のお知らせ」は押せない・鈴に数なし", async ({
  page,
}) => {
  await setup(page, [], { unread: 0 });
  await bell(page).click();
  await expect(panel(page).getByText("お知らせはまだありません")).toBeVisible();
  await expect(panel(page).getByText("承認を待つもの・@ されたもの・止まったものがあると、ここに出ます")).toBeVisible();
  await expect(link(panel(page), "すべて既読にする")).toBeDisabled();
  await expect(link(panel(page), "過去のお知らせ")).toBeDisabled();
  await expect(bell(page)).toHaveAttribute("aria-label", "お知らせ");
});

test("K467-UI-011 読み込みの間（時計を止めて runFor だけで進める）：箱と枠はすぐ出る・「読み込んでいます…」は 2.9 秒では出ず 3 秒を過ぎて出る・答えが来ると行になる", async ({
  page,
}) => {
  const { n } = await setup(page, SEEDS, { pause: true });
  const release = n.hold();
  await bell(page).click();
  await expect(panel(page)).toBeVisible();
  await page.clock.runFor(2_900);
  await expect(panel(page).getByText("読み込んでいます…")).toHaveCount(0);
  await page.clock.runFor(200);
  await expect(panel(page).getByText("読み込んでいます…")).toBeVisible();
  release();
  await expect(rowsOf(panel(page))).toHaveCount(6);
});

test("K467-UI-012 一覧の口が 500：箱の中に読み込めなかったの案内（E-PAGE-007）と「もう一度」。押すと読み直し、直っていれば行が出る。鈴の数は変えない", async ({
  page,
}) => {
  const { n } = await setup(page, SEEDS, { notice: { listStatus: 500 } });
  await bell(page).click();
  const err = panel(page).locator('[data-code="E-PAGE-007"]');
  await expect(err).toBeVisible();
  await expect(bell(page)).toHaveAttribute("aria-label", "お知らせ（3 件）");
  n.listStatus = 200;
  await err.getByRole("button").first().click();
  await expect(rowsOf(panel(page))).toHaveCount(6);
  expect(n.lists).toHaveLength(2);
});

test("K467-UI-013 スマホ（幅 375）：鈴を押すと帯と下のタブの間に全面で開く。「‹ お知らせ」「すべて既読」・札「未読 3」「すべて」「@ 1」（今は すべて）・行を押すとチケットへ・戻るで閉じる・本文は動かない・横溢れ 0", async ({
  page,
}) => {
  const { n } = await setup(page, SEEDS, { width: 375 });
  await bell(page).click();
  await expect(sheet(page)).toBeVisible();
  await expect(panel(page)).toBeHidden();
  const box = (await sheet(page).boundingBox())!;
  const bar = (await page.locator("header.k-bar").boundingBox())!;
  const tabs = (await page.getByRole("navigation", { name: "下のタブ" }).boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(bar.y + bar.height - 1);
  expect(box.y + box.height).toBeLessThanOrEqual(tabs.y + 1);
  const chips = sheet(page).getByRole("group", { name: "お知らせの絞り込み" }).getByRole("button");
  await expect(chips).toHaveText(["未読 3", "すべて", "@ 1"]);
  await expect(chips.nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(rowsOf(sheet(page))).toHaveCount(6);
  await chips.nth(0).click();
  await expect(rowsOf(sheet(page))).toHaveCount(3);
  await chips.nth(2).click();
  await expect(rowsOf(sheet(page))).toHaveCount(1);
  await expect(rowsOf(sheet(page)).first().locator(".k-f7-notice-tag")).toHaveText("@");
  expect(await overflowX(page)).toBe(0);
  await sheet(page).getByRole("button", { name: "すべて既読", exact: true }).click();
  await expect.poll(() => n.readAlls).toBe(1);
  await expect(bell(page)).toHaveAttribute("aria-label", "お知らせ");
  await sheet(page).getByRole("button", { name: "戻る", exact: true }).click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(bell(page)).toBeFocused();
  await bell(page).click();
  await chips.nth(1).click();
  await rowsOf(sheet(page)).first().click();
  await expect(page).toHaveURL(new RegExp(`/tickets/${TICKET_B}$`));
});

test("K467-UI-022 スマホ（幅 375）の「未読だけ」「人で絞る ▾」：全面にも出て、チェックすると口を unread=true で読み直し未読の 3 行・外すと全部。人を選ぶと actor_member_id で読み直し 1 行・ボタン「鈴木 一郎 ▾」・全員で戻る", async ({
  page,
}) => {
  const { n } = await setup(page, SEEDS, { width: 375 });
  await bell(page).click();
  await expect(sheet(page)).toBeVisible();
  await expect(rowsOf(sheet(page))).toHaveCount(6);
  const only = sheet(page).getByRole("checkbox", { name: "未読だけ", exact: true });
  await expect(only).toBeVisible();
  await only.check();
  await expect.poll(() => n.lists.at(-1)?.get("unread")).toBe("true");
  await expect(rowsOf(sheet(page))).toHaveCount(3);
  await only.uncheck();
  await expect(rowsOf(sheet(page))).toHaveCount(6);
  expect(n.lists.at(-1)!.has("unread")).toBe(false);
  const people = sheet(page).locator(".k-f7-notice-people");
  await expect(people).toHaveText("人で絞る ▾");
  await people.click();
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem")).toHaveText(["全員", "佐藤 花子", "鈴木 一郎"]);
  await menu.getByRole("menuitem", { name: "鈴木 一郎", exact: true }).click();
  await expect.poll(() => n.lists.at(-1)?.get("actor_member_id")).toBe(SUZUKI);
  await expect(rowsOf(sheet(page))).toHaveCount(1);
  await expect(people).toHaveText("鈴木 一郎 ▾");
  await people.click();
  await page.getByRole("menu").getByRole("menuitem", { name: "全員", exact: true }).click();
  await expect(rowsOf(sheet(page))).toHaveCount(6);
  expect(await overflowX(page)).toBe(0);
});

test("K467-UI-014 幅 768・1024・1440 で開いたまま：箱は画面の中に収まり・横溢れ 0・鈴を隠さず・閉じた後に横溢れ 0。幅を 375 に狭めると箱は全面（スマホ）の形に替わる", async ({
  page,
}) => {
  await setup(page, SEEDS, { width: 768 });
  for (const w of [768, 1024, 1440]) {
    await page.setViewportSize({ width: w, height: 900 });
    await openBellIfClosed(page);
    const box = (await panel(page).boundingBox())!;
    expect(box.x, `幅 ${w}`).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, `幅 ${w}`).toBeLessThanOrEqual(w);
    expect(await overflowX(page), `幅 ${w}`).toBe(0);
    const b = (await bell(page).boundingBox())!;
    expect(box.y, `幅 ${w}`).toBeGreaterThanOrEqual(b.y + b.height - 1);
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(sheet(page)).toBeVisible();
  await expect(panel(page)).toBeHidden();
});
async function openBellIfClosed(page: Page) {
  if ((await panel(page).count()) === 0) await openBell(page);
}

test("K467-UI-015 数と一覧が食い違わない：1 件を既読にするたび鈴の数と「未読 N」が 1 つずつ減り（3 → 2 → 1 → 0）、0 になると数の字と「未読」の表示が消える。外枠の口 getShell は読み直さない（1 回のまま）", async ({
  page,
}) => {
  // 行き先を外した同じ種（押しても移らず既読になるだけ・K467-UI-005 と同じ道）
  const { s } = await setup(
    page,
    SEEDS.map((x) => ({ ...x, href: null })),
  );
  await openBell(page);
  for (const [i, left] of [
    [0, 2],
    [2, 1],
    [1, 0],
  ] as const) {
    await rowsOf(panel(page)).nth(i).click();
    await expect(bell(page)).toHaveAttribute("aria-label", left ? `お知らせ（${left} 件）` : "お知らせ");
    if (left) await expect(panel(page).locator(".k-f7-notice-count")).toHaveText(`未読 ${left}`);
    else await expect(panel(page).locator(".k-f7-notice-count")).toHaveCount(0);
  }
  expect(s.reads).toBe(1);
});

const mk = (list: [string, string, string[]][]): FidelityPair[] =>
  list.map(([role, sel, props]) => ({ name: role, role, canvas: sel, app: sel, props }));
const FIRST = ".k-f7-notice .k-f7-notice-list > li:first-child";
const FIRST_M = ".k-f7-notice-sheet .k-f7-notice-list > li:first-child";
/** 広い幅は箱だけ・スマホは全面だけを比べる（モックは両方を木に持ち、幅で片方を隠す。本番は幅に合う方だけ） */
const PAIRS_WIDE = mk([
  ["panel", ".k-f7-notice", ["x", "y", "width", "background-color", "border-top-left-radius"]],
  ["head", ".k-f7-notice-head h2", ["x", "y", "font-size", "font-weight", "texts"]],
  ["count", ".k-f7-notice-count", ["font-size", "color", "texts"]],
  ["row", `${FIRST} .k-f7-notice-row`, ["x", "width", "height", "background-color", "texts"]],
  ["avatar", `${FIRST} .k-f7-notice-av`, ["width", "height", "background-color", "texts"]],
  ["tag", `${FIRST} .k-f7-notice-tag`, ["width", "height", "texts"]],
  ["foot", ".k-f7-notice-foot", ["height", "texts"]],
]);
const PAIRS_NARROW = mk([
  ["sheet", ".k-f7-notice-sheet", ["x", "y", "width", "height"]],
  ["head", ".k-f7-notice-sheet h2", ["x", "y", "font-size", "texts"]],
  ["chips", ".k-f7-notice-chip", ["height", "texts"]],
  ["row", `${FIRST_M} .k-f7-notice-row`, ["x", "width", "height", "background-color", "texts"]],
  ["tag", `${FIRST_M} .k-f7-notice-tag`, ["width", "height", "texts"]],
]);

for (const [id, w] of [
  ["f7-bell-open", 1440],
  ["f7-bell-mobile", 375],
] as const) {
  test(`K467-UI-016 モック ${id} と本番のお知らせ（/tickets・幅 ${w}）の突き合わせ：箱・題・数・行（丸い印・札・字）・足の大きさと字が同じ`, async ({
    browser,
  }) => {
    expect(MATCH_WIDTHS).toContain(w);
    const { bad } = await matchMock(
      browser,
      id,
      w,
      async (page) => {
        await setup(page, SEEDS, { width: w });
        await bell(page).click();
        await expect(rowsOf(w === 375 ? sheet(page) : panel(page)).first()).toBeVisible();
      },
      { pairs: w === 375 ? PAIRS_NARROW : PAIRS_WIDE, base: "/dev/mock/f7" },
    );
    expect(bad, bad.join("\n")).toEqual([]);
  });
}

test("K467-UI-017 既読の口が 404（もう無いお知らせ：権限を外された・30 日を過ぎた・別のタブで消えた）：行き先の無い行を押すと、その行を一覧から外して一覧を読み直し（口 1 回）、「未読 N」と鈴の数は読み直しの答えと同じ値になる（外枠の数を戻して食い違わせない）。赤いお知らせは出さない", async ({
  page,
}) => {
  const seeds = [NO_HREF, ...SEEDS];
  const { n } = await setup(page, seeds);
  await openBell(page);
  await expect(panel(page).locator(".k-f7-notice-count")).toHaveText("未読 4");
  const lists = n.lists.length;
  // 別のタブで消えた行を押す：サーバーにはもう無い
  n.rows = n.rows.filter((r) => r.id !== NO_HREF.id);
  await rowsOf(panel(page)).first().click();
  await expect.poll(() => n.patches.length).toBe(1);
  await expect.poll(() => n.lists.length).toBe(lists + 1);
  await expect(rowsOf(panel(page))).toHaveCount(6);
  await expect(panel(page).locator(".k-f7-notice-count")).toHaveText("未読 3");
  await expect(bell(page)).toHaveAttribute("aria-label", "お知らせ（3 件）");
  await expect(page.getByText("既読にできませんでした")).toHaveCount(0);
  expect(n.lists.length).toBe(lists + 1);
});

test("K467-UI-018 すでに読んだ行（行き先あり）を押すと、既読の口を呼ばずにそのチケットの詳細（/tickets/<id>）へ移る。数は変わらない", async ({
  page,
}) => {
  const { n } = await setup(page);
  await openBell(page);
  const read = rowsOf(panel(page)).nth(3);
  await expect(read).not.toHaveAttribute("data-unread", /./);
  await read.click();
  await expect(page).toHaveURL(new RegExp(`/tickets/${TICKET_A}$`));
  expect(n.patches).toEqual([]);
  await expect(bell(page)).toHaveAttribute("aria-label", "お知らせ（3 件）");
});

const TAIL: NoticeSeed[] = [
  {
    id: NOTICE_IDS[7]!,
    kind: "handover.withdrawn",
    actor: SATO,
    ticket: { id: EG119.id, number: EG119.number, title: "" },
    href: null,
    at: jst("2026-11-02T16:40:00"),
  },
  { id: NOTICE_IDS[8]!, kind: "security.admin_recovery_requested", href: null, at: jst("2026-11-02T16:35:00") },
  { id: NOTICE_IDS[9]!, kind: "ticket.completed", actor: SUZUKI, ticket: EG127, at: jst("2026-11-02T16:20:00") },
  // 項目（優先度・親・予定時間・会社の項目）が変わったお知らせ（段 5 の K-440・K-564・K-583・文は K-602 の決め）：どの項目かは文に出さない
  { id: NOTICE_IDS[10]!, kind: "ticket.sort_changed", actor: SATO, ticket: EG128, at: jst("2026-11-02T16:10:00") },
];

test("K467-UI-019 種類の表（K-461 の PARAM_KEYS に合わせた文）：取り消し系の handover.withdrawn（番号だけ・題名なし）と管理者の復旧のお知らせ security.admin_recovery_requested は押せない行（押すと既読になるだけで画面は動かない）。題名が来ない ticket.completed も番号と人だけの文。項目が変わった ticket.sort_changed は「{人}さんが {番号} の項目を変えました」。reply_due は日付（MM/DD）にする", async ({
  page,
}) => {
  const { n } = await setup(page, [...TAIL, ...SEEDS]);
  await openBell(page);
  const rows = rowsOf(panel(page));
  await expect(rows.nth(0).locator(".k-f7-notice-text")).toContainText("EG-119");
  await expect(rows.nth(0).locator(".k-f7-notice-text")).not.toContainText("問い合わせ");
  await expect(rows.nth(1).locator(".k-f7-notice-text")).toContainText("設定のお知らせがあります");
  // 3 行目は渡し（16:30）・4 行目が完了のお知らせ（16:20）。題名が来なくても番号と人だけの文
  await expect(rows.nth(3).locator(".k-f7-notice-text")).toContainText("鈴木さんが EG-127");
  await expect(rows.nth(3).locator(".k-f7-notice-text")).not.toContainText("undefined");
  // 押せない行：リンクでなく、押しても URL が変わらず既読の口だけが 1 回呼ばれる
  const url = page.url();
  for (const i of [0, 1]) {
    await expect(rows.nth(i).locator("a")).toHaveCount(0);
    await rows.nth(i).click();
  }
  await expect.poll(() => n.patches.length).toBe(2);
  expect(page.url()).toBe(url);
  await expect(panel(page)).toBeVisible();
  // 項目が変わったお知らせ（ticket.sort_changed）は「項目を変えました」（どの項目かは出さない・既定の「書き込みました」ではない）
  await expect(rows.nth(4).locator(".k-f7-notice-text")).toHaveText("佐藤さんが EG-128 の項目を変えました");
  await expect(rows.nth(4).locator(".k-f7-notice-text")).not.toContainText("書き込みました");
  // 渡しの返事の期限は日付（MM/DD）にして文に入れる
  await expect(rows.nth(2).locator(".k-f7-notice-text")).toContainText("返事の期限 11/03");
});

test("K467-UI-020 幅 375：既読の口が失敗して出る赤いお知らせ（自分で閉じるまで残る）は、下のタブに重ならない（置き場が下のタブの上に出る）", async ({
  page,
}) => {
  const { n } = await setup(page, [NO_HREF, ...SEEDS], { width: 375 });
  await bell(page).click();
  await expect(sheet(page)).toBeVisible();
  n.patchStatus = 500;
  await rowsOf(sheet(page)).first().click();
  const toast = page.locator("li.k-toast-error");
  await expect(toast).toBeVisible();
  const t = (await toast.boundingBox())!;
  const tabs = (await page.getByRole("navigation", { name: "下のタブ" }).boundingBox())!;
  expect(t.y + t.height, "赤いお知らせが下のタブに重なる").toBeLessThanOrEqual(tabs.y + 1);
  expect(await overflowX(page)).toBe(0);
});
