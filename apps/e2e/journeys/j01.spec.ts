// 流れ J-01「契約・登録（1 回だけ）」（L2）：J01-01 会社名とメールを入れる → J01-02 届いたリンクを押す → J01-03 招待リンクを押して名前を入れる → J01-04 認証アプリを登録する
// 1 本の物語として順に通す。行 ID を test の名前に持ち、結果は write_results.mjs で 07_qa/test-specs/journeys/plan.json に書き戻す
import { expect, test } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { admin, api, lastMailUrl, PW, sha256, totp, uniqEmail } from "../../web/tests/_lib/api";

test.describe.serial("J-01 契約・登録", () => {
  const email = uniqEmail();
  let tenantId = "";
  let memberId = "";
  let inviteToken = "";

  test("J01-01 会社名とメールを入れる → 申し込みを預け、確認のメールを送る（signup・D-088：ここではまだ作らない）", async ({
    page,
  }) => {
    await page.goto("/signup");
    await page.getByLabel("メールアドレス").fill(email);
    await page.getByLabel("パスワード", { exact: true }).fill(PW);
    await page.getByLabel("会社名（または屋号）").fill("通しの会社");
    await page.getByLabel("利用規約とプライバシーポリシーに同意します").check();
    await page.getByRole("button", { name: "はじめる" }).click();
    await expect(page).toHaveURL(/\/verify-email\?sent=1/);
    // ここではまだ利用者も会社も作られない（作られるのは確認した時点）
    const made = await admin<{ n: string }>('select count(*)::text as n from kaname_auth."user" where email = $1', [
      email,
    ]);
    expect(made[0]!.n).toBe("0");
    const pend = await admin<{ n: string }>(
      "select count(*)::text as n from kaname_auth.pending_signup where email = $1",
      [email],
    );
    expect(pend[0]!.n).toBe("1");
  });

  test("J01-02 届いたリンクを押す → ここで登録が終わり、会社ができる（verify-email）", async ({ page }) => {
    const url = lastMailUrl("verify", email);
    test.skip(!url, "メールの URL は開発では API のログから読む（KANAME_API_LOG）");
    const u = new URL(url!);
    await page.goto(u.pathname + u.search);
    await expect(page.locator("[data-state='ok'] h1")).toHaveText("登録できました", { timeout: 15_000 });
    const rows = await admin<{ id: string; tenant_id: string }>(
      'select m.id, m.tenant_id from members m join kaname_auth."user" u on u.id = m.auth_user_id where u.email = $1',
      [email],
    );
    expect(rows).toHaveLength(1);
    tenantId = rows[0]!.tenant_id;
    memberId = rows[0]!.id;
    const v = await admin<{ email_verified: boolean }>(
      'select "emailVerified" as email_verified from kaname_auth."user" where email = $1',
      [email],
    );
    expect(v[0]!.email_verified).toBe(true);
  });

  test("J01-03 招待リンクを押して名前を入れる → メンバーを作り、スコープを結ぶ（invite-accept）", async ({ page }) => {
    // 招待を出す画面（members・A61）はまだ無いので、招待の行は前提として作る（QA が作ったデータだけを触る）
    inviteToken = randomBytes(24).toString("base64url");
    await admin(
      "insert into invitations (tenant_id, email, role_id, token_hash, expires_at, created_by) values ($1, $2, 'staff', $3, now() + interval '7 days', $4)",
      [tenantId, uniqEmail(), sha256(inviteToken), memberId],
    );
    await page.goto(`/invite/${inviteToken}`);
    await expect(page.locator("form[data-state='n']")).toContainText("通しの会社");
    await page.getByLabel("お名前").fill("招かれた人");
    await page.getByLabel("パスワード", { exact: true }).fill(PW);
    await page.getByRole("button", { name: "参加する" }).click();
    await page.waitForURL(/\/today/).catch(() => undefined);
    const m = await admin<{ scope_id: string | null }>(
      "select scope_id from members where tenant_id = $1 and display_name = '招かれた人'",
      [tenantId],
    );
    expect(m).toHaveLength(1);
    expect(m[0]!.scope_id).not.toBeNull();
  });

  test("J01-04 認証アプリを登録する → TOTP シークレットを暗号化保管（mfa-setup）", async ({ page }) => {
    const r = await api<{ data: { token: string } }>("/api/v1/auth/sign-in", { email, password: PW });
    expect(r.status).toBe(201);
    await page.addInitScript((t) => window.localStorage.setItem("kaname.token", t), r.json.data.token);
    await page.goto("/mfa-setup");
    await page.getByLabel("パスワード", { exact: true }).fill(PW);
    await page.getByRole("button", { name: "認証アプリを登録する" }).click();
    const secret = (await page.locator("[data-totp-secret]").textContent())!.replace(/\s+/g, "");
    await page.getByLabel("アプリに出た6桁").fill(totp(secret));
    await page.getByRole("button", { name: "登録する" }).click();
    await expect(page.locator("[data-backup-codes] li")).toHaveCount(10);
    const tf = await admin<{ enabled: boolean }>(
      'select "twoFactorEnabled" as enabled from kaname_auth."user" where email = $1',
      [email],
    );
    expect(tf[0]!.enabled).toBe(true);
  });
});
