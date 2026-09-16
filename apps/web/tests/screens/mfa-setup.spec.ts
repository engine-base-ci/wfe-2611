// T-U-04 2 段階認証を設定する：登録（QR・手入力の鍵）→ 6 桁 → 回復コード 10 個（閉じると二度と出ない）→ PC をつなぐへ
import { expect, test } from "@playwright/test";
import { loginAs, noOverflow, PW, signupViaApi, totp } from "../_lib/api";

test("4 幅で横溢れ 0・h1", async ({ page }) => {
  const u = await signupViaApi();
  await loginAs(page, u.token);
  await noOverflow(page, "/mfa-setup");
  await expect(page.locator("h1")).toHaveText("2段階認証を設定する");
});
test("パスワード → 鍵と QR → 認証アプリの 6 桁 → 回復コード 10 個 → 保管したら次へ", async ({ page }) => {
  const u = await signupViaApi();
  await loginAs(page, u.token);
  await page.goto("/mfa-setup");
  await page.getByLabel("パスワード").fill(PW);
  await page.getByRole("button", { name: "認証アプリを登録する" }).click();
  const secret = (await page.locator("[data-totp-secret]").textContent({ timeout: 15_000 }))!.replace(/\s+/g, "");
  expect(secret.length).toBeGreaterThan(10);
  await expect(page.getByRole("img", { name: /QR/ })).toBeVisible();
  await page.getByLabel("アプリに出た6桁").fill(totp(secret));
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.locator("[data-state='rc'] h1")).toHaveText("回復コードを保管してください", { timeout: 15_000 });
  await expect(page.locator("[data-backup-codes] li")).toHaveCount(10);
  const next = page.getByRole("link", { name: /次へ（PCをつなぐ）/ });
  await expect(next).toHaveAttribute("aria-disabled", "true");
  await page.getByLabel("安全な場所に保管しました").check();
  await next.click();
  await expect(page).toHaveURL(/\/setup\/bridge/);
});
test("ログインしていないと登録できない（401 の文言）", async ({ page }) => {
  await page.goto("/mfa-setup");
  await page.getByLabel("パスワード").fill(PW);
  await page.getByRole("button", { name: "認証アプリを登録する" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("ログインしてから設定してください");
});

test("2 段階を設定した人のログイン：パスワードの次に 6 桁（状態 m）→ 今日の画面へ", async ({ page }) => {
  const u = await signupViaApi();
  await loginAs(page, u.token);
  await page.goto("/mfa-setup");
  await page.getByLabel("パスワード").fill(PW);
  await page.getByRole("button", { name: "認証アプリを登録する" }).click();
  const secret = (await page.locator("[data-totp-secret]").textContent())!.replace(/\s+/g, "");
  await page.getByLabel("アプリに出た6桁").fill(totp(secret));
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.locator("[data-backup-codes] li")).toHaveCount(10);
  await page.evaluate(() => window.localStorage.removeItem("kaname.token"));
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill(u.email);
  await page.getByLabel("パスワード").fill(PW);
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page.locator("form[data-state='m'] h1")).toHaveText("6桁を入れてください");
  await page.getByLabel("6桁").fill("000000");
  await page.getByRole("button", { name: "今日の画面へ" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("6 桁が違います");
  await page.getByLabel("6桁").fill(totp(secret));
  await page.getByRole("button", { name: "今日の画面へ" }).click();
  await page.waitForURL(/\/today/).catch(() => undefined);
  expect(page.url()).toMatch(/\/today/);
});
