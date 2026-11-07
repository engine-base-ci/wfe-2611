// K-62「AI に任せる」の Bridge の側の試験：Bridge の輪（loop）が契約の口（/api/v1/bridge/jobs/…）を呼び、チケットの仕事を最後まで運ぶ。
//   偽の Kaname（HTTP）と偽の CLI（fake-claude.mjs）で通す。名前の頭の行 ID（K62-BRG-…）は 11_tickets/K-62.md の表に結ぶ。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。前の道すじ（/api/auth-ext/bridge/take など）は K-62 で消える。
import { createServer, type Server } from "node:http";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BRIDGE_PROTOCOL, startLoop } from "../src/loop";
import { forgetClaude } from "../src/runner";
import { MCP_SERVER_SOURCE, TOOL_DEFS } from "../src/kaname-tools";

type Hit = { method: string; path: string; body: Record<string, unknown>; headers: Record<string, string> };
let server: Server;
let base = "";
let hits: Hit[] = [];
let jobs: Record<string, unknown>[] = [];
let token = "";
let control: { stop: boolean; reason?: string } = { stop: false };
/** finish を何回わざと落とすか（回線が切れた・Kaname が一時的に落ちた） */
let finishFailures = 0;
/** take に 401 を返す（PC の接続が切れた・人が外された） */
let takeGone = false;

const JOB_ID = "62626262-0000-4000-8000-000000000001";
const ticketJob = (prompt: string) => ({
  job_id: JOB_ID,
  kind: "ticket",
  ticket_id: "62626262-0000-4000-8000-0000000000aa",
  prompt,
  agent_session_id: null,
  conversation_id: null,
  permission_mode: "manual",
  model: null,
  effort: null,
  tools: null,
  allowed_tools: [],
  attachments: [],
  credential_id: null,
  memories: [],
  tool_token: "t".repeat(43),
  conventions: null,
  browser: "off",
});

beforeAll(async () => {
  process.env["KANAME_CLAUDE_BIN"] = join(__dirname, "fake-claude.mjs");
  forgetClaude();
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const path = req.url ?? "";
      const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      hits.push({ method: req.method ?? "", path, body, headers: req.headers as Record<string, string> });
      const send = (data: unknown, status = 200) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(status < 300 ? { data } : data));
      };
      const mine = req.headers["x-bridge-session"] === token;
      if (path === "/api/v1/bridge/heartbeat") return send({ ok: true, browser: "off", outdated: false }, 201);
      if (path === "/api/v1/bridge/jobs/take") {
        if (takeGone) return send({ error: "unauthenticated", code: "UNAUTHENTICATED" }, 401);
        return send(
          { job: mine ? (jobs.shift() ?? null) : null, forbidden_domains: [], next_ms: 50, outdated: false },
          201,
        );
      }
      if (path === `/api/v1/bridge/jobs/${JOB_ID}/control`)
        return send({ stop: control.stop, reason: control.reason ?? null, steers: [] });
      if (path === `/api/v1/bridge/jobs/${JOB_ID}/finish` && finishFailures > 0) {
        finishFailures -= 1;
        return send({ error: "internal", code: "E-PAGE-003" }, 503);
      }
      if (path.startsWith("/api/v1/bridge/jobs/")) return send({ ok: true, outcome: "awaiting_approval" }, 201);
      return send({ ok: true });
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const a = server.address();
  base = `http://127.0.0.1:${typeof a === "object" && a ? a.port : 0}`;
});
afterAll(() => {
  server.close();
  delete process.env["KANAME_CLAUDE_BIN"];
  forgetClaude();
});

const runOne = async (
  job: Record<string, unknown> | null,
  until: (h: Hit[]) => boolean,
  o: { onGone?: () => void } = {},
) => {
  hits = [];
  jobs = job ? [job] : [];
  token = `kpc_${crypto.randomUUID().replace(/-/g, "").padEnd(43, "x").slice(0, 43)}`;
  const mine = token;
  const stop = startLoop({
    apiBase: base,
    sessionId: () => mine,
    health: async () => ({}),
    onChange: () => undefined,
    onGone: o.onGone ?? (() => undefined),
  });
  const t0 = Date.now();
  while (!until(hits) && Date.now() - t0 < 10_000) await new Promise((r) => setTimeout(r, 50));
  stop();
  return hits;
};
const finishes = (h: Hit[]) => h.filter((x) => x.path === `/api/v1/bridge/jobs/${JOB_ID}/finish`);
const finished = (h: Hit[]) => finishes(h).some((x) => x.method === "POST");

describe("K-62 Bridge が契約の口でチケットの仕事を運ぶ", { timeout: 30_000 }, () => {
  it("K62-BRG-001 取る・様子・終わるを契約の口で呼ぶ（体に仕事の id を入れない・PC の印を頭で送る・約束の版は 5）。前の道すじは呼ばない", async () => {
    control = { stop: false };
    const h = await runOne(ticketJob("見積を作る"), finished);
    expect(BRIDGE_PROTOCOL).toBe(5);
    const take = h.find((x) => x.path === "/api/v1/bridge/jobs/take")!;
    expect(take.method).toBe("POST");
    expect(take.body).toMatchObject({ protocol: 5 });
    expect(take.headers["x-bridge-session"]).toBe(token);
    const prog = h.filter((x) => x.path === `/api/v1/bridge/jobs/${JOB_ID}/progress`);
    expect(prog.length).toBeGreaterThan(0);
    for (const p of prog) expect(p.body).not.toHaveProperty("job_id");
    const fin = finishes(h)[0]!;
    expect(fin.body).toMatchObject({ state: "done", result: "答え:見積を作る" }); // 偽の CLI は「答え:<プロンプトの 1 行目>」を返す
    expect(fin.body).not.toHaveProperty("job_id");
    // K-62 が消した前の道すじ 5 本だけを見る（書きかけの返事 partial・区切りの一言 steers などは K-62 の範囲の外で、まだ前の道すじ）
    const gone = ["/take", "/progress", "/finish", "/control", "/tool"].map((x) => `/api/auth-ext/bridge${x}`);
    expect(h.filter((x) => gone.includes(x.path)).map((x) => x.path)).toEqual([]);
  });

  it("K62-BRG-002 止める合図は GET …/control で見る。理由が付いていれば、その理由で止まったと送る（チケットが消された・権限が無くなった）", async () => {
    control = { stop: true, reason: "チケットが消されたので止めました" };
    const h = await runOne(ticketJob("SLOW 見積"), finished);
    const ctl = h.filter((x) => x.path === `/api/v1/bridge/jobs/${JOB_ID}/control`);
    expect(ctl.length).toBeGreaterThan(0);
    expect(ctl.every((x) => x.method === "GET")).toBe(true);
    const fin = finishes(h)[0]!;
    expect(fin.body["state"]).toBe("stopped");
    expect(String(fin.body["reason"])).toContain("チケットが消されたので止めました");
    control = { stop: false };
  });

  it("K62-BRG-003 Claude Code が合図を出さずに終わった：完了にせず「何も返さずに終わりました」で止まったと送る（E-SIG-002・G-15）", async () => {
    const h = await runOne(ticketJob("SILENT"), finished);
    const fin = finishes(h)[0]!;
    expect(fin.body["state"]).toBe("stopped");
    expect(String(fin.body["reason"])).toContain("Claude Code が何も返さずに終わりました");
  });

  it("K62-BRG-004 finish が届かない（503）：同じ冪等キーで送り直す。結末は捨てない", async () => {
    finishFailures = 2;
    const h = await runOne(ticketJob("見積を作る"), (x) => finishes(x).length >= 3);
    const keys = finishes(h).map((x) => x.headers["idempotency-key"]);
    expect(keys.length).toBeGreaterThanOrEqual(3);
    expect(keys[0]).toBeTruthy();
    expect(new Set(keys).size).toBe(1);
    finishFailures = 0;
  });

  it("K62-BRG-005 結果が 200000 字を超える：送らずに止まった「結果が長すぎて受け取れません」で送り直す", async () => {
    const h = await runOne(ticketJob(`見積 ${"あ".repeat(200_001)}`), finished);
    const fin = finishes(h)[0]!;
    expect(fin.body["state"]).toBe("stopped");
    expect(String(fin.body["reason"])).toContain("結果が長すぎて受け取れません");
    expect(String(fin.body["result"] ?? "").length).toBeLessThanOrEqual(200_000);
  });

  it("K62-BRG-006 PC の口が 401（PC の接続が切れた・人が外された）：覚えている印を捨てる（G-14）", async () => {
    takeGone = true;
    let gone = 0;
    await runOne(null, () => gone > 0, { onGone: () => (gone += 1) });
    takeGone = false;
    expect(gone).toBeGreaterThan(0);
  });

  it("K62-BRG-007 道具 ticket_read を自分のAI に渡す。道具のサーバーは PC の印を持たず、前の道すじも呼ばない", () => {
    expect(TOOL_DEFS.map((t) => t.name)).toContain("ticket_read");
    expect(MCP_SERVER_SOURCE).not.toContain("x-bridge-session");
    expect(MCP_SERVER_SOURCE).not.toContain("/api/auth-ext/bridge/tool");
  });
});
