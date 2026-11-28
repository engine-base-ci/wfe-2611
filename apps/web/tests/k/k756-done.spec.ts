// K-756「画面：分身の部屋のやったこと（/ai/done）」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f5 の done-list・done-filter-stopped・done-empty・done-empty-filter・done-loading・done-failed
//   （代表 OK：2026-11-23・flow.py seen c/段6）。口は網の手前で差し替える（done-mock.ts の mockDone・頭は room-mock.ts）。
//   答えの形は 11_tickets/K-754.md の「答えの形」。固定の待ちは使わない。name は { exact: true }。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Browser, type Page } from "@playwright/test";
import { DONE_ROWS, jstAt, mockDone, row, SUMMARY } from "./done-mock";
import { ROOM_HEAD_PAIRS, WIDTHS_ALL, err, msg, openRoom, overflowX, tabs, todayJst } from "./room-mock";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";

const main = (p: Page) => p.locator("#k-main");
const chips = (p: Page) => p.getByRole("group", { name: "やったことの絞り込み", exact: true });
const logRows = (p: Page) => main(p).locator("li.k-room-act:not(.k-room-more)");
const WD = ["日", "月", "火", "水", "木", "金", "土"];
const dayLabel = (daysAgo: number) => {
  const d = new Date(new Date(`${todayJst()}T12:00:00+09:00`).getTime() - daysAgo * 86400_000);
  const j = new Date(d.getTime() + 9 * 3600_000);
  const s = `${j.getUTCMonth() + 1}/${j.getUTCDate()}（${WD[j.getUTCDay()]}）`;
  return daysAgo === 0 ? `今日 ${s}` : s;
};
const ymd = (daysAgo: number) =>
  new Date(new Date(`${todayJst()}T12:00:00+09:00`).getTime() - daysAgo * 86400_000 + 9 * 3600_000)
    .toISOString()
    .slice(0, 10);

test("K756-UI-001 入口：/ai/done を開くと部屋の頭のタブ「やったこと」が今の印・期間は「この 1 週間」で口を 1 回読む（from は 6 日前・to は今日・kind なし）", async ({
  page,
}) => {
  const d = await mockDone(page);
  await openRoom(page, "/ai/done");
  await expect(tabs(page).getByRole("link", { name: "やったこと", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect.poll(() => d.queries.length).toBe(1);
  expect(d.queries[0]).toMatchObject({ from: ymd(6), to: ymd(0) });
  expect(d.queries[0]).not.toHaveProperty("kind");
  await expect(main(page).getByRole("button", { name: "期間：この 1 週間 ▾", exact: true })).toBeVisible();
});

test("K756-UI-002 行：日ごとの見出し（今日 M/D（曜）・M/D（曜））の下に 時刻・印（実・作・止）・題名・チケットへのリンク・結果の札が新しい順に並ぶ", async ({
  page,
}) => {
  await mockDone(page);
  await openRoom(page, "/ai/done");
  await expect(main(page).locator(".k-room-day")).toHaveText([dayLabel(0), dayLabel(1), dayLabel(2)]);
  await expect(logRows(page)).toHaveCount(7);
  const first = logRows(page).nth(0);
  await expect(first.locator(".k-room-act-time")).toHaveText("10:42");
  await expect(first.locator(".k-room-act-mark")).toHaveText("実");
  await expect(first.locator(".k-room-act-title")).toHaveText("請求書の PDF を先方にメールで送った");
  await expect(first.getByRole("link", { name: "EG-124", exact: true })).toHaveAttribute(
    "href",
    /\/tickets\/0193c5a0-/,
  );
  await expect(first.locator(".k-room-act-end")).toHaveText("完了");
  await expect(logRows(page).nth(1).locator(".k-room-act-mark")).toHaveText("作");
  await expect(logRows(page).nth(4).locator(".k-room-act-mark")).toHaveText("止");
  await expect(logRows(page).locator(".k-room-act-end")).toHaveText([
    "完了",
    "承認待ち",
    "そのまま通った",
    "直された",
    "止まった",
    "そのまま通った",
    "差し戻し",
  ]);
});

test("K756-UI-003 1 行の様子：detail の鍵から下絵の文を組む（承認の後に実行・確認項目の AI のチェック・直した人と版・止まった理由・差し戻した人と理由）。確認項目が 0 件なら出さない", async ({
  page,
}) => {
  await mockDone(page);
  await openRoom(page, "/ai/done");
  const det = (i: number) => logRows(page).nth(i).locator(".k-room-act-detail");
  const at = new Date(jstAt(0, "10:30"));
  const j = new Date(at.getTime() + 9 * 3600_000);
  const md = `${String(j.getUTCMonth() + 1).padStart(2, "0")}/${String(j.getUTCDate()).padStart(2, "0")}`;
  await expect(det(0)).toHaveText(`承認（${md} 10:30・高本）の後に実行`);
  await expect(det(1)).toHaveText("確認項目 3 件のうち 3 件に AI がチェックを付けた");
  await expect(det(2)).toHaveCount(0);
  await expect(det(3)).toHaveText("高本が直した（版 3）");
  await expect(det(4)).toHaveText("止まった理由：領収書の日付が読めませんでした");
  await expect(det(6)).toHaveText("佐藤：「結論が先に見えない」");
});

test("K756-UI-004 この期間の数：下に「この 1 週間 ・ やったこと 23 ・ そのまま通った 19 ・ 直された・差し戻し 3 ・ 止まった 1」（meta.summary の字）", async ({
  page,
}) => {
  await mockDone(page);
  await openRoom(page, "/ai/done");
  const sum = main(page).locator(".k-room-sum");
  await expect(sum).toContainText("この 1 週間");
  await expect(sum).toContainText(`やったこと ${SUMMARY.total}`);
  await expect(sum).toContainText(`そのまま通った ${SUMMARY.passed}`);
  await expect(sum).toContainText(`直された・差し戻し ${SUMMARY.fixed}`);
  await expect(sum).toContainText(`止まった ${SUMMARY.stopped}`);
});

test("K756-UI-005 札：「止まった」を押すと kind=stopped で読み直し、札が押された形・道に ?kind=stopped が残り、開き直しても同じ札で読む。「すべて」で kind なしに戻る", async ({
  page,
}) => {
  const d = await mockDone(page);
  await openRoom(page, "/ai/done");
  await chips(page).getByRole("button", { name: "止まった", exact: true }).click();
  await expect.poll(() => d.queries.at(-1)?.["kind"]).toBe("stopped");
  await expect(chips(page).getByRole("button", { name: "止まった", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page).toHaveURL(/[?&]kind=stopped/);
  await expect(logRows(page)).toHaveCount(1);
  const n = d.queries.length;
  await page.reload();
  await expect.poll(() => d.queries.length).toBeGreaterThan(n);
  expect(d.queries.at(-1)?.["kind"]).toBe("stopped");
  await chips(page).getByRole("button", { name: "すべて", exact: true }).click();
  await expect.poll(() => d.queries.at(-1)?.["kind"]).toBeUndefined();
  await expect(page).not.toHaveURL(/kind=/);
});

test("K756-UI-006 期間：［期間：この 1 週間 ▾］から「この 1 か月」「この 3 か月」を選べ、from が 29 日前・89 日前になり、ボタンの字と道（?period=month・quarter）が替わる", async ({
  page,
}) => {
  const d = await mockDone(page);
  await openRoom(page, "/ai/done");
  await main(page).getByRole("button", { name: "期間：この 1 週間 ▾", exact: true }).click();
  await page.getByRole("menuitem", { name: "この 1 か月", exact: true }).click();
  await expect.poll(() => d.queries.at(-1)?.["from"]).toBe(ymd(29));
  await expect(main(page).getByRole("button", { name: "期間：この 1 か月 ▾", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/[?&]period=month/);
  await main(page).getByRole("button", { name: "期間：この 1 か月 ▾", exact: true }).click();
  await page.getByRole("menuitem", { name: "この 3 か月", exact: true }).click();
  await expect.poll(() => d.queries.at(-1)?.["from"]).toBe(ymd(89));
  await expect(main(page).locator(".k-room-sum")).toContainText("この 3 か月");
});

test("K756-UI-007 続き：meta.cursor が在れば［もっと見る］で cursor を渡して読み足し、行が増える。続きが無ければ［もっと見る］を出さない", async ({
  page,
}) => {
  const d = await mockDone(page);
  const base = d.on;
  d.on = (q, req) =>
    q["cursor"]
      ? {
          status: 200,
          body: {
            data: [row({ ticket_number: "EG-090", title: "前の週の行" })],
            meta: { limit: 50, summary: SUMMARY },
          },
        }
      : base(q, req);
  await openRoom(page, "/ai/done");
  await main(page).getByRole("button", { name: "もっと見る", exact: true }).click();
  await expect.poll(() => d.queries.at(-1)?.["cursor"]).toBe("Y3Vyc29y");
  await expect(logRows(page)).toHaveCount(8);
  await expect(main(page).getByRole("button", { name: "もっと見る", exact: true })).toHaveCount(0);
});

test("K756-UI-008 まだ何もしていない：0 件なら「この期間にやったことはありません」と「チケットを任せると…」・札で絞って 0 件なら「札を「すべて」に戻すか…」", async ({
  page,
}) => {
  await mockDone(page, [], null);
  await openRoom(page, "/ai/done");
  await expect
    .poll(async () => (await main(page).textContent())?.replace(/⁠/g, ""))
    .toContain("この期間にやったことはありません");
  await expect(main(page)).toContainText("チケットを任せると、やったことがここに時間の順で並びます");
  await chips(page).getByRole("button", { name: "止まった", exact: true }).click();
  await expect(main(page)).toContainText("札を「すべて」に戻すか、期間を広げてみてください");
});

test("K756-UI-009 読み込み中と読めない：答えの前は「やったことを読んでいます…」・503 なら正本の読めない箱と［もう一度］で読み直せる", async ({
  page,
}) => {
  const d = await mockDone(page);
  const open = d.room.hold();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/ai/done");
  await expect(main(page).getByText("やったことを読んでいます…", { exact: true })).toBeVisible();
  open();
  await expect(logRows(page)).toHaveCount(7);
  const base = d.on;
  d.on = () => err(503, "E-PAGE-003");
  await page.reload();
  await expect(main(page).locator(".k-state")).toContainText(msg("E-PAGE-007").split("。")[0]!);
  d.on = base;
  await main(page).getByRole("button", { name: "もう一度", exact: true }).click();
  await expect(logRows(page)).toHaveCount(7);
});

test("K756-UI-010 守り：書き出しのボタンは無い・書く口 0・本人の Bridge に飛ばない・やったことの口は開くとき 1 回（頭の口は K-755 と同じ 1 回）", async ({
  page,
}) => {
  const d = await mockDone(page);
  await openRoom(page, "/ai/done");
  await expect(logRows(page)).toHaveCount(7);
  await expect(main(page).getByRole("button", { name: /書き出/ })).toHaveCount(0);
  expect(d.queries.length).toBe(1);
  expect(d.room.reads.me).toBe(1);
  expect(d.room.reads.now).toBe(0);
  expect(d.room.reads.growth).toBe(0);
  expect(d.room.writes).toEqual([]);
  expect(d.room.bridge).toBe(0);
});

test("K756-UI-011 スマホ（375）：行を 1 枚のカードに・札は横に流せる 1 段で、幅 320〜1440 で横溢れ 0", async ({
  page,
}) => {
  await mockDone(page);
  for (const w of WIDTHS_ALL) {
    await openRoom(page, "/ai/done", w);
    expect(await overflowX(page), `幅 ${w}`).toBeLessThanOrEqual(0);
  }
  await openRoom(page, "/ai/done", 375);
  const r = (await logRows(page).nth(0).boundingBox())!;
  expect(r.width).toBeGreaterThan(300);
});

test("K756-UI-012 キーボード：札を Tab で辿れ、Enter で押せる・行のチケットのリンクに Tab で届く", async ({ page }) => {
  const d = await mockDone(page);
  await openRoom(page, "/ai/done");
  const made = chips(page).getByRole("button", { name: "作った", exact: true });
  await made.focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => d.queries.at(-1)?.["kind"]).toBe("made");
  await logRows(page).nth(0).getByRole("link").focus();
  await expect(logRows(page).nth(0).getByRole("link")).toBeFocused();
});

test("K756-UI-017 知らない値：?kind=foo・?period=year で開くと既定（kind なし・from は 6 日前）で読み、札は「すべて」・期間は「この 1 週間」", async ({
  page,
}) => {
  const d = await mockDone(page);
  await openRoom(page, "/ai/done?kind=foo&period=year");
  await expect.poll(() => d.queries.length).toBe(1);
  expect(d.queries[0]).not.toHaveProperty("kind");
  expect(d.queries[0]).toMatchObject({ from: ymd(6), to: ymd(0) });
  await expect(chips(page).getByRole("button", { name: "すべて", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(main(page).getByRole("button", { name: "期間：この 1 週間 ▾", exact: true })).toBeVisible();
});

test("K756-UI-018 ［もっと見る］の二度押し：続きを読んでいる間は押せない形で、続きの問い合わせは 1 回だけ", async ({
  page,
}) => {
  const d = await mockDone(page);
  await openRoom(page, "/ai/done");
  const open = d.room.hold();
  const more = main(page).getByRole("button", { name: "もっと見る", exact: true });
  await more.click();
  await more.click({ force: true });
  await expect(more).toBeDisabled();
  open();
  await expect.poll(() => d.queries.filter((q) => q["cursor"]).length).toBe(1);
});

test("K756-UI-019 入っていない：やったことの口が 401 ならログインへ（戻り先は /ai/done）", async ({ page }) => {
  const d = await mockDone(page);
  const no = { status: 401, body: { error: "unauthenticated", code: "UNAUTHENTICATED" } };
  d.on = () => no;
  d.room.on.me = () => no;
  await page.goto("/ai/done");
  await expect(page).toHaveURL(/\/login\?next=%2Fai%2Fdone$/);
});

const BOX = ["width", "height", "x", "y", "background-color", "border-top-color", "border-top-left-radius"];
const TEXT = ["font-size", "font-weight", "color", "line-height", "texts"];
const p = (role: string, sel: string, props: string[]): FidelityPair => ({
  name: role,
  role,
  canvas: sel,
  app: sel,
  props,
});
const DONE_PAIRS: FidelityPair[] = [
  ...ROOM_HEAD_PAIRS,
  p("card", ".k-room-card", BOX),
  p("chips", ".k-room-chips", ["x", "y", "width", "texts"]),
  p("chip-on", '.k-room-chip[aria-pressed="true"]', [...BOX, ...TEXT]),
  p("period", ".k-room-tools-end button", ["x", "y", "width", "height", "texts"]),
  p("day", ".k-room-day", ["x", "y", ...TEXT]),
  p("act", ".k-room-act", BOX),
  p("time", ".k-room-act-time", ["x", "y", ...TEXT]),
  p("mark", ".k-room-act-mark", [...BOX, "texts"]),
  p("title", ".k-room-act-title", ["x", "y", ...TEXT]),
  p("detail", ".k-room-act-detail", ["x", "y", "font-size", "color", "texts"]),
  p("end", ".k-room-act-end", ["x", "y", "texts"]),
  p("sum", ".k-room-sum", ["x", "y", "width", "texts"]),
  p("empty", '.k-room-card .k-state[data-state="empty"]', [...BOX, "texts"]),
  p("state", ".k-state", [...BOX, "texts"]),
];
async function match(browser: Browser, id: string, drive: (pg: Page, w: number) => Promise<void>, skip: string[] = []) {
  const bad: string[] = [];
  for (const w of MATCH_WIDTHS) {
    const r = await matchMock(browser, id, w, (pg) => drive(pg, w), { pairs: DONE_PAIRS, base: "/dev/mock/f5", skip });
    bad.push(...r.bad);
  }
  expect(bad, bad.join("\n")).toEqual([]);
}
// 注：下絵の様子の 2 行（「成果物の版 1」「金額を直した」）は K-755 が下絵の側を直す。日の見出しの字（day の texts）だけは、
//   下絵が 11/2（月）の固定の日付で、試験は今日からの日付で行を作るので比べない（字の形は UI-002 が見る）
//   様子の字（detail の texts）も「承認（M/D 10:30・高本）」の日付が同じ訳で違うので比べない（位置・字の大きさ・色は比べる。字そのものは UI-005 ほかが見る）
const LIST_SKIP = ["day:texts", "detail:texts"];

test("K756-UI-013 下絵との突き合わせ：done-list（幅 375・768・1440・様子の字と日の見出しの字は比べない）", async ({
  browser,
}) => {
  await match(
    browser,
    "done-list",
    async (pg, w) => {
      await mockDone(pg);
      await openRoom(pg, "/ai/done", w);
    },
    LIST_SKIP,
  );
});
test("K756-UI-014 下絵との突き合わせ：done-filter-stopped（?kind=stopped で開く・続きなし）", async ({ browser }) => {
  await match(
    browser,
    "done-filter-stopped",
    async (pg, w) => {
      await mockDone(pg, DONE_ROWS(), null);
      await openRoom(pg, "/ai/done?kind=stopped", w);
    },
    ["day:texts"],
  );
});
test("K756-UI-015 下絵との突き合わせ：done-empty と done-empty-filter", async ({ browser }) => {
  await match(browser, "done-empty", async (pg, w) => {
    await mockDone(pg, [], null);
    await openRoom(pg, "/ai/done", w);
  });
  await match(browser, "done-empty-filter", async (pg, w) => {
    await mockDone(pg, [], null);
    await openRoom(pg, "/ai/done?kind=stopped", w);
  });
});
test("K756-UI-016 下絵との突き合わせ：done-failed（503）。done-loading は K756-UI-009 で答えを止めて見る", async ({
  browser,
}) => {
  await match(browser, "done-failed", async (pg) => {
    const d = await mockDone(pg);
    d.on = () => err(503, "E-PAGE-003");
    await pg.goto("/ai/done");
    await expect(pg.locator("#k-main .k-state")).toBeVisible();
  });
});
