// UI 共通基盤（T-US-03 API クライアントと型／T-US-04 認証の配管）の実ブラウザの証拠。行 ID を名前に持つ（op_gate.py）
import { expect, test } from "@playwright/test";
import { admin, bridgeRow, ensureGoalKind, loginAs, noOverflow, PW, signupViaApi, WIDTHS, setupDone } from "./_lib/api";

test("USH-03-001 API クライアント：契約の path で GET し、返った値が画面に出る（プレースホルダ固定でない）。書き込みの後は別 GET で読み直す。4 幅で溢れ 0", async ({
  page,
}) => {
  const u = await signupViaApi();
  await setupDone(u); // はじめの設定を通し終わった人（D-089）
  await loginAs(page, u.token);
  await ensureGoalKind();
  await admin(
    "insert into goals (tenant_id, scope_id, kind_id, period_start, period_end, target_value, created_by) values ($1, $2, 'seed', '2026-10-01', '2026-12-31', 7654321, $3)",
    [u.tenantId, u.scopeId, u.memberId],
  );
  await noOverflow(page, "/onboard/draft");
  await expect(page.locator("[data-state='n']")).toContainText("7,654,321", { timeout: 15_000 }); // API から来た実値（画面は 3 桁区切りで出す）
  // 別 GET で再取得：もう 1 件足して開き直すと増えている
  await ensureGoalKind();
  await admin(
    "insert into goals (tenant_id, scope_id, kind_id, period_start, period_end, target_value, created_by) values ($1, $2, 'seed', '2027-01-01', '2027-03-31', 1234567, $3)",
    [u.tenantId, u.scopeId, u.memberId],
  );
  await page.goto("/onboard/draft");
  await expect(page.locator("[data-state='n']")).toContainText("1,234,567", { timeout: 15_000 });
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
      `幅 ${width}`,
    ).toBeLessThanOrEqual(1);
  }
});
test("USH-03-006 USH-04-006 口座状態の波及（G-14）：セッションを失効させると、次の要求で守られた画面から入り直しへ落ちる", async ({
  page,
}) => {
  const u = await signupViaApi();
  await setupDone(u); // はじめの設定を通し終わった人（D-089）
  await loginAs(page, u.token);
  await bridgeRow(u);
  await page.goto("/onboard/interview");
  await expect(page.locator("[data-state='0']")).toBeVisible({ timeout: 15_000 });
  await admin("update sessions set revoked_at = now() where tenant_id = $1", [u.tenantId]);
  await admin(`update kaname_auth.session set "expiresAt" = now() - interval '1 hour' where "userId" = $1`, [u.userId]);
  await page.goto("/onboard/interview");
  await page.waitForURL(/\/login/, { timeout: 15_000 });
  expect(page.url()).toMatch(/\/login\?next=/);
});
test("USH-04-001 認証の配管：未ログインで守られた画面は入り直しへ（next つき）。入ると元の画面に戻る", async ({
  page,
}) => {
  await page.goto("/settings/credentials");
  await page.waitForURL(/\/login/, { timeout: 15_000 });
  expect(page.url()).toContain("next=%2Fsettings%2Fcredentials");
  await expect(page.locator("form[data-state='n'] h1")).toHaveText("ログイン"); // 入り直しの画面が出てから入れる
  const u = await signupViaApi();
  await setupDone(u); // はじめの設定を通し終わった人（D-089）
  await page.getByLabel("メールアドレス").fill(u.email);
  await page.getByLabel("パスワード", { exact: true }).fill(PW);
  await page.getByRole("button", { name: "次へ", exact: true }).click();
  await expect(page).toHaveURL(/\/settings\/credentials$/, { timeout: 15_000 });
  await expect(page.locator("h1")).toHaveText("ログイン情報を預ける");
});
