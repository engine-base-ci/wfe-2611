// T-U-01 アカウントを作る：状態 n／e・主アクションで会社ができる（別 GET で確認）・表記ゆらぎ・到達性・4 幅
import { expect, test } from "@playwright/test";
import { admin, api, noOverflow, PW, uniqEmail } from "../_lib/api";

test("4 幅で横溢れ 0・h1", async ({ page }) => {
  await noOverflow(page, "/signup");
  await expect(page.locator("h1")).toHaveText("アカウントを作る");
});
test("はじめる：全角メール・空白・大文字でも通り、会社が作られてメール確認へ進む（別 GET で会社を確認）", async ({
  page,
}) => {
  await page.goto("/signup");
  const local = uniqEmail().split("@")[0]!.toUpperCase();
  // eslint-disable-next-line no-irregular-whitespace -- 全角の空白を意図して入れる（表記ゆらぎ）
  await page.getByLabel("メールアドレス").fill(`　${local}＠Example.COM `);
  await page.getByLabel("パスワード").fill(PW);
  await page.getByLabel("会社名（または屋号）").fill("　株式会社テスト ");
  await page.getByLabel("利用規約とプライバシーポリシーに同意します").check();
  await page.getByRole("button", { name: "はじめる" }).click();
  await expect(page).toHaveURL(/\/verify-email\?sent=1/);
  const email = `${local.toLowerCase()}@example.com`;
  await expect(page.locator("[data-state='n']")).toContainText(email);
  const t = await admin<{ name: string }>(
    'select t.name from members m join tenants t on t.id = m.tenant_id join kaname_auth."user" u on u.id = m.auth_user_id where u.email = $1',
    [email],
  );
  expect(t[0]?.name).toBe("株式会社テスト");
  expect(await page.evaluate(() => window.localStorage.getItem("kaname.token"))).toBeTruthy();
});
test("既に登録済み：状態 e に「ログイン／入り直す」の導線（E-CONF-001）", async ({ page }) => {
  const email = uniqEmail();
  expect((await api("/api/auth-ext/sign-up", { email, password: PW, company_name: "先客" })).status).toBe(201);
  await page.goto("/signup");
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード").fill(PW);
  await page.getByLabel("会社名（または屋号）").fill("後客");
  await page.getByLabel("利用規約とプライバシーポリシーに同意します").check();
  await page.getByRole("button", { name: "はじめる" }).click();
  await expect(page.locator("form[data-state='e']")).toBeVisible();
  await expect(page.getByText("このメールアドレスは既に登録されています")).toBeVisible();
  await expect(page.getByRole("link", { name: "入り直す" })).toHaveAttribute("href", "/password-reset");
  await page.getByRole("link", { name: "ログイン", exact: true }).first().click();
  await expect(page).toHaveURL(/\/login$/);
});
test("形式違い（abc@）はブラウザ標準ではなく画面の文言が出る（E-VAL-004・required に奪われない）", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("メールアドレス").fill("abc@");
  await page.getByRole("button", { name: "はじめる" }).click();
  await expect(page.getByText("メールアドレスの形式が違います")).toBeVisible();
});
