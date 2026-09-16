// T-U-07 自分のAIと話す。テストの名前に正本の行 ID を持つ（op_gate.py）。自分のAIの返答は Bridge 経由（T-I-01）。ここでは Bridge の有無で変わる状態と、人が押せるものを押す
import { expect, test } from "@playwright/test";
import { bridgeRow, loginAs, noOverflow, signupViaApi } from "../_lib/api";

test("SCR-ONBOARD-INTERVIEW-001 SCR-ONBOARD-INTERVIEW-013 SCR-ONBOARD-INTERVIEW-014 SCR-ONBOARD-INTERVIEW-033 SCR-ONBOARD-INTERVIEW-008 Bridge 未接続：4 幅で横溢れ 0・時点の部品（AI）が無い・「PCをつなぐ」→ /setup/bridge", async ({
  page,
}) => {
  const u = await signupViaApi();
  await loginAs(page, u.token);
  await noOverflow(page, "/onboard/interview");
  await expect(page.locator("[data-state='nb']")).toContainText("先に自分のPCをつないでください", { timeout: 15_000 });
  await expect(page.locator("[data-requires~='ai']")).toHaveCount(0);
  await page.locator("[data-state='nb']").getByRole("link", { name: "PCをつなぐ" }).click();
  await expect(page).toHaveURL(/\/setup\/bridge/);
});
test("SCR-ONBOARD-INTERVIEW-003 SCR-ONBOARD-INTERVIEW-049 SCR-ONBOARD-INTERVIEW-050 SCR-ONBOARD-INTERVIEW-051 SCR-ONBOARD-INTERVIEW-052 SCR-ONBOARD-INTERVIEW-044 SCR-ONBOARD-INTERVIEW-045 最初：つながると最初の質問と選択肢 4 つ＋その他＋あとで。押すと答えとして積まれ「分かったこと」に出る", async ({
  page,
}) => {
  const u = await signupViaApi();
  await loginAs(page, u.token);
  await bridgeRow(u);
  await page.goto("/onboard/interview");
  await expect(page.locator("[data-state='0']")).toBeVisible({ timeout: 15_000 });
  for (const n of ["受託・制作", "店舗・サービス業", "EC・物販", "その他", "その他（自由に書く）", "あとで"]) {
    await expect(page.getByRole("button", { name: n, exact: true })).toBeVisible();
  }
  await page.getByRole("button", { name: "受託・制作", exact: true }).click();
  await expect(page.locator("[data-state='n']")).toContainText("受託・制作");
  await expect(page.getByRole("heading", { name: "分かったこと" }).locator("..").locator("..")).toContainText(
    "受託・制作",
  );
  for (const n of ["店舗・サービス業", "EC・物販", "その他", "その他（自由に書く）", "あとで"]) {
    await page.goto("/onboard/interview");
    await page.getByRole("button", { name: n, exact: true }).click();
    await expect(page.locator("[data-state='n']")).toContainText(n === "その他（自由に書く）" ? "その他" : n);
  }
});
test("SCR-ONBOARD-INTERVIEW-047 SCR-ONBOARD-INTERVIEW-048 SCR-ONBOARD-INTERVIEW-015 SCR-ONBOARD-INTERVIEW-016 SCR-ONBOARD-INTERVIEW-017 SCR-ONBOARD-INTERVIEW-018 SCR-ONBOARD-INTERVIEW-019 自由に書いて送る：全角・空白・記号・NFD・大文字は書いたまま積まれる（会話の文は正規化しない＝人の言葉）。空は送らない", async ({
  page,
}) => {
  const u = await signupViaApi();
  await loginAs(page, u.token);
  await bridgeRow(u);
  await page.goto("/onboard/interview");
  const box = page.getByLabel("ここに書く。声で話しても、資料を投げても構いません");
  await expect(box).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "送る" }).click();
  await expect(page.locator("[data-state='0']")).toBeVisible(); // 空は積まれない
  const text = "ＥＣ‐物販　と ガ゙ー DE Support".normalize("NFD");
  await box.fill(text);
  await page.getByRole("button", { name: "送る" }).click();
  await expect(page.locator("[data-state='n'] li").last()).toContainText("ＥＣ‐物販");
  await expect(page.getByRole("heading", { name: "分かったこと" }).locator("..").locator("..")).toContainText(
    "DE Support",
  );
});
test("SCR-ONBOARD-INTERVIEW-009 SCR-ONBOARD-INTERVIEW-010 SCR-ONBOARD-INTERVIEW-027 SCR-ONBOARD-INTERVIEW-028 SCR-ONBOARD-INTERVIEW-029 SCR-ONBOARD-INTERVIEW-030 手順バーの 1〜4 → それぞれの画面が開く", async ({
  page,
}) => {
  const u = await signupViaApi();
  await loginAs(page, u.token);
  for (const [label, href] of [
    [/PCをつなぐ$/, "/setup/bridge"],
    [/話す$/, "/onboard/interview"],
    [/たたき台$/, "/onboard/draft"],
    [/ログイン情報$/, "/settings/credentials"],
  ] as const) {
    await page.goto("/onboard/interview");
    await page.getByRole("list", { name: "手順" }).getByRole("link", { name: label }).click();
    await expect(page).toHaveURL(new RegExp(href.replace(/\//g, "\\/") + "$"));
  }
});
