// T-B-42 止めたら途中の道具の結末は不明と言い、記録が無ければ新しいセッションで続ける（D-124.2・D-124.3）。
//   画面 → API → 本物の Bridge の輪（apps/bridge/dist）→ 偽の Claude Code（scripts/dev/fake-claude-demo.mjs）→ API → 画面。
//   偽の CLI は「道具の最中で止めて」で送信の道具を始めたまま居座り、id に lost を含む --resume では本物（claude 2.1.283・2026-10-20 実測）と同じ形で
//   「記録が無い」を返す。テストの名前に正本の行 ID を持つ（op_gate.py）。本人の本物の Bridge は止めない（hideRealBridge）
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
async function say(page: Page, text: string) {
  await box(page).fill(text);
  await box(page).press("Enter");
}
const NOTICE = "前の会話の記録がこの PC に無かったので、新しい会話として続けます。これまでの内容は Kaname の写しに残っています";
const LOST = "lost-00000000-0000-4000-8000-000000000000";

test("CHT-42-006 CHT-42-002 E-SIG-003-A E-SIG-003-C 道具（送信）の最中に止めると、「ここで止まりました」の理由に「途中だったので結末は分からない」が付く（E-SIG-003）", async ({ page }) => {
  await ready(page);
  await say(page, "道具の最中で止めて");
  await expect(page.locator("[data-working]")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("[data-stop]"), "動いている間は送るボタンが止めるに変わる").toBeVisible();
  // 偽の CLI は台帳を読んでから送信の道具を始める。送信の最中（作業の行に宛先が出てから）に止める（読んでいる最中に止めると台帳の名前が入る）
  await expect(page.locator("[data-working]")).toContainText("curl -X POST https://mail.example.com/send", { timeout: 15_000 });
  await page.locator("[data-stop]").click();
  const reason = page.locator("[data-stopped-reason]").last();
  await expect(reason).toContainText("あなたが止めました", { timeout: 15_000 });
  await expect(reason, "途中だった道具（送信の宛先）とその結末が分からないことを言う").toContainText(
    "「curl -X POST https://mail.example.com/send」は途中だったので、その結末は分かりません。先方の画面で確かめてください",
  );
  await expect(page.locator("[data-working]")).toHaveCount(0);
});

test("CHT-42-006 CHT-42-003 E-NF-003-A E-NF-003-B E-NF-003-C 記録が無い会話に話すと、知らせが 1 行出て、新しいセッションで返事が返り、会話の id が新しくなる（E-NF-003）", async ({ page }) => {
  const u = await ready(page);
  await say(page, "こんにちは");
  await expect(page.locator('.msg[data-who="ai"]:not([data-streaming])').last()).toContainText("請求", { timeout: 60_000 });
  await expect(page.locator("[data-working]")).toHaveCount(0);
  // 記録が消えた状態を作る（Claude Code は既定 30 日で記録を消す）：会話の id を、記録に無い id に替える
  const before = await admin<{ id: string; agent_session_id: string }>("select id, agent_session_id from conversations where owner_member_id = $1 order by created_at desc limit 1", [u.memberId]);
  expect(before[0]!.agent_session_id, "最初の仕事で会話の id が入っている").toBeTruthy();
  await admin("update conversations set agent_session_id = $2 where id = $1", [before[0]!.id, LOST]);
  await say(page, "続きをお願い");
  const note = page.locator('[data-who="note"]').filter({ hasText: NOTICE });
  await expect(note, "吹き出しの外に 1 行の知らせ").toHaveCount(1, { timeout: 30_000 });
  const ai = page.locator('.msg[data-who="ai"]:not([data-streaming])').last();
  await expect(ai, "新しいセッションで返事が返る（止まらない）").toContainText("請求", { timeout: 60_000 });
  await expect(page.locator("[data-stopped-reason]"), "「ここで止まりました」にはならない").toHaveCount(0);
  await expect(page.locator("[data-working]")).toHaveCount(0);
  const after = await admin<{ agent_session_id: string }>("select agent_session_id from conversations where id = $1", [before[0]!.id]);
  expect(after[0]!.agent_session_id, "新しい id が Kaname に入る（D-093.4）").not.toBe(LOST);
  expect(after[0]!.agent_session_id).toMatch(/^[0-9a-f-]{36}$/);
  // 2 回目：記録があるので知らせは増えない・id も変わらない
  await say(page, "もう一度");
  await expect(page.locator('.msg[data-who="ai"]:not([data-streaming])')).toHaveCount(3, { timeout: 60_000 });
  await expect(page.locator("[data-working]")).toHaveCount(0);
  await expect(note, "記録があるときは知らせない").toHaveCount(1);
  const again = await admin<{ agent_session_id: string }>("select agent_session_id from conversations where id = $1", [before[0]!.id]);
  expect(again[0]!.agent_session_id).toBe(after[0]!.agent_session_id);
});

test("E-SIG-003-B 文を書いている最中（道具は終わっている）に止めると、理由は「あなたが止めました」だけで、途中の道具の文は付かない", async ({ page }) => {
  await ready(page);
  await say(page, "請求のまとめを書いて");
  // 偽の CLI は Read の道具を終えてから返事を書き始める。書いている最中（data-streaming）に止める
  await expect(page.locator('.msg[data-who="ai"][data-streaming]')).toBeVisible({ timeout: 30_000 });
  await page.locator("[data-stop]").click();
  const reason = page.locator("[data-stopped-reason]").last();
  await expect(reason).toContainText("あなたが止めました", { timeout: 15_000 });
  await expect(reason, "道具は終わっているので、結末が分からないとは言わない").not.toContainText("途中だったので");
  await expect(page.locator("[data-working]")).toHaveCount(0);
});
