// K-755「画面：分身の部屋の外枠とようす（/ai）」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f5 の room-overview・room-idle・room-stopped・room-pc-none・room-pc-closed・room-loading・room-failed・room-mobile
//   （代表 OK：2026-11-23・flow.py seen c/段6）。口は網の手前で差し替える（tests/k/room-mock.ts の mockRoom）。
//   口の答えの形は 11_tickets/K-753.md・K-754.md の「答えの形」。字は下絵が正（PC の名前は口の pc.label から）。
//   固定の待ちは使わない（要素と口の数を待つ・読み込み中は答えを止めて見る）。name は { exact: true }。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Browser, type Page } from "@playwright/test";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";
import {
  NEXT,
  NEXT_STOPPED,
  cloneMe,
  cloneNow,
  ROOM_NOW_PAIRS,
  T_NOW,
  WIDTHS_ALL,
  err,
  mockRoom,
  msg,
  openRoom,
  overflowX,
  tabs,
  todayJst,
  type RoomOptions,
} from "./room-mock";

const NAME = "高本のAI";
const SUB_LIVE = "高本 聖斗 の分身 ・ 高本の MacBook で働く ・ 2026/09/12 から一緒に働いている";
const SUB_NONE = "高本 聖斗 の分身 ・ 今日から ・ PC がまだ";
const SUB_ASLEEP = "高本 聖斗 の分身 ・ 高本の MacBook は閉じています ・ 2026/09/12 から一緒に働いている";
const main = (p: Page) => p.locator("#k-main");

test("K755-UI-001 入口：/ai を開くと頭に「高本のAI」・ひとこと・タブ 3 つと「知っていること」が出て、ようすが選ばれている", async ({
  page,
}) => {
  await mockRoom(page);
  await openRoom(page);
  await expect(page.locator(".k-room-sub-long")).toHaveText(SUB_LIVE);
  const t = tabs(page);
  await expect(t.getByRole("link", { name: "ようす", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(t.getByRole("link", { name: "話す", exact: true })).toHaveAttribute("href", "/ai/talk");
  await expect(t.getByRole("link", { name: "やったこと", exact: true })).toHaveAttribute("href", "/ai/done");
  await expect(t.getByRole("link", { name: "知っていること", exact: true })).toHaveAttribute("href", "/knowledge");
});

test("K755-UI-002 ようす：いま・このあと・あなたを待っている が口の答えの字で出る（状態は 順番待ち・承認済み・止まった）", async ({
  page,
}) => {
  await mockRoom(page, {
    now: { next: [...NEXT, ...NEXT_STOPPED] },
  });
  await openRoom(page);
  const now = main(page).locator(".k-room-now");
  await expect(now).toHaveAttribute("href", `/tickets/${T_NOW}`);
  await expect(now.locator(".k-room-now-meta")).toHaveText("EG-127 ・ 3 分前から");
  await expect(now.locator(".k-room-now-title")).toHaveText("発注ナビの応募文を作っています");
  await expect(now.locator("progress")).toHaveCount(0);
  const next = main(page).locator(".k-room-next li");
  await expect(next).toHaveCount(3);
  await expect(next.nth(0)).toContainText("EG-121 見積の根拠を確かめる");
  await expect(next.nth(0).locator(".k-room-next-end")).toHaveText("順番待ち");
  await expect(next.nth(0).locator(".k-room-next-end")).not.toHaveAttribute("data-tone", "warn");
  await expect(next.nth(1).locator(".k-room-next-end")).toHaveText("承認済み");
  await expect(next.nth(1).locator(".k-room-next-end")).toHaveAttribute("data-tone", "warn");
  await expect(next.nth(2).locator(".k-room-next-end")).toHaveText("止まった");
  await expect(next.nth(2).locator(".k-room-next-end")).toHaveAttribute("data-tone", "warn");
  const wait = main(page).locator("a.k-room-wait");
  await expect(wait).toHaveAttribute("href", "/approvals");
  await expect(wait).toContainText("あなたを待っています");
  await expect(wait).toContainText("承認 3");
  await expect(wait).toContainText("止まった 1");
});

test("K755-UI-003 何もしていない：いま無し・このあと無し・待っている物 0 のときの字（待っている行はリンクにしない）", async ({
  page,
}) => {
  await mockRoom(page, { now: { current: null, next: [], waiting_approvals: 0, stopped: 0 } });
  await openRoom(page);
  await expect(main(page).locator(".k-room-now-title")).toHaveText("いまは何もしていません");
  await expect(main(page).locator(".k-room-now-meta")).toHaveText("チケットを任せると、ここに出ます");
  await expect(main(page).getByText("このあとの予定はありません", { exact: true })).toBeVisible();
  await expect(main(page).locator("a.k-room-wait")).toHaveCount(0);
  await expect(main(page).locator(".k-room-wait")).toHaveText("あなたを待っている物はありません");
});

test("K755-UI-004 育ち具合：数 3 つ（18 件・72%・先週 61%・6.2h）。先週より上がれば上向きの色・割合が null なら —・先週が null なら出さない", async ({
  page,
}) => {
  const r = await mockRoom(page);
  await openRoom(page);
  const stats = main(page).locator(".k-room-stat");
  await expect(stats.nth(0)).toContainText("任せた");
  await expect(stats.nth(0).locator("dd")).toHaveText("18件");
  await expect(stats.nth(1).locator("dd")).toHaveText("72%先週 61%");
  await expect(stats.nth(1)).toHaveAttribute("data-tone", "up");
  await expect(stats.nth(2).locator("dd")).toHaveText("6.2h");
  r.on.growth = () => ({
    status: 200,
    body: { data: { assigned: 0, pass_rate: null, pass_rate_last_week: null, work_seconds: 0 } },
  });
  await page.reload();
  await expect(stats.nth(1).locator("dd")).toHaveText("—");
  await expect(stats.nth(1)).toHaveAttribute("data-empty", "");
  await expect(stats.nth(1)).not.toHaveAttribute("data-tone", "up");
  await expect(stats.nth(2).locator("dd")).toHaveText("0h");
});

test("K755-UI-005 PC がまだ（pc.state none）：PC をつなぐ案内と はじめての区画・ひとことは「今日から ・ PC がまだ」・［PC をつなぐ（3 分）］は PC をつなぐ画面へ", async ({
  page,
}) => {
  await mockRoom(page, { pc: "none", since: todayJst() });
  await openRoom(page);
  await expect(page.locator(".k-room-sub-long")).toHaveText(SUB_NONE);
  const box = main(page).locator(".k-room-pc");
  await expect(box).toContainText("PC がまだつながっていません");
  const h2 = main(page).locator(".k-room-empty h2");
  await expect
    .poll(async () => (await h2.textContent())?.replace(/\u2060/g, ""))
    .toBe("高本のAI はまだ何もしていません");
  await expect(box.getByRole("link", { name: "PC をつなぐ（3 分）", exact: true })).toHaveAttribute(
    "href",
    "/setup/bridge",
  );
  await expect(main(page).locator(".k-room-grid")).toHaveCount(0);
  await expect(
    main(page).locator(".k-room-empty").getByRole("link", { name: "チケットを作る", exact: true }),
  ).toHaveAttribute("href", "/tickets?new=1");
});

test("K755-UI-006 PC が閉じている（pc.state asleep）：いまは「お休み中です」・このあとの見出しは「PC が開くのを待っている」・閉じている箱に PC の名前・［PC の様子を見る］は PC の画面へ", async ({
  page,
}) => {
  await mockRoom(page, { pc: "asleep", now: { current: null, stopped: 0 } });
  await openRoom(page);
  await expect(page.locator(".k-room-sub-long")).toHaveText(SUB_ASLEEP);
  await expect(main(page).locator(".k-room-now")).toHaveAttribute("data-tone", "asleep");
  await expect(main(page).locator(".k-room-now-title")).toHaveText("お休み中です");
  await expect(main(page).locator(".k-room-sublabel")).toHaveText("PC が開くのを待っている");
  const box = main(page).locator(".k-room-pc");
  await expect(box).toContainText("PC が閉じています");
  await expect(box).toContainText("高本の MacBook を開くと、待っている仕事をすぐ始めます");
  await expect(box.getByRole("link", { name: "PC の様子を見る", exact: true })).toHaveAttribute(
    "href",
    "/setup/bridge",
  );
});

test("K755-UI-007 読み込み中：答えが来るまで読み込み中の印だけが出て、答えが来ると消える", async ({ page }) => {
  const r = await mockRoom(page);
  const open = r.hold();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/ai");
  await expect(page.locator('#k-main [aria-busy="true"]')).toHaveCount(1);
  await expect(main(page).locator(".k-room-grid")).toHaveCount(0);
  open();
  await expect(page.locator('#k-main [aria-busy="true"]')).toHaveCount(0);
  await expect(main(page).locator(".k-room-grid")).toBeVisible();
});

test("K755-UI-008 読めない：getCloneNow が 503 なら「読み込めませんでした」の箱（正本の文）と［もう一度］・押すと読み直して出る", async ({
  page,
}) => {
  const r = await mockRoom(page);
  r.on.now = () => err(503, "E-PAGE-003");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/ai");
  await expect(main(page).locator(".k-state")).toContainText(msg("E-PAGE-007").split("。")[0]!);
  const before = r.reads.now;
  r.on.now = () => ({ status: 200, body: { data: cloneNow() } });
  await main(page).getByRole("button", { name: "もう一度", exact: true }).click();
  await expect.poll(() => r.reads.now).toBeGreaterThan(before);
  await expect(main(page).locator(".k-room-grid")).toBeVisible();
});

test("K755-UI-009 頭が読めない：getMyClone が 503 なら、頭は名前の代わりに見出し「あなたのAI」・ひとことは空・タブは出し、本文は読めない箱。getCloneGrowth が落ちたときも本文は同じ箱", async ({
  page,
}) => {
  const r = await mockRoom(page);
  r.on.me = () => err(503, "E-PAGE-003");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/ai");
  await expect(main(page).locator(".k-state")).toBeVisible();
  await expect(page.locator(".k-room-head h1")).toHaveText("あなたのAI");
  await expect(page.locator(".k-room-sub-long")).toHaveText("");
  await expect(tabs(page).getByRole("link", { name: "ようす", exact: true })).toHaveAttribute("aria-current", "page");
  r.on.me = () => ({ status: 200, body: { data: cloneMe() } });
  r.on.growth = () => err(503, "E-PAGE-003");
  await page.reload();
  await expect(main(page).locator(".k-state")).toBeVisible();
  await expect(main(page).locator(".k-state").getByRole("button", { name: "もう一度", exact: true })).toBeVisible();
});

test("K755-UI-010 入っていない：口が 401 ならログインへ（戻り先は /ai）", async ({ page }) => {
  const r = await mockRoom(page);
  r.on.me = () => ({ status: 401, body: { error: "unauthenticated", code: "UNAUTHENTICATED" } });
  r.on.now = r.on.me;
  await page.goto("/ai");
  await expect(page).toHaveURL(/\/login\?next=%2Fai$/);
});

test("K755-UI-011 外枠：左のメニューの「（名前）のAI」のまとまりから /ai に来られ、いまの画面として印が付く", async ({
  page,
}) => {
  await mockRoom(page);
  await openRoom(page);
  const nav = page.getByRole("navigation", { name: "メニュー", exact: true });
  const link = nav.locator('a[href="/ai"]');
  await expect(link).toHaveCount(1);
  await expect(link).toHaveAttribute("aria-current", "page");
});

test("K755-UI-012 スマホ（375）：1 列に積み、下に「高本のAI と話す」の入口が貼り付く・［話す］は /ai/talk へ。1440 では入口を出さない", async ({
  page,
}) => {
  await mockRoom(page);
  await openRoom(page, "/ai", 375);
  const entry = page.locator(".k-room-entry");
  await expect(entry).toBeVisible();
  await expect(entry).toContainText(`${NAME} と話す`);
  await expect(entry.getByRole("link", { name: "話す", exact: true })).toHaveAttribute("href", "/ai/talk");
  const cards = main(page).locator(".k-room-card");
  const a = (await cards.nth(0).boundingBox())!;
  const b = (await cards.nth(1).boundingBox())!;
  expect(b.y).toBeGreaterThan(a.y + a.height - 1);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator(".k-room-entry")).toBeHidden();
});

test("K755-UI-013 幅 320・375・768・1024・1440 で横溢れ 0（ようす・PC がまだ・閉じている）", async ({ page }) => {
  const cases: RoomOptions[] = [{}, { pc: "none", since: todayJst() }, { pc: "asleep" }];
  for (const o of cases) {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await mockRoom(page, o);
    for (const w of WIDTHS_ALL) {
      await openRoom(page, "/ai", w);
      expect(await overflowX(page), `${JSON.stringify(o)} 幅 ${w}`).toBeLessThanOrEqual(0);
    }
  }
});

test("K755-UI-014 守り：/ai を開いて読む口は getMyClone・getCloneNow・getCloneGrowth を 1 回ずつ。書く口 0・本人の Bridge（38617）に飛ばない", async ({
  page,
}) => {
  const r = await mockRoom(page);
  await openRoom(page);
  await expect(main(page).locator(".k-room-grid")).toBeVisible();
  expect(r.reads).toEqual({ me: 1, now: 1, growth: 1 });
  expect(r.writes).toEqual([]);
  expect(r.bridge).toBe(0);
});

test("K755-UI-015 キーボード：タブを Tab で順に辿れ、Enter で「話す」へ移る", async ({ page }) => {
  await mockRoom(page);
  await openRoom(page);
  const talk = tabs(page).getByRole("link", { name: "話す", exact: true });
  await talk.focus();
  await expect(talk).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(tabs(page).getByRole("link", { name: "やったこと", exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/ai\/talk$/);
});

/** 下絵と本番の突き合わせ（幅 375・768・1440）。比べない役は試験の名前と下の注に訳を書く */
async function match(page: Page, browser: Browser, id: string, o: RoomOptions, skip: string[] = []) {
  const bad: string[] = [];
  const live = (o.pc ?? "live") === "live";
  for (const w of MATCH_WIDTHS) {
    const r = await matchMock(
      browser,
      id,
      w,
      async (p) => {
        await mockRoom(p, o);
        await openRoom(p, "/ai", w);
      },
      { pairs: ROOM_NOW_PAIRS, base: "/dev/mock/f5", skip: w === 375 && live ? [...skip, ...ENTRY_SKIP] : skip },
    );
    bad.push(...r.bad);
  }
  expect(bad, bad.join("\n")).toEqual([]);
  void page;
}

// 注：下絵の「進みの棒」と EG-121 の「確認中」は、この葉が下絵の側（room-data.tsx の NOW・NEXT）を口の形に直す（changes:）。比べない役は無い。
//   スマホの下の入口（TalkEntry）は、下絵では room-mobile にだけ描いてある。本番は PC がつながっている間はいつも出す（前提と制約）ので、
//   ほかの状態の 375 は入口の役（entry）だけを比べない（下絵の 1 枚に 1 つの見せ場を描く作りのため）
const NOW_SKIP: string[] = [];
const ENTRY_SKIP = ["entry:当たった数"];

test("K755-UI-016 下絵との突き合わせ：room-overview（幅 375・768・1440・375 の下の入口は比べない）", async ({
  page,
  browser,
}) => {
  await match(page, browser, "room-overview", { now: { stopped: 1 } }, NOW_SKIP);
});
test("K755-UI-017 下絵との突き合わせ：room-idle", async ({ page, browser }) => {
  await match(page, browser, "room-idle", { now: { current: null, next: [], waiting_approvals: 0, stopped: 0 } });
});
test("K755-UI-018 下絵との突き合わせ：room-stopped", async ({ page, browser }) => {
  await match(page, browser, "room-stopped", {
    now: { current: null, next: NEXT_STOPPED, waiting_approvals: 0, stopped: 1 },
  });
});
test("K755-UI-019 下絵との突き合わせ：room-pc-none", async ({ page, browser }) => {
  await match(page, browser, "room-pc-none", { pc: "none", since: todayJst() });
});
test("K755-UI-020 下絵との突き合わせ：room-pc-closed", async ({ page, browser }) => {
  await match(
    page,
    browser,
    "room-pc-closed",
    { pc: "asleep", now: { current: null, waiting_approvals: 3, stopped: 0 } },
    NOW_SKIP,
  );
});
test("K755-UI-021 下絵との突き合わせ：room-failed（getCloneNow が 503）", async ({ browser }) => {
  const bad: string[] = [];
  for (const w of MATCH_WIDTHS) {
    const r = await matchMock(
      browser,
      "room-failed",
      w,
      async (p) => {
        const m = await mockRoom(p);
        m.on.now = () => err(503, "E-PAGE-003");
        await p.setViewportSize({ width: w, height: w === 375 ? 812 : 900 });
        await p.goto("/ai");
        await expect(p.locator("#k-main .k-state")).toBeVisible();
      },
      { pairs: ROOM_NOW_PAIRS, base: "/dev/mock/f5" },
    );
    bad.push(...r.bad);
  }
  expect(bad, bad.join("\n")).toEqual([]);
});
test("K755-UI-022 下絵との突き合わせ：room-mobile（375 の 1 列と下の入口・このあとは空）", async ({ browser }) => {
  const r = await matchMock(
    browser,
    "room-mobile",
    375,
    async (p) => {
      await mockRoom(p, { now: { next: [], stopped: 0 } });
      await openRoom(p, "/ai", 375);
    },
    { pairs: ROOM_NOW_PAIRS, base: "/dev/mock/f5" },
  );
  expect(r.bad, r.bad.join("\n")).toEqual([]);
});
