// QA 担当 B：共通の枠（T-US-01）の上の帯の操作を実ブラウザで確かめる。テストの名前に正本の行 ID を持つ。
// K-367：前の「PC をつなぐ」画面（T-U-09）を消したので、その画面を開いていた 20 本（BRG-02-001・SCR-BRIDGE-SETUP-059〜062・070・072・
//   080・081・089〜092・096〜104・107〜109 ほか）を消した。行は置き換え先の行 ID つきの BLOCKED（07_qa/test-specs/screens/bridge-setup.md・
//   07_qa/test-specs/ops/bridge-setup.json の行の表）。残すのは前の画面を開かない 2 本だけ（前の画面が在っても無くても通る）。
//   この版は K-356 と K-367 の両方が carry で運ぶ（どちらが先に本線に入っても通る）。
// 本人の本物の Bridge は止めない（hideRealBridge）。
import { expect, test } from "@playwright/test";
import { hideRealBridge, loginAs, setupStep, signupViaApi } from "../_lib/api";

// ---- 共通の枠（T-US-01）の上の帯。アプリの枠の見本（/dev/shell）で、時点（ps）ごとに出る操作を押す
test("USH-01-055 上の帯の「高本AI」を押すと自分のAIのパネルが開き、もう一度押すと閉じる", async ({ page }) => {
  await hideRealBridge(page);
  const u = await signupViaApi();
  await setupStep(u.memberId, 6);
  await loginAs(page, u.token);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/dev/shell?screen=goals&role=R1&ps=PS3");
  const btn = page.locator(".topbar button.ap-toggle");
  await expect(btn).toBeVisible({ timeout: 15_000 });
  await expect(btn).toContainText("高本AI");
  const panel = page.locator("aside.aipanel");
  const was = (await btn.getAttribute("aria-pressed")) === "true";
  await btn.click();
  await expect(btn).toHaveAttribute("aria-pressed", String(!was));
  const isOn = () => panel.evaluate((e) => e.classList.contains("on"));
  await expect.poll(isOn, { message: "パネルの開閉が押した通りになる" }).toBe(!was);
  await btn.click();
  await expect(btn).toHaveAttribute("aria-pressed", String(was));
  await expect.poll(isOn).toBe(was);
});

test("USH-01-057 AI がまだ無い時点（PS0）の上の帯の「PC をつなぐと話せます」を押すと 自分のPCをつなぐ が開く（200・h1）", async ({
  page,
}) => {
  await hideRealBridge(page);
  const u = await signupViaApi();
  await setupStep(u.memberId, 6);
  await loginAs(page, u.token);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/dev/shell?screen=goals&role=R1&ps=PS0");
  const link = page.getByRole("link", { name: "PC をつなぐと話せます" });
  await expect(link).toBeVisible({ timeout: 15_000 });
  await expect(link).toHaveAttribute("href", "/setup/bridge");
  await link.click();
  await expect(page).toHaveURL(/\/setup\/bridge$/, { timeout: 15_000 });
  // /setup/bridge は K-57 の新しい画面（D-128.150）
  await expect(page.getByRole("heading", { level: 1, name: /^(PC と使った量|PC をつなぐ)$/ })).toBeVisible({
    timeout: 15_000,
  });
  expect((await page.request.get(page.url())).status(), "実在ルート（200）").toBe(200);
});
