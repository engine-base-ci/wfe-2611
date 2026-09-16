// T-U-10 ログイン情報を預ける：空（ge）→ 追加（a）→ 入力（i）→ 保存で預けたもの（n）。表には参照 ID だけ（平文は無い）
import { expect, test } from "@playwright/test";
import { admin, loginAs, noOverflow, signupViaApi } from "../_lib/api";

test("空 → 追加 → 入力 → 保存すると預けたものに並び、DB には vault_ref だけ", async ({ page }) => {
  const u = await signupViaApi();
  await loginAs(page, u.token);
  await noOverflow(page, "/settings/credentials");
  await expect(page.locator("h1")).toHaveText("ログイン情報を預ける");
  await expect(page.locator("[data-state='ge']")).toContainText("まだ資格情報がありません");
  await page.getByRole("button", { name: "追加する" }).click();
  await page.getByLabel("サービス").fill("発注ナビ");
  await page.getByRole("button", { name: "次へ" }).click();
  await expect(page.locator("[data-state='i']")).toContainText("発注ナビ のログイン情報");
  await page.getByLabel("メールアドレス（ログイン名）").fill("me@example.com");
  await page.getByLabel("パスワード", { exact: true }).fill("S3cret-Plain!");
  await page.getByLabel("2段階認証のシークレット（あれば）").fill("JBSW Y3DP");
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page.locator("[data-state='n']")).toContainText("発注ナビ", { timeout: 15_000 });
  await expect(page.locator("[data-state='n']")).toContainText("預かり先の番号");
  const rows = await admin<{ vault_ref: string; kind_id: string }>(
    "select vault_ref, kind_id from credentials where tenant_id = $1",
    [u.tenantId],
  );
  expect(rows).toHaveLength(1);
  expect(rows[0]!.vault_ref).toMatch(/^sec_/);
  expect(rows[0]!.kind_id).toBe("password_totp");
  const leak = await admin<{ n: string }>(
    "select count(*) as n from credentials where tenant_id = $1 and (vault_ref like '%S3cret%' or vault_ref like '%JBSW%')",
    [u.tenantId],
  );
  expect(Number(leak[0]!.n)).toBe(0);
});
test("やめる で戻れる・空のサービス名は文言", async ({ page }) => {
  const u = await signupViaApi();
  await loginAs(page, u.token);
  await page.goto("/settings/credentials");
  await page.getByRole("button", { name: "追加する" }).click();
  await page.getByRole("button", { name: "次へ" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("サービス名を入れてください");
  await page.getByRole("button", { name: "やめる" }).click();
  await expect(page.locator("[data-state='ge']")).toBeVisible();
});
