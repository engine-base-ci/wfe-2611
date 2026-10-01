// AI が使うブラウザ（T-B-37・D-119・D-120）を画面から通しで確かめる。画面 → API → 本物の Bridge の輪 → CLI（偽物）→ API → 画面。
//   Chrome を選んだ仕事にだけ Claude in Chrome が渡り、拡張機能とつながっていなければ会話に 1 行出て、PC の状態にも赤で出る。
//   その 1 行と PC の画面から、つなぎ方・もう一度確かめる・専用のブラウザに切り替える がその場でできる。選ぶのは Kaname の PC の画面。
//   テストの名前に正本の行 ID を持つ（op_gate.py）。本人の本物の Bridge は止めない（hideRealBridge）
import { expect, test, type Page } from "@playwright/test";
import { admin, hideRealBridge, loginAs, setupStep, signupViaApi } from "../_lib/api";
import { startAgentBridge, type AgentBridge } from "../_lib/agent-bridge";

let bridges: AgentBridge[] = [];
test.beforeEach(({ page }) => hideRealBridge(page));
test.afterEach(() => {
  for (const b of bridges) b.stop();
  bridges = [];
});
const NOTICE = "AI が Chrome を使えませんでした。Chrome を開き、拡張機能「Claude in Chrome」が入っていてこの Claude と同じアカウントでログインしているか確かめてください。ブラウザを使わない作業はそのまま続けます";
const CWS = "https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn";

/** PC の状態の画面は、この PC の Bridge（127.0.0.1:38617）にも聞く。試験のブラウザの中だけで、試験の Bridge が居ると答える（本人の本物の Bridge には届かない） */
async function localBridgeIsHere(page: Page): Promise<void> {
  await page.unrouteAll({ behavior: "ignoreErrors" });
  // 後から足した経路が先に効く（Playwright）。全部断るのを先に置き、答える口を後に足す
  await page.route("http://127.0.0.1:38617/**", (r) => r.abort("connectionrefused"));
  await page.route("http://localhost:38617/**", (r) => r.abort("connectionrefused"));
  const cors = { "access-control-allow-origin": "*" };
  await page.route("http://127.0.0.1:38617/ping", (r) => r.fulfill({ headers: cors, json: { app: "kaname-bridge", version: "test", device_label: "MacBook Pro（QA）", connected: true } }));
  await page.route("http://127.0.0.1:38617/check", (r) => r.fulfill({ headers: cors, json: { checks: [] } }));
}
async function ready(page: Page, browser: "chrome" | "dedicated" | "off") {
  const u = await signupViaApi();
  bridges.push(await startAgentBridge(u.token, { browser }));
  await setupStep(u.memberId, 6);
  await loginAs(page, u.token);
  await page.setViewportSize({ width: 1440, height: 900 });
  return u;
}
async function say(page: Page, text: string) {
  await page.goto("/ai/chat");
  const box = page.getByRole("textbox", { name: "自分のAIに書く" });
  await expect(box).toBeVisible({ timeout: 30_000 });
  await box.fill(text);
  await box.press("Enter");
}
const offLine = (page: Page) => page.locator('[data-notice="browser-off"]');
const chromeRow = (page: Page) => page.locator("tr[data-check]", { hasText: "AI が Chrome を使える（Claude in Chrome）" });
const browserOf = async (memberId: string) =>
  (await admin<{ b: string }>("select browser as b from sessions where member_id = $1 and kind_id = 'bridge' and revoked_at is null order by last_seen_at desc limit 1", [memberId]))[0]?.b;
/** 返事を書き終わるまで待つ（書いている間は会話が下へ送られ続け、押す前に測った場所からボタンがずれる。人も同じ） */
async function settled(page: Page, memberId: string) {
  await expect(page.getByText("Chrome の拡張機能とつながっていないので、ブラウザを使わずに答えます。")).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => (await lastJob(memberId))?.state_id, { timeout: 30_000 }).toBe("done");
  await expect(page.locator("[data-working]")).toHaveCount(0, { timeout: 15_000 });
}
/** その人の最後の仕事 */
const lastJob = async (memberId: string) =>
  (await admin<{ state_id: string; conversation_id: string | null }>("select state_id, conversation_id from bridge_jobs where member_id = $1 order by created_at desc limit 1", [memberId]))[0];

test("CHT-37-006 Chrome の拡張機能とつながっていないと、会話に理由の 1 行が 1 回だけ出て、PC の状態の Chrome の行が赤になる", async ({ page }) => {
  await ready(page, "chrome");
  await say(page, "ブラウザで example.com を開いて");
  await expect(page.getByText("Chrome の拡張機能とつながっていないので、ブラウザを使わずに答えます。")).toBeVisible({ timeout: 30_000 });
  await expect(offLine(page)).toContainText(NOTICE);
  await expect(offLine(page)).toHaveCount(1);
  // 読み直しても 1 行のまま（同じ仕事で重ねない）
  await page.reload();
  await expect(page.getByText("Chrome の拡張機能とつながっていないので")).toBeVisible({ timeout: 30_000 });
  await expect(offLine(page)).toHaveCount(1);
  // 仕事の終わりに Bridge が自己診断を送り直す（60 秒待たせない）。届いたのを DB で確かめてから画面を開く
  // （画面は 15 秒ごとに読み直すので、届く前に開くと 15 秒の間は前の値が出る）
  await expect
    .poll(async () => JSON.stringify((await admin<{ h: unknown }>("select health as h from sessions where id = $1", [bridges[0]!.sid]))[0]?.h ?? null), { timeout: 15_000 })
    .toContain('"ok":false');
  await localBridgeIsHere(page);
  await page.goto("/setup/bridge");
  await expect(chromeRow(page)).toHaveAttribute("data-check", "ng", { timeout: 15_000 });
  await expect(chromeRow(page)).toContainText("できません");
  await expect(page.locator("[data-browser-off]"), "PC の画面にも、その場でやる一手が出る").toBeVisible();
});

test("CHT-37-010 会話の 1 行と PC の画面の「つなぎ方を見る」で、3 つの手順と公式の入口が出る", async ({ page }) => {
  const u = await ready(page, "chrome");
  await say(page, "ブラウザで example.com を開いて");
  await expect(offLine(page)).toBeVisible({ timeout: 30_000 });
  await settled(page, u.memberId);
  const fix = offLine(page).locator("[data-browser-fix]");
  await expect(fix.locator("ol")).toBeHidden();
  await fix.getByText("つなぎ方を見る").click();
  await expect(fix.locator("ol li")).toHaveCount(3);
  await expect(fix.locator("ol")).toContainText("Chrome を開く");
  await expect(fix.locator("ol")).toContainText("同じアカウントでログインする");
  const link = fix.locator("[data-browser-install]");
  await expect(link).toHaveAttribute("href", CWS);
  await expect(link).toHaveAttribute("target", "_blank");
  // PC の画面は最初から開いている
  await localBridgeIsHere(page);
  await page.goto("/setup/bridge");
  const pcFix = page.locator("[data-browser-off] [data-browser-fix]");
  await expect(pcFix.locator("ol li")).toHaveCount(3, { timeout: 15_000 });
  await expect(pcFix.locator("ol")).toBeVisible();
  await expect(pcFix.locator("[data-browser-install]")).toHaveAttribute("href", CWS);
});

test("CHT-37-011 「もう一度確かめる」で Bridge が小さな仕事で試し、つながれば「つながりました」と出て、PC の画面の行が「できる」になる。会話には出ない", async ({ page }) => {
  const u = await ready(page, "chrome");
  await say(page, "ブラウザで example.com を開いて");
  await expect(offLine(page)).toBeVisible({ timeout: 30_000 });
  await settled(page, u.memberId);
  const bubbles = await page.locator(".msg").count();
  await offLine(page).locator("[data-browser-check]").click();
  await expect(offLine(page).locator("[data-browser-fix-msg]")).toHaveText("つながりました。AI は Chrome を使えます", { timeout: 60_000 });
  const job = await lastJob(u.memberId);
  expect(job?.conversation_id, "確かめる仕事は会話に属さない").toBeNull();
  expect(job?.state_id).toBe("done");
  await expect(page.locator(".msg"), "会話に吹き出しは増えない").toHaveCount(bubbles);
  await localBridgeIsHere(page);
  await page.goto("/setup/bridge");
  await expect(chromeRow(page)).toHaveAttribute("data-check", "ok", { timeout: 15_000 });
  await expect(page.locator("[data-browser-off]"), "つながったら一手の帯は消える").toHaveCount(0);
});

test("CHT-37-012 「Bridge 専用のブラウザに切り替える」で PC の選択が専用のブラウザになり、PC の画面にもその印が付く", async ({ page }) => {
  const u = await ready(page, "chrome");
  await say(page, "ブラウザで example.com を開いて");
  await expect(offLine(page)).toBeVisible({ timeout: 30_000 });
  await settled(page, u.memberId);
  await offLine(page).locator("[data-browser-dedicated]").click();
  await expect(offLine(page).locator("[data-browser-fix-msg]")).toHaveText("Bridge 専用のブラウザに切り替えました。次の仕事から使います");
  expect(await browserOf(u.memberId)).toBe("dedicated");
  await localBridgeIsHere(page);
  await page.goto("/setup/bridge");
  await expect(page.locator('[data-browser-pick] input[value="dedicated"]')).toBeChecked({ timeout: 15_000 });
});

test("CHT-37-005 「使わない」の PC の仕事にはブラウザが渡らず、知らせも出ず、PC の状態は「使わない設定」と出る", async ({ page }) => {
  await ready(page, "off");
  await say(page, "ブラウザで example.com を開いて");
  await expect(page.getByText("ブラウザの道具がありません。ブラウザを使わずに答えます。")).toBeVisible({ timeout: 30_000 });
  await expect(offLine(page)).toHaveCount(0);
  await localBridgeIsHere(page);
  await page.goto("/setup/bridge");
  await expect(page.locator("tr[data-check]", { hasText: "AI はブラウザを使わない設定です" })).toHaveAttribute("data-check", "ok", { timeout: 15_000 });
  await expect(page.locator('[data-browser-pick] input[value="off"]')).toBeChecked();
});

test("CHT-37-009 PC の画面で「使わない」から「自分の Chrome」に選び直すと、次の仕事に Chrome が渡る", async ({ page }) => {
  const u = await ready(page, "off");
  await localBridgeIsHere(page);
  await page.goto("/setup/bridge");
  const pick = page.locator("[data-browser-pick]");
  await expect(pick.locator('input[value="off"]')).toBeChecked({ timeout: 15_000 });
  await pick.getByText("自分の Chrome（Claude in Chrome）").click();
  await expect(page.locator("[data-browser-pick-msg]")).toHaveText("変えました。次の仕事から使います");
  await expect(pick.locator('input[value="chrome"]')).toBeChecked();
  expect(await browserOf(u.memberId)).toBe("chrome");
  // 次の仕事には Chrome が渡る（偽の CLI は --chrome のときだけ Chrome の道具を使い、拡張機能とつながっていない で失敗する）
  await hideRealBridge(page);
  await say(page, "ブラウザで example.com を開いて");
  await expect(page.getByText("Chrome の拡張機能とつながっていないので、ブラウザを使わずに答えます。")).toBeVisible({ timeout: 30_000 });
  await expect(offLine(page)).toHaveCount(1);
});
