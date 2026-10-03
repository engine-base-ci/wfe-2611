// T-B-39 2 段階認証（D-117.2〜D-117.5・D-017.2・D-017.4）を、画面 → API → 本物の Bridge の輪（dist）→ 本物の Chrome → 的（/dev/fake-login）で通す。
//   種類を選んで預ける／認証アプリは鍵から自動／SMS はこの画面でコードを入れる（Bridge だけに渡る）／一度通したら次は聞かれない／返事が無ければ止まり「もう一度試す」。
//   テストの名前に正本の行 ID を持つ（op_gate.py）。本人の Bridge は使わない
import { expect, test, type Page } from "@playwright/test";
import { admin, loginAs, setupDone, signupViaApi } from "../_lib/api";
import { startAgentBridge, type AgentBridge } from "../_lib/agent-bridge";

const WEB = process.env["BASE_URL"] ?? "http://127.0.0.1:3124";
const PASSWORD = "S3cret-Plain!";
const SMS_CODE = "246810";
/** 的の「端末」を試験ごとに分ける（覚えた Cookie が他の試験に効かないように） */
const dev = () => `&dev=${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
// 1 本の試験で本物の Chrome のログインを 2〜3 回通す（1 回 10〜20 秒）
test.setTimeout(240_000);
let bridges: AgentBridge[] = [];
test.afterEach(() => {
  for (const b of bridges) b.stop();
  bridges = [];
});
async function open(page: Page) {
  const u = await signupViaApi();
  await setupDone(u);
  bridges.push(await startAgentBridge(u.token, {}));
  await loginAs(page, u.token);
  await page.goto("/settings/credentials");
  await expect(page.locator("[data-state='ge']")).toContainText("まだ資格情報がありません", { timeout: 15_000 });
  return u;
}
/** 画面で預ける（2 段階の種類つき） */
async function store(page: Page, service: string, twoFactor: string, secret?: string) {
  const listed = page.locator("[data-state='n']");
  if (await listed.count()) await listed.getByRole("button", { name: "追加する" }).click();
  else await page.getByRole("button", { name: "追加する" }).click();
  await page.getByLabel("サービス").fill(service);
  await page.getByRole("button", { name: "ログイン情報を入れる" }).click();
  await page.getByLabel("メールアドレス（ログイン名）").fill("me@example.com");
  await page.getByLabel("パスワード", { exact: true }).fill(PASSWORD);
  await page.locator("[data-two-factor]").selectOption(twoFactor);
  if (secret) await page.getByLabel("認証アプリの秘密鍵").fill(secret);
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page.locator("[data-state='n']")).toContainText("預かり先の番号", { timeout: 15_000 });
}
const cell = (page: Page, i = 0) => page.locator("[data-login-check]").nth(i);
async function settled(page: Page, i = 0) {
  await expect(cell(page, i)).not.toHaveAttribute("data-login-check", /pending|running/, { timeout: 90_000 });
  return (await cell(page, i).getAttribute("data-login-check")) ?? "";
}

test("CHT-39-001 SCR-CREDENTIALS-054 SCR-CREDENTIALS-055 預けるときに 2 段階の種類を選べる。認証アプリのときだけ鍵の欄が出て、鍵から Bridge が 6 桁を作って入れる（頼まない）", async ({
  page,
}) => {
  const u = await open(page);
  await page.getByRole("button", { name: "追加する" }).click();
  await page.getByLabel("サービス").fill(`${WEB}/dev/fake-login?mode=totp`);
  await page.getByRole("button", { name: "ログイン情報を入れる" }).click();
  // 種類の選択：5 つ。既定は なし。認証アプリを選んだときだけ鍵の欄
  const sel = page.locator("[data-two-factor]");
  await expect(sel).toHaveValue("none");
  expect(await sel.locator("option").allTextContents()).toEqual([
    "なし",
    "認証アプリ（Google Authenticator など）",
    "SMS で届くコード",
    "メールで届くコード",
    "スマホで承認",
  ]);
  await expect(page.getByLabel("認証アプリの秘密鍵")).toHaveCount(0);
  await sel.selectOption("sms");
  await expect(page.getByLabel("認証アプリの秘密鍵")).toHaveCount(0);
  await sel.selectOption("totp");
  await expect(page.getByLabel("認証アプリの秘密鍵")).toBeVisible();
  // 鍵なしで保存 → 文言
  await page.getByLabel("メールアドレス（ログイン名）").fill("me@example.com");
  await page.getByLabel("パスワード", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "秘密鍵" })).toContainText("秘密鍵を貼ってください");
  await page.getByLabel("認証アプリの秘密鍵").fill("JBSW Y3DP EHPK 3PXP");
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page.locator("[data-state='n']")).toContainText("預かり先の番号", { timeout: 15_000 });
  expect(
    (
      await admin<{ two_factor_id: string; kind_id: string }>(
        "select two_factor_id, kind_id from credentials where tenant_id = $1",
        [u.tenantId],
      )
    )[0],
  ).toEqual({ two_factor_id: "totp", kind_id: "password_totp" });
  // Bridge が 6 桁を作って入れる：本人に頼まない（asking が出ない）→ ログインできました
  expect(await settled(page)).toBe("ok");
  await expect(cell(page)).toContainText("ログインできました");
  await expect(page.locator("[data-asking]")).toHaveCount(0);
  const asks = await admin<{ n: string }>(
    "select count(*) as n from bridge_job_events where member_id = $1 and kind = 'ask'",
    [u.memberId],
  );
  expect(Number(asks[0]!.n)).toBe(0);
});

test("CHT-39-002 SCR-CREDENTIALS-052 SCR-CREDENTIALS-053 SMS：Bridge がコードの画面で止まり、この画面に「コードを入れてください」が出る。入れたコードで通り、コードは会話にも記録にも証跡にも無い", async ({
  page,
}) => {
  const u = await open(page);
  await store(page, `${WEB}/dev/fake-login?mode=sms${dev()}`, "sms");
  const ask = page.locator("[data-asking='code']");
  await expect(ask).toBeVisible({ timeout: 60_000 });
  await expect(ask).toContainText("SMSのコードを入れてください");
  await expect(cell(page)).toHaveAttribute("data-login-check", "running");
  // 空で送る → 文言。正しいコードで送る → 頼みが消え、ログインできました
  await ask.getByRole("button", { name: "送る" }).click();
  await expect(ask.getByRole("alert")).toContainText("届いたコードを入れてください");
  await ask.getByLabel("届いたコード").fill(SMS_CODE);
  await ask.getByRole("button", { name: "送る" }).click();
  await expect(page.locator("[data-asking]")).toHaveCount(0, { timeout: 15_000 });
  expect(await settled(page)).toBe("ok");
  await expect(cell(page)).toContainText("ログインできました");
  // コードは AI の会話にも記録にも出ない：仕事の出来事・証跡・メッセージのどこにも無い
  const dump = JSON.stringify([
    await admin("select payload from bridge_job_events where member_id = $1", [u.memberId]),
    await admin("select payload from audit_events where tenant_id = $1", [u.tenantId]),
    await admin("select body from messages where tenant_id = $1", [u.tenantId]),
  ]);
  expect(dump).not.toContain(SMS_CODE);
  const ans = await admin<{ payload: Record<string, unknown> }>(
    "select payload from bridge_job_events where member_id = $1 and kind = 'answer'",
    [u.memberId],
  );
  expect(ans).toHaveLength(1);
  expect(ans[0]!.payload).toMatchObject({ taken: true });
  expect(ans[0]!.payload["code"]).toBeUndefined();
  // 証跡：答えたこと（C6）と、入った（C1）
  const a = await admin<{ action: string }>(
    "select action from audit_events where tenant_id = $1 and action in ('credential.two_factor_answered', 'credential.login_check') order by created_at",
    [u.tenantId],
  );
  expect(a.map((x) => x.action)).toEqual(["credential.two_factor_answered", "credential.login_check"]);
});

test("CHT-39-003 一度通したサービスは、次はコードを聞かれない（Bridge のブラウザがログインを覚えている）。スマホで承認は「承認した」で進む", async ({
  page,
}) => {
  const u = await open(page);
  const device = dev();
  await store(page, `${WEB}/dev/fake-login?mode=sms${device}`, "sms");
  const ask = page.locator("[data-asking='code']");
  await expect(ask).toBeVisible({ timeout: 60_000 });
  await ask.getByLabel("届いたコード").fill(SMS_CODE);
  await ask.getByRole("button", { name: "送る" }).click();
  expect(await settled(page)).toBe("ok");
  // 2 回目：もう一度試す → 頼まれずに ok（別の口座で預けても、同じ PC の Bridge は同じログインの状態）
  const second = await signupViaApi();
  await setupDone(second);
  bridges.push(await startAgentBridge(second.token, {}));
  await loginAs(page, second.token);
  await page.goto("/settings/credentials");
  await expect(page.locator("[data-state='ge']")).toBeVisible({ timeout: 15_000 });
  await store(page, `${WEB}/dev/fake-login?mode=sms${device}`, "sms");
  expect(await settled(page)).toBe("ok");
  await expect(page.locator("[data-asking]")).toHaveCount(0);
  const asks = await admin<{ n: string }>(
    "select count(*) as n from bridge_job_events where member_id = $1 and kind = 'ask'",
    [second.memberId],
  );
  expect(Number(asks[0]!.n)).toBe(0);
  // スマホで承認
  await store(page, `${WEB}/dev/fake-login?mode=push`, "push");
  const approve = page.locator("[data-asking='approve']");
  await expect(approve).toBeVisible({ timeout: 60_000 });
  await expect(approve).toContainText("スマホで承認してください");
  await approve.getByRole("button", { name: "スマホで承認した" }).click();
  expect(await settled(page, 1)).toBe("ok");
  await expect(cell(page, 1)).toContainText("ログインできました");
  void u;
});

test("CHT-39-004 コードを頼んだまま返事が無ければ、理由つきで止まり「もう一度試す」が出る。勝手には試さない。押すと 1 回だけ試し直す", async ({
  page,
}) => {
  const u = await open(page);
  await store(page, `${WEB}/dev/fake-login?mode=sms${dev()}`, "sms");
  await expect(page.locator("[data-asking='code']")).toBeVisible({ timeout: 60_000 });
  // 答えない（試験の Bridge は 20 秒で諦める。本人の PC では 10 分）
  expect(await settled(page)).toBe("no_answer");
  await expect(cell(page)).toContainText("返事が無かったので止めました");
  await expect(cell(page)).toContainText("10 分");
  await expect(page.locator("[data-asking]")).toHaveCount(0);
  await page.waitForTimeout(3_000);
  let n = await admin<{ n: string }>("select count(*) as n from bridge_jobs where member_id = $1", [u.memberId]);
  expect(Number(n[0]!.n)).toBe(1);
  // 本人が押す → もう 1 回だけ（今度は答える）
  await cell(page).getByRole("button", { name: "もう一度試す" }).click();
  await expect(cell(page)).toHaveAttribute("data-login-check", /pending|running/, { timeout: 10_000 });
  const ask = page.locator("[data-asking='code']");
  await expect(ask).toBeVisible({ timeout: 60_000 });
  await ask.getByLabel("届いたコード").fill(SMS_CODE);
  await ask.getByRole("button", { name: "送る" }).click();
  expect(await settled(page)).toBe("ok");
  n = await admin<{ n: string }>("select count(*) as n from bridge_jobs where member_id = $1", [u.memberId]);
  expect(Number(n[0]!.n)).toBe(2);
});
