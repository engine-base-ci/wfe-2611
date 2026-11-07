// K-62「AI に任せる」：Bridge の手元の口（道具の中継・決める人の答え 3・2026-11-07）の試験。
//   道具のサーバー（Claude Code の子）は道具の鍵だけを持ち、この口（127.0.0.1）へ送る。Bridge が PC の印を足して契約の口へ回す。
//   AI に長く効く PC の印を渡さない。名前の頭の行 ID（K62-BRG-…）は 11_tickets/K-62.md の表に結ぶ。
//   試験が決める形：apps/bridge/src/tool-relay.ts の
//     startToolRelay({ apiBase, deviceToken: () => string | null, current: () => { jobId, toolToken, tools } | null })
//       → Promise<{ url: string; address: () => AddressInfo; close: () => Promise<void> }>（address は待ち受けているアドレス）
//     POST {url}/tools/:name（頭 x-kaname-tool-token・体 { input }）→ 契約の POST /api/v1/bridge/jobs/:jobId/tools/:name へ回す
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startToolRelay } from "../src/tool-relay";
import { MCP_SERVER_SOURCE, kanameServer, toolDefsFor } from "../src/kaname-tools";
import { childEnv } from "../src/env";

const PC_TOKEN = `kpc_${"P".repeat(43)}`;
const TOOL_TOKEN = "t".repeat(43);
const JOB = "62626262-0000-4000-8000-000000000002";
type Hit = { path: string; headers: Record<string, string | string[] | undefined>; body: string };
let upstream: Server;
let apiBase = "";
let hits: Hit[] = [];
let current: { jobId: string; toolToken: string; tools: string[] } | null = null;
let relay: { url: string; address: () => AddressInfo; close: () => Promise<void> };

beforeAll(async () => {
  upstream = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      hits.push({ path: req.url ?? "", headers: req.headers, body: raw });
      res.writeHead(201, { "content-type": "application/json" });
      res.end(JSON.stringify({ data: { result: { sections: [] } } }));
    });
  });
  await new Promise<void>((r) => upstream.listen(0, "127.0.0.1", r));
  const a = upstream.address();
  apiBase = `http://127.0.0.1:${typeof a === "object" && a ? a.port : 0}`;
  relay = await startToolRelay({ apiBase, deviceToken: () => PC_TOKEN, current: () => current });
});
afterAll(async () => {
  await relay?.close();
  upstream.close();
});

const call = (name: string, token: string | null, input: unknown = {}) =>
  fetch(`${relay.url}/tools/${name}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token === null ? {} : { "x-kaname-tool-token": token }) },
    body: JSON.stringify({ input }),
  });

describe("K-62 Bridge の手元の口（道具の中継）", () => {
  it("K62-BRG-008 鍵が合い、今の仕事の道具なら契約の口へ回す：PC の印と道具の鍵を頭に足し、道すじは今の仕事の id", async () => {
    hits = [];
    current = { jobId: JOB, toolToken: TOOL_TOKEN, tools: ["ticket_read"] };
    const r = await call("ticket_read", TOOL_TOKEN, { section: "purpose" });
    expect(r.status).toBe(201);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.path).toBe(`/api/v1/bridge/jobs/${JOB}/tools/ticket_read`);
    expect(hits[0]!.headers["x-bridge-session"]).toBe(PC_TOKEN);
    expect(hits[0]!.headers["x-kaname-tool-token"]).toBe(TOOL_TOKEN);
    expect(JSON.parse(hits[0]!.body)).toEqual({ input: { section: "purpose" } });
    // 答えに PC の印を載せない
    expect(await r.text()).not.toContain(PC_TOKEN);
  });

  it("K62-BRG-009 鍵なしは 401・鍵違いは 403・仕事が無いときは 403・今の仕事に無い道具は 403。どれも契約の口へは回さない", async () => {
    hits = [];
    current = { jobId: JOB, toolToken: TOOL_TOKEN, tools: ["ticket_read"] };
    expect((await call("ticket_read", null)).status).toBe(401);
    expect((await call("ticket_read", "x".repeat(43))).status).toBe(403);
    expect((await call("goal_set", TOOL_TOKEN)).status).toBe(403); // チケットの仕事に会話の道具は無い
    current = null;
    expect((await call("ticket_read", TOOL_TOKEN)).status).toBe(403);
    expect(hits).toHaveLength(0);
  });

  it("K62-BRG-010 口は 127.0.0.1 だけで待ち受ける（0.0.0.0・:: で開かない）", () => {
    const a = relay.address();
    expect(a.address).toBe("127.0.0.1");
    expect(a.family).toBe("IPv4");
    expect(new URL(relay.url)).toMatchObject({ hostname: "127.0.0.1", port: String(a.port), protocol: "http:" });
  });

  it("K62-BRG-011 Claude Code の子に渡す環境と道具のサーバーの設定に、PC の印が入らない（道具のサーバーが知るのは手元の口と道具の鍵だけ）", () => {
    const srv = kanameServer({ serverPath: "/tmp/kaname-tools.js", nodeBin: "node", apiBase: relay.url }, TOOL_TOKEN);
    const text = JSON.stringify(srv);
    expect(text).not.toContain(PC_TOKEN);
    expect(text).toContain(relay.url);
    // 子の環境：Bridge が誤って PC の印を足しても、kpc_ の値は落とす
    const env = childEnv(
      "/usr/bin",
      { KANAME_DEVICE_TOKEN: PC_TOKEN, X_BRIDGE_SESSION: PC_TOKEN },
      {
        HOME: "/home/u",
        KANAME_BRIDGE_SESSION: PC_TOKEN,
      },
    );
    expect(Object.values(env).some((v) => typeof v === "string" && v.includes("kpc_"))).toBe(false);
  });

  it("K62-BRG-012 自分のAI に見せる道具は仕事の種類で分ける：チケットの仕事は ticket_read だけ、会話の仕事に ticket_read は出さない（呼べない道具を見せない）", () => {
    expect(toolDefsFor("ticket").map((t) => t.name)).toEqual(["ticket_read"]);
    const chat = toolDefsFor("chat").map((t) => t.name);
    expect(chat).not.toContain("ticket_read");
    expect(chat).toEqual(expect.arrayContaining(["draft_read", "goal_set", "remember"]));
    // 道具のサーバーには、その仕事の道具の名前だけを渡し、tools/list はそれだけを返す
    const srv = kanameServer(
      { serverPath: "/tmp/kaname-tools.js", nodeBin: "node", apiBase: relay.url },
      TOOL_TOKEN,
      "ticket",
    ) as {
      env: Record<string, string>;
    };
    expect(srv.env["KANAME_TOOLS"]).toBe("ticket_read");
    expect(MCP_SERVER_SOURCE).toContain("KANAME_TOOLS");
  });
});
