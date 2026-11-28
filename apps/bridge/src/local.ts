// Bridge がこの PC の中だけで開く小さな口（127.0.0.1）。Kaname の画面が「Bridge が動いているか」を知るために使う。
// これがあると、入れてある人には ダウンロードの案内も 接続コードの手入力も 要らなくなる（D-089.8）。
// 外からは開けない：ループバックにだけ bind し、許可した画面の出どころ（origin）以外は CORS で断る。
// 接続コード（英数字 6 けた・K-57）を受ける口も、総当たりを防ぐ：1 分に 5 回まで。
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { bridgeEnv } from "./env";

export const LOCAL_PORT = 38617;
/** この出どころの画面からだけ受ける。増やすときは配布の設定で渡す（既定は dev の 2 つ） */
const ORIGINS = (bridgeEnv("KANAME_WEB_ORIGINS") ?? "http://127.0.0.1:3124,http://localhost:3124,http://127.0.0.1:3123")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const hits: number[] = [];
const tooMany = (): boolean => {
  const now = Date.now();
  while (hits.length && now - hits[0]! > 60_000) hits.shift();
  if (hits.length >= 5) return true;
  hits.push(now);
  return false;
};

interface Deps {
  version: string;
  deviceLabel: () => string;
  connected: () => boolean;
  claim: (
    code: string,
    allowSwitch?: boolean,
  ) => Promise<{ ok: true } | { ok: false; message: string; reason?: "other_account" }>;
  /** 自己診断（Claude Code がある・Chrome がある・Kaname に届く）。画面が「何が足りないか」を出すのに使う */
  check: () => Promise<{ name: string; ok: boolean; detail: string }[]>;
  /** Claude Code を入れる（D-091.1）。押すのはこの PC で開いた画面からだけ */
  installClaude: () => Promise<{ ok: boolean; message: string }>;
  /** ログインの窓を開く（D-091.3）。承認するのは本人 */
  loginStart: () => Promise<{ ok: boolean; url?: string; message: string }>;
  loginCode: (code: string) => Promise<{ ok: boolean; message: string }>;
  loginCancel: () => void;
  /** 入れる作業の途中の行（画面が押した後の様子を見せる）。渡さなければ「走っていない・行なし」 */
  installProgress?: () => { running: boolean; steps: { text: string; state: string }[] };
  /** Kaname がこの PC に付けた番号（生きている知らせの答えで覚えた物）。画面が「この行はこの PC か」を見分ける。まだ無ければ /ping は null を返す */
  deviceId?: () => string | null | undefined;
}

/** 本文を JSON の入れ物として読む。読めない・入れ物でない（null・配列・文字だけ）ときは null を返す。
 *  ここで投げると、受け取りの途中で落ちて口ごと答えなくなる */
function readBody(raw: string): Record<string, unknown> | null {
  try {
    const v: unknown = JSON.parse(raw || "{}");
    return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function startLocalServer(d: Deps, port: number = LOCAL_PORT): Server {
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const origin = req.headers.origin ?? "";
    const allowed = ORIGINS.includes(origin);
    const send = (status: number, body: unknown): void => {
      res.writeHead(status, {
        "content-type": "application/json; charset=utf-8",
        ...(allowed ? { "access-control-allow-origin": origin, vary: "Origin" } : {}),
        "access-control-allow-headers": "content-type",
        "access-control-allow-methods": "GET,POST,OPTIONS",
      });
      res.end(JSON.stringify(body));
    };
    if (!allowed) return send(403, { error: "forbidden" }); // 知らない画面には「居る」ことすら教えない
    if (req.method === "OPTIONS") return send(204, {});
    if (req.method === "GET" && req.url === "/ping")
      return send(200, {
        app: "kaname-bridge",
        version: d.version,
        device_label: d.deviceLabel(),
        connected: d.connected(),
        device_id: d.deviceId?.() ?? null,
      });
    if (req.method === "GET" && req.url === "/check") return void d.check().then((c) => send(200, { checks: c }));
    // 入れる作業の途中の行。押した画面が「いま何をしているか」を出すのに読む
    if (req.method === "GET" && req.url === "/install-progress")
      return send(200, d.installProgress?.() ?? { running: false, steps: [] });
    // Claude Code を入れる・ログインの窓を開く（D-091）。この PC の中だけの口なので、他所の画面からは押せない
    if (req.method === "POST" && req.url === "/install-claude")
      return void d.installClaude().then((r) => send(r.ok ? 200 : 409, r));
    // ログインは Bridge の中で終わらせる（ターミナルを開かない・D-091.3）。
    //   /login-claude で始めて URL を返し、ブラウザに出たコードを /login-code で受け取る
    if (req.method === "POST" && req.url === "/login-claude")
      return void d.loginStart().then((r) => send(r.ok ? 200 : 409, r));
    if (req.method === "POST" && req.url === "/login-cancel") {
      d.loginCancel();
      return send(200, { ok: true });
    }
    if (req.method === "POST" && req.url === "/login-code") {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        const b = readBody(raw);
        if (!b) return send(422, { ok: false, message: "コードを読めませんでした。貼り直してください" });
        void d.loginCode(String(b["code"] ?? "")).then((r) => send(r.ok ? 200 : 409, r));
      });
      return;
    }
    if (req.method === "POST" && req.url === "/pair") {
      if (tooMany()) return send(429, { message: "試しすぎです。1 分おいてください" });
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        const b = readBody(raw);
        if (!b) return send(400, { error: "bad_request" }); // 画面はいつも JSON で送る。読めない本文に出す文は持たない
        const code = String(b["code"] ?? "")
          .trim()
          .toUpperCase();
        // 別のアカウントでつながっているときは 409（画面が「切り替える」を出し、本人が押したら switch: true で来る）
        void d.claim(code, b["switch"] === true).then((r) =>
          r.ok
            ? send(201, { connected: true })
            : send(r.reason === "other_account" ? 409 : 400, {
                message: r.message,
                ...(r.reason ? { reason: r.reason } : {}),
              }),
        );
      });
      return;
    }
    send(404, { error: "not_found" });
  });
  server.on("error", (e: NodeJS.ErrnoException) => {
    // 既に同じ Bridge が動いているだけなら黙って諦める（2 つ目の窓は開かない）
    if (e.code !== "EADDRINUSE") console.error("[bridge] ローカルの口を開けませんでした", e.message);
  });
  server.listen(port, "127.0.0.1");
  return server;
}
