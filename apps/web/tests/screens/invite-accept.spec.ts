// T-U-03 招待を受けて参加する：状態 n（担当者）／r4（閲覧のみ）／x（取り消し済み）・参加で会社の一員になる
import { expect, test } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { admin, noOverflow, PW, sha256, signupViaApi, uniqEmail } from "../_lib/api";

async function invite(roleId: string, opts: { revoked?: boolean } = {}) {
  const boss = await signupViaApi("招く会社");
  const token = randomBytes(24).toString("base64url");
  await admin(
    "insert into invitations (tenant_id, email, role_id, token_hash, expires_at, revoked_at, created_by) values ($1, $2, $3, $4, now() + interval '7 days', $5, $6)",
    [boss.tenantId, uniqEmail(), roleId, sha256(token), opts.revoked ? new Date() : null, boss.memberId],
  );
  return { boss, token };
}
test("担当者として：見える範囲が先に出て、名前とパスワードで参加できる（別 GET で会員を確認）", async ({ page }) => {
  const { boss, token } = await invite("staff");
  await noOverflow(page, `/invite/${token}`);
  await expect(page.locator("form[data-state='n']")).toContainText("招く会社");
  await expect(page.locator("form[data-state='n']")).toContainText("担当者");
  await expect(page.locator("form[data-roles='R3']")).toContainText("今日やること・承認待ち（自分の分）");
  await page.getByLabel("お名前").fill("佐藤 健");
  await page.getByLabel("パスワード").fill(PW);
  await page.getByRole("button", { name: "参加する" }).click();
  await page.waitForURL(/\/today/, { timeout: 15_000 }).catch(() => undefined);
  const m = await admin<{ n: string }>(
    "select count(*) as n from members where tenant_id = $1 and display_name = '佐藤 健'",
    [boss.tenantId],
  );
  expect(Number(m[0]!.n)).toBe(1);
});
test("閲覧のみとして：書き込めないと先に示す（data-roles=R4）", async ({ page }) => {
  const { token } = await invite("viewer");
  await page.goto(`/invite/${token}`);
  await expect(page.locator("form[data-state='r4'][data-roles='R4']")).toContainText("進捗を見るだけの参加です");
});
test("取り消し済みは状態 x", async ({ page }) => {
  const { token } = await invite("staff", { revoked: true });
  await page.goto(`/invite/${token}`);
  await expect(page.locator("[data-state='x'] h1")).toHaveText("この招待は取り消されています");
  await page.goto("/invite/no-such-token");
  await expect(page.locator("[data-state='x']")).toBeVisible();
});
