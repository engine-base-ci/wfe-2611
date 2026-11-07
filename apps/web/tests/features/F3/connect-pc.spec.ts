// K-57「PC をつなぐ」の画面の試験（実 Chrome）：/setup/bridge。操作要素 1 つ＝仕様の 1 行（07_qa/test-specs/k/connect-pc.md）＝試験 1 本。
//   口（API）とこの PC の中だけの口（127.0.0.1:38617）は網の手前（page.route）で差し替える。口の振る舞いは apps/api/test/features/F3/connect-pc.test.ts が本物の DB で持つ。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Page, Request, Route } from "@playwright/test";
import { expect, missingRows, row, rowsOf } from "../../_lib/row";
import { WIDTHS } from "../../_lib/api";

const SPEC = join(dirname(fileURLToPath(import.meta.url)), "../../../../../07_qa/test-specs/k/connect-pc.md");
const ROWS = rowsOf(SPEC);
const R = Object.fromEntries(ROWS.map((r) => [r.id, r]));
const API_RE = /\/api\/(v1|auth-ext|auth)\//;
const LOCAL_RE = /^https?:\/\/127\.0\.0\.1:38617\//;
const TOKEN = "k57-web-token";

type Reply = { status: number; body: unknown };
interface Mock {
  codes: number;
  downloads: { os: string; auth: string | null }[];
  localPairs: Record<string, unknown>[];
  on: { code: () => Reply; devices: () => Reply; download: (os: string) => Reply | "file" };
  local: { ping: boolean; pair: (b: Record<string, unknown>) => Reply };
}
let seq = 0;
const nextCode = () => `KQ7M${String.fromCharCode(65 + (seq++ % 20))}X`;
const device = (state: "live" | "waiting" | "asleep", extra: Record<string, unknown> = {}) => ({
  id: "d1",
  device_label: "高本の MacBook",
  state,
  last_seen_at: state === "waiting" ? null : new Date().toISOString(),
  version: "1.4.0",
  ...extra,
});

async function mockApi(page: Page, o: { token?: boolean } = {}): Promise<Mock> {
  const m: Mock = {
    codes: 0,
    downloads: [],
    localPairs: [],
    on: {
      code: () => ({
        status: 201,
        body: { data: { code: nextCode(), expires_at: new Date(Date.now() + 600_000).toISOString() } },
      }),
      devices: () => ({ status: 200, body: { data: [], meta: { limit: 0 } } }),
      download: () => "file",
    },
    local: { ping: false, pair: () => ({ status: 200, body: { ok: true } }) },
  };
  if (o.token !== false) await page.addInitScript((t) => window.localStorage.setItem("kaname.token", t), TOKEN);
  await page.route(API_RE, async (route: Route, req: Request) => {
    const u = new URL(req.url());
    let reply: Reply | "file" = { status: 404, body: { error: "not_found", code: "NOT_FOUND" } };
    if (req.method() === "POST" && u.pathname === "/api/v1/bridge/pairing-codes") {
      m.codes++;
      await new Promise((r) => setTimeout(r, 150)); // 答えを待つ間（2 回押しを確かめる）
      reply = m.on.code();
    } else if (req.method() === "GET" && u.pathname === "/api/v1/bridge/devices") reply = m.on.devices();
    else {
      const d = /^\/api\/v1\/bridge\/releases\/(\w+)\/file$/.exec(u.pathname);
      if (d) {
        m.downloads.push({ os: d[1]!, auth: req.headers()["authorization"] ?? null });
        reply = m.on.download(d[1]!);
      }
    }
    if (reply === "file")
      return route.fulfill({ status: 200, contentType: "application/octet-stream", body: "Kaname-Bridge" });
    await route.fulfill({ status: reply.status, contentType: "application/json", body: JSON.stringify(reply.body) });
  });
  await page.route(LOCAL_RE, async (route: Route, req: Request) => {
    const u = new URL(req.url());
    if (!m.local.ping) return route.abort("connectionrefused");
    const cors = {
      "access-control-allow-origin": req.headers()["origin"] ?? "*",
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "GET,POST,OPTIONS",
    };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors, body: "" });
    if (u.pathname === "/ping")
      return route.fulfill({
        status: 200,
        headers: cors,
        contentType: "application/json",
        body: JSON.stringify({ app: "kaname-bridge", version: "1.4.0", device_label: "この PC", connected: false }),
      });
    if (u.pathname === "/pair" && req.method() === "POST") {
      const b = (req.postDataJSON() as Record<string, unknown>) ?? {};
      m.localPairs.push(b);
      const r = m.local.pair(b);
      return route.fulfill({
        status: r.status,
        headers: cors,
        contentType: "application/json",
        body: JSON.stringify(r.body),
      });
    }
    return route.fulfill({ status: 200, headers: cors, contentType: "application/json", body: "{}" });
  });
  return m;
}
const open = async (page: Page, q = "", width = 1440) => {
  await page.setViewportSize({ width, height: 1000 });
  const res = await page.goto(`/setup/bridge${q}`);
  expect(res?.status()).toBe(200);
};
const heading = (page: Page) => page.getByRole("heading", { level: 1, name: "PC をつなぐ" });
const codeText = (page: Page) => page.getByTestId("pairing-code");

row(R["K57-UI-000"], async (page) => {
  await mockApi(page);
  await open(page);
  await expect(codeText(page)).toHaveText(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
  expect(await missingRows(page, ROWS)).toEqual([]);
});

row(R["K57-UI-001"], async (page) => {
  const m = await mockApi(page);
  await open(page);
  await page.getByRole("button", { name: "Mac 用を受け取る" }).click();
  await expect(page.getByText("ダウンロードを始めました")).toBeVisible();
  expect(m.downloads).toEqual([{ os: "mac", auth: `Bearer ${TOKEN}` }]);
});

row(R["K57-UI-002"], async (page) => {
  const m = await mockApi(page);
  m.on.download = () => ({
    status: 404,
    body: { error: "not_found", code: "E-CONN-014", message: "まだ配布していません。…" },
  });
  await open(page);
  await page.getByRole("button", { name: "Windows 用を受け取る" }).click();
  await expect(page.getByText(/まだ配布していません/)).toBeVisible();
  expect(m.downloads.map((d) => d.os)).toEqual(["win"]);
});

row(R["K57-UI-003"], async (page) => {
  const m = await mockApi(page);
  await open(page);
  await expect(codeText(page)).toBeVisible();
  const first = await codeText(page).innerText();
  const before = m.codes;
  const btn = page.getByRole("button", { name: "新しいコード" });
  await btn.click();
  await expect(btn).toBeDisabled();
  await btn.click({ force: true }).catch(() => undefined);
  await expect(btn).toBeEnabled();
  expect(m.codes - before).toBe(1);
  await expect(codeText(page)).not.toHaveText(first);
});

row(R["K57-UI-004"], async (page) => {
  await mockApi(page);
  await open(page);
  await expect(heading(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Mac 用を受け取る" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Windows 用を受け取る" })).toBeVisible();
  await expect(codeText(page)).toHaveText(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
  await expect(page.getByText("アプリからの返事を待っています…").first()).toBeVisible();
  await expect(page.getByText("つながっています")).toHaveCount(0);
});

row(R["K57-UI-005"], async (page) => {
  const m = await mockApi(page);
  m.local.ping = true;
  await open(page);
  await page.getByRole("button", { name: "この PC の Bridge につなぐ" }).click();
  await expect.poll(() => m.localPairs.length).toBe(1);
  expect(String(m.localPairs[0]!["code"])).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
  await expect(page.getByRole("button", { name: "Mac 用を受け取る" })).toHaveCount(0);
  await expect(codeText(page)).toHaveCount(0);
});

row(R["K57-UI-006"], async (page) => {
  const m = await mockApi(page);
  m.local.ping = true;
  m.local.pair = (b) =>
    b["switch"]
      ? { status: 200, body: { ok: true } }
      : {
          status: 409,
          body: { reason: "other_account", message: "この PC の Bridge は、すでに別のアカウントでつながっています。" },
        };
  await open(page);
  await page.getByRole("button", { name: "この PC の Bridge につなぐ" }).click();
  await expect(page.getByText(/別のアカウントでつながっています/)).toBeVisible();
  await page.getByRole("button", { name: "このアカウントに切り替える" }).click();
  await expect.poll(() => m.localPairs.length).toBe(2);
  expect(m.localPairs[0]!["switch"]).toBeUndefined();
  expect(m.localPairs[1]!["switch"]).toBe(true);
});

row(R["K57-UI-007"], async (page) => {
  const m = await mockApi(page);
  m.local.ping = true;
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "userAgent", { get: () => "Mozilla/5.0 Chrome/131 KanameBridge/1.4.0" }),
  );
  await open(page);
  await expect.poll(() => m.localPairs.length).toBe(1);
  await expect(page.getByRole("button", { name: "Mac 用を受け取る" })).toHaveCount(0);
  await expect(codeText(page)).toHaveCount(0);
});

row(R["K57-UI-008"], async (page) => {
  await mockApi(page);
  await open(page, "?from=%2Ftickets");
  await expect(page.getByRole("link", { name: "戻る" })).toHaveAttribute("href", "/tickets");
  await open(page, "?from=https%3A%2F%2Fevil.example%2F");
  await expect(heading(page)).toBeVisible();
  await expect(page.getByRole("link", { name: "戻る" })).toHaveCount(0);
});

row(R["K57-UI-009"], async (page) => {
  await mockApi(page, { token: false });
  await page.goto("/setup/bridge");
  await expect(page).toHaveURL(/\/login\?next=%2Fsetup%2Fbridge$/);
});

row(R["K57-UI-010"], async (page) => {
  const m = await mockApi(page);
  m.on.code = () => ({ status: 401, body: { error: "unauthenticated", code: "UNAUTHENTICATED" } });
  await open(page, "?from=%2Ftickets");
  // ログインが切れたら、どの画面でも入り直しへ（共通の決まり・lib/api/query.tsx）。入り直すとこの画面（開いたときの印つき）に戻る
  await expect(page).toHaveURL(/\/login\?next=%2Fsetup%2Fbridge%3Ffrom%3D%252Ftickets$/);
});

row(R["K57-UI-011"], async (page) => {
  const m = await mockApi(page);
  m.on.devices = () => ({ status: 403, body: { error: "forbidden", code: "FORBIDDEN" } });
  m.on.code = () => ({ status: 403, body: { error: "forbidden", code: "FORBIDDEN" } });
  await open(page);
  await expect(page.getByRole("heading", { name: /この画面を見る権限がありません/ })).toBeVisible();
  await expect(codeText(page)).toHaveCount(0);
});

row(R["K57-UI-012"], async (page) => {
  await page.clock.install();
  const m = await mockApi(page);
  await open(page);
  await expect(codeText(page)).toBeVisible();
  const first = await codeText(page).innerText();
  const before = m.codes;
  await page.clock.fastForward("10:01");
  await expect.poll(() => m.codes).toBeGreaterThan(before);
  await expect(codeText(page)).not.toHaveText(first);
});

row(R["K57-UI-013"], async (page) => {
  const m = await mockApi(page);
  m.on.devices = () => ({ status: 200, body: { data: [device("live")] } });
  await open(page);
  const c = page.getByRole("status").filter({ hasText: "つながっています" }).first();
  await expect(c).toBeVisible();
  await expect(c).toContainText("高本の MacBook");
  await expect(c).toContainText("1.4.0");
  await expect(codeText(page)).toHaveCount(0);
});

row(R["K57-UI-014"], async (page) => {
  const m = await mockApi(page);
  m.on.devices = () => ({ status: 200, body: { data: [device("waiting")] } });
  await open(page);
  await expect(page.getByText("アプリからの返事を待っています…").first()).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: /^つながっています/ })).toHaveCount(0);
});

row(R["K57-UI-015"], async (page) => {
  const m = await mockApi(page);
  m.on.devices = () => ({ status: 200, body: { data: [device("asleep")] } });
  await open(page);
  await expect(page.getByText(/まだつながっていません。Bridge を開いたら/)).toBeVisible();
  await page.getByRole("button", { name: "Bridge を起こす" }).click();
  await expect(page.locator('iframe[src="kaname-bridge://open"]')).toHaveCount(1);
});

row(R["K57-UI-016"], async (page) => {
  await page.clock.install();
  const m = await mockApi(page);
  let n = 0;
  m.on.devices = () => ({ status: 200, body: { data: [device(n++ < 1 ? "asleep" : "live")] } });
  await open(page);
  await expect(page.getByRole("button", { name: "Bridge を起こす" })).toBeVisible();
  await page.clock.fastForward(6_000);
  await expect(page.getByRole("status").filter({ hasText: "つながっています" }).first()).toBeVisible();
});

row(R["K57-UI-017"], async (page) => {
  const m = await mockApi(page);
  m.on.code = () => ({ status: 429, body: { error: "rate_limited", code: "RATE_LIMITED", retry_after_sec: 60 } });
  await open(page);
  await expect(page.getByText(/60 秒たってから/)).toBeVisible();
});

row(R["K57-UI-018"], async (page) => {
  const m = await mockApi(page);
  m.on.download = () => ({ status: 503, body: { error: "connectivity", code: "E-PAGE-007" } });
  await open(page);
  await page.getByRole("button", { name: "Mac 用を受け取る" }).click();
  await expect(page.getByText(/読み込めませんでした/)).toBeVisible();
  await expect(page.getByText(/まだ配布していません/)).toHaveCount(0);
});

row(R["K57-UI-019"], async (page) => {
  await mockApi(page);
  for (const w of WIDTHS) {
    await open(page, "", w);
    await expect(codeText(page)).toBeVisible();
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over, `幅 ${w} の横溢れ`).toBe(0);
  }
});

row(R["K57-UI-020"], async (page) => {
  const m = await mockApi(page);
  const signed =
    "https://store.example.test/bridge/Kaname-Bridge-1.4.0-arm64.dmg?exp=1999999999&sig=abcdefghijklmnopqrstuv";
  m.on.download = () => ({
    status: 200,
    body: { data: { url: signed, expires_at: new Date(Date.now() + 300_000).toISOString() } },
  });
  // 置き場は外。普通のリンクとして開かれる（画面の fetch ではない＝ナビゲーション・D-128.153）
  const opened: { url: string; nav: boolean }[] = [];
  await page.route("https://store.example.test/**", async (route, req) => {
    opened.push({ url: req.url(), nav: req.isNavigationRequest() });
    await route.fulfill({
      status: 200,
      headers: { "content-disposition": 'attachment; filename="Kaname-Bridge.dmg"' },
      contentType: "application/octet-stream",
      body: "Kaname-Bridge",
    });
  });
  await open(page);
  await page.getByRole("button", { name: "Mac 用を受け取る" }).click();
  await expect(page.getByText("ダウンロードを始めました")).toBeVisible();
  await expect.poll(() => opened).toEqual([{ url: signed, nav: true }]);
  expect(m.downloads).toEqual([{ os: "mac", auth: `Bearer ${TOKEN}` }]);
});
