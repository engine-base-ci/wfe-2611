// QA A2：会話の画面のエラー（E-CHAT・E-CONN・E-LIM・E-GATE）と、止まったときの扱い（BRG-03-033〜038）、
// 作業中の 1 行（CHT-27-005）を実ブラウザで押して確かめる。
// 期待は正本（packages/errors のエラー一覧・決定ログ D-090／D-104.15／D-104.8・モック）から書く（G-09）。
// Bridge は本物の輪（apps/bridge の loop）を回し、CLI だけ偽物（scripts/dev/fake-claude-demo.mjs）に差す。
// K-367：前の「PC をつなぐ」画面（T-U-09）を消したので、その画面を開いていた所を片付けた（前の画面が在っても無くても通る形）。
//   BRG-06-011（OS の警告の越え方）・BRG-06-013（自己診断の表）は消した。E-CONN-010 は PC の画面でログインする所を外し（K361-UI-005・006 が見る）、
//   E-CONN-012-C は PC の画面の自己診断と入れ直す口を外した（SCR-BRIDGE-SETUP-105・106 の置き換え先は、新しい画面の PC の行の入れ直す一手の行。番号は 11_tickets/K-367.md の表・代表の答え 7cf148a79dc9）。
//   生きている知らせは K-57 の契約の口（/api/v1/bridge/heartbeat）。仕事を取る口も契約の口（/api/v1/bridge/jobs/take・K-62）
// 偽の CLI に無い振る舞い（ログインしていない）は、この試験の中で一時フォルダに小さな CLI を書いて差す（本物の行の形・stream.ts の実測）。
// 本人の本物の Bridge は止めない。画面からだけ見えなくする（hideRealBridge）。
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import {
  API,
  admin,
  bridgeBeat,
  bridgeTake,
  claimBridge,
  hideRealBridge,
  loginAs,
  setupStep,
  signupViaApi,
} from "../_lib/api";
import { startAgentBridge, type AgentBridge } from "../_lib/agent-bridge";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const FAKE = join(ROOT, "scripts/dev/fake-claude-demo.mjs");
/** 画面に出してはいけない内部の言葉（設計者の言葉・ID・状態の名前） */
const INTERNAL =
  /D-\d{3}|E-[A-Z]+-\d{3}|bridge_jobs|session_id|job_id|queued|stopped|cancelled|RLS|null|undefined|api_error|stream-json|mcp__/;

let bridge: AgentBridge | null = null;
const extra: (() => void)[] = [];
test.beforeEach(async ({ page }) => {
  test.setTimeout(180_000); // 本物の輪で 2〜3 往復する（1 往復 10〜30 秒）
  await hideRealBridge(page);
});
test.afterEach(() => {
  bridge?.stop();
  bridge = null;
  while (extra.length) extra.pop()!();
  process.env["KANAME_CLAUDE_BIN"] = FAKE;
  runnerMod().forgetClaude();
});

const fromLoop = () => createRequire(join(ROOT, "apps/bridge/dist/loop.js"));
const runnerMod = () => fromLoop()("./runner.js") as { forgetClaude: () => void };
/** 同じ鍵（session）で Bridge の輪を回し直す＝閉じていた PC が起きた */
function resumeLoop(sid: string): () => void {
  const { startLoop } = fromLoop()("./loop.js") as {
    startLoop: (d: {
      apiBase: string;
      sessionId: () => string | null;
      health: () => Promise<unknown>;
      onChange: () => void;
      onGone: () => void;
    }) => () => void;
  };
  return startLoop({
    apiBase: API,
    sessionId: () => sid,
    health: async () => [],
    onChange: () => undefined,
    onGone: () => undefined,
  });
}

/** はじめの設定を通した人が、この PC をつないだ状態（本物の輪が回っている）で会話モードを開く */
async function ready(page: Page) {
  const u = await signupViaApi();
  bridge = await startAgentBridge(u.token);
  await setupStep(u.memberId, 6);
  await loginAs(page, u.token);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/ai/chat");
  await expect(page.locator('[data-part="conversation"]')).toBeVisible({ timeout: 20_000 });
  return u;
}
const box = (page: Page) => page.getByRole("textbox", { name: "自分のAIに書く" });
const say = async (page: Page, text: string) => {
  await box(page).fill(text);
  await box(page).press("Enter");
};
const lastAi = (page: Page) => page.locator('.msg[data-who="ai"]:not([data-streaming])').last();
const jobs = (memberId: string) =>
  admin<{
    id: string;
    state_id: string;
    agent_session_id: string | null;
    conversation_id: string | null;
    stop_requested_at: Date | null;
    stopped_reason: string | null;
  }>(
    "select id, state_id, agent_session_id, conversation_id, stop_requested_at, stopped_reason from bridge_jobs where member_id = $1 order by created_at",
    [memberId],
  );
const myMessages = (memberId: string, text: string) =>
  admin<{ n: number }>(
    "select count(*)::int as n from messages m join conversations c on c.id = m.conversation_id where c.owner_member_id = $1 and m.kind = 'human' and m.body = $2",
    [memberId, text],
  );
// ---------------------------------------------------------------- E-CHAT-001 回線が切れた
const SAY = /\/api\/auth-ext\/agent\/(say|steer)$/;
/** 1 回ふつうに話し終えてから、回線を切って書く。送れなかった印が出るまで */
async function sendWhileOffline(page: Page, t: string) {
  await say(page, "今月の請求をまとめて");
  await expect(page.locator('.msg[data-who="me"]').last()).toContainText("今月の請求をまとめて");
  await expect(lastAi(page)).toContainText("出典はこちら", { timeout: 30_000 });
  await expect(page.locator(".chat"), "前の仕事が終わっている").toHaveAttribute("aria-busy", "false", {
    timeout: 30_000,
  });
  const ok = {
    failed: await page.locator("[data-failed]").count(),
    err: await page.locator("[data-say-error]").count(),
  };
  // 回線を切る（Kaname に届かない。送る・動いている間の一言 のどちらの口も）
  await page.route(SAY, (r) => r.abort("internetdisconnected"));
  await say(page, t);
  await expect(page.locator("[data-failed]")).toBeVisible();
  return ok;
}
test("E-CHAT-001-A E-CHAT-001-B 送る途中で回線が切れたら、文を残して「送れませんでした」と「もう一度送る」が出る。届いていれば出ない", async ({
  page,
}) => {
  const u = await ready(page);
  const t = "回線が切れている間に書いた文";
  const before = await sendWhileOffline(page, t);
  expect(before, "B 届いたときは出さない（誤検知なし）").toEqual({ failed: 0, err: 0 });
  const failed = page.locator("[data-failed]");
  await expect(failed.locator(".bub"), "A 書いた文は消えない").toHaveText(t);
  await expect(failed.locator(".sendfail"), "A 文言").toContainText(
    "送れませんでした（回線が切れていました）。書いた文は残っています",
  );
  await expect(failed.getByRole("button", { name: "もう一度送る" }), "A 一手が出る").toBeEnabled();
  await expect(box(page), "入力欄は空いて、次を書ける").toBeEnabled();
  expect((await myMessages(u.memberId, t))[0]!.n, "Kaname には届いていない（送ったことにしない）").toBe(0);
});

test("E-CHAT-001-C 「送れませんでした」に内部語が無く、いちばん下で「もう一度送る」が押せて送れる。API が理由つきで断っても文を残す（2 層）", async ({
  page,
}) => {
  const u = await ready(page);
  const t = "回線が戻ったら送る文";
  await sendWhileOffline(page, t);
  const failed = page.locator("[data-failed]");
  const retry = failed.getByRole("button", { name: "もう一度送る" });
  const text = (await failed.locator(".sendfail").innerText()).replace(/\s+/g, "");
  expect(INTERNAL.test(text), `内部語: ${text}`).toBe(false);
  await page.unroute(SAY);
  // 人と同じく、いちばん下まで戻ってから押す
  const toBottom = page.locator("[data-to-bottom]");
  if (await toBottom.isVisible()) await toBottom.click();
  await expect
    .soft(toBottom, "「いちばん下へ」を押したら、いちばん下にいるので消える")
    .toHaveCount(0, { timeout: 5_000 });
  // いちばん下で、一手「もう一度送る」がほかの部品に隠れずに押せる（押す場所の真ん中に、そのボタンがある）
  const covered = await retry.evaluate((b) => {
    const r = b.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return hit && (hit === b || b.contains(hit))
      ? null
      : `${hit?.tagName}.${(hit as HTMLElement | null)?.className ?? ""}（${Math.round(r.top)}px）`;
  });
  expect.soft(covered, "一手「もう一度送る」がほかの部品に隠れている").toBeNull();
  // 隠れていてもキーボードでは押せる（Tab で移って Enter）。回復の道はそれで確かめる
  await retry.focus();
  await page.keyboard.press("Enter");
  await expect(failed, "送れたら印は消える").toHaveCount(0);
  await expect(page.locator('.msg[data-who="me"]').last()).toContainText(t);
  await expect
    .poll(async () => (await myMessages(u.memberId, t))[0]!.n, { message: "1 回だけ届く（二重にならない）" })
    .toBe(1);
  // 2 層目：API が理由つきで断ったときも、その理由を出して文を残す
  await expect(page.locator(".chat")).toHaveAttribute("aria-busy", "false", { timeout: 40_000 });
  await page.route(SAY, (r) =>
    r.fulfill({ status: 503, json: { error: "unavailable", code: "UNAVAILABLE", message: "いま混み合っています" } }),
  );
  await say(page, "二つ目の文");
  await expect(page.locator("[data-failed] .sendfail")).toContainText(
    "送れませんでした（いま混み合っています）。書いた文は残っています",
  );
  await expect(page.locator("[data-failed] .bub")).toHaveText("二つ目の文");
});

// ---------------------------------------------------------------- E-CHAT-002 置き場に置けない
/** この会社の置き場だけ書けなくする（ほかの会社・ほかの試験には触らない）。afterEach で戻す */
function breakMyStorage(tenantId: string): () => void {
  const mine = join(ROOT, ".dev-storage", "tenants", tenantId);
  mkdirSync(mine, { recursive: true });
  chmodSync(mine, 0o555);
  const undo = () => chmodSync(mine, 0o755);
  extra.push(undo);
  return undo;
}
const STORE_MSG = "資料を置けませんでした（保存先が応答しません）。付けた一覧に残っているので、もう一度送ってください";
const attachFile = (page: Page, name: string) =>
  page
    .locator('input[type="file"]')
    .setInputFiles({ name, mimeType: "text/csv", buffer: Buffer.from("日付,金額\n9/1,1000\n") });

test("E-CHAT-002-B 置き場に置ければ、添付の一覧に付いてエラーは出ない", async ({ page }) => {
  await ready(page);
  await attachFile(page, "置ける.csv");
  await expect(page.locator("[data-att-state='ok']")).toContainText("置ける.csv", { timeout: 15_000 });
  await expect(page.locator("[data-att-state='error']")).toHaveCount(0);
  await say(page, "この台帳を見て");
  await expect(page.locator('.msg[data-who="me"]').last().locator(".cchip"), "資料つきで送れる").toContainText(
    "置ける.csv",
    { timeout: 15_000 },
  );
  await expect(page.locator("[data-failed], [data-say-error]")).toHaveCount(0);
});

test("E-CHAT-002-A SCR-CLONE-CHAT-292 置き場に置けなければ文言が出て、送っても付けた一覧に残り文も消えない（資料なしで送ったことにしない）", async ({
  page,
}) => {
  const u = await ready(page);
  breakMyStorage(u.tenantId);
  await attachFile(page, "台帳.csv");
  const chip = page.locator("[data-att-state='error']");
  await expect(chip, "札が赤くなる").toContainText("台帳.csv（置けませんでした）", { timeout: 15_000 });
  await expect(page.locator("[data-att-failed]"), "出る（札の下の 1 行）").toHaveText(STORE_MSG);
  await box(page).fill("この台帳を見て");
  await box(page).press("Enter");
  await page.waitForTimeout(1500); // 送る処理が走りきるのを待つ（出るものが無いことを確かめるため）
  await expect.soft(chip, "送っても付けた一覧は残る").toBeVisible();
  await expect.soft(box(page), "送っても文は消えない").toHaveValue("この台帳を見て");
  expect
    .soft(
      (await myMessages(u.memberId, "この台帳を見て"))[0]!.n,
      "資料が置けていないのに、資料なしで送ったことにしない",
    )
    .toBe(0);
});

test("E-CHAT-002-C SCR-CLONE-CHAT-293 置けなかった文言に内部語が無く、一手「外す」「もう一度送る」で回復する。画面を通さず API に置いても断られる（2 層）", async ({
  page,
}) => {
  const u = await ready(page);
  const undo = breakMyStorage(u.tenantId);
  await attachFile(page, "台帳.csv");
  const chip = page.locator("[data-att-state='error']");
  await expect(chip).toContainText("台帳.csv（置けませんでした）", { timeout: 15_000 });
  await expect(page.locator("[data-att-failed]")).toHaveText(STORE_MSG);
  const text = ((await chip.innerText()) + (await page.locator("[data-att-failed]").innerText())).replace(/\s+/g, "");
  expect(INTERNAL.test(text), `内部語: ${text}`).toBe(false);
  // 2 層目：画面を通さず API に直接置いても断られる（C4 が止める）
  const fd = new FormData();
  fd.append("file", new Blob(["x"], { type: "text/plain" }), "直接.txt");
  const direct = await fetch(`${API}/api/auth-ext/agent/attachments`, {
    method: "POST",
    headers: { authorization: `Bearer ${u.token}` },
    body: fd,
  });
  expect(direct.status, "API も断る").toBe(502);
  expect(((await direct.json()) as { code?: string }).code).toBe("E-CHAT-002");
  // 一手「外す」：押すと一覧から消える
  await page.getByRole("button", { name: "台帳.csvを外す" }).click();
  await expect(chip, "外すと消える").toHaveCount(0);
  // 一手「もう一度送る」：置き場が戻ってから押すと、資料つきで送れる
  await attachFile(page, "台帳.csv");
  await expect(chip).toContainText("台帳.csv（置けませんでした）", { timeout: 15_000 });
  undo();
  // 一手「もう一度送る」：置き場が戻ってから押すと、その資料を置き直す（文は本人が送る。勝手に送らない）
  const again = page.getByRole("button", { name: "台帳.csvをもう一度送る" });
  await expect(again, "一手「もう一度送る」が押せる").toBeVisible({ timeout: 5_000 });
  await again.click();
  await expect(page.locator("[data-att-state='ok']"), "置けた").toContainText("台帳.csv", { timeout: 15_000 });
  await expect(page.locator("[data-att-failed]"), "理由の 1 行は消える").toHaveCount(0);
  await box(page).fill("この台帳を見て（置き直した）");
  await box(page).press("Enter");
  await expect(page.locator('.msg[data-who="me"]').last().locator(".cchip")).toContainText("台帳.csv", {
    timeout: 15_000,
  });
});

// ---------------------------------------------------------------- E-CHAT-003 止める合図が届かない
test("E-CHAT-003-A E-CHAT-003-B E-CHAT-003-C PC が応答しないと止めたことにせず文言が出る。応答すれば止まりましたと理由。一手で PC の状態へ。起きたら止まる", async ({
  page,
}) => {
  const u = await ready(page);
  // B Bridge が止めた知らせを返す → 「止まりました」と理由。エラーは出ない
  await say(page, "長く書いて");
  await expect(page.locator("[data-streaming]")).toBeVisible({ timeout: 15_000 });
  await page.locator("[data-stop]").click();
  await expect(page.locator("[data-stopped-reason]").last(), "B 止まりましたと理由").toContainText(
    "あなたが止めました",
    { timeout: 15_000 },
  );
  await expect(page.locator("[data-say-error]"), "B 届いたときは出さない").toHaveCount(0);
  // A PC が応答しない（Bridge を落とす）→ 止めるを押しても止めたことにしない
  await say(page, "とても長く書いて");
  await expect(page.locator("[data-working]")).toBeVisible({ timeout: 15_000 });
  const sid = bridge!.sid;
  bridge!.stop();
  bridge = null;
  await admin("update sessions set last_seen_at = now() - interval '10 minutes' where id = $1", [sid]);
  await expect(page.locator("[data-asleep]")).toBeVisible({ timeout: 30_000 });
  await page.locator("[data-stop]").click();
  const err = page.locator("[data-say-error]");
  await expect(err, "A 出る").toHaveText(
    "止める合図を PC に届けられませんでした（PC が応答しません）。PC が起きたらすぐ止めます",
  );
  const last = (await jobs(u.memberId)).at(-1)!;
  expect(last.state_id, "止めたことにしない").toBe("running");
  expect(last.stop_requested_at, "止める合図は Kaname に残っている（API の層）").not.toBeNull();
  await expect(page.locator("[data-stopped-reason]"), "止まりました を新しく足さない").toHaveCount(1);
  // C 内部語が無い。一手「PC の状態を見る」で PC の状態の画面へ
  expect(INTERNAL.test((await err.innerText()).replace(/\s+/g, "")), "C 内部語").toBe(false);
  await page.locator("[data-asleep]").getByRole("link", { name: "PC の状態を見る" }).click();
  await expect(page).toHaveURL(/\/setup\/bridge$/);
  await expect(
    page.locator('[data-state="slp"], [data-state="other"]').first(),
    "PC が応答していないことが分かる",
  ).toBeVisible({ timeout: 15_000 });
  // 2 層目（Bridge）：PC が起きたら、動いたまま残った仕事は止まる（勝手に最後まで動かない）
  extra.push(resumeLoop(sid));
  await expect
    .poll(async () => (await jobs(u.memberId)).at(-1)!.state_id, { timeout: 30_000, message: "起きたら止まる" })
    .toBe("stopped");
});

// ---------------------------------------------------------------- E-CONN-010 Claude Code にログインしていない
/** 本物の CLI がログインしていないときの行の形（apps/bridge/src/stream.ts の実測）を返す、小さな CLI */
function noLoginCli(): string {
  const p = join(tmpdir(), `kaname-qa-a2-nologin-${process.pid}.mjs`);
  writeFileSync(
    p,
    `#!/usr/bin/env node
if (process.argv.includes("--version")) { console.log("2.1.280 (qa)"); process.exit(0); }
const out = (o) => process.stdout.write(JSON.stringify(o) + "\\n");
const sid = crypto.randomUUID();
let got = false;
process.stdin.on("data", () => {
  if (got) return; got = true;
  out({ type: "system", subtype: "init", session_id: sid, model: "claude-opus-4-8", mcp_servers: [] });
  out({ type: "result", subtype: "success", is_error: true, terminal_reason: "api_error", result: "Failed to authenticate. API Error: 401 authentication_error", session_id: sid });
  setTimeout(() => process.exit(1), 100);
});
`,
  );
  chmodSync(p, 0o755);
  return p;
}
test("E-CONN-010-A E-CONN-010-B E-CONN-010-C ログインしていない PC に仕事を渡すと「ログインできていません」と一手。ログイン済みなら出ない。ログインし直した PC なら動く（PC の画面でログインする所は K361-UI-005・006）", async ({
  page,
}) => {
  const u = await ready(page);
  const MSG =
    "Claude Code にログインできていません。Bridge の「ログインする」を押して、ブラウザで 1 回許可してください";
  // B ログイン済み・上限なし → 出ない
  await say(page, "今日の予定を教えて");
  await expect(lastAi(page)).toContainText("出典はこちら", { timeout: 30_000 });
  await expect(page.locator("[data-part='stopped']"), "B 出ない").toHaveCount(0);
  // A この PC の Claude Code がログインしていない
  process.env["KANAME_CLAUDE_BIN"] = noLoginCli();
  runnerMod().forgetClaude();
  await say(page, "請求書を作って");
  await expect(page.locator("[data-stopped-reason]").last(), "A 出る").toHaveText(MSG, { timeout: 30_000 });
  await expect(page.locator('.msg[data-who="ai"]'), "失敗を返事として出さない").toHaveCount(1);
  expect((await jobs(u.memberId)).at(-1)!.state_id).toBe("stopped");
  // C 内部語が無い。入力欄は開いたまま（一手の「ログインする」を PC の画面で押す所は K-361 の新しい画面の試験 K361-UI-005・006 が見る）
  const card = (await page.locator("[data-part='stopped']").last().innerText()).replace(/\s+/g, "");
  expect(INTERNAL.test(card.replace("ここで止まりました", "")), `C 内部語: ${card}`).toBe(false);
  await expect(box(page)).toBeEnabled();
  // ログインし直した PC（いつもの CLI）でもう一度頼むと動く
  process.env["KANAME_CLAUDE_BIN"] = FAKE;
  runnerMod().forgetClaude();
  await say(page, "続けて");
  await expect.poll(async () => (await jobs(u.memberId)).at(-1)!.state_id, { timeout: 40_000 }).toBe("done");
});

// ---------------------------------------------------------------- E-CONN-012 Bridge が古い
/** 約束の版を送らない（古い）Bridge が生きている知らせを送る（契約の口 sendHeartbeat・K-57。sid は PC の印） */
const oldBeat = (sid: string) =>
  fetch(`${API}/api/v1/bridge/heartbeat`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-bridge-session": sid },
    body: JSON.stringify({ health: [] }),
  });
const oldTake = async (sid: string) =>
  (await // 仕事を取る口は契約の口（K-62）。約束の版を送らない古い Bridge には渡さない（答えは data.job・outdated）
  (
    await fetch(`${API}/api/v1/bridge/jobs/take`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-bridge-session": sid },
      body: JSON.stringify({}),
    })
  ).json()) as { data: { job: unknown; outdated?: boolean } };
/** 古い Bridge がつながっている人が会話モードを開く */
async function outdated(page: Page) {
  const u = await signupViaApi();
  const sid = await claimBridge(u.token);
  await setupStep(u.memberId, 6);
  await loginAs(page, u.token);
  expect((await oldBeat(sid)).ok).toBe(true);
  await page.goto("/ai/chat");
  await expect(page.locator('[data-part="conversation"]')).toBeVisible({ timeout: 20_000 });
  return { u, sid, bar: page.locator("[data-bridge-outdated]") };
}

test("E-CONN-012-A E-CONN-012-B 約束の版を送らない Bridge には仕事を渡さず「Bridge が古い」と一手が出る。書いたことは溜まる。新しい Bridge なら出ない", async ({
  page,
}) => {
  // B 新しい Bridge → 出ない
  const nu = await signupViaApi();
  const nsid = await claimBridge(nu.token);
  await setupStep(nu.memberId, 6);
  await bridgeBeat(nsid, [{ name: "Kaname につながる", ok: true, detail: API }]);
  const p2 = await page.context().newPage();
  await hideRealBridge(p2);
  await p2.addInitScript((t) => window.localStorage.setItem("kaname.token", t), nu.token);
  await p2.goto("/ai/chat");
  await expect(p2.locator('[data-part="conversation"]')).toBeVisible({ timeout: 20_000 });
  await expect(p2.locator("[data-bridge-outdated]"), "B 出ない").toHaveCount(0);
  await p2.close();
  // A 古い Bridge
  const { u, sid, bar } = await outdated(page);
  await expect(bar, "A 出る").toBeVisible({ timeout: 20_000 });
  await expect(bar).toContainText("この PC の Bridge が古いので、自分のAI に仕事を渡せません");
  await expect(bar).toContainText("Bridge を入れ直してください");
  await expect(bar, "書いたことは溜めておき、入れ直した後に順に片づける").toContainText(
    "溜めておき、入れ直した後に順に片づけます",
  );
  await expect(bar.getByRole("link", { name: "PC の状態を見る" }), "一手が押せる").toBeVisible();
  await say(page, "請求書をまとめて");
  await expect(page.locator('.msg[data-who="me"], [data-queued]').first()).toBeVisible();
  const taken = await oldTake(sid);
  expect(taken.data.job, "古い Bridge には仕事を渡さない（API の層）").toBeNull();
  expect(taken.data.outdated).toBe(true);
  expect(
    (await jobs(u.memberId)).map((j) => j.state_id),
    "書いたことは溜まっている",
  ).toEqual(["queued"]);
});

test("E-CONN-012-C 「Bridge が古い」に内部語が無く、一手で PC の状態（/setup/bridge）へ行く。入れ直すと溜めた分から順に片づき、知らせは消える", async ({
  page,
}) => {
  const { u, sid, bar } = await outdated(page);
  await expect(bar).toBeVisible({ timeout: 20_000 });
  await say(page, "請求書をまとめて");
  await expect(page.locator('.msg[data-who="me"], [data-queued]').first()).toBeVisible();
  const text = (await bar.innerText()).replace(/\s+/g, "");
  expect(INTERNAL.test(text), `内部語: ${text}`).toBe(false);
  await bar.getByRole("link", { name: "PC の状態を見る" }).click();
  await expect(page).toHaveURL(/\/setup\/bridge$/);
  // PC の画面で自己診断の行と入れ直す口を見る所（SCR-BRIDGE-SETUP-105・106）は、前の画面と一緒に消した（新しい画面の PC の行の入れ直す一手は、その葉の試験が見る。番号は 11_tickets/K-367.md の表・代表の答え 7cf148a79dc9）
  // 入れ直した（約束の版を送る Bridge）→ 溜めた分が渡り、知らせは消える
  await bridgeBeat(sid, [{ name: "Kaname につながる", ok: true, detail: API }]);
  const j = await bridgeTake(sid);
  expect(j.json.data?.prompt, "溜めた分から順に片づく").toBe("請求書をまとめて");
  expect((await jobs(u.memberId)).map((x) => x.state_id)).toEqual(["running"]);
  await page.goto("/ai/chat");
  await expect(page.locator('[data-part="conversation"]')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("[data-bridge-outdated]"), "入れ直したら出ない").toHaveCount(0);
});

// ---------------------------------------------------------------- E-GATE-010 確認に 30 分答えが無い
const GATE_MSG = "本人が許可しませんでした（確認に答えが無いまま時間がたったので、実行していません）";
/** 確認待ちのまま 30 分たつ（この PC の Bridge の時計だけ 31 分進める。待つのは本物の輪の中の待ち）。許可せずに仕事が閉じるまで */
async function askTimesOut(page: Page, memberId: string) {
  await say(page, "古い下書きを消して");
  await expect(page.locator('[data-part="ask"]')).toBeVisible({ timeout: 15_000 });
  const realNow = Date.now;
  Date.now = () => realNow() + 31 * 60_000;
  try {
    await expect
      .poll(async () => (await jobs(memberId)).at(-1)!.state_id, {
        timeout: 30_000,
        message: "答えが無いので、許可せずに仕事が閉じる",
      })
      .toBe("done");
  } finally {
    Date.now = realNow;
  }
  await expect(lastAi(page)).toBeVisible({ timeout: 15_000 });
  await expect(lastAi(page), "実行していない").not.toContainText("消しました");
}

test("E-GATE-010-B 確認に「今回だけ許可」「許可しない」を押すと、その時点で動き直す／止まる。時間切れの文言は出ない", async ({
  page,
}) => {
  await ready(page);
  const perm = page.locator('[data-part="ask"]');
  await say(page, "下書きを消して");
  await expect(perm).toBeVisible({ timeout: 15_000 });
  await perm.getByRole("button", { name: "今回だけ許可" }).click();
  await expect(lastAi(page), "許可で動き直す").toContainText("消しました", { timeout: 15_000 });
  await say(page, "下書きをもう一度消して");
  await expect(perm).toBeVisible({ timeout: 15_000 });
  await perm.getByRole("button", { name: "許可しない" }).click();
  await expect(lastAi(page), "許可しないで止まる").toContainText("やめました", { timeout: 15_000 });
  await expect(
    page.getByText("確認に答えが無いまま時間がたった", { exact: false }),
    "時間切れの文言は出ない",
  ).toHaveCount(0);
});

test("E-GATE-010-A 確認に答えが無いまま 30 分たつと、実行せず「本人が許可しませんでした（確認に答えが無いまま…）」が出る", async ({
  page,
}) => {
  const u = await ready(page);
  await askTimesOut(page, u.memberId);
  await expect.soft(page.getByText(GATE_MSG), "文言").toBeVisible({ timeout: 10_000 });
  await expect.soft(page.locator('[data-part="ask"]'), "答えられない確認カードを残さない").toHaveCount(0);
});

test("E-GATE-010-C 時間切れの後、内部語が無く、一手「会話で「続けて」と書いて送り、次の問いで答える」が書いてあり、そのとおりにすると動く", async ({
  page,
}) => {
  const u = await ready(page);
  await askTimesOut(page, u.memberId);
  const shown = (await page.locator(".chat").innerText()).replace(/\s+/g, "");
  expect.soft(INTERNAL.test(shown), `内部語: ${shown.slice(-300)}`).toBe(false);
  await expect
    .soft(page.getByText("「続けて」と書いて送り", { exact: false }), "一手が書いてある")
    .toBeVisible({ timeout: 5_000 });
  await say(page, "続けて。下書きを消して");
  await expect(page.locator('[data-part="ask"]'), "次の問いが出る").toBeVisible({ timeout: 15_000 });
  await page.locator('[data-part="ask"]').getByRole("button", { name: "今回だけ許可" }).click();
  await expect(lastAi(page), "答えると動く").toContainText("消しました", { timeout: 15_000 });
});

// ---------------------------------------------------------------- E-LIM-010 サブスクの上限
test("E-LIM-010-A E-LIM-010-B E-LIM-010-C 上限に当たると枠と戻る時刻と「動けません」。当たっていなければ出ない。そのまま書いて送れる", async ({
  page,
}) => {
  const u = await ready(page);
  // B 上限に当たっていない・ログイン済み → 出ない
  await say(page, "今日の予定を教えて");
  await expect(lastAi(page)).toContainText("出典はこちら", { timeout: 30_000 });
  await expect(page.locator("[data-usage='limit']"), "B 出ない").toHaveCount(0);
  await expect(page.locator("[data-part='stopped']")).toHaveCount(0);
  // A 5 時間の枠に達した
  await say(page, "枠切れの仕事");
  const why = page.locator("[data-stopped-reason]").last();
  await expect(why, "A 出る").toHaveText(
    /^サブスクの 5 時間の枠に達しました。\d{1,2}:\d{2} に戻ります。それまで自分のAI は動けません。ここで書いたことは送れます（戻ったら順に）$/,
    { timeout: 30_000 },
  );
  const lim = page.locator("[data-usage='limit']");
  await expect(lim).toContainText("サブスクの5 時間の枠に達しました。");
  await expect(lim).toContainText(
    /\d{1,2}:\d{2} に戻ります。それまで自分のAI は動けません。ここで書いたことは送れます（戻ったら順に）/,
  );
  // 戻る時刻は Claude Code が言った時刻（いま＋1 時間）
  const at = /(\d{1,2}):(\d{2}) に戻ります/.exec(await why.innerText())!;
  const mins =
    (Number(at[1]) * 60 + Number(at[2]) - (new Date().getHours() * 60 + new Date().getMinutes()) + 1440) % 1440;
  expect(mins, "戻る時刻は約 60 分後").toBeGreaterThanOrEqual(55);
  expect(mins).toBeLessThanOrEqual(62);
  // C 内部語が無い。一手「戻ってからそのまま書く」：入力欄は開いたままで、書いたことは受け取られる
  const text =
    (await page.locator("[data-part='stopped']").last().innerText()).replace(/\s+/g, "") +
    (await lim.innerText()).replace(/\s+/g, "");
  expect(INTERNAL.test(text.replace("ここで止まりました", "")), `C 内部語: ${text}`).toBe(false);
  await expect(box(page)).toBeEnabled();
  await say(page, "戻ったらこれをやって");
  await expect(page.locator('.msg[data-who="me"]').last()).toContainText("戻ったらこれをやって");
  await expect(page.locator("[data-failed]"), "書いたことは送れる").toHaveCount(0);
  expect((await myMessages(u.memberId, "戻ったらこれをやって"))[0]!.n).toBe(1);
});

// ---------------------------------------------------------------- 止まったとき（D-090 を D-104.15 が改めた）
test("BRG-03-033 BRG-03-037 止まったら理由だけが出て、選ぶボタンは置かず入力欄は開いたまま。次に送っても止まった記録は履歴に残り、押せないボタンは無い（D-104.15）", async ({
  page,
}) => {
  const u = await ready(page);
  await say(page, "長く書いて");
  await expect(page.locator("[data-streaming]")).toBeVisible({ timeout: 15_000 });
  await page.locator("[data-stop]").click();
  const stop = page.locator("[data-part='stopped']");
  await expect(stop.locator("[data-stopped-reason]")).toHaveText("あなたが止めました", { timeout: 15_000 });
  await expect(stop, "続けるか・終わりか・別の話かは次に送る文で決まる").toContainText(
    "続けるなら「続けて」、ほかのことならそのまま書いてください。勝手には動き出しません",
  );
  await expect(stop.locator("button"), "3 択のボタンは置かない").toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /続きから|最初からやり直す|やめる/ }),
    "続きから／最初からやり直す／やめる のボタンは無い",
  ).toHaveCount(0);
  await expect(box(page), "選ぶまで入力できない、にしない（入力欄は開いたまま）").toBeEnabled();
  // 1 度選んだ（続けて と送った）後
  await say(page, "続けて");
  await expect(page.locator("[data-work-done]").last()).toBeVisible({ timeout: 40_000 });
  await page.reload();
  await expect(page.locator("[data-stopped-reason]").first(), "止まった理由は履歴に残る").toHaveText(
    "あなたが止めました",
    { timeout: 20_000 },
  );
  await expect(page.locator("[data-part='stopped'] button"), "押せないボタンを残さない").toHaveCount(0);
  expect((await jobs(u.memberId)).map((j) => j.state_id)).toEqual(["stopped", "done"]);
});

test("BRG-03-034 「続けて」と送ると同じ続き（session）を引き継いで動き直し、止まった仕事は止まったまま（もう動かない）", async ({
  page,
}) => {
  const u = await ready(page);
  await say(page, "長く書いて");
  await expect(page.locator("[data-streaming]")).toBeVisible({ timeout: 15_000 });
  await page.locator("[data-stop]").click();
  await expect(page.locator("[data-stopped-reason]").last()).toContainText("あなたが止めました", { timeout: 15_000 });
  await say(page, "続けて");
  await expect(page.locator("[data-work-done]").last()).toBeVisible({ timeout: 40_000 });
  const js = await jobs(u.memberId);
  expect(
    js.map((j) => j.state_id),
    "新しい仕事が並び、元は止まったまま",
  ).toEqual(["stopped", "done"]);
  expect(js[0]!.agent_session_id).toBeTruthy();
  expect(js[1]!.agent_session_id, "同じ続きを引き継ぐ").toBe(js[0]!.agent_session_id);
  expect(js[1]!.conversation_id).toBe(js[0]!.conversation_id);
});

test("BRG-03-035 最初からやり直すときは「新しく話す」。続き（session）を引き継がず、新しい会話として動く", async ({
  page,
}) => {
  const u = await ready(page);
  await say(page, "長く書いて");
  await expect(page.locator("[data-streaming]")).toBeVisible({ timeout: 15_000 });
  await page.locator("[data-stop]").click();
  await expect(page.locator("[data-stopped-reason]").last()).toContainText("あなたが止めました", { timeout: 15_000 });
  await page.locator("[data-new-conversation]").first().click();
  await expect(page.locator('.msg[data-who="me"]'), "新しい会話は空から").toHaveCount(0);
  await say(page, "見積をもう一度");
  await expect(page.locator("[data-work-done]").last()).toBeVisible({ timeout: 40_000 });
  const fresh = await admin<{ prompt: string; resumed: string | null }>(
    "select j.prompt, (select e.payload->>'agent_session_id' from bridge_job_events e where e.job_id = j.id and e.kind = 'init' limit 1) as resumed from bridge_jobs j where j.member_id = $1 order by j.created_at",
    [u.memberId],
  );
  const js = await jobs(u.memberId);
  expect(js.map((j) => j.state_id)).toEqual(["stopped", "done"]);
  expect(js[1]!.conversation_id, "新しい会話").not.toBe(js[0]!.conversation_id);
  expect(js[1]!.agent_session_id, "前の続きを持たない").not.toBe(js[0]!.agent_session_id);
  expect(fresh[1]!.prompt).toBe("見積をもう一度");
});

test("BRG-03-036 やめる＝何も送らない。その仕事は止まったまま終わり、新しい仕事は並ばない（勝手に動き出さない）", async ({
  page,
}) => {
  const u = await ready(page);
  await say(page, "長く書いて");
  await expect(page.locator("[data-streaming]")).toBeVisible({ timeout: 15_000 });
  await page.locator("[data-stop]").click();
  await expect(page.locator("[data-stopped-reason]").last()).toContainText("あなたが止めました", { timeout: 15_000 });
  // 本物の輪が何度か取りに来る間（5 秒）待っても、並びは増えない
  await page.waitForTimeout(8000);
  expect(
    (await jobs(u.memberId)).map((j) => j.state_id),
    "並びは増えない",
  ).toEqual(["stopped"]);
  await expect(page.locator("[data-working]"), "動いていると言わない").toHaveCount(0);
});

test("BRG-03-038 init で会話の id を先に覚えるので、途中で落ちても「続けて」が init の id を引き継ぐ", async ({
  page,
}) => {
  const u = await ready(page);
  await say(page, "途中で落ちてみて");
  await expect(page.locator("[data-stopped-reason]").last()).toContainText("Claude Code が途中で終わりました", {
    timeout: 30_000,
  });
  const first = (await jobs(u.memberId))[0]!;
  const init = await admin<{ s: string }>(
    "select payload->>'agent_session_id' as s from bridge_job_events where job_id = $1 and kind = 'init' limit 1",
    [first.id],
  );
  expect(first.state_id).toBe("stopped");
  expect(first.agent_session_id, "落ちた仕事にも init の id が残る").toBe(init[0]!.s);
  await say(page, "続けて");
  await expect(page.locator("[data-work-done]").last()).toBeVisible({ timeout: 40_000 });
  const js = await jobs(u.memberId);
  expect(js[1]!.agent_session_id, "「続けて」は init の id を引き継ぐ").toBe(init[0]!.s);
});

// ---------------------------------------------------------------- 作業中の 1 行（D-104.8・D-111.1）
test("CHT-27-005 考えている最中は、作業の行が「考えています…」の一言で、最後の動きの秒数は出ない", async ({ page }) => {
  await ready(page);
  await say(page, "よく考えて答えて");
  const ws = page.locator("[data-working] .ws");
  await expect(ws).toHaveText("考えています…", { timeout: 15_000 });
  await page.waitForTimeout(2500); // 秒数が出るなら進んでいるはずの間
  await expect(ws).toHaveText("考えています…");
  const line = await page.locator("[data-working]").innerText();
  expect(line, "最後の動きの秒数を出さない").not.toMatch(/最後の動き|秒前/);
  await expect(lastAi(page)).toContainText("考えました", { timeout: 20_000 });
});
