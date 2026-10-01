// 自分のAI が Kaname の道具でたたき台に置く（D-110・T-B-25）を実ブラウザで押して確かめる。テストの名前に正本の行 ID を持つ（op_gate.py）。
// Bridge は本物の輪（apps/bridge の loop）を回し、CLI だけ偽物（scripts/dev/fake-claude-demo.mjs）。偽物は本物と同じく --mcp-config の道具のサーバーを起こして道具を呼ぶ
import { expect, test } from "@playwright/test";
import { admin, loginAs, setupStep, signupViaApi } from "../_lib/api";
import { startAgentBridge, type AgentBridge } from "../_lib/agent-bridge";

let bridge: AgentBridge | null = null;
test.afterEach(() => {
  bridge?.stop();
  bridge = null;
});

test("CHT-25-002 CHT-25-004 CHT-25-005 はじめの設定で話すと、自分のAI が道具で目標・台帳・担当業務とAI社員を置き（毎回聞くでも許可の問いは出ない）、たたき台の画面にそのまま出る", async ({ page }) => {
  const u = await signupViaApi();
  bridge = await startAgentBridge(u.token);
  await setupStep(u.memberId, 2);
  await loginAs(page, u.token);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/onboard/interview");
  const box = page.getByRole("textbox", { name: "自分のAIに書く" });
  await expect(box).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: /毎回聞く/ }), "許可のモードは既定の毎回聞く").toBeVisible();
  await box.fill("たたき台を置いて");
  await box.press("Enter");
  // 作業の行に人が読む言葉で出る
  await expect(page.locator("[data-working]")).toContainText(/たたき台に(目標|台帳|担当業務)を置いています/, { timeout: 15_000 });
  const last = page.locator('.msg[data-who="ai"]:not([data-streaming])').last();
  await expect(last).toContainText("たたき台に置きました：今期の売上・案件台帳・見積の下書き", { timeout: 20_000 });
  await expect(page.locator('[data-part="ask"]'), "許可の問いは出ない").toHaveCount(0);
  // たたき台の画面にそのまま出る
  await page.goto("/onboard/draft");
  const n = page.locator("[data-state='n']");
  await expect(n.locator("[data-card='goals']")).toContainText("今期の売上", { timeout: 15_000 });
  await expect(n.locator("[data-card='goals']")).toContainText("12,000,000");
  await expect(n).toContainText("案件台帳");
  await expect(n).toContainText("引き合い → 見積 → 受注 → 納品");
  await expect(n).toContainText("見積さん");
  // 証跡に 1 件ずつ
  const au = await admin<{ action: string }>("select action from audit_events where actor_member_id = $1 and action like 'agent.%' order by action", [u.memberId]);
  expect(au.map((a) => a.action)).toEqual(["agent.ai_employee_created", "agent.duty_created", "agent.goal_created", "agent.ledger_created"]);
});

test("CHT-30-001 CHT-30-002 作業中は 1 行が切り替わり、道具の行は並ばない。内部の名前（mcp__）は作業の行にも画面のどこにも出ない", async ({ page }) => {
  const u = await signupViaApi();
  bridge = await startAgentBridge(u.token);
  await setupStep(u.memberId, 2);
  await loginAs(page, u.token);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/onboard/interview");
  const box = page.getByRole("textbox", { name: "自分のAIに書く" });
  await expect(box).toBeVisible({ timeout: 20_000 });
  await box.fill("たたき台を置いて");
  await box.press("Enter");
  const seen = new Set<string>();
  const w = page.locator("[data-working]");
  await expect(w).toBeVisible({ timeout: 15_000 });
  for (let i = 0; i < 40 && (await w.count()); i++) {
    const t = await w.locator(".ws").textContent().catch(() => null);
    if (t) seen.add(t);
    expect(await page.locator(".wtool").count(), "道具の行は並ばない").toBe(0);
    expect(await w.locator(".wl").count(), "作業の行は 1 行").toBeLessThanOrEqual(1);
    await page.waitForTimeout(100);
  }
  const all = [...seen].join(" / ");
  expect(all).toMatch(/たたき台に(目標|台帳|担当業務)を置いています：/);
  expect(all).not.toContain("mcp__");
  await expect(page.locator('.msg[data-who="ai"]:not([data-streaming])').last()).toContainText("たたき台に置きました", { timeout: 20_000 });
  expect(await page.locator("body").innerText()).not.toContain("mcp__");
});

test("CHT-30-003 自分のAI の返事に絵文字は出さない（書いてきても消して描く・記号は残す）", async ({ page }) => {
  const u = await signupViaApi();
  bridge = await startAgentBridge(u.token);
  await setupStep(u.memberId, 2);
  await loginAs(page, u.token);
  await page.goto("/onboard/interview");
  const box = page.getByRole("textbox", { name: "自分のAIに書く" });
  await expect(box).toBeVisible({ timeout: 20_000 });
  await box.fill("絵文字で答えて");
  await box.press("Enter");
  const last = page.locator('.msg[data-who="ai"]:not([data-streaming])').last();
  await expect(last).toContainText("目標を置きました", { timeout: 20_000 });
  const t = await last.innerText();
  expect(t).not.toMatch(/\p{Emoji_Presentation}/u);
  expect(t).toContain("©2026");
});
