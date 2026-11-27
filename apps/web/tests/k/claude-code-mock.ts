// PC の行の Claude Code の区画（/setup/bridge）の画面の試験の共通の道具（K-361 が持つ・K-373 が使う）。
//   K-361 の試験のファイルから、口の差し替え・開く手順・行と区画の見つけ方を外に出した（同じ物を 2 つ書かない）。
//   口（API）とこの PC の中だけの口（127.0.0.1:38617）は網の手前で差し替える（本人の Bridge に届かせない）。
//   一覧の答えの health・health_at は K-360、この PC の口（/install-progress・/ping の device_id）は K-359 の形。
//   待ちは出来事で決める（固定の待ちは使わない）。台が混んでも落ちないよう、見える・移るの待ちは 15 秒まで。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { shellData } from "./shell-answer";
import { expect, type Page, type Request, type Route } from "@playwright/test";
// 作り物の秘密の値は apps/web/test/_fake/secrets.ts に置いて import する（.gitleaks.toml が置き場だけを外す・K-328）
import { K361_WEB_TOKEN } from "../../test/_fake/secrets";

export const WS = "aaaaaaaa-0000-4000-8000-000000000361";
export const ME = "11111111-0000-4000-8000-000000000361";
export const THIS = "d0000000-0000-4000-8000-000000000361";
export const OTHER = "d1111111-0000-4000-8000-000000000361";
export const BODY = 'section[aria-labelledby="connect-pc-title"]';
export const NOW = new Date().toISOString();
export const OLD = "2026-11-15T00:00:00Z"; // 日本時間で 11/15 09:00
export const GOOD = "K361-GOOD-CODE";
export const LOGIN_URL = "https://claude.ai/oauth/authorize?code=true&state=K361STATE";
export const WAIT = { timeout: 15_000 };

export type Check = { name: string; ok: boolean; detail: string; fix?: string | null; code?: string };
export const CC = "本人のサブスクの Claude Code がある";
export const LG = "Claude Code にログインできている";
export const H = {
  install: [
    { name: CC, ok: false, detail: "この PC にありません", fix: "install" },
    { name: LG, ok: false, detail: "先に Claude Code を入れてください", fix: "install" },
  ],
  repair: [
    { name: CC, ok: false, detail: "入ってはいますが、本体が落ちてきていません", fix: "repair", code: "E-CONN-011" },
    { name: LG, ok: false, detail: "先に Claude Code を入れてください", fix: "install" },
  ],
  login: [
    { name: CC, ok: true, detail: "/usr/local/bin/claude", fix: null },
    { name: LG, ok: false, detail: "まだログインしていません", fix: "login", code: "E-CONN-010" },
  ],
  ok: [
    { name: CC, ok: true, detail: "/usr/local/bin/claude", fix: null },
    { name: LG, ok: true, detail: "できています", fix: null },
  ],
} satisfies Record<string, Check[]>;

export interface Dev {
  id: string;
  device_label: string;
  state: "live" | "asleep" | "waiting";
  health?: unknown;
  health_at?: string | null;
}
export interface Local {
  /** この PC で Bridge が動いているか（false なら 38617 はつながらない） */
  on: boolean;
  /** /ping の device_id（古い Bridge は undefined＝鍵が無い） */
  deviceId?: string | null;
  checks: Check[];
  installs: number;
  logins: number;
  codes: string[];
  cancels: number;
  /** /install-claude の答え（既定は入ったら checks を login にする） */
  installReply: { status: number; body: unknown } | "abort" | null;
  /** /login-claude の答え（既定は入口の URL） */
  loginReply: { status: number; body: unknown } | null;
  /** /install-claude を release() まで止める */
  hold: boolean;
  release: () => void;
  progress: { running: boolean; steps: { text: string; state: string }[] };
}
export interface Mock {
  devices: Dev[];
  local: Local;
  /** 口（/api/）に送られた体と URL（ログインのコードが Kaname に行かないことを見る） */
  apiSent: string[];
  /** 接続のコードの口（POST /api/v1/bridge/pairing-codes）を呼んだ回数 */
  pairings: number;
}
export const live = (id: string, label: string, health: unknown, at: string | null = NOW): Dev => ({
  id,
  device_label: label,
  state: "live",
  health,
  health_at: at,
});

export async function mock(page: Page, devices: Dev[], local: Partial<Local> = {}): Promise<Mock> {
  let waiting: (() => void)[] = [];
  const l: Local = {
    on: true,
    deviceId: THIS,
    checks: H.ok,
    installs: 0,
    logins: 0,
    codes: [],
    cancels: 0,
    installReply: null,
    loginReply: null,
    hold: false,
    release: () => {
      l.hold = false;
      for (const go of waiting) go();
      waiting = [];
    },
    progress: { running: false, steps: [] },
    ...local,
  };
  const m: Mock = { devices, local: l, apiSent: [], pairings: 0 };
  await page.addInitScript((t) => window.localStorage.setItem("kaname.token", t), K361_WEB_TOKEN);
  await page.route(/127\.0\.0\.1:38617/, async (route: Route, req: Request) => {
    if (!l.on) return route.abort("connectionrefused");
    const cors = {
      "access-control-allow-origin": req.headers()["origin"] ?? "*",
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "GET,POST,OPTIONS",
    };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors, body: "" });
    const p = new URL(req.url()).pathname;
    const send = (status: number, body: unknown) =>
      route.fulfill({ status, headers: cors, contentType: "application/json", body: JSON.stringify(body) });
    if (p === "/ping")
      return send(200, {
        app: "kaname-bridge",
        version: "1.5.0",
        device_label: "高本の MacBook",
        connected: true,
        ...(l.deviceId === undefined ? {} : { device_id: l.deviceId }),
      });
    if (p === "/check") return send(200, { checks: l.checks });
    if (p === "/install-progress") return send(200, l.progress);
    if (p === "/install-claude") {
      l.installs += 1;
      if (l.installReply === "abort") return route.abort("connectionrefused");
      l.progress = { running: true, steps: [{ text: "Claude Code を入れています（1〜2 分）", state: "doing" }] };
      if (l.hold) await new Promise<void>((go) => waiting.push(go));
      if (l.installReply) {
        l.progress = { running: false, steps: [{ text: "入れられませんでした", state: "failed" }] };
        return send(l.installReply.status, l.installReply.body);
      }
      l.progress = { running: false, steps: [{ text: "入りました", state: "done" }] };
      l.checks = H.login;
      return send(200, { ok: true, message: "入りました。次に「ログインする」を押してください" });
    }
    if (p === "/login-claude") {
      l.logins += 1;
      if (l.loginReply) return send(l.loginReply.status, l.loginReply.body);
      return send(200, { ok: true, url: LOGIN_URL, message: "ブラウザで承認してください" });
    }
    if (p === "/login-cancel") {
      l.cancels += 1;
      return send(200, { ok: true });
    }
    if (p === "/login-code") {
      const code = String((JSON.parse(req.postData() ?? "{}") as { code?: string }).code ?? "");
      l.codes.push(code);
      if (code === GOOD) {
        l.checks = H.ok;
        return send(200, { ok: true, message: "ログインできました。これで仕事を渡せます" });
      }
      return send(409, { ok: false, message: "ログインできませんでした（OAuth error）。コードを貼り直してください" });
    }
    return send(404, { error: "not_found" });
  });
  await page.route(/\/api\/(v1|auth-ext|auth)\//, async (route: Route, req: Request) => {
    m.apiSent.push(`${req.url()} ${req.postData() ?? ""}`);
    const p = new URL(req.url()).pathname;
    const ok = (data: unknown, meta: Record<string, unknown> = {}) => ({ status: 200, body: { data, meta } });
    let r: { status: number; body: unknown } = { status: 404, body: { error: "not_found", code: "NOT_FOUND" } };
    if (p === "/api/auth-ext/me")
      r = ok({ member_id: ME, tenant_id: WS, display_name: "高本", role_id: "owner", scope_id: null });
    else if (p === "/api/v1/shell")
      r = ok(shellData({ groups: [], pcConnected: m.devices.some((d) => d.state === "live") })); // 外枠の口 getShell（K-466）
    else if (p === "/api/v1/scopes") r = ok([], { limit: 200, writable: [] });
    else if (p === "/api/v1/approvals/queue") r = ok([], { limit: 20, counts: { total: 0 }, cursor: null });
    else if (p === "/api/v1/bridge/pairing-codes" && req.method() === "POST") {
      m.pairings += 1;
      r = {
        status: 201,
        body: { data: { code: "K361PC", expires_at: new Date(Date.now() + 600_000).toISOString() }, meta: {} },
      };
    } else if (p === "/api/v1/bridge/devices")
      r = ok(
        m.devices.map((d) => ({
          last_seen_at: d.state === "waiting" ? null : (d.health_at ?? NOW),
          connected_at: OLD,
          version: "1.5.0",
          revoke_reason: null,
          ...d,
        })),
      );
    await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
  });
  return m;
}
export async function open(page: Page, width = 1440) {
  await page.setViewportSize({ width, height: 1000 });
  const res = await page.goto("/setup/bridge");
  expect(res?.status()).toBe(200);
  await expect(page.locator(`${BODY} .k-pc-list`)).toBeVisible(WAIT);
}
/** PC の行（li.k-pc-row に data-device＝一覧の id） */
export const row = (page: Page, id: string) => page.locator(`${BODY} .k-pc-row[data-device="${id}"]`);
export const fix = (page: Page, id: string) => row(page, id).locator('[data-part="claude-fix"]');
