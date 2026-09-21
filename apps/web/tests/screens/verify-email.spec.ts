// T-U-02 メールを確認する。テストの名前に正本の行 ID を持つ（op_gate.py）
import { expect, test } from "@playwright/test";
import { lastMailUrl, mailLog, noOverflow, realMailEmail, signupViaApi } from "../_lib/api";

test("SCR-VERIFY-EMAIL-001 SCR-VERIFY-EMAIL-009 SCR-VERIFY-EMAIL-010 SCR-VERIFY-EMAIL-011 SCR-VERIFY-EMAIL-019 状態 送信済み：4 幅で横溢れ 0・宛先が出る・「もう一度送る」で送った旨が出る（入力欄は無い＝表記ゆらぎは該当なし）", async ({
  page,
}) => {
  const u = await signupViaApi();
  await noOverflow(page, `/verify-email?sent=1&email=${encodeURIComponent(u.email)}`);
  await expect(page.locator("[data-state='n'] h1")).toHaveText("メールを確認してください");
  await expect(page.locator("[data-state='n']")).toContainText(u.email);
  await expect(page.locator("[data-requires]")).toHaveCount(0);
  await expect(page.locator("input, textarea")).toHaveCount(0);
  await page.getByRole("button", { name: "もう一度送る" }).click();
  await expect(page.getByRole("status")).toContainText("もう一度送りました");
});
test("SCR-VERIFY-EMAIL-008 SCR-VERIFY-EMAIL-020 リンク「入力し直す」→ /signup が開く", async ({ page }) => {
  await page.goto(`/verify-email?sent=1&email=x%40example.com`);
  await page.getByRole("link", { name: "入力し直す" }).click();
  await expect(page).toHaveURL(/\/signup$/);
  await expect(page.locator("h1")).toHaveText("アカウントを作る");
});
test("SCR-VERIFY-EMAIL-006 SCR-VERIFY-EMAIL-007 SCR-VERIFY-EMAIL-018 主アクション「はじめの設定をはじめる」→ /setup/bridge が開く（メールの確認はあとからでもできる）", async ({
  page,
}) => {
  const u = await signupViaApi();
  await page.addInitScript((t) => window.localStorage.setItem("kaname.token", t), u.token);
  await page.goto(`/verify-email?sent=1&email=${encodeURIComponent(u.email)}`);
  await page.getByRole("link", { name: "はじめの設定をはじめる", exact: true }).click();
  await expect(page).toHaveURL(/\/setup\/bridge/);
  await expect(page.locator("h1")).toContainText("PC");
});
test("SCR-VERIFY-EMAIL-003 SCR-VERIFY-EMAIL-022 E-AUTH-003-A E-AUTH-003-C 期限切れ・壊れたリンクは状態 x：文言と「新しいリンクを送る」の一手。押すと送った旨（宛先が無いときは確かめる文言）", async ({
  page,
}) => {
  await page.goto("/verify-email?token=broken-token");
  await expect(page.locator("[data-state='x'] h1")).toHaveText("リンクの期限が切れています");
  await expect(page.locator("[data-state='x']")).toContainText("古いリンクはもう使えません");
  await page.getByRole("button", { name: "新しいリンクを送る" }).click();
  await expect(page.getByRole("status")).toBeVisible();
});
test("SCR-VERIFY-EMAIL-002 SCR-VERIFY-EMAIL-021 E-AUTH-003-B 届いたリンク（24 時間以内）で 確認できた（ok）→「はじめの設定をはじめる（PCをつなぐ）」→ /setup/bridge", async ({
  page,
}) => {
  const u = await signupViaApi();
  const url = lastMailUrl("verify", u.email);
  test.skip(!url, "KANAME_API_LOG が無い（開発ではメールの URL を API のログから読む）");
  await page.goto(new URL(url!).pathname + new URL(url!).search);
  await expect(page.locator("[data-state='ok'] h1")).toHaveText("確認できました", { timeout: 15_000 });
  await page.getByRole("link", { name: /はじめの設定をはじめる（PCをつなぐ）/ }).click();
  await expect(page).toHaveURL(/\/setup\/bridge/);
});

// メール（関門 C6）。dev は Resend の鍵が入っていれば実際に飛ぶ。飛んだ／飛ばなかったは API のログに残る
test("SCR-VERIFY-EMAIL-024 送る操作をすると実際に送られ、API のログに「送った」が残る（黙って落ちない）", async ({
  page,
}) => {
  // この行だけ抑止しない宛先を使う
  const u = await signupViaApi("QA 社", realMailEmail());
  await page.goto(`/verify-email?sent=1&email=${encodeURIComponent(u.email)}`);
  await page.getByRole("button", { name: "もう一度送る" }).click();
  await expect(page.getByRole("status")).toContainText("もう一度送りました");
  const sent = mailLog(u.email);
  expect(sent.failed, `送れなかった: ${sent.failed}`).toBe("");
  expect(sent.sent || lastMailUrl("verify", u.email), "ログに送った記録が無い").toBeTruthy();
});
test("SCR-VERIFY-EMAIL-027 届かないときに詰まらない：宛先が受け取れなくても画面は進み、再送で回復できる（登録の有無は漏らさない）", async ({
  page,
}) => {
  await page.goto("/verify-email?sent=1&email=bounce%40example.invalid");
  await page.getByRole("button", { name: "もう一度送る" }).click();
  await expect(page.getByRole("status")).toBeVisible(); // 送れても送れなくても、次の一手（再送）が残る
  await expect(page.locator("[data-state='n']")).toContainText("bounce@example.invalid");
});
