// ログインだけ生きていて会社の人が無い（会社が消えた・登録の途中で壊れた）とき（D-086.4・E-AUTH-007）。
// 由来（2026-09-27）：手元でこの状態になり、「② 話す」でログインへ行かず、「④ ログイン情報」は空白のまま止まった。
import { expect, test } from "@playwright/test";
import { PW, admin, loginAs, signupViaApi } from "../_lib/api";

const gone = (memberId: string) => admin("update members set deleted_at = now() where id = $1", [memberId]);

test("USH-00-031 ログインは生きているが会社の人が無い人は、ログイン情報・自分のAIと話す のどちらを開いても空白で止まらずログインへ送られ、手元の鍵は捨てられる", async ({
  page,
}) => {
  const u = await signupViaApi();
  await loginAs(page, u.token);
  await gone(u.memberId);
  for (const path of ["/settings/credentials", "/onboard/interview"]) {
    await page.goto(path);
    await expect(page, `${path} は空白で止まらない`).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path).replace(/%/g, "%")}`), { timeout: 15_000 });
    await expect(page.getByRole("button", { name: "ログイン" })).toBeVisible();
  }
});

test("E-AUTH-007-A E-AUTH-007-C 会社の人が無いアカウントでログインすると、理由と次の一手が出て、入ったことにならない", async ({ page }) => {
  const u = await signupViaApi();
  await gone(u.memberId);
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill(u.email);
  await page.getByLabel("パスワード", { exact: true }).fill(PW);
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page.getByText("会社の登録が見つからないため使えません")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("もう一度アカウントを作るか、運営に連絡してください")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
  expect(await page.evaluate(() => window.localStorage.getItem("kaname.token")), "鍵を持たせない").toBeFalsy();
});
