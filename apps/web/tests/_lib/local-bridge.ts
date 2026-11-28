// この PC の Bridge の口（127.0.0.1:38617）を、試験のブラウザの中だけで演じる（本物には届かない）。本物の Bridge と同じ形で答える。
//   hideRealBridge の後に足す（後から足した経路が先に効く）。画面の試験（qa-b-bridge-setup）と流れ（apps/e2e/journeys/j02）で同じもの
import type { Page } from "@playwright/test";

export interface LocalOpts {
  /** /ping に答えるときの端末名（画面に出る） */
  label?: string;
  claudeOk?: boolean;
  loggedIn?: boolean;
  /** 画面が渡した接続コードで何をするか。返す true でつながった（201）、false で 400 */
  onPair?: (code: string) => Promise<boolean>;
}
export interface LocalSeen {
  codes: string[];
  install: number;
  login: number;
  loginCode: string;
}
/** この PC の Bridge の口を、試験のブラウザの中だけで演じる（本物には届かない）。本物の Bridge と同じ形で答える */
export async function localBridge(page: Page, o: LocalOpts = {}): Promise<LocalSeen> {
  const seen: LocalSeen = { codes: [], install: 0, login: 0, loginCode: "" };
  let claudeOk = o.claudeOk ?? true;
  let loggedIn = o.loggedIn ?? true;
  const cors = {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET, POST, OPTIONS",
  };
  // hideRealBridge の後に足す（後から足した経路が先に効く）。知らない口は断る
  await page.route("http://127.0.0.1:38617/**", async (r) => {
    const req = r.request();
    const path = new URL(req.url()).pathname;
    const json = (status: number, body: unknown) =>
      r.fulfill({ status, headers: cors, contentType: "application/json", body: JSON.stringify(body) });
    if (req.method() === "OPTIONS") return r.fulfill({ status: 204, headers: cors });
    if (path === "/ping")
      return json(200, {
        app: "kaname-bridge",
        version: "0.0.0-qa",
        device_label: o.label ?? "MacBook Pro（QA-B）",
        connected: false,
      });
    if (path === "/check")
      return json(200, {
        checks: [
          {
            name: "本人のサブスクの Claude Code がある",
            ok: claudeOk,
            detail: claudeOk ? "/usr/local/bin/claude" : "この PC にありません",
            fix: claudeOk ? null : "install",
          },
          {
            name: "Claude Code にログインできている",
            ok: loggedIn,
            detail: loggedIn ? "できています" : "まだログインしていません",
            fix: loggedIn ? null : "login",
          },
          { name: "Kaname につながる", ok: true, detail: "http://127.0.0.1:3011" },
        ],
      });
    if (path === "/install-claude") {
      seen.install++;
      claudeOk = true;
      return json(200, { ok: true, message: "入りました。次に「ログインする」を押してください" });
    }
    if (path === "/login-claude") {
      seen.login++;
      return json(200, {
        ok: true,
        url: "https://claude.com/cai/oauth/authorize?code=true",
        message: "ブラウザで承認してください。コードが出たら、下に貼って「決定」を押します",
      });
    }
    if (path === "/login-code") {
      seen.loginCode = String((req.postDataJSON() as { code?: string })?.code ?? "");
      loggedIn = true;
      return json(200, { ok: true, message: "ログインできました。これで仕事を渡せます" });
    }
    if (path === "/pair") {
      const code = String((req.postDataJSON() as { code?: string })?.code ?? "");
      seen.codes.push(code);
      const ok = o.onPair ? await o.onPair(code) : false;
      return json(ok ? 201 : 400, ok ? { connected: true } : { message: "つなげませんでした" });
    }
    return r.abort("connectionrefused");
  });
  return seen;
}
