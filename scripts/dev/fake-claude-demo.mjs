#!/usr/bin/env node
// 手元で会話の画面を確かめるための、偽の Claude Code（本人のサブスクを使わない）。行の形は実測した stream-json と同じ。
//   ふつう      → 手順・道具・使用量・書きながらの返事（書式を一通り）
//   「聞いて」  → 問い合わせ（AskUserQuestion）
//   「消して」  → 許可の問い（Bash）
//   「長く」    → 30 秒かけて書く（止める・止めずに直すの確かめ）
//   「落ちて」  → 途中まで書いて、完了の知らせを出さずに終わる
//   「上限」    → 5 時間の枠 92%
//   「銀行」    → 台帳で禁止の宛先に curl しようとする。--settings の PreToolUse フックを本物と同じく先に動かし、止められたらそう答える
//   「禁止を見せて」 → 受け取った「使わない道具」（--disallowedTools）をそのまま答える
//   「引数を見せて」 → 受け取った --model・--effort・--permission-mode を答える
//   「絵文字で」 → 絵文字入りの返事（画面が消して描くのを確かめる）
//   「ゆっくり読んで」 → 台帳を読む道具に 6 秒かける（作業の行「読んでいます：…」を画面で確かめる・T-B-13）
//   「考えて」  → 考えている切り替わり（thinking の block）を出してから 6 秒黙り、その後に書く（作業中の行が「考えています」・最後の動きが進むのを確かめる）
//   「たたき台を置いて」 → 受け取った --mcp-config の kaname を本物と同じく起こし、目標・台帳・担当業務を置いてから答える（D-110）
//   「ブラウザで」 → --chrome が渡っていれば Claude in Chrome の道具で開こうとして「拡張機能とつながっていない」で失敗する（D-119.4）。
//                    渡っていなければ「ブラウザの道具がありません」と答える（どの仕事に Chrome を渡したかの確かめ）
if (process.argv.includes("--version")) {
  console.log("2.1.280 (demo)");
  process.exit(0);
}
const out = (o) => process.stdout.write(`${JSON.stringify(o)}\n`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// --resume が来たら同じ続き（session）で答える（本物と同じ）
const ri = process.argv.indexOf("--resume");
const SESSION = ri > 0 ? process.argv[ri + 1] : crypto.randomUUID(); // 本物と同じ形（uuid）
// 起動の知らせの mcp_servers（2026-09-30 実測の形）。--chrome なら Claude in Chrome はつながっている
out({ type: "system", subtype: "init", session_id: SESSION, model: (() => { const i = process.argv.indexOf("--model"); return i > 0 ? process.argv[i + 1] : "claude-opus-4-8"; })(), mcp_servers: process.argv.includes("--chrome") ? [{ name: "claude-in-chrome", status: "connected", source: "dynamic" }] : [] });
const REPLY = `## 9 月の請求のまとめ

**3 件**のうち、1 件が~~未送付~~送付済みになりました。蛍光ペンは <kbd>Ctrl</kbd>+<kbd>C</kbd>、<mark>印</mark>も出せます。

> [!WARNING]
> セイコーの着手金は、契約時に 3 割です。

| 取引先 | 金額 | 期日 |
|---|---:|---|
| セイコー | 990000 | 9/30 |
| 京蟻 | 120000 | 10/05 |
| SOICO | 450000 | 9/20 |

### 手順
- [x] 台帳を読む
- [ ] 承認に上げる

\`\`\`ts
// 金額を税込にする
export function withTax(v: number): number {
  return Math.round(v * 1.1);
}
\`\`\`

達成率は $\\frac{8.33}{12} \\times 100 \\approx 69.4$ です。

$$
\\sum_{i=1}^{n} x_i = 1560000
$$

\`\`\`mermaid
flowchart LR
  A[台帳を読む] --> B[下書き] --> C[承認]
\`\`\`

<details><summary>開いて見る</summary>細かい内訳はここに書きます。</details>

[kaname://task/00000000-0000-0000-0000-000000000001](kaname://task/00000000-0000-0000-0000-000000000001)

出典はこちらです[^1]。

[^1]: 請求台帳（9 月分）
`;
let waiting = null;
const queue = [];
let rest = "";
const stream = async (text, slow) => {
  out({ type: "stream_event", event: { type: "message_start", message: {} } });
  // 本物と同じく、書き始める前に「返事を書き始めた」の切り替わりを出す（2026-09-28 実測の形）
  out({ type: "stream_event", event: { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } } });
  const step = slow ? 12 : 40;
  for (let i = 0; i < text.length; i += step) {
    out({ type: "stream_event", event: { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: text.slice(i, i + step) } } });
    await sleep(slow ? 400 : 150); // 画面が見に行く間（1.2 秒）より長く書き続ける（書きながら出るのを確かめられる）
  }
};
// 本物と同じく、書き終えた文は記録と同じ id（uuid）つきの assistant の行として流してから結末を出す（D-112・2026-09-28 実測）
// 本物と同じく、会話の記録も残す（本物は ~/.claude/projects。偽物は一時フォルダ。本人の記録には触らない）
import("node:fs").then(({ mkdirSync }) => mkdirSync(`${process.env.TMPDIR || "/tmp"}/kaname-fake-projects/-fake`, { recursive: true })).catch(() => undefined);
const record = async (o) => {
  const { appendFileSync } = await import("node:fs");
  try {
    appendFileSync(`${process.env.TMPDIR || "/tmp"}/kaname-fake-projects/-fake/${SESSION}.jsonl`, `${JSON.stringify({ ...o, sessionId: SESSION, timestamp: new Date().toISOString() })}\n`);
  } catch {
    /* 記録が書けなくても答えは返す */
  }
};
const result = (text) => {
  const uuid = crypto.randomUUID();
  const msg = { role: "assistant", content: [{ type: "text", text }] };
  void record({ type: "assistant", uuid, message: msg });
  out({ type: "assistant", uuid, session_id: SESSION, parent_tool_use_id: null, message: msg });
  out({ type: "result", subtype: "success", is_error: false, result: text, session_id: SESSION, num_turns: 3, duration_ms: 4200, total_cost_usd: 0.02, usage: { input_tokens: 1200, output_tokens: 340 } });
};
const onUser = async (text) => {
  // 記憶の毎朝のまとめ（会話の無い仕事）には、決まった形の JSON で答える
  if (text.includes("記憶を整理してください")) {
    const mem = /\[([0-9a-f-]{36})\]/.exec(text)?.[1];
    const scope = /# 上げ先の層[^\n]*\n- \[([0-9a-f-]{36})\]/.exec(text)?.[1];
    const j = {
      remembered: [{ title: "京蟻の窓口", body: "京蟻の窓口は経理の鈴木さん", kind: "preference", source: "請求の確かめ" }],
      merged: mem ? [{ memory_ids: [mem], title: "請求書の書き方", body: "請求書は税込を先に書き、宛名は御中", kind: "preference" }] : [],
      propose: scope ? [{ title: "着手金", body: "着手金は契約時に 3 割", kind: "rule", target_scope_id: scope, why: "会社の決まりに近い", source: "請求の確かめ" }] : [],
      discarded: [{ text: "明日 10 時に電話する", why: "予定なのでタスクに" }],
    };
    const t = `整理しました。\n\n\`\`\`json\n${JSON.stringify(j)}\n\`\`\``;
    await stream(t, false);
    return result(t);
  }
  out({ type: "assistant", message: { content: [{ type: "tool_use", id: `td-${Date.now()}`, name: "TodoWrite", input: { todos: [{ content: "台帳を読む", status: "completed" }, { content: "金額と期日を確かめる", status: "in_progress" }, { content: "まとめる", status: "pending" }] } }] } });
  const id = `tu-${Date.now()}`;
  out({ type: "assistant", message: { content: [{ type: "tool_use", id, name: "Read", input: { file_path: "/w/請求台帳.csv" } }] } });
  await sleep(text.includes("ゆっくり読んで") ? 6000 : 1200); // 「ゆっくり読んで」→ 道具の行を画面で見られる長さ（T-B-13）
  out({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: id, is_error: false, content: "（略）" }] } });
  out({ type: "rate_limit_event", rate_limit_info: { unifiedWindows: { five_hour: { utilization: text.includes("上限") ? 0.92 : 0.41, resetsAt: Math.floor(Date.now() / 1000) + 5400 }, seven_day: { utilization: 0.12, resetsAt: Math.floor(Date.now() / 1000) + 400000 } } } });
  if (text.includes("聞いて")) {
    waiting = { id: `q-${Date.now()}`, kind: "ask" };
    return out({ type: "control_request", request_id: waiting.id, request: { subtype: "can_use_tool", tool_name: "AskUserQuestion", input: { questions: [
      { question: "どの月の請求書ですか？", header: "月", multiSelect: false, options: [{ label: "9 月（おすすめ）", description: "締めが近い" }, { label: "10 月", description: "来月分" }] },
      { question: "一緒に送るものは？", header: "同封", multiSelect: true, options: [{ label: "提案書", description: "先週の v3" }, { label: "見積書", description: "990,000 円" }] },
    ] } } });
  }
  if (text.includes("消して")) {
    waiting = { id: `p-${Date.now()}`, kind: "perm" };
    return out({ type: "control_request", request_id: waiting.id, request: { subtype: "can_use_tool", tool_name: "Bash", input: { command: "rm -rf 請求書/下書き" } } });
  }
  if (text.includes("枠切れ")) {
    // 5 時間の枠に達した（本物と同じく rate_limit_event の後に失敗の result）
    out({ type: "rate_limit_event", rate_limit_info: { unifiedWindows: { five_hour: { utilization: 1, resetsAt: Math.floor(Date.now() / 1000) + 3600 }, seven_day: { utilization: 0.3, resetsAt: Math.floor(Date.now() / 1000) + 400000 } } } });
    out({ type: "result", subtype: "error_during_execution", is_error: true, error: "rate_limit", result: "", session_id: SESSION });
    return;
  }
  if (text.includes("絵文字で")) {
    const t = "🎯 目標を置きました ✅ 👷‍♂️ 担当も決めました ©2026";
    await stream(t, false);
    return result(t);
  }
  if (text.includes("考えて")) {
    out({ type: "stream_event", event: { type: "message_start", message: {} } });
    out({ type: "stream_event", event: { type: "content_block_start", index: 0, content_block: { type: "thinking", thinking: "", signature: "" } } });
    out({ type: "stream_event", event: { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "", estimated_tokens: 50 } } });
    await sleep(6000);
    const t = "考えました。答えはこうです。";
    await stream(t, false);
    return result(t);
  }
  if (text.includes("たたき台を置いて")) {
    // 本物の Claude Code と同じく、--mcp-config の道具のサーバーを起こして JSON-RPC で道具を呼ぶ
    const mi = process.argv.indexOf("--mcp-config");
    const cfg = mi > 0 ? JSON.parse(process.argv[mi + 1]).mcpServers?.kaname : null;
    if (!cfg) {
      await stream("Kaname の道具を受け取っていません", false);
      return result("Kaname の道具を受け取っていません");
    }
    const { spawn } = await import("node:child_process");
    const srv = spawn(cfg.command, cfg.args, { env: { ...process.env, ...cfg.env }, stdio: ["pipe", "pipe", "inherit"] });
    let buf = "";
    const waiters = [];
    srv.stdout.on("data", (c) => {
      buf += c;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const ln = buf.slice(0, i);
        buf = buf.slice(i + 1);
        if (ln.trim()) waiters.shift()?.(JSON.parse(ln));
      }
    });
    let id = 0;
    const rpc = (method, params) => new Promise((res) => (waiters.push(res), srv.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }) + "\n")));
    await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "demo", version: "1" } });
    const calls = [
      ["goal_set", { name: "今期の売上", target_value: 12000000, unit: "円", period_start: "2026-10-01", period_end: "2027-03-31" }],
      ["ledger_set", { name: "案件台帳", stages: ["引き合い", "見積", "受注", "納品"], fields: ["取引先", "金額", "納期"] }],
      ["duty_set", { name: "見積の下書き", definition: "引き合いから見積の下書きを作る", staff: "見積さん" }],
    ];
    const done = [];
    for (const [name, args] of calls) {
      const tid = `tk-${name}-${Date.now()}`;
      out({ type: "assistant", message: { content: [{ type: "tool_use", id: tid, name: `mcp__kaname__${name}`, input: args }] } });
      const r = await rpc("tools/call", { name, arguments: args });
      const ok = !r.result?.isError;
      out({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: tid, is_error: !ok, content: r.result?.content?.[0]?.text ?? "" }] } });
      done.push(ok ? `${args.name}` : `${args.name}（置けませんでした：${r.result?.content?.[0]?.text ?? ""}）`);
      await sleep(1500); // 画面が作業の行を見に行く間（1.2 秒）より長く、1 つずつの切り替わりが見える
    }
    srv.kill();
    const t = `たたき台に置きました：${done.join("・")}`;
    await stream(t, false);
    return result(t);
  }
  if (text.includes("引数を見せて")) {
    // 画面で選んだモデル・考える強さ・許可のしかたが起動の引数に届いたか（2026-09-30 user「モデル変更はできているの？」）
    const pick = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : "なし"; };
    const t = `モデル=${pick("--model")} 強さ=${pick("--effort")} 許可=${pick("--permission-mode")}`;
    await stream(t, false);
    return result(t);
  }
  if (text.includes("禁止を見せて")) {
    const i = process.argv.indexOf("--disallowedTools");
    const list = [];
    if (i > 0) for (let k = i + 1; k < process.argv.length && !process.argv[k].startsWith("--"); k++) list.push(process.argv[k]);
    const t = `使わない道具：${list.join("、") || "なし"}`;
    await stream(t, false);
    return result(t);
  }
  if (text.includes("tabs_context_mcp")) {
    // もう一度確かめる（D-120.3）：タブの一覧を 1 回見る。--chrome が渡っていれば使える（返り値の形は 2026-09-30 実測）
    const tid = `tx-${Date.now()}`;
    out({ type: "assistant", message: { content: [{ type: "tool_use", id: tid, name: "mcp__claude-in-chrome__tabs_context_mcp", input: {} }] } });
    await sleep(500);
    out({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: tid, is_error: false, content: [{ type: "text", text: "\n\nTab Context:\n- Available tabs:\n  • tabId 1: \"新しいタブ\" (\"chrome://newtab/\")" }] }] } });
    const t = process.argv.includes("--chrome") ? "つながっています" : "つながっていません";
    await stream(t, false);
    return result(t);
  }
  if (text.includes("ブラウザで")) {
    if (!process.argv.includes("--chrome")) {
      const t = "ブラウザの道具がありません。ブラウザを使わずに答えます。";
      await stream(t, false);
      return result(t);
    }
    const tid = `tc-${Date.now()}`;
    out({ type: "assistant", message: { content: [{ type: "tool_use", id: tid, name: "mcp__claude-in-chrome__navigate", input: { url: "https://example.com/", tabId: 1 } }] } });
    await sleep(800);
    out({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: tid, is_error: true, content: [{ type: "text", text: "Browser extension is not connected. Please ensure the Claude browser extension is installed and running." }] }] } });
    const t = "Chrome の拡張機能とつながっていないので、ブラウザを使わずに答えます。";
    await stream(t, false);
    return result(t);
  }
  if (text.includes("銀行")) {
    // 本物の Claude Code と同じく、道具を使う直前に --settings の PreToolUse フックを動かす（終了コード 2 なら止まり、理由が返る）
    const blocked = (() => { try { return JSON.parse(process.env.KANAME_BLOCKED || "[]"); } catch { return []; } })();
    const d = blocked[0]?.domain ?? "example-bank.jp";
    const command = `curl -s https://www.${d}/login`;
    const tid = `tb-${Date.now()}`;
    out({ type: "assistant", message: { content: [{ type: "tool_use", id: tid, name: "Bash", input: { command } }] } });
    const si = process.argv.indexOf("--settings");
    const hooks = si > 0 ? (JSON.parse(process.argv[si + 1]).hooks?.PreToolUse ?? []) : [];
    let deny = null;
    for (const h of hooks.flatMap((x) => x.hooks ?? [])) {
      const { spawnSync } = await import("node:child_process");
      const r = spawnSync(h.command, { shell: true, input: JSON.stringify({ tool_name: "Bash", tool_input: { command } }), encoding: "utf8", env: process.env });
      if (r.status === 2) { deny = r.stderr; break; }
    }
    out({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: tid, is_error: !!deny, content: deny ? `PreToolUse:Bash hook error: ${deny}` : "（略）" }] } });
    await sleep(2500); // 止めたことが作業の行に出ている間を作る
    const t = deny
      ? "銀行のサイトは規約で自動操作が禁止のため、操作を止めました。入出金は freee やマネーフォワードの口座連携から取り込むか、ご自身で操作してください。"
      : "銀行のサイトから取ってきました。";
    await stream(t, false);
    return result(t);
  }
  if (text.includes("落ちて")) {
    // 途中まで書いたところで、完了の知らせ（result）を出さずに終わる（G-15。exit 0 でも終わったことにしない）
    await stream("途中まで書いた文です。ここから先は", true);
    await sleep(2000); // 途中の文が画面に届いてから終わる
    return process.exit(0);
  }
  if (text.includes("覚えて")) {
    const what = text.replace(/.*\n/s, "").replace(/(って|と)?覚えて.*/, "").trim() || "言われたこと";
    const t = `わかりました。次から「${what}」でいきます。\n\n[[覚える: ${what}]]`;
    await stream(t, false);
    return result(t);
  }
  const att = text.split("\n").filter((l) => l.startsWith("- "));
  if (att.length) {
    const t = `資料を受け取りました：\n\n${att.join("\n")}`;
    await stream(t, false);
    return result(t);
  }
  await stream(text.includes("長く") ? "とても長い作業をしています。" + "少しずつ書いています。".repeat(30) : REPLY, text.includes("長く"));
  result(text.includes("長く") ? "長い作業が終わりました。" : REPLY);
};
const drain = async () => {
  while (!waiting && queue.length) await onUser(queue.shift());
};
process.stdin.on("data", (c) => {
  const lines = (rest + c.toString()).split("\n");
  rest = lines.pop() ?? "";
  for (const ln of lines) {
    if (!ln.trim()) continue;
    const j = JSON.parse(ln);
    if (j.type === "user") {
      queue.push(j.message.content.map((x) => x.text).join(""));
      if (queue.length === 1 && !waiting) void (async () => { await drain(); })();
    }
    if (j.type === "control_response" && waiting && j.response.request_id === waiting.id) {
      const r = j.response.response;
      const w = waiting;
      waiting = null;
      void (async () => {
        if (w.kind === "ask") {
          const a = r.updatedInput?.answers ?? {};
          await stream(`答えをもらいました：${Object.entries(a).map(([k, v]) => `${k} → **${v}**`).join(" ／ ")}`, false);
          result(`答えをもらいました：${Object.entries(a).map(([k, v]) => `${k} → **${v}**`).join(" ／ ")}`);
        } else {
          const t = r.behavior === "allow" ? "消しました。" : `やめました（${r.message}）。`;
          await stream(t, false);
          result(t);
        }
        await drain();
      })();
    }
  }
});
process.stdin.on("end", () => process.exit(0));
