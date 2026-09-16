import { expect, test } from "@playwright/test";
import { PW, signupViaApi } from "./_lib/api";
test("probe bounce then login", async ({ page }) => {
  page.on("response", (r) => {
    if (r.url().includes(":3011")) console.log("[resp]", r.status(), r.request().method(), r.url().slice(24));
  });
  page.on("console", (m) => console.log("[c]", m.type(), m.text().slice(0, 120)));
  await page.goto("/settings/credentials");
  await page.waitForURL(/\/login/, { timeout: 15_000 });
  await expect(page.locator("form[data-state='n'] h1")).toHaveText("ログイン");
  const u = await signupViaApi();
  await page.getByLabel("メールアドレス").fill(u.email);
  await page.getByLabel("パスワード").fill(PW);
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.waitForTimeout(6000);
  console.log("URL:", page.url());
  console.log("ALERT:", (await page.locator("p[role=alert]").allTextContents()).join("|"));
});
