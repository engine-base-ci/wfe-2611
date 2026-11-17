// チケットの一覧の画面（/tickets）の試験の網の手前の差し替えと道具（K-251・K-252 の試験が使う）。
//   一覧の口の形は K-92（GET /api/v1/tickets：view・q・scope_id・limit・cursor →
//   { data: [{ id, number, title, kind, stage, assignee, delegated_to_clone, due_on, overdue, updated_at, parent_ticket_id, depth }], meta: { next_cursor } }）。
//   はじめにやることの口は K-250（GET /api/v1/me/setup-tasks・POST …/dismiss（体 {} は閉じる・{ key } は飛ばす・201））。承認待ちの口は K-161（GET /api/v1/approvals/queue）。
//   本人の Bridge（127.0.0.1:38617）に届かせない（網の手前で 404）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expect, type Browser, type Locator, type Page, type Request, type Route } from "@playwright/test";
import {
  compareFonts,
  compareRows,
  loadedFonts,
  mismatches,
  readVals,
  type FidelityPair,
} from "../../../../scripts/ci/fidelity_compare.mjs";
import { FIDELITY_STATES, routeCanvasFonts } from "../_lib/fidelity-states";

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, "../../../..");
const API_RE = /\/api\/(v1|auth-ext|auth)\//;
export const WS = "aaaaaaaa-0000-4000-8000-000000000001";
export const ME = "11111111-0000-4000-8000-000000000001";
export const SALES = "22222222-0000-4000-8000-000000000001";
export const TASK = "44444444-0000-4000-8000-000000000001";
export const WIDTHS = [320, 375, 768, 1024, 1440] as const;
/** 使えない状態の不透明度（正本の components.button-disabled・input-disabled・tab-disabled） */
export const DISABLED_OPACITY = 0.55; // 数で比べる（本番の組み立ては CSS を縮めて ".55" と書くことがある）

export type Reply = { status: number; body: unknown };
export const ok = (data: unknown, meta: Record<string, unknown> = {}): Reply => ({ status: 200, body: { data, meta } });
/** 正しい形の uuid（最後の組 12 桁・版 7・variant 8）。画面は口を呼ぶ前に uuid を確かめる（D-129.42） */
export const idOf = (i: number) => `0193c5a0-0000-7000-8000-${String(1000000000000 + i).slice(1)}`;
export const item = (i: number, o: Record<string, unknown> = {}) => ({
  id: idOf(i),
  number: `EG-${100 + i}`,
  title: `チケット ${i}`,
  kind: { id: TASK, name: "タスク" },
  stage: { id: "st", name: "未着手", key: "todo" },
  assignee: { id: ME, display_name: "高本" },
  delegated_to_clone: false,
  due_on: "2026-12-01",
  overdue: false,
  updated_at: "2026-11-15T00:00:00Z",
  parent_ticket_id: null,
  depth: 1,
  ...o,
});
export const items = (n: number, from = 1) => Array.from({ length: n }, (_, k) => item(from + k));

/** はじめにやることの口（K-250）の 1 件 */
export interface SetupTask {
  key: string;
  label: string;
  desc: string;
  done: boolean;
  href: string | null;
  available: boolean;
  optional: boolean;
  skipped: boolean;
}
export const TASKS: SetupTask[] = [
  {
    key: "passkey",
    label: "パスキーを付ける",
    desc: "まだ付けられません。数には入れていません",
    done: false,
    href: null,
    available: false,
    optional: false,
    skipped: false,
  },
  {
    key: "pc",
    label: "PC をつなぐ",
    desc: "分身はあなたの PC で動く。つなぐまで、分身は話すだけで実行はしない",
    done: false,
    href: "/setup/bridge",
    available: true,
    optional: false,
    skipped: false,
  },
  {
    key: "credentials",
    label: "ログイン情報を預ける",
    desc: "分身に使わせるメール・サービスのログイン。値は誰にも見せない",
    done: false,
    href: "/settings/credentials",
    available: true,
    optional: true,
    skipped: false,
  },
];

export interface ListMock {
  writable: string[];
  tasks: SetupTask[];
  dismissed: boolean;
  dismissCalls: number;
  skipCalls: string[];
  /** 承認待ちの口の答え（行・契約 ApprovalQueueItem の形） */
  approvals: Record<string, unknown>[];
  /** はじめにやることの一覧・承認待ちの口・閉じる口の答えの状態（200 番台以外なら体はエラー） */
  tasksStatus: number;
  approvalsStatus: number;
  dismissStatus: number;
  /** グループの一覧の口の答えの状態（K-252：200 番台以外なら体はエラー） */
  scopesStatus: number;
  /** 一覧の口とはじめにやることの一覧のほかに呼ばれた口（押せない物が口を呼ばないことを見る） */
  otherCalls: string[];
  /** 一覧の口の答え（問い合わせを見て返す） */
  list: (q: URLSearchParams, call: number) => Reply | Promise<Reply>;
  listCalls: URLSearchParams[];
}

const QUIET = new Set([
  "/api/auth/get-session",
  "/api/auth-ext/me",
  "/api/v1/scopes",
  "/api/v1/ticket_kinds",
  "/api/v1/members",
  "/api/v1/approvals/queue",
  "/api/v1/bridge/devices",
  "/api/v1/me/ticket-drafts",
  "/api/v1/tickets",
  "/api/v1/me/setup-tasks",
]);

export async function mockList(page: Page, o: Partial<ListMock> = {}): Promise<ListMock> {
  const m: ListMock = {
    writable: [SALES],
    tasks: TASKS.map((t) => ({ ...t })),
    dismissed: false,
    dismissCalls: 0,
    skipCalls: [],
    approvals: [],
    tasksStatus: 200,
    approvalsStatus: 200,
    dismissStatus: 201,
    scopesStatus: 200,
    otherCalls: [],
    list: () => ok(items(3), { next_cursor: null }),
    listCalls: [],
    ...o,
  };
  await page.addInitScript((t) => window.localStorage.setItem("kaname.token", t), `tok-${WS}`);
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(API_RE, async (route: Route, req: Request) => {
    const u = new URL(req.url());
    const p = u.pathname;
    if (req.method() !== "GET" || !QUIET.has(p)) m.otherCalls.push(`${req.method()} ${p}`);
    let r: Reply = { status: 404, body: { error: "not_found", code: "NOT_FOUND" } };
    if (p === "/api/auth/get-session")
      r = {
        status: 200,
        body: {
          session: { id: "s1", userId: ME, token: "t", expiresAt: "2099-01-01T00:00:00Z" },
          user: { id: ME, email: "me@example.com", name: "高本", emailVerified: true },
        },
      };
    else if (p === "/api/auth-ext/me")
      r = ok({ member_id: ME, tenant_id: WS, display_name: "高本", role_id: "owner", scope_id: null });
    else if (p === "/api/v1/scopes" && m.scopesStatus !== 200)
      r = { status: m.scopesStatus, body: { error: "server_error", code: "INTERNAL" } };
    else if (p === "/api/v1/scopes")
      r = ok([{ id: SALES, name: "営業", tenant_id: WS, ticket_prefix: "EG" }], { limit: 200, writable: m.writable });
    else if (p === "/api/v1/ticket_kinds") r = ok([{ id: TASK, name: "タスク", sections: [] }], { limit: 50 });
    else if (p === "/api/v1/members") r = ok([{ id: ME, display_name: "高本", kind_id: "human" }], { limit: 200 });
    else if (p === "/api/v1/approvals/queue" && m.approvalsStatus !== 200)
      r = { status: m.approvalsStatus, body: { error: "server_error", code: "INTERNAL" } };
    else if (p === "/api/v1/approvals/queue")
      r = ok(m.approvals, { limit: 20, counts: { total: m.approvals.length }, cursor: null });
    else if (p === "/api/v1/bridge/devices") r = ok([]);
    else if (p === "/api/v1/me/ticket-drafts") r = ok([]);
    else if (p === "/api/v1/me/setup-tasks" && m.tasksStatus !== 200)
      r = { status: m.tasksStatus, body: { error: "server_error", code: "INTERNAL" } };
    else if (p === "/api/v1/me/setup-tasks") r = ok(m.tasks, { dismissed: m.dismissed });
    else if (p === "/api/v1/me/setup-tasks/dismiss" && req.method() === "POST" && m.dismissStatus >= 300) {
      const key = (req.postDataJSON() as { key?: string } | null)?.key;
      if (key === undefined) m.dismissCalls += 1;
      else m.skipCalls.push(String(key));
      r = { status: m.dismissStatus, body: { error: "server_error", code: "INTERNAL" } };
    } else if (p === "/api/v1/me/setup-tasks/dismiss" && req.method() === "POST") {
      // K-250 の口：体 {} は箱を閉じる・体 { key } は任意の項目を飛ばす（どちらも 201・今の状態を返す）
      const key = (req.postDataJSON() as { key?: string } | null)?.key;
      if (key === undefined) {
        m.dismissCalls += 1;
        m.dismissed = true;
      } else {
        m.skipCalls.push(String(key));
        m.tasks = m.tasks.map((t) => (t.key === key ? { ...t, skipped: true } : t));
      }
      r = {
        status: 201,
        body: { data: { dismissed: m.dismissed, skipped: m.tasks.filter((t) => t.skipped).map((t) => t.key) } },
      };
    } else if (p === "/api/v1/tickets" && req.method() === "GET") {
      m.listCalls.push(u.searchParams);
      r = await m.list(u.searchParams, m.listCalls.length);
    } else if (/^\/api\/v1\/tickets\/[^/]+$/.test(p)) {
      const id = p.split("/").pop()!;
      const n = Number(id.slice(-12));
      r = ok({
        ticket: { id, number: `EG-${100 + n}`, title: `チケット ${n}`, due_on: null, start_on: null, priority: "mid" },
        sections: [{ key: "purpose", label: "目的", body: { text: "目的の本文" }, version: 1 }],
        kind: { name: "タスク" },
        stage: { name: "未着手" },
        assignee: { display_name: "高本" },
      });
    } else if (/^\/api\/v1\/tickets\/[^/]+\/runs$/.test(p)) r = ok([]);
    await route.fulfill({
      status: r.status,
      contentType: "application/json",
      body: r.body === null ? "" : JSON.stringify(r.body),
    });
  });
  return m;
}

export async function open(page: Page, path = "/tickets", width = 1440) {
  await page.setViewportSize({ width, height: 900 });
  const res = await page.goto(path);
  expect(res?.status()).toBe(200);
}
export const head = (page: Page) => page.locator("header.k-page-head");
export const views = (page: Page) => page.getByRole("navigation", { name: "チケットの見え方" });
export const table = (page: Page) => page.getByRole("table", { name: "チケットの一覧" });
export const rowsOf = (page: Page) => table(page).locator("tbody tr[data-ticket]");
export const css = (page: Page, sel: string, prop: string) =>
  page
    .locator(sel)
    .first()
    .evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);
export const overflowX = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
export const gate = () => {
  let release!: () => void;
  const wait = new Promise<void>((r) => (release = r));
  return { wait, open: () => release() };
};

/** 押せない物：aria-disabled・リンクでない・グレー・押しても Enter でも URL が変わらない */
export async function expectDisabled(page: Page, it: Locator, name: string) {
  await expect(it, name).toHaveAttribute("aria-disabled", "true");
  expect(await it.evaluate((e) => e.tagName), name).not.toBe("A");
  expect(Number(await it.evaluate((e) => getComputedStyle(e).opacity)), name).toBeCloseTo(DISABLED_OPACITY, 3);
  const before = page.url();
  await it.click({ force: true });
  await it.press("Enter");
  expect(page.url(), name).toBe(before);
}

export interface Group {
  id: string;
  canvas: string;
  app: string;
  state: string;
  widths: number[];
  pairs: FidelityPair[];
  owner: string;
  enrolled: boolean;
}
export const CFG = JSON.parse(readFileSync(join(ROOT, "04_design/fidelity.json"), "utf8")) as { groups: Group[] };

/** 組が enrolled・持ち主・鍵が在ることを見てから、キャンバスと画面を同じ幅で描いて組の値と読み込んだ書体を比べる */
export async function compareGroup(browser: Browser, g: Group | undefined, owner: string, w: number) {
  expect(g, "組が設定に無い").toBeTruthy();
  expect(g!.enrolled, `${g!.id} が enrolled`).toBe(true);
  expect(g!.owner, g!.id).toBe(owner);
  expect(FIDELITY_STATES[g!.state], `${g!.id} の state ${g!.state}`).toBeTruthy();
  const canvasPage = await browser.newPage({ viewport: { width: w, height: 1000 }, colorScheme: "light" });
  await routeCanvasFonts(canvasPage);
  await canvasPage.goto(pathToFileURL(join(ROOT, `04_design/canvas/${g!.canvas}.dc.html`)).href);
  for (const p of g!.pairs) await canvasPage.locator(p.canvas).first().waitFor({ state: "visible" });
  await canvasPage.evaluate(() => document.fonts.ready);
  const canvasVals = await readVals(canvasPage, g!.pairs, "canvas");
  const canvasFonts = await loadedFonts(canvasPage);
  await canvasPage.close();
  const appPage = await browser.newPage({ viewport: { width: w, height: 1000 }, colorScheme: "light" });
  await appPage.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await FIDELITY_STATES[g!.state]!(appPage, g!.app);
  for (const p of g!.pairs) await appPage.locator(p.app).first().waitFor({ state: "visible" });
  await appPage.evaluate(() => document.fonts.ready);
  const appVals = await readVals(appPage, g!.pairs, "app");
  const appFonts = await loadedFonts(appPage);
  await appPage.close();
  const rows = [...compareRows(g!.pairs, canvasVals, appVals), compareFonts(canvasFonts, appFonts)];
  const bad = rows.filter((r) => !r.ok).map((r) => `${r.part}・${r.prop}：キャンバス ${r.canvas} ／ 画面 ${r.app}`);
  expect(mismatches(rows), bad.join("\n")).toBe(0);
}
