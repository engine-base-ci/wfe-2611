// D-128.150：前の「PC をつなぐ」画面（/setup/bridge/legacy）の試験。消さずに残し、K-89・K-90・K-91 がこの画面と試験を使う。接続コードの口は K-57 の契約の口に替えた
// T-U-09 自分のPCをつなぐ。テストの名前に正本の行 ID を持つ（op_gate.py）。Bridge の行は前提として DB に置く（claim の実体は T-I-02）
import { expect, test } from "@playwright/test";
import { admin, bridgeRow, loginAs, noOverflow, realBridge, signupViaApi, setupStep } from "../_lib/api";
import { fakeBridge } from "../_lib/fake-bridge";

// 「つながりました」はサーバーの記録だけでは言わない（G-12・D-089.10）。この PC の口が答えて初めて ok。
// だから「つながった」を作るときは偽の Bridge を立て、「この PC には居ない」を作るときは本物を止める
test.beforeAll(() => realBridge(false));
test.beforeEach(() => realBridge(false));
test.afterAll(() => realBridge(true));

test("SCR-BRIDGE-SETUP-001 SCR-BRIDGE-SETUP-016 SCR-BRIDGE-SETUP-017 SCR-BRIDGE-SETUP-007 SCR-BRIDGE-SETUP-032 SCR-BRIDGE-SETUP-003 SCR-BRIDGE-SETUP-044 E-CONN-001-A E-CONN-001-C 接続中：4 幅で横溢れ 0・接続コード（英数字 6 けた・K-57）が出る・「接続を確かめる」→ つながらない（文言と一手＝もう一度確かめる）", async ({
  page,
}) => {
  const u = await signupViaApi();
  await loginAs(page, u.token);
  await noOverflow(page, "/setup/bridge/legacy");
  await expect(page.locator("h1")).toHaveText("自分のPCをつなぐ");
  await expect(page.locator("[data-state='n']")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("[data-requires='data']")).toHaveCount(0);
  await expect(page.locator("[data-pair-code]")).toHaveText(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/, {
    timeout: 15_000,
  });
  await page.getByRole("button", { name: "接続を確かめる" }).click();
  await expect(page.locator("[data-state='ng']")).toContainText("つながっていません");
  await expect(page.locator("[data-state='ng']")).toContainText("まだつながっていません");
  await page.getByRole("button", { name: /接続を確かめる|確かめています/ }).click();
  await expect(page.locator("[data-state='ng']")).toBeVisible();
});
test("SCR-BRIDGE-SETUP-002 SCR-BRIDGE-SETUP-043 E-CONN-001-B E-TO-003-B つながった：Bridge の行があれば ok（端末・登録・最後の応答）→「自分のAIと話すへ」→ /onboard/interview", async ({
  page,
}) => {
  const u = await signupViaApi();
  await loginAs(page, u.token);
  await bridgeRow(u);
  const srv = await fakeBridge(async () => true); // この PC の口が答える＝本当に「つながった」
  try {
    await page.goto("/setup/bridge/legacy");
    await expect(page.locator("[data-state='ok']")).toContainText("つながりました", { timeout: 15_000 });
    await expect(page.locator("[data-state='ok']")).toContainText("MacBook Pro（QA）");
    await page.getByRole("link", { name: "自分のAIと話すへ" }).click();
    await expect(page).toHaveURL(/\/onboard\/interview/, { timeout: 15_000 });
  } finally {
    srv.close();
  }
});
test("E-TO-003-A E-TO-003-C 終了直後（0〜90 秒）：Bridge の行を失効させた直後に確かめると、つながらない側に落ちて「もう一度確かめる」の一手が出る（鮮度窓の内側で「接続中」のまま残さない）", async ({
  page,
}) => {
  const u = await signupViaApi();
  await loginAs(page, u.token);
  await bridgeRow(u);
  await page.goto("/setup/bridge/legacy");
  // 記録はあるが、この PC の口は答えない ＝「この PC では動いていません」（ok とは言わない・G-12）
  await expect(page.locator("[data-state='other']")).toBeVisible({ timeout: 15_000 });
  await admin("update sessions set revoked_at = now() where tenant_id = $1 and kind_id = 'bridge'", [u.tenantId]);
  await page.reload();
  await expect(page.locator("[data-state='n']")).toBeVisible({ timeout: 15_000 });
  // 確かめるボタンは 1 つ（押しても何も起きない、にならないよう「確かめています」に変わる）
  await page.getByRole("button", { name: /接続を確かめる|確かめています/ }).click();
  await expect(page.locator("[data-state='ng']")).toContainText("まだつながっていません");
  await expect(page.locator("[data-watching]"), "見に行った結果を言う").toContainText("見つかりません");
});
test("SCR-BRIDGE-SETUP-033 SCR-BRIDGE-SETUP-034 SCR-BRIDGE-SETUP-035 SCR-BRIDGE-SETUP-036 SCR-BRIDGE-SETUP-048 SCR-BRIDGE-SETUP-049 SCR-BRIDGE-SETUP-050 SCR-BRIDGE-SETUP-051 手順バーの 1〜4 → それぞれの画面が開く（はじめの設定は飛ばせないので「あとでやる」は無い・D-089）", async ({
  page,
}) => {
  const u = await signupViaApi();
  await setupStep(u.memberId, 3); // 段 4（ログイン情報）が今の段＝開ける（D-089）
  await loginAs(page, u.token);
  await page.goto("/setup/bridge/legacy");
  await expect(page.locator("[data-state='n']")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("link", { name: /あとでやる/ })).toHaveCount(0);
  for (const [label, href] of [
    [/PCをつなぐ$/, "/setup/bridge"],
    [/話す$/, "/onboard/interview"],
    [/たたき台$/, "/onboard/draft"],
    [/ログイン情報$/, "/settings/credentials"],
  ] as const) {
    await page.goto("/setup/bridge/legacy");
    await page.getByRole("list", { name: "手順" }).getByRole("link", { name: label }).click();
    await expect(page).toHaveURL(new RegExp(href.replace(/\//g, "\\/") + "$"));
  }
});
