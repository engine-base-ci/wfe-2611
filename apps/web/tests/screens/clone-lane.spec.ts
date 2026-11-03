// 自分のAI は一度に 1 つの仕事だけ動く（本人の PC の Claude Code は 1 つ）。別の会話で動いている・答えを待っている間に、
// ほかの会話で送った文が黙って止まって見えないこと・開き直しても動いている会話が出ること（2026-09-28 実例：直して送り直した後に何も出なかった）
import { expect, test, type Page } from "@playwright/test";
import { admin, api, loginAs, setupStep, signupViaApi } from "../_lib/api";
import { startAgentBridge, type AgentBridge } from "../_lib/agent-bridge";

let bridge: AgentBridge | null = null;
test.afterEach(() => {
  bridge?.stop();
  bridge = null;
});
const box = (page: Page) => page.getByRole("textbox", { name: "自分のAIに書く" });
const say = async (page: Page, t: string) => {
  await box(page).fill(t);
  await box(page).press("Enter");
};

/** はじめの設定で 1 往復してから、最後の自分の文を直して「聞いて」に送り直す（新しい会話で問い合わせが待つ） */
async function branched(page: Page) {
  const u = await signupViaApi();
  bridge = await startAgentBridge(u.token);
  await setupStep(u.memberId, 2);
  await loginAs(page, u.token);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/onboard/interview");
  await say(page, "こんにちは");
  await expect(page.locator('.msg[data-who="ai"]:not([data-streaming])').last()).toBeVisible({ timeout: 20_000 });
  await page.locator('.msg[data-who="me"]').last().hover();
  await page.getByRole("button", { name: "直して送り直す" }).last().click();
  await say(page, "請求書のこと聞いて");
  await expect(page.locator('[data-part="question"]')).toBeVisible({ timeout: 15_000 });
  const convs = await admin<{ id: string; branched: string | null }>(
    "select id, branched_from_message_id::text as branched from conversations where owner_member_id = $1 order by created_at",
    [u.memberId],
  );
  return { u, first: convs[0]!.id, branch: convs[1]!.id };
}

test("CHT-26-001 前の会話を読んだ印が付いても、開き直すと答えを待っている会話が出る（古い会話に戻らない）", async ({
  page,
}) => {
  const { u, first } = await branched(page);
  // 前の会話を「読んだ」にする（読んだ印で更新時刻が新しくなる）
  const r = await api(`/api/auth-ext/agent/conversations/${first}/read`, {}, u.token);
  expect(r.status).toBeLessThan(300);
  await page.reload();
  await expect(page.locator('[data-part="question"]'), "答えを待っている問い合わせが出る").toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator('.msg[data-who="me"]').last()).toContainText("請求書のこと聞いて");
});

test("CHT-26-002 別の会話で自分のAI が答えを待っている間に送った文は、黙って止まらず「別の会話が終わったら動く」と出て、その会話へ移れる", async ({
  page,
}) => {
  const { u, first } = await branched(page);
  await setupStep(u.memberId, 6); // 会話の画面（/ai/chat）で前の会話を開く
  await page.goto(`/ai/chat?c=${first}`);
  await expect(box(page)).toBeVisible({ timeout: 15_000 });
  await say(page, "もう一度はじめから");
  const lane = page.locator("[data-lane-wait]");
  await expect(lane).toContainText("別の会話で、自分のAI があなたの答えを待っています", { timeout: 15_000 });
  await expect(page.locator("[data-queue]")).toContainText("もう一度はじめから");
  await lane.getByRole("button", { name: "その会話を開く" }).click();
  await expect(page.locator('[data-part="question"]')).toBeVisible({ timeout: 15_000 });
});
