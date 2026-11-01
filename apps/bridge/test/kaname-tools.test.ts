// 自分のAI に渡す Kaname の道具（D-110）。引数の並び・聞かずに使える・道具のサーバーを本物の node で動かして Kaname に書く
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer, type Server } from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KANAME_TOOL_RULE, TOOL_DEFS, toolArgs, writeMcpServer } from "../src/kaname-tools";
import { buildArgs } from "../src/runner";
import { label } from "../src/stream";

const TOOLS = { serverPath: "/tmp/kaname-tools-mcp.cjs", nodeBin: "/usr/bin/node", apiBase: "http://127.0.0.1:3011" };
const job = { job_id: "j", prompt: "p", agent_session_id: null, conversation_id: "c", permission_mode: "manual", tool_token: "tok-123456789012345678901234" };

describe("Claude Code に渡す引数（D-110.1・D-110.4）", () => {
  it("CHT-25-001 CHT-25-006 鍵のある仕事にだけ --mcp-config で kaname を渡し、鍵は道具のサーバーの環境にだけ入る", () => {
    const a = toolArgs(TOOLS, job.tool_token);
    expect(a[0]).toBe("--mcp-config");
    const cfg = JSON.parse(a[1]!) as { mcpServers: { kaname: { command: string; args: string[]; env: Record<string, string> } } };
    expect(cfg.mcpServers.kaname).toMatchObject({ command: "/usr/bin/node", args: [TOOLS.serverPath], env: { KANAME_API_BASE: TOOLS.apiBase, KANAME_TOOL_TOKEN: job.tool_token } });
    expect(Object.keys(cfg.mcpServers.kaname.env).sort(), "渡るのは宛先と鍵だけ（資格情報・Bridge の session は無い）").toEqual(
      process.versions["electron"] ? ["ELECTRON_RUN_AS_NODE", "KANAME_API_BASE", "KANAME_TOOL_TOKEN"] : ["KANAME_API_BASE", "KANAME_TOOL_TOKEN"],
    );
    expect(a[1]).not.toMatch(/session|vault|password|secret/i);
    expect(toolArgs(TOOLS, null)).toEqual([]);
    expect(toolArgs(null, job.tool_token)).toEqual([]);
  });
  it("CHT-25-004 毎回聞くでも Kaname の道具は聞かずに使える。可変長の --mcp-config の後ろは別の引数、--allowedTools は最後", () => {
    const args = buildArgs({ ...job, allowed_tools: ["Bash(git status)"] }, [], null, TOOLS);
    const i = args.indexOf("--mcp-config");
    expect(i).toBeGreaterThan(0);
    expect(args[i + 2]).toBe("--append-system-prompt");
    expect(args).toContain("manual");
    expect(args.slice(args.indexOf("--allowedTools") + 1)).toEqual(["Bash(git status)", KANAME_TOOL_RULE]);
    // 鍵の無い仕事（会話でない）には道具も許可も足さない
    const none = buildArgs({ ...job, tool_token: null }, [], null, TOOLS);
    expect(none).not.toContain("--mcp-config");
    expect(none).not.toContain(KANAME_TOOL_RULE);
  });
  it("CHT-30-004 Kaname が渡した会話の決まりを使い、無ければ Bridge の控えを使う", () => {
    const a = buildArgs({ ...job, conventions: "決まり：絵文字は使わない" }, [], null, TOOLS);
    expect(a[a.indexOf("--append-system-prompt") + 1]).toBe("決まり：絵文字は使わない");
    const b = buildArgs({ ...job, conventions: null }, [], null, TOOLS);
    expect(b[b.indexOf("--append-system-prompt") + 1]).toContain("あなたは Kaname の画面の中で");
  });
  it("作業の行は人が読む言葉で出る", () => {
    expect(label("mcp__kaname__goal_set")).toBe("たたき台に目標を置いています");
    expect(label("mcp__kaname__remember")).toBe("覚えています");
    expect(label("mcp__other__goal_set")).toBe("「goal_set」を使っています");
    expect(label("ToolSearch")).toBe("使う道具を探しています");
  });
});

describe("道具のサーバーを本物の node で動かす（D-110.3）", () => {
  let api: Server;
  let base = "";
  const got: { token: string; body: { name: string; input: Record<string, unknown> } }[] = [];
  beforeAll(async () => {
    api = createServer((req, res) => {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        const body = JSON.parse(raw || "{}") as { name: string; input: Record<string, unknown> };
        got.push({ token: String(req.headers["x-kaname-tool-token"] ?? ""), body });
        res.setHeader("content-type", "application/json");
        if (!body.input["name"] && body.name === "goal_set") {
          res.statusCode = 422;
          return res.end(JSON.stringify({ message: "目標の名前が要ります" }));
        }
        res.end(JSON.stringify({ data: { id: "g-1", done: "created", name: body.input["name"] } }));
      });
    });
    await new Promise<void>((r) => api.listen(0, "127.0.0.1", () => r()));
    const a = api.address();
    base = `http://127.0.0.1:${typeof a === "object" && a ? a.port : 0}`;
  });
  afterAll(() => api.close());

  /** サーバーを起こし、1 通送って 1 通受ける */
  function start(): { p: ChildProcessWithoutNullStreams; ask: (m: unknown) => Promise<Record<string, unknown>> } {
    const script = writeMcpServer(mkdtempSync(join(tmpdir(), "kaname-mcp-")));
    const p = spawn(process.execPath, [script], { env: { PATH: process.env["PATH"], KANAME_API_BASE: base, KANAME_TOOL_TOKEN: "tok-xyz" } });
    let buf = "";
    const waiting: ((m: Record<string, unknown>) => void)[] = [];
    p.stdout.on("data", (c: Buffer) => {
      buf += c.toString();
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const ln = buf.slice(0, i);
        buf = buf.slice(i + 1);
        if (ln.trim()) waiting.shift()?.(JSON.parse(ln) as Record<string, unknown>);
      }
    });
    const ask = (m: unknown) => new Promise<Record<string, unknown>>((res) => (waiting.push(res), p.stdin.write(JSON.stringify(m) + "\n")));
    return { p, ask };
  }

  it("始めの挨拶と道具の一覧に答え、呼ばれたら鍵を付けて Kaname に書き、答えを返す", async () => {
    const { p, ask } = start();
    try {
      const init = await ask({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } } });
      expect(init).toMatchObject({ id: 1, result: { protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "kaname" } } });
      p.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n"); // 通知には答えない
      const list = (await ask({ jsonrpc: "2.0", id: 2, method: "tools/list" })) as { result: { tools: { name: string }[] } };
      expect(list.result.tools.map((t) => t.name)).toEqual(TOOL_DEFS.map((t) => t.name));
      const call = (await ask({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "goal_set", arguments: { name: "今期の売上", target_value: 100 } } })) as {
        id: number; result: { content: { text: string }[]; isError?: boolean };
      };
      expect(call.id).toBe(3);
      expect(call.result.isError).toBeUndefined();
      expect(JSON.parse(call.result.content[0]!.text)).toEqual({ id: "g-1", done: "created", name: "今期の売上" });
      expect(got.at(-1)).toEqual({ token: "tok-xyz", body: { name: "goal_set", input: { name: "今期の売上", target_value: 100 } } });
    } finally {
      p.kill();
    }
  });
  it("Kaname が断ったら理由つきの失敗として返す。知らない道具は Kaname に行かずに失敗", async () => {
    const { p, ask } = start();
    try {
      const bad = (await ask({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "goal_set", arguments: {} } })) as { result: { content: { text: string }[]; isError: boolean } };
      expect(bad.result).toEqual({ content: [{ type: "text", text: "Kaname に置けませんでした：目標の名前が要ります" }], isError: true });
      const before = got.length;
      const unk = (await ask({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "rm_rf", arguments: {} } })) as { result: { isError: boolean } };
      expect(unk.result.isError).toBe(true);
      expect(got.length).toBe(before);
    } finally {
      p.kill();
    }
  });
});

describe("覚える道具の形（D-114）", () => {
  it("CHT-34-005 remember の説明は「項目：内容」の形を求める（「1 件 1 文」だと文で書かれ、分かったことが項目と内容に分かれない・2026-09-29 本物で実測）", () => {
    const r = TOOL_DEFS.find((t) => t.name === "remember")!;
    expect(r.description).toContain("「項目：内容」");
    expect(JSON.stringify(r.inputSchema)).toContain("「項目：内容」");
    expect(r.description).not.toContain("1 件 1 文");
  });
});

// T-B-41 成果物を渡す道具（D-121）：PC のファイルを読んでそのまま Kaname に送る。ホームの外・無いファイル・大きいファイルは Kaname に送らない
describe("CHT-41-004 artifact_put の道具のサーバー（D-121）", () => {
  let srv: Server;
  let base = "";
  const got: { url: string; headers: Record<string, string | string[] | undefined>; body: Buffer }[] = [];
  let proc: ChildProcessWithoutNullStreams | null = null;
  const dir = mkdtempSync(join(tmpdir(), "kaname-art-"));
  beforeAll(async () => {
    srv = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => chunks.push(c));
      req.on("end", () => {
        got.push({ url: req.url ?? "", headers: req.headers, body: Buffer.concat(chunks) });
        res.writeHead(201, { "content-type": "application/json" });
        res.end(JSON.stringify({ data: { id: "art-1", title: "x", format: "png", version: 1 } }));
      });
    });
    await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${(srv.address() as { port: number }).port}`;
  });
  afterAll(() => {
    proc?.kill();
    srv.close();
  });
  const rpc = (() => {
    let id = 0;
    const waiters: ((m: { result?: { isError?: boolean; content: { text: string }[]; tools?: { name: string }[] } }) => void)[] = [];
    let rest = "";
    return async (method: string, params: unknown) => {
      if (!proc) {
        proc = spawn(process.execPath, [writeMcpServer(dir)], { env: { ...process.env, KANAME_API_BASE: base, KANAME_TOOL_TOKEN: "tok-123456789012345678901234" } });
        proc.stdout.setEncoding("utf8");
        proc.stdout.on("data", (c: string) => {
          const lines = (rest + c).split("\n");
          rest = lines.pop() ?? "";
          for (const ln of lines) if (ln.trim()) waiters.shift()?.(JSON.parse(ln));
        });
      }
      return new Promise<{ result?: { isError?: boolean; content: { text: string }[]; tools?: { name: string }[] } }>((res) => {
        waiters.push(res);
        proc!.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params })}\n`);
      });
    };
  })();
  it("一覧に artifact_put がある。一時フォルダのファイルはそのまま（名前は URL エンコード・中身は同じ）Kaname に届く", async () => {
    const { writeFileSync } = await import("node:fs");
    const list = await rpc("tools/list", {});
    expect(list.result?.tools?.map((t) => t.name)).toContain("artifact_put");
    const file = join(dir, "請求のまとめ.png");
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4, 5]);
    writeFileSync(file, bytes);
    const r = await rpc("tools/call", { name: "artifact_put", arguments: { path: file, title: "請求のグラフ" } });
    expect(r.result?.isError).toBeFalsy();
    expect(JSON.parse(r.result!.content[0]!.text)).toMatchObject({ id: "art-1" });
    expect(got).toHaveLength(1);
    expect(got[0]!.url).toBe("/api/auth-ext/bridge/artifact");
    expect(got[0]!.headers["x-kaname-tool-token"]).toBe("tok-123456789012345678901234");
    expect(decodeURIComponent(String(got[0]!.headers["x-artifact-name"]))).toBe("請求のまとめ.png");
    expect(decodeURIComponent(String(got[0]!.headers["x-artifact-title"]))).toBe("請求のグラフ");
    expect(got[0]!.body.equals(bytes)).toBe(true);
    expect(JSON.stringify(got[0]!.headers)).not.toMatch(/session|vault|password|secret/i);
  });
  it("ホームの外・無いファイル・path 無し・フォルダ は Kaname に送らずに理由を返す", async () => {
    const n = got.length;
    for (const [args, re] of [
      [{ path: "/etc/hosts" }, /ホームの中/],
      [{ path: join(dir, "無い.png") }, /ありません/],
      [{}, /path/],
      [{ path: dir }, /ファイルではありません/],
    ] as const) {
      const r = await rpc("tools/call", { name: "artifact_put", arguments: args });
      expect(r.result?.isError, JSON.stringify(args)).toBe(true);
      expect(r.result!.content[0]!.text).toMatch(re);
    }
    expect(got.length, "Kaname には何も送っていない").toBe(n);
  });
});

