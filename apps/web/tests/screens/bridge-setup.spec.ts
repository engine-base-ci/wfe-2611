// T-U-09 自分のPCをつなぐ。テストの名前に正本の行 ID を持つ（op_gate.py）。Bridge の行は前提として DB に置く（claim の実体は T-I-02）
import { expect, test } from "@playwright/test";
import { admin, bridgeRow, loginAs, noOverflow, signupViaApi } from "../_lib/api";

test("SCR-BRIDGE-SETUP-001 SCR-BRIDGE-SETUP-016 SCR-BRIDGE-SETUP-017 SCR-BRIDGE-SETUP-007 SCR-BRIDGE-SETUP-032 SCR-BRIDGE-SETUP-003 SCR-BRIDGE-SETUP-044 E-CONN-001-A E-CONN-001-C 接続中：4 幅で横溢れ 0・接続コード KNM-#### が出る・「接続を確かめる」→ つながらない（文言と一手＝もう一度確かめる）", async ({
  page,
}) => {
  const u = await signupViaApi();
  await loginAs(page, u.token);
  await noOverflow(page, "/setup/bridge");
  await expect(page.locator("h1")).toHaveText("自分のPCをつなぐ");
  await expect(page.locator("[data-state='n']")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("[data-requires='data']")).toHaveCount(0);
  await expect(page.locator("[data-pair-code]")).toHaveText(/^KNM-\d{4}$/, { timeout: 15_000 });
  await page.getByRole("button", { name: "接続を確かめる" }).click();
  await expect(page.locator("[data-state='ng']")).toContainText("つながっていません");
  await expect(page.locator("[data-state='ng']")).toContainText("もう一度確かめてください");
  await page.getByRole("button", { name: "もう一度確かめる" }).click();
  await expect(page.locator("[data-state='ng']")).toBeVisible();
});
test("SCR-BRIDGE-SETUP-002 SCR-BRIDGE-SETUP-043 E-CONN-001-B E-TO-003-B つながった：Bridge の行があれば ok（端末・登録・最後の応答）→「自分のAIと話すへ」→ /onboard/interview", async ({
  page,
}) => {
  const u = await signupViaApi();
  await loginAs(page, u.token);
  await bridgeRow(u);
  await page.goto("/setup/bridge");
  await expect(page.locator("[data-state='ok']")).toContainText("つながりました", { timeout: 15_000 });
  await expect(page.locator("[data-state='ok']")).toContainText("MacBook Pro（QA）");
  await page.getByRole("link", { name: "自分のAIと話すへ" }).click();
  await expect(page).toHaveURL(/\/onboard\/interview/, { timeout: 15_000 });
});
test("E-TO-003-A E-TO-003-C 終了直後（0〜90 秒）：Bridge の行を失効させた直後に確かめると、つながらない側に落ちて「もう一度確かめる」の一手が出る（鮮度窓の内側で「接続中」のまま残さない）", async ({
  page,
}) => {
  const u = await signupViaApi();
  await loginAs(page, u.token);
  await bridgeRow(u);
  await page.goto("/setup/bridge");
  await expect(page.locator("[data-state='ok']")).toBeVisible({ timeout: 15_000 });
  await admin("update sessions set revoked_at = now() where tenant_id = $1 and kind_id = 'bridge'", [u.tenantId]);
  await page.reload();
  await expect(page.locator("[data-state='n']")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "接続を確かめる" }).click();
  await expect(page.locator("[data-state='ng']")).toContainText("つながっていません");
  await expect(page.getByRole("button", { name: "もう一度確かめる" })).toBeVisible();
});
test("SCR-BRIDGE-SETUP-045 SCR-BRIDGE-SETUP-033 SCR-BRIDGE-SETUP-034 SCR-BRIDGE-SETUP-035 SCR-BRIDGE-SETUP-036 手順バーの 1〜4 と「あとでやる」→ それぞれの画面が開く", async ({
  page,
}) => {
  const u = await signupViaApi();
  await loginAs(page, u.token);
  await page.goto("/setup/bridge");
  await expect(page.locator("[data-state='n']")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("link", { name: /あとでやる/ }).click();
  await expect(page).toHaveURL(/\/onboard\/draft/);
  for (const [label, href] of [
    [/PCをつなぐ$/, "/setup/bridge"],
    [/話す$/, "/onboard/interview"],
    [/たたき台$/, "/onboard/draft"],
    [/ログイン情報$/, "/settings/credentials"],
  ] as const) {
    await page.goto("/setup/bridge");
    await page.getByRole("list", { name: "手順" }).getByRole("link", { name: label }).click();
    await expect(page).toHaveURL(new RegExp(href.replace(/\//g, "\\/") + "$"));
  }
});
