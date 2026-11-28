// K-367「前の PC をつなぐ画面 /setup/bridge/legacy と、その画面だけが使う前の道すじを消す」の単体の試験（本番と同じ bootApi）。
// 名前の頭の行 ID（K367-API-…）は 11_tickets/K-367.md の表に 1 対 1 で結ぶ。PC を外すのは契約の口 revokeMyDevice（K-362）へ移った。
// テストはチケットを切る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { setupLogin } from "../F1/login.harness.js";

const h = setupLogin("k367");

describe("K-367 前の道すじを消した", () => {
  it("K367-API-001 前の外す道すじ POST /api/auth-ext/agent/bridge-revoke は 404（ログインしていなくても 401 でなく、道そのものが無い）", async () => {
    const r = await h.req("POST", "/api/auth-ext/agent/bridge-revoke", { session_id: randomUUID() });
    expect(r.status).toBe(404);
  });

  it("K367-API-002 前のブラウザの道すじ 3 本（POST /api/auth-ext/agent/browser・/api/auth-ext/agent/browser-check・/api/auth-ext/bridge/browser）は 404（道そのものが無い。選ぶのは updateMyDevice・確かめは checkMyDeviceBrowser・Bridge の窓は setBridgeBrowser）。PC の様子を読む GET /api/auth-ext/bridge/state は会話の画面が使うので残す（404 でない）", async () => {
    for (const [path, body] of [
      ["/api/auth-ext/agent/browser", { browser: "chrome" }],
      ["/api/auth-ext/agent/browser-check", {}],
      ["/api/auth-ext/bridge/browser", { browser: "dedicated" }],
    ] as const) {
      const r = await h.req("POST", path, body);
      expect(r.status, path).toBe(404);
    }
    const st = await h.req("GET", "/api/auth-ext/bridge/state");
    expect(st.status, "/api/auth-ext/bridge/state は残す").not.toBe(404);
  });
});
