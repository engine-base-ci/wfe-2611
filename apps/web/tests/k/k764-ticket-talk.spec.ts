// K-764「画面：チケットの右のパネル『〈名〉のAI』タブと、帯の［AI と話す］［直し方を AI に伝える］」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f5 の tk-talk-panel・tk-talk-empty・tk-talk-working・tk-talk-band-running・tk-talk-pc-none
//   （代表 OK：2026-11-23）。口は網の手前で差し替える（ticket-talk-mock.ts の mockTicketTalk・詳細は approve-complete.harness.ts の mockApi）。
//   差し込み口は K-730 の TalkActSlot・TicketAiTabButtonSlot・TicketAiTabSlot（先のファイル fills/talk.tsx）。「見たもの」の 1 行は出さない（D-153.34）。
//   固定の待ちは使わない。name は { exact: true }。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, test, type Browser, type Page } from "@playwright/test";
import { openTicket, bandOf, k62Band } from "../features/F5/approve-complete.harness";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";
import { err, msg, overflowX, WIDTHS_ALL } from "./room-mock";
import { JOB, msgOf, at, sse } from "./talk-mock";
import { item } from "./list-mock";
import {
  EMPTY_SESSION,
  TICKET,
  PANEL_MSGS,
  TCONV,
  aiRegion,
  aiTab,
  mockTicketTalk,
  panel,
  panelBox,
  session,
  working,
} from "./ticket-talk-mock";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";

const RUNNING = { stage: "doing", run: { phase: "make", status: "running", pc: "live" } };
/** 題名の下の帯が何も出ない状態（下絵 tk-talk-panel・empty・working は帯なし）。本番も同じ状態で比べる（土台の既定は承認待ちの帯） */
const NO_BAND = { stage: "doing", can_delegate: false, approval: null, run: null };
/** やり取りの口（listTicketTimeline）が読んでいない 1 件を返す（右のパネルの「やり取り」の札が 1） */
const unreadOne = async (pg: Page): Promise<void> => {
  await pg.route(/\/api\/v1\/tickets\/[^/]+\/timeline(\?|$)/, (route) =>
    route.fulfill({ json: { data: [], meta: { new_count: 1, post_count: 1, next_cursor: null } } }),
  );
};
const STOPPED = {
  stage: "doing",
  can_delegate: true,
  run: {
    phase: "make",
    status: "stopped",
    pc: "live",
    stopped_reason: "先方の宛名が本文に無く、請求書を作れませんでした",
  },
};
const send = (p: Page) => aiRegion(p).getByRole("button", { name: "送る", exact: true });
const stopBtn = (p: Page) =>
  aiRegion(p).locator(".k-room-composer").getByRole("button", { name: "止める", exact: true });
const bubbles = (p: Page) => aiRegion(p).locator(".k-room-msg");
const openAi = async (p: Page) => {
  await aiTab(p).click();
  await expect(aiRegion(p)).toBeVisible();
};

test("K764-UI-001 入口：右のパネルのタブ「高本のAI」が押せる形になり、押すと AI と話す区画が開く（そのときだけ会話を 1 回読む）", async ({
  page,
}) => {
  const t = await mockTicketTalk(page);
  await openTicket(page);
  await expect(aiTab(page)).not.toHaveAttribute("aria-disabled", "true");
  expect(t.reads).toBe(0);
  await openAi(page);
  await expect(aiTab(page)).toHaveAttribute("aria-current", "page");
  await expect(aiRegion(page).locator(".k-room-aside")).toHaveText(
    "EG-133 のことを話します ・ やり取りの書き込みも読んでいます",
  );
  await expect.poll(() => t.reads).toBe(1);
});

test("K764-UI-002 まだ話していない：会話が無ければ「まだ話していません。このチケットで困っていることや、直したいことを書いてください」・書く欄は「このチケットのことを話す」", async ({
  page,
}) => {
  await mockTicketTalk(page);
  await openTicket(page);
  await openAi(page);
  await expect(aiRegion(page).locator(".k-room-note")).toHaveText(
    "まだ話していません。このチケットで困っていることや、直したいことを書いてください",
  );
  await expect(panelBox(page)).toHaveAttribute("placeholder", "このチケットのことを話す");
});

test("K764-UI-003 会話：在る会話は吹き出し（人は右・AI は左・時刻）で出る。「見たもの」の 1 行は出さない（D-153.34）・字は HTML にしない", async ({
  page,
}) => {
  await mockTicketTalk(page, {
    session: session({
      messages: [...PANEL_MSGS(), msgOf({ who: "ai", at: at(0, "10:42"), text: "<img src=x>は字のまま" })],
    }),
  });
  await openTicket(page);
  await openAi(page);
  await expect(bubbles(page)).toHaveCount(3);
  await expect(bubbles(page).nth(0)).toHaveAttribute("data-who", "me");
  await expect(bubbles(page).nth(1).locator(".k-room-msg-time")).toHaveText("10:41");
  await expect(aiRegion(page).locator(".k-room-took")).toHaveCount(0);
  await expect(bubbles(page).nth(2).locator("img")).toHaveCount(0);
  await expect(bubbles(page).nth(2)).toContainText("<img src=x>は字のまま");
});

test("K764-UI-004 言う：書いて［送る］で sendTicketAgentMessage に 1 回（体は { text } だけ）・欄が空になり会話を読み直す。二度押しでも 1 回", async ({
  page,
}) => {
  const t = await mockTicketTalk(page, { session: session() });
  await openTicket(page);
  await openAi(page);
  await panelBox(page).fill("宛名は経理部 山田様です");
  const open = t.hold();
  await send(page).click();
  await send(page).click({ force: true });
  open();
  await expect.poll(() => t.says.length).toBe(1);
  expect(t.says[0]).toEqual({ text: "宛名は経理部 山田様です" });
  await expect(panelBox(page)).toHaveValue("");
  await expect.poll(() => t.reads).toBeGreaterThanOrEqual(2);
});

test("K764-UI-005 作業中と止める：work が在れば作業中の 1 行と［止める］。押すと会話の止める口（conversation の id）に 1 回", async ({
  page,
}) => {
  const t = await mockTicketTalk(page, {
    session: session({
      messages: [PANEL_MSGS()[0]],
      running_job_id: JOB,
      work: working({ status: "考えています…（EG-097 の単価を確かめています）" }),
    }),
  });
  await openTicket(page);
  await openAi(page);
  await expect(aiRegion(page).locator(".k-room-work")).toHaveText("考えています…（EG-097 の単価を確かめています）");
  await stopBtn(page).click();
  await expect.poll(() => t.stops).toEqual([TCONV]);
});

test("K764-UI-006 書きながらと流れ：partial があれば書いている途中の返事が出る。区画を開いている間だけ流れを 1 本つなぎ、最初の ready では読み直さず change でチケットの会話の口（getTicketAgentSession）を読み直す", async ({
  page,
}) => {
  const t = await mockTicketTalk(page, {
    session: session({ running_job_id: JOB, work: working({ partial: "請求書の PDF を作り終えたところです。" }) }),
  });
  t.on.stream = () => sse("ready", "change");
  await openTicket(page);
  expect(t.streams.length).toBe(0);
  await openAi(page);
  await expect(aiRegion(page).locator(".k-room-caret")).toHaveCount(1);
  await expect.poll(() => t.streams).toEqual([TCONV]);
  await expect.poll(() => t.reads).toBe(2);
});

test("K764-UI-007 言う口の断り：409 E-TALK-050 は PC の案内（書く欄は書けるまま）・409 E-TALK-012 は書く欄の注・403 は「このチケットを直す権限が無いので、AI と話せません」・404 は「このチケットは見られません」・503 は帯「送れませんでした」と正本 E-PAGE-003 の文。書いた字は欄に残る", async ({
  page,
}) => {
  const t = await mockTicketTalk(page, { session: session() });
  await openTicket(page);
  await openAi(page);
  for (const [status, code, text] of [
    [409, "E-TALK-050", "PC がまだつながっていません"],
    [409, "E-TALK-012", null],
    [403, "FORBIDDEN", "このチケットを直す権限が無いので、AI と話せません"],
    [404, "NOT_FOUND", "このチケットは見られません"],
    [503, "E-PAGE-003", null],
  ] as const) {
    t.on.say = () => err(status, code);
    await panelBox(page).fill("作り直して");
    await send(page).click();
    await expect(aiRegion(page)).toContainText(text ?? msg(code).split("。")[0]!);
    if (code === "E-PAGE-003")
      await expect(aiRegion(page).locator(".k-callout").filter({ hasText: "送れませんでした" })).toBeVisible();
    await expect(panelBox(page)).toHaveValue("作り直して");
    await expect(panelBox(page)).toBeEnabled();
  }
});

test("K764-UI-008 PC がまだ：pc が none なら「まだ話していません」・黄色の箱「PC がまだつながっていません」（話すにも PC が要ります…）・書く欄は書けない", async ({
  page,
}) => {
  await mockTicketTalk(page, { pc: "none" });
  await openTicket(page);
  await openAi(page);
  await expect(aiRegion(page).locator(".k-room-note")).toHaveText("まだ話していません");
  await expect(aiRegion(page)).toContainText("話すにも PC が要ります。PC をつなぐと、このチケットのことを話せます");
  await expect(panelBox(page)).toBeDisabled();
});

test("K764-UI-009 会話が読めない：agent-session が 404 なら「このチケットは見られません」・503 は読めない箱と［もう一度］で読み直せる", async ({
  page,
}) => {
  const t = await mockTicketTalk(page);
  t.on.session = () => err(503, "E-PAGE-003");
  await openTicket(page);
  await openAi(page);
  await expect(aiRegion(page).locator(".k-state")).toBeVisible();
  t.on.session = () => ({ status: 200, body: { data: session() } });
  await aiRegion(page).getByRole("button", { name: "もう一度", exact: true }).click();
  await expect(bubbles(page)).toHaveCount(2);
  t.on.session = () => ({ status: 404, body: { error: "not_found", code: "NOT_FOUND" } });
  await page.reload();
  await openAi(page);
  await expect(aiRegion(page)).toContainText("このチケットは見られません");
});

test("K764-UI-010 帯の［AI と話す］：作っている間の帯の［AI と話す］を押すと、右のパネルが「高本のAI」タブで開き、書く欄に焦点が来る（書く口は呼ばない）。パネルを閉じていても開く", async ({
  page,
}) => {
  const t = await mockTicketTalk(page, { band: RUNNING });
  await openTicket(page);
  await page.getByRole("button", { name: "パネルを閉じる", exact: true }).click();
  await k62Band(page).getByRole("button", { name: "AI と話す", exact: true }).click();
  await expect(aiTab(page)).toHaveAttribute("aria-current", "page");
  await expect(panelBox(page)).toBeFocused();
  expect(t.writes).toEqual([]);
});

test("K764-UI-012 帯のボタンの出し分け：任せる前（任せられる・作業中）・承認待ち・止まったには［AI と話す］を出さない（作っている・任せました の間だけ）。止まった帯に［直し方を AI に伝える］も無い（代表の決め answer=4d049789b537）", async ({
  page,
}) => {
  await mockTicketTalk(page, { band: { stage: "doing", can_delegate: true } });
  await openTicket(page);
  await expect(page.getByRole("button", { name: "AI と話す", exact: true })).toHaveCount(0);
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await mockTicketTalk(page);
  await openTicket(page);
  await expect(bandOf(page).getByRole("button", { name: "AI と話す", exact: true })).toHaveCount(0);
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await mockTicketTalk(page, { band: STOPPED });
  await openTicket(page);
  await expect(k62Band(page).getByRole("alert")).toContainText("先方の宛名が本文に無く、請求書を作れませんでした");
  await expect(k62Band(page).getByRole("button", { name: "AI と話す", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "直し方を AI に伝える", exact: true })).toHaveCount(0);
});

test("K764-UI-013 ほかのタブへ戻る：「やり取り」のタブへ戻ると AI の区画は閉じ、流れの口も閉じる（開いていた流れの要求が取り消される）。開き直すと流れは 1 本だけ", async ({
  page,
}) => {
  const t = await mockTicketTalk(page, { session: session() });
  t.hang = true;
  const aborted: string[] = [];
  page.on("requestfailed", (r) => {
    if (/\/stream$/.test(new URL(r.url()).pathname)) aborted.push(r.url());
  });
  await openTicket(page);
  await openAi(page);
  await expect.poll(() => t.streams.length).toBe(1);
  await panel(page)
    .getByRole("navigation", { name: "パネルのタブ", exact: true })
    .getByRole("button", { name: /やり取り/ })
    .click();
  await expect(aiRegion(page)).toHaveCount(0);
  await expect.poll(() => aborted.length).toBe(1);
  await openAi(page);
  await expect.poll(() => t.streams.length).toBe(2);
});

test("K764-UI-014 スマホ（375）：「高本のAI」タブは詳細の下に積まず全画面の別画面（本文の区画は見えない・頭に「‹ EG-133 11 月分の請求書を送る」と「AI との相談」）・「‹」で詳細へ戻る", async ({
  page,
}) => {
  await mockTicketTalk(page, { session: session() });
  await openTicket(page, 375);
  await openAi(page);
  await expect(page.locator(".k-detail")).toHaveAttribute("data-mtab", "ai");
  await expect(page.locator("section.k-page").first()).toBeHidden();
  await expect(page.locator(".k-room-tbar b")).toHaveText("EG-133 11 月分の請求書を送る");
  await expect(page.locator(".k-room-tbar span")).toHaveText("AI との相談");
  await page.getByRole("button", { name: "チケットの詳細へ戻る", exact: true }).click();
  await expect(aiRegion(page)).toHaveCount(0);
  await expect(page.locator("section.k-page").first()).toBeVisible();
});

test("K764-UI-015 幅 320・375・768・1024・1440 で、AI の区画を開いても横溢れ 0", async ({ page }) => {
  await mockTicketTalk(page, { session: session() });
  for (const w of WIDTHS_ALL) {
    await openTicket(page, w);
    await openAi(page);
    expect(await overflowX(page), `幅 ${w}`).toBeLessThanOrEqual(0);
  }
});

test("K764-UI-016 守り：詳細を開いただけでは会話の口も流れも呼ばない・開いて読む会話の口は 1 回・押していない書く口 0・本人の Bridge に飛ばない", async ({
  page,
}) => {
  const t = await mockTicketTalk(page, { session: session() });
  let bridge = 0;
  await page.route(/127\.0\.0\.1:38617/, (r) => {
    bridge++;
    return r.fulfill({ status: 404, body: "" });
  });
  await openTicket(page);
  expect(t.reads + t.streams.length).toBe(0);
  await openAi(page);
  await expect(bubbles(page)).toHaveCount(2);
  expect(t.writes).toEqual([]);
  expect(bridge).toBe(0);
});

test("K764-UI-019 道に残す：?ai=1 で開くと右のパネルが「高本のAI」タブで開いた形で始まり、会話を 1 回読む（最初の ready では読み直さない・作った直後に作る画面から来る入口・K-767）", async ({
  page,
}) => {
  const t = await mockTicketTalk(page, { session: session() });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/tickets/0193c5a0-0000-7000-8000-00000000c063?ai=1`);
  await expect(aiTab(page)).toHaveAttribute("aria-current", "page");
  await expect(bubbles(page)).toHaveCount(2);
  await expect.poll(() => t.streams.length).toBe(1);
  expect(t.reads).toBe(1);
});

test("K764-UI-020 入っていない：チケットの会話の口・言う口が 401 ならログインへ（戻り先はこのチケット）", async ({
  page,
}) => {
  const t = await mockTicketTalk(page);
  t.on.session = () => ({ status: 401, body: { error: "unauthenticated", code: "UNAUTHENTICATED" } });
  await openTicket(page);
  await aiTab(page).click();
  await expect(page).toHaveURL(/\/login\?next=%2Ftickets%2F/);
});

test("K764-UI-021 止める口の失敗（手順 S3 の失敗）：止める口が 503 なら区画の中に正本の文・会話を読み直し、［止める］は押し直せる", async ({
  page,
}) => {
  const t = await mockTicketTalk(page, {
    session: session({ messages: [PANEL_MSGS()[0]], running_job_id: JOB, work: working() }),
  });
  t.on.stop = () => err(503, "E-PAGE-003");
  await openTicket(page);
  await openAi(page);
  const n = t.reads;
  await stopBtn(page).click();
  await expect(aiRegion(page)).toContainText(msg("E-PAGE-003").split("。")[0]!);
  await expect.poll(() => t.reads).toBeGreaterThan(n);
  await expect(stopBtn(page)).toBeEnabled();
});

test("K764-UI-022 横の詳細（一覧の右に開く詳細）：帯の［AI と話す］を押すと、そのチケットの詳細を ?ai=1 で開く（横の詳細には右のパネルが無いので）", async ({
  page,
}) => {
  await mockTicketTalk(page, { band: RUNNING });
  // ?open=<番号> は一覧の口を q=<番号>・view=all で引いて id を決める（K-252）。土台の mockApi は一覧に答えないので、EG-133 の 1 行を返す
  await page.route(
    (u) => u.pathname === "/api/v1/tickets",
    (route) =>
      route.request().method() === "GET"
        ? route.fulfill({
            json: {
              data: [item(0, { id: TICKET, number: "EG-133", title: "セイコー様へ 11 月分の請求書を送る" })],
              meta: { next_cursor: null },
            },
          })
        : route.fallback(),
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/tickets?open=EG-133");
  const b = page.getByRole("region", { name: "AI に任せる" }).getByRole("button", { name: "AI と話す", exact: true });
  await b.click();
  await expect(page).toHaveURL(/\/tickets\/0193c5a0-0000-7000-8000-00000000c063\?ai=1/);
});

const BOX = ["width", "height", "x", "y", "background-color", "border-top-color", "border-top-left-radius"];
const TEXT = ["font-size", "font-weight", "color", "line-height", "texts"];
const CTRL = [
  "width",
  "height",
  "x",
  "y",
  "font-size",
  "color",
  "background-color",
  "border-top-color",
  "opacity",
  "texts",
];
const p = (role: string, sel: string, props: string[]): FidelityPair => ({
  name: role,
  role,
  canvas: sel,
  app: sel,
  props,
});
const PANEL_PAIRS: FidelityPair[] = [
  p("ptabs", ".k-detail-tabs", ["x", "y", "width", "texts"]),
  p("ptab-on", '.k-detail-tabs [aria-current="page"]', CTRL),
  p("region", ".k-room-panel", ["x", "y", "width"]),
  p("aside", ".k-room-panel .k-room-aside", ["x", "y", ...TEXT]),
  p("note", ".k-room-panel .k-room-note", ["x", "y", ...TEXT]),
  p("bubble-me", '.k-room-panel .k-room-msg[data-who="me"] .k-room-bubble', BOX),
  p("bubble-ai", '.k-room-panel .k-room-msg[data-who="ai"] .k-room-bubble', ["x", "y", "width", "background-color"]),
  p("took", ".k-room-panel .k-room-took", ["texts"]),
  p("work", ".k-room-panel .k-room-work", ["x", "y", ...TEXT]),
  p("callout", ".k-room-panel .k-callout", [...BOX, "texts"]),
  p("looking", ".k-room-looking", ["x", "y", ...TEXT]),
  p("composer", ".k-room-panel .k-room-composer", BOX),
  p("send", ".k-room-panel .k-room-send", CTRL),
  p("quota", ".k-room-panel .k-room-quota", ["texts"]),
  p("band-acts", ".k-detail-bands .k-band button", CTRL),
  p("tbar", ".k-room-tbar", ["x", "y", "width", "height"]),
];
// 注：「見たもの」・「5 時間の枠」は K-755 が下絵の側を直す。比べない役と訳：
//   looking・aside の字（下絵は EG-128・土台のチケットは EG-133）／ptabs の字（下絵の「やり取り 1」の数は土台に new_count が無い・スマホの「本文」は前からのタブの字「属性」）／
//   band-acts の字と薄さ（［止める］は K-734 の物で入る前は押せない形・PC がまだの帯は任せる帯の物）
const SKIP = [
  "looking:texts",
  "aside:texts",
  "ptabs:texts",
  "band-acts:texts",
  "band-acts:opacity",
  "band-acts:当たった数",
];
async function match(
  browser: Browser,
  id: string,
  o: Parameters<typeof mockTicketTalk>[1],
  after?: (pg: Page) => Promise<void>,
  before?: (pg: Page) => Promise<void>,
) {
  const bad: string[] = [];
  for (const w of MATCH_WIDTHS) {
    const r = await matchMock(
      browser,
      id,
      w,
      async (pg) => {
        await mockTicketTalk(pg, o);
        if (before) await before(pg);
        await openTicket(pg, w);
        // openTicket は高さ 1000 で開く。比べる下絵と同じ画面の大きさ（matchMock：375 は 812・ほかは 900）に戻す
        await pg.setViewportSize({ width: w, height: w === 375 ? 812 : 900 });
        await openAi(pg);
        if (after) await after(pg);
      },
      { pairs: PANEL_PAIRS, base: "/dev/mock/f5", skip: SKIP },
    );
    bad.push(...r.bad);
  }
  expect(bad, bad.join("\n")).toEqual([]);
}

test("K764-UI-017 下絵との突き合わせ：tk-talk-panel・tk-talk-empty・tk-talk-working", async ({ browser }) => {
  // 下絵 tk-talk-panel は「やり取り」のタブに読んでいない 1 件の札がある。本番も同じ状態（やり取りの口の new_count 1）で比べる
  await match(browser, "tk-talk-panel", { band: NO_BAND, session: session() }, undefined, unreadOne);
  await match(browser, "tk-talk-empty", { band: NO_BAND, session: EMPTY_SESSION });
  await match(browser, "tk-talk-working", {
    band: NO_BAND,
    session: session({
      messages: [PANEL_MSGS()[0]],
      running_job_id: JOB,
      work: working({ status: "考えています…（EG-097 の単価を確かめています）" }),
    }),
  });
});

test("K764-UI-018 下絵との突き合わせ：tk-talk-band-running・tk-talk-pc-none", async ({ browser }) => {
  // 下絵 tk-talk-band-running の帯は作っている間の 1 行「見積の金額を確かめています」がある。本番も同じ状態（実行の progress）で比べる
  await match(browser, "tk-talk-band-running", {
    band: { ...RUNNING, run: { ...RUNNING.run, progress: "見積の金額を確かめています" } },
    session: session({
      messages: [
        msgOf({ who: "me", at: at(0, "10:45"), text: "いまどこまで進んだ？" }),
        msgOf({
          who: "ai",
          at: at(0, "10:45"),
          text: "請求書の PDF を作り終えたところです。これから金額を見積と突き合わせます。",
        }),
      ],
    }),
  });
  // 下絵 tk-talk-pc-none は任せる前（作業中・承認なし・実行なし）で PC がまだの帯。本番も同じ状態で比べる
  await match(browser, "tk-talk-pc-none", {
    band: { stage: "doing", can_delegate: true, approval: null, run: null },
    pc: "none",
    session: EMPTY_SESSION,
  });
});
