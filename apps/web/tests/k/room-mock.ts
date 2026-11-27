// 分身の部屋（/ai・/ai/talk・/ai/done）の画面の試験の土台（K-755 が持つ。K-756・K-762 は読むだけで、足す口は自分の道具に置く）。
//   口は網の手前で差し替える（契約の道は 08_api/openapi.yaml・答えの形は 11_tickets/K-753.md・K-754.md の「答えの形」）：
//     GET /api/v1/clones/me         … getMyClone   { name, full_name, since, pc: { state, label } }
//     GET /api/v1/clones/me/now     … getCloneNow  { pc, current, next, waiting_approvals, stopped }
//     GET /api/v1/clones/me/growth  … getCloneGrowth { assigned, pass_rate, pass_rate_last_week, work_seconds }
//     GET /api/auth-ext/me          … 外枠の自分の情報（役・名前）
//   ほかの口は空の一覧を返す（外枠の承認待ちの数など）。書く口（POST・PATCH・PUT・DELETE）は数えて記録する。
//   本人の Bridge（127.0.0.1:38617）には届かせない。固定の待ちは使わない（答えは hold() で止めて見る）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page, type Request, type Route } from "@playwright/test";
import type { FidelityPair } from "../../../../scripts/ci/fidelity_compare.mjs";
import { shellData } from "./shell-answer";

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, "../../../..");
export const API_RE = /\/api\/(v1|auth-ext|auth)\//;
export const ME = "11111111-0000-4000-8000-000000000001";
export const T_NOW = "0193c5a0-0000-7000-8000-00000000c127";
export const T_NEXT1 = "0193c5a0-0000-7000-8000-00000000c121";
export const T_NEXT2 = "0193c5a0-0000-7000-8000-00000000c131";
export const T_STOP = "0193c5a0-0000-7000-8000-00000000c130";
export const WIDTHS_ALL = [320, 375, 768, 1024, 1440] as const;

const ERRORS = (
  JSON.parse(readFileSync(join(ROOT, "07_qa/test-specs/errors.json"), "utf8")) as {
    errors: { id: string; message: string }[];
  }
).errors;
/** 正本（errors.json）の文。画面で文を作らない */
export const msg = (id: string): string => ERRORS.find((e) => e.id === id)?.message ?? `(${id} が errors.json に無い)`;

export type Reply = { status: number; body: unknown };
export type Handler = (req: Request) => Reply | Promise<Reply>;
export type PcState = "none" | "live" | "asleep";

/** 今日（日本時間）の YYYY-MM-DD */
export const todayJst = (): string => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const ago = (min: number): string => new Date(Date.now() - min * 60_000).toISOString();

export const pcOf = (state: PcState) => ({ state, label: state === "none" ? null : "高本の MacBook" });
export const cloneMe = (state: PcState = "live", since = "2026-09-12") => ({
  name: "高本",
  full_name: "高本 聖斗",
  since,
  pc: pcOf(state),
});
/** 下絵 room-overview と同じ字（いま EG-127・このあと EG-121〔順番待ち〕・KR-031〔承認済み〕） */
/** いまの仕事。開くたびに started_at を「3 分前」で作り直す（試験が長く回っても「3 分前から」の字が下絵と同じになるように） */
export const current = () => ({
  ticket_id: T_NOW,
  ticket_number: "EG-127",
  title: "発注ナビ 応募文を出す",
  started_at: ago(3),
  progress: "発注ナビの応募文を作っています",
});
export const NEXT = [
  { ticket_id: T_NEXT1, ticket_number: "EG-121", title: "見積の根拠を確かめる", state: "queued" },
  { ticket_id: T_NEXT2, ticket_number: "KR-031", title: "入金の照合を記録する", state: "approved" },
];
export const NEXT_STOPPED = [
  { ticket_id: T_STOP, ticket_number: "EG-130", title: "経費の申請を出し直す", state: "stopped" },
];
export const cloneNow = (o: Record<string, unknown> = {}) => ({
  pc: pcOf("live"),
  current: current(),
  next: NEXT,
  waiting_approvals: 3,
  stopped: 1,
  ...o,
});
/** 下絵の育ち具合（任せた 18 件・72%・先週 61%・6.2h＝22320 秒） */
export const growth = (o: Record<string, unknown> = {}) => ({
  assigned: 18,
  pass_rate: 72,
  pass_rate_last_week: 61,
  work_seconds: 22320,
  ...o,
});

export interface RoomOptions {
  pc?: PcState;
  since?: string;
  now?: Record<string, unknown>;
  growth?: Record<string, unknown>;
}
export interface RoomMock {
  reads: { me: number; now: number; growth: number };
  /** 書く口に飛んだ「METHOD 道」 */
  writes: string[];
  /** 本人の Bridge へ飛んだ数 */
  bridge: number;
  on: {
    me: Handler;
    now: Handler;
    growth: Handler;
    other: (req: Request, path: string) => Reply | null | Promise<Reply | null>;
  };
  /** 口の答えを止めておく。返した関数を呼ぶと答える（時間で待たない） */
  hold: () => () => void;
  gate: Promise<void>;
}

export const ok = (data: unknown): Reply => ({ status: 200, body: { data } });
export const err = (status: number, code: string): Reply => ({
  status,
  body: { error: code.startsWith("E-") ? "error" : code.toLowerCase(), code },
});

export async function mockRoom(page: Page, o: RoomOptions = {}): Promise<RoomMock> {
  const pc = o.pc ?? "live";
  const m: RoomMock = {
    reads: { me: 0, now: 0, growth: 0 },
    writes: [],
    bridge: 0,
    gate: Promise.resolve(),
    hold: () => {
      let open = () => {};
      m.gate = new Promise<void>((r) => (open = r));
      return () => open();
    },
    on: {
      me: () => ok(cloneMe(pc, o.since)),
      now: () =>
        ok(
          cloneNow({
            pc: pcOf(pc),
            ...(pc === "none" ? { current: null, next: [], waiting_approvals: 0, stopped: 0 } : {}),
            ...(o.now ?? {}),
          }),
        ),
      growth: () => ok(growth(o.growth ?? {})),
      other: () => null,
    },
  };
  await page.addInitScript((t) => window.localStorage.setItem("kaname.token", t), "tok-k755");
  await page.route(/127\.0\.0\.1:38617/, (route) => {
    m.bridge++;
    return route.fulfill({ status: 404, body: "" });
  });
  await page.route(API_RE, async (route: Route, req: Request) => {
    const p = new URL(req.url()).pathname;
    const method = req.method();
    if (method !== "GET" && method !== "HEAD") m.writes.push(`${method} ${p}`);
    let reply: Reply | null = await m.on.other(req, p);
    if (reply) {
      /* 葉ごとの口（話す・やったこと）が答えた */
    } else if (p === "/api/v1/clones/me") {
      m.reads.me++;
      await m.gate;
      reply = await m.on.me(req);
    } else if (p === "/api/v1/clones/me/now") {
      m.reads.now++;
      await m.gate;
      reply = await m.on.now(req);
    } else if (p === "/api/v1/clones/me/growth") {
      m.reads.growth++;
      await m.gate;
      reply = await m.on.growth(req);
    } else if (/\/me$/.test(p))
      reply = ok({ id: ME, member_id: ME, display_name: "高本", role_id: "owner", roles: ["member"], name: "高本" });
    // はじめの設定は通した人（アプリの枠の前の道 /ai/chat は RequireSetup が進み具合を待つ・K762-UI-028）
    else if (p === "/api/auth-ext/setup-state") reply = ok({ step: 6, total: 6 });
    // 外枠は getShell 1 本（K-466）。左のメニューの項目はこの答えで出る（K762-UI-023）
    else if (p === "/api/v1/shell") reply = { status: 200, body: { data: shellData(), meta: {} } };
    else reply = { status: 200, body: { data: [], meta: { limit: 50, counts: { total: 0 } } } };
    await route.fulfill({ status: reply.status, contentType: "application/json", body: JSON.stringify(reply.body) });
  });
  return m;
}

/** 部屋を開き、頭の見出しが出て読み込みが終わるまで待つ */
export async function openRoom(page: Page, path = "/ai", width = 1440): Promise<void> {
  await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
  const res = await page.goto(path);
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "高本のAI", exact: true })).toBeVisible();
  await expect(page.locator('#k-main [aria-busy="true"]')).toHaveCount(0);
}

export const tabs = (page: Page) => page.getByRole("navigation", { name: "部屋のタブ", exact: true });
export const overflowX = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

const BOX = ["width", "height", "x", "y", "background-color", "border-top-color", "border-top-left-radius"];
const TEXT = ["font-size", "font-weight", "color", "line-height", "texts"];
const CTRL = [
  "width",
  "height",
  "x",
  "y",
  "font-size",
  "color",
  "background-color",
  "border-top-color",
  "opacity",
  "texts",
];
const pair = (role: string, sel: string, props: string[]): FidelityPair => ({
  name: role,
  role,
  canvas: sel,
  app: sel,
  props,
});
/** 部屋の頭と「ようす」の役（モックと本番で同じセレクタ。当たらない役は両方 0 個なら一致） */
export const ROOM_HEAD_PAIRS: FidelityPair[] = [
  pair("head", ".k-room-head", BOX),
  pair("h1", ".k-room-head h1", ["x", "y", ...TEXT]),
  pair("sub", ".k-room-sub", ["x", "y", "width", ...TEXT]),
  pair("tabs", ".k-room-tabs", ["x", "y", "width", "height", "texts"]),
  pair("tab-on", '.k-room-tabs [aria-current="page"]', CTRL),
];
export const ROOM_NOW_PAIRS: FidelityPair[] = [
  ...ROOM_HEAD_PAIRS,
  pair("grid", ".k-room-grid", ["x", "y", "width"]),
  pair("card", ".k-room-card", BOX),
  pair("card-h2", ".k-room-card h2", ["x", "y", ...TEXT]),
  pair("now", ".k-room-now", BOX),
  pair("now-title", ".k-room-now-title", ["x", "y", ...TEXT]),
  pair("now-meta", ".k-room-now-meta", ["x", "y", ...TEXT]),
  pair("bar", ".k-room-bar", ["width", "height", "x", "y"]),
  pair("sublabel", ".k-room-sublabel", ["x", "y", ...TEXT]),
  pair("next", ".k-room-next", ["x", "y", "width", "texts"]),
  pair("next-end", ".k-room-next-end", ["font-size", "color", "texts"]),
  pair("wait", ".k-room-wait", [...BOX, "texts"]),
  pair("stats", ".k-room-stats", ["x", "y", "width", "texts"]),
  pair("stat", ".k-room-stat", BOX),
  pair("note", ".k-room-note", ["x", "y", ...TEXT]),
  pair("pc", ".k-room-pc", [...BOX, "texts"]),
  pair("pc-btn", ".k-room-pc button, .k-room-pc a", CTRL),
  pair("empty", ".k-room-empty", [...BOX, "texts"]),
  pair("entry", ".k-room-entry", [...BOX, "texts"]),
  pair("state", ".k-state", [...BOX, "texts"]),
];
