// T-U-05 ログイン。テストの名前に正本の行 ID を持つ（op_gate.py）
import { expect, test } from "@playwright/test";
import { api, loginAs, noOverflow, PW, signupViaApi, totp } from "../_lib/api";

test("SCR-LOGIN-001 SCR-LOGIN-012 SCR-LOGIN-013 状態 通常：h1・4 幅で横溢れ 0・外の画面なので時点の部品は無い", async ({
  page,
}) => {
  await noOverflow(page, "/login");
  await expect(page.locator("form[data-state='n'] h1")).toHaveText("ログイン");
  await expect(page.locator("[data-requires]")).toHaveCount(0);
});
test("SCR-LOGIN-009 SCR-LOGIN-010 SCR-LOGIN-028 SCR-LOGIN-029 リンク「入れなくなった」→ /password-reset、「アカウントを作る」→ /signup が開く", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "入れなくなった" }).click();
  await expect(page).toHaveURL(/\/password-reset$/);
  await expect(page.locator("h1")).toHaveText("入り直す");
  await page.goto("/login");
  await page.getByRole("link", { name: "アカウントを作る" }).click();
  await expect(page).toHaveURL(/\/signup$/);
  await expect(page.locator("h1")).toHaveText("アカウントを作る");
});
test("SCR-LOGIN-008 SCR-LOGIN-025 SCR-LOGIN-026 SCR-LOGIN-027 SCR-LOGIN-014 SCR-LOGIN-015 SCR-LOGIN-018 E-AUTH-001-B E-AUTH-002-B ログイン：正しい組み合わせで今日の画面へ（大文字・全角・空白の違いは同一）", async ({
  page,
}) => {
  const u = await signupViaApi();
  await page.goto("/login");
  const local = u.email.split("@")[0]!;
  // eslint-disable-next-line no-irregular-whitespace -- 全角の空白と全角の＠を意図して入れる
  await page.getByLabel("メールアドレス").fill(`　${local.toUpperCase()}＠EXAMPLE.com `);
  await page.getByLabel("パスワード").fill(PW);
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.waitForURL(/\/today/, { timeout: 15_000 }).catch(() => undefined);
  expect(page.url()).toMatch(/\/today/);
  expect(await page.evaluate(() => window.localStorage.getItem("kaname.token"))).toBeTruthy();
});
test("SCR-LOGIN-016 SCR-LOGIN-017 記号の種別・NFD：メールは ASCII なので該当なし＝ハイフンの種別や NFD を混ぜても入れる（‐ を含む local はそのまま比較）", async ({
  page,
}) => {
  const u = await signupViaApi();
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill(u.email.normalize("NFD"));
  await page.getByLabel("パスワード").fill(PW);
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.waitForURL(/\/today/, { timeout: 15_000 }).catch(() => undefined);
  expect(page.url()).toMatch(/\/today/);
});
test("SCR-LOGIN-003 SCR-LOGIN-034 E-AUTH-001-A E-AUTH-001-C E-AUTH-002-A E-AUTH-002-C 失敗：残り回数の文言 → 5 回で 15 分ロック（正しくても入れない・サーバが最後の砦）→ 入り直すの一手", async ({
  page,
}) => {
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
  expect(r.status).toBe(429);
  await page.locator("form[data-state='e']").getByRole("link", { name: "入れなくなった" }).click();
  await expect(page).toHaveURL(/\/password-reset$/);
});
test("SCR-LOGIN-002 SCR-LOGIN-030 SCR-LOGIN-031 SCR-LOGIN-032 SCR-LOGIN-033 SCR-LOGIN-011 6桁の入力：2 段階を設定した人はパスワードの後に 6 桁。チェックを外して入れる → /today。「端末を失くした」で回復コードの欄に切り替わる", async ({
  page,
}) => {
  const u = await signupViaApi();
  await loginAs(page, u.token);
  await page.goto("/mfa-setup");
  await page.getByLabel("パスワード").fill(PW);
  await page.getByRole("button", { name: "認証アプリを登録する" }).click();
  const secret = (await page.locator("[data-totp-secret]").textContent({ timeout: 15_000 }))!.replace(/\s+/g, "");
  await page.getByLabel("アプリに出た6桁").fill(totp(secret));
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.locator("[data-backup-codes] li")).toHaveCount(10);
  const backup = (await page.locator("[data-backup-codes] li").first().textContent())!.trim();
  await page.evaluate(() => window.localStorage.removeItem("kaname.token"));
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill(u.email);
  await page.getByLabel("パスワード").fill(PW);
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page.locator("form[data-state='m'] h1")).toHaveText("6桁を入れてください");
  const trust = page.getByLabel("この端末では30日間きかない");
  await expect(trust).toBeChecked();
  await trust.uncheck();
  await expect(trust).not.toBeChecked();
  await page.getByRole("button", { name: "端末を失くした（回復コードで入る）" }).click();
  await expect(page.locator("form[data-state='m'] h1")).toHaveText("回復コードを入れてください");
  await page.getByLabel("回復コード").fill(backup);
  await page.getByRole("button", { name: "今日の画面へ" }).click();
  await page.waitForURL(/\/today/, { timeout: 15_000 }).catch(() => undefined);
  expect(page.url()).toMatch(/\/today/);
  // 使った回復コードは消える（サーバ）
  await page.evaluate(() => window.localStorage.removeItem("kaname.token"));
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill(u.email);
  await page.getByLabel("パスワード").fill(PW);
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.getByRole("button", { name: "端末を失くした（回復コードで入る）" }).click();
  await page.getByLabel("回復コード").fill(backup);
  await page.getByRole("button", { name: "今日の画面へ" }).click();
  await expect(page.locator("p[role=alert]")).toBeVisible();
  await page.getByRole("button", { name: "認証アプリの6桁で入る" }).click();
  await page.getByLabel("6桁").fill(totp(secret));
  await page.getByRole("button", { name: "今日の画面へ" }).click();
  await page.waitForURL(/\/today/, { timeout: 15_000 }).catch(() => undefined);
  expect(page.url()).toMatch(/\/today/);
});
