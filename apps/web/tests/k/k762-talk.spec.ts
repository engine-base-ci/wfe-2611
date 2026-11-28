// K-762「画面：分身の部屋の『話す』（/ai/talk）」の画面の試験（実 Chrome・実装より先に積む）。
//   正のモック：/dev/mock/f5 の talk-convs・talk-chat-mobile・talk-new・talk-sending・talk-working・talk-writing・talk-stopped・talk-stopped-pc・
//   talk-permission・talk-pc-none（代表 OK：2026-11-23）。口は網の手前で差し替える（talk-mock.ts の mockTalk・頭は room-mock.ts）。
//   答えの形は 11_tickets/K-757.md（会話）・K-758.md（言う・止める）・K-759.md（流れ）。「見たもの」の 1 行は出さない（D-153.34）。
//   固定の待ちは使わない（時間は page.clock で進める）。name は { exact: true }。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  C1,
  C2,
  C_NEW,
  JOB,
  ME_Q2,
  LIST_MSGS,
  at,
  composer,
  convList,
  mockTalk,
  msgOf,
  sse,
  thread,
  view,
  working,
} from "./talk-mock";
import { ROOT, ROOM_HEAD_PAIRS, WIDTHS_ALL, err, msg, openRoom, overflowX, tabs, todayJst } from "./room-mock";
import { MATCH_WIDTHS, matchMock } from "./stage2-match";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";

const chat = (p: Page) => p.getByRole("region", { name: "会話", exact: true }).or(p.locator("section.k-room-chat"));
const send = (p: Page) => p.locator(".k-room-composer").getByRole("button", { name: "送る", exact: true });
const stop = (p: Page) => p.locator(".k-room-composer").getByRole("button", { name: "止める", exact: true });
const bubbles = (p: Page) => thread(p).locator(".k-room-msg");

test("K762-UI-001 入口：/ai/talk を開くとタブ「話す」が今の印・左に会話の一覧（新しい順・今日／それ以前の見出し）・いちばん新しい会話が開き、道に ?c=<id> が付く", async ({
  page,
}) => {
  const t = await mockTalk(page);
  await openRoom(page, "/ai/talk");
  await expect(tabs(page).getByRole("link", { name: "話す", exact: true })).toHaveAttribute("aria-current", "page");
  const items = convList(page).locator(".k-room-conv");
  await expect(items).toHaveCount(3);
  await expect(items.nth(0).locator("b")).toHaveText("来月の営業の段取りを考えたい");
  await expect(items.nth(0).locator("span")).toHaveText("今日 09:40");
  await expect(items.nth(0)).toHaveAttribute("aria-current", "true");
  await expect(convList(page).locator(".k-room-conv-group")).toHaveText(["今日", "それ以前"]);
  await expect(page).toHaveURL(new RegExp(`[?&]c=${C1}`));
  await expect.poll(() => t.reads).toEqual([C1]);
});

test("K762-UI-002 会話：人の言葉は右・AI の返事は左の吹き出しに時刻（HH:mm）と日の見出し・「見たもの」の 1 行は出さない（D-153.34）・字は書かれたとおり（HTML にしない）", async ({
  page,
}) => {
  const t = await mockTalk(page);
  t.on.view = () => ({
    status: 200,
    body: {
      data: view({
        messages: [...LIST_MSGS(), msgOf({ who: "ai", at: at(0, "09:42"), text: "<b>太字</b>にしない", took: null })],
      }),
    },
  });
  await openRoom(page, "/ai/talk");
  await expect(bubbles(page)).toHaveCount(3);
  await expect(bubbles(page).nth(0)).toHaveAttribute("data-who", "me");
  await expect(bubbles(page).nth(1)).toHaveAttribute("data-who", "ai");
  await expect(bubbles(page).nth(0).locator(".k-room-msg-time")).toHaveText("09:40");
  await expect(thread(page).locator(".k-room-day-sep")).toHaveCount(1);
  await expect(thread(page).locator(".k-room-took")).toHaveCount(0);
  await expect(bubbles(page).nth(2).locator(".k-room-bubble")).toHaveText("<b>太字</b>にしない");
  await expect(bubbles(page).nth(2).locator("b")).toHaveCount(0);
});

test("K762-UI-003 知らせの行（who note）と止まった印（who stopped）は 1 行の知らせとして真ん中に出る", async ({
  page,
}) => {
  const t = await mockTalk(page);
  t.on.view = () => ({
    status: 200,
    body: {
      data: view({
        messages: [
          ...LIST_MSGS(),
          msgOf({
            who: "note",
            at: at(0, "09:45"),
            text: "高本のAI が許可を求めましたが、自動で断りました（許可に答える画面はまだ使えません）",
          }),
        ],
      }),
    },
  });
  await openRoom(page, "/ai/talk");
  await expect(thread(page).locator(".k-room-sys")).toHaveText([
    "高本のAI が許可を求めましたが、自動で断りました（許可に答える画面はまだ使えません）",
  ]);
});

test("K762-UI-004 会話を選ぶ：一覧の別の会話を押すとその会話を読んで開き、道の ?c が替わる・前の会話の流れは閉じて今の会話の流れを 1 本開く。?c=<id> で開き直すとその会話が開く", async ({
  page,
}) => {
  const t = await mockTalk(page);
  await openRoom(page, "/ai/talk");
  await expect.poll(() => t.streams).toEqual([C1]);
  await convList(page)
    .getByRole("button", { name: /保守更新 3 社の更新案/ })
    .click();
  await expect.poll(() => t.reads.at(-1)).toBe(C2);
  await expect(page).toHaveURL(new RegExp(`[?&]c=${C2}`));
  await expect.poll(() => t.streams.at(-1)).toBe(C2);
  const c1Reads = t.reads.filter((r) => r === C1).length;
  t.on.stream = () => sse("ready", "change");
  await expect.poll(() => t.reads.filter((r) => r === C2).length).toBeGreaterThanOrEqual(1);
  expect(t.reads.filter((r) => r === C1).length, "前の会話はもう読まない").toBe(c1Reads);
  await page.goto(`/ai/talk?c=${C2}`);
  await expect.poll(() => t.reads.at(-1)).toBe(C2);
  await expect(convList(page).locator('.k-room-conv[aria-current="true"] b')).toHaveText("保守更新 3 社の更新案");
});

test("K762-UI-005 古い行：開いた時は一番下（新しい行）へ送り、開いただけでは読まない。has_more が真で人が上の端まで巻くと、いちばん古い行の鍵 base64url(<at>|<id>) を cursor に listConversationMessages を読み、行が上に足される", async ({
  page,
}) => {
  const t = await mockTalk(page);
  const msgs = LIST_MSGS();
  t.on.view = () => ({ status: 200, body: { data: view({ messages: msgs, has_more: true }) } });
  t.on.older = () => ({
    status: 200,
    body: { data: [msgOf({ who: "me", at: at(1, "18:00"), text: "昨日の話の続き" })], meta: { limit: 50 } },
  });
  await openRoom(page, "/ai/talk");
  await expect(bubbles(page)).toHaveCount(2);
  expect(t.olders.length, "開いただけでは読まない").toBe(0);
  await page.mouse.wheel(0, -5000);
  await expect.poll(() => t.olders.length).toBe(1);
  const first = msgs[0] as { at: string; id: string };
  expect(t.olders[0]!["cursor"]).toBe(Buffer.from(`${first.at}|${first.id}`).toString("base64url"));
  await expect(bubbles(page)).toHaveCount(3);
  await expect(bubbles(page).nth(0)).toContainText("昨日の話の続き");
});

test("K762-UI-006 新しく話す：［＋ 新しく話す］で何も話していない会話（「高本のAI に、何でも話せます」）になり、一覧の上に「新しい会話」・道は ?new=1（?c は消える）。口はまだ呼ばない", async ({
  page,
}) => {
  const t = await mockTalk(page);
  await openRoom(page, "/ai/talk");
  await convList(page).getByRole("button", { name: "＋ 新しく話す", exact: true }).click();
  await expect
    .poll(async () => (await chat(page).locator(".k-room-empty h2").textContent())?.replace(/⁠/g, ""))
    .toBe("高本のAI に、何でも話せます");
  await expect(convList(page).locator('.k-room-conv[aria-current="true"] b')).toHaveText("新しい会話");
  await expect(page).not.toHaveURL(/[?&]c=/);
  await expect(page).toHaveURL(/[?&]new=1/);
  expect(t.creates).toBe(0);
});

test("K762-UI-007 送る（新しい会話）：書いて［送る］で、会話を作る口 1 回 → 言う口 1 回（体は { text } だけ）。欄が空になり、作った会話が一覧の上で開き ?c=<新しい id>", async ({
  page,
}) => {
  const t = await mockTalk(page);
  await openRoom(page, "/ai/talk");
  await convList(page).getByRole("button", { name: "＋ 新しく話す", exact: true }).click();
  await composer(page).fill("セイコー様の更新案の下書きを作って");
  await send(page).click();
  await expect.poll(() => t.says.length).toBe(1);
  expect(t.creates).toBe(1);
  expect(t.says[0]).toEqual({ id: C_NEW, body: { text: "セイコー様の更新案の下書きを作って" } });
  await expect(composer(page)).toHaveValue("");
  await expect(page).toHaveURL(new RegExp(`[?&]c=${C_NEW}`));
  await expect.poll(() => t.reads.at(-1)).toBe(C_NEW);
});

test("K762-UI-008 送る（今の会話）：会話を作らず今の会話に言う。答えを待つ間は［送る］が処理中で押せず、二度押しでも言う口は 1 回", async ({
  page,
}) => {
  const t = await mockTalk(page);
  await openRoom(page, "/ai/talk");
  await composer(page).fill("保守更新の更新案は、セイコー様から先に出したい");
  const open = t.room.hold();
  await send(page).click();
  await send(page).click({ force: true });
  await expect(send(page)).toHaveAttribute("aria-busy", "true");
  open();
  await expect.poll(() => t.says.length).toBe(1);
  expect(t.creates).toBe(0);
  expect(t.says[0]!.id).toBe(C1);
});

test("K762-UI-009 書く欄：空・空白だけなら［送る］は押せない。Enter は改行・⌘／Ctrl＋Enter で送る。送った字は前後の空白を落とさず書いたとおり", async ({
  page,
}) => {
  const t = await mockTalk(page);
  await openRoom(page, "/ai/talk");
  await composer(page).fill("  \n ");
  await expect(send(page)).toBeDisabled();
  await composer(page).fill("1 行目");
  await composer(page).press("Enter");
  await composer(page).pressSequentially("2 行目");
  expect(t.says.length).toBe(0);
  await composer(page).press("ControlOrMeta+Enter");
  await expect.poll(() => t.says.length).toBe(1);
  expect(t.says[0]!.body).toEqual({ text: "1 行目\n2 行目" });
});

test("K762-UI-010 作業中：work が running なら作業中の 1 行（status の字）が出て、書く欄の［送る］の代わりに［止める］。押すと止める口 1 回・読み直して止まりを見る", async ({
  page,
}) => {
  const t = await mockTalk(page);
  let stopped = false;
  t.on.view = () => ({
    status: 200,
    body: {
      data: stopped
        ? view({
            messages: [
              ...LIST_MSGS(),
              ME_Q2(),
              msgOf({
                who: "stopped",
                at: at(0, "09:46"),
                text: "高本が AI を止めました。ここまでの返事は残っています",
              }),
            ],
            stopped: { job_id: JOB, reason: "あなたが止めました" },
          })
        : view({ messages: [...LIST_MSGS(), ME_Q2()], running_job_id: JOB, work: working() }),
    },
  });
  await openRoom(page, "/ai/talk");
  await expect(thread(page).locator(".k-room-work")).toHaveText("考えています…（EG-124 の見積を確かめています）");
  await expect(send(page)).toHaveCount(0);
  t.on.stop = () => {
    stopped = true;
    return { status: 201, body: { data: { state: "stopping" } } };
  };
  await stop(page).click();
  await expect.poll(() => t.stops).toEqual([C1]);
  await expect(
    chat(page).getByText("止まった理由：あなたが止めました。続けるには、言葉を書いて送ってください", { exact: true }),
  ).toBeVisible();
  await expect(send(page)).toBeVisible();
});

test("K762-UI-011 止めている間：work.stopping が真なら［止める］は押せない形（二度押しでも止める口は 1 回）", async ({
  page,
}) => {
  const t = await mockTalk(page);
  t.on.view = () => ({ status: 200, body: { data: view({ running_job_id: JOB, work: working({ stopping: true }) }) } });
  await openRoom(page, "/ai/talk");
  await expect(stop(page)).toBeDisabled();
  await stop(page).click({ force: true });
  expect(t.stops.length).toBe(0);
});

test("K762-UI-012 書きながら：work.partial が在れば、書いている途中の返事（末尾の印）と「書いています…」が出る", async ({
  page,
}) => {
  const t = await mockTalk(page);
  const partial = "セイコー様は 12/15 が期限なので先に出すのがよさそうです。";
  t.on.view = () => ({
    status: 200,
    body: { data: view({ messages: [...LIST_MSGS(), ME_Q2()], running_job_id: JOB, work: working({ partial }) }) },
  });
  await openRoom(page, "/ai/talk");
  const s = thread(page).locator(".k-room-caret");
  await expect(s).toHaveCount(1);
  await expect(thread(page).locator('[aria-live="polite"]')).toHaveText(partial);
  await expect(thread(page).getByText("書いています…", { exact: true })).toBeVisible();
});

test("K762-UI-013 流れ：会話を開くと流れを 1 本つなぐ。開いた直後の最初の ready では読み直さず、change で読み直す（同じ瞬間の change は 1 回の読み直しにまとまる）", async ({
  page,
}) => {
  const t = await mockTalk(page);
  t.on.stream = () => sse("ready", "change", "change");
  await openRoom(page, "/ai/talk");
  await expect.poll(() => t.streams.length).toBeGreaterThanOrEqual(1);
  expect(t.streams[0]).toBe(C1);
  await expect.poll(() => t.reads.filter((r) => r === C1).length).toBe(2);
});

test("K762-UI-014 流れが使えない：503（E-TALK-020）・down なら見に行く形（作業中の間だけ 5 秒ごとに読む）に戻る。end:reconnect はすぐつなぎ直す（そのときの ready で読み直す）。end:unauthenticated はログインへ", async ({
  page,
}) => {
  await page.clock.install();
  const t = await mockTalk(page);
  t.on.stream = () => null;
  t.on.view = () => ({ status: 200, body: { data: view({ running_job_id: JOB, work: working() }) } });
  await openRoom(page, "/ai/talk");
  let n = t.reads.length;
  await page.clock.runFor(5_100);
  await expect.poll(() => t.reads.length).toBeGreaterThan(n);
  t.on.stream = () => sse("ready", "down");
  await page.reload();
  n = t.reads.length;
  await page.clock.runFor(5_100);
  await expect.poll(() => t.reads.length).toBeGreaterThan(n);
  let first = true;
  t.on.stream = () => (first ? ((first = false), sse("ready", "end:reconnect")) : sse("ready"));
  await page.reload();
  await expect.poll(() => t.streams.length).toBeGreaterThanOrEqual(4);
  t.on.stream = () => sse("end:unauthenticated");
  await page.reload();
  await expect(page).toHaveURL(/\/login\?next=%2Fai%2Ftalk/);
});

test("K762-UI-015 止まった（PC が閉じた）：PC が閉じている（pc asleep）で stopped なら赤い帯「AI が止まりました」・書く欄は「PC を開くと話せます」で書けない", async ({
  page,
}) => {
  const t = await mockTalk(page, { pc: "asleep" });
  t.on.view = () => ({
    status: 200,
    body: { data: view({ messages: [...LIST_MSGS(), ME_Q2()], stopped: { job_id: JOB, reason: "PC が閉じました" } }) },
  });
  await openRoom(page, "/ai/talk");
  const note = chat(page).locator('[role="alert"], .k-callout').filter({ hasText: "AI が止まりました" });
  await expect(note).toContainText(
    "止まった理由：PC が閉じました。高本の MacBook を開くと、続きから話せます。送った言葉は残っています",
  );
  await expect(composer(page)).toBeDisabled();
  await expect(composer(page)).toHaveAttribute("placeholder", "PC を開くと話せます");
});

test("K762-UI-016 PC がまだ（pc none）：PC をつなぐ案内（［PC をつなぐ（3 分）］は /setup/bridge）・書く欄は「PC をつなぐと話せます」で書けない・会話が無ければ「PC をつなぐと、高本のAIと話せます」", async ({
  page,
}) => {
  await mockTalk(page, { pc: "none", rows: [] });
  await openRoom(page, "/ai/talk");
  await expect(chat(page).locator(".k-room-pc")).toContainText("PC がまだつながっていません");
  await expect(
    chat(page).locator(".k-room-pc").getByRole("link", { name: "PC をつなぐ（3 分）", exact: true }),
  ).toHaveAttribute("href", "/setup/bridge");
  await expect(composer(page)).toBeDisabled();
  await expect(composer(page)).toHaveAttribute("placeholder", "PC をつなぐと話せます");
  await expect
    .poll(async () => (await chat(page).locator(".k-room-empty h2").textContent())?.replace(/⁠/g, ""))
    .toBe("PC をつなぐと、高本のAIと話せます");
});

test("K762-UI-017 言う口の断り：409 E-TALK-012 は書く欄の注・E-TALK-011 は正本の文（ここからは話せない会話）・E-TALK-010 は PC の案内・503 は帯「送れませんでした」と口の返した番号の正本の文。どれも書いた字は欄に残る", async ({
  page,
}) => {
  const t = await mockTalk(page);
  await openRoom(page, "/ai/talk");
  for (const [status, code] of [
    [409, "E-TALK-012"],
    [409, "E-TALK-011"],
    [409, "E-TALK-010"],
    [503, "E-PAGE-003"],
  ] as const) {
    t.on.say = () => err(status, code);
    await composer(page).fill("保守更新の更新案");
    await send(page).click();
    if (code === "E-TALK-010")
      await expect(chat(page).locator(".k-room-pc")).toContainText("PC がまだつながっていません");
    else await expect(chat(page)).toContainText(msg(code).split("。")[0]!);
    if (code === "E-PAGE-003")
      await expect(chat(page).locator(".k-callout").filter({ hasText: "送れませんでした" })).toBeVisible();
    await expect(composer(page)).toHaveValue("保守更新の更新案");
  }
});

test("K762-UI-018 会話が読めない：getConversation が 404（消した・古い ?c）なら「この会話はありません」と一覧は残り、新しく話せる。503 は読めない箱と［もう一度］", async ({
  page,
}) => {
  const t = await mockTalk(page);
  t.on.view = () => ({ status: 404, body: { error: "not_found", code: "NOT_FOUND" } });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/ai/talk?c=${C2}`);
  await expect(chat(page)).toContainText("この会話はありません");
  await expect(convList(page).locator(".k-room-conv")).toHaveCount(3);
  // 流れの ready（つなぎ直しの ready も）でも読み直す（K-762）。押す前に 200 へ替えると、その読み直しが先に通って
  //   読めない箱と［もう一度］が消え、押せなくなる。押すまでは 503 のまま返し、押す直前に 200 へ替える
  let pressed = false;
  t.on.view = (id) => (pressed ? { status: 200, body: { data: view({}, { id }) } } : err(503, "E-PAGE-003"));
  const streams0 = t.streams.length;
  await page.reload();
  await expect(chat(page).locator(".k-state")).toBeVisible();
  await expect.poll(() => t.streams.length).toBeGreaterThan(streams0);
  const again = chat(page).getByRole("button", { name: "もう一度", exact: true });
  await expect(again).toBeVisible();
  const reads0 = t.reads.length;
  pressed = true;
  await again.click();
  await expect.poll(() => t.reads.length).toBeGreaterThan(reads0);
  await expect(bubbles(page)).toHaveCount(2);
});

test("K762-UI-019 押せない形のまま：［＋ 添付］［許可：毎回聞く ▾］［星をつけた会話］［会話を探す］は在るが押せない（title「まだ使えません」・D-153.16）", async ({
  page,
}) => {
  const t = await mockTalk(page);
  await openRoom(page, "/ai/talk");
  for (const name of ["＋ 添付", "許可：毎回聞く ▾", "星をつけた会話", "会話を探す"]) {
    const b = page.getByRole("button", { name, exact: true });
    await expect(b).toHaveAttribute("aria-disabled", "true");
    await expect(b).toHaveAttribute("title", "まだ使えません");
  }
  expect(t.room.writes).toEqual([]);
});

test("K762-UI-020 スマホ（375）：?c が無ければ会話の一覧だけの画面（いちばん新しい会話に選んだ印・?c は付けない）・会話を押すと会話の画面（頭を畳み「‹」と題）・「‹」で一覧へ戻り ?c が消える。会話が 1 つも無い・?new=1 は会話の画面（頭を畳む）", async ({
  page,
}) => {
  await mockTalk(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/ai/talk");
  await expect(page.locator(".k-room-talk")).toHaveAttribute("data-mview", "list");
  await expect(convList(page).locator('.k-room-conv[aria-current="true"] b')).toHaveText(
    "来月の営業の段取りを考えたい",
  );
  await expect(page).not.toHaveURL(/[?&]c=/);
  await convList(page)
    .getByRole("button", { name: /来月の営業の段取り/ })
    .click();
  await expect(page.locator(".k-room-talk")).toHaveAttribute("data-mview", "chat");
  await expect(page.locator(".k-room-head")).toHaveAttribute("data-mchat", "");
  await page.getByRole("button", { name: "会話の一覧へ戻る", exact: true }).click();
  await expect(page.locator(".k-room-talk")).toHaveAttribute("data-mview", "list");
  await expect(page).not.toHaveURL(/[?&]c=/);
  await page.goto("/ai/talk?new=1");
  await expect(page.locator(".k-room-talk")).toHaveAttribute("data-mview", "chat");
  await expect(page.locator(".k-room-head")).toHaveAttribute("data-mchat", "");
});

test("K762-UI-021 幅 320・375・768・1024・1440 で横溢れ 0・書く欄が画面の中", async ({ page }) => {
  await mockTalk(page);
  for (const w of WIDTHS_ALL) {
    await openRoom(page, `/ai/talk?c=${C1}`, w);
    expect(await overflowX(page), `幅 ${w}`).toBeLessThanOrEqual(0);
    const box = (await composer(page).boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(w);
  }
});

test("K762-UI-022 守り・口の数：開くと 会話の一覧 1・会話 1（二重 0）・流れ 1（頭は K-755 と同じ 1 回）。has_more が偽なら古い行は読まない・書く口は押したものだけ・本人の Bridge に飛ばない", async ({
  page,
}) => {
  const t = await mockTalk(page);
  await openRoom(page, "/ai/talk");
  await expect(bubbles(page)).toHaveCount(2);
  await page.mouse.wheel(0, -5000);
  expect(t.lists).toBe(1);
  expect(t.reads).toEqual([C1]);
  expect(t.olders.length).toBe(0);
  expect(t.room.reads.me).toBe(1);
  expect(new Set(t.streams).size).toBe(1);
  expect(t.room.writes).toEqual([]);
  expect(t.room.bridge).toBe(0);
});

test("K762-UI-023 道とナビ：/ai/talk でも左のメニューの「（名前）のAI」（行き先 /ai）がいまの画面の印・部屋のタブから /ai/talk に来られる", async ({
  page,
}) => {
  await mockTalk(page);
  await openRoom(page, "/ai");
  await tabs(page).getByRole("link", { name: "話す", exact: true }).click();
  await expect(page).toHaveURL(/\/ai\/talk/);
  await expect(
    page.getByRole("navigation", { name: "メニュー", exact: true }).locator('a[href="/ai"]'),
  ).toHaveAttribute("aria-current", "page");
});

test("K762-UI-027 止める口の失敗（手順 S2 の失敗）：止める口が 503 なら正本の文の帯が出て、会話を読み直す（［止める］は押し直せる）", async ({
  page,
}) => {
  const t = await mockTalk(page);
  t.on.view = () => ({
    status: 200,
    body: { data: view({ messages: [...LIST_MSGS(), ME_Q2()], running_job_id: JOB, work: working() }) },
  });
  await openRoom(page, "/ai/talk");
  t.on.stop = () => err(503, "E-PAGE-003");
  const n = t.reads.length;
  await stop(page).click();
  await expect(chat(page)).toContainText(msg("E-PAGE-003").split("。")[0]!);
  await expect.poll(() => t.reads.length).toBeGreaterThan(n);
  await expect(stop(page)).toBeEnabled();
});

test("K762-UI-028 前の道：/ai/chat を開くと /ai/talk へ送られ（?c=<id> もそのまま）、その会話が開く（前の会話の画面は出ない）", async ({
  page,
}) => {
  const t = await mockTalk(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/ai/chat");
  await expect(page).toHaveURL(/\/ai\/talk/);
  await expect(tabs(page).getByRole("link", { name: "話す", exact: true })).toHaveAttribute("aria-current", "page");
  await page.goto(`/ai/chat?c=${C2}`);
  await expect(page).toHaveURL(new RegExp(`/ai/talk\\?c=${C2}`));
  await expect.poll(() => t.reads.at(-1)).toBe(C2);
});

test("K762-UI-029 前の画面の部品を読まない（ファイルを読む）：/ai/chat の page は送るだけ（AgentChat・ConversationList・useAgentChat を読まない）・入口（/）の行き先は /ai/talk", () => {
  const chatPage = readFileSync(join(ROOT, "apps/web/app/(app)/ai/chat/page.tsx"), "utf8");
  expect(chatPage).not.toMatch(/AgentChat|ConversationList|useAgentChat/);
  expect(chatPage).toMatch(/redirect|replace/);
  const home = readFileSync(join(ROOT, "apps/web/app/page.tsx"), "utf8");
  expect(home).not.toContain('"/ai/chat"');
  expect(home).toContain('"/ai/talk"');
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
const TALK_PAIRS: FidelityPair[] = [
  ...ROOM_HEAD_PAIRS,
  p("talk", ".k-room-talk", ["x", "y", "width"]),
  p("convs", ".k-room-convs", [...BOX]),
  p("conv-on", '.k-room-conv[aria-current="true"]', [...BOX, "texts"]),
  p("conv-group", ".k-room-conv-group", ["x", "y", ...TEXT]),
  p("chat", ".k-room-chat", ["x", "y", "width"]),
  p("chat-bar", ".k-room-chat-bar", ["x", "y", "width", "height", "texts"]),
  p("aside", ".k-room-aside", ["x", "y", ...TEXT]),
  p("day-sep", ".k-room-day-sep", ["x", "y", "font-size", "color"]),
  p("bubble-me", '.k-room-msg[data-who="me"] .k-room-bubble', BOX),
  p("bubble-ai", '.k-room-msg[data-who="ai"] .k-room-bubble', BOX),
  p("time", ".k-room-msg-time", ["font-size", "color", "texts"]),
  p("took", ".k-room-took", ["font-size", "color", "texts"]),
  p("sys", ".k-room-sys", ["x", "y", ...TEXT]),
  p("work", ".k-room-work", ["x", "y", ...TEXT]),
  p("empty", ".k-room-empty", [...BOX, "texts"]),
  p("pc", ".k-room-pc", [...BOX, "texts"]),
  p("callout", ".k-room-chat .k-callout", [...BOX, "texts"]),
  p("composer", ".k-room-composer", BOX),
  p("textarea", ".k-room-composer textarea", ["width", "height", "x", "y", "font-size", "opacity"]),
  p("send", ".k-room-send", CTRL),
  p("quota", ".k-room-quota", ["x", "y", "texts"]),
];
// 注：下絵の「見たもの」・AI の返事の中の箇条・書く欄の「5 時間の枠」・一覧の「〜」は K-755 が下絵の側を直す（K-755 に依存）。比べない役は無い
// 日の区切りは真ん中に寄せた「今日 M/D（曜）」で、試験の会話は今日の日付・下絵は 11/2 の字。字の幅が日付で変わるので x は比べない（y・字・色は比べる）
const SKIP: string[] = ["day-sep:x"];
async function match(
  browser: Browser,
  id: string,
  drive: (pg: Page, w: number) => Promise<void>,
  skip: string[] = SKIP,
  widths: readonly number[] = MATCH_WIDTHS,
) {
  const bad: string[] = [];
  for (const w of widths) {
    const r = await matchMock(browser, id, w, (pg) => drive(pg, w), { pairs: TALK_PAIRS, base: "/dev/mock/f5", skip });
    bad.push(...r.bad);
  }
  expect(bad, bad.join("\n")).toEqual([]);
}
const open = (path: string) => async (pg: Page, w: number) => {
  await openRoom(pg, path, w);
};

test("K762-UI-024 下絵との突き合わせ：talk-convs（375 の一覧）・talk-chat-mobile（375 の会話）・talk-new（新しく話す）", async ({
  browser,
}) => {
  await match(
    browser,
    "talk-convs",
    async (pg, w) => {
      await mockTalk(pg);
      await open("/ai/talk")(pg, w);
    },
    SKIP,
    [375],
  );
  await match(browser, "talk-chat-mobile", async (pg, w) => {
    await mockTalk(pg);
    await open(`/ai/talk?c=${C1}`)(pg, w);
  });
  await match(browser, "talk-new", async (pg, w) => {
    await mockTalk(pg);
    await open("/ai/talk?new=1")(pg, w);
  });
});

test("K762-UI-025 下絵との突き合わせ：talk-working・talk-writing・talk-stopped・talk-permission（会話の答えを下絵の字に）", async ({
  browser,
}) => {
  const cases: [string, Record<string, unknown>][] = [
    ["talk-working", { messages: [...LIST_MSGS(), ME_Q2()], running_job_id: JOB, work: working() }],
    [
      "talk-writing",
      {
        messages: [...LIST_MSGS(), ME_Q2()],
        running_job_id: JOB,
        work: working({
          partial:
            "セイコー様は 12/15 が期限なので先に出すのがよさそうです。更新案には、今期の稼働時間と、来期に増やしたい保守の範囲を",
        }),
      },
    ],
    [
      "talk-stopped",
      {
        messages: [
          ...LIST_MSGS(),
          ME_Q2(),
          msgOf({ who: "stopped", at: at(0, "09:46"), text: "高本が AI を止めました。ここまでの返事は残っています" }),
        ],
        stopped: { job_id: JOB, reason: "あなたが止めました" },
      },
    ],
    [
      "talk-permission",
      {
        messages: [
          ...LIST_MSGS(),
          ME_Q2(),
          msgOf({
            who: "note",
            at: at(0, "09:45"),
            text: "高本のAI が許可を求めましたが、自動で断りました（許可に答える画面はまだ使えません）",
          }),
          msgOf({
            who: "ai",
            at: at(0, "09:45"),
            text: "先方の請求書システムは開けなかったので、手元の見積の情報だけで更新案を作ります。",
          }),
        ],
      },
    ],
  ];
  for (const [id, v] of cases)
    await match(browser, id, async (pg, w) => {
      const t = await mockTalk(pg);
      t.on.view = () => ({ status: 200, body: { data: view(v) } });
      await open(`/ai/talk?c=${C1}`)(pg, w);
    });
});

test("K762-UI-026 下絵との突き合わせ：talk-sending（答えを止めた間）・talk-stopped-pc（PC が閉じた）・talk-pc-none（PC がまだ）", async ({
  browser,
}) => {
  await match(browser, "talk-sending", async (pg, w) => {
    const t = await mockTalk(pg);
    await open(`/ai/talk?c=${C1}`)(pg, w);
    t.room.hold();
    await composer(pg).fill("セイコー様の更新案の下書きを作って");
    await pg.locator(".k-room-composer").getByRole("button", { name: "送る", exact: true }).click();
  });
  await match(browser, "talk-stopped-pc", async (pg, w) => {
    const t = await mockTalk(pg, { pc: "asleep" });
    t.on.view = () => ({
      status: 200,
      body: {
        data: view({ messages: [...LIST_MSGS(), ME_Q2()], stopped: { job_id: JOB, reason: "PC が閉じました" } }),
      },
    });
    await open(`/ai/talk?c=${C1}`)(pg, w);
  });
  await match(browser, "talk-pc-none", async (pg, w) => {
    // 下絵の「PC がまだ」は今日できた分身（「今日から」）。本番も同じ日に始めた分身で開く
    await mockTalk(pg, { pc: "none", rows: [], since: todayJst() });
    await open("/ai/talk")(pg, w);
  });
});
