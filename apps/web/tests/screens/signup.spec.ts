// T-U-01 アカウントを作る。テストの名前に正本の行 ID（SCR-SIGNUP-NNN・E-…）を持つ。op_gate.py はこの名前と直近の JSON 報告で PASS を検査する
import { expect, test } from "@playwright/test";
import { pwToggle, admin, api, noOverflow, PW, uniqEmail } from "../_lib/api";

test("SCR-SIGNUP-001 SCR-SIGNUP-007 状態 通常：h1・4 幅で横溢れ 0", async ({ page }) => {
  await noOverflow(page, "/signup");
  await expect(page.locator("form[data-state='n'] h1, h1").first()).toHaveText("アカウントを作る");
  await expect(page.locator("form[data-state='n']")).toBeVisible();
});
test("SCR-SIGNUP-005 SCR-SIGNUP-020 SCR-SIGNUP-021 SCR-SIGNUP-022 SCR-SIGNUP-023 SCR-SIGNUP-024 SCR-SIGNUP-009 SCR-SIGNUP-010 SCR-SIGNUP-013 E-VAL-004-B はじめる：入力 4 つ＋同意を入れて押すと会社ができ（別 GET＝DB）、メール確認へ。全角・空白・大文字のメールも同一に", async ({
  page,
}) => {
  await page.goto("/signup");
  const gen = uniqEmail();
  const [local, domain] = [gen.split("@")[0]!.toUpperCase(), gen.split("@")[1]!];
  // eslint-disable-next-line no-irregular-whitespace -- 全角の空白を意図して入れる（表記ゆらぎ）
  await page.getByLabel("メールアドレス").fill(`　${local}＠${domain.toUpperCase()} `);
  await page.getByLabel("パスワード", { exact: true }).fill(PW);
  await page.getByLabel("会社名（または屋号）").fill("　株式会社テスト ");
  const agree = page.getByLabel("利用規約とプライバシーポリシーに同意します");
  await agree.check();
  await expect(agree).toBeChecked();
  await page.getByRole("button", { name: "はじめる" }).click();
  await expect(page).toHaveURL(/\/verify-email\?sent=1/);
  const email = `${local.toLowerCase()}@${domain.toLowerCase()}`;
  await expect(page.locator("[data-state='n']")).toContainText(email);
  const t = await admin<{ name: string }>(
    'select t.name from members m join tenants t on t.id = m.tenant_id join kaname_auth."user" u on u.id = m.auth_user_id where u.email = $1',
    [email],
  );
  expect(t[0]?.name).toBe("株式会社テスト");
  expect(await page.evaluate(() => window.localStorage.getItem("kaname.token"))).toBeTruthy();
});
test("SCR-SIGNUP-011 SCR-SIGNUP-012 記号の種別と NFD：会社名の長音・ハイフン・NFD は NFC に正規化して保存（メールは ASCII なので N/A）", async ({
  page,
}) => {
  await page.goto("/signup");
  const email = uniqEmail();
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード", { exact: true }).fill(PW);
  await page.getByLabel("会社名（または屋号）").fill("テスト‐カ\u3099ー－商店"); // ‐（U+2010）・カ＋結合の濁点（NFD）・全角ハイフン
  await page.getByLabel("利用規約とプライバシーポリシーに同意します").check();
  await page.getByRole("button", { name: "はじめる" }).click();
  await expect(page).toHaveURL(/\/verify-email/);
  const t = await admin<{ name: string }>(
    'select t.name from members m join tenants t on t.id = m.tenant_id join kaname_auth."user" u on u.id = m.auth_user_id where u.email = $1',
    [email],
  );
  expect(t[0]?.name).toBe("テスト‐ガー-商店".normalize("NFC")); // NFKC：全角ハイフンは半角に・濁点は結合・U+2010 はそのまま（記号の種別は失わない）
});
test("SCR-SIGNUP-002 SCR-SIGNUP-026 SCR-SIGNUP-025 SCR-SIGNUP-027 E-CONF-001-A E-CONF-001-C 既に登録済み：状態 e に文言と一手（ログイン／パスワードの再設定）が出て、押すと開く", async ({
  page,
}) => {
  const email = uniqEmail();
  expect((await api("/api/auth-ext/sign-up", { email, password: PW, company_name: "先客" })).status).toBe(201);
  await page.goto("/signup");
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード", { exact: true }).fill(PW);
  await page.getByLabel("会社名（または屋号）").fill("後客");
  await page.getByLabel("利用規約とプライバシーポリシーに同意します").check();
  await page.getByRole("button", { name: "はじめる" }).click();
  await expect(page.locator("form[data-state='e']")).toBeVisible();
  await expect(page.getByText("このメールアドレスは既に登録されています")).toBeVisible();
  await page.getByRole("link", { name: "パスワードの再設定" }).click();
  await expect(page).toHaveURL(/\/password-reset$/);
  await expect(page.locator("h1")).toHaveText("パスワードの再設定");
  await page.goBack();
  await page.getByRole("link", { name: "ログイン", exact: true }).first().click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator("h1")).toHaveText("ログイン");
});
test("SCR-SIGNUP-006 通常の状態の「ログイン」リンク → /login が 200 で開く", async ({ page }) => {
  await page.goto("/signup");
  await page.getByRole("link", { name: "ログイン", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator("h1")).toHaveText("ログイン");
});
test("SCR-SIGNUP-008 E-CONF-001-B 空・止まっている：外の画面なので該当なし＝データ由来の件数も AI の帯も出ない。未登録のメールでは E-CONF-001 は出ない", async ({
  page,
}) => {
  await page.goto("/signup");
  await expect(page.locator("[data-requires]")).toHaveCount(0);
  await page.getByLabel("メールアドレス").fill(uniqEmail());
  await page.getByLabel("パスワード", { exact: true }).fill(PW);
  await page.getByLabel("会社名（または屋号）").fill("新規");
  await page.getByLabel("利用規約とプライバシーポリシーに同意します").check();
  await page.getByRole("button", { name: "はじめる" }).click();
  await expect(page).toHaveURL(/\/verify-email/);
});
test("E-VAL-004-A E-VAL-004-C 形式違い（abc@）は画面の文言（required に奪われない）。直すと通る", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("メールアドレス").fill("abc@");
  await page.getByRole("button", { name: "はじめる" }).click();
  await expect(page.getByText("メールアドレスの形式が違います")).toBeVisible();
  await page.getByLabel("メールアドレス").fill(uniqEmail());
  await page.getByLabel("パスワード", { exact: true }).fill(PW);
  await page.getByLabel("会社名（または屋号）").fill("直した");
  await page.getByLabel("利用規約とプライバシーポリシーに同意します").check();
  await page.getByRole("button", { name: "はじめる" }).click();
  await expect(page).toHaveURL(/\/verify-email/);
});

test("SCR-SIGNUP-029 パスワードは見る・隠すを切り替えられる（既定は隠す・押すと見える・的は 24px 以上）", async ({
  page,
}) => {
  await page.goto("/signup");
  await page.getByLabel("パスワード", { exact: true }).fill(PW);
  await pwToggle(page, "パスワード");
});
