// T-U-03 招待を受けて参加する。テストの名前に正本の行 ID を持つ（op_gate.py）
// K-335（2026-11-18・切る段で替えた）：画面を段 3 の部品（features/F2/invite/views.tsx）と契約の口（getInvitation・acceptInvitation）に載せ替えた。
//   入り方は登録と同じ（名前とパスワード → 参加の後は「付けるまで進めない」/mfa-setup・answer=becc3d3aa526 ①）。規約は画面の中で同意（続けると同意・K-53 の申し送り）。
//   「あなたに見えるもの」は出さない（answer=7fe1f09fdab4 ⑥）。欄の名前は「名前」「メール」（段 1 の登録と同じ）。役割は所属の行 tenant_memberships.role で見る
import { expect, test } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { pwToggle, admin, noOverflow, PW, sha256, signupViaApi, uniqEmail } from "../_lib/api";
import { ownIp } from "../_lib/newcomer";

// 下見の口は 10 回／分／IP（K-331）。このファイルだけで 9 回開き、同じ回の CI でほかの招待の試験（k335・qa-c-onboard）と続けて流れるので、
//   試験ごとに別の IP の頭を付ける（利用者ごとに別の IP にする道具・K-58。口の答えは作らない。上限そのものは口の試験が持つ）
test.beforeEach(({ context }) => ownIp(context, 35));

// 招く側の会社はこのファイルで 1 回だけ登録して使い回す（登録の口も 10 回／分／IP。招待の行は試験ごとに新しく入れる）
let invitingBoss: Awaited<ReturnType<typeof signupViaApi>> | undefined;
async function invite(roleId: string, opts: { revoked?: boolean; email?: string } = {}) {
  invitingBoss ??= await signupViaApi("招く会社");
  const boss = invitingBoss;
  const token = randomBytes(24).toString("base64url");
  const email = opts.email ?? uniqEmail();
  await admin(
    "insert into invitations (tenant_id, email, role_id, token_hash, expires_at, revoked_at, created_by) values ($1, $2, $3, $4, now() + interval '7 days', $5, $6)",
    [boss.tenantId, email, roleId, sha256(token), opts.revoked ? new Date() : null, boss.memberId],
  );
  return { boss, token, email };
}
/** その会社に招待で入った人（所属の行の役割と名前） */
const joined = (tenantId: string, email: string) =>
  admin<{ display_name: string; role: string }>(
    `select m.display_name, tm.role from members m
       join kaname_auth."user" u on u.id = m.auth_user_id
       join tenant_memberships tm on tm.member_id = m.id and tm.tenant_id = m.tenant_id
      where m.tenant_id = $1 and u.email = $2`,
    [tenantId, email],
  );
test("SCR-INVITE-ACCEPT-001 SCR-INVITE-ACCEPT-007 SCR-INVITE-ACCEPT-008 SCR-INVITE-ACCEPT-006 SCR-INVITE-ACCEPT-020 SCR-INVITE-ACCEPT-021 SCR-INVITE-ACCEPT-022 SCR-INVITE-ACCEPT-023 SCR-INVITE-ACCEPT-010 SCR-INVITE-ACCEPT-012 E-NF-001-B 担当者として：4 幅で横溢れ 0・招いた会社と役割が先に出る・メールは招待のもので固定・名前（前後の空白・NFD）とパスワードで参加 → 会員が 1 人できる（別 GET）・付けるまで進めないの画面へ", async ({
  page,
}) => {
  const { boss, token, email } = await invite("staff");
  await noOverflow(page, `/invite/${token}`);
  const form = page.locator("form[data-auth='invite'][data-state='new']");
  await expect(page.locator("h1")).toHaveText("招く会社 に招待されています");
  await expect(form).toContainText("メンバー として"); // 古い役割の値 staff は member として見せる（K-331）
  await expect(page.getByText("あなたに見えるもの")).toHaveCount(0);
  await expect(page.locator("[data-requires]")).toHaveCount(0);
  const mail = page.getByLabel("メール");
  await expect(mail).toHaveValue(email);
  await expect(mail).toHaveAttribute("readonly", "");
  await page.getByLabel("名前").fill("  佐藤 健゙ ".normalize("NFD"));
  await page.getByLabel("パスワード", { exact: true }).fill(PW);
  await page.getByRole("button", { name: "参加する" }).click();
  await expect(page).toHaveURL(/\/mfa-setup/, { timeout: 15_000 });
  const m = await joined(boss.tenantId, email);
  expect(m).toHaveLength(1);
  expect(m[0]!.display_name).toBe("佐藤 健゙".normalize("NFC").trim());
  expect(m[0]!.role).toBe("member");
});
test("SCR-INVITE-ACCEPT-009 SCR-INVITE-ACCEPT-011 SCR-INVITE-ACCEPT-013 全角・記号・大文字：名前は NFKC で整える（記号の種別は保つ）。メールは招待側で正規化済みで入力不可", async ({
  page,
}) => {
  const { boss, token, email } = await invite("staff");
  await page.goto(`/invite/${token}`);
  await expect(page.getByLabel("メール")).toHaveAttribute("readonly", "");
  await page.getByLabel("名前").fill("ＡＢＣ‐ｄｅｆ　商店");
  await page.getByLabel("パスワード", { exact: true }).fill(PW);
  await page.getByRole("button", { name: "参加する" }).click();
  await expect(page).toHaveURL(/\/mfa-setup/, { timeout: 15_000 });
  const m = await joined(boss.tenantId, email);
  expect(m[0]!.display_name).toBe("ABC‐def 商店"); // NFKC：全角英数と全角空白は半角に・‐（U+2010）はそのまま
});
test("SCR-INVITE-ACCEPT-002 閲覧のみとして：役割「閲覧のみ」を先に示す → 参加すると閲覧の所属（tenant_memberships.role viewer）", async ({
  page,
}) => {
  const { boss, token, email } = await invite("viewer");
  await page.goto(`/invite/${token}`);
  await expect(page.locator("form[data-auth='invite'][data-state='new']")).toContainText("閲覧のみ として");
  await page.getByLabel("名前").fill("外部 花子");
  await page.getByLabel("パスワード", { exact: true }).fill(PW);
  await page.getByRole("button", { name: "参加する" }).click();
  await expect(page).toHaveURL(/\/mfa-setup/, { timeout: 15_000 });
  const m = await joined(boss.tenantId, email);
  expect(m).toHaveLength(1);
  expect(m[0]!.role).toBe("viewer");
});
test("SCR-INVITE-ACCEPT-003 E-NF-001-A E-NF-001-C 取り消し済み・無い招待：見出しと一手（もう一度招待してもらう）", async ({
  page,
}) => {
  const { token } = await invite("staff", { revoked: true });
  await page.goto(`/invite/${token}`);
  await expect(page.locator("[data-auth='invite'] h1")).toHaveText("この招待は取り消されています");
  await expect(page.locator("[data-auth='invite']")).toContainText("もう一度招待してもらってください");
  await page.goto("/invite/no-such-token");
  await expect(page.locator("[data-auth='invite'] h1")).toHaveText("この招待は見つかりません");
  await expect(page.locator("[data-auth='invite']")).toContainText("もう一度招待してもらってください");
});

test("SCR-INVITE-ACCEPT-025 パスワードは見る・隠すを切り替えられる（既定は隠す・押すと見える・的は 24px 以上）", async ({
  page,
}) => {
  const { token } = await invite("staff");
  await page.goto(`/invite/${token}`);
  await page.getByLabel("パスワード", { exact: true }).fill(PW);
  await pwToggle(page, "パスワード");
});
