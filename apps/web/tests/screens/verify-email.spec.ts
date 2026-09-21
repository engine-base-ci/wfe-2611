// T-U-02 メールを確認する。テストの名前に正本の行 ID を持つ（op_gate.py）
// D-088：登録が終わるのはリンクを押した時点。押すまで利用者も会社も作られない
import { expect, test } from "@playwright/test";
import {
  admin,
  api,
  lastMailUrl,
  mailLog,
  noOverflow,
  pendingToken,
  PW,
  realMailEmail,
  signupPending,
  signupViaApi,
  uniqEmail,
} from "../_lib/api";

const userCount = async (email: string) =>
  (await admin<{ n: string }>('select count(*)::text as n from kaname_auth."user" where email = $1', [email]))[0]!.n;
const companyOf = async (email: string) =>
  (
    await admin<{ name: string }>(
      'select t.name from members m join tenants t on t.id = m.tenant_id join kaname_auth."user" u on u.id = m.auth_user_id where u.email = $1',
      [email],
    )
  )[0]?.name ?? null;

test("SCR-VERIFY-EMAIL-001 SCR-VERIFY-EMAIL-009 SCR-VERIFY-EMAIL-010 SCR-VERIFY-EMAIL-011 状態 送信済み：4 幅で横溢れ 0・宛先が出る・「もう一度送る」で送った旨が出る（入力欄は無い＝表記ゆらぎは該当なし）", async ({
  page,
}) => {
  const u = await signupPending("QA 社", uniqEmail());
  await noOverflow(page, `/verify-email?sent=1&email=${encodeURIComponent(u.email)}`);
  await expect(page.locator("[data-state='n'] h1")).toHaveText("メールを確認してください");
  await expect(page.locator("[data-state='n']")).toContainText(u.email);
  await expect(page.locator("[data-requires]")).toHaveCount(0);
  await expect(page.locator("input, textarea")).toHaveCount(0);
  await page.getByRole("button", { name: "もう一度送る" }).click();
  await expect(page.getByRole("status")).toContainText("もう一度送りました");
});

test("押すまで登録されない：申し込んだ時点では利用者も会社も無い（DB を直接見る）", async ({ page }) => {
  const email = uniqEmail();
  await signupPending("まだ作られない社", email);
  expect(await userCount(email), "申し込んだだけで利用者が作られている").toBe("0");
  expect(await companyOf(email), "申し込んだだけで会社が作られている").toBeNull();
  const pend = await admin<{ n: string }>(
    "select count(*)::text as n from kaname_auth.pending_signup where email = $1",
    [email],
  );
  expect(pend[0]!.n, "保留の申し込みが残っていない").toBe("1");
  await page.goto(`/verify-email?sent=1&email=${encodeURIComponent(email)}`);
  await expect(page.locator("[data-state='n']")).toContainText("押した時点で登録が終わります");
});

test("SCR-VERIFY-EMAIL-030 SCR-VERIFY-EMAIL-034 SCR-VERIFY-EMAIL-018 SCR-VERIFY-EMAIL-006 SCR-VERIFY-EMAIL-007 E-AUTH-003-B 状態 登録できた：リンクを押すと利用者と会社ができ、ログインして「はじめの設定をはじめる」→ /setup/bridge", async ({
  page,
}) => {
  const email = uniqEmail();
  await signupPending("押して初めて社", email);
  const url = lastMailUrl("verify", email)!;
  await page.goto(new URL(url).pathname + new URL(url).search);
  await expect(page.locator("[data-state='ok'] h1")).toHaveText("登録できました", { timeout: 15_000 });
  expect(await userCount(email)).toBe("1");
  expect(await companyOf(email)).toBe("押して初めて社");
  expect(await page.evaluate(() => window.localStorage.getItem("kaname.token")), "ログインしていない").toBeTruthy();
  await page.getByRole("link", { name: "はじめの設定をはじめる（PCをつなぐ）" }).click();
  await expect(page).toHaveURL(/\/setup\/bridge$/);
});

test("SCR-VERIFY-EMAIL-031 SCR-VERIFY-EMAIL-037 E-AUTH-003-A E-AUTH-003-C 状態 リンクが使えない：壊れたリンクは文言と「はじめから登録し直す」の一手", async ({
  page,
}) => {
  await page.goto("/verify-email?token=broken-token-000");
  await expect(page.locator("[data-state='x'] h1")).toHaveText("このリンクは使えません", { timeout: 15_000 });
  await page.getByRole("link", { name: "はじめから登録し直す" }).click();
  await expect(page).toHaveURL(/\/signup$/);
});

test("二度押し・リロード：確認の済んだリンクをもう一度開いても詰まらず、入る画面へ送られる", async ({ page }) => {
  const email = uniqEmail();
  await signupPending("二度押し社", email);
  const token = pendingToken(email);
  const first = await api("/api/auth-ext/verify-signup", { token });
  expect(first.status).toBe(201);
  await page.goto(`/verify-email?token=${encodeURIComponent(token)}`);
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
});

test("SCR-VERIFY-EMAIL-008 SCR-VERIFY-EMAIL-020 リンク「入力し直す」→ /signup が開く", async ({ page }) => {
  const u = await signupPending("入力し直す社", uniqEmail());
  await page.goto(`/verify-email?sent=1&email=${encodeURIComponent(u.email)}`);
  await page.getByRole("link", { name: "入力し直す" }).click();
  await expect(page).toHaveURL(/\/signup$/);
});

test("主アクションは確認の後にだけ出る（確認前の画面に「はじめの設定」への導線が無い）", async ({ page }) => {
  const u = await signupPending("導線なし社", uniqEmail());
  await page.goto(`/verify-email?sent=1&email=${encodeURIComponent(u.email)}`);
  await expect(page.getByRole("link", { name: /はじめの設定/ })).toHaveCount(0);
});

test("SCR-VERIFY-EMAIL-029 SCR-VERIFY-EMAIL-032 SCR-VERIFY-EMAIL-033 E-MAIL-001-A E-MAIL-001-C 状態 出せなかった：「送りました」と言わず、相手のせいにせず、次の一手を出す", async ({
  page,
}) => {
  // 送れなかったときも申し込みは 30 分残る（残っていなければ「残っていません」が正しい）
  const u = await signupPending("出せなかった社", uniqEmail());
  await page.goto(
    `/verify-email?sent=0&email=${encodeURIComponent(u.email)}&why=${encodeURIComponent("送出先の 1 日の上限")}`,
  );
  const f = page.locator("[data-state='f']");
  await expect(f.locator("h1")).toHaveText("確認のメールを出せませんでした");
  await expect(f).toContainText("あなたのメールアドレスに問題はありません");
  await expect(f).toContainText("送出先の 1 日の上限");
  await expect(f).toContainText("info@engine-base.com");
  await expect(f.getByRole("button", { name: "もう一度送る" })).toBeVisible();
  await expect(f.getByRole("link", { name: "はじめから登録し直す" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("リンクを送りました");
});

test("E-MAIL-002-A E-MAIL-002-C 宛先が受け取らない：受信箱が満杯・アドレスが違うときは、相手に直せる形で言う（こちらの都合とは別の文言）", async ({
  page,
}) => {
  const u = await signupPending("受け取らない社", uniqEmail());
  await page.goto(
    `/verify-email?sent=0&kind=recipient&email=${encodeURIComponent(u.email)}&why=${encodeURIComponent("552 5.2.2 Quota exceeded (mailbox for user is full)")}`,
  );
  const f = page.locator("[data-state='f']");
  await expect(f.locator("h1")).toHaveText("このメールアドレスに届けられませんでした");
  await expect(f).toContainText("受信箱がいっぱいか、アドレスが違うかもしれません");
  await expect(f).toContainText("受信箱を空けてから「もう一度送る」を押してください");
  await expect(f.getByRole("link", { name: "はじめから登録し直す" })).toBeVisible();
  // こちらの都合の文言は出さない（原因を取り違えない）
  await expect(f).not.toContainText("あなたのメールアドレスに問題はありません");
});

test("E-MAIL-002-B E-MAIL-001-B E-MAIL-003-A E-MAIL-003-B E-MAIL-003-C 出せなかったの出ない条件：保留があって送れていれば出ない。保留が無いと「残っていません」", async ({
  page,
}) => {
  const u = await signupPending("出ない条件社", uniqEmail());
  await page.goto(`/verify-email?sent=1&email=${encodeURIComponent(u.email)}`);
  await expect(page.locator("[data-state='f']")).toHaveCount(0);
  await admin("delete from kaname_auth.pending_signup where email = $1", [u.email]);
  await page.getByRole("button", { name: "もう一度送る" }).click();
  const status = page.getByRole("status");
  await expect(status).toContainText("この申し込みは残っていません");
  await expect(status).toContainText("もう一度はじめからやり直してください");
  // 一手（はじめから登録し直す）が押せる
  await page.getByRole("link", { name: "入力し直す" }).click();
  await expect(page).toHaveURL(/\/signup$/);
});

test("SCR-VERIFY-EMAIL-024 送る操作をすると実際に送られ、API のログに「送った」が残る（黙って落ちない）", async ({
  page,
}) => {
  // この行だけ抑止しない宛先を使う
  const email = realMailEmail();
  await signupPending("QA 社", email);
  await page.goto(`/verify-email?sent=1&email=${encodeURIComponent(email)}`);
  await page.getByRole("button", { name: "もう一度送る" }).click();
  await expect(page.getByRole("status")).toContainText("もう一度送りました");
  const sent = mailLog(email);
  expect(sent.failed, `送れなかった: ${sent.failed}`).toBe("");
  expect(sent.sent || lastMailUrl("verify", email), "ログに送った記録が無い").toBeTruthy();
});

test("SCR-VERIFY-EMAIL-027 届かないときに詰まらない：確認せずにもう一度はじめても弾かれず、新しいリンクで続けられる（登録の有無は漏らさない）", async ({
  page,
}) => {
  const email = uniqEmail();
  await signupPending("やり直し社", email);
  const old = pendingToken(email);
  // 確認せずにもう一度「はじめる」：409 にせず上書きして送り直す
  await page.goto("/signup");
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード", { exact: true }).fill(PW);
  await page.getByLabel("会社名（または屋号）").fill("やり直し社");
  await page.getByLabel("利用規約とプライバシーポリシーに同意します").check();
  await page.getByRole("button", { name: "はじめる" }).click();
  await expect(page).toHaveURL(/\/verify-email/);
  const fresh = pendingToken(email);
  expect(fresh, "リンクが入れ替わっていない").not.toBe(old);
  // 古いリンクはもう使えない
  const r = await api("/api/auth-ext/verify-signup", { token: old });
  expect(r.status).toBe(410);
  // 新しいリンクなら通る
  const ok = await api("/api/auth-ext/verify-signup", { token: fresh });
  expect(ok.status).toBe(201);
});

test("E-CONF-001-A E-CONF-001-C 既に登録が済んだメールで申し込むと 409（ログインか再設定へ）", async () => {
  const u = await signupViaApi("もう居る社");
  const r = await api<{ code: string }>("/api/auth-ext/sign-up", {
    email: u.email,
    password: PW,
    company_name: "もう居る社",
  });
  expect(r.status).toBe(409);
  expect(r.json.code).toBe("E-CONF-001");
});

test("SCR-VERIFY-EMAIL-035 SCR-VERIFY-EMAIL-036 SCR-VERIFY-EMAIL-038 待つ画面に居続けさせない：申し込みが残っていなければその旨と 2 つの行き先を出す", async ({
  page,
}) => {
  const email = uniqEmail();
  await signupPending("消える社", email);
  await admin("delete from kaname_auth.pending_signup where email = $1", [email]);
  await page.goto(`/verify-email?sent=1&email=${encodeURIComponent(email)}`);
  const g = page.locator("[data-state='gone']");
  await expect(g.locator("h1")).toHaveText("この申し込みは残っていません", { timeout: 15_000 });
  await expect(g).toContainText("登録は済んでいません");
  await g.getByRole("link", { name: "もう登録した人はログイン" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goBack();
  await page.getByRole("link", { name: "はじめから登録し直す" }).click();
  await expect(page).toHaveURL(/\/signup$/);
});

test("待つ画面に居続けさせない：もう登録が済んでいたら入る画面へ送る", async ({ page }) => {
  const u = await signupViaApi("もう済んだ社");
  await page.goto(`/verify-email?sent=1&email=${encodeURIComponent(u.email)}`);
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
});
