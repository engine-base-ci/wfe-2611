// T-U-06 パスワードの再設定。テストの名前に正本の行 ID を持つ（op_gate.py）
import { expect, test } from "@playwright/test";
import { api, lastMailUrl, mailLog, noOverflow, pwToggle, PW, signupViaApi, uniqEmail } from "../_lib/api";

test("SCR-PASSWORD-RESET-001 SCR-PASSWORD-RESET-009 SCR-PASSWORD-RESET-010 SCR-PASSWORD-RESET-008 状態 再設定を送る：4 幅で横溢れ 0・時点の部品なし・「ログインへ戻る」→ /login", async ({
  page,
}) => {
  await noOverflow(page, "/password-reset");
  await expect(page.locator("[data-state='n'] h1")).toHaveText("パスワードの再設定");
  await expect(page.locator("[data-requires]")).toHaveCount(0);
  await page.locator("[data-state='n']").getByRole("link", { name: "ログインへ戻る" }).click();
  await expect(page).toHaveURL(/\/login$/);
});
test("SCR-PASSWORD-RESET-002 SCR-PASSWORD-RESET-007 SCR-PASSWORD-RESET-022 SCR-PASSWORD-RESET-023 SCR-PASSWORD-RESET-026 SCR-PASSWORD-RESET-011 SCR-PASSWORD-RESET-012 SCR-PASSWORD-RESET-015 送る：未登録のメール（全角・空白・大文字）でも「送りました」＝登録の有無を漏らさない。「ログインへ戻る」→ /login", async ({
  page,
}) => {
  await page.goto("/password-reset");
  // eslint-disable-next-line no-irregular-whitespace -- 全角の空白を意図して入れる
  await page.getByLabel("メールアドレス").fill(`　${uniqEmail().toUpperCase()}　`);
  await page.getByRole("button", { name: "再設定メールを送る" }).click();
  await expect(page.locator("[data-state='s'] h1")).toHaveText("送りました");
  await expect(page.locator("[data-state='s']")).toContainText("Bridge の接続はすべて切れます");
  await page.locator("[data-state='s']").getByRole("link", { name: "ログインへ戻る" }).click();
  await expect(page).toHaveURL(/\/login$/);
});
test("SCR-PASSWORD-RESET-013 SCR-PASSWORD-RESET-014 記号・NFD：メールは ASCII なので該当なし＝NFD で入れても同じ「送りました」", async ({
  page,
}) => {
  await page.goto("/password-reset");
  await page.getByLabel("メールアドレス").fill(uniqEmail().normalize("NFD"));
  await page.getByRole("button", { name: "再設定メールを送る" }).click();
  await expect(page.locator("[data-state='s'] h1")).toHaveText("送りました");
});
test("SCR-PASSWORD-RESET-003 SCR-PASSWORD-RESET-027 SCR-PASSWORD-RESET-028 SCR-PASSWORD-RESET-029 E-AUTH-006-B リンクから新しいパスワード：2 つ違えば文言、揃えば変更して /login。古いパスワードでは入れず新しいもので入れる（サーバ）", async ({
  page,
}) => {
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
  await page.getByLabel("新しいパスワード", { exact: true }).fill(fresh);
  await page.getByLabel("もう一度").fill("different-1234567890");
  await page.getByRole("button", { name: "変更してログイン" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("2 つのパスワードが違います");
  await page.getByLabel("もう一度").fill(fresh);
  await page.getByRole("button", { name: "変更してログイン" }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await api("/api/auth-ext/sign-in", { email: u.email, password: PW })).status).toBe(401);
  expect((await api("/api/auth-ext/sign-in", { email: u.email, password: fresh })).status).toBe(200);
});
test("E-AUTH-006-A E-AUTH-006-C 使用済み・期限切れのリンクは文言と一手（もう一度メールを送る）", async ({ page }) => {
  await page.goto("/password-reset?token=used-or-expired-token");
  await expect(page.locator("[data-state='p'] h1")).toHaveText("新しいパスワード");
  await page.getByLabel("新しいパスワード", { exact: true }).fill("new-password-abc-12345");
  await page.getByLabel("もう一度").fill("new-password-abc-12345");
  await page.getByRole("button", { name: "変更してログイン" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("もう一度メールを送ってください");
});
test("SCR-PASSWORD-RESET-025 端末を失くした：「回復コードで入る（ログインへ）」→ /login（回復コードはパスワードの後に入れる）", async ({
  page,
}) => {
  await page.goto("/password-reset");
  await page
    .locator("[data-backup]")
    .getByRole("link", { name: /回復コードで入る/ })
    .click();
  await expect(page).toHaveURL(/\/login$/);
});

// メール（関門 C6）
test("SCR-PASSWORD-RESET-031 再設定メールを送ると実際に送られ、API のログに「送った」が残る（黙って落ちない）", async ({
  page,
}) => {
  const u = await signupViaApi();
  await page.goto("/password-reset");
  await page.getByLabel("メールアドレス").fill(u.email);
  await page.getByRole("button", { name: "再設定メールを送る" }).click();
  await expect(page.locator("[data-state='s'] h1")).toHaveText("送りました");
  const sent = mailLog(u.email);
  expect(sent.failed, `送れなかった: ${sent.failed}`).toBe("");
  expect(sent.sent || lastMailUrl("reset", u.email), "ログに送った記録が無い").toBeTruthy();
});
test("SCR-PASSWORD-RESET-034 届かないときに詰まらない：登録の無いアドレスでも「送りました」（有無を漏らさない）・もう一度送れる", async ({
  page,
}) => {
  await page.goto("/password-reset");
  await page.getByLabel("メールアドレス").fill(uniqEmail());
  await page.getByRole("button", { name: "再設定メールを送る" }).click();
  await expect(page.locator("[data-state='s'] h1")).toHaveText("送りました");
  await page.goto("/password-reset");
  await page.getByLabel("メールアドレス").fill(uniqEmail());
  await page.getByRole("button", { name: "再設定メールを送る" }).click();
  await expect(page.locator("[data-state='s']")).toBeVisible();
});

test("SCR-PASSWORD-RESET-036 パスワードは見る・隠すを切り替えられる（既定は隠す・押すと見える・的は 24px 以上）", async ({
  page,
}) => {
  const u = await signupViaApi();
  await page.goto("/password-reset");
  await page.getByLabel("メールアドレス").fill(u.email);
  await page.getByRole("button", { name: "再設定メールを送る" }).click();
  await expect(page.locator("[data-state='s']")).toBeVisible();
  const url = lastMailUrl("reset", u.email);
  test.skip(!url, "KANAME_API_LOG が無い");
  await page.goto(new URL(url!).pathname + new URL(url!).search);
  await page.getByLabel("新しいパスワード", { exact: true }).fill(PW);
  await pwToggle(page, "新しいパスワード");
});
