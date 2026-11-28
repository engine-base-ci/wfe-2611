// ログインはターミナルを開かずに終わる（D-091.3）。本物の Bridge に始めさせて、入口とコード欄が出ることを見る。
// 承認そのものは本人がブラウザで 1 回やるので自動化しない。始めたログインは必ず止めて戻す（G-10）。
import { expect, test } from "@playwright/test";
import { claimBridge, loginAs, setupStep, signupViaApi } from "../_lib/api";

const LOCAL = "http://127.0.0.1:38617";
const head = { origin: "http://127.0.0.1:3124" };
const ask = async (path: string, init?: RequestInit): Promise<Response | null> => {
  try {
    return await fetch(`${LOCAL}${path}`, { headers: head, signal: AbortSignal.timeout(30_000), ...init });
  } catch {
    return null;
  }
};

test("SCR-BRIDGE-SETUP-085 SCR-BRIDGE-SETUP-086 ログインしていないときだけ「ログインする」が出て、押すと入口とコード欄が出る", async ({
  page,
}) => {
  const ping = await ask("/ping");
  test.skip(!ping?.ok, "この PC で Bridge が動いていないので確かめられない（BLOCKED）");
  const checks = (await (await ask("/check"))!.json()) as { checks: { name: string; fix?: string | null }[] };
  const login = checks.checks.find((c) => c.fix === "login");
  test.skip(!login, "この PC は既にログイン済み（未ログインの状態を作れない）");

  const u = await signupViaApi();
  await claimBridge(u.token, "この PC");
  await setupStep(u.memberId, 1);
  await loginAs(page, u.token);
  await page.goto("/setup/bridge");

  // 直し方が login のときは「入れる」を出さない（同じ文言を出さない・SCR-086）
  await expect(page.locator("[data-login-claude]")).toBeVisible();
  await expect(page.locator("[data-install-claude]")).toHaveCount(0);
  try {
    await page.locator("[data-login-claude]").click();
    const step = page.locator("[data-login-step]");
    await expect(step).toBeVisible({ timeout: 40_000 });
    await expect(step.getByRole("link", { name: "この入口" })).toHaveAttribute("href", /^https:\/\//);
    await expect(step.getByLabel("ブラウザに出たコード")).toBeVisible();
  } finally {
    await ask("/login-cancel", { method: "POST" }); // 始めたログインは止めて戻す
  }
});
