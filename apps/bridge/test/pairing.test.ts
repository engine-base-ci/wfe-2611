// K-57「PC をつなぐ」の Bridge 側の単体の試験。名前の頭の行 ID（K57-BR-…）は 11_tickets/K-57.md の表のマスに結ぶ。
//   Kaname の代わりは手元の小さなサーバー（本物の網には出ない）。引き取りの口・新しい版の口の呼び方と、返事の読み方を見る
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { hostname, tmpdir } from "node:os";
import { join } from "node:path";
import { BRIDGE_UA, claimCode, claimReply, defaultDeviceLabel, loadMachineId, MACHINE_ID_FILE } from "../src/pairing";
import { fetchLatest, startUpdater } from "../src/update";
import { startLocalServer } from "../src/local";

const TOKEN = `kpc_${"a".repeat(43)}`;
const MID = "6f1c2a9e-3b4d-4e5f-8a7b-0c1d2e3f4a5b"; // この PC の印（D-128.174・入れたときに PC の中で作る UUID）
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
let server: Server;
let api = "";
let reply: { status: number; body: unknown } = { status: 201, body: {} };
const seen: { path: string; headers: IncomingHttpHeaders; body: string }[] = [];
beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      seen.push({ path: req.url ?? "", headers: req.headers, body: raw });
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

describe("K-57 Bridge が接続コードを渡す（POST /api/v1/bridge/claim）", () => {
  it("K57-BR-001 新しい口だけを呼び、PC の名前・この PC の印（machine_id・D-128.174）と Bridge の印を送る。返った PC の印を受け取る", async () => {
    seen.length = 0;
    reply = { status: 201, body: { data: { device_token: TOKEN, device_id: "x", member_id: "y" } } };
    const r = await claimCode(api, "KQ7M2X", { label: "高本の MacBook", machineId: MID });
    expect(r).toEqual({ ok: true, token: TOKEN });
    expect(seen).toHaveLength(1);
    expect(seen[0]!.path).toBe("/api/v1/bridge/claim");
    expect(JSON.parse(seen[0]!.body)).toEqual({ code: "KQ7M2X", device_label: "高本の MacBook", machine_id: MID });
    expect(seen[0]!.headers["user-agent"]).toBe(BRIDGE_UA);
    expect(BRIDGE_UA).toMatch(/^Kaname-Bridge\//);
  });

  it("K57-BR-002 その接続コードは使えない（E-CONN-013）・形が違う（422 の欄の理由）・続けて間違えた（429）を、そのまま窓に出せる文にする", () => {
    expect(claimReply(404, { code: "E-CONN-013", message: "その接続コードは使えません。…" })).toEqual({
      ok: false,
      message: "その接続コードは使えません。…",
    });
    expect(
      claimReply(422, {
        code: "VALIDATION_ERROR",
        details: [{ field: "code", message: "接続コードは英数字 6 けたです" }],
      }),
    ).toEqual({
      ok: false,
      message: "接続コードは英数字 6 けたです",
    });
    expect(claimReply(429, { retry_after_sec: 60 })).toMatchObject({
      ok: false,
      message: expect.stringContaining("60 秒"),
    });
    // 印の形でない返事は受け取らない（印を覚えない）
    expect(claimReply(201, { data: { device_token: "00000000-0000-4000-8000-000000000000" } }).ok).toBe(false);
  });

  it("K57-BR-003 失敗：Bridge が Kaname に届かない：「Kaname につながりません」と言い、もう一度押せる（コードは呼ぶ側が持ったまま）", async () => {
    const r = await claimCode("http://127.0.0.1:9", "KQ7M2X", { label: "PC", machineId: MID });
    expect(r).toMatchObject({ ok: false, message: expect.stringContaining("Kaname につながりません") });
  });
});

describe("K-57 この PC の印と既定の名前（D-128.174）", () => {
  it("K57-BR-008 PC の名前の既定はその PC の名前（ホスト名）。前後の空白は落とし、ホスト名が空なら「この PC」", () => {
    expect(defaultDeviceLabel("takamoto-mbp")).toBe("takamoto-mbp");
    expect(defaultDeviceLabel("  Takamoto-MacBook-Pro.local  ")).toBe("Takamoto-MacBook-Pro.local");
    expect(defaultDeviceLabel("   ")).toBe("この PC");
    expect(defaultDeviceLabel(""), "空").toBe("この PC");
    // 引数が無ければこの PC のホスト名（OS の名前などを足さない）
    expect(defaultDeviceLabel()).toBe(hostname().trim() || "この PC");
  });

  it("K57-BR-009 この PC の印は入れたときに 1 回だけ作り（UUID）、つなぎ直し・PC の印を捨てても変わらない。別の PC（別の置き場）なら別の印", () => {
    const dir = mkdtempSync(join(tmpdir(), "k57-mid-"));
    const a = loadMachineId(dir);
    expect(a).toMatch(UUID_RE);
    expect(readFileSync(join(dir, MACHINE_ID_FILE), "utf8").trim(), "置き場に残す").toBe(a);
    expect(loadMachineId(dir), "2 回目も同じ").toBe(a);
    // PC の印（bridge.json）を捨てても（つなぎ直し・401 で捨てる）、この PC の印は別のファイルなので残る
    writeFileSync(join(dir, "bridge.json"), JSON.stringify({ connected: true, sessionId: TOKEN }));
    rmSync(join(dir, "bridge.json"));
    expect(loadMachineId(dir)).toBe(a);
    expect(loadMachineId(mkdtempSync(join(tmpdir(), "k57-mid-other-"))), "別の PC").not.toBe(a);
    // 壊れた中身は使わず作り直す（形の違う印を Kaname に送らない）
    writeFileSync(join(dir, MACHINE_ID_FILE), "not-a-uuid\n");
    const b = loadMachineId(dir);
    expect(b).toMatch(UUID_RE);
    expect(loadMachineId(dir)).toBe(b);
  });
});

describe("K-57 Bridge が新しい版を見に来る（GET /api/v1/bridge/releases/latest・PC の印で）", () => {
  it("K57-BR-004 新しい版の口は PC の印を付けて呼ぶ（D-128.137）", async () => {
    seen.length = 0;
    reply = { status: 200, body: { data: { released: false } } };
    expect(await fetchLatest(api, "mac", "arm64", "0.1.0", TOKEN)).toBeNull();
    expect(seen[0]!.path).toBe("/api/v1/bridge/releases/latest?os=mac&arch=arm64");
    expect(seen[0]!.headers["x-bridge-session"]).toBe(TOKEN);
  });

  it("K57-BR-005 まだつないでいない（PC の印が無い）なら、新しい版を見に行かない", async () => {
    seen.length = 0;
    const u = startUpdater({
      apiBase: api,
      currentVersion: "0.1.0",
      platform: "darwin",
      arch: "arm64",
      execPath: "/Applications/Kaname Bridge.app/Contents/MacOS/Kaname Bridge",
      isPackaged: true,
      dir: join(mkdtempSync(join(tmpdir(), "k57-up-")), "updates"),
      isBusy: () => false,
      onNote: () => undefined,
      quit: () => undefined,
      deviceToken: () => null,
    });
    await u.checkNow();
    u.stop();
    expect(seen.filter((x) => x.path.startsWith("/api/v1/bridge/releases"))).toHaveLength(0);
  });

  it("K57-BR-006 守り：PC の印は Kaname 自身の置き場にだけ渡す（別の置き場の URL には送らない）", async () => {
    // 置き場が別の出どころ（BRIDGE_RELEASE_BASE）なら、受け取りに印を付けない
    const other = createServer((req, res) => {
      seen.push({ path: `other:${req.url}`, headers: req.headers, body: "" });
      res.writeHead(404).end();
    });
    await new Promise<void>((r) => other.listen(0, "127.0.0.1", () => r()));
    const a = other.address();
    const otherBase = `http://127.0.0.1:${typeof a === "object" && a ? a.port : 0}`;
    seen.length = 0;
    reply = {
      status: 200,
      body: {
        data: {
          released: true,
          version: "9.0.0",
          update: { name: "K.zip", url: `${otherBase}/K.zip`, sha256: "a".repeat(64), size: 10 },
        },
      },
    };
    const notes: string[] = [];
    const root = mkdtempSync(join(tmpdir(), "k57-up2-"));
    const u = startUpdater({
      apiBase: api,
      currentVersion: "0.1.0",
      platform: "win32",
      arch: "x64",
      execPath: join(root, "Kaname Bridge.exe"),
      isPackaged: true,
      dir: join(root, "updates"),
      isBusy: () => false,
      onNote: (t) => notes.push(t),
      quit: () => undefined,
      deviceToken: () => TOKEN,
    });
    await u.checkNow();
    u.stop();
    other.close();
    const toOther = seen.filter((x) => x.path.startsWith("other:"));
    expect(toOther.length).toBeGreaterThan(0);
    expect(toOther.every((x) => x.headers["x-bridge-session"] === undefined)).toBe(true);
  });
});

describe("K-57 この PC の中だけの口（127.0.0.1）", () => {
  it("K57-BR-007 守り：外のサイトの出どころからは 403（居ることも教えない）。許した画面からは Bridge が居ると分かる", async () => {
    const srv = startLocalServer(
      {
        version: "1.4.0",
        deviceLabel: () => "PC",
        connected: () => false,
        claim: async () => ({ ok: true }),
        check: async () => [],
        installClaude: async () => ({ ok: true, message: "" }),
        loginStart: async () => ({ ok: true, message: "" }),
        loginCode: async () => ({ ok: true, message: "" }),
        loginCancel: () => undefined,
      },
      0,
    );
    await new Promise<void>((r) => (srv.listening ? r() : srv.once("listening", () => r())));
    const a = srv.address();
    const base = `http://127.0.0.1:${typeof a === "object" && a ? a.port : 0}`;
    try {
      const evil = await fetch(`${base}/ping`, { headers: { origin: "https://evil.example" } });
      expect(evil.status).toBe(403);
      expect(evil.headers.get("access-control-allow-origin")).toBeNull();
      const ok = await fetch(`${base}/ping`, { headers: { origin: "http://127.0.0.1:3124" } });
      expect(ok.status).toBe(200);
      expect(((await ok.json()) as { app: string }).app).toBe("kaname-bridge");
    } finally {
      srv.close();
    }
  });
});
