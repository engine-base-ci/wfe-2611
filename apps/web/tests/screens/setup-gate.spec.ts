// はじめの設定（1〜6）は飛ばせない・毎回その段へ戻す（D-089）。テストの名前に正本の行 ID を持つ（op_gate.py）
import { existsSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { admin, bridgeRow, loginAs, realBridge, signupViaApi } from "../_lib/api";

// 偽の Bridge で演じるので、この PC の本物は止めておく（港と「入っている」判定がぶつかる）
test.beforeAll(() => realBridge(false));
// 「起こす」を試すと kaname-bridge:// で本物が立ち上がる。次のテストに持ち越さない（G-10）
test.beforeEach(() => realBridge(false));

/** 「この PC に Bridge が入っていない人」を演じるテストは、本当に入っている PC では作れない。
 *  起こす（kaname-bridge://）を押すと本物が立ち上がってしまうため。黙って通さず、理由つきで止める */
const BRIDGE_APP = "/Applications/Kaname Bridge.app";
const needsNoBridge = (): void => {
  test.skip(
    existsSync(BRIDGE_APP),
    "この PC には Bridge が入っているので「入っていない人」を作れない（BLOCKED：入っていない PC か staging で流す）",
  );
};

test.afterAll(() => realBridge(true));

const step = (memberId: string) =>
  admin<{ setup_step: number }>("select setup_step from members where id = $1", [memberId]).then(
    (r) => r[0]!.setup_step,
  );
const markStep = (memberId: string, n: number) =>
  admin("select app.setup_step_done($1, $2::smallint)", [memberId, n]);

test("USH-00-017 はじめの設定を 1 つも通していない人は、ログインすると 自分のPCをつなぐ（段 1）へ送られる", async ({
  page,
}) => {
  const u = await signupViaApi();
  expect(await step(u.memberId), "登録直後は 0").toBe(0);
  await loginAs(page, u.token);
  await page.goto("/");
  await expect(page).toHaveURL(/\/setup\/bridge$/, { timeout: 15_000 });
  await expect(page.locator("h1")).toHaveText("自分のPCをつなぐ");
  // 飛ばす出口（あとでやる）は出さない
  await expect(page.getByRole("button", { name: /あとでやる/ })).toHaveCount(0);
});

test("USH-00-018 USH-00-022 途中まで通した人は次にやる段へ送られる・手順バーに済が出る", async ({ page }) => {
  const u = await signupViaApi();
  await bridgeRow(u);
  await markStep(u.memberId, 1);
  await loginAs(page, u.token);
  await page.goto("/");
  await expect(page).toHaveURL(/\/onboard\/interview$/, { timeout: 15_000 });
  await expect(page.getByRole("link", { name: "（済）1. PCをつなぐ" })).toBeVisible();
});

test("USH-00-019 通していない人が先の段の画面を直接開くと、今の段へ戻される", async ({ page }) => {
  const u = await signupViaApi();
  await bridgeRow(u);
  await markStep(u.memberId, 1);
  await loginAs(page, u.token);
  await page.goto("/settings/credentials"); // 段 4
  await expect(page).toHaveURL(/\/onboard\/interview$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "ログイン情報を預ける" })).toHaveCount(0);
});

test("USH-00-020 いま開いている画面がその段そのものなら通す", async ({ page }) => {
  const u = await signupViaApi();
  await bridgeRow(u);
  await markStep(u.memberId, 3);
  await loginAs(page, u.token);
  await page.goto("/settings/credentials"); // 段 4＝次にやる段
  await expect(page.locator("h1")).toHaveText("ログイン情報を預ける", { timeout: 15_000 });
});

test("USH-00-021 進み具合は戻らない（前の段を開き直しても記録は下がらない）", async ({ page }) => {
  const u = await signupViaApi();
  await bridgeRow(u);
  await markStep(u.memberId, 3);
  await loginAs(page, u.token);
  await page.goto("/onboard/interview"); // 段 2 を開き直す
  await expect(page.locator("h1")).toHaveText("自分のAIと話す", { timeout: 15_000 });
  await markStep(u.memberId, 2); // 小さい値で上書きしようとしても
  expect(await step(u.memberId), "小さい値では下がらない").toBe(3);
});

// 「自分のPCをつなぐ」は どこで開いているか で 3 つに分かれる（D-089.8）。
// ダウンロード＝インストール動線なので、入れてある人・アプリの中の人には出さない。
// Bridge の代わりは、この PC の中だけで開く口を 1 つ立てて演じる（本物と同じ ping / pair を返す）。
import { fakeBridge, LOCAL_PORT, ORIGIN } from "../_lib/fake-bridge";

test("USH-00-023 SCR-BRIDGE-SETUP-047 ブラウザで Bridge が入っていない人には、ダウンロード（インストール動線）と手順 1〜4 が出る", async ({
  page,
}) => {
  needsNoBridge();
  const u = await signupViaApi();
  await loginAs(page, u.token);
  await page.goto("/setup/bridge");
  await expect(page.locator('[data-where="web"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("[data-install-lead]")).toBeVisible();
  await expect(page.locator("[data-connect-here]")).toHaveCount(0);
});

test("USH-00-030 SCR-BRIDGE-SETUP-057 ブラウザで Bridge が動いている人には、ダウンロードもコードも出さず、押さずにつながる", async ({
  page,
}) => {
  const u = await signupViaApi();
  let paired = "";
  const srv = await fakeBridge(async (code) => {
    paired = code;
    await bridgeRow(u); // Bridge が claim したのと同じ状態を作る
    await markStep(u.memberId, 1);
    return true;
  });
  try {
    await loginAs(page, u.token);
    await page.goto("/setup/bridge");
    // 人は何も押さない。この PC に Bridge が居ると分かった時点でつながる（D-089.10）
    await expect(page.locator("[data-state='ok']")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("[data-install-lead]"), "入れる案内は出さない").toHaveCount(0);
    await expect(page.locator("[data-pair-code]"), "コードも見せない").toHaveCount(0);
    expect(paired, "画面が持っている接続コードをそのまま Bridge に渡す").toMatch(/^KNM-\d{4}$/);
  } finally {
    srv.close();
  }
});

test("USH-00-025 SCR-BRIDGE-SETUP-058 アプリ（Bridge の窓）の中で開いた人は、入れる作業も接続コードも要らず自動でつながる", async ({
  browser,
}) => {
  const u = await signupViaApi();
  const srv = await fakeBridge(async () => {
    await bridgeRow(u);
    await markStep(u.memberId, 1);
    return true;
  });
  // Bridge の窓は UA に印を付ける。画面はそれで「アプリの中」と判る
  const ctx = await browser.newContext({ userAgent: "Mozilla/5.0 KanameBridge/0.0.0-test" });
  const page = await ctx.newPage();
  try {
    await loginAs(page, u.token);
    await page.goto("/setup/bridge");
    await expect(page.locator("[data-state='ok']"), "押さずにつながる").toBeVisible({ timeout: 20_000 });
    await expect(page.locator("[data-install-lead]"), "入れる作業は要らない").toHaveCount(0);
    await expect(page.locator("[data-pair-code]"), "接続コードも要らない").toHaveCount(0);
    await page.getByRole("link", { name: "自分のAIと話すへ" }).click(); // アプリの中でも次へ進める
    await expect(page).toHaveURL(/\/onboard\/interview/, { timeout: 15_000 });
  } finally {
    await ctx.close();
    srv.close();
  }
});

test("USH-00-026 Bridge のこの PC の口は、許可した出どころ以外には応えない（居ることも教えない）", async ({
  request,
}) => {
  const srv = await fakeBridge(async () => true);
  try {
    const ng = await request.get(`http://127.0.0.1:${LOCAL_PORT}/ping`, { headers: { Origin: "https://evil.example" } });
    expect(ng.status(), "知らない出どころには 403").toBe(403);
    const ok = await request.get(`http://127.0.0.1:${LOCAL_PORT}/ping`, { headers: { Origin: ORIGIN } });
    expect(ok.status()).toBe(200);
  } finally {
    srv.close();
  }
});

// Claude Code は Bridge が入れる（D-091）。人はボタンを押すだけで、ターミナルを触らない
test("BRG-CC-001 この PC に Claude Code が無いときだけ「入れる」が出る（入っていれば出さない）", async ({ page }) => {
  const u = await signupViaApi();
  const srv = await fakeBridge(async () => true, { claudeOk: true });
  try {
    await loginAs(page, u.token);
    await page.goto("/setup/bridge");
    await expect(page.locator('[data-where="installed"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("[data-need-claude]"), "入っていれば出さない").toHaveCount(0);
  } finally {
    srv.close();
  }
});

test("BRG-CC-002 BRG-CC-005 押すと Bridge が入れ、終わると出なくなる。ログインは本人が承認する", async ({ page }) => {
  const u = await signupViaApi();
  let installed = 0;
  let login = 0;
  const srv = await fakeBridge(async () => true, {
    claudeOk: false,
    loggedIn: false,
    onInstall: () => installed++,
    onLogin: () => login++,
  });
  try {
    await loginAs(page, u.token);
    await page.goto("/setup/bridge");
    const box = page.locator("[data-need-claude]");
    await expect(box, "無いときは理由が出る").toContainText("Claude Code がありません", { timeout: 15_000 });
    // 足りないものだけを出す。入れる前にログインを出しても押せない（D-091.5）
    await expect(page.locator("[data-login-claude]"), "入れる前はログインを出さない").toHaveCount(0);
    await page.locator("[data-install-claude]").click();
    expect(installed, "入れるのは Bridge（画面は頼むだけ）").toBe(1);
    await expect(page.locator("[data-install-msg]")).toContainText("入りました");
    // 入った後はログインが残る。ターミナルは開かず、入口とコード欄をこの画面に出す
    await page.locator("[data-login-claude]").click();
    expect(login, "ログインを頼むのは 1 回").toBe(1);
    const step = page.locator("[data-login-step]");
    await expect(step).toBeVisible();
    await expect(step.getByRole("link", { name: "この入口" })).toHaveAttribute("href", /^https:\/\//);
    await step.getByLabel("ブラウザに出たコード").fill("test-code");
    await step.getByRole("button", { name: "決定" }).click();
    await expect(page.locator("[data-install-msg]")).toContainText("ログインできました");
    await expect(box, "全部そろったら出さない").toHaveCount(0);
  } finally {
    srv.close();
  }
});

test("BRG-CC-006 入れる口は、許可した出どころ以外には応えない（居ることも教えない）", async ({ request }) => {
  const srv = await fakeBridge(async () => true, { claudeOk: false });
  try {
    const ng = await request.post(`http://127.0.0.1:${LOCAL_PORT}/install-claude`, {
      headers: { Origin: "https://evil.example" },
    });
    expect(ng.status(), "知らない出どころには 403").toBe(403);
    const ok = await request.get(`http://127.0.0.1:${LOCAL_PORT}/check`, { headers: { Origin: ORIGIN } });
    expect(ok.status()).toBe(200);
  } finally {
    srv.close();
  }
});

test("BRG-03-024 画面を開いたまま Bridge を起動すると、人が押さなくても自分で気づいてつながる", async ({ page }) => {
  const u = await signupViaApi();
  await loginAs(page, u.token);
  await page.goto("/setup/bridge");
  // まだ Bridge は動いていない：やることが 1 つ出ているだけ
  await expect(page.locator('[data-where="web"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("[data-state='ok']")).toHaveCount(0);
  // ここで Bridge を起動する（画面には触らない）
  const srv = await fakeBridge(async () => {
    await bridgeRow(u);
    await markStep(u.memberId, 1);
    return true;
  });
  try {
    await expect(page.locator("[data-state='ok']"), "押さずにつながる（数秒ごとに見ている）").toBeVisible({
      timeout: 25_000,
    });
  } finally {
    srv.close();
  }
});

test("E-CONN-011-A E-CONN-011-B E-CONN-011-C 入ってはいるが本体が落ちてきていないときは「取り直す」と言う（無いときと同じ文言を出さない）", async ({
  page,
}) => {
  const u = await signupViaApi();
  const srv = await fakeBridge(async () => true, { claudeOk: false, broken: true, loggedIn: false });
  try {
    await loginAs(page, u.token);
    await page.goto("/setup/bridge");
    const box = page.locator("[data-need-claude]");
    // A 出る：壊れているときは「本体が落ちてきていません」と言い、ボタンは「取り直す」
    await expect(box, "壊れているときの理由").toContainText("本体が落ちてきていません", { timeout: 15_000 });
    await expect(page.locator("[data-install-claude]")).toContainText("取り直す");
    // C 文言と一手：無いときの文言（この PC にありません）を出さない
    await expect(box).not.toContainText("この PC に Claude Code がありません");
  } finally {
    srv.close();
  }
});

test("E-CONN-011-B 入っていれば、取り直しも入れるも出さない（正しい状態で出さない）", async ({ page }) => {
  const u = await signupViaApi();
  const srv = await fakeBridge(async () => {
    await bridgeRow(u); // 画面が自分でつなぐ（D-089.10）。サーバー側にも端末の行を作る
    await markStep(u.memberId, 1);
    return true;
  }, { claudeOk: true, loggedIn: true });
  try {
    await loginAs(page, u.token);
    await page.goto("/setup/bridge");
    await expect(page.locator('[data-state="ok"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("[data-need-claude]"), "揃っていれば何も出さない").toHaveCount(0);
  } finally {
    srv.close();
  }
});

test("CHT-28-001 CHT-28-002 この PC の Bridge が別のアカウントでつながっていたら、黙って切り替えず理由を出し、「このアカウントに切り替える」を押したときだけつなぐ", async ({ page }) => {
  const u = await signupViaApi();
  let paired = 0;
  const srv = await fakeBridge(
    async () => {
      paired++;
      await bridgeRow(u);
      await markStep(u.memberId, 1);
      return true;
    },
    { otherAccount: true },
  );
  try {
    await loginAs(page, u.token);
    await page.goto("/setup/bridge");
    await expect(page.locator("[data-pair-msg]")).toContainText("この PC の Bridge は、すでに別のアカウントでつながっています", { timeout: 20_000 });
    expect(paired, "押すまで切り替えない").toBe(0);
    await page.locator("[data-switch-account]").click();
    await expect(page.locator("[data-state='ok']")).toBeVisible({ timeout: 20_000 });
    expect(paired).toBe(1);
  } finally {
    srv.close();
  }
});
