// QA A1：自分のAIの右パネル（T-US-02）の L1 の行を実ブラウザで押して確かめる。テストの名前の先頭に正本の行 ID を並べる（op_gate.py）。
// 前の会話の画面（T-U-17）を開く行は、その道が話すの画面へ送るだけになった（K-762）ので K-765 で消した。
// 本人の本物の Bridge は止めない（hideRealBridge）。
import { expect, test, type Page } from "@playwright/test";
import { hideRealBridge, loginAs, setupStep, signupViaApi } from "../_lib/api";
import { startAgentBridge, type AgentBridge } from "../_lib/agent-bridge";

test.describe.configure({ timeout: 180_000 });
let bridges: AgentBridge[] = [];
test.beforeEach(({ page }) => hideRealBridge(page));
test.afterEach(() => {
  for (const b of bridges) b.stop();
  bridges = [];
});

type U = Awaited<ReturnType<typeof signupViaApi>>;
/** 偽の音声認識（話した文が 1 つ返る。止めると終わる） */
async function fakeSpeech(page: Page, said: string) {
  await page.addInitScript((t) => {
    class FakeRec {
      lang = "";
      interimResults = false;
      continuous = false;
      onresult: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      start() {
        setTimeout(() => this.onresult?.({ results: [Object.assign([{ transcript: t }], { isFinal: true })] }), 200);
      }
      stop() {
        setTimeout(() => this.onend?.(), 50);
      }
    }
    Object.assign(window, { SpeechRecognition: FakeRec, webkitSpeechRecognition: FakeRec });
  }, said);
}

// =====================================================================================================
// 右パネル（T-US-02・状態 共通）。本物の作業画面がまだ無いので、共通の枠が出す本物の右パネルを見本の画面（?live=1）で開く
// =====================================================================================================
async function panelReady(page: Page): Promise<U & { sid: string }> {
  const u = await signupViaApi();
  const b = await startAgentBridge(u.token);
  bridges.push(b);
  await setupStep(u.memberId, 6);
  await loginAs(page, u.token);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/dev/shell?screen=today&ps=PS3&live=1");
  await expect(page.locator(".aipanel [data-part='conversation']")).toBeVisible({ timeout: 30_000 });
  return { ...u, sid: b.sid };
}
const panel = (page: Page) => page.locator(".aipanel");
test("USH-02-030 USH-02-031 右パネル：＋で選んだ資料が入力欄の上に並ぶ。マイクで話すと文字になる", async ({ page }) => {
  await fakeSpeech(page, "パネルで声");
  await panelReady(page);
  const p = panel(page);
  const chooser = page.waitForEvent("filechooser");
  await p.getByRole("button", { name: "資料・画像を付ける" }).click();
  await (
    await chooser
  ).setFiles({ name: "台帳.csv", mimeType: "text/csv", buffer: Buffer.from("日付,金額\n9/1,1000\n") });
  await expect(p.locator("[data-att-state='ok']")).toContainText("台帳.csv", { timeout: 20_000 });
  await p.getByRole("button", { name: "声で入力" }).click();
  await expect(p.locator(".rec")).toContainText("聞いています");
  await expect(p.getByRole("textbox", { name: "自分のAIに書く" })).toHaveValue("パネルで声", { timeout: 5_000 });
  await p.locator(".rec").getByRole("button", { name: "止める" }).click();
  await expect(p.locator(".rec")).toHaveCount(0);
});
