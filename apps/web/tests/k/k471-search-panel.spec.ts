// K-471「画面：探す欄（⌘K・種類の札・上下と Enter・空・探している間・探せなかった・スマホ）」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f7 の f7-search-start・f7-search-results・f7-search-empty・f7-search-wait・f7-search-failed・f7-search-mobile（下絵を見た会話で代表が OK）。
//   本物にするのは features/F7/search/ の差し込み口の先（K-599 の useSearchSlot・SearchSlot）。口は search（K-468〜K-470・GET /api/v1/search・
//   答えは { data: SearchHit[] }・SearchHit は kind・id・title・snippet・url の 5 つ・問い合わせ q・kinds・limit）。口は網の手前で差し替える
//   （土台 tests/k/list-mock.ts の上に tests/k/f7-shell-mock.ts の mockShell・mockSearch）。
//   広い幅：上の帯の探す欄に焦点（または ⌘K）で、探す箱が画面の中央（上から 144・後ろに薄い幕）に重なって開き、箱の入力に焦点が移る。打つと 200 ミリ秒の間をおいて口を 1 回呼ぶ
//   （打つたびには呼ばない）。結果は種類ごと（チケット・決定・会話・ナレッジ）に上位 5 件。札は件数を出さず、クライアントで種類を絞る（口は呼び直さない）。
//   ↑↓ で選び Enter で開く。Esc・外を押すで閉じ、閉じたら打った字を捨てる。スマホ（767 以下）：虫眼鏡で帯の欄が開き、打った字は帯の欄に入る。
//   固定の待ちは使わない（要素と口の数を待つ）。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Locator, type Page } from "@playwright/test";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
import { TICKET_A, mockSearch, mockShell, type Hit, type SearchMock } from "./f7-shell-mock";
import { items, mockList, open } from "./list-mock";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";

const CONV = "0193c5a0-0000-7000-8000-00000000c001";
const TICKET_OLD = "0193c5a0-0000-7000-8000-000000000112";
const ROWS: Hit[] = [
  {
    kind: "ticket",
    id: TICKET_A,
    title: "セイコー様へ 11月分の請求書を送る",
    snippet: "EG-128・承認待ち",
    url: `/tickets/${TICKET_A}`,
  },
  {
    kind: "ticket",
    id: TICKET_OLD,
    title: "セイコー様へ 10月分の請求書を送る",
    snippet: "EG-112・完了",
    url: `/tickets/${TICKET_OLD}`,
  },
  {
    kind: "decision",
    id: "0193c5a0-0000-7000-8000-00000000d001",
    title: "支払期日は月末締め翌月末（セイコー様の請求）",
    snippet: "EG-128・セイコー様へ 11月分の請求書を送る",
    url: `/tickets/${TICKET_A}#sec-decisions`,
  },
  {
    kind: "conversation",
    id: CONV,
    title: "セイコー様の請求の相談",
    snippet: "請求書の送り先を先に確かめましょう",
    url: `/ai/chat?c=${CONV}`,
  },
];
const QUERY = "セイコー 請求";

const bar = (p: Page) => p.locator("header.k-bar");
const barInput = (p: Page) => bar(p).locator('input[name="q"]');
const panel = (p: Page) => p.locator("section.k-f7-search");
const panelInput = (p: Page) => panel(p).locator(".k-f7-search-input");
const hits = (scope: Locator) => scope.locator(".k-f7-hit");
const tab = (p: Page, name: string) => panel(p).getByRole("button", { name, exact: true });
const overflowX = (p: Page) =>
  p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** 一覧の表が 3 行出るまで待つ（外枠の ⌘K の聞き手が付くのは移り終わってから。押したキーを失わない） */
const settle = (p: Page) =>
  expect(p.getByRole("table", { name: "チケットの一覧" }).locator("tbody tr[data-ticket]")).toHaveCount(3);

/** 時計を止める時刻（時間は runFor だけで進める） */
const T0 = new Date("2026-11-02T08:30:00Z");

async function setup(
  page: Page,
  rows: Hit[] = ROWS,
  o: { width?: number; search?: Partial<SearchMock>; pause?: boolean } = {},
) {
  // 時計を止めてから開く（実時間で流れると、遅い台では 200 ミリ秒の間や 3 秒の境目の前に時間が進んで揺れる・K-251 の UI-013 と同じ）。時間は runFor だけで進める
  if (o.pause) {
    await page.clock.install({ time: T0 });
    await page.clock.pauseAt(new Date(T0.getTime() + 1000));
  }
  await mockList(page, { list: () => ({ status: 200, body: { data: items(3), meta: { next_cursor: null } } }) });
  await mockShell(page, { approvals: 2 });
  const m = await mockSearch(page, rows, o.search ?? {});
  await open(page, "/tickets", o.width ?? 1440);
  await settle(page);
  return m;
}
/** 広い幅：⌘K で開いて、箱の入力に打つ。口の数が n になるまで待つ */
async function typeQuery(page: Page, m: SearchMock, q = QUERY, calls = 1) {
  await page.keyboard.press("Control+k");
  await expect(panel(page)).toBeVisible();
  await expect(panelInput(page)).toBeFocused();
  await panelInput(page).fill(q);
  await expect.poll(() => m.calls.length).toBe(calls);
}

test("K471-UI-001 広い幅：上の帯の探す欄に焦点を置く（⌘K・Ctrl+K でも）と箱が重なって開き、箱の入力に焦点が移る。打つ前は口を呼ばず、案内の 1 行（「別の時：⌘K で開く」は出さない）。画面（URL・一覧の表）は動かない", async ({
  page,
}) => {
  const m = await setup(page);
  await expect(barInput(page)).toBeEnabled();
  await expect(panel(page)).toHaveCount(0);
  const url = page.url();
  await barInput(page).focus();
  await expect(panel(page)).toBeVisible();
  await expect(panelInput(page)).toBeFocused();
  await expect(
    panel(page).getByText("探したい言葉を打つと、チケット・ナレッジ・決定・会話をまとめて探します"),
  ).toBeVisible();
  await expect(panel(page).getByText("別の時：⌘K で開く")).toHaveCount(0);
  expect(m.calls).toEqual([]);
  expect(page.url()).toBe(url);
  await expect(page.getByRole("table", { name: "チケットの一覧" })).toBeVisible();
  const box = (await panel(page).boundingBox())!;
  const vp = page.viewportSize()!;
  expect(Math.round(box.width)).toBe(580);
  expect(Math.round(box.y)).toBe(144);
  expect(Math.abs(box.x + box.width / 2 - vp.width / 2)).toBeLessThan(2);
  // ⌘K（Ctrl+K）は閉じた状態からも開く
  await page.keyboard.press("Escape");
  await expect(panel(page)).toHaveCount(0);
  await page.keyboard.press("Control+k");
  await expect(panelInput(page)).toBeFocused();
});

test("K471-UI-002 打つと間をおいて口を 1 回だけ呼ぶ（q は打った字・limit 5・kinds なし・打つたびには呼ばない）。結果は チケット（2）・決定（1）・会話（1）の順で、ナレッジ（0 件）の見出しは「すべて」では出ない・探した字（セイコー・請求）は強調・札に件数は出ない", async ({
  page,
}) => {
  const m = await setup(page, ROWS, { pause: true });
  await page.keyboard.press("Control+k");
  await expect(panelInput(page)).toBeFocused();
  // 1 字ずつ打っても、時計は止まっているので「打つのをやめた」間（200 ミリ秒）は来ない。時間は runFor だけで進める
  await panelInput(page).pressSequentially(QUERY, { delay: 0 });
  expect(m.calls, "打つたびには呼ばない").toEqual([]);
  await page.clock.runFor(200);
  await expect.poll(() => m.calls.length).toBe(1);
  expect(m.calls[0]!.get("q")).toBe(QUERY);
  expect(m.calls[0]!.get("limit")).toBe("5");
  expect(m.calls[0]!.has("kinds")).toBe(false);
  await expect(panel(page).locator(".k-f7-search-group-head")).toHaveText(["チケット", "決定", "会話"]);
  await expect(hits(panel(page))).toHaveCount(4);
  const first = hits(panel(page)).first();
  await expect(first.locator(".k-f7-hit-lead")).toHaveText("EG-128");
  await expect(first.locator(".k-f7-hit-title")).toContainText("セイコー様へ 11月分の請求書を送る");
  await expect(first.locator(".k-f7-hit-mark")).toHaveText(["セイコー", "請求"]);
  await expect(first).toContainText("承認待ち");
  await expect(hits(panel(page)).nth(1)).toContainText("完了");
  await expect(hits(panel(page)).nth(2).locator(".k-f7-hit-title")).toContainText("支払期日は月末締め翌月末");
  await expect(hits(panel(page)).nth(3).locator(".k-f7-hit-snippet")).toHaveText("請求書の送り先を先に確かめましょう");
  await expect(panel(page).locator(".k-f7-search-tab")).toHaveText(["すべて", "チケット", "ナレッジ", "決定", "会話"]);
  await expect(panel(page).locator(".k-f7-search-tab").filter({ hasText: /\d/ })).toHaveCount(0);
  await expect(panel(page).getByText("↑↓ で選ぶ ・ Enter で開く")).toBeVisible();
  // 同じ字を打ち直しても、口は呼び直さない（同じ問い合わせの答えを使う）
  await panelInput(page).fill("");
  await panelInput(page).fill(QUERY);
  await page.clock.runFor(200);
  await expect(hits(panel(page))).toHaveCount(4);
  expect(m.calls).toHaveLength(1);
});

test("K471-UI-003 ↑↓ で選び Enter で開く：最初は先頭の行が選ばれている（aria-current）・↓ で次・↑ で前（端で止まる）・Enter で選んだ行の道（/tickets/<id>）へ移り箱は閉じる。選んだ行が決定なら詳細の決定ログの区画（#sec-decisions）へ", async ({
  page,
}) => {
  const m = await setup(page);
  await typeQuery(page, m);
  const active = () => panel(page).locator('.k-f7-hit[aria-current="true"]');
  await expect(active()).toHaveCount(1);
  await expect(hits(panel(page)).first()).toHaveAttribute("aria-current", "true");
  await page.keyboard.press("ArrowUp");
  await expect(hits(panel(page)).first()).toHaveAttribute("aria-current", "true");
  await page.keyboard.press("ArrowDown");
  await expect(hits(panel(page)).nth(1)).toHaveAttribute("aria-current", "true");
  await page.keyboard.press("ArrowDown");
  await expect(active().locator(".k-f7-hit-title")).toContainText("支払期日は月末締め翌月末");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/tickets/${TICKET_A}#sec-decisions$`));
  await expect(panel(page)).toHaveCount(0);
});

test("K471-UI-004 行を押すと開く：チケットの行は /tickets/<id>・会話の行は /ai/chat?c=<id>。箱は閉じる。Enter を押したとき選ばれた行が無い（結果が無い）ときは何も起きない", async ({
  page,
}) => {
  const m = await setup(page);
  await typeQuery(page, m);
  await hits(panel(page)).first().click();
  await expect(page).toHaveURL(new RegExp(`/tickets/${TICKET_A}$`));
  await expect(panel(page)).toHaveCount(0);
  await page.goBack();
  await open(page, "/tickets", 1440);
  await settle(page);
  await typeQuery(page, m, QUERY, 2);
  await hits(panel(page)).last().click();
  await expect(page).toHaveURL(new RegExp(`/ai/chat\\?c=${CONV}$`));
  // 結果が無いとき Enter は何もしない
  await page.goto("/tickets");
  await settle(page);
  await page.keyboard.press("Control+k");
  await expect(panelInput(page)).toBeFocused();
  await panelInput(page).fill("該当なしの言葉");
  await expect.poll(() => m.calls.length).toBe(3);
  const url = page.url();
  await page.keyboard.press("Enter");
  expect(page.url()).toBe(url);
});

test("K471-UI-005 種類の札：「チケット」を押すとチケットだけ（口は呼び直さない）・押している札は aria-pressed・「すべて」で全部に戻る。決定・会話の札も同じ", async ({
  page,
}) => {
  const m = await setup(page);
  await typeQuery(page, m);
  await expect(tab(page, "すべて")).toHaveAttribute("aria-pressed", "true");
  await tab(page, "チケット").click();
  await expect(tab(page, "チケット")).toHaveAttribute("aria-pressed", "true");
  await expect(panel(page).locator(".k-f7-search-group-head")).toHaveText(["チケット"]);
  await expect(hits(panel(page))).toHaveCount(2);
  await tab(page, "決定").click();
  await expect(hits(panel(page))).toHaveCount(1);
  await tab(page, "会話").click();
  await expect(hits(panel(page)).first().locator(".k-f7-hit-title")).toHaveText("セイコー様の請求の相談");
  await tab(page, "すべて").click();
  await expect(hits(panel(page))).toHaveCount(4);
  expect(m.calls).toHaveLength(1);
});

test("K471-UI-006 ナレッジは 0 件でも札は出す：「ナレッジ」を押すと「ナレッジのページはまだありません」の 1 行（見出しとともに）。「すべて」にはナレッジの見出しが出ない", async ({
  page,
}) => {
  const m = await setup(page);
  await typeQuery(page, m);
  await tab(page, "ナレッジ").click();
  await expect(panel(page).getByText("ナレッジのページはまだありません")).toBeVisible();
  await expect(hits(panel(page))).toHaveCount(0);
  await tab(page, "すべて").click();
  await expect(panel(page).getByText("ナレッジのページはまだありません")).toHaveCount(0);
});

test("K471-UI-007 合うものが無い：「「セイコー 見積書」に合うものがありません」と「細かく絞るならチケットの一覧の検索条件へ」。足の ↑↓ の案内は出ない。打ち足すと探し直す", async ({
  page,
}) => {
  const m = await setup(page);
  await typeQuery(page, m, "セイコー 見積書");
  await expect(panel(page).getByText("「セイコー 見積書」に合うものがありません")).toBeVisible();
  await expect(panel(page).getByText("細かく絞るならチケットの一覧の検索条件へ")).toBeVisible();
  await expect(panel(page).getByText("↑↓ で選ぶ")).toHaveCount(0);
  await panelInput(page).fill(QUERY);
  await expect.poll(() => m.calls.length).toBe(2);
  await expect(hits(panel(page))).toHaveCount(4);
});

test("K471-UI-008 探している間（時計を止めて runFor だけで進める）：箱と枠はすぐ出る・「探しています…」は口を呼んでから 2.9 秒では出ず 3 秒を過ぎて出る・答えが来ると結果になる", async ({
  page,
}) => {
  const m = await setup(page, ROWS, { pause: true });
  const release = m.hold();
  await page.keyboard.press("Control+k");
  await expect(panelInput(page)).toBeFocused();
  await panelInput(page).fill(QUERY);
  await page.clock.runFor(200); // 打つのをやめて 200 ミリ秒＝ここで口を呼ぶ
  await expect.poll(() => m.calls.length).toBe(1);
  await expect(panel(page)).toBeVisible();
  await page.clock.runFor(2_900);
  await expect(panel(page).getByText("探しています…")).toHaveCount(0);
  await page.clock.runFor(200);
  await expect(panel(page).getByText("探しています…")).toBeVisible();
  release();
  await expect(hits(panel(page))).toHaveCount(4);
});

test("K471-UI-009 探せなかった（口が 500）：箱の中に E-PAGE-007 の案内と「もう一度」。押すと探し直し、直っていれば結果が出る（口は 2 回）。打った字は残る", async ({
  page,
}) => {
  const m = await setup(page, ROWS, { search: { status: 500 } });
  await typeQuery(page, m);
  const err = panel(page).locator('[data-code="E-PAGE-007"]');
  await expect(err).toBeVisible();
  await expect(panelInput(page)).toHaveValue(QUERY);
  m.status = 200;
  await err.getByRole("button").first().click();
  await expect(hits(panel(page))).toHaveCount(4);
  expect(m.calls).toHaveLength(2);
});

test("K471-UI-010 答えの順が入れ替わっても、いまの字の答えを出す：遅い答えの「セイコー」より後に打った「セイコー 請求」の答えが先に来ても、後から遅い答えが来ても、画面はいまの字の結果のまま", async ({
  page,
}) => {
  let slow!: () => void;
  const wait = new Promise<void>((r) => (slow = r));
  const m = await setup(page, ROWS, {
    search: {
      answer: async (q) => {
        if (q.get("q") === "セイコー") await wait;
        const rows = q.get("q") === "セイコー" ? ROWS : ROWS.filter((h) => h.kind === "ticket");
        return { status: 200, body: { data: rows } };
      },
    },
  });
  await page.keyboard.press("Control+k");
  await panelInput(page).fill("セイコー");
  await expect.poll(() => m.calls.length).toBe(1);
  await panelInput(page).fill(QUERY);
  await expect.poll(() => m.calls.length).toBe(2);
  await expect(hits(panel(page))).toHaveCount(2);
  slow();
  await expect(panelInput(page)).toHaveValue(QUERY);
  await expect(hits(panel(page))).toHaveCount(2);
  await expect(panel(page).locator(".k-f7-search-group-head")).toHaveText(["チケット"]);
});

test("K471-UI-011 長い字：箱の入力は 100 字までしか入らず（全角も 1 字）、口には 100 字までを送る（101 字目で 422 にしない）。前後の空白は送る前に取る", async ({
  page,
}) => {
  const m = await setup(page);
  await page.keyboard.press("Control+k");
  await panelInput(page).fill(`  ${"あ".repeat(120)}  `);
  await expect.poll(() => m.calls.length).toBe(1);
  expect(m.calls[0]!.get("q")).toBe("あ".repeat(100));
  expect((await panelInput(page).inputValue()).trim().length).toBeLessThanOrEqual(100);
});

test("K471-UI-012 閉じ方：Esc・箱の外を押すで閉じ、打った字は捨てる（開き直すと空の案内・口は呼び直さない）", async ({
  page,
}) => {
  const m = await setup(page);
  await typeQuery(page, m);
  await page.keyboard.press("Escape");
  await expect(panel(page)).toHaveCount(0);
  await page.keyboard.press("Control+k");
  await expect(panelInput(page)).toHaveValue("");
  await expect(panel(page).getByText("探したい言葉を打つと")).toBeVisible();
  await page
    .locator("#k-main h1")
    .first()
    .click({ position: { x: 4, y: 4 } });
  await expect(panel(page)).toHaveCount(0);
  expect(m.calls).toHaveLength(1);
});

test("K471-UI-013 日本語の入力の途中（変換中）の Enter と Esc では何もしない：変換中の Enter は行を開かず、Esc は箱を閉じない（変換をやめるためのキー）", async ({
  page,
}) => {
  const m = await setup(page);
  await typeQuery(page, m);
  await expect(hits(panel(page))).toHaveCount(4);
  const url = page.url();
  await panelInput(page).evaluate((el) => {
    el.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", isComposing: true, bubbles: true, cancelable: true }),
    );
    el.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", isComposing: true, bubbles: true, cancelable: true }),
    );
  });
  expect(page.url()).toBe(url);
  await expect(panel(page)).toBeVisible();
  await expect(hits(panel(page))).toHaveCount(4);
});

test("K471-UI-014 スマホ（幅 375）：虫眼鏡で帯いっぱいに欄が開き、打った字は帯の欄に入る。結果は帯の下に全幅（箱の頭の入力は出ず、打った字の 1 行と札・結果）。Enter で先頭の行を開く・× で閉じて焦点は虫眼鏡へ戻る・横溢れ 0", async ({
  page,
}) => {
  const m = await setup(page, ROWS, { width: 375 });
  await bar(page).getByRole("button", { name: "探す", exact: true }).click();
  await expect(barInput(page)).toBeFocused();
  await barInput(page).fill(QUERY);
  await expect.poll(() => m.calls.length).toBe(1);
  await expect(panel(page)).toBeVisible();
  await expect(panelInput(page)).toBeHidden();
  await expect(panel(page).locator(".k-f7-search-q")).toHaveText(`「${QUERY}」`);
  await expect(hits(panel(page))).toHaveCount(4);
  await expect(panel(page).getByText("↑↓ で選ぶ")).toBeHidden();
  const box = (await panel(page).boundingBox())!;
  const barBox = (await bar(page).boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(barBox.y + barBox.height - 1);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(375);
  expect(await overflowX(page)).toBe(0);
  await barInput(page).press("Enter");
  await expect(page).toHaveURL(new RegExp(`/tickets/${TICKET_A}$`));
  await open(page, "/tickets", 375);
  await settle(page);
  await bar(page).getByRole("button", { name: "探す", exact: true }).click();
  await barInput(page).fill(QUERY);
  await expect(hits(panel(page))).toHaveCount(4);
  await bar(page).getByRole("button", { name: "探すを閉じる", exact: true }).click();
  await expect(panel(page)).toHaveCount(0);
  await expect(bar(page).getByRole("button", { name: "探す", exact: true })).toBeFocused();
});

test("K471-UI-018 広い幅で箱を開く：後ろに薄い幕（箱の 1 つ下の層）・箱は画面の横の中央・探す入力は箱の中に 1 つだけで、焦点が移っても縁の色は変わらない・帯の探す欄には字が入らない", async ({
  page,
}) => {
  await setup(page);
  const before = await barInput(page).evaluate((e) => getComputedStyle(e).outlineStyle);
  await page.keyboard.press("Control+k");
  await expect(panelInput(page)).toBeFocused();
  const scrim = page.locator(".k-f7-search-scrim");
  await expect(scrim).toHaveCount(1);
  const [sz, pz] = await Promise.all([
    scrim.evaluate((e) => Number(getComputedStyle(e).zIndex)),
    panel(page).evaluate((e) => Number(getComputedStyle(e).zIndex)),
  ]);
  expect(sz, "幕は箱の 1 つ下の層").toBe(pz - 1);
  const vp = page.viewportSize()!;
  const sb = (await scrim.boundingBox())!;
  expect([Math.round(sb.x), Math.round(sb.y), Math.round(sb.width), Math.round(sb.height)]).toEqual([
    0,
    0,
    vp.width,
    vp.height,
  ]);
  const box = (await panel(page).boundingBox())!;
  expect(Math.abs(box.x - (vp.width - box.x - box.width)), "左右の余りが等しい").toBeLessThan(2);
  await expect(panel(page).locator("input")).toHaveCount(1);
  expect(await panelInput(page).evaluate((e) => getComputedStyle(e).outlineStyle), "入力の縁は変えない").toBe("none");
  expect(await barInput(page).evaluate((e) => getComputedStyle(e).outlineStyle), "帯の欄の縁は焦点の前と同じ").toBe(
    before,
  );
  await page.keyboard.type("見積");
  await expect(panelInput(page)).toHaveValue("見積");
  await expect(barInput(page)).toHaveValue("");
});

for (const w of [320, 768, 1024, 1440] as const) {
  test(`K471-UI-015 幅 ${w}：結果が出ている間も箱は画面の中に収まり（左右・下）、横溢れ 0。広い幅は画面の中央・狭い幅（767 以下）は帯の下の全幅`, async ({
    page,
  }) => {
    const m = await setup(page, ROWS, { width: w });
    if (w <= 767) {
      await bar(page).getByRole("button", { name: "探す", exact: true }).click();
      await barInput(page).fill(QUERY);
      await expect.poll(() => m.calls.length).toBe(1);
    } else await typeQuery(page, m);
    await expect(hits(panel(page))).toHaveCount(4);
    const box = (await panel(page).boundingBox())!;
    const vp = page.viewportSize()!;
    expect(box.x, `幅 ${w}`).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, `幅 ${w}`).toBeLessThanOrEqual(vp.width);
    expect(box.y + box.height, `幅 ${w}`).toBeLessThanOrEqual(vp.height);
    expect(await overflowX(page), `幅 ${w}`).toBe(0);
  });
}

test("K471-UI-017 箱が開いている間の ⌘K（Ctrl+K）と帯の探す欄：⌘K をもう一度押すと焦点は箱の入力に戻り（帯の探す欄へ抜けない）、打った字と結果は変わらず口も呼び直さない。帯の探す欄を押しても焦点は箱の入力へ渡り、字は箱の入力に入る（広い幅は箱の入力 1 つに打つ決め）", async ({
  page,
}) => {
  const m = await setup(page);
  await typeQuery(page, m);
  await expect(hits(panel(page))).toHaveCount(4);
  // 開いている間の ⌘K：焦点は箱の入力のまま・字も結果も口も変わらない
  await page.keyboard.press("Control+k");
  await expect(panelInput(page)).toBeFocused();
  await expect(barInput(page)).not.toBeFocused();
  await expect(panelInput(page)).toHaveValue(QUERY);
  await expect(hits(panel(page))).toHaveCount(4);
  expect(m.calls).toHaveLength(1);
  // 帯の探す欄を押しても、焦点は箱の入力へ渡る。そこで打った字は箱の入力の字になる
  await barInput(page).click();
  await expect(panelInput(page)).toBeFocused();
  await page.keyboard.type("あ");
  await expect(panelInput(page)).toHaveValue(`${QUERY}あ`);
  await expect(barInput(page)).toHaveValue("");
  await expect(panel(page)).toBeVisible();
});

const mk = (list: [string, string, string[]][]): FidelityPair[] =>
  list.map(([role, sel, props]) => ({ name: role, role, canvas: sel, app: sel, props }));
const G1 = ".k-f7-search-group:first-child";
const PAIRS_WIDE = mk([
  ["panel", ".k-f7-search", ["x", "y", "width", "background-color", "border-top-left-radius"]],
  ["head", ".k-f7-search-head", ["height", "padding-left"]],
  ["input", ".k-f7-search-input", ["x", "width", "font-size", "texts"]],
  ["tabs", ".k-f7-search-tab", ["height", "texts"]],
  ["group-head", `${G1} .k-f7-search-group-head`, ["font-size", "texts"]],
  ["hit", `${G1} li:first-child .k-f7-hit`, ["x", "width", "height", "background-color", "texts"]],
  ["marks", `${G1} li:first-child .k-f7-hit-mark`, ["texts"]],
  ["foot", ".k-f7-search-foot", ["height", "texts"]],
]);
const PAIRS_NARROW = mk([
  ["panel", ".k-f7-search", ["x", "y", "width"]],
  ["query", ".k-f7-search-q", ["font-size", "texts"]],
  ["tabs", ".k-f7-search-tab", ["height", "texts"]],
  ["hit", `${G1} li:first-child .k-f7-hit`, ["x", "width", "height", "texts"]],
]);

for (const [id, w] of [
  ["f7-search-results", 1440],
  ["f7-search-mobile", 375],
] as const) {
  test(`K471-UI-016 モック ${id} と本番の探す欄（/tickets・幅 ${w}）の突き合わせ：箱・入力・札・先頭の見出しと行（強調・札・字）・足の大きさと字が同じ`, async ({
    browser,
  }) => {
    expect(MATCH_WIDTHS).toContain(w);
    const { bad } = await matchMock(
      browser,
      id,
      w,
      async (page) => {
        const m = await setup(page, ROWS, { width: w });
        if (w === 375) {
          await bar(page).getByRole("button", { name: "探す", exact: true }).click();
          await barInput(page).fill(QUERY);
          await expect.poll(() => m.calls.length).toBe(1);
        } else await typeQuery(page, m);
        await expect(hits(panel(page))).toHaveCount(4);
      },
      { pairs: w === 375 ? PAIRS_NARROW : PAIRS_WIDE, base: "/dev/mock/f7" },
    );
    expect(bad, bad.join("\n")).toEqual([]);
  });
}
