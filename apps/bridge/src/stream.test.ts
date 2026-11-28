// stream-json の読み書き（D-093）。実測した行（2026-09-25・claude 2.1.280）をそのまま使う。
import { describe, expect, it } from "vitest";
import { brief, controlResponse, label, parseLine, phaseText, splitLines, userMessage, usageOf } from "./stream";

const INIT =
  '{"type":"system","subtype":"init","session_id":"55bc17e6-3d60-4fa8-8912-4bce5c0f9068","tools":["Task","Bash"],"model":"x"}';
const RESULT_AUTH =
  '{"type":"result","subtype":"success","is_error":true,"terminal_reason":"api_error","result":"Failed to authenticate: OAuth session expired","session_id":"55bc17e6-3d60-4fa8-8912-4bce5c0f9068","permission_denials":[]}';
const RESULT_OK = '{"type":"result","subtype":"success","is_error":false,"result":"動きました","session_id":"s-1"}';
const ASSISTANT =
  '{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"請求書を作ります"},{"type":"tool_use","id":"t1","name":"Bash","input":{"command":"ls -la /tmp"}}]}}';
const ASK =
  '{"type":"control_request","request_id":"req-9","request":{"subtype":"can_use_tool","tool_name":"Bash","input":{"command":"rm -rf build"}}}';

describe("parseLine（1 行 1 イベント）", () => {
  it("init で会話の id が取れる（途中で落ちても続きからが押せる・D-093.4）", () => {
    expect(parseLine(INIT)).toEqual({
      type: "init",
      session: "55bc17e6-3d60-4fa8-8912-4bce5c0f9068",
      chrome: null,
      dedicated: null,
      model: "x",
    });
  });
  it("subtype が success でも is_error なら失敗（実測：ログインしていないとき）", () => {
    const e = parseLine(RESULT_AUTH);
    expect(e?.type).toBe("result");
    if (e?.type !== "result") throw new Error();
    expect(e.ok).toBe(false);
    expect(e.reason).toContain("api_error");
  });
  it("本文があって is_error でなければ成功。空の本文は成功にしない（G-15）", () => {
    const ok = parseLine(RESULT_OK);
    expect(ok?.type === "result" && ok.ok && ok.text === "動きました" && ok.session === "s-1").toBe(true);
    const empty = parseLine('{"type":"result","subtype":"success","is_error":false,"result":""}');
    expect(empty?.type === "result" && !empty.ok && empty.reason === "empty").toBe(true);
  });
  it("assistant は何をしているかの 1 行になる（道具はコマンドまで見せる）", () => {
    const e = parseLine(ASSISTANT);
    expect(e).toEqual({
      type: "progress",
      text: "請求書を作ります ／ コマンドを動かしています：ls -la /tmp",
      tools: [{ id: "t1", name: "Bash", target: "ls -la /tmp" }], // 終わったときに成否と時間を記録するため（D-100.2）
    });
  });
  it("確認（control_request）は request_id・道具・要約になる", () => {
    const e = parseLine(ASK);
    expect(e).toMatchObject({ type: "ask", requestId: "req-9", tool: "Bash", summary: "Bash: rm -rf build" });
  });
  it("JSON でない行（フックの出力）や知らない type は読み飛ばす", () => {
    expect(parseLine("hook says hi")).toBeNull();
    expect(parseLine('{"type":"system","subtype":"hook_started"}')?.type).toBe("other");
  });
});

describe("書く側", () => {
  it("人の言葉は user メッセージ 1 行、改行で終わる", () => {
    const l = userMessage("こんにちは");
    expect(l.endsWith("\n")).toBe(true);
    expect(JSON.parse(l)).toEqual({
      type: "user",
      message: { role: "user", content: [{ type: "text", text: "こんにちは" }] },
    });
  });
  it("許可は allow、許可しないは deny と理由", () => {
    expect(JSON.parse(controlResponse("req-9", true, { command: "ls" })).response.response).toEqual({
      behavior: "allow",
      updatedInput: { command: "ls" },
    });
    expect(JSON.parse(controlResponse("req-9", false)).response.response.behavior).toBe("deny");
  });
  it("切れ端は最後の途中の行を残す", () => {
    expect(splitLines("a\nb\nc")).toEqual({ lines: ["a", "b"], rest: "c" });
  });
  it("brief は Bash ならコマンド、ファイルならパス", () => {
    expect(brief("Bash", { command: "pwd" })).toBe("pwd");
    expect(brief("Edit", { file_path: "/x/y.ts" })).toBe("/x/y.ts");
    // 生の JSON は人に見せない（問い合わせは問いそのもの・それ以外は読める欄だけ）
    expect(
      brief("AskUserQuestion", {
        questions: [
          { question: "何を受託していますか？", options: [] },
          { question: "人数は？", options: [] },
        ],
      }),
    ).toBe("何を受託していますか？ ／ 人数は？");
    expect(brief("mcp__x__search", { query: "着手金" })).toBe("着手金");
    expect(brief("mcp__x__y", { a: { b: 1 } })).toBe("");
  });
});

// 仕事の記録（D-100）：道具の呼び出しの始まりと終わり、使った量。中身の全文は拾わない
describe("仕事の記録（D-100）", () => {
  it("BRG-13-003 tool_use は id・名前・対象を持ち、tool_result は成否だけを返す（返り値の中身は拾わない）", () => {
    const a = parseLine(
      JSON.stringify({
        type: "assistant",
        message: { content: [{ type: "tool_use", id: "tu_1", name: "Read", input: { file_path: "/w/台帳.csv" } }] },
      }),
    );
    expect(a).toMatchObject({ type: "progress", tools: [{ id: "tu_1", name: "Read", target: "/w/台帳.csv" }] });
    const u = parseLine(
      JSON.stringify({
        type: "user",
        message: {
          content: [
            { type: "tool_result", tool_use_id: "tu_1", is_error: false, content: "社外秘の中身" },
            { type: "tool_result", tool_use_id: "tu_2", is_error: true, content: "x" },
          ],
        },
      }),
    );
    expect(u).toEqual({
      type: "tool_end",
      results: [
        { id: "tu_1", ok: true },
        { id: "tu_2", ok: false },
      ],
    });
    expect(JSON.stringify(u)).not.toContain("社外秘");
  });
  it("result から使った量を取り出す。無い欄は null、1 つも無ければ null", () => {
    const r = parseLine(
      JSON.stringify({
        type: "result",
        subtype: "success",
        is_error: false,
        result: "済",
        num_turns: 3,
        duration_ms: 4200,
        duration_api_ms: 3900,
        total_cost_usd: 0.012,
        usage: { input_tokens: 1200, output_tokens: 340, cache_read_input_tokens: 800 },
      }),
    );
    expect(r).toMatchObject({
      type: "result",
      usage: {
        turns: 3,
        duration_ms: 4200,
        api_ms: 3900,
        input_tokens: 1200,
        output_tokens: 340,
        cache_read_tokens: 800,
        cache_write_tokens: null,
        cost_usd: 0.012,
      },
    });
    expect(usageOf({ type: "result" })).toBeNull();
  });
});

// 会話の作り込み（D-104）：書きながらの返事・手順・使用量・問い合わせ・許可の一言。行は 2026-09-27 に実測した形
describe("会話の作り込み（D-104）", () => {
  it("stream_event の text_delta は文の切れ端、message_start は 1 通の始まり（D-104.8）", () => {
    expect(parseLine(JSON.stringify({ type: "stream_event", event: { type: "message_start", message: {} } }))).toEqual({
      type: "message_start",
    });
    expect(
      parseLine(
        JSON.stringify({
          type: "stream_event",
          event: { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "見積" } },
        }),
      ),
    ).toEqual({ type: "delta", text: "見積" });
    // 考えている途中（thinking）や道具の入力の切れ端は拾わない
    expect(
      parseLine(
        JSON.stringify({
          type: "stream_event",
          event: { type: "content_block_delta", delta: { type: "input_json_delta", partial_json: "{" } },
        }),
      )?.type,
    ).toBe("other");
  });
  it("TodoWrite は手順（中身と済んだか）になり、道具の 1 行には出さない（D-104.8）", () => {
    const e = parseLine(
      JSON.stringify({
        type: "assistant",
        message: {
          content: [
            {
              type: "tool_use",
              id: "t9",
              name: "TodoWrite",
              input: {
                todos: [
                  { content: "台帳を読む", status: "completed", activeForm: "台帳を読んでいます" },
                  { content: "請求書を作る", status: "in_progress" },
                  { content: "x", status: "変な値" },
                ],
              },
            },
          ],
        },
      }),
    );
    expect(e).toEqual({
      type: "progress",
      text: "",
      tools: [],
      todos: [
        { content: "台帳を読む", status: "completed" },
        { content: "請求書を作る", status: "in_progress" },
        { content: "x", status: "pending" },
      ],
    });
  });
  it("rate_limit_event は 5 時間と 1 週間の割合と戻る時刻になる（D-104.16）", () => {
    const e = parseLine(
      JSON.stringify({
        type: "rate_limit_event",
        rate_limit_info: {
          unifiedWindows: {
            five_hour: { utilization: 0.42, resetsAt: 1790000000 },
            seven_day: { utilization: 0.1, resetsAt: 1790500000 },
          },
        },
      }),
    );
    expect(e).toEqual({
      type: "limit",
      windows: [
        { window: "five_hour", utilization: 0.42, resets_at: 1790000000 },
        { window: "week", utilization: 0.1, resets_at: 1790500000 },
      ],
    });
    expect(parseLine(JSON.stringify({ type: "rate_limit_event", rate_limit_info: {} }))?.type).toBe("other");
  });
  it("問い合わせ（AskUserQuestion）は問いそのものが見出しになる（D-104.5）", () => {
    const e = parseLine(
      JSON.stringify({
        type: "control_request",
        request_id: "r1",
        request: {
          subtype: "can_use_tool",
          tool_name: "AskUserQuestion",
          input: { questions: [{ question: "どの月の請求書ですか？", options: [{ label: "9 月" }] }] },
        },
      }),
    );
    expect(e).toMatchObject({ type: "ask", tool: "AskUserQuestion", summary: "どの月の請求書ですか？" });
  });
  it("答えは updatedInput.answers に入り、許可しない一言は理由として渡る（D-104.14）", () => {
    const allow = JSON.parse(controlResponse("r1", true, { questions: [] }, null, { "どの月の請求書ですか？": "9 月" }))
      .response.response;
    expect(allow).toEqual({
      behavior: "allow",
      updatedInput: { questions: [], answers: { "どの月の請求書ですか？": "9 月" } },
    });
    const deny = JSON.parse(controlResponse("r2", false, {}, "本番のフォルダは触らないで")).response.response;
    expect(deny).toEqual({ behavior: "deny", message: "本人が許可しませんでした：本番のフォルダは触らないで" });
  });
  it("道具の名前は「〇〇しています」になる", () => {
    expect(label("Read")).toBe("読んでいます");
    expect(label("WebSearch")).toBe("Web で調べています");
    expect(label("mcp__x__y")).toBe("「y」を使っています");
    expect(label("AskUserQuestion")).toBe("あなたに聞いています");
  });
});

describe("CHT-27-001 いま何をしているかの切り替わり（2026-09-28 実測の形）", () => {
  const ev = (content_block: unknown) =>
    JSON.stringify({ type: "stream_event", event: { type: "content_block_start", index: 0, content_block } });
  it("考えている・道具を準備している・返事を書き始めたを読み、人が読む 1 行にする", () => {
    expect(parseLine(ev({ type: "thinking", thinking: "", signature: "" }))).toEqual({
      type: "phase",
      phase: "thinking",
    });
    expect(parseLine(ev({ type: "tool_use", id: "t", name: "AskUserQuestion", input: {} }))).toEqual({
      type: "phase",
      phase: "tool",
      tool: "AskUserQuestion",
    });
    expect(parseLine(ev({ type: "text", text: "" }))).toEqual({ type: "phase", phase: "writing" });
    expect(phaseText("thinking")).toBe("考えています");
    expect(phaseText("tool", "AskUserQuestion")).toBe("あなたへの問い合わせを書いています");
    expect(phaseText("tool", "Bash")).toBe("コマンドを動かしています");
    expect(phaseText("tool", "mcp__kaname__goal_set")).toBe("たたき台に目標を置いています");
    expect(phaseText("writing")).toBe("返事を書いています");
  });
});
