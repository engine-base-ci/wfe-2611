// T-U-10 ログイン情報を預ける。テストの名前に正本の行 ID を持つ（op_gate.py）。平文は関門 C8 の先＝DB には vault_ref だけ
import { expect, test } from "@playwright/test";
import { admin, loginAs, noOverflow, pwToggle, signupViaApi, setupDone } from "../_lib/api";

test("SCR-CREDENTIALS-005 SCR-CREDENTIALS-017 SCR-CREDENTIALS-018 SCR-CREDENTIALS-002 SCR-CREDENTIALS-003 SCR-CREDENTIALS-001 SCR-CREDENTIALS-008 SCR-CREDENTIALS-033 SCR-CREDENTIALS-040 SCR-CREDENTIALS-041 SCR-CREDENTIALS-043 SCR-CREDENTIALS-044 SCR-CREDENTIALS-045 SCR-CREDENTIALS-019 SCR-CREDENTIALS-020 E-DATA-001-B E-GATE-003-B E-VAL-003-B E-SEC-001-B E-SEC-002-B E-SEC-003-B 空 → 追加する → サービス（全角・空白入り）→ 入力 3 つ → 保存する → 預けたものに並ぶ。DB は vault_ref だけで平文は無い", async ({
  page,
}) => {
  const u = await signupViaApi();
  await setupDone(u); // はじめの設定を通し終わった人（D-089）
  await loginAs(page, u.token);
  await noOverflow(page, "/settings/credentials");
  await expect(page.locator("h1")).toHaveText("ログイン情報を預ける");
  await expect(page.locator("[data-state='ge']")).toContainText("まだ資格情報がありません", { timeout: 15_000 });
  await expect(page.locator("[data-requires='data']")).toHaveCount(0);
  await page.getByRole("button", { name: "追加する" }).click();
  await expect(page.locator("[data-state='a']")).toBeVisible();
  await page.getByLabel("サービス").fill("　発注ナビ　（ＭＦ）");
  await page.getByRole("button", { name: "ログイン情報を入れる" }).click();
  await expect(page.locator("[data-state='i']")).toContainText("発注ナビ (MF) のログイン情報");
  await page.getByLabel("メールアドレス（ログイン名）").fill("me@example.com");
  await page.getByLabel("パスワード", { exact: true }).fill("S3cret-Plain!");
  await page.locator("[data-two-factor]").selectOption("totp");
  await page.getByLabel("認証アプリの秘密鍵").fill("JBSW Y3DP EHPK 3PXP");
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page.locator("[data-state='n']")).toContainText("発注ナビ (MF)", { timeout: 15_000 });
  await expect(page.locator("[data-state='n']")).toContainText("預かり先の番号");
  await expect(page.locator("[data-state='n']"), "台帳に無いサービスは規約に記載なし").toContainText("規約に記載なし");
  // 読み直しても出る（画面の中だけで持たない・D-108.3）
  await page.reload();
  await expect(page.locator("[data-state='n']")).toContainText("発注ナビ (MF)", { timeout: 15_000 });
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
  await page.locator("[data-state='n']").getByRole("button", { name: "追加する" }).click();
  await expect(page.locator("[data-state='a']")).toBeVisible();
});
test("SCR-CREDENTIALS-046 SCR-CREDENTIALS-021 SCR-CREDENTIALS-022 SCR-CREDENTIALS-023 E-VAL-003-A E-VAL-003-C やめる で戻れる・空のサービス名は文言・2 段階の鍵が Base32 でない（記号・NFD・小文字）は文言と一手", async ({
  page,
}) => {
  const u = await signupViaApi();
  await setupDone(u); // はじめの設定を通し終わった人（D-089）
  await loginAs(page, u.token);
  await page.goto("/settings/credentials");
  await page.getByRole("button", { name: "追加する" }).click();
  await expect(page.getByLabel("サービス"), "追加する で入力欄へ").toBeFocused();
  await page.getByRole("button", { name: "ログイン情報を入れる" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("サービス名を入れてください");
  await expect(page.locator("[data-state='ge']")).toBeVisible();
  await page.getByLabel("サービス").fill("テスト社");
  await page.getByRole("button", { name: "ログイン情報を入れる" }).click();
  await page.getByLabel("メールアドレス（ログイン名）").fill("me@example.com");
  await page.getByLabel("パスワード", { exact: true }).fill("S3cret-Plain!");
  await page.locator("[data-two-factor]").selectOption("totp");
  await page.getByLabel("認証アプリの秘密鍵").fill("jbsw‐y3dp!!ガ゙");
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page.locator("p[role=alert]")).toBeVisible();
  await page.locator("[data-two-factor]").selectOption("totp");
  await page.getByLabel("認証アプリの秘密鍵").fill("jbsw y3dp ehpk 3pxp"); // 小文字と空白は直して通す
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page.locator("[data-state='n']")).toContainText("テスト社", { timeout: 15_000 });
  await page.locator("[data-state='n']").getByRole("button", { name: "追加する" }).click();
  await page.getByLabel("サービス").fill("やめる社");
  await page.getByRole("button", { name: "ログイン情報を入れる" }).click();
  await page.getByRole("button", { name: "やめる" }).click();
  await expect(page.locator("[data-state='a']")).toBeVisible();
  await expect(page.locator("[data-state='n']")).toBeVisible();
});
test("SCR-CREDENTIALS-034 SCR-CREDENTIALS-035 SCR-CREDENTIALS-036 SCR-CREDENTIALS-037 手順バーの 1〜4 → それぞれの画面が開く", async ({
  page,
}) => {
  const u = await signupViaApi();
  await setupDone(u); // はじめの設定を通し終わった人（D-089）
  await loginAs(page, u.token);
  for (const [label, href] of [
    [/PCをつなぐ$/, "/setup/bridge"],
    [/話す$/, "/onboard/interview"],
    [/たたき台$/, "/onboard/draft"],
    [/ログイン情報$/, "/settings/credentials"],
  ] as const) {
    await page.goto("/settings/credentials");
    await page.getByRole("list", { name: "手順" }).getByRole("link", { name: label }).click();
    await expect(page).toHaveURL(new RegExp(href.replace(/\//g, "\\/") + "$"));
  }
});

test("SCR-CREDENTIALS-048 パスワードは見る・隠すを切り替えられる（既定は隠す・押すと見える・的は 24px 以上）", async ({
  page,
}) => {
  const u = await signupViaApi();
  await setupDone(u); // はじめの設定を通し終わった人（D-089）
  await loginAs(page, u.token);
  await page.goto("/settings/credentials");
  await page.getByRole("button", { name: "追加する" }).click();
  await page.getByLabel("サービス").fill("発注ナビ");
  await page.getByRole("button", { name: "ログイン情報を入れる" }).click();
  await page.getByLabel("パスワード", { exact: true }).fill("S3cret-Plain!");
  await pwToggle(page, "パスワード");
});
