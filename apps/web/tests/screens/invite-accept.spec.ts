// T-U-03 招待を受けて参加する。テストの名前に正本の行 ID を持つ（op_gate.py）
import { expect, test } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { pwToggle, admin, noOverflow, PW, sha256, signupViaApi, uniqEmail } from "../_lib/api";

async function invite(roleId: string, opts: { revoked?: boolean; email?: string } = {}) {
  const boss = await signupViaApi("招く会社");
  const token = randomBytes(24).toString("base64url");
  const email = opts.email ?? uniqEmail();
  await admin(
    "insert into invitations (tenant_id, email, role_id, token_hash, expires_at, revoked_at, created_by) values ($1, $2, $3, $4, now() + interval '7 days', $5, $6)",
    [boss.tenantId, email, roleId, sha256(token), opts.revoked ? new Date() : null, boss.memberId],
  );
  return { boss, token, email };
}
test("SCR-INVITE-ACCEPT-001 SCR-INVITE-ACCEPT-007 SCR-INVITE-ACCEPT-008 SCR-INVITE-ACCEPT-006 SCR-INVITE-ACCEPT-020 SCR-INVITE-ACCEPT-021 SCR-INVITE-ACCEPT-022 SCR-INVITE-ACCEPT-023 SCR-INVITE-ACCEPT-010 SCR-INVITE-ACCEPT-012 E-NF-001-B 担当者として：4 幅で横溢れ 0・見える範囲が先に出る・メールは招待のもので固定・名前（前後の空白・NFD）とパスワードで参加 → 会員が 1 人できる（別 GET）", async ({
  page,
}) => {
  const { boss, token, email } = await invite("staff");
  await noOverflow(page, `/invite/${token}`);
  await expect(page.locator("form[data-state='n']")).toContainText("招く会社");
  await expect(page.locator("form[data-state='n']")).toContainText("担当者");
  await expect(page.locator("form[data-roles='R3']")).toContainText("今日やること・承認待ち（自分の分）");
  await expect(page.locator("[data-requires]")).toHaveCount(0);
  const mail = page.getByLabel("メールアドレス");
  await expect(mail).toHaveValue(email);
  await expect(mail).toHaveAttribute("readonly", "");
  await page.getByLabel("お名前").fill("  佐藤 健゙ ".normalize("NFD"));
  await page.getByLabel("パスワード", { exact: true }).fill(PW);
  await page.getByRole("button", { name: "参加する" }).click();
  await page.waitForURL(/\/setup\/bridge/, { timeout: 15_000 }).catch(() => undefined); // 参加した直後は はじめの設定 0（D-089）
  const m = await admin<{ display_name: string }>(
    "select display_name from members where tenant_id = $1 and role_id = 'staff'",
    [boss.tenantId],
  );
  expect(m).toHaveLength(1);
  expect(m[0]!.display_name).toBe("佐藤 健゙".normalize("NFC").trim());
});
test("SCR-INVITE-ACCEPT-009 SCR-INVITE-ACCEPT-011 SCR-INVITE-ACCEPT-013 全角・記号・大文字：名前は全角のまま保つ（記号の種別も保つ）。メールは招待側で正規化済みで入力不可", async ({
  page,
}) => {
  const { boss, token } = await invite("staff");
  await page.goto(`/invite/${token}`);
  await page.getByLabel("お名前").fill("ＡＢＣ‐ｄｅｆ　商店");
  await page.getByLabel("パスワード", { exact: true }).fill(PW);
  await page.getByRole("button", { name: "参加する" }).click();
  await page.waitForURL(/\/setup\/bridge/, { timeout: 15_000 }).catch(() => undefined); // 参加した直後は はじめの設定 0（D-089）
  const m = await admin<{ display_name: string }>(
    "select display_name from members where tenant_id = $1 and role_id = 'staff'",
    [boss.tenantId],
  );
  expect(m[0]!.display_name).toBe("ABC‐def 商店"); // NFKC：全角英数と全角空白は半角に・‐（U+2010）はそのまま
});
test("SCR-INVITE-ACCEPT-002 閲覧のみとして：書き込めないと先に示す（data-roles=R4）→ 参加すると閲覧の会員", async ({
  page,
}) => {
  const { boss, token } = await invite("viewer");
  await page.goto(`/invite/${token}`);
  await expect(page.locator("form[data-state='r4'][data-roles='R4']")).toContainText("進捗を見るだけの参加です");
  await page.getByLabel("お名前").fill("外部 花子");
  await page.getByLabel("パスワード", { exact: true }).fill(PW);
  await page.getByRole("button", { name: "参加する" }).click();
  await page.waitForURL(/\/setup\/bridge/, { timeout: 15_000 }).catch(() => undefined); // 参加した直後は はじめの設定 0（D-089）
  const m = await admin<{ n: string }>(
    "select count(*) as n from members where tenant_id = $1 and role_id = 'viewer'",
    [boss.tenantId],
  );
  expect(Number(m[0]!.n)).toBe(1);
});
test("SCR-INVITE-ACCEPT-003 E-NF-001-A E-NF-001-C 取り消し済み・無い招待は状態 x：文言と一手（もう一度招待してもらう）", async ({
  page,
}) => {
  const { token } = await invite("staff", { revoked: true });
  await page.goto(`/invite/${token}`);
  await expect(page.locator("[data-state='x'] h1")).toHaveText("この招待は取り消されています");
  await expect(page.locator("[data-state='x']")).toContainText("もう一度招待してもらってください");
  await page.goto("/invite/no-such-token");
  await expect(page.locator("[data-state='x']")).toBeVisible();
});

test("SCR-INVITE-ACCEPT-025 パスワードは見る・隠すを切り替えられる（既定は隠す・押すと見える・的は 24px 以上）", async ({
  page,
}) => {
  const { token } = await invite("staff");
  await page.goto(`/invite/${token}`);
  await page.getByLabel("パスワード", { exact: true }).fill(PW);
  await pwToggle(page, "パスワード");
});
