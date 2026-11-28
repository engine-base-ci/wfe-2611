// 規約で自動操作が禁止のサービスと銀行を、全部許可でも本人の PC の上で止める（D-107・T-B-24）を実ブラウザで押して確かめる。
// Bridge は本物の輪（apps/bridge の loop と本物のフック）を回し、CLI だけ偽物（scripts/dev/fake-claude-demo.mjs）に差す。
// 偽物の CLI は本物の Claude Code と同じく、道具を使う直前に --settings の PreToolUse フックを動かし、終了コード 2 なら止まる
import { expect, test, type Page } from "@playwright/test";
import { admin, loginAs, setupStep, signupViaApi } from "../_lib/api";
import { startAgentBridge, type AgentBridge } from "../_lib/agent-bridge";

let bridge: AgentBridge | null = null;
let domain = "";
test.beforeEach(async () => {
  domain = `qa-bank-${Date.now().toString(36)}.example.jp`;
  await admin(
    "insert into service_registry (tenant_id, name, domain, automation_verdict_id) values (app.ops_tenant_id(), 'QA銀行', $1, 'bank')",
    [`https://www.${domain}/`],
  );
});
test.afterEach(async () => {
  bridge?.stop();
  bridge = null;
  await admin("delete from service_registry where domain like $1", [`%${domain}%`]);
});

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

test("CHT-24-001 CHT-24-002 CHT-24-003 CHT-24-004 CHT-24-005 CHT-19-006 E-GATE-011-A E-GATE-011-B E-GATE-011-C 全部許可でも台帳で銀行の宛先は PC の上で止まり、作業の行に理由が出て、人への案内を返し、証跡に残る。台帳を変えると次の仕事から効く", async ({
  page,
}) => {
  const u = await ready(page);
  // 全部許可にする
  await page.getByRole("button", { name: /毎回聞く/ }).click();
  await page.getByRole("option", { name: /全部許可/ }).click();
  await page.locator("[data-confirm-all]").click();
  await expect(page.getByRole("button", { name: /全部許可/ })).toBeVisible();
  // 使わない道具として渡っている（全部許可でも）
  await say(page, "禁止を見せて");
  await expect(lastAi(page)).toContainText(`WebFetch(domain:${domain})`, { timeout: 20_000 });
  const modes = await admin<{ permission_mode: string }>(
    "select permission_mode from bridge_jobs where member_id = $1 order by created_at",
    [u.memberId],
  );
  expect(modes.map((m) => m.permission_mode)).toEqual(["bypassPermissions"]);
  // 直前のフックが止め、作業の行に理由と宛先
  await say(page, "銀行の入出金を取ってきて");
  await expect(page.locator("[data-working]")).toContainText(
    `QA銀行（${domain}）は規約で自動操作が禁止のため止めました。正規の連携か、手で操作してください`,
    { timeout: 20_000 },
  );
  await expect(lastAi(page)).toContainText("規約で自動操作が禁止のため、操作を止めました", { timeout: 20_000 });
  await expect(lastAi(page)).toContainText("口座連携");
  // 証跡：仕事の出来事と監査の記録（誰の仕事・どのサービス・どの道具）
  const ev = await admin<{ payload: { tool: string; domain: string; service: string } }>(
    "select e.payload from bridge_job_events e join bridge_jobs j on j.id = e.job_id where j.member_id = $1 and e.kind = 'blocked'",
    [u.memberId],
  );
  expect(ev.map((e) => e.payload)).toEqual([expect.objectContaining({ tool: "Bash", domain, service: "QA銀行" })]);
  const au = await admin<{ actor_member_id: string; payload: { service: string; tool: string } }>(
    "select actor_member_id, payload from audit_events where action = 'agent.blocked' and payload->>'domain' = $1",
    [domain],
  );
  expect(au).toEqual([
    expect.objectContaining({
      actor_member_id: u.memberId,
      payload: expect.objectContaining({ service: "QA銀行", tool: "Bash" }),
    }),
  ]);
  // 台帳を変えると次の仕事から効く（銀行でなくなったら渡らない）
  await admin("update service_registry set automation_verdict_id = 'api' where domain like $1", [`%${domain}%`]);
  await say(page, "もう一度、禁止を見せて");
  await expect(lastAi(page)).toContainText("使わない道具：", { timeout: 20_000 });
  await expect(lastAi(page)).not.toContainText(domain);
  await say(page, "もう一度、銀行の入出金を取ってきて");
  await expect(lastAi(page), "台帳で禁止でなくなった宛先は止めない").toContainText("銀行のサイトから取ってきました", {
    timeout: 20_000,
  });
  expect(
    (await admin("select 1 from audit_events where action = 'agent.blocked' and payload->>'domain' = $1", [domain]))
      .length,
    "止めた記録は 1 件のまま",
  ).toBe(1);
});
