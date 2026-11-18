// QA A1：自分のAIと話す（/ai/chat・T-U-17）と、自分のAIの右パネル（T-US-02）の L1 の行を実ブラウザで押して確かめる。
// テストの名前の先頭に正本の行 ID を並べる（op_gate.py）。期待はモック（06_mockup/v1/v1-clone-chat.html）と決定ログ（D-060・D-104・D-111）から書く（G-09）。
// Bridge は本物の輪（apps/bridge の loop）を回し、CLI だけ偽物（scripts/dev/fake-claude-demo.mjs）。本人の本物の Bridge は止めない（hideRealBridge）。
// 返事の書式の状態（目次・作業の記録・資料）は、偽の Claude が出さない形なので、自分のAI の返事を DB に置いて画面に描かせる（前提を DB で作る）。
import { readFileSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  API,
  admin,
  api,
  bridgeAsleep,
  bridgeTake,
  hideRealBridge,
  lastMailUrl,
  loginAs,
  noOverflow,
  PW,
  setupStep,
  signupViaApi,
} from "../_lib/api";
import { startAgentBridge, type AgentBridge } from "../_lib/agent-bridge";

test.describe.configure({ timeout: 180_000 });
let bridges: AgentBridge[] = [];
test.beforeEach(({ page }) => hideRealBridge(page));
test.afterEach(() => {
  for (const b of bridges) b.stop();
  bridges = [];
});

type U = Awaited<ReturnType<typeof signupViaApi>>;
/** はじめの設定を通した人が、この PC をつないだ状態（Bridge の輪が回っている）で会話モードを開く */
async function ready(
  page: Page,
  opts: { width?: number; browser?: "chrome" | "dedicated" | "off" } = {},
): Promise<U & { sid: string }> {
  const u = await signupViaApi();
  const b = await startAgentBridge(u.token, opts.browser ? { browser: opts.browser } : {});
  bridges.push(b);
  await setupStep(u.memberId, 6);
  await loginAs(page, u.token);
  await page.setViewportSize({ width: opts.width ?? 1440, height: 900 });
  await page.goto("/ai/chat");
  await expect(page.locator('[data-part="conversation"]')).toBeVisible({ timeout: 30_000 });
  return { ...u, sid: b.sid };
}
const box = (page: Page) => page.getByRole("textbox", { name: "自分のAIに書く" });
const say = async (page: Page, text: string) => {
  await box(page).fill(text);
  await box(page).press("Enter");
};
/** 書き終わった返事（書きかけの吹き出しは含めない） */
const lastAi = (page: Page) => page.locator('.msg[data-who="ai"]:not([data-streaming])').last();
const lastMe = (page: Page) => page.locator('.msg[data-who="me"]').last();
const jobs = (memberId: string) =>
  admin<{
    id: string;
    state_id: string;
    permission_mode: string;
    model: string | null;
    effort: string | null;
    agent_session_id: string | null;
    conversation_id: string | null;
    prompt: string;
  }>(
    "select id, state_id, permission_mode, model, effort, agent_session_id, conversation_id, prompt from bridge_jobs where member_id = $1 and conversation_id is not null order by created_at",
    [memberId],
  );
const convs = (memberId: string) =>
  admin<{
    id: string;
    title: string;
    title_auto: boolean;
    starred_at: string | null;
    incognito: boolean;
    deleted_at: string | null;
  }>(
    "select id, title, title_auto, starred_at, incognito, deleted_at from conversations where owner_member_id = $1 order by created_at",
    [memberId],
  );
/** 会話を 1 つ DB に置く（前提）。msgs は [kind, body, work?]。ago は「何日前」 */
async function seedConv(
  u: U,
  title: string,
  msgs: [string, string, Record<string, number>?][],
  o: { ago?: number; incognito?: boolean } = {},
): Promise<string> {
  const ago = `${o.ago ?? 0} days`;
  const c = (
    await admin<{ id: string }>(
      "insert into conversations (tenant_id, scope_id, title, owner_member_id, created_by, incognito, created_at, updated_at) values ($1, $2, $3, $4, $4, $5, now() - $6::interval, now() - $6::interval) returning id",
      [u.tenantId, u.scopeId, title, u.memberId, o.incognito ?? false, ago],
    )
  )[0]!.id;
  let i = 0;
  for (const [kind, body, work] of msgs)
    await admin(
      "insert into messages (tenant_id, conversation_id, body, kind, work, created_at) values ($1, $2, $3, $4, $5, now() - $6::interval + $7 * interval '1 second')",
      [u.tenantId, c, body, kind, work ? JSON.stringify(work) : null, ago, i++],
    );
  return c;
}
/** 会話を開く（URL に会話の id） */
async function openConv(page: Page, id: string) {
  await page.goto(`/ai/chat?c=${id}`);
  await expect(page.locator('[data-part="conversation"]')).toBeVisible({ timeout: 30_000 });
}
/** 作業の 1 行（畳んだ「N つの操作 · 時間」）を開いて閉じる */
async function toggleWork(page: Page, work: Locator, label: RegExp) {
  await expect(work.locator("summary")).toHaveText(label);
  await expect(work).not.toHaveAttribute("open", "");
  await work.locator("summary").click();
  await expect(work).toHaveAttribute("open", "");
  await expect(work.locator(".wd")).toBeVisible();
  await expect(work.locator(".wd")).toContainText("返り値の全文はあなたの PC に置いたまま");
  await work.locator("summary").click();
  await expect(work).not.toHaveAttribute("open", "");
}
/** 偽の音声認識（話した文が 1 つ返る。止めると終わる） */
async function fakeSpeech(page: Page, said: string) {
  await page.addInitScript((t) => {
    class FakeRec {
      lang = "";
      interimResults = false;
      continuous = false;
      onresult: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      start() {
        setTimeout(() => this.onresult?.({ results: [Object.assign([{ transcript: t }], { isFinal: true })] }), 200);
      }
      stop() {
        setTimeout(() => this.onend?.(), 50);
      }
    }
    Object.assign(window, { SpeechRecognition: FakeRec, webkitSpeechRecognition: FakeRec });
  }, said);
}

// =====================================================================================================
// 右パネル（T-US-02・状態 共通）。本物の作業画面がまだ無いので、共通の枠が出す本物の右パネルを見本の画面（?live=1）で開く
// =====================================================================================================
async function panelReady(page: Page): Promise<U & { sid: string }> {
  const u = await signupViaApi();
  const b = await startAgentBridge(u.token);
  bridges.push(b);
  await setupStep(u.memberId, 6);
  await loginAs(page, u.token);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/dev/shell?screen=today&ps=PS3&live=1");
  await expect(page.locator(".aipanel [data-part='conversation']")).toBeVisible({ timeout: 30_000 });
  return { ...u, sid: b.sid };
}
const panel = (page: Page) => page.locator(".aipanel");

test("USH-02-029 USH-02-028 USH-02-027 右パネル：書いて送ると会話に載り、読み直しても残る。「この画面：今日」は外すと自分のAI に渡らない。「会話モードで開く」で同じ会話の会話モードが開く", async ({
  page,
}) => {
  const u = await panelReady(page);
  const p = panel(page);
  const pbox = p.getByRole("textbox", { name: "自分のAIに書く" });
  // 文脈のチップ（この画面：今日）が出ている
  await expect(p.locator(".cchip.ctx")).toContainText("今日");
  await pbox.fill("受注 10 件いける？");
  await pbox.press("Enter");
  await expect(p.locator('[data-who="me"]').last()).toContainText("受注 10 件いける？");
  await expect(p.locator('.msg[data-who="ai"]:not([data-streaming])').last()).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => (await jobs(u.memberId)).length, { timeout: 15_000 }).toBe(1);
  expect((await jobs(u.memberId))[0]!.prompt, "文脈は自分のAI に添えられる").toContain("いま見ている画面：今日");
  // 別 GET で読み直しても残る（USH-02-029）
  await page.reload();
  await expect(panel(page).locator('[data-who="me"]').last()).toContainText("受注 10 件いける？", { timeout: 30_000 });
  const saved = await admin<{ body: string }>(
    "select m.body from messages m join conversations c on c.id = m.conversation_id where c.owner_member_id = $1 and m.kind = 'human'",
    [u.memberId],
  );
  expect(saved.map((m) => m.body)).toEqual(["受注 10 件いける？"]);
  // この画面：今日を外す（USH-02-028）→ チップが消え、次に送った文には文脈が付かない
  await panel(page).getByRole("button", { name: "文脈を外す" }).click();
  await expect(panel(page).locator(".cchip.ctx")).toHaveCount(0);
  const pbox2 = panel(page).getByRole("textbox", { name: "自分のAIに書く" });
  await pbox2.fill("外したあとの一言");
  await pbox2.press("Enter");
  await expect.poll(async () => (await jobs(u.memberId)).length, { timeout: 15_000 }).toBe(2);
  const second = (await jobs(u.memberId))[1]!.prompt;
  expect(second).toContain("外したあとの一言");
  expect(second, "外した文脈は渡らない").not.toContain("いま見ている画面");
  await expect(panel(page).locator('.msg[data-who="ai"]:not([data-streaming])').last()).toBeVisible({
    timeout: 30_000,
  });
  // 会話モードで開く（USH-02-027）：/ai/chat が開き、前の会話（右パネルで話した会話）の続きが出る
  await panel(page).getByTitle("会話モードで開く").click();
  await expect(page).toHaveURL(/\/ai\/chat/);
  await expect(page.locator('.msg[data-who="me"]').first()).toContainText("受注 10 件いける？", { timeout: 30_000 });
  const res = await page.request.get("/ai/chat");
  expect(res.status(), "実在ルート").toBe(200);
});

test("USH-02-030 USH-02-031 右パネル：＋で選んだ資料が入力欄の上に並ぶ。マイクで話すと文字になる", async ({ page }) => {
  await fakeSpeech(page, "パネルで声");
  await panelReady(page);
  const p = panel(page);
  const chooser = page.waitForEvent("filechooser");
  await p.getByRole("button", { name: "資料・画像を付ける" }).click();
  await (
    await chooser
  ).setFiles({ name: "台帳.csv", mimeType: "text/csv", buffer: Buffer.from("日付,金額\n9/1,1000\n") });
  await expect(p.locator("[data-att-state='ok']")).toContainText("台帳.csv", { timeout: 20_000 });
  await p.getByRole("button", { name: "声で入力" }).click();
  await expect(p.locator(".rec")).toContainText("聞いています");
  await expect(p.getByRole("textbox", { name: "自分のAIに書く" })).toHaveValue("パネルで声", { timeout: 5_000 });
  await p.locator(".rec").getByRole("button", { name: "止める" }).click();
  await expect(p.locator(".rec")).toHaveCount(0);
});

test("USH-02-034 USH-02-036 USH-02-037 右パネル：許可のモード（毎回聞く）・モデル（Opus 5.5）・考える強さ（中）を選ぶと、次の仕事の起動の引数になる", async ({
  page,
}) => {
  const u = await panelReady(page);
  const p = panel(page);
  await p.getByRole("button", { name: /毎回聞く/ }).click();
  await page
    .getByRole("listbox", { name: "許可のモード" })
    .getByRole("option", { name: /計画だけ/ })
    .click();
  await expect(p.getByRole("button", { name: /計画だけ/ })).toBeVisible();
  await p.locator("[data-model]").click();
  await page
    .getByRole("listbox", { name: "モデル" })
    .getByRole("option", { name: /^Opus 5\.5/ })
    .click();
  await expect(p.locator("[data-model]")).toHaveText("Opus 5.5");
  await p.locator("[data-effort]").click();
  await page.getByRole("listbox", { name: "考える強さ" }).getByRole("option", { name: "中", exact: true }).click();
  await expect(p.locator("[data-effort]")).toHaveText("中");
  const pbox = p.getByRole("textbox", { name: "自分のAIに書く" });
  await pbox.fill("引数を見せて");
  await pbox.press("Enter");
  await expect(p.locator('.msg[data-who="ai"]:not([data-streaming])').last()).toContainText(
    "モデル=claude-opus-5-5 強さ=medium 許可=plan",
    { timeout: 30_000 },
  );
  const j = (await jobs(u.memberId)).at(-1)!;
  expect({ model: j.model, effort: j.effort, mode: j.permission_mode }).toEqual({
    model: "claude-opus-5-5",
    effort: "medium",
    mode: "plan",
  });
});

// =====================================================================================================
// 会話モード /ai/chat（T-U-17）
// =====================================================================================================

test("SCR-CLONE-CHAT-016 SCR-CLONE-CHAT-276 SCR-CLONE-CHAT-284 書いて「送る」を押すと送る口（/agent/say）が呼ばれ、返事が来て、読み直しても会話に残る", async ({
  page,
}) => {
  const u = await ready(page);
  await box(page).fill("今月の受注の見込みと、来週やることを整理して");
  const req = page.waitForRequest((r) => /\/api\/auth-ext\/agent\/say/.test(r.url()) && r.method() === "POST");
  await page.getByRole("button", { name: "送る" }).click();
  const r = await req;
  expect(r.postDataJSON()).toMatchObject({ text: "今月の受注の見込みと、来週やることを整理して" });
  await expect(box(page), "送ると入力欄は空になる").toHaveValue("");
  await expect(lastMe(page)).toContainText("今月の受注の見込みと、来週やることを整理して");
  await expect(lastAi(page)).toContainText("9 月の請求のまとめ", { timeout: 30_000 });
  await page.reload();
  await expect(lastMe(page)).toContainText("今月の受注の見込みと、来週やることを整理して", { timeout: 30_000 });
  await expect(lastAi(page)).toContainText("9 月の請求のまとめ");
  const m = await admin<{ kind: string; body: string }>(
    "select m.kind, m.body from messages m join conversations c on c.id = m.conversation_id where c.owner_member_id = $1 order by m.created_at",
    [u.memberId],
  );
  expect(m.map((x) => x.kind)).toEqual(["human", "ai"]);
  expect(m[0]!.body).toBe("今月の受注の見込みと、来週やることを整理して");
});

test("SCR-CLONE-CHAT-149 SCR-CLONE-CHAT-174 SCR-CLONE-CHAT-175 SCR-CLONE-CHAT-153 SCR-CLONE-CHAT-272 SCR-CLONE-CHAT-273 SCR-CLONE-CHAT-274 SCR-CLONE-CHAT-271 書式・図とデータ・実物のカードを含む返事：作業の 1 行は開閉し、出典の番号で出典へ飛び、コピー・タスクにする・書き出す・直して送り直すが効く", async ({
  page,
}) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  const u = await ready(page);
  await say(page, "今月の受注の見込みと、来週やることを整理して");
  const ai = lastAi(page);
  await expect(ai).toContainText("出典はこちら", { timeout: 30_000 });
  // この返事は 書式（表・注意・数式）・図とデータ（流れ図・並べ替えできる表）・実物のカード を含む
  await expect(ai.locator(".callout.warn")).toBeVisible();
  await expect(ai.locator("math").first()).toBeVisible();
  await expect(ai.locator(".fchart svg")).toBeVisible({ timeout: 20_000 });
  await expect(ai.locator(".mtable th button").first()).toBeVisible();
  await expect(ai.locator("[data-entity]")).toBeVisible();
  // 作業の 1 行（149・174・175）：数は本当に使った道具の数
  const ops = (
    await admin<{ n: number }>(
      "select count(*)::int as n from bridge_job_events e join bridge_jobs j on j.id = e.job_id where j.member_id = $1 and e.kind = 'tool'",
      [u.memberId],
    )
  )[0]!.n;
  expect(ops).toBeGreaterThan(0);
  await toggleWork(page, ai.locator("[data-work-done]"), new RegExp(`^${ops} つの操作 · `));
  // 出典の番号「1」（153）→ 出典の一覧へ飛ぶ
  await ai.locator("sup a").first().click();
  await expect(page).toHaveURL(/#.*fn-1$/);
  await expect(ai.locator("ol.srcs li").first()).toBeInViewport();
  // コピー（272）：返事・自分の文をそのまま
  await ai.locator(".mact").getByRole("button", { name: "コピー" }).click();
  await expect(page.getByText("コピーしました").first()).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("## 9 月の請求のまとめ");
  await lastMe(page).getByRole("button", { name: "コピー" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "今月の受注の見込みと、来週やることを整理して",
  );
  // タスクにする（273）
  await ai.locator("[data-to-task]").click();
  await expect(page.getByText("タスクにしました")).toBeVisible({ timeout: 15_000 });
  const t = await admin<{ title: string }>("select title from tasks where tenant_id = $1", [u.tenantId]);
  expect(t.map((x) => x.title)).toEqual(["9 月の請求のまとめ"]);
  // 書き出す（274）→ 成果物になって横に開く
  await ai.locator(".mact [data-export]").click();
  await expect(page.locator("[data-artifact]")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("[data-art-title]")).toHaveText("9 月の請求のまとめ");
  expect(
    (
      await admin<{ n: number }>("select count(*)::int as n from artifacts where owner_member_id = $1", [u.memberId])
    )[0]!.n,
  ).toBe(1);
  await page.locator("[data-art-close]").click();
  // 直して送り直す（271）：その時点から新しい会話。元の会話は残る
  await lastMe(page).getByRole("button", { name: "直して送り直す" }).click();
  await expect(page.locator(".cchip")).toContainText("直して送り直す");
  await box(page).fill("今月の受注の見込みだけ教えて");
  await box(page).press("Enter");
  await expect
    .poll(async () => (await convs(u.memberId)).filter((c) => !c.deleted_at).length, { timeout: 15_000 })
    .toBe(2);
  await expect(lastMe(page)).toContainText("今月の受注の見込みだけ教えて");
});

test("SCR-CLONE-CHAT-150 SCR-CLONE-CHAT-151 SCR-CLONE-CHAT-152 SCR-CLONE-CHAT-157 長い返事の目次は押すとその見出しへ飛び、「計算に使った数」は押すと開いて閉じる", async ({
  page,
}) => {
  const u = await ready(page);
  const pad = "提案中の案件のうち、先方の返事待ちのものは来週の頭にもう一度確かめます。".repeat(14);
  const md = [
    "整理しました。",
    "## 今月の見込み",
    `このままだと **8 件** で着地します。${pad}`,
    "## 来週やること",
    `- セイコーの着手金の請求書を送る\n- 京蟻の見積を出す\n- SOICO に追いの連絡\n\n${pad}`,
    "## 計算のしかた",
    `達成率は $\\frac{8.33}{12} \\times 100 \\approx 69.4$ です。${pad}`,
    "<details><summary>計算に使った数（押すと開く）</summary>降ろした数 12（会社 → 営業）· 積み上がった数 8.33</details>",
  ].join("\n\n");
  expect(md.length).toBeGreaterThan(1500);
  const c = await seedConv(u, "今月の受注の見込み", [
    ["human", "今月の受注の見込みと、来週やることを整理して"],
    ["ai", md, { ops: 4, ms: 72_000 }],
  ]);
  await openConv(page, c);
  const toc = page.getByRole("navigation", { name: "この返事の目次" });
  await expect(toc).toBeVisible({ timeout: 20_000 });
  await expect(toc.getByRole("link")).toHaveText(["1. 今月の見込み", "2. 来週やること", "3. 計算のしかた"]);
  for (const [i, h] of ["今月の見込み", "来週やること", "計算のしかた"].entries()) {
    await page.locator(".chat").evaluate((e) => (e.scrollTop = 0));
    await toc.getByRole("link").nth(i).click();
    const head = page.locator(".mh", { hasText: h });
    await expect(head).toBeInViewport();
    const id = await head.getAttribute("id");
    await expect(page).toHaveURL(new RegExp(`#${encodeURIComponent(id!).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
  }
  const det = lastAi(page).locator("details.mdet");
  await det.locator("summary").scrollIntoViewIfNeeded();
  await expect(det.locator("summary")).toHaveText("計算に使った数（押すと開く）");
  await expect(det).not.toHaveAttribute("open", "");
  await det.locator("summary").click();
  await expect(det).toHaveAttribute("open", "");
  await expect(det).toContainText("降ろした数 12");
  await det.locator("summary").click();
  await expect(det).not.toHaveAttribute("open", "");
});

test("SCR-CLONE-CHAT-225 SCR-CLONE-CHAT-226 SCR-CLONE-CHAT-227 SCR-CLONE-CHAT-228 SCR-CLONE-CHAT-229 SCR-CLONE-CHAT-230 SCR-CLONE-CHAT-291 SCR-CLONE-CHAT-232 SCR-CLONE-CHAT-233 SCR-CLONE-CHAT-267 SCR-CLONE-CHAT-268 SCR-CLONE-CHAT-270 会話の一覧：中身で探せ、押すとその会話が開く。「…」の箱で星・名前を直す・消す（サイトの確かめ）。新しく話すで新しい会話", async ({
  page,
}) => {
  const u = await ready(page);
  const ids = {
    seiko: await seedConv(u, "セイコー 着手金の請求書", [
      ["human", "セイコーの着手金、請求書作っておいて"],
      ["ai", "着手金 990,000 円（税込）で作らせています"],
    ]),
    kyo: await seedConv(
      u,
      "京蟻の契約",
      [
        ["human", "京蟻の契約の条件は？"],
        ["ai", "着手金は契約時に 3 割です"],
      ],
      { ago: 27 },
    ),
    mikomi: await seedConv(u, "今月の受注の見込み", [
      ["human", "今月の受注の見込みは？"],
      ["ai", "このままだと 8 件です"],
    ]),
    soico: await seedConv(
      u,
      "SOICO の概算",
      [
        ["human", "SOICO の概算を出して"],
        ["ai", "3,930,000 円です"],
      ],
      { ago: 1 },
    ),
    kyuyo: await seedConv(
      u,
      "給与の相談",
      [
        ["human", "給与の相談"],
        ["ai", "わかりました"],
      ],
      { ago: 23, incognito: true },
    ),
    temp: await seedConv(
      u,
      "請求書テンプレの直し",
      [
        ["human", "請求書のテンプレを直して"],
        ["ai", "2 か所直しました"],
      ],
      { ago: 24 },
    ),
  };
  await page.reload();
  const list = page.locator('[data-part="conversation-list"]');
  await expect(list.locator("[data-conversation]")).toHaveCount(6, { timeout: 20_000 });
  // 探す（225）：名前も中身も
  await list.getByRole("textbox", { name: "会話を探す" }).fill("着手金");
  await expect(list.locator("[data-conversation]")).toHaveCount(2, { timeout: 15_000 });
  await expect(list.locator(`[data-conversation="${ids.kyo}"]`), "中身で当たり、当たった所が見える").toContainText(
    "契約時に 3 割",
  );
  // 当たった会話を押すと開く（227・228）
  for (const [id, body] of [
    [ids.seiko, "990,000 円（税込）で作らせています"],
    [ids.kyo, "着手金は契約時に 3 割です"],
  ] as const) {
    await list.locator(`[data-conversation="${id}"] .tl-open`).click();
    await expect(page).toHaveURL(new RegExp(`c=${id}`));
    await expect(lastAi(page)).toContainText(body);
  }
  await list.getByRole("textbox", { name: "会話を探す" }).fill("");
  await expect(list.locator("[data-conversation]")).toHaveCount(6);
  // 一覧の行を押すとその会話が開く（229・230・291・232）。記憶に使わない会話は印と、入力欄のチェックが入っている
  await expect(list.locator(`[data-conversation="${ids.kyuyo}"]`)).toContainText("記憶なし");
  for (const [id, body] of [
    [ids.mikomi, "このままだと 8 件です"],
    [ids.soico, "3,930,000 円です"],
    [ids.kyuyo, "わかりました"],
    [ids.temp, "2 か所直しました"],
  ] as const) {
    await list.locator(`[data-conversation="${id}"] .tl-open`).click();
    await expect(page).toHaveURL(new RegExp(`c=${id}`));
    await expect(lastAi(page)).toContainText(body);
    if (id === ids.kyuyo) await expect(page.locator('[data-part="composer"] [data-incognito]')).toBeChecked();
    else await expect(page.locator('[data-part="composer"] [data-incognito]')).not.toBeChecked();
  }
  // 無名だったアイコンのボタン（233）＝今は「…」の箱。名前（aria-label）があり、押すと 星・名前を直す・消す
  const more = list.locator(`[data-conversation="${ids.temp}"]`).getByRole("button", { name: "この会話の操作" });
  await more.click();
  await expect(page.getByRole("menu").getByRole("menuitem")).toHaveText([/星を付けて上に置く/, /名前を直す/, /消す/]);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  // 名前を直す（267）
  await list.locator(`[data-conversation="${ids.mikomi}"]`).getByRole("button", { name: "この会話の操作" }).click();
  await page.getByRole("menuitem", { name: "名前を直す" }).click();
  await list.getByRole("textbox", { name: "会話の名前" }).fill("今月の見込み（直した）");
  await list.getByRole("textbox", { name: "会話の名前" }).press("Enter");
  await expect(list.locator(`[data-conversation="${ids.mikomi}"]`)).toContainText("今月の見込み（直した）");
  await expect
    .poll(async () => (await convs(u.memberId)).find((c) => c.id === ids.mikomi)?.title)
    .toBe("今月の見込み（直した）");
  expect((await convs(u.memberId)).find((c) => c.id === ids.mikomi)!.title_auto, "直した名前は自動で上書きしない").toBe(
    false,
  );
  // 星を付ける（268）→ 「星」の見出しの下に上がる
  await list.locator(`[data-conversation="${ids.soico}"]`).getByRole("button", { name: "この会話の操作" }).click();
  await page.getByRole("menuitem", { name: "星を付ける" }).click();
  await expect.poll(async () => (await convs(u.memberId)).find((c) => c.id === ids.soico)?.starred_at).not.toBeNull();
  const starSec = list.locator(".tl-sec", { has: page.locator(".tl-grp", { hasText: /^星$/ }) });
  await expect(starSec.locator(`[data-conversation="${ids.soico}"]`)).toBeVisible({ timeout: 15_000 });
  // ほかの操作（270）：消すはサイトの確かめの箱。やめる→残る、消す→一覧から消える
  await list.locator(`[data-conversation="${ids.temp}"]`).getByRole("button", { name: "この会話の操作" }).click();
  await page.getByRole("menuitem", { name: "消す" }).click();
  const dlg = page.locator("dialog[data-confirm]");
  await expect(dlg).toContainText("「請求書テンプレの直し」を消しますか");
  await dlg.locator("[data-confirm-cancel]").click();
  await expect(list.locator(`[data-conversation="${ids.temp}"]`)).toHaveCount(1);
  await list.locator(`[data-conversation="${ids.temp}"]`).getByRole("button", { name: "この会話の操作" }).click();
  await page.getByRole("menuitem", { name: "消す" }).click();
  await dlg.locator("[data-confirm-ok]").click();
  await expect(list.locator(`[data-conversation="${ids.temp}"]`)).toHaveCount(0);
  await expect.poll(async () => (await convs(u.memberId)).find((c) => c.id === ids.temp)?.deleted_at).not.toBeNull();
  // 新しく話す（226）→ あいさつだけの会話。言うと新しい 1 本になる
  await list.getByRole("button", { name: "新しく話す" }).click();
  await expect(page.locator("[data-greet]")).toBeVisible();
  await expect(page.locator(".msg")).toHaveCount(0);
  await say(page, "新しい話を始める");
  await expect
    .poll(async () => (await convs(u.memberId)).filter((c) => !c.deleted_at).length, { timeout: 15_000 })
    .toBe(6);
  await expect(list.locator("[data-conversation]", { hasText: "新しい話を始める" })).toBeVisible({ timeout: 15_000 });
});

test("SCR-CLONE-CHAT-280 「この会話を記憶に使わない」のチェックを入れると、その会話が記憶に使わない会話になり、一覧に印が付き、読み直しても入ったまま", async ({
  page,
}) => {
  const u = await ready(page);
  await say(page, "社外秘の話");
  await expect(lastAi(page)).toBeVisible({ timeout: 30_000 });
  const chk = page.getByRole("switch", { name: "この会話を記憶に使わない" });
  await expect(chk).not.toBeChecked();
  await chk.check();
  await expect(page.locator('[data-part="composer"] .cmem-note')).toHaveText(
    "この会話は、自分のAIが毎朝まとめる記憶に入れません",
  );
  await expect.poll(async () => (await convs(u.memberId))[0]!.incognito, { timeout: 15_000 }).toBe(true);
  await expect(page.locator('[data-part="conversation-list"] [data-conversation]').first()).toContainText("記憶なし");
  await page.reload();
  await expect(page.getByRole("switch", { name: "この会話を記憶に使わない" })).toBeChecked({ timeout: 30_000 });
  await page.getByRole("switch", { name: "この会話を記憶に使わない" }).uncheck();
  await expect.poll(async () => (await convs(u.memberId))[0]!.incognito, { timeout: 15_000 }).toBe(false);
});

test("SCR-CLONE-CHAT-277 SCR-CLONE-CHAT-219 SCR-CLONE-CHAT-220 SCR-CLONE-CHAT-215 SCR-CLONE-CHAT-216 SCR-CLONE-CHAT-217 SCR-CLONE-CHAT-218 SCR-CLONE-CHAT-214 資料と画像を付けて頼む：＋で付けたものは一覧で外せる。自分のAI が選んでほしいときは問い合わせ（選ぶ・両方・その他）で答え、作業の 1 行が開閉する", async ({
  page,
}) => {
  const u = await ready(page);
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "資料・画像を付ける" }).click();
  await (
    await chooser
  ).setFiles([
    { name: "SOICO_工数表.csv", mimeType: "text/csv", buffer: Buffer.from("工程,人日\n実装,49.5\n") },
    { name: "見積の前提.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF\n") },
    { name: "画面の写真.png", mimeType: "image/png", buffer: Buffer.from("89504e470d0a1a0a", "hex") },
  ]);
  await expect(page.locator("[data-att-state='ok']")).toHaveCount(3, { timeout: 20_000 });
  await page.getByRole("button", { name: "見積の前提.pdfを外す" }).click();
  await page.getByRole("button", { name: "画面の写真.pngを外す" }).click();
  await expect(page.locator("[data-att-state]")).toHaveCount(1);
  await expect(page.locator("[data-att-state]")).toContainText("SOICO_工数表.csv");
  await say(page, "これで見積の概算出して。どれで出すか聞いて");
  await expect(lastMe(page).locator(".cchip")).toHaveText(["SOICO_工数表.csv"]);
  // 選んでほしいことは問い合わせで出す（D-111）。選択肢＝モックの「3,930,000 で」「3,450,000 で」、複数選ぶ＝「両方出す」、その他（自分で書く）
  const qc = page.locator('[data-part="question"]');
  await expect(qc).toBeVisible({ timeout: 30_000 });
  const o1 = qc.getByRole("radio", { name: /9 月/ });
  const o2 = qc.getByRole("radio", { name: /10 月/ });
  await o2.click();
  await expect(o2).toHaveAttribute("aria-checked", "true");
  await o1.click();
  await expect(o1).toHaveAttribute("aria-checked", "true");
  await expect(o2).toHaveAttribute("aria-checked", "false");
  await qc.getByRole("button", { name: "次へ" }).click();
  await qc.getByRole("checkbox", { name: /提案書/ }).click();
  await qc.getByRole("checkbox", { name: /見積書/ }).click();
  await qc.getByRole("textbox", { name: "その他の答え" }).fill("税抜の版も");
  await qc.getByRole("button", { name: "送る" }).click();
  await expect(lastAi(page)).toContainText("提案書、見積書、税抜の版も", { timeout: 30_000 });
  await expect(lastAi(page)).toContainText("9 月");
  const sent = await admin<{ a: string }>(
    "select coalesce(m.attachments::text, '') as a from messages m join conversations c on c.id = m.conversation_id where c.owner_member_id = $1 and m.kind = 'human'",
    [u.memberId],
  );
  expect(sent[0]!.a, "付けた資料が送った文に載る").toContain("SOICO_工数表.csv");
  expect(sent[0]!.a, "外した資料は載らない").not.toContain("見積の前提.pdf");
  expect(sent[0]!.a).not.toContain("画面の写真.png");
  await toggleWork(page, lastAi(page).locator("[data-work-done]"), /^\d+ つの操作 · /);
});

test("SCR-CLONE-CHAT-278 SCR-CLONE-CHAT-205 声で入力すると文字になり、録音の「止める」で止まる。動いている間の「止める」で自分のAI が止まる", async ({
  page,
}) => {
  await fakeSpeech(page, "声で書いた文");
  const u = await ready(page);
  await page.getByRole("button", { name: "声で入力" }).click();
  await expect(page.locator(".rec")).toContainText("聞いています");
  await expect(box(page)).toHaveValue("声で書いた文", { timeout: 5_000 });
  await page.locator(".rec").getByRole("button", { name: "止める" }).click();
  await expect(page.locator(".rec")).toHaveCount(0);
  await expect(box(page)).toHaveValue("声で書いた文");
  await box(page).fill("長く書いて");
  await box(page).press("Enter");
  await expect(page.locator("[data-streaming]")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "止める" }).click();
  await expect(page.locator("[data-stopped-reason]").last()).toContainText("あなたが止めました", { timeout: 20_000 });
  await expect.poll(async () => (await jobs(u.memberId)).at(-1)!.state_id).toBe("stopped");
});

test("SCR-CLONE-CHAT-279 SCR-CLONE-CHAT-282 SCR-CLONE-CHAT-283 会話モード：許可のモード・モデル（Opus 5.5）・考える強さ（中）を選ぶと、次の仕事の起動の引数になる", async ({
  page,
}) => {
  const u = await ready(page);
  await page.getByRole("button", { name: /毎回聞く/ }).click();
  const modes = page.getByRole("listbox", { name: "許可のモード" });
  await expect(modes.getByRole("option")).toHaveCount(5);
  await modes.getByRole("option", { name: /編集は自動/ }).click();
  await page.locator("[data-model]").click();
  await page
    .getByRole("listbox", { name: "モデル" })
    .getByRole("option", { name: /^Opus 5\.5/ })
    .click();
  await expect(page.locator("[data-model]")).toHaveText("Opus 5.5");
  await page.locator("[data-effort]").click();
  await page.getByRole("listbox", { name: "考える強さ" }).getByRole("option", { name: "中", exact: true }).click();
  await expect(page.locator("[data-effort]")).toHaveText("中");
  await say(page, "引数を見せて");
  await expect(lastAi(page)).toContainText("モデル=claude-opus-5-5 強さ=medium 許可=acceptEdits", { timeout: 30_000 });
  const j = (await jobs(u.memberId)).at(-1)!;
  expect({ model: j.model, effort: j.effort, mode: j.permission_mode }).toEqual({
    model: "claude-opus-5-5",
    effort: "medium",
    mode: "acceptEdits",
  });
});

test("SCR-CLONE-CHAT-204 動いている間に送った一言は順番待ちに並び、「取り消す」で消え、自分のAI には渡らない", async ({
  page,
}) => {
  const u = await ready(page);
  await say(page, "長く書いて");
  await expect(page.locator("[data-working]")).toBeVisible({ timeout: 30_000 });
  await say(page, "やっぱり税込で");
  const q = page.locator("[data-queue]");
  await expect(q.locator("[data-queued]")).toHaveCount(1, { timeout: 15_000 });
  await q.getByRole("button", { name: "「やっぱり税込で」を取り消す" }).click();
  await expect(page.locator("[data-queue]")).toHaveCount(0);
  await expect(page.locator("[data-work-done]").last()).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(".chat")).not.toContainText("やっぱり税込で");
  const prompts = (await jobs(u.memberId)).map((j) => j.prompt).join("\n");
  expect(prompts, "取り消した一言は渡らない").not.toContain("やっぱり税込で");
});

test("SCR-CLONE-CHAT-209 SCR-CLONE-CHAT-208 SCR-CLONE-CHAT-206 SCR-CLONE-CHAT-207 許可の問い：一言を添えて「許可しない」→ 理由として渡る。「今回だけ許可」→ 動く。「いつも許可」→ 動き、次から聞かない決まりになる。答えは証跡に残る", async ({
  page,
}) => {
  const u = await ready(page);
  const perm = page.locator('[data-part="ask"]');
  await say(page, "下書きを消して");
  await expect(perm).toBeVisible({ timeout: 30_000 });
  await expect(perm).toContainText("rm -rf 請求書/下書き");
  await perm.getByRole("textbox", { name: "一言添える" }).fill("下書きは残して");
  await perm.getByRole("button", { name: "許可しない" }).click();
  await expect(lastAi(page)).toContainText("下書きは残して", { timeout: 30_000 });
  await expect(lastAi(page)).toContainText("やめました");
  await say(page, "下書きを消して");
  await expect(perm).toBeVisible({ timeout: 30_000 });
  await perm.getByRole("button", { name: "今回だけ許可" }).click();
  await expect(lastAi(page)).toContainText("消しました", { timeout: 30_000 });
  await say(page, "もう一度下書きを消して");
  await expect(perm).toBeVisible({ timeout: 30_000 });
  await perm.getByRole("button", { name: /いつも許可（このコマンド）/ }).click();
  await expect(lastAi(page)).toContainText("消しました", { timeout: 30_000 });
  await expect(perm).toHaveCount(0);
  const audit = await admin<{ action: string }>(
    "select action from audit_events where actor_member_id = $1 and action like 'bridge.tool_%' order by occurred_at",
    [u.memberId],
  );
  expect(audit.map((a) => a.action)).toEqual(["bridge.tool_denied", "bridge.tool_allowed", "bridge.tool_allowed"]);
  const rules = await admin<{ tool: string }>(
    "select tool from permission_rules where member_id = $1 and revoked_at is null",
    [u.memberId],
  );
  expect(rules.length, "いつも許可は決まりとして残る").toBe(1);
});

test("SCR-CLONE-CHAT-196 SCR-CLONE-CHAT-197 SCR-CLONE-CHAT-198 SCR-CLONE-CHAT-199 SCR-CLONE-CHAT-200 SCR-CLONE-CHAT-201 自分のAI からの問い合わせ：問いの札で切り替え、次へ・戻るで行き来し、選んだ答えと一言が送られ、読み直しても残る", async ({
  page,
}) => {
  const u = await ready(page);
  await say(page, "セイコーの追いのこと聞いて");
  const qc = page.locator('[data-part="question"]');
  await expect(qc).toBeVisible({ timeout: 30_000 });
  await expect(qc).toContainText("2 問 · 全部答えてから送ります");
  const tabs = qc.getByRole("tab");
  await expect(tabs).toHaveText(["月", "同封"]);
  // 1 問目を選ぶ（198）
  await qc.getByRole("radio", { name: /9 月/ }).click();
  await expect(qc.getByRole("radio", { name: /9 月/ })).toHaveAttribute("aria-checked", "true");
  // 次へ（201）→ 2 問目
  await qc.getByRole("button", { name: "次へ" }).click();
  await expect(qc.locator(".qq")).toContainText("一緒に送るものは？");
  // 戻る（200）→ 1 問目（選んだものは残る）
  await qc.getByRole("button", { name: "戻る" }).click();
  await expect(qc.locator(".qq")).toContainText("どの月の請求書ですか？");
  await expect(qc.getByRole("radio", { name: /9 月/ })).toHaveAttribute("aria-checked", "true");
  // 問いの札（モックの「送り方」「同封」）で切り替える（196・197）
  await tabs.filter({ hasText: "同封" }).click();
  await expect(tabs.filter({ hasText: "同封" })).toHaveAttribute("aria-selected", "true");
  await expect(qc.locator(".qq")).toContainText("一緒に送るものは？");
  await tabs.filter({ hasText: "月" }).click();
  await expect(qc.locator(".qq")).toContainText("どの月の請求書ですか？");
  await tabs.filter({ hasText: "同封" }).click();
  await qc.getByRole("checkbox", { name: /提案書/ }).click();
  // 一言添える（199）
  await qc.getByRole("textbox", { name: "一言添える" }).fill("金額には触れない");
  await qc.getByRole("button", { name: "送る" }).click();
  await expect(lastAi(page)).toContainText("金額には触れない", { timeout: 30_000 });
  await expect(lastAi(page)).toContainText("提案書");
  await page.reload();
  await expect(lastAi(page)).toContainText("金額には触れない", { timeout: 30_000 });
  const audit = await admin<{ n: number }>(
    "select count(*)::int as n from bridge_job_events e join bridge_jobs j on j.id = e.job_id where j.member_id = $1",
    [u.memberId],
  );
  expect(audit[0]!.n).toBeGreaterThan(0);
});

test("SCR-CLONE-CHAT-195 作業の記録（差分・コマンド・フォルダ）の返事：作業の 1 行が実際の数で畳まれていて開閉する", async ({
  page,
}) => {
  const u = await ready(page);
  const md = [
    "テンプレの 2 か所を直しました。",
    "```diff:請求書テンプレ.md\n # 御請求書\n-お支払い期日：月末\n+お支払い期日：契約時（着手金）／納品時（残金）\n 宛先：{{会社名}} 御中\n+※ 金額は税込で先に書く\n```",
    "```console\n$ freee-cli template validate 請求書テンプレ.md\nOK: 項目 12 / 必須 8 / 警告 0\n```",
    "```tree\n請求書/\n├── 請求書テンプレ.md ← 直した\n├── 2026-042_セイコー.pdf\n└── 2026-043_京蟻.pdf\n```",
  ].join("\n\n");
  const c = await seedConv(u, "請求書テンプレの直し", [
    ["human", "請求書のテンプレを直して。何を変えたか見せて"],
    ["ai", md, { ops: 3, ms: 48_000 }],
  ]);
  await openConv(page, c);
  const ai = lastAi(page);
  await expect(ai).toContainText("お支払い期日：契約時", { timeout: 20_000 });
  await expect(ai.locator("[data-block='tree']")).toContainText("請求書テンプレ.md ← 直した");
  await toggleWork(page, ai.locator("[data-work-done]"), /^3 つの操作 · 48\s*秒$/);
});

test("SCR-CLONE-CHAT-183 SCR-CLONE-CHAT-186 SCR-CLONE-CHAT-188 SCR-CLONE-CHAT-189 SCR-CLONE-CHAT-190 SCR-CLONE-CHAT-191 資料（表・調べたページ）の返事：作業の 1 行が開閉し、表は CSV で落とせ、調べたページは新しいタブで開く", async ({
  page,
}) => {
  const u = await ready(page);
  await page
    .context()
    .route("https://soico.example.co.jp/**", (r) =>
      r.fulfill({ contentType: "text/html", body: "<title>SOICO</title><p>ok</p>" }),
    );
  const links = [
    ["SOICO 食品パッケージ画像編集 SaaS", "https://soico.example.co.jp/"],
    ["SOICO 会社概要", "https://soico.example.co.jp/company"],
    ["導入事例 3 社", "https://soico.example.co.jp/cases"],
    ["料金ページ", "https://soico.example.co.jp/pricing"],
  ] as const;
  const md = [
    "見積書を作りました。",
    "| 項目 | 人日 | 単価 | 金額 |\n|---|---:|---:|---:|\n| 要件定義 | 8 | 60000 | 480000 |\n| 実装 | 49.5 | 60000 | 2970000 |\n| テスト | 8 | 60000 | 480000 |",
    "### 先方サイトの要点",
    links.map(([t, h]) => `- [${t}](${h})`).join("\n"),
  ].join("\n\n");
  const c = await seedConv(u, "SOICO の見積書", [
    ["human", "SOICO の見積書を作って。比較の表と、先方サイトの要点も"],
    ["ai", md, { ops: 6, ms: 184_000 }],
  ]);
  await openConv(page, c);
  const ai = lastAi(page);
  await expect(ai.locator(".mtable")).toBeVisible({ timeout: 20_000 });
  await toggleWork(page, ai.locator("[data-work-done]"), /^6 つの操作 · 3\s*分\s*0?4\s*秒$/);
  // CSV（186）
  const dl = page.waitForEvent("download");
  await ai.locator("[data-csv]").click();
  const file = await dl;
  expect(file.suggestedFilename()).toMatch(/\.csv$/);
  const csv = readFileSync((await file.path())!, "utf8");
  expect(csv).toContain("要件定義");
  expect(csv).toContain("2970000");
  // 調べたページ（188〜191）：外は新しいタブで開く
  for (const [t, h] of links) {
    const pop = page.waitForEvent("popup");
    await ai.getByRole("link", { name: t, exact: true }).click();
    const tab = await pop;
    await tab.waitForLoadState();
    expect(tab.url()).toBe(h);
    await tab.close();
  }
  await expect(page, "元の会話はそのまま").toHaveURL(new RegExp(`c=${c}`));
});

test("SCR-CLONE-CHAT-255 SCR-CLONE-CHAT-256 SCR-CLONE-CHAT-257 SCR-CLONE-CHAT-258 SCR-CLONE-CHAT-259 SCR-CLONE-CHAT-260 SCR-CLONE-CHAT-261 SCR-CLONE-CHAT-262 SCR-CLONE-CHAT-263 SCR-CLONE-CHAT-264 SCR-CLONE-CHAT-265 SCR-CLONE-CHAT-266 成果物を横で直す：直すタブで書き換えて保存すると新しい版、版を開いて戻すと新しい版、見る・版の一覧・名前を直す・いまの版を落とす・閉じる", async ({
  page,
}) => {
  const u = await ready(page);
  await say(page, "京蟻の見積の方針をまとめて");
  await expect(lastAi(page)).toContainText("9 月の請求のまとめ", { timeout: 30_000 });
  await lastAi(page).locator(".mact [data-export]").click();
  const art = page.locator("[data-artifact]");
  await expect(art).toBeVisible({ timeout: 15_000 });
  const vers = () =>
    admin<{ version: number; reverted_from: number | null }>(
      "select v.version, v.reverted_from from artifact_versions v join artifacts a on a.id = v.artifact_id where a.owner_member_id = $1 order by v.version",
      [u.memberId],
    );
  // 直す（258）→ 中身（259）→ 保存（265）＝版 2
  await art.getByRole("tab", { name: "直す" }).click();
  await expect(art.getByRole("tab", { name: "直す" })).toHaveAttribute("aria-selected", "true");
  const ed = art.getByRole("textbox", { name: "成果物の中身" });
  const v1 = await ed.inputValue();
  await ed.fill(`${v1}\n\n先週の工数表から 1,450,000 円。着手金は 3 割。`);
  await art.getByRole("button", { name: "保存（新しい版にする）" }).click();
  await expect(art.locator(".ah .v")).toHaveText("版 2", { timeout: 15_000 });
  // 見る（257）
  await art.getByRole("tab", { name: "見る" }).click();
  await expect(art.getByRole("textbox", { name: "成果物の中身" })).toHaveCount(0);
  await expect(art).toContainText("着手金は 3 割");
  // 版 1（264）を開いて、この版に戻す（263）＝版 3
  await art.locator("[data-art-version='1'] .vopen").click();
  await expect(art.locator("[data-art-old]")).toContainText("版 1 を見ています（いまは版 2）");
  await expect(art.locator(".ab")).not.toContainText("着手金は 3 割");
  await art.locator("[data-art-revert-here]").click();
  await expect(art.locator(".ah .v")).toHaveText("版 3", { timeout: 15_000 });
  await expect.poll(vers).toEqual([
    { version: 1, reverted_from: null },
    { version: 2, reverted_from: null },
    { version: 3, reverted_from: 1 },
  ]);
  await expect(art.locator("[data-art-version='3']")).toContainText("版 1 に戻した");
  // 版 2（262）を開く → 中身は版 2。版 3（261）＝いまの版を押すと今の版に戻る
  await art.locator("[data-art-version='2'] .vopen").click();
  await expect(art.locator("[data-art-old]")).toContainText("版 2 を見ています（いまは版 3）");
  await expect(art.locator(".ab")).toContainText("着手金は 3 割");
  await art.locator("[data-art-version='3'] .vopen").click();
  await expect(art.locator("[data-art-old]")).toHaveCount(0);
  await expect(art.locator(".ab")).not.toContainText("着手金は 3 割");
  // 版の一覧（260）は開閉する
  const list = art.locator("details.avers");
  await expect(list.locator("summary")).toHaveText("版の一覧（3）");
  await list.locator("summary").click();
  await expect(list).not.toHaveAttribute("open", "");
  await list.locator("summary").click();
  await expect(list).toHaveAttribute("open", "");
  // 名前を直す（255）
  await art.locator("[data-art-title]").click();
  await art.getByRole("textbox", { name: "成果物の名前" }).fill("京蟻 見積の方針");
  await art.getByRole("textbox", { name: "成果物の名前" }).press("Enter");
  await expect(art.locator("[data-art-title]")).toHaveText("京蟻 見積の方針");
  await expect
    .poll(
      async () =>
        (await admin<{ title: string }>("select title from artifacts where owner_member_id = $1", [u.memberId]))[0]!
          .title,
    )
    .toBe("京蟻 見積の方針");
  // いまの版を落とす（266）＝版 3（版 1 の中身）
  const dl = page.waitForEvent("download");
  await art.getByRole("button", { name: "いまの版を落とす" }).click();
  const got = readFileSync((await (await dl).path())!, "utf8");
  expect(got).toContain("9 月の請求のまとめ");
  expect(got, "いまの版（版 1 に戻した中身）").not.toContain("着手金は 3 割");
  // 閉じる（256）
  await art.getByRole("button", { name: "成果物を閉じる" }).click();
  await expect(page.locator("[data-artifact]")).toHaveCount(0);
  await expect(lastAi(page).locator("[data-art-card]")).toContainText("京蟻 見積の方針");
});

test("SCR-CLONE-CHAT-286 SCR-CLONE-CHAT-287 SCR-CLONE-CHAT-289 SCR-CLONE-CHAT-290 AI が Chrome を使えなかった：作業の 1 行が開閉し、つなぎ方を見る・もう一度確かめる・Bridge 専用のブラウザに切り替える がその場で効く", async ({
  page,
}) => {
  const u = await ready(page, { browser: "chrome" });
  await say(page, "発注ナビの今週の新着案件、ブラウザで見ておいて");
  const line = page.locator('[data-notice="browser-off"]');
  await expect(line).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Chrome の拡張機能とつながっていないので、ブラウザを使わずに答えます。")).toBeVisible({
    timeout: 30_000,
  });
  await expect.poll(async () => (await jobs(u.memberId)).at(-1)?.state_id, { timeout: 30_000 }).toBe("done");
  await expect(page.locator("[data-working]")).toHaveCount(0, { timeout: 15_000 });
  // 作業の 1 行（286）
  const nOps = (
    await admin<{ n: number }>(
      "select count(*)::int as n from bridge_job_events e join bridge_jobs j on j.id = e.job_id where j.member_id = $1 and j.conversation_id is not null and e.kind = 'tool'",
      [u.memberId],
    )
  )[0]!.n;
  await toggleWork(page, lastAi(page).locator("[data-work-done]"), new RegExp(`^${nOps} つの操作 · `));
  // つなぎ方を見る（287）
  const fix = line.locator("[data-browser-fix]");
  await expect(fix.locator("ol")).toBeHidden();
  await fix.getByText("つなぎ方を見る").click();
  await expect(fix.locator("ol li")).toHaveCount(3);
  await fix.getByText("つなぎ方を見る").click();
  await expect(fix.locator("ol")).toBeHidden();
  await fix.getByText("つなぎ方を見る").click();
  await expect(fix.locator("ol")).toBeVisible();
  // Chrome ウェブストアで開く（288）は押さない：自動操作の Chrome はウェブストアを開くとブラウザごと閉じる（2026-10-01 実測）。ここでは入口があることだけ見る
  await expect(fix.getByRole("link", { name: "Chrome ウェブストアで開く" })).toBeVisible();
  // もう一度確かめる（289）：Bridge に小さな仕事を渡して結果を言う
  await fix.getByRole("button", { name: "もう一度確かめる" }).click();
  await expect(fix.locator("[data-browser-fix-msg]")).toHaveText(/つながりました|まだつながっていません/, {
    timeout: 90_000,
  });
  // Bridge 専用のブラウザに切り替える（290）
  await fix.getByRole("button", { name: "Bridge 専用のブラウザに切り替える" }).click();
  await expect(fix.locator("[data-browser-fix-msg]")).toHaveText(
    "Bridge 専用のブラウザに切り替えました。次の仕事から使います",
  );
  const b = await admin<{ b: string }>(
    "select browser as b from sessions where member_id = $1 and kind_id = 'bridge' and revoked_at is null order by last_seen_at desc limit 1",
    [u.memberId],
  );
  expect(b[0]!.b).toBe("dedicated");
});

test("SCR-CLONE-CHAT-212 SCR-CLONE-CHAT-211 送れなかった文は消えず「もう一度送る」で届く。PC が閉じていると帯が出て「PC の状態を見る」で PC の画面が開く", async ({
  page,
}) => {
  const u = await ready(page);
  await page.route("**/api/auth-ext/agent/say", (r) => r.abort("internetdisconnected"));
  await say(page, "京蟻の請求書も今日中に");
  const failed = page.locator("[data-failed]");
  await expect(failed).toContainText("京蟻の請求書も今日中に", { timeout: 15_000 });
  await expect(failed).toContainText("送れませんでした（回線が切れていました）。書いた文は残っています");
  expect((await jobs(u.memberId)).length, "送れていない").toBe(0);
  await page.unroute("**/api/auth-ext/agent/say");
  await failed.getByRole("button", { name: "もう一度送る" }).click();
  await expect(page.locator("[data-failed]")).toHaveCount(0, { timeout: 15_000 });
  await expect(lastMe(page)).toContainText("京蟻の請求書も今日中に");
  await expect.poll(async () => (await jobs(u.memberId)).length, { timeout: 15_000 }).toBe(1);
  await expect(lastAi(page)).toBeVisible({ timeout: 30_000 });
  // PC が閉じている（Bridge の知らせが来ない）
  for (const b of bridges) b.stop();
  bridges = [];
  await bridgeAsleep(u.sid);
  const asleep = page.locator("[data-asleep]");
  await expect(asleep).toContainText("あなたのPCが閉じているので、いまは動けません", { timeout: 60_000 });
  await asleep.getByRole("link", { name: "PC の状態を見る" }).click();
  await expect(page).toHaveURL(/\/setup\/bridge$/);
  expect((await page.request.get("/setup/bridge")).status()).toBe(200);
});

test("SCR-CLONE-CHAT-221 SCR-CLONE-CHAT-222 SCR-CLONE-CHAT-223 まだ話していない会話の「よく頼むこと」は、押すとその文のまま送られる（会話モードの 3 つ）", async ({
  page,
}) => {
  const u = await ready(page);
  const prompts = page.locator("[data-prompts] button");
  await expect(prompts).toHaveCount(3);
  const texts = await prompts.allInnerTexts();
  for (const [i, t] of texts.entries()) {
    if (i > 0) {
      await page.locator("[data-new-conversation]").click();
      await expect(page.locator("[data-prompts] button")).toHaveCount(3);
    }
    await page.locator("[data-prompts] button", { hasText: t }).click();
    await expect(lastMe(page)).toHaveText(new RegExp(t.replace(/[?？]/g, ".")));
    await expect.poll(async () => (await jobs(u.memberId)).length, { timeout: 15_000 }).toBe(i + 1);
    expect((await jobs(u.memberId))[i]!.prompt).toContain(t);
    await expect(lastAi(page)).toBeVisible({ timeout: 30_000 });
  }
  expect((await convs(u.memberId)).length, "押すたびに別の会話").toBe(3);
});

test("SCR-CLONE-CHAT-234 返事の一部を選ぶと「引用して続ける」が出て、押すと引用つきで送れる", async ({ page }) => {
  const u = await ready(page);
  await say(page, "来週やることを 3 つに絞って");
  await expect(lastAi(page)).toContainText("出典はこちら", { timeout: 30_000 });
  await lastAi(page)
    .locator("p.mp")
    .first()
    .evaluate((p) => {
      p.scrollIntoView({ block: "center" });
      const r = document.createRange();
      const t = [...p.childNodes].find((n) => n.nodeType === 3 && (n.textContent ?? "").trim().length > 3)!;
      r.setStart(t, 0);
      r.setEnd(t, 4);
      const s = getSelection()!;
      s.removeAllRanges();
      s.addRange(r);
      p.closest(".chat")!.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });
  const quoted = await page.evaluate(() => getSelection()!.toString());
  await page.locator("[data-quote-pop]").getByRole("button", { name: "引用して続ける" }).click();
  await expect(page.locator(".cchip").first()).toContainText(`「${quoted}`);
  await say(page, "ここをもう少し詳しく");
  await expect(lastMe(page).locator(".qt")).toContainText(quoted);
  await expect.poll(async () => (await jobs(u.memberId)).at(-1)?.prompt ?? "", { timeout: 15_000 }).toContain(quoted);
});

test("SCR-CLONE-CHAT-025 375・768・1024・1440 で横に溢れない。1180 以上では本文が 720 以上", async ({ page }) => {
  await ready(page);
  await say(page, "今月の受注の見込みと、来週やることを整理して");
  await expect(lastAi(page)).toBeVisible({ timeout: 30_000 });
  const url = new URL(page.url());
  await noOverflow(page, url.pathname + url.search);
  for (const w of [1180, 1440]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto(url.pathname + url.search);
    await expect(lastAi(page)).toBeVisible({ timeout: 30_000 });
    const main = await page.locator("main").first().boundingBox();
    expect(main!.width, `幅 ${w} の本文`).toBeGreaterThanOrEqual(720);
  }
});

test("SCR-CLONE-CHAT-026 データ 0 件（あいさつだけ）と、AI が止まっている（PC が閉じている）状態が出る", async ({
  page,
}) => {
  const u = await ready(page);
  // 空：会話が 1 つも無い
  await expect(page.locator("[data-greet]")).toBeVisible();
  await expect(page.locator(".msg")).toHaveCount(0);
  await expect(page.locator('[data-part="conversation-list"]')).toContainText("まだ会話はありません");
  // 止まっている：PC が閉じている（PS4）。言うことは書ける
  for (const b of bridges) b.stop();
  bridges = [];
  await bridgeAsleep(u.sid);
  await page.reload();
  await expect(page.locator("[data-asleep]")).toContainText("あなたのPCが閉じているので、いまは動けません", {
    timeout: 30_000,
  });
  await expect(page.locator("[data-asleep]")).toContainText("PC が起きたときに順に片づけます");
  await expect(box(page)).toBeEnabled();
});

// 表記ゆらぎ（会話を探す）：同じ会話として当たる
async function searchHits(page: Page, q: string) {
  const list = page.locator('[data-part="conversation-list"]');
  await list.getByRole("textbox", { name: "会話を探す" }).fill(q);
  await page
    .waitForResponse((r) => /\/agent\/conversations/.test(r.url()) && r.url().includes("q="), { timeout: 15_000 })
    .catch(() => null);
  await page.waitForTimeout(800);
  return list.locator("[data-conversation]").count();
}
async function searchReady(page: Page) {
  const u = await ready(page);
  await seedConv(u, "SOICO の概算 ABC-123", [
    ["human", "ガチャ演出の見積 990 円"],
    ["ai", "了解です"],
  ]);
  await page.reload();
  await expect(page.locator('[data-part="conversation-list"] [data-conversation]')).toHaveCount(1, { timeout: 20_000 });
  return u;
}
test("SCR-CLONE-CHAT-027 表記ゆらぎ（全角／半角）：全角で探しても半角の会話に当たる", async ({ page }) => {
  await searchReady(page);
  for (const q of ["ＳＯＩＣＯ", "ＡＢＣ", "９９０"]) expect(await searchHits(page, q), `「${q}」`).toBe(1);
});
test("SCR-CLONE-CHAT-028 表記ゆらぎ（前後と途中の空白）：空白を足しても同じ会話に当たる", async ({ page }) => {
  await searchReady(page);
  for (const q of ["  SOICO  ", "SOICO　の概算", "SOICO  の概算"])
    expect(await searchHits(page, q), `「${q}」`).toBe(1);
});
test("SCR-CLONE-CHAT-029 表記ゆらぎ（ハイフン・長音）：‐ − ー を混ぜても同じ会話に当たる", async ({ page }) => {
  await searchReady(page);
  for (const q of ["ABC‐123", "ABC−123", "ABCー123"]) expect(await searchHits(page, q), `「${q}」`).toBe(1);
});
test("SCR-CLONE-CHAT-030 表記ゆらぎ（NFC／NFD）：macOS の入力（NFD）で探しても当たる", async ({ page }) => {
  await searchReady(page);
  const nfd = "ガチャ".normalize("NFD");
  expect(nfd).not.toBe("ガチャ");
  expect(await searchHits(page, nfd)).toBe(1);
});
test("SCR-CLONE-CHAT-031 表記ゆらぎ（大文字小文字）：小文字・大文字で探しても当たる", async ({ page }) => {
  await searchReady(page);
  for (const q of ["soico", "abc-123", "SoIcO"]) expect(await searchHits(page, q), `「${q}」`).toBe(1);
});

test("SCR-CLONE-CHAT-033 G-12 Bridge が切れた直後（鮮度の窓の内側）に送った文は失われず、窓を過ぎると「PC が閉じている」が出る", async ({
  page,
}) => {
  const u = await ready(page);
  await say(page, "はじめ");
  await expect(lastAi(page)).toBeVisible({ timeout: 30_000 });
  // 返事の文が出終わっても、仕事の終わりの知らせは少し遅れて来る。その間に送ると「止めずに直す」として今の仕事に並ぶ（D-104.9）。
  // この行の前提は「最初の仕事が終わってから PC が切れた」なので、仕事が終わるのを待つ
  await expect.poll(async () => (await jobs(u.memberId)).map((j) => j.state_id), { timeout: 30_000 }).toEqual(["done"]);
  for (const b of bridges) b.stop();
  bridges = [];
  // 切れた直後 0 秒：画面はまだ知らない。送る
  await say(page, "京蟻の請求書も今日中に");
  await expect(lastMe(page)).toContainText("京蟻の請求書も今日中に", { timeout: 15_000 });
  await expect.poll(async () => (await jobs(u.memberId)).length, { timeout: 15_000 }).toBe(2);
  // 鮮度の窓を過ぎた
  await bridgeAsleep(u.sid);
  await expect(page.locator("[data-asleep]")).toBeVisible({ timeout: 60_000 });
  await page.reload();
  await expect(page.locator("[data-asleep]")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".chat")).toContainText("京蟻の請求書も今日中に");
  const kept = await admin<{ body: string }>(
    "select m.body from messages m join conversations c on c.id = m.conversation_id where c.owner_member_id = $1 and m.kind = 'human' order by m.created_at",
    [u.memberId],
  );
  expect(
    kept.map((m) => m.body),
    "押した内容は DB にも残る",
  ).toContain("京蟻の請求書も今日中に");
});

test("SCR-CLONE-CHAT-034 G-13 動いている間に許可のモードを切り替えても、今の仕事は元のモードのまま、次の仕事から効く。止めて「続けて」は同じ続き", async ({
  page,
}) => {
  const u = await ready(page);
  await say(page, "長く書いて");
  await expect(page.locator("[data-streaming]")).toBeVisible({ timeout: 30_000 });
  const before = (await jobs(u.memberId))[0]!.permission_mode;
  await page.getByRole("button", { name: /毎回聞く/ }).click();
  await page
    .getByRole("listbox", { name: "許可のモード" })
    .getByRole("option", { name: /計画だけ/ })
    .click();
  expect((await jobs(u.memberId))[0]!.permission_mode, "動いている仕事のモードは変わらない").toBe(before);
  await page.getByRole("button", { name: "止める" }).click();
  await expect(page.locator("[data-stopped-reason]").last()).toContainText("あなたが止めました", { timeout: 20_000 });
  await say(page, "続けて。引数を見せて");
  await expect(lastAi(page)).toContainText("許可=plan", { timeout: 30_000 });
  const js = await jobs(u.memberId);
  expect(js.map((j) => j.permission_mode)).toEqual([before, "plan"]);
  expect(js[1]!.agent_session_id, "同じ続き").toBe(js[0]!.agent_session_id);
});

test("SCR-CLONE-CHAT-035 G-14 パスワードを変えると、会話を開いていた端末の鍵と Bridge はすぐに 401 になり、画面はログインへ送られる", async ({
  page,
}) => {
  const u = await ready(page);
  await say(page, "はじめ");
  await expect(lastAi(page)).toBeVisible({ timeout: 30_000 });
  for (const b of bridges) b.stop();
  bridges = [];
  // 再設定の前からある端末（画面と Bridge）。再設定の後に新しいパスワードで入った分は数えない
  const before = (
    await admin<{ id: string }>("select id from sessions where member_id = $1 and revoked_at is null", [u.memberId])
  ).map((x) => x.id);
  expect(before.length, "再設定の前に画面と Bridge の端末がある").toBeGreaterThanOrEqual(2);
  // 別の端末でパスワードを変える
  const other = await page.context().browser()!.newPage();
  await other.goto(new URL("/password-reset", page.url()).toString());
  await other.getByLabel("メールアドレス").fill(u.email);
  await other.getByRole("button", { name: "再設定メールを送る" }).click();
  await expect(other.locator("[data-state='s']")).toBeVisible({ timeout: 15_000 });
  const url = lastMailUrl("reset", u.email);
  expect(url, "再設定のリンク（KANAME_API_LOG）").toBeTruthy();
  const nu = new URL(url!);
  await other.goto(new URL(nu.pathname + nu.search, page.url()).toString());
  const fresh = "new-password-qa-a1-12345";
  await other.getByLabel("新しいパスワード", { exact: true }).fill(fresh);
  await other.getByLabel("もう一度").fill(fresh);
  await other.getByRole("button", { name: "パスワードを決める" }).click();
  await expect(other.locator("[data-state='done']")).toBeVisible({ timeout: 15_000 });
  await other.getByRole("link", { name: "ログインする" }).click();
  await expect(other).toHaveURL(/\/login$/, { timeout: 15_000 });
  await other.close();
  expect
    .soft((await api("/api/v1/auth/sign-in", { email: u.email, password: fresh })).status, "パスワードは変わった")
    .toBe(201);
  // 0 秒で：古い鍵は 401、Bridge も 401
  expect
    .soft((await api("/api/auth-ext/agent/state", undefined, u.token)).status, "会話を開いていた端末の古い鍵")
    .toBe(401);
  // 失効した Bridge の鍵は 410（Bridge はこれで鍵を捨てる・ext.ts bridgeAlive）
  expect.soft((await bridgeTake(u.sid)).status, "Bridge の鍵").toBe(410);
  const s = await admin<{ id: string }>("select id from sessions where id = any($1::uuid[]) and revoked_at is null", [
    before,
  ]);
  expect.soft(s, "再設定の前からあった端末は全部 revoked").toEqual([]);
  // 会話を開いていた端末：次に読むとログインへ
  await page.reload();
  await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
});

test("BRG-01-003 BRG-02-003 BRG-04-003 SCR-CLONE-CHAT-036 G-15 完了の知らせが無いまま Claude Code が終わったら成功にせず、理由と次の一手（続けて）を出す", async ({
  page,
}) => {
  const u = await ready(page);
  await say(page, "途中で落ちてみて");
  await expect(page.locator("[data-stopped-reason]").last()).toContainText("Claude Code が途中で終わりました", {
    timeout: 30_000,
  });
  await expect(page.locator("[data-part='stopped']").last()).toContainText("続けるなら「続けて」");
  await expect(page.locator('.msg[data-who="ai"]'), "途中の文を答えにしない").toHaveCount(0);
  expect((await jobs(u.memberId)).map((j) => j.state_id)).toEqual(["stopped"]);
});

test("SCR-CLONE-CHAT-037 G-16 同じ人が会話の状態を 40 本同時に読んでも 5xx にならず、その後もログインと会話が開く（DB 接続はプール経由）", async ({
  page,
}) => {
  const u = await ready(page);
  const rs = await Promise.all(
    Array.from({ length: 40 }, () =>
      fetch(`${API}/api/auth-ext/agent/state`, { headers: { authorization: `Bearer ${u.token}` } }).then(
        (r) => r.status,
      ),
    ),
  );
  expect(
    rs.filter((s) => s >= 500),
    "5xx が無い",
  ).toEqual([]);
  expect((await api("/api/v1/auth/sign-in", { email: u.email, password: PW })).status, "ログインが落ちない").toBe(201);
  await page.reload();
  await expect(page.locator('[data-part="conversation"]')).toBeVisible({ timeout: 30_000 });
});

// ---- 不具合の再現（行 ID なし・報告用）
test("（不具合）いちばん下で待っていた人には、返事が書き終わっても「いちばん下へ」と「新しい返事」が出ない（D-104.18：上を読んでいる間だけ追わない）", async ({
  page,
}) => {
  await ready(page);
  await say(page, "今月の受注の見込みと、来週やることを整理して");
  await expect(lastAi(page)).toContainText("出典はこちら", { timeout: 30_000 });
  await expect(page.locator("[data-working]")).toHaveCount(0, { timeout: 15_000 });
  await page.waitForTimeout(2000);
  await expect(page.locator("[data-to-bottom]"), "下にいたまま").toHaveCount(0);
});

test("（不具合）画面では自分のAI を本人の名前＋AI で出す（D-060：見出しは「高本AIと話す」・吹き出しの名前は「高本AI」）", async ({
  page,
}) => {
  const u = await ready(page);
  await admin("update members set display_name = '高本' where id = $1", [u.memberId]);
  await page.reload();
  await say(page, "こんにちは");
  await expect(lastAi(page)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1 }).first()).toHaveText("高本AIと話す");
  await expect(lastAi(page).locator(".who")).toHaveText("高本AI");
});
