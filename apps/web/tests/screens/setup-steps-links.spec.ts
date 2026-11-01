// はじめの設定の段の帯：5 テスト（T-U-11）と 6 本番へ（T-U-12）ができたので、通し終えた人には各画面から 5・6 がリンクで開く（G-04・D-116.2）。
//   行は各画面のもの（bridge-setup・credentials・onboard-draft・onboard-interview・onboard-testrun・onboard-golive）。6 ができて自動の BLOCKED が外れた分
import { expect, test } from "@playwright/test";
import { bridgeRow, loginAs, setupStep, signupViaApi } from "../_lib/api";

test("SCR-BRIDGE-SETUP-093 SCR-BRIDGE-SETUP-094 SCR-CREDENTIALS-038 SCR-CREDENTIALS-039 SCR-ONBOARD-DRAFT-030 SCR-ONBOARD-DRAFT-031 SCR-ONBOARD-INTERVIEW-059 SCR-ONBOARD-INTERVIEW-060 SCR-ONBOARD-TESTRUN-010 SCR-ONBOARD-TESTRUN-027 SCR-ONBOARD-GOLIVE-027 通し終えた人：どの段の画面からも「5. テスト」「6. 本番へ」がリンクで、実在ルート（200）で開く", async ({
  page,
}) => {
  const u = await signupViaApi();
  await bridgeRow(u);
  await setupStep(u.memberId, 6);
  await loginAs(page, u.token);
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const from of [
    "/setup/bridge",
    "/settings/credentials",
    "/onboard/draft",
    "/onboard/interview",
    "/onboard/testrun",
    "/onboard/golive",
  ]) {
    for (const [label, re, h1] of [
      ["5. テスト", /\/onboard\/testrun$/, "テストで動かす"],
      ["6. 本番へ", /\/onboard\/golive$/, "本番に切り替える"],
    ] as const) {
      await page.goto(from);
      const bar = page.getByRole("list", { name: "手順" });
      await expect(bar).toBeVisible({ timeout: 20_000 });
      await bar.getByRole("link", { name: new RegExp(`^(（済）)?${label}$`) }).click();
      await expect(page, `${from} → ${label}`).toHaveURL(re, { timeout: 15_000 });
      await expect(page.locator("h1").first()).toHaveText(h1, { timeout: 15_000 });
      expect((await page.request.get(page.url())).status(), "実在ルート（200）").toBe(200);
    }
  }
});

test("SCR-ONBOARD-TESTRUN-029 5 テスト の帯「本番に切り替える」は、AI社員がいない人には押せず理由が出る（届く先は 6 本番へ・T-U-12）", async ({
  page,
}) => {
  const u = await signupViaApi();
  await setupStep(u.memberId, 4);
  await loginAs(page, u.token);
  await page.goto("/onboard/testrun");
  const go = page.locator("[data-wiz-next-go]");
  await expect(go).toHaveText(/本番に切り替える/, { timeout: 20_000 });
  await expect(go).toBeDisabled();
  await expect(page.locator("[data-wiz-next-note]")).toContainText("たたき台に AI社員がいると試せます");
});
