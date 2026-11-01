// 作業中の行が本当のいまを出す（T-B-27・2026-09-28 実例：Bridge が止まった後も「書いています…38 分」のままだった）。テストの名前に正本の行 ID を持つ（op_gate.py）。
// Bridge は本物の輪（apps/bridge の loop）、CLI だけ偽物（scripts/dev/fake-claude-demo.mjs）。本人の本物の Bridge は止めない（hideRealBridge）
import { expect, test, type Page } from "@playwright/test";
import { admin, hideRealBridge, loginAs, setupStep, signupViaApi } from "../_lib/api";
import { startAgentBridge, type AgentBridge } from "../_lib/agent-bridge";

let bridges: AgentBridge[] = [];
test.beforeEach(({ page }) => hideRealBridge(page));
test.afterEach(() => {
  for (const b of bridges) b.stop();
  bridges = [];
});
const box = (page: Page) => page.getByRole("textbox", { name: "自分のAIに書く" });
async function ready(page: Page) {
  const u = await signupViaApi();
  bridges.push(await startAgentBridge(u.token));
  await setupStep(u.memberId, 6);
  await loginAs(page, u.token);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/ai/chat");
  await expect(box(page)).toBeVisible({ timeout: 20_000 });
  return u;
}

test("CHT-27-002 作業の行は、いまの動きを「〇〇しています…」の一言で出す（考えている → 返事を書いている）。秒数は出さない", async ({ page }) => {
  await ready(page);
  await box(page).fill("少し考えて");
  await box(page).press("Enter");
  const w = page.locator("[data-working]");
  await expect(w.locator(".ws")).toHaveText("考えています…", { timeout: 15_000 });
  await expect(w, "最後の動きの秒数は出さない").not.toContainText("最後の動き");
  await expect(page.locator('.msg[data-who="ai"]:not([data-streaming])').last()).toContainText("考えました。答えはこうです。", { timeout: 20_000 });
});

test("CHT-27-004 CHT-27-003 作業中に PC の Bridge が応答しなくなったら作業の行でそう言い、Bridge が戻ってきたら残った仕事は理由つきで止まる", async ({ page }) => {
  const u = await ready(page);
  await box(page).fill("じっくり考えて");
  await box(page).press("Enter");
  const w = page.locator("[data-working]");
  await expect(w.locator(".ws")).toHaveText("考えています…", { timeout: 15_000 });
  // PC の Bridge が止まった（輪を止め、最後の知らせを 3 分前にする）
  const sid = bridges[0]!.sid;
  bridges[0]!.stop();
  bridges = [];
  await admin("update sessions set last_seen_at = now() - interval '3 minutes' where id = $1", [sid]);
  await expect(w.locator(".ws")).toContainText("PC の Bridge から応答がありません（最後の知らせは 3 分前）", { timeout: 20_000 });
  await expect(w.locator(".ws")).not.toContainText("書いています");
  // その場からつなぎ直せる（どこを押せばいいか分からない、にしない）
  await expect(w.locator("[data-reconnect]")).toHaveAttribute("href", "/setup/bridge");
  // Bridge が戻ってきた（つなぎ直し → 仕事を取りに来る）
  bridges.push(await startAgentBridge(u.token));
  await expect(page.locator("[data-stopped-reason]").last()).toHaveText("PC の Bridge が途中で止まったので、ここで止まりました。続けるなら「続けて」と送ってください", { timeout: 30_000 });
  await expect(page.locator("[data-working]")).toHaveCount(0);
});

test("CHT-31-003 考えている途中で PC の Bridge が止まり、返事が Kaname に届かなかっても、つなぎ直すと本人の PC の記録から返事が出る", async ({ page }) => {
  // 偽物の Claude Code は一時フォルダに記録を書く。Bridge にはそこを記録の置き場として読ませる（本人の ~/.claude には触らない）
  const { tmpdir } = await import("node:os");
  process.env["KANAME_CLAUDE_PROJECTS"] = `${tmpdir()}/kaname-fake-projects`;
  const u = await ready(page);
  await box(page).fill("じっくり考えて");
  await box(page).press("Enter");
  await expect(page.locator("[data-working] .ws")).toHaveText("考えています…", { timeout: 15_000 });
  // 考えている途中で PC の Bridge が止まる。Claude Code は書き終えて記録に残すが、Kaname には届かない
  bridges[0]!.stop();
  bridges = [];
  await page.waitForTimeout(8000);
  const msgs = await admin<{ n: number }>("select count(*)::int as n from messages m join conversations c on c.id = m.conversation_id where c.owner_member_id = $1 and m.kind = 'ai'", [u.memberId]);
  expect(msgs[0]!.n, "止まっている間は Kaname に返事が無い").toBe(0);
  // つなぎ直す → 仕事は理由つきで止まり、記録から返事を取り戻す
  bridges.push(await startAgentBridge(u.token));
  const last = page.locator('.msg[data-who="ai"]').last();
  await expect(last).toContainText("考えました。答えはこうです。", { timeout: 30_000 });
  await expect(page.locator('.msg[data-who="ai"]'), "同じ返事は 1 回だけ").toHaveCount(1);
  delete process.env["KANAME_CLAUDE_PROJECTS"];
});
