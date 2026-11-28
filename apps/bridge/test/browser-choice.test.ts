// K-366「Bridge の窓から AI が使うブラウザを選び直す」の Bridge 側の単体の試験。名前の頭の行 ID（K366-BR-…）は 11_tickets/K-366.md の表に結ぶ。
//   Kaname の代わりは手元の小さなサーバー（本物の網には出ない・pairing.test.ts と同じ形）。呼び方と、返事の読み方を見る。
//   K366-BR-006（窓のラジオを押す）は electron の窓なので人が確かめる。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import { chooseBrowserOnKaname } from "../src/browser-choice";
import { BRIDGE_UA } from "../src/pairing";
// 作り物の秘密の値は apps/bridge/test/_fake/secrets.ts に置いて import する（.gitleaks.toml が置き場だけを外す・K-328）
import { K366_BRIDGE_TOKEN } from "./_fake/secrets";

const TOKEN = K366_BRIDGE_TOKEN;
let server: Server;
let api = "";
let reply: { status: number; body: unknown } = { status: 201, body: {} };
const seen: { method: string; path: string; headers: IncomingHttpHeaders; body: string }[] = [];

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      seen.push({ method: req.method ?? "", path: req.url ?? "", headers: req.headers, body: raw });
      res.writeHead(reply.status, { "content-type": "application/json" });
      res.end(JSON.stringify(reply.body));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const a = server.address();
  api = `http://127.0.0.1:${typeof a === "object" && a ? a.port : 0}`;
});
afterAll(() => {
  server.close();
});

describe("K-366 Bridge が Kaname に選んだブラウザを送る（POST /api/v1/bridge/browser）", () => {
  it("K366-BR-001 2xx が返る：{ ok: true }。新しい口を 1 回だけ、PC の印・Bridge の印・{ browser } で呼ぶ", async () => {
    seen.length = 0;
    reply = { status: 201, body: { data: { browser: "dedicated" } } };
    expect(await chooseBrowserOnKaname(api, TOKEN, "dedicated")).toEqual({ ok: true });
    expect(seen).toHaveLength(1);
    expect(seen[0]!.method).toBe("POST");
    expect(seen[0]!.path).toBe("/api/v1/bridge/browser");
    expect(seen[0]!.headers["x-bridge-session"]).toBe(TOKEN);
    expect(seen[0]!.headers["user-agent"]).toBe(BRIDGE_UA);
    expect(JSON.parse(seen[0]!.body)).toEqual({ browser: "dedicated" });
  });

  it("K366-BR-002 3 つ以外の値（firefox・空）：送らずに ok は false", async () => {
    seen.length = 0;
    for (const b of ["firefox", ""]) {
      const r = await chooseBrowserOnKaname(api, TOKEN, b);
      expect(r.ok, b).toBe(false);
    }
    expect(seen).toHaveLength(0);
  });

  it("K366-BR-003 印が無い（null・空）：送らずに「Kaname につないでから選んでください」", async () => {
    seen.length = 0;
    for (const t of [null, ""]) {
      expect(await chooseBrowserOnKaname(api, t, "off")).toEqual({
        ok: false,
        message: "Kaname につないでから選んでください",
      });
    }
    expect(seen).toHaveLength(0);
  });

  it("K366-BR-004 401 は「つながりが切れています」、422・429・503 は「Kaname に届きませんでした（番号）」。どれも ok は false", async () => {
    reply = { status: 401, body: { error: "unauthenticated", code: "UNAUTHENTICATED" } };
    expect(await chooseBrowserOnKaname(api, TOKEN, "off")).toEqual({
      ok: false,
      message: "この PC のつながりが切れています。つなぎ直してください",
    });
    for (const status of [422, 429, 503]) {
      reply = { status, body: { error: "x", code: "X" } };
      expect(await chooseBrowserOnKaname(api, TOKEN, "off"), String(status)).toEqual({
        ok: false,
        message: `Kaname に届きませんでした（${status}）`,
      });
    }
  });

  it("K366-BR-005 届かない（つながらない番地・fetch が投げる）：「Kaname に届きませんでした」。渡す signal は時間で止まる AbortSignal", async () => {
    let signal: AbortSignal | null | undefined;
    const throwing = (async (_u: unknown, init?: RequestInit) => {
      signal = init?.signal;
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    expect(await chooseBrowserOnKaname(api, TOKEN, "off", throwing)).toEqual({
      ok: false,
      message: "Kaname に届きませんでした",
    });
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(await chooseBrowserOnKaname("http://127.0.0.1:1", TOKEN, "off")).toEqual({
      ok: false,
      message: "Kaname に届きませんでした",
    });
  });
});
