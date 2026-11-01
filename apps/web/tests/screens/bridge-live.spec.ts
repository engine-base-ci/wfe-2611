// 「つながっています」が嘘をつかないこと（G-12）。本物の Bridge を実際に止めて確かめる。
// 127.0.0.1:38617 への問い合わせを差し替えない ── 差し替えたら、確かめたい当の相手を消すことになる。
import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { bridgeAsleep, claimBridge, loginAs, setupStep, signupViaApi } from "../_lib/api";

const PING = "http://127.0.0.1:38617/ping";
const alive = async (): Promise<boolean> => {
  try {
    const r = await fetch(PING, { headers: { origin: "http://127.0.0.1:3124" }, signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch {
    return false;
  }
};
const app = (cmd: "stop" | "start") =>
  execSync(cmd === "stop" ? 'pkill -f "Kaname Bridge" || true' : 'open -a "/Applications/Kaname Bridge.app"');

test.describe("この PC の Bridge の生き死に", () => {
  test.skip(process.platform !== "darwin", "この PC の Bridge を起動・終了して確かめるので macOS だけ");
  // 本人の Bridge を実際に止めるテスト。止めてよいと明示したときだけ流す（止めると本人の仕事が途中で死ぬ・2026-09-28 実例）
  test.skip(process.env["QA_STOP_REAL_BRIDGE"] !== "1", "本人の Bridge を止めるので、QA_STOP_REAL_BRIDGE=1 のときだけ流す（BLOCKED）");

  test("SCR-BRIDGE-SETUP-083 SCR-BRIDGE-SETUP-084 端末は 1 台 1 行で、いま応答があるものだけ「仕事を渡せる」", async ({ page }) => {
    test.skip(!(await alive()), "この PC で Bridge が動いていないので確かめられない（BLOCKED）");
    const u = await signupViaApi();
    await claimBridge(u.token, "事務所の Mac");
    await claimBridge(u.token, "事務所の Mac"); // 同じ端末でつなぎ直す（以前はここで 2 行になっていた）
    const old = await claimBridge(u.token, "前に使っていた PC");
    await bridgeAsleep(old); // こちらは 5 分応答が無い＝渡せない
    await setupStep(u.memberId, 1);
    await loginAs(page, u.token);
    await page.goto("/setup/bridge");
    const row = (name: string) => page.locator("tbody tr[data-live]").filter({ hasText: name });
    await expect(row("事務所の Mac")).toHaveCount(1); // つなぎ直しても増えない（SCR-084）
    await expect(row("事務所の Mac")).toContainText("仕事を渡せる");
    // 行ごとに出し分ける。以前は全行が緑の「仕事を渡せる」で、最後の応答も全行同じだった（SCR-083）
    await expect(row("前に使っていた PC")).toHaveAttribute("data-live", "0");
    await expect(row("前に使っていた PC")).toContainText("止まっています");
    await expect(row("前に使っていた PC")).toContainText("分前");
  });

  test("SCR-BRIDGE-SETUP-082 Bridge を終了した直後は「つながりました」と言わない", async ({ page }) => {
    test.skip(!(await alive()), "この PC で Bridge が動いていないので確かめられない（BLOCKED）");
    const u = await signupViaApi();
    await claimBridge(u.token);
    await setupStep(u.memberId, 1);
    await loginAs(page, u.token);
    await page.goto("/setup/bridge");
    await expect(page.locator('[data-state="ok"]')).toBeVisible(); // まず つながっている
    try {
      app("stop");
      await expect.poll(alive, { timeout: 15_000 }).toBe(false);
      await page.reload(); // サーバーの記録はまだ「75 秒以内に応答あり」のまま
      await expect(page.locator('[data-state="other"]')).toBeVisible();
      await expect(page.getByText("この PC では動いていません")).toBeVisible();
      await expect(page.locator('[data-state="ok"]')).toHaveCount(0);
    } finally {
      app("start"); // 止めたものは必ず戻す（QA 自身が副作用を残さない・G-10）
      await expect.poll(alive, { timeout: 30_000 }).toBe(true);
    }
  });
});
