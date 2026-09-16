// T-U-04 2 段階認証を設定する。テストの名前に正本の行 ID を持つ（op_gate.py）
import { expect, test } from "@playwright/test";
import { loginAs, noOverflow, PW, signupViaApi, totp } from "../_lib/api";

test("SCR-MFA-SETUP-001 SCR-MFA-SETUP-008 SCR-MFA-SETUP-009 状態 登録：4 幅で横溢れ 0・h1・時点の部品なし", async ({
  page,
}) => {
  const u = await signupViaApi();
  await loginAs(page, u.token);
  await noOverflow(page, "/mfa-setup");
  await expect(page.locator("[data-state='n'] h1")).toHaveText("2段階認証を設定する");
  await expect(page.locator("[data-requires]")).toHaveCount(0);
});
test("SCR-MFA-SETUP-002 SCR-MFA-SETUP-006 SCR-MFA-SETUP-007 SCR-MFA-SETUP-021 SCR-MFA-SETUP-022 SCR-MFA-SETUP-023 SCR-MFA-SETUP-024 SCR-MFA-SETUP-025 SCR-MFA-SETUP-026 SCR-MFA-SETUP-010 SCR-MFA-SETUP-011 E-AUTH-004-B 登録する：パスワード → QR と鍵 → 6 桁（全角・空白入りでも通る）→ 回復コード 10 個 → コピー・ファイルで保存 → 保管したら次へ（/setup/bridge）", async ({
  page,
  context,
}) => {
  const u = await signupViaApi();
  await loginAs(page, u.token);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/mfa-setup");
  await page.getByLabel("パスワード").fill(PW);
  await page.getByRole("button", { name: "認証アプリを登録する" }).click();
  const secret = (await page.locator("[data-totp-secret]").textContent({ timeout: 15_000 }))!.replace(/\s+/g, "");
  expect(secret.length).toBeGreaterThan(10);
  await expect(page.getByRole("img", { name: /QR/ })).toBeVisible();
  const code = totp(secret);
  const wide = code.replace(/\d/g, (d) => String.fromCharCode(0xff10 + Number(d)));
  await page.getByLabel("アプリに出た6桁").fill(` ${wide.slice(0, 3)} ${wide.slice(3)} `);
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.locator("[data-state='rc'] h1")).toHaveText("回復コードを保管してください", { timeout: 15_000 });
  await expect(page.locator("[data-backup-codes] li")).toHaveCount(10);
  await page.getByRole("button", { name: "コピー" }).click();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip.split("\n")).toHaveLength(10);
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "ファイルで保存" }).click();
  expect((await dl).suggestedFilename()).toMatch(/\.txt$/);
  const next = page.getByRole("link", { name: /次へ（PCをつなぐ）/ });
  await expect(next).toHaveAttribute("aria-disabled", "true");
  const saved = page.getByLabel("安全な場所に保管しました");
  await saved.check();
  await expect(saved).toBeChecked();
  await next.click();
  await expect(page).toHaveURL(/\/setup\/bridge/);
});
test("SCR-MFA-SETUP-012 SCR-MFA-SETUP-013 SCR-MFA-SETUP-014 記号・NFD・大文字：6 桁は数字だけなので該当なし＝数字以外を混ぜた入力は「6 桁が違います」で止まる", async ({
  page,
}) => {
  const u = await signupViaApi();
  await loginAs(page, u.token);
  await page.goto("/mfa-setup");
  await page.getByLabel("パスワード").fill(PW);
  await page.getByRole("button", { name: "認証アプリを登録する" }).click();
  await page.locator("[data-totp-secret]").waitFor({ timeout: 15_000 });
  await page.getByLabel("アプリに出た6桁").fill("12-34‐56");
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("6 桁が違います");
});
test("E-AUTH-004-A E-AUTH-004-C 6 桁が違う：文言と一手（今の数字を入れ直すと通る）", async ({ page }) => {
  const u = await signupViaApi();
  await loginAs(page, u.token);
  await page.goto("/mfa-setup");
  await page.getByLabel("パスワード").fill(PW);
  await page.getByRole("button", { name: "認証アプリを登録する" }).click();
  const secret = (await page.locator("[data-totp-secret]").textContent({ timeout: 15_000 }))!.replace(/\s+/g, "");
  await page.getByLabel("アプリに出た6桁").fill("000000");
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("6 桁が違います");
  await page.getByLabel("アプリに出た6桁").fill(totp(secret));
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.locator("[data-state='rc'] h1")).toHaveText("回復コードを保管してください", { timeout: 15_000 });
});
test("ログインしていないと登録できない（401 の文言）", async ({ page }) => {
  await page.goto("/mfa-setup");
  await page.getByLabel("パスワード").fill(PW);
  await page.getByRole("button", { name: "認証アプリを登録する" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("ログインしてから設定してください");
});
