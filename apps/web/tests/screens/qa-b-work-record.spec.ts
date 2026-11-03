// T-B-13 自分のAI の仕事の記録（D-100）：画面 → API → 本物の Bridge の輪（apps/bridge/dist）→ 偽の Claude Code（scripts/dev/fake-claude-demo.mjs）→ API → 画面。
//   道具を使うたびに 名前・対象・成否・時間 が残り（BRG-13-001）、使った量が結末より先に残り（BRG-13-002）、
//   会話には作業の 1 行（「読んでいます：…」）だけが出て、道具の記録と使った量は会話に出ない（BRG-13-004）。
//   中身の全文を送らない（BRG-13-003）は apps/api/test/bridge_stream.test.ts と apps/bridge/src/stream.test.ts。
//   テストの名前に正本の行 ID を持つ（op_gate.py）。本人の本物の Bridge は止めない（hideRealBridge）
import { expect, test, type Page } from "@playwright/test";
import { admin, hideRealBridge, loginAs, setupStep, signupViaApi } from "../_lib/api";
import { startAgentBridge, type AgentBridge } from "../_lib/agent-bridge";

let bridges: AgentBridge[] = [];
test.beforeEach(({ page }) => hideRealBridge(page));
test.afterEach(() => {
  for (const b of bridges) b.stop();
  bridges = [];
});
const box = (page: Page) => page.getByRole("textbox", { name: "自分のAIに書く" });
async function ready(page: Page) {
  const u = await signupViaApi();
  bridges.push(await startAgentBridge(u.token));
  await setupStep(u.memberId, 6);
  await loginAs(page, u.token);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/ai/chat");
  await expect(box(page)).toBeVisible({ timeout: 20_000 });
  return u;
}

test("BRG-13-001 BRG-13-002 BRG-13-004 ファイルを読ませる → 作業の行は「読んでいます：…」の 1 行だけ。終わると道具の行（Read・対象・成功・時間）と使った量が結末より先に残り、会話には出ない", async ({
  page,
}) => {
  const u = await ready(page);
  await box(page).fill("請求台帳をゆっくり読んでまとめて");
  await box(page).press("Enter");
  // 作業中：会話に出るのは作業の 1 行だけ（道具の名前は「読んでいます」、対象はファイル名）。道具の表も使った量も並ばない
  const w = page.locator("[data-working]");
  await expect(w.locator(".ws")).toContainText("読んでいます", { timeout: 20_000 });
  await expect(w.locator(".ws")).toContainText("請求台帳.csv");
  await expect(w, "道具の記録（成否・時間）は会話に並ばない").not.toContainText(/ms|ok|true|tokens/);
  await expect(w.locator(".ws"), "1 行だけ").toHaveCount(1);
  // 終わる：返事が出て、作業の行は消える。返事の上に残るのは「N つの操作 · 時間」の畳んだ 1 行
  const ai = page.locator('.msg[data-who="ai"]:not([data-streaming])').last();
  await expect(ai).toContainText("9 月の請求のまとめ", { timeout: 40_000 });
  await expect(page.locator("[data-working]")).toHaveCount(0);
  await expect(page.locator("[data-work-done] summary").last()).toContainText("1 つの操作");
  const conv = await page.locator(".kc").innerText();
  // 返事の表には金額（120000 等）があるので、記録にしか無い語で見る
  for (const leak of ["Read", "/w/請求台帳.csv", "input_tokens", "cost_usd", "tokens", "0.02", "4200"])
    expect(conv, `会話に ${leak} は出ない`).not.toContain(leak);
  // 記録：道具の行（名前・対象・成否・時間）と使った量（往復数・時間・量・費用）。使った量は結末より先
  const jobs = await admin<{ id: string; finished_at: string; state_id: string }>(
    "select id, finished_at, state_id from bridge_jobs where member_id = $1 order by created_at desc limit 1",
    [u.memberId],
  );
  expect(jobs).toHaveLength(1);
  expect(jobs[0]!.state_id).toBe("done");
  const ev = await admin<{ kind: string; payload: Record<string, unknown>; created_at: string }>(
    "select kind, payload, created_at from bridge_job_events where job_id = $1 and kind in ('tool', 'usage') order by seq",
    [jobs[0]!.id],
  );
  const tool = ev.find((e) => e.kind === "tool")!;
  expect(tool, "道具の行").toBeTruthy();
  expect(tool.payload).toMatchObject({ name: "Read", target: "/w/請求台帳.csv", ok: true });
  expect(Number(tool.payload["ms"]), "かかった時間（偽物は 6 秒読む）").toBeGreaterThanOrEqual(5_000);
  expect(Object.keys(tool.payload).sort(), "決めた欄だけ").toEqual(["ms", "name", "ok", "target"]);
  const usage = ev.find((e) => e.kind === "usage")!;
  expect(usage, "使った量の行").toBeTruthy();
  expect(usage.payload).toMatchObject({
    turns: 3,
    duration_ms: 4200,
    input_tokens: 1200,
    output_tokens: 340,
    cost_usd: 0.02,
  });
  expect(new Date(usage.created_at).getTime(), "使った量は結末より先に残る").toBeLessThanOrEqual(
    new Date(jobs[0]!.finished_at).getTime(),
  );
  // 会話（messages）には道具の記録も使った量も入らない。返事の行が持つのは操作の数と時間だけ
  const msgs = await admin<{ kind: string; body: string; work: Record<string, unknown> | null }>(
    "select kind, body, work from messages where job_id = $1 order by created_at",
    [jobs[0]!.id],
  );
  const aiMsg = msgs.find((m) => m.kind === "ai")!;
  expect(aiMsg.body).not.toMatch(/Read|請求台帳\.csv|input_tokens|cost_usd|0\.02/); // 返事の表の金額（120000）は 1200 を含むので、記録にしか無い語で見る
  expect(aiMsg.work).toMatchObject({ ops: 1 });
  expect(JSON.stringify(msgs)).not.toMatch(/"name":"Read"|input_tokens|cost_usd/);
});
