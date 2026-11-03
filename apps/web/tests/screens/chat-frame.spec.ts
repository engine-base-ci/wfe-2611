// 会話の固定枠（T-B-33・D-072「会話の固定枠」・D-064.7 で 768 以上に）：768 以上では会話の箱だけを画面の残りの高さにし、吹き出しだけがスクロールする。
// 段の帯・見出し・右の欄・入力欄は動かない。767 以下は今までどおり流れる。テストの名前に正本の行 ID を持つ（op_gate.py）。本人の本物の Bridge は止めない
import { expect, test, type Page } from "@playwright/test";
import { admin, API, hideRealBridge, loginAs, setupStep, signupViaApi } from "../_lib/api";
import { startAgentBridge, type AgentBridge } from "../_lib/agent-bridge";

let bridges: AgentBridge[] = [];
test.beforeEach(({ page }) => hideRealBridge(page));
test.afterEach(() => {
  for (const b of bridges) b.stop();
  bridges = [];
});

/** 長い会話を用意する（1 回言って会話を作り、やりとりを 30 往復足す） */
async function longTalk(step: number) {
  const u = await signupViaApi();
  bridges.push(await startAgentBridge(u.token));
  await setupStep(u.memberId, step);
  const r = await fetch(`${API}/api/auth-ext/agent/say`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${u.token}` },
    body: JSON.stringify({ text: "会社のことを聞いて" }),
  });
  const conv = ((await r.json()) as { data: { conversation_id: string } }).data.conversation_id;
  await admin(
    `insert into messages (tenant_id, conversation_id, body, kind, created_at)
     select c.tenant_id, c.id, case when g % 2 = 0 then '答えの ' || g || ' 行目。受託・制作で、案件は紹介とリピートです。' else '質問の ' || g || ' 行目。いま一番時間を取られているのはどこですか？' end,
            case when g % 2 = 0 then 'human' else 'ai' end, now() - interval '1 hour' + g * interval '1 second'
       from conversations c, generate_series(1, 60) g where c.id = $1`,
    [conv],
  );
  return u;
}

/** 画面の数値：ページが動く量・会話の中が動く量・入力欄の下端 */
const measure = (page: Page) =>
  page.evaluate(() => {
    const d = document.documentElement;
    const chat = document.querySelector<HTMLElement>('[data-part="conversation"] .chat')!;
    const comp = document.querySelector<HTMLElement>('[data-part="composer"]')!;
    return {
      pageOverflow: d.scrollHeight - d.clientHeight,
      chatOverflow: chat.scrollHeight - chat.clientHeight,
      chatOverflowY: getComputedStyle(chat).overflowY,
      composerBottom: comp.getBoundingClientRect().bottom,
      vh: window.innerHeight,
    };
  });
const topOf = (page: Page, sel: string) =>
  page
    .locator(sel)
    .first()
    .evaluate((el) => Math.round(el.getBoundingClientRect().top));

for (const [w, h] of [
  [1440, 900],
  [1024, 768],
] as const) {
  test(`CHT-33-001 はじめの設定の「話す」（幅 ${w}）：ページは動かず、会話の中だけがスクロールし、段の帯・分かったこと・入力欄は動かない`, async ({
    page,
  }) => {
    const u = await longTalk(2);
    await loginAs(page, u.token);
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/onboard/interview");
    await expect(page.locator('[data-part="conversation"] .chat .msg').nth(40)).toBeAttached({ timeout: 20_000 });
    await page.waitForTimeout(500);
    const m = await measure(page);
    expect(m.pageOverflow, "ページ全体は動かない").toBeLessThanOrEqual(1);
    expect(m.chatOverflow, "会話の中は溢れていてスクロールできる").toBeGreaterThan(200);
    expect(m.composerBottom, "入力欄は画面の中").toBeLessThanOrEqual(m.vh);
    const steps0 = await topOf(page, 'ol[aria-label="手順"]');
    const side0 = await topOf(page, "[data-chat-side]");
    // 会話を上へ戻しても、段の帯と分かったことの位置は変わらない
    await page.locator('[data-part="conversation"] .chat').evaluate((el) => (el.scrollTop = 0));
    await page.mouse.wheel(0, -2000);
    await page.waitForTimeout(300);
    expect(await topOf(page, 'ol[aria-label="手順"]')).toBe(steps0);
    expect(await topOf(page, "[data-chat-side]")).toBe(side0);
    expect((await measure(page)).composerBottom).toBeLessThanOrEqual(m.vh);
  });
}

test("CHT-33-002 会話モード（/ai/chat・幅 1440）：会話の名前と入力欄は動かず、会話の中だけがスクロールする", async ({
  page,
}) => {
  const u = await longTalk(6);
  await loginAs(page, u.token);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/ai/chat");
  await expect(page.locator('[data-part="conversation"] .chat .msg').nth(40)).toBeAttached({ timeout: 20_000 });
  await page.waitForTimeout(500);
  const m = await measure(page);
  expect(m.chatOverflow, "会話の中は溢れていてスクロールできる").toBeGreaterThan(200);
  expect(m.composerBottom, "入力欄は画面の中").toBeLessThanOrEqual(m.vh);
  const title0 = await topOf(page, "[data-conversation-title]");
  await page.locator('[data-part="conversation"] .chat').evaluate((el) => (el.scrollTop = 0));
  await page.mouse.wheel(0, -2000);
  await page.waitForTimeout(300);
  expect(await topOf(page, "[data-conversation-title]"), "会話の名前は動かない").toBe(title0);
  expect((await measure(page)).composerBottom).toBeLessThanOrEqual(m.vh);
});

test("CHT-33-003 767 以下（幅 375）は今までどおりページごとに流れる（会話の箱だけを固定しない）", async ({ page }) => {
  const u = await longTalk(2);
  await loginAs(page, u.token);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/onboard/interview");
  await expect(page.locator('[data-part="conversation"] .chat .msg').nth(40)).toBeAttached({ timeout: 20_000 });
  const m = await measure(page);
  expect(m.chatOverflowY, "会話の中に別のスクロールを作らない").not.toBe("auto");
  expect(m.pageOverflow, "ページごと流れる").toBeGreaterThan(200);
  const hScroll = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(hScroll, "横に溢れない").toBeLessThanOrEqual(0);
});

// 分かったこと（T-B-34・D-114）：自分のAI が聞き取って記憶に落とした事実を「項目：内容」で出す。本人が送った文は並べない
async function talkWith(memos: string[]) {
  const u = await signupViaApi();
  bridges.push(await startAgentBridge(u.token));
  await setupStep(u.memberId, 2);
  const r = await fetch(`${API}/api/auth-ext/agent/say`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${u.token}` },
    body: JSON.stringify({ text: "続けて" }),
  });
  const conv = ((await r.json()) as { data: { conversation_id: string } }).data.conversation_id;
  for (const t of memos)
    await admin(
      "insert into messages (tenant_id, conversation_id, body, kind) select c.tenant_id, c.id, $2, 'memo' from conversations c where c.id = $1",
      [conv, t],
    );
  return u;
}
test("CHT-34-001 分かったことには、自分のAI が覚えた事実だけが「項目：内容」で並び、送った文（続けて 等）は並ばない", async ({
  page,
}) => {
  const u = await talkWith(["何をしている会社か：受託開発（Web・アプリ）", "案件の入口：紹介と既存客のリピート"]);
  await loginAs(page, u.token);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/onboard/interview");
  const side = page.locator("[data-chat-side]");
  await expect(side.locator("[data-fact]")).toHaveCount(2, { timeout: 20_000 });
  await expect(side.locator("[data-fact-key]").nth(0)).toHaveText("何をしている会社か");
  await expect(side.locator("[data-fact-value]").nth(0)).toHaveText("受託開発（Web・アプリ）");
  await expect(side.locator("[data-fact-key]").nth(1)).toHaveText("案件の入口");
  await expect(side, "送った文は並ばない").not.toContainText("続けて");
  await expect(side).toContainText("記憶に落ちています");
});
test("CHT-34-002 まだ何も覚えていなければ「まだ何もありません」（送った文があっても並べない）", async ({ page }) => {
  const u = await talkWith([]);
  await loginAs(page, u.token);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/onboard/interview");
  // 会話が読み込まれて、送った文が会話に出てから見る（読み込む前の空の欄を見て通らない）
  await expect(page.locator('[data-part="conversation"] [data-who="me"]').first()).toContainText("続けて", {
    timeout: 20_000,
  });
  const side = page.locator("[data-chat-side]");
  await expect(side).toContainText("まだ何もありません");
  await expect(side.locator("[data-fact]")).toHaveCount(0);
  await expect(side).not.toContainText("続けて");
});

// 会話を詰める・広げる（T-B-40・D-118）：画面が低くても会話に高さを渡す。「会話を広げる」で上と右の欄を閉じ、Esc で戻る
async function talkLong() {
  const u = await signupViaApi();
  bridges.push(await startAgentBridge(u.token));
  await setupStep(u.memberId, 2);
  const r = await fetch(`${API}/api/auth-ext/agent/say`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${u.token}` },
    body: JSON.stringify({ text: "会社のことを聞いて" }),
  });
  const conv = ((await r.json()) as { data: { conversation_id: string } }).data.conversation_id;
  await admin(
    "insert into messages (tenant_id, conversation_id, body, kind, created_at) select c.tenant_id, c.id, '行 ' || g, case when g % 2 = 0 then 'human' else 'ai' end, now() - interval '1 hour' + g * interval '1 second' from conversations c, generate_series(1, 40) g where c.id = $1",
    [conv],
  );
  return u;
}
const chatH = (page: Page) => page.locator('[data-part="conversation"] .chat').evaluate((el) => el.clientHeight);
test("CHT-40-001 画面が低くても（1512×640）、見出しと説明は 1 行に詰まり、会話に 260px 以上が渡る。「Shift+Enter」の行は書いている間だけ出る", async ({
  page,
}) => {
  const u = await talkLong();
  await loginAs(page, u.token);
  await page.setViewportSize({ width: 1512, height: 640 });
  await page.goto("/onboard/interview");
  await expect(page.locator('[data-part="conversation"] .chat .msg').nth(30)).toBeAttached({ timeout: 20_000 });
  await page.waitForTimeout(500);
  expect(await chatH(page), "詰める前は 179px だった").toBeGreaterThanOrEqual(260);
  const h1 = await page.locator("main h1").boundingBox();
  const purpose = await page.getByText("訊かれたことに答えるだけ").boundingBox();
  expect(Math.abs(purpose!.y + purpose!.height / 2 - (h1!.y + h1!.height / 2)), "見出しと説明は同じ行").toBeLessThan(8);
  const hint = page.locator('[data-part="composer"] .chint');
  const box = page.getByRole("textbox", { name: "自分のAIに書く" });
  await expect(hint).toBeHidden();
  // 入力欄に入っただけでは形を変えない（変えると、下の道具のボタンを押した瞬間に入力欄から外れて行が引っ込み、押し損ねる・2026-09-30 実例）
  await box.focus();
  await expect(hint).toBeHidden();
  await page.getByRole("button", { name: /毎回聞く/ }).click();
  await expect(
    page.getByRole("listbox", { name: "許可のモード" }),
    "入力欄にいたまま許可のしかたを押しても開く",
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await box.fill("あ");
  await expect(hint, "書いている間だけ案内が出る").toBeVisible();
  await box.fill("");
  await expect(hint).toBeHidden();
});
test("CHT-40-002 「会話を広げる」を押すと段の帯・説明・分かったことを閉じて会話だけになり、「元に戻す」か Esc で戻る", async ({
  page,
}) => {
  const u = await talkLong();
  await loginAs(page, u.token);
  await page.setViewportSize({ width: 1512, height: 640 });
  await page.goto("/onboard/interview");
  await expect(page.locator('[data-part="conversation"] .chat .msg').nth(30)).toBeAttached({ timeout: 20_000 });
  await page.waitForTimeout(500);
  const before = await chatH(page);
  const w0 = await page.locator('[data-part="conversation"] .chat').evaluate((el) => el.clientWidth);
  await page.locator("[data-chat-wide-toggle]").click();
  await expect(page.getByRole("list", { name: "手順" })).toHaveCount(0);
  await expect(page.locator("[data-chat-side]")).toBeHidden();
  await expect(page.locator("[data-chat-wide-toggle]")).toHaveText(/元に戻す/);
  await page.waitForTimeout(400);
  expect(await chatH(page), "縦に広がる").toBeGreaterThan(before + 80);
  const fromBottom = await page
    .locator('[data-part="conversation"] .chat')
    .evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight);
  expect(fromBottom, "広げても読んでいた所（いちばん下）のまま。先頭へ飛ばない").toBeLessThanOrEqual(2);
  expect(
    await page.locator('[data-part="conversation"] .chat').evaluate((el) => el.clientWidth),
    "横にも広がる",
  ).toBeGreaterThan(w0 + 200);
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight - innerHeight),
    "ページは動かない",
  ).toBeLessThanOrEqual(1);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("list", { name: "手順" })).toBeVisible();
  await expect(page.locator("[data-chat-side]")).toBeVisible();
  await page.locator("[data-chat-wide-toggle]").click();
  await page.locator("[data-chat-wide-toggle]").click();
  await expect(page.getByRole("list", { name: "手順" })).toBeVisible();
});
