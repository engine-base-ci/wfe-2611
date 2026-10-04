// はじめの設定の進み方（T-B-36・D-116）：次の段へ進む主ボタンは画面の下の帯に 1 つ。進めないときは何をすれば進めるかを書く。
// 押せない段を押すと、いまの段で何をすれば開くかが出る。次の段がまだ無いときはそう書き、行き止まりにしない。
// テストの名前に正本の行 ID を持つ（op_gate.py）。本人の本物の Bridge は止めない
import { expect, test, type Page } from "@playwright/test";
import { admin, API, hideRealBridge, loginAs, setupStep, signupViaApi } from "../_lib/api";
import { startAgentBridge, type AgentBridge } from "../_lib/agent-bridge";

let bridges: AgentBridge[] = [];
test.beforeEach(({ page }) => hideRealBridge(page));
test.afterEach(() => {
  for (const b of bridges) b.stop();
  bridges = [];
});
const bar = (page: Page) => page.locator("[data-wiz-next]");
const go = (page: Page) => page.locator("[data-wiz-next-go]");

/** たたき台がある人（段 2 まで通した）。担当業務を足して、画面を縦に長くする */
async function withDraft() {
  const u = await signupViaApi();
  bridges.push(await startAgentBridge(u.token));
  await setupStep(u.memberId, 2);
  await fetch(`${API}/api/auth-ext/agent/say`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${u.token}` },
    body: JSON.stringify({ text: "たたき台を置いて" }),
  });
  for (let i = 0; i < 40; i++) {
    const n = await admin<{ n: number }>("select count(*)::int as n from duties d join members m on m.tenant_id = d.tenant_id where m.id = $1", [u.memberId]).catch(() => [{ n: 0 }]);
    if ((n[0]?.n ?? 0) > 0) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return u;
}

test("CHT-36-001 画面が低くても（1512×700）、たたき台の「これでいく」は下の帯に見えていて、押すと段 3 を通して 4 へ進む", async ({ page }) => {
  const u = await withDraft();
  await loginAs(page, u.token);
  await page.setViewportSize({ width: 1512, height: 700 });
  await page.goto("/onboard/draft");
  await expect(page.locator("[data-card]").first()).toBeVisible({ timeout: 30_000 });
  const doc = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  expect(doc, "たたき台は画面に収まらない長さ（下にあるボタンはスクロールしないと見えない状況）").toBeGreaterThan(0);
  await expect(go(page)).toBeEnabled();
  await expect(go(page)).toContainText("これでいく（次：4. ログイン情報）");
  const box = await go(page).boundingBox();
  expect(box!.y + box!.height, "スクロールしなくても帯のボタンが画面の中にある").toBeLessThanOrEqual(700);
  await expect(page.getByRole("button", { name: /これでいく/ }), "主ボタンは 1 つ").toHaveCount(1);
  await go(page).click();
  await expect(page).toHaveURL(/\/settings\/credentials/);
  const s = await admin<{ s: number }>("select setup_step as s from members where id = $1", [u.memberId]);
  expect(s[0]!.s).toBe(3);
});

test("CHT-36-002 押せない段を押すと、いまの段で何をすれば開くかが出る（まだ作っていない段は、そう出る）", async ({ page }) => {
  const u = await withDraft();
  await loginAs(page, u.token);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/onboard/draft");
  await expect(page.locator("[data-card]").first()).toBeVisible({ timeout: 30_000 });
  // 進み具合（段 2 まで）が読めてから押す（読めていない間は 1 段目扱いの文が出る）
  await expect(page.locator("ol[aria-label='手順'] li", { hasText: "2. 話す" })).toHaveClass(/st-success/, { timeout: 15_000 });
  await page.locator("[data-step-locked]", { hasText: "4. ログイン情報" }).click();
  await expect(page.locator("[data-step-note]")).toHaveText("「4. ログイン情報」は、いまの段「3. たたき台」でたたき台を見て「これでいく」を押すと開きます");
  await page.locator("[data-step-locked]", { hasText: "5. テスト" }).click(); // 5 はできた（T-U-11）。届かない段として、いまの段で何をすれば開くかが出る
  await expect(page.locator("[data-step-note]")).toHaveText("「5. テスト」は、いまの段「3. たたき台」でたたき台を見て「これでいく」を押すと開きます");
  await page.locator("[data-step-locked]", { hasText: "6. 本番へ" }).click();
  await expect(page.locator("[data-step-note]")).toContainText("「6. 本番へ」はまだ作っていません");
});

test("CHT-36-003 まだ自分のAI に答えていないと、話すの帯は押せず「自分のAI に 1 つ答えると進めます」が出る", async ({ page }) => {
  const u = await signupViaApi();
  bridges.push(await startAgentBridge(u.token));
  await setupStep(u.memberId, 1);
  await loginAs(page, u.token);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/onboard/interview");
  await expect(bar(page)).toBeVisible({ timeout: 20_000 });
  await expect(go(page)).toBeDisabled();
  await expect(go(page)).toContainText("次へ：3. たたき台");
  await expect(page.locator("[data-wiz-next-note]")).toHaveText("自分のAI に 1 つ答えると進めます");
});

test("CHT-36-004 ログイン情報を預けて段 4 を通すと、4 の帯は「次へ：5. テスト」で 5 に移る。5 の帯は、まだ無い 6 のことを書き、6 には行かない", async ({ page }) => {
  const u = await signupViaApi();
  await setupStep(u.memberId, 4);
  await loginAs(page, u.token);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/settings/credentials");
  await expect(bar(page)).toBeVisible({ timeout: 20_000 });
  await expect(go(page)).toHaveText(/次へ：5\. テスト/);
  await go(page).click();
  await expect(page).toHaveURL(/\/onboard\/testrun/, { timeout: 15_000 });
  await expect(page.locator("body")).not.toContainText("404");
  // 5 の帯：AI社員がいないので押せず、何をすれば進めるかが書いてある。6 はまだ無いので段の帯にリンクが無い
  await expect(bar(page)).toBeVisible({ timeout: 20_000 });
  await expect(go(page)).toBeDisabled();
  await expect(page.locator("[data-wiz-next-note]")).toContainText("たたき台に AI社員がいると試せます");
  await expect(page.getByRole("link", { name: "6. 本番へ" })).toHaveCount(0);
});

