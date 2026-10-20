// runClaude を偽の CLI で動かす（D-104.8・D-104.9・D-104.14・G-15）。本物の CLI の行の形は stream.test.ts で固定している
import { chmodSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { forgetClaude, isResumeLost, isRunning, RESUME_LOST_NOTICE, runClaude, steerCurrent, stopCurrent, type Answer } from "../src/runner";
import type { Ev } from "../src/stream";

const FAKE = join(__dirname, "fake-claude.mjs");
const job = (prompt: string) => ({ job_id: "j-1", prompt, agent_session_id: null, conversation_id: "c-1", permission_mode: "manual" });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeAll(() => {
  chmodSync(FAKE, 0o755);
  process.env["KANAME_CLAUDE_BIN"] = FAKE;
  forgetClaude();
});
afterAll(() => {
  delete process.env["KANAME_CLAUDE_BIN"];
  forgetClaude();
});

describe("runClaude（偽の CLI）", () => {
  it("書きながらの返事を全文で流し、手順・使用量・道具の記録を返し、result で終わる", async () => {
    const partials: string[] = [];
    const events: Ev[] = [];
    const tools: string[] = [];
    const f = await runClaude(job("請求書"), { onPartial: (t) => partials.push(t), onEvent: (e) => events.push(e), onTool: (t) => tools.push(`${t.name}:${t.ok}`) });
    expect(f).toMatchObject({ state: "done", result: "答え:請求書", agent_session_id: "sess-fake" });
    expect(partials).toEqual(["答え", "答え:請求書"]);
    expect(events.find((e) => e.type === "progress" && e.todos)).toMatchObject({ todos: [{ content: "読む", status: "completed" }, { content: "書く", status: "in_progress" }] });
    expect(events.find((e) => e.type === "limit")).toMatchObject({ windows: [{ window: "five_hour", utilization: 0.3 }, { window: "week" }] });
    expect(tools).toEqual(["Read:true"]);
    expect(f.usage).toMatchObject({ turns: 1, cost_usd: 0.01 });
    expect(isRunning()).toBe(false);
  });

  it("止めずに直した一言は区切りで読まれ、前の答えは onReply、最後の答えが結末になる（D-104.9）", async () => {
    const replies: string[] = [];
    const run = runClaude(job("ASK まず"), {
      onReply: (t) => replies.push(t),
      ask: async (): Promise<Answer> => {
        expect(steerCurrent("月は 9 月で")).toBe(true);
        return { allow: true, answers: { "どの月？": "9 月" } };
      },
    });
    const f = await run;
    expect(replies).toEqual(['選んだ:{"どの月？":"9 月"}']);
    expect(f).toMatchObject({ state: "done", result: "答え:月は 9 月で" });
    expect(f.usage).toMatchObject({ turns: 2 }); // 2 回分を足す
    expect(steerCurrent("もう終わっている")).toBe(false);
  });

  it("区切りで順番待ちの一言を取りに行き、あれば続けて渡す。無ければそこで終わる（D-104.9）", async () => {
    const queue = [["宛先は鈴木さんで"], []];
    const seen: string[] = [];
    const f = await runClaude(job("見積"), { takeSteers: async (reply) => (seen.push(reply), queue.shift() ?? []) });
    expect(seen, "区切りの答えを一緒に渡す").toEqual(["答え:見積", "答え:宛先は鈴木さんで"]);
    expect(f).toMatchObject({ state: "done", result: "答え:宛先は鈴木さんで" });
    expect(queue).toEqual([]);
  });

  it("許可しないときは一言が理由として Claude に渡る（D-104.14）", async () => {
    const f = await runClaude(job("PERM 消して"), { ask: async () => ({ allow: false, note: "本番は触らないで" }) });
    expect(f).toMatchObject({ state: "done", result: "やめました（本人が許可しませんでした：本番は触らないで）" });
  });

  it("答える人がいなければ許可しない", async () => {
    const f = await runClaude(job("PERM 消して"));
    expect(f.state === "done" && f.result.startsWith("やめました")).toBe(true);
  });

  it("止めると、理由だけを持って止まる（D-104.9）", async () => {
    const run = runClaude(job("SLOW 長い仕事"));
    await wait(300);
    expect(isRunning()).toBe(true);
    stopCurrent("あなたが止めました");
    expect(await run).toMatchObject({ state: "stopped", reason: "あなたが止めました", agent_session_id: "sess-fake" });
  });

  it("CHT-42-002 道具が動いている最中に止めると、理由に「途中だった道具の結末は分からない」が付く（D-124.2・E-SIG-003）", async () => {
    const run = runClaude(job("SLOW_TOOL 送って"));
    await wait(400);
    stopCurrent("あなたが止めました");
    const f = await run;
    expect(f.state).toBe("stopped");
    expect(f.state === "stopped" ? f.reason : "").toBe(
      "あなたが止めました。「curl -X POST https://mail.example.com/send」は途中だったので、その結末は分かりません。先方の画面で確かめてください",
    );
  });
  it("CHT-42-002 文を書いている最中（道具が動いていない）に止めたときは添えない", async () => {
    const run = runClaude(job("SLOW 長い仕事"));
    await wait(300);
    stopCurrent("あなたが止めました");
    expect(await run).toMatchObject({ state: "stopped", reason: "あなたが止めました" });
  });
  it("CHT-42-003 記録が無い --resume は、--resume 無しで 1 回だけやり直し、知らせを 1 回出し、新しい id で終わる（D-124.3・E-NF-003）", async () => {
    const notices: string[] = [];
    const inits: (string | null)[] = [];
    const f = await runClaude(
      { ...job("請求書"), agent_session_id: "sess-lost" },
      { onNotice: (t) => notices.push(t), onEvent: (e) => { if (e.type === "init") inits.push(e.session); } },
    );
    expect(f).toMatchObject({ state: "done", result: "答え:請求書", agent_session_id: "sess-fake" });
    expect(notices).toEqual([RESUME_LOST_NOTICE]);
    expect(inits, "やり直した方の init だけが会話の id になる（失敗した方は init を出さない）").toEqual(["sess-fake"]);
  });
  it("CHT-42-005 記録があるときはやり直さない・知らせない。同じ id のまま 1 回で終わる", async () => {
    const notices: string[] = [];
    const inits: (string | null)[] = [];
    const f = await runClaude(
      { ...job("請求書"), agent_session_id: "sess-fake" },
      { onNotice: (t) => notices.push(t), onEvent: (e) => { if (e.type === "init") inits.push(e.session); } },
    );
    expect(f).toMatchObject({ state: "done", result: "答え:請求書", agent_session_id: "sess-fake" });
    expect(notices).toEqual([]);
    expect(inits).toEqual(["sess-fake"]);
  });
  it("CHT-42-004 本物の形の判定：記録が無い（stderr／API を呼ばず本文なし）は当たり、上限（API は呼んだ）や本文のある失敗は当たらない", () => {
    const lost = { type: "result", subtype: "error_during_execution", duration_ms: 0, duration_api_ms: 0, is_error: true, num_turns: 0, result: "" };
    expect(isResumeLost(lost, "", "")).toBe(true);
    expect(isResumeLost({ subtype: "success" }, "No conversation found with session ID: x\n", "")).toBe(true);
    expect(isResumeLost({ subtype: "error_during_execution", num_turns: 0, duration_api_ms: 812, is_error: true }, "", "")).toBe(false);
    expect(isResumeLost({ subtype: "error_during_execution", num_turns: 0, duration_api_ms: 0 }, "", "途中まで")).toBe(false);
    expect(isResumeLost({ subtype: "error_during_execution", num_turns: 2, duration_api_ms: 0 }, "", "")).toBe(false);
  });

  it("BRG-01-003 BRG-02-003 BRG-04-003 完了信号を出さずに終わったものを成功にしない（G-15）", async () => {
    const f = await runClaude(job("SILENT"));
    expect(f.state).toBe("stopped");
  });

  it("CHT-25-007 本人の答えを待っている間は止める目安を数えない。上限より長く待っても、答えれば続きが動く（2026-09-28 実例）", async () => {
    const f = await runClaude(
      job("ASK まず"),
      { ask: async (): Promise<Answer> => (await wait(900), { allow: true, answers: { "どの月？": "9 月" } }) },
      300,
    );
    expect(f).toMatchObject({ state: "done", result: '選んだ:{"どの月？":"9 月"}' });
  });
  it("CHT-25-007 何も出てこないまま上限を過ぎたら、何も進まなかったと言って止める", async () => {
    const f = await runClaude(job("SLOW"), {}, 400);
    expect(f).toMatchObject({ state: "stopped", reason: expect.stringMatching(/何も進まなかったので止めました/) });
    expect(isRunning()).toBe(false);
  });

  it("CHT-27-001 いま何をしているかの切り替わり（考えている・問い合わせを書いている・返事を書き始めた）を順に渡す", async () => {
    const phases: string[] = [];
    await runClaude(job("THINK まず"), { onPhase: (p, t) => phases.push(t ? `${p}:${t}` : p) });
    expect(phases).toEqual(["thinking", "tool:AskUserQuestion", "writing"]);
  });
});
