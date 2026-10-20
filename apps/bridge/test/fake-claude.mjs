#!/usr/bin/env node
/* global process, console, setTimeout */
// テスト用の偽の CLI。stream-json の行の形は 2026-09-25〜27 に実測した claude 2.1.x の出力に合わせる。
//   普通の文 → init・書きながらの返事・手順・使用量・result
//   「止めずに直す」の一言が来たら、それにも result を返す（実測：次の区切りでもう 1 回 result）
//   ASK を含む → 問い合わせ（AskUserQuestion）を出し、答えを result に書く
//   PERM を含む → Bash の確認を出し、許可なら「実行しました」、しなければ理由を result に書く
//   SLOW を含む → result を返さず居座る（止めるの確かめ）
//   ゆっくり を含む → 書きかけのまま少し待つ
//   SILENT を含む → result を返さずに終わる（G-15）
//   SLOW_TOOL を含む → 道具（送信）を始めたまま居座る（D-124.2）／--resume sess-lost → 記録が無い（D-124.3）
if (process.argv.includes("--version")) {
  console.log("2.1.280 (fake)");
  process.exit(0);
}
const out = (o) => process.stdout.write(`${JSON.stringify(o)}\n`);
const args = process.argv.slice(2);
// --resume sess-lost → 記録が無い（本物の claude 2.1.283 で 2026-10-20 に実測した形・D-124.3）：
//   stderr に 1 行、stdout の result は is_error・error_during_execution・num_turns 0・duration_api_ms 0・本文なし、終了コード 1
if (args.includes("--resume") && args[args.indexOf("--resume") + 1] === "sess-lost") {
  process.stderr.write("No conversation found with session ID: sess-lost\n");
  out({ type: "result", subtype: "error_during_execution", duration_ms: 0, duration_api_ms: 0, is_error: true, num_turns: 0, stop_reason: null, session_id: "sess-lost", total_cost_usd: 0, usage: { input_tokens: 0, output_tokens: 0 }, result: "" });
  process.exit(1);
}
let n = 0;
let waiting = null;
let rest = "";
const queue = []; // 実測：答えている途中に来た一言は、いまの区切りが終わってから読まれる
// ブラウザ（D-119）：--chrome なら claude-in-chrome、--mcp-config に playwright があれば playwright のつながりを init に出す（2026-09-30 実測の形）。
//   Bridge は環境を許可リストでしか渡さないので、状態は会話の決まり（--append-system-prompt）の FAKE_CHROME=… ／FAKE_PW=… で変える
const mcpCfg = args.includes("--mcp-config") ? args[args.indexOf("--mcp-config") + 1] ?? "" : "";
const said = (k) => (/FAKE_[A-Z]+=\w+/.test(args.join(" ")) ? (new RegExp(`${k}=([\\w-]+)`).exec(args.join(" ")) ?? [])[1] : undefined);
const mcpServers = [
  ...(args.includes("--chrome") ? [{ name: "claude-in-chrome", status: said("FAKE_CHROME") ?? "connected", source: "dynamic" }] : []),
  ...(mcpCfg.includes('"playwright"') ? [{ name: "playwright", status: said("FAKE_PW") ?? "connected", source: "dynamic" }] : []),
];
out({ type: "system", subtype: "init", session_id: "sess-fake", args, mcp_servers: mcpServers });
const reply = (text) => {
  out({ type: "stream_event", event: { type: "message_start", message: {} } });
  out({ type: "stream_event", event: { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } } });
  for (const part of [text.slice(0, 2), text.slice(2)]) out({ type: "stream_event", event: { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: part } } });
  // 「ゆっくり」は書き終わるまで間を置く（書きながらの返事が画面に届くのを確かめる）
  if (text.includes("ゆっくり")) return void setTimeout(() => finish(text), 900);
  finish(text);
};
const finish = (text) => {
  out({ type: "assistant", uuid: `u-${Buffer.from(text).toString("hex").slice(0, 24)}-0000`, parent_tool_use_id: null, message: { content: [{ type: "text", text }] } });
  out({ type: "rate_limit_event", rate_limit_info: { unifiedWindows: { five_hour: { utilization: 0.3, resetsAt: 1790000000 }, seven_day: { utilization: 0.05, resetsAt: 1790500000 } } } });
  out({ type: "result", subtype: "success", is_error: false, result: text, session_id: "sess-fake", num_turns: 1, total_cost_usd: 0.01, usage: { input_tokens: 10, output_tokens: 5 } });
};
const onUser = (text) => {
  n += 1;
  if (text.includes("SILENT")) process.exit(0);
  // SLOW_TOOL：道具（送信）を始めたまま居座る（止めたとき「途中だった道具の結末は分からない」の確かめ・D-124.2）
  if (text.includes("SLOW_TOOL")) {
    out({ type: "assistant", message: { content: [{ type: "tool_use", id: `sl${n}`, name: "Bash", input: { command: "curl -X POST https://mail.example.com/send" } }] } });
    return;
  }
  if (text.includes("SLOW")) return;
  if (text.includes("THINK")) {
    out({ type: "stream_event", event: { type: "message_start", message: {} } });
    out({ type: "stream_event", event: { type: "content_block_start", index: 0, content_block: { type: "thinking", thinking: "", signature: "" } } });
    out({ type: "stream_event", event: { type: "content_block_start", index: 1, content_block: { type: "tool_use", id: "tq", name: "AskUserQuestion", input: {} } } });
  }
  out({ type: "assistant", message: { content: [{ type: "tool_use", id: `td${n}`, name: "TodoWrite", input: { todos: [{ content: "読む", status: "completed" }, { content: "書く", status: "in_progress" }] } }] } });
  out({ type: "assistant", message: { content: [{ type: "tool_use", id: `tu${n}`, name: "Read", input: { file_path: "/w/a.csv" } }] } });
  out({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: `tu${n}`, is_error: false, content: "x" }] } });
  // CHROME_OFF：ブラウザの道具が「拡張機能とつながっていない」で失敗する（公式の説明の文言）
  if (text.includes("CHROME_OFF")) {
    out({ type: "assistant", message: { content: [{ type: "tool_use", id: `cn${n}`, name: "mcp__claude-in-chrome__navigate", input: { url: "https://example.com/a?k=secret", tabId: 1 } }] } });
    out({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: `cn${n}`, is_error: true, content: [{ type: "text", text: "Browser extension is not connected. Please ensure the Claude browser extension is installed and running." }] }] } });
  }
  if (text.includes("ASK")) {
    waiting = { id: `q${n}`, kind: "ask" };
    return out({ type: "control_request", request_id: waiting.id, request: { subtype: "can_use_tool", tool_name: "AskUserQuestion", input: { questions: [{ question: "どの月？", options: [{ label: "9 月" }] }] } } });
  }
  if (text.includes("PERM")) {
    waiting = { id: `p${n}`, kind: "perm" };
    return out({ type: "control_request", request_id: waiting.id, request: { subtype: "can_use_tool", tool_name: "Bash", input: { command: "rm -rf build" } } });
  }
  const att = text.split("\n").filter((l) => l.startsWith("- ")).map((l) => l.slice(2));
  reply(`答え:${text.split("\n")[0]}${att.length ? ` [${att.join("|")}]` : ""}`);
};
process.stdin.on("data", (c) => {
  const lines = (rest + c.toString()).split("\n");
  rest = lines.pop() ?? "";
  for (const ln of lines) {
    if (!ln.trim()) continue;
    const j = JSON.parse(ln);
    if (j.type === "user") {
      const text = j.message.content.map((x) => x.text).join("");
      if (waiting) queue.push(text);
      else onUser(text);
    }
    if (j.type === "control_response" && waiting && j.response.request_id === waiting.id) {
      const r = j.response.response;
      const w = waiting;
      waiting = null;
      if (w.kind === "ask") reply(`選んだ:${JSON.stringify(r.updatedInput?.answers ?? null)}`);
      else reply(r.behavior === "allow" ? "実行しました" : `やめました（${r.message}）`);
      while (!waiting && queue.length) onUser(queue.shift());
    }
  }
});
process.stdin.on("end", () => process.exit(0));
