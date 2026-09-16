// T-U-06 入り直す：状態 n／s／p・登録の有無を漏らさない・新しいパスワードでログインできる（メールのリンクは開発ではログ）
import { expect, test } from "@playwright/test";
import { api, lastMailUrl, noOverflow, PW, signupViaApi, uniqEmail } from "../_lib/api";

test("4 幅で横溢れ 0・未登録のメールでも「送りました」（登録の有無を漏らさない）", async ({ page }) => {
  await noOverflow(page, "/password-reset");
  await expect(page.locator("h1")).toHaveText("入り直す");
  await page.getByLabel("メールアドレス").fill(uniqEmail());
  await page.getByRole("button", { name: "再設定メールを送る" }).click();
  await expect(page.locator("[data-state='s'] h1")).toHaveText("送りました");
  await expect(page.locator("[data-state='s']")).toContainText("Bridge の接続はすべて切れます");
  await page.getByRole("link", { name: "ログインへ戻る" }).click();
  await expect(page).toHaveURL(/\/login$/);
});
test("リンクから新しいパスワードを設定すると、古いパスワードでは入れず新しいもので入れる", async ({ page }) => {
  const u = await signupViaApi();
  await page.goto("/password-reset");
  await page.getByLabel("メールアドレス").fill(u.email);
  await page.getByRole("button", { name: "再設定メールを送る" }).click();
  await expect(page.locator("[data-state='s']")).toBeVisible();
  const url = lastMailUrl("reset", u.email);
  test.skip(!url, "KANAME_API_LOG が無い");
  const nu = new URL(url!);
  await page.goto(nu.pathname + nu.search);
  await expect(page.locator("[data-state='p'] h1")).toHaveText("新しいパスワード");
  const fresh = "new-password-abc-12345";
  await page.getByLabel("新しいパスワード").fill(fresh);
  await page.getByLabel("もう一度").fill(fresh);
  await page.getByRole("button", { name: "変更してログイン" }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await api("/api/auth-ext/sign-in", { email: u.email, password: PW })).status).toBe(401);
  expect((await api("/api/auth-ext/sign-in", { email: u.email, password: fresh })).status).toBe(200);
});
test("端末を失くした：回復コードはログイン（パスワードの後）で入れる導線", async ({ page }) => {
  await page.goto("/password-reset");
  await page
    .locator("[data-backup]")
    .getByRole("link", { name: /回復コードで入る/ })
    .click();
  await expect(page).toHaveURL(/\/login$/);
});
