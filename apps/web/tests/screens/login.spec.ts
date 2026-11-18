// T-U-05 ログイン。テストの名前に正本の行 ID を持つ（op_gate.py）
import { expect, test } from "@playwright/test";
import { HOME_RE, PW, api, enableTotpViaApi, noOverflow, pwToggle, setupDone, signupViaApi, totp } from "../_lib/api";

test("SCR-LOGIN-001 SCR-LOGIN-012 SCR-LOGIN-013 状態 通常：h1・4 幅で横溢れ 0・外の画面なので時点の部品は無い", async ({
  page,
}) => {
  await noOverflow(page, "/login");
  await expect(page.locator("form[data-state='n'] h1")).toHaveText("ログイン");
  await expect(page.locator("[data-requires]")).toHaveCount(0);
});
test("SCR-LOGIN-009 SCR-LOGIN-010 SCR-LOGIN-028 SCR-LOGIN-029 リンク「パスワードを忘れた」→ /password-reset、「アカウントを作る」→ /signup が開く", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "パスワードを忘れた" }).click();
  await expect(page).toHaveURL(/\/password-reset$/);
  await expect(page.locator("h1")).toHaveText("パスワードの再設定");
  await page.goto("/login");
  await page.getByRole("link", { name: "アカウントを作る" }).click();
  await expect(page).toHaveURL(/\/signup$/);
  await expect(page.locator("h1")).toHaveText("アカウントを作る");
});
test("SCR-LOGIN-008 SCR-LOGIN-025 SCR-LOGIN-026 SCR-LOGIN-027 SCR-LOGIN-014 SCR-LOGIN-015 SCR-LOGIN-018 E-AUTH-001-B E-AUTH-002-B E-AUTH-007-B ログイン：正しい組み合わせで今日の画面へ（大文字・全角・空白の違いは同一）", async ({
  page,
}) => {
  const u = await signupViaApi();
  await setupDone(u); // 今日 が行き先になるのは はじめの設定を通し終わった人（D-089）
  await page.goto("/login");
  const [local, domain] = [u.email.split("@")[0]!, u.email.split("@")[1]!];
  // eslint-disable-next-line no-irregular-whitespace -- 全角の空白と全角の＠を意図して入れる
  await page.getByLabel("メールアドレス").fill(`　${local.toUpperCase()}＠${domain.toUpperCase()} `);
  await page.getByLabel("パスワード", { exact: true }).fill(PW);
  await page.getByRole("button", { name: "次へ", exact: true }).click();
  await page.waitForURL(HOME_RE, { timeout: 30_000 }).catch(() => undefined);
  expect(page.url()).toMatch(HOME_RE);
  expect(await page.evaluate(() => window.localStorage.getItem("kaname.token"))).toBeTruthy();
});
test("SCR-LOGIN-016 SCR-LOGIN-017 記号の種別・NFD：メールは ASCII なので該当なし＝ハイフンの種別や NFD を混ぜても入れる（‐ を含む local はそのまま比較）", async ({
  page,
}) => {
  const u = await signupViaApi();
  await setupDone(u); // 今日 が行き先になるのは はじめの設定を通し終わった人（D-089）
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill(u.email.normalize("NFD"));
  await page.getByLabel("パスワード", { exact: true }).fill(PW);
  await page.getByRole("button", { name: "次へ", exact: true }).click();
  await page.waitForURL(HOME_RE, { timeout: 30_000 }).catch(() => undefined);
  expect(page.url()).toMatch(HOME_RE);
});
test("SCR-LOGIN-003 SCR-LOGIN-034 E-AUTH-001-A E-AUTH-001-C E-AUTH-002-A E-AUTH-002-C 失敗：残り回数の文言 → 5 回で 15 分ロック（正しくても入れない・サーバが最後の砦）→ パスワードの再設定への一手", async ({
  page,
}) => {
  const u = await signupViaApi();
  await setupDone(u); // 今日 が行き先になるのは はじめの設定を通し終わった人（D-089）
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill(u.email);
  for (let i = 4; i >= 1; i--) {
    await page.getByLabel("パスワード", { exact: true }).fill("wrong-password-000");
    await page.getByRole("button", { name: "次へ", exact: true }).click();
    await expect(page.locator("form[data-state='e']")).toContainText(`あと ${i} 回で 15 分ロックします`);
  }
  await page.getByLabel("パスワード", { exact: true }).fill("wrong-password-000");
  await page.getByRole("button", { name: "次へ", exact: true }).click();
  await expect(page.locator("form[data-state='e']")).toContainText("15 分間ロックしました");
  const r = await api<{ code?: string }>("/api/v1/auth/sign-in", { email: u.email, password: PW });
  expect(r.status).toBe(429);
  expect(r.json.code, "回数の守りの 429 ではなくロック").toBe("E-AUTH-002");
  await page.locator('[data-part="auth-box"]').getByRole("link", { name: "パスワードを忘れた" }).click();
  await expect(page).toHaveURL(/\/password-reset$/);
});
test("SCR-LOGIN-002 SCR-LOGIN-030 SCR-LOGIN-031 SCR-LOGIN-032 SCR-LOGIN-033 SCR-LOGIN-011 確認のコード：2 段階を設定した人はパスワードの後に 6 つの枠（30 日きかないのチェックは出さない）。バックアップコードで入れる → /today。「認証アプリが使えない」でバックアップコードの欄に切り替わる", async ({
  page,
}) => {
  const u = await signupViaApi();
  await setupDone(u); // 今日 が行き先になるのは はじめの設定を通し終わった人（D-089）
  // 2 段階の下ごしらえは画面でなく契約の口で（K-318：前の 2 段階の登録の頁は無くなった）
  const { secret, backupCodes } = await enableTotpViaApi(u.token);
  expect(backupCodes).toHaveLength(10);
  const backup = backupCodes[0]!;
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill(u.email);
  await page.getByLabel("パスワード", { exact: true }).fill(PW);
  await page.getByRole("button", { name: "次へ", exact: true }).click();
  await expect(page.locator("form[data-state='m'] h1")).toHaveText("確認のコード");
  // 「この端末では 30 日間きかない」はキャンバスに無いので出さない（K-221・PM の決め・口には既定の true を送る）
  await expect(page.locator('[data-part="auth-box"]').getByRole("checkbox")).toHaveCount(0);
  await page.getByRole("button", { name: "認証アプリが使えない" }).click();
  await expect(page.locator("form[data-state='m'] h1")).toHaveText("バックアップコードで入る");
  await page.getByLabel("バックアップコード").fill(backup);
  await page.getByRole("button", { name: "入る", exact: true }).click();
  await page.waitForURL(HOME_RE, { timeout: 30_000 }).catch(() => undefined);
  expect(page.url()).toMatch(HOME_RE);
  // 使ったバックアップコードは消える（サーバ）
  await page.evaluate(() => window.localStorage.removeItem("kaname.token"));
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill(u.email);
  await page.getByLabel("パスワード", { exact: true }).fill(PW);
  await page.getByRole("button", { name: "次へ", exact: true }).click();
  await page.getByRole("button", { name: "認証アプリが使えない" }).click();
  await page.getByLabel("バックアップコード").fill(backup);
  await page.getByRole("button", { name: "入る", exact: true }).click();
  await expect(page.locator('[data-part="auth-box"]').getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "認証アプリの 6 けたで入る" }).click();
  await page.getByRole("textbox", { name: "確認のコード 1 けた目" }).click();
  await page.keyboard.type(totp(secret), { delay: 30 }); // 6 つそろうと自動で進む
  await page.waitForURL(HOME_RE, { timeout: 30_000 }).catch(() => undefined);
  expect(page.url()).toMatch(HOME_RE);
});

test("SCR-LOGIN-036 パスワードは見る・隠すを切り替えられる（既定は隠す・押すと見える・的は 24px 以上）", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("パスワード", { exact: true }).fill(PW);
  await pwToggle(page, "パスワード");
});
