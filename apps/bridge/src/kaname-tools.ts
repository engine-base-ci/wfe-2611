// 自分のAI に渡す Kaname の道具（D-110）。本人の Claude Code に MCP の「kaname」として渡す。
//   道具を呼ぶと、この仕事の間だけ効く鍵で Kaname の API（/bridge/tool）に書く。資格情報は渡さない（D-110.6）
//   道具のサーバーは素の node で動く小さな台本（stdio・JSON-RPC）。Bridge が一時フォルダに書き、Electron の node で動かす
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}
const s = (description: string) => ({ type: "string", description });
const arr = (description: string) => ({ type: "array", items: { type: "string" }, description });
const ID = s("直す・外すときの id（draft_read か、置いたときの答えにある）。新しく置くときは付けない");

/** 道具の一覧（名前・説明・入力の形）。説明は自分のAI が読む */
export const TOOL_DEFS: ToolDef[] = [
  { name: "draft_read", description: "いまのたたき台（会社の目標・台帳・担当業務とAI社員）を読む。置く前・直す前に見る", inputSchema: { type: "object", properties: {} } },
  {
    name: "goal_set",
    description: "会社の目標を 1 つ置く・直す。聞き取った目標は必ずこれで置く（置かないと Kaname に残らない）。id を付けると直す",
    inputSchema: {
      type: "object",
      properties: {
        id: ID,
        name: s("目標の名前（例：今期の売上・今期の成約数）"),
        target_value: { type: "number", description: "目標の数（例：12000000）" },
        unit: s("単位（例：円・件・%）"),
        period_start: s("期間の始まり YYYY-MM-DD"),
        period_end: s("期間の終わり YYYY-MM-DD"),
      },
    },
  },
  { name: "goal_remove", description: "置いた目標を外す", inputSchema: { type: "object", properties: { id: ID }, required: ["id"] } },
  {
    name: "ledger_set",
    description: "台帳（仕事の流れを記録する表。例：案件台帳）を 1 つ置く・直す。段階（流れ）と項目（列）を持つ。id を付けると直す",
    inputSchema: {
      type: "object",
      properties: { id: ID, name: s("台帳の名前（例：案件台帳）"), stages: arr("段階を流れの順に（例：引き合い・見積・受注・納品）"), fields: arr("項目（例：取引先・金額・納期）") },
    },
  },
  { name: "ledger_remove", description: "置いた台帳を外す", inputSchema: { type: "object", properties: { id: ID }, required: ["id"] } },
  {
    name: "duty_set",
    description: "担当業務（AI社員に任せる仕事）を 1 つ置く・直す。staff に AI社員の名前を書くと、その AI社員（いなければ作る）に持たせる。id を付けると直す",
    inputSchema: {
      type: "object",
      properties: { id: ID, name: s("担当業務の名前（例：見積の下書き）"), definition: s("何をするか。1 行目が要約として出る"), staff: s("持たせる AI社員の名前（例：見積さん）") },
    },
  },
  { name: "duty_remove", description: "置いた担当業務を外す", inputSchema: { type: "object", properties: { id: ID }, required: ["id"] } },
  { name: "remember", description: "本人から聞いた会社のこと（事業・顧客・体制・困りごと 等）を記憶に残す。1 件＝事実 1 つで、形は「項目：内容」（例：案件の入口：紹介と営業会社からの商談確約）。画面の「分かったこと」に項目と内容に分けて並ぶ", inputSchema: { type: "object", properties: { items: arr("覚えること（1 件 1 つ。「項目：内容」の形。例：社員数：3 人）") }, required: ["items"] } },
];
/** 許可のモードに関わらず聞かずに使える道具（本人の会社のたたき台に書くだけ・外に出ない・D-110.4） */
export const KANAME_TOOL_RULE = "mcp__kaname";

/** 道具のサーバー（stdio・JSON-RPC 2.0）。1 行 1 通。呼ばれたら Kaname の API に書く */
export const MCP_SERVER_SOURCE = `// Kaname Bridge が書いた道具のサーバー（D-110）。手で直さない
const TOOLS = ${JSON.stringify(TOOL_DEFS)};
const API = process.env.KANAME_API_BASE || "";
const TOKEN = process.env.KANAME_TOOL_TOKEN || "";
let rest = "";
const send = (m) => process.stdout.write(JSON.stringify(m) + "\\n");
const reply = (id, result) => send({ jsonrpc: "2.0", id, result });
const text = (t, isError) => ({ content: [{ type: "text", text: t }], ...(isError ? { isError: true } : {}) });
async function call(id, name, input) {
  try {
    const r = await fetch(API + "/api/auth-ext/bridge/tool", {
      method: "POST",
      headers: { "content-type": "application/json", "x-kaname-tool-token": TOKEN },
      body: JSON.stringify({ name, input: input || {} }),
      signal: AbortSignal.timeout(20000),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return reply(id, text("Kaname に置けませんでした：" + (j.message || ("Kaname が " + r.status)), true));
    reply(id, text(JSON.stringify(j.data ?? null)));
  } catch (e) {
    reply(id, text("Kaname に届きませんでした（" + (e && e.message ? e.message : "不明") + "）", true));
  }
}
function onMessage(m) {
  if (!m || m.id === undefined || m.id === null) return; // 通知には答えない
  if (m.method === "initialize")
    return reply(m.id, { protocolVersion: (m.params && m.params.protocolVersion) || "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "kaname", version: "1" } });
  if (m.method === "tools/list") return reply(m.id, { tools: TOOLS });
  if (m.method === "tools/call") {
    const name = m.params && m.params.name;
    if (!TOOLS.some((t) => t.name === name)) return reply(m.id, text("その道具はありません：" + name, true));
    return void call(m.id, name, m.params.arguments);
  }
  if (m.method === "ping") return reply(m.id, {});
  send({ jsonrpc: "2.0", id: m.id, error: { code: -32601, message: "method not found" } });
}
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => {
  const lines = (rest + c).split("\\n");
  rest = lines.pop() || "";
  for (const ln of lines) {
    if (!ln.trim()) continue;
    try { onMessage(JSON.parse(ln)); } catch {}
  }
});
process.stdin.on("end", () => process.exit(0));
`;

/** サーバーの台本を置く（中身が同じなら書き直さない）。置いた場所を返す */
export function writeMcpServer(dir: string): string {
  const path = join(dir, "kaname-tools-mcp.cjs");
  try {
    if (existsSync(path) && readFileSync(path, "utf8") === MCP_SERVER_SOURCE) return path;
  } catch {
    /* 読めなければ書き直す */
  }
  writeFileSync(path, MCP_SERVER_SOURCE, { mode: 0o644 });
  return path;
}

export interface KanameTools {
  serverPath: string;
  nodeBin: string;
  apiBase: string;
}

/** Kaname の道具のサーバー 1 台分。鍵が無い仕事（会話でない）には無い */
export function kanameServer(k: KanameTools | null | undefined, token: string | null | undefined): Record<string, unknown> | null {
  if (!k || !token) return null;
  return {
    command: k.nodeBin,
    args: [k.serverPath],
    env: { KANAME_API_BASE: k.apiBase, KANAME_TOOL_TOKEN: token, ...(process.versions["electron"] ? { ELECTRON_RUN_AS_NODE: "1" } : {}) },
  };
}

/** Claude Code に渡す引数（--mcp-config）。渡すサーバーが無ければ何も足さない。1 本の設定にまとめる（D-110・D-119） */
export function mcpArgs(servers: Record<string, Record<string, unknown> | null>): string[] {
  const on = Object.fromEntries(Object.entries(servers).filter(([, v]) => v !== null));
  return Object.keys(on).length ? ["--mcp-config", JSON.stringify({ mcpServers: on })] : [];
}

/** Kaname の道具だけの --mcp-config（互換） */
export function toolArgs(k: KanameTools | null | undefined, token: string | null | undefined): string[] {
  return mcpArgs({ kaname: kanameServer(k, token) });
}
