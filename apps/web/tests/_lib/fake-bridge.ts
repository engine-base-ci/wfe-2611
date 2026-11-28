// 偽の Bridge（この PC の口 127.0.0.1:38617 を演じる）。本物と同じ ping／check／pair／install／login を返す。
// 画面が「この PC に Bridge が居る」と判断する経路を、本物を入れなくても再現するための共通部品。
import { createServer, type Server } from "node:http";
export const LOCAL_PORT = 38617;
export const ORIGIN = process.env["BASE_URL"] ?? "http://127.0.0.1:3124";

export interface FakeOpts {
  /** 自己診断（Claude Code があるか）。無いときだけ画面は「入れる」を出す（D-091.5） */
  claudeOk?: boolean;
  onInstall?: () => void;
  onLogin?: () => void;
  /** ログインできているか。できていなければ画面は「ログインする」を出す（D-091.3） */
  loggedIn?: boolean;
  /** 入ってはいるが本体（native binary）が落ちてきていない（取り直しで直る・E-CONN-011） */
  broken?: boolean;
  /** すでに別のアカウントでつながっている（切り替える を押すまでつながない・2026-09-28） */
  otherAccount?: boolean;
}
export async function fakeBridge(onPair: (code: string) => Promise<boolean>, opts: FakeOpts = {}): Promise<Server> {
  let claudeOk = opts.claudeOk ?? true;
  let loggedIn = opts.loggedIn ?? true;
  const s = createServer((req, res) => {
    const origin = req.headers.origin ?? "";
    const head = {
      "content-type": "application/json",
      "access-control-allow-origin": origin,
      "access-control-allow-headers": "content-type",
    };
    if (origin !== ORIGIN) return void (res.writeHead(403, head), res.end("{}"));
    if (req.method === "OPTIONS") return void (res.writeHead(204, head), res.end());
    if (req.url === "/ping")
      return void (res.writeHead(200, head),
      res.end(
        JSON.stringify({ app: "kaname-bridge", version: "0.0.0-test", device_label: "テストの PC", connected: false }),
      ));
    if (req.url === "/check")
      return void (res.writeHead(200, head),
      res.end(
        JSON.stringify({
          checks: [
            {
              name: "本人のサブスクの Claude Code がある",
              ok: claudeOk,
              detail: claudeOk
                ? "/usr/local/bin/claude"
                : opts.broken
                  ? "入ってはいますが、本体が落ちてきていません（/opt/homebrew/lib/node_modules/@anthropic-ai/claude-code）。下の「Claude Code を取り直す」で直ります"
                  : "この PC にありません",
              fix: claudeOk ? null : opts.broken ? "repair" : "install",
            },
            {
              name: "Claude Code にログインできている",
              ok: loggedIn,
              detail: loggedIn ? "できています" : "まだログインしていません",
              fix: loggedIn ? null : "login",
            },
            { name: "Kaname につながる", ok: true, detail: "http://127.0.0.1:3011" },
          ],
        }),
      ));
    if (req.url === "/install-claude") {
      opts.onInstall?.();
      claudeOk = true; // Bridge が入れ終わった後は、自己診断が ✓ に変わる
      return void (res.writeHead(200, head),
      res.end(JSON.stringify({ ok: true, message: "入りました。次に「ログインする」を押してください" })));
    }
    // ログインはターミナルを開かず、入口の URL を返してコードを受け取る（D-091.3）
    if (req.url === "/login-claude") {
      opts.onLogin?.();
      return void (res.writeHead(200, head),
      res.end(
        JSON.stringify({
          ok: true,
          url: "https://claude.com/cai/oauth/authorize?code=true",
          message: "ブラウザで承認してください。コードが出たら、下に貼って「決定」を押します",
        }),
      ));
    }
    if (req.url === "/login-code") {
      loggedIn = true;
      return void (res.writeHead(200, head),
      res.end(JSON.stringify({ ok: true, message: "ログインできました。これで仕事を渡せます" })));
    }
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const b = JSON.parse(raw || "{}") as { code?: string; switch?: boolean };
      if (opts.otherAccount && b.switch !== true) {
        res.writeHead(409, head);
        return void res.end(
          JSON.stringify({
            reason: "other_account",
            message:
              "この PC の Bridge は、すでに別のアカウントでつながっています。このアカウントに切り替えるなら「このアカウントに切り替える」を押してください",
          }),
        );
      }
      void onPair(String(b.code ?? "")).then((ok) => {
        res.writeHead(ok ? 201 : 400, head);
        res.end(JSON.stringify(ok ? { connected: true } : { message: "つなげませんでした" }));
      });
    });
  });
  // 港が空くまで少し待つ（前のテストの片付け・本物を止めた直後は数百 ms 塞がっている）
  for (let i = 0; ; i++) {
    try {
      await new Promise<void>((ok, ng) => {
        s.once("error", ng);
        s.listen(LOCAL_PORT, "127.0.0.1", () => {
          s.removeListener("error", ng);
          ok();
        });
      });
      break;
    } catch (e) {
      if (i >= 20) throw e;
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  return s;
}
