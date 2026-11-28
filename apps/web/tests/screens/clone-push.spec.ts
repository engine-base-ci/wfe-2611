// 会話が変わったら画面に知らせる（T-B-32・D-113）。1.2 秒ごとに見に行っていたのを、変わった瞬間に読み直す形にした。
// 知らせが使えない間は今までどおり見に行く。テストの名前に正本の行 ID を持つ（op_gate.py）。本人の本物の Bridge は止めない（hideRealBridge）
import { expect, test, type Page } from "@playwright/test";
import { admin, API, hideRealBridge, loginAs, setupStep, signupViaApi } from "../_lib/api";
import { startAgentBridge, type AgentBridge } from "../_lib/agent-bridge";

let bridges: AgentBridge[] = [];
test.beforeEach(({ page }) => hideRealBridge(page));
test.afterEach(() => {
  for (const b of bridges) b.stop();
  bridges = [];
});
const box = (page: Page) => page.getByRole("textbox", { name: "自分のAIに書く" });
/** 画面が /agent/state を見に行った回数を数える */
function countState(page: Page) {
  const at: number[] = [];
  page.on("request", (r) => {
    if (/\/api\/auth-ext\/agent\/state/.test(r.url())) at.push(Date.now());
  });
  return { since: (t: number) => at.filter((x) => x >= t).length };
}
async function ready(page: Page) {
  const u = await signupViaApi();
  bridges.push(await startAgentBridge(u.token));
  await setupStep(u.memberId, 6);
  await loginAs(page, u.token);
  await page.setViewportSize({ width: 1440, height: 900 });
  return u;
}
/** 別のタブから言ったのと同じ（API を直に叩く） */
async function sayElsewhere(token: string, text: string) {
  const r = await fetch(`${API}/api/auth-ext/agent/say`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ text }),
  });
  expect(r.status).toBe(201);
}

test("CHT-32-001 何もしていない間は見に行かず、別のところで言ったことは知らせを受けて 1.5 秒以内に出る", async ({
  page,
}) => {
  const u = await ready(page);
  const n = countState(page);
  const stream = page.waitForResponse((r) => /\/agent\/stream/.test(r.url()) && r.status() === 200);
  await page.goto("/ai/chat");
  await expect(box(page)).toBeVisible({ timeout: 20_000 });
  await stream;
  await page.waitForTimeout(1500); // つながった直後の読み直しが済むまで
  const t0 = Date.now();
  await page.waitForTimeout(8000);
  expect(n.since(t0), "知らせを受けている間は 1.2 秒・6 秒ごとに見に行かない").toBe(0);
  const t1 = Date.now();
  await sayElsewhere(u.token, "別のタブから言ったこと");
  await expect(page.locator('[data-who="me"]').last()).toContainText("別のタブから言ったこと", { timeout: 1500 });
  expect(Date.now() - t1).toBeLessThan(1500);
});

test("CHT-32-002 作業中の一言と返事は、知らせを受けて出る（見に行く間隔に頼らない）", async ({ page }) => {
  await ready(page);
  await page.goto("/ai/chat");
  await expect(box(page)).toBeVisible({ timeout: 20_000 });
  await box(page).fill("少し考えて");
  await box(page).press("Enter");
  await expect(page.locator("[data-working] .ws")).toHaveText("考えています…", { timeout: 15_000 });
  await expect(page.locator('.msg[data-who="ai"]:not([data-streaming])').last()).toContainText(
    "考えました。答えはこうです。",
    { timeout: 20_000 },
  );
});

test("CHT-32-003 知らせの流れがつながらないときは、今までどおり見に行って出る（黙って止まらない）", async ({
  page,
}) => {
  const u = await ready(page);
  await page.route(/\/api\/auth-ext\/agent\/stream/, (r) => r.abort("failed"));
  const n = countState(page);
  await page.goto("/ai/chat");
  await expect(box(page)).toBeVisible({ timeout: 20_000 });
  const t0 = Date.now();
  await page.waitForTimeout(7000);
  expect(n.since(t0), "知らせが無い間は 6 秒ごとに見に行く").toBeGreaterThanOrEqual(1);
  await sayElsewhere(u.token, "知らせが無くても出ること");
  await expect(page.locator('[data-who="me"]').last()).toContainText("知らせが無くても出ること", { timeout: 8000 });
});

test("CHT-32-004 サーバーの知らせの接続が落ちても、画面はつなぎ直して、その後も知らせで出る", async ({ page }) => {
  const u = await ready(page);
  const reopened = (async () => {
    let n = 0;
    await page.waitForResponse((r) => /\/agent\/stream/.test(r.url()) && r.status() === 200 && ++n >= 2, {
      timeout: 30_000,
    });
  })();
  await page.goto("/ai/chat");
  await expect(box(page)).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1500);
  // API の知らせの 1 本を DB の側から切る（通信が落ちたのと同じ）
  await admin(
    "select pg_terminate_backend(pid) from pg_stat_activity where application_name = 'kaname-listen' and datname = current_database()",
  );
  await reopened;
  await page.waitForTimeout(500);
  const t1 = Date.now();
  await sayElsewhere(u.token, "落ちた後に言ったこと");
  await expect(page.locator('[data-who="me"]').last()).toContainText("落ちた後に言ったこと", { timeout: 1500 });
  expect(Date.now() - t1).toBeLessThan(1500);
});
