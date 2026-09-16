// T-U-07 自分のAIと話す／T-U-08 たたき台／T-U-09 PC をつなぐ：Bridge の有無で状態が変わる（時点の正直さ）
import { expect, test } from "@playwright/test";
import { admin, api, loginAs, noOverflow, signupViaApi } from "../_lib/api";

const bridgeRow = (u: { tenantId: string; memberId: string }) =>
  admin(
    "insert into sessions (tenant_id, member_id, kind_id, device_label, auth_session_id) values ($1, $2, 'bridge', 'MacBook Pro（QA）', $3)",
    [u.tenantId, u.memberId, `qa-${Date.now()}`],
  );

test("PC をつなぐ：接続コードが出る → 確かめる（未接続は ng）→ Bridge の行があれば ok", async ({ page }) => {
  const u = await signupViaApi();
  await loginAs(page, u.token);
  await noOverflow(page, "/setup/bridge");
  await expect(page.locator("h1")).toHaveText("自分のPCをつなぐ");
  await expect(page.locator("[data-pair-code]")).toHaveText(/^KNM-\d{4}$/, { timeout: 15_000 });
  await page.getByRole("button", { name: "接続を確かめる" }).click();
  await expect(page.locator("[data-state='ng']")).toContainText("つながっていません");
  await bridgeRow(u);
  await page.getByRole("button", { name: "接続を確かめる" }).click();
  await expect(page.locator("[data-state='ok']")).toContainText("つながりました", { timeout: 15_000 });
  await page.getByRole("link", { name: "自分のAIと話すへ" }).click();
  await expect(page).toHaveURL(/\/onboard\/interview/, { timeout: 15_000 });
});
test("自分のAIと話す：Bridge が無い時点は「先に PC をつなぐ」（nb）。つながると最初の質問と選択肢（0）→ 答えると分かったことに積まれる（n）", async ({
  page,
}) => {
  const u = await signupViaApi();
  await loginAs(page, u.token);
  await noOverflow(page, "/onboard/interview");
  await expect(page.locator("[data-state='nb']")).toContainText("先に自分のPCをつないでください");
  await expect(page.locator("[data-state='nb']").getByRole("link", { name: "PCをつなぐ" })).toHaveAttribute(
    "href",
    "/setup/bridge",
  );
  await bridgeRow(u);
  await page.goto("/onboard/interview");
  await expect(page.locator("[data-state='0']")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "その他（自由に書く）" })).toBeVisible();
  await page.getByRole("button", { name: "受託・制作" }).click();
  await expect(page.locator("[data-state='n']")).toContainText("受託・制作");
  await expect(page.getByRole("heading", { name: "分かったこと" }).locator("..").locator("..")).toContainText(
    "受託・制作",
  );
});
test("たたき台：データが無ければ空の状態 → 目標を 1 つ入れると（API）並ぶ。これでいく → ログイン情報へ", async ({
  page,
}) => {
  const u = await signupViaApi();
  await loginAs(page, u.token);
  await noOverflow(page, "/onboard/draft");
  await expect(page.locator("[data-state='empty']")).toContainText("まだたたき台がありません", { timeout: 15_000 });
  const g = await api<{ data?: { id: string }; code?: string }>(
    "/api/v1/goals",
    {
      name: "今期の売上",
      kind_id: "revenue",
      period_start: "2026-10-01",
      period_end: "2026-12-31",
      target_value: 12000000,
    },
    u.token,
  );
  test.info().annotations.push({
    type: "POST /api/v1/goals",
    description: `${g.status} ${JSON.stringify(g.json).slice(0, 120)}`,
  });
  if (g.status === 201) {
    await page.goto("/onboard/draft");
    await expect(page.locator("[data-state='n']")).toContainText("今期の売上", { timeout: 15_000 });
    await page.getByRole("link", { name: "これでいく" }).click();
    await expect(page).toHaveURL(/\/settings\/credentials/);
  }
});
