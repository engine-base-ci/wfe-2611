// T-U-02 メールを確認する：状態 n／ok／x・再送・到達性。ok はメールのリンク（開発ではログ）から
import { expect, test } from "@playwright/test";
import { lastMailUrl, noOverflow, signupViaApi } from "../_lib/api";

test("4 幅で横溢れ 0・状態 n（送信済み）と再送", async ({ page }) => {
  const u = await signupViaApi();
  await noOverflow(page, `/verify-email?sent=1&email=${encodeURIComponent(u.email)}`);
  await expect(page.locator("h1")).toHaveText("メールを確認してください");
  await expect(page.locator("[data-state='n']")).toContainText(u.email);
  await page.getByRole("button", { name: "もう一度送る" }).click();
  await expect(page.getByRole("status")).toContainText("もう一度送りました");
  await expect(page.getByRole("link", { name: "入力し直す" })).toHaveAttribute("href", "/signup");
});
test("期限切れ・壊れたリンクは状態 x（新しいリンクを送る）", async ({ page }) => {
  await page.goto("/verify-email?token=broken-token");
  await expect(page.locator("[data-state='x'] h1")).toHaveText("リンクの期限が切れています");
  await expect(page.getByRole("button", { name: "新しいリンクを送る" })).toBeVisible();
});
test("届いたリンクを押すと 確認できた（ok）→ PC をつなぐへ", async ({ page }) => {
  const u = await signupViaApi();
  const url = lastMailUrl("verify", u.email);
  test.skip(!url, "KANAME_API_LOG が無い（開発ではメールの URL を API のログから読む）");
  await page.goto(new URL(url!).pathname + new URL(url!).search);
  await expect(page.locator("[data-state='ok'] h1")).toHaveText("確認できました", { timeout: 15_000 });
  await page.getByRole("link", { name: /はじめの設定をはじめる/ }).click();
  await expect(page).toHaveURL(/\/setup\/bridge/);
});
