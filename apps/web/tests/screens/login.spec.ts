// T-U-05 ログイン：状態 n／e／m・残り回数（E-AUTH-001）・5 回でロック（E-AUTH-002）・到達性
import { expect, test } from "@playwright/test";
import { api, noOverflow, PW, signupViaApi } from "../_lib/api";

test("4 幅で横溢れ 0・h1・リンク先が実在", async ({ page }) => {
  await noOverflow(page, "/login");
  await expect(page.locator("h1")).toHaveText("ログイン");
  for (const [name, href] of [
    ["入れなくなった", "/password-reset"],
    ["アカウントを作る", "/signup"],
  ] as const) {
    await page.goto("/login");
    await page.getByRole("link", { name }).click();
    await expect(page).toHaveURL(new RegExp(href.replace("/", "\\/") + "$"));
  }
});
test("正しい組み合わせで今日の画面へ（大文字・空白の違いだけなら通る）", async ({ page }) => {
  const u = await signupViaApi();
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill(` ${u.email.toUpperCase()} `);
  await page.getByLabel("パスワード").fill(PW);
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.waitForURL(/\/today/, { timeout: 15_000 }).catch(() => undefined);
  expect(page.url()).toMatch(/\/today/); // /today の画面自体は T-U-* で（今は 404 でも URL は移る）
});
test("間違えると残り回数が出て、5 回で 15 分ロック", async ({ page }) => {
  const u = await signupViaApi();
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill(u.email);
  for (let i = 4; i >= 1; i--) {
    await page.getByLabel("パスワード").fill("wrong-password-000");
    await page.getByRole("button", { name: "ログイン" }).click();
    await expect(page.locator("form[data-state='e']")).toContainText(`あと ${i} 回で 15 分ロックします`);
  }
  await page.getByLabel("パスワード").fill("wrong-password-000");
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page.locator("form[data-state='e']")).toContainText("15 分間ロックしました");
  const r = await api("/api/auth-ext/sign-in", { email: u.email, password: PW });
  expect(r.status).toBe(429); // 正しくても入れない（サーバが最後の砦）
});
