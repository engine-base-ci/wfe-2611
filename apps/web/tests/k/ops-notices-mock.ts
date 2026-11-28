// 運営のお知らせの画面（/ops/notices・K-980 の一覧と 1 件／K-1015 の書く・書き直す・出す）の試験の道具と答えの見本（K-980 が持ち込む）。
//   ops-mock.ts（K-965：運営のログインと外枠）の後ろに、お知らせの口の差し替えを足す（後に足した route が先に効く）。
//   答えの形は 11_tickets/K-1004.md と K-977.md（一覧の 1 行 10 欄＝9 欄と incident_state・1 件 15 欄）。
//   字・数は下絵（features/F12/ops2/views-notices.tsx の ROWS・NoticePage・NoticePublishConfirm）と同じになる値。今は 2026-11-02 10:30（日本時間）の前提。
//   固定の待ちは使わない。テストはチケットを作る人が書き、実装する人は変えない
import type { Page, Request, Route } from "@playwright/test";
import { uid } from "./ops-answers";

export type Kind = "incident" | "maintenance" | "release";
export type IncidentState = "investigating" | "identified" | "monitoring" | "resolved";
export interface NoticeRowA {
  id: string;
  kind: Kind;
  title: string;
  audience: { mode: "all" | "plans" | "workspaces"; plans: string[]; workspaces: { id: string; name: string }[] };
  state: "draft" | "scheduled" | "published" | "resolved";
  incident_state: IncidentState | null;
  placements: ("band" | "list")[];
  publish_at: string | null;
  published_at: string | null;
  author_name: string | null;
}
export interface NoticeDetailA extends NoticeRowA {
  body: string;
  maintenance: { from: string; to: string } | null;
  impact: string | null;
  updates: { state: IncidentState; body: string; at: string }[];
  reach: { workspaces: number; members: number };
}
const ALL = { mode: "all" as const, plans: [], workspaces: [] };
/** 下絵 oq-notices の 5 行 */
export const NOTICES_A: NoticeRowA[] = [
  {
    id: uid(0x9801),
    kind: "incident",
    title: "分身の実行が遅れています",
    audience: ALL,
    state: "published",
    incident_state: "identified",
    placements: ["band", "list"],
    publish_at: "2026-11-02T00:40:00Z",
    published_at: "2026-11-02T00:40:00Z",
    author_name: "高本",
  },
  {
    id: uid(0x9802),
    kind: "maintenance",
    title: "11/10（月）2:00〜3:00 メンテナンス",
    audience: ALL,
    state: "scheduled",
    incident_state: null,
    placements: ["band", "list"],
    publish_at: "2026-11-03T01:00:00Z",
    published_at: null,
    author_name: "高本",
  },
  {
    id: uid(0x9803),
    kind: "release",
    title: "チケットにスレッドができました",
    audience: ALL,
    state: "published",
    incident_state: null,
    placements: ["list"],
    publish_at: "2026-10-28T01:00:00Z",
    published_at: "2026-10-28T01:00:00Z",
    author_name: "高本",
  },
  {
    id: uid(0x9804),
    kind: "release",
    title: "先方の人を招けるようにしました",
    audience: { mode: "plans", plans: ["team", "business"], workspaces: [] },
    state: "published",
    incident_state: null,
    placements: ["list"],
    publish_at: "2026-10-14T01:00:00Z",
    published_at: "2026-10-14T01:00:00Z",
    author_name: "佐野",
  },
  {
    id: uid(0x9805),
    kind: "release",
    title: "ナレッジの取り込み（Obsidian・Notion）",
    audience: ALL,
    state: "draft",
    incident_state: null,
    placements: ["list"],
    publish_at: null,
    published_at: null,
    author_name: "佐野",
  },
];
/** 下絵 oq-notice の 1 件（障害・原因が分かった・続報 2 つ） */
export const incidentOf = (o: Partial<NoticeDetailA> = {}): NoticeDetailA => ({
  ...NOTICES_A[0]!,
  body: "分身の実行が始まるまでに時間がかかっています。",
  maintenance: null,
  impact: "分身の実行",
  updates: [
    {
      state: "investigating",
      body: "分身の実行が始まるまでに時間がかかっています。調べています。",
      at: "2026-11-02T00:40:00Z",
    },
    {
      state: "identified",
      body: "送る順番の仕組みが詰まっていました。入れ替えています。データは消えていません。",
      at: "2026-11-02T01:20:00Z",
    },
  ],
  reach: { workspaces: 48, members: 312 },
  ...o,
});
/** 下絵 oq-notice-new・oq-notice-publish のメンテの下書き */
export const maintOf = (o: Partial<NoticeDetailA> = {}): NoticeDetailA => ({
  ...NOTICES_A[1]!,
  state: "draft",
  body: "データベースの入れ替えのため、11/10（月）2:00〜3:00 の間 Kaname を使えません。\n・実行中の分身の仕事は、始まる前に区切りまで進めて止めます\n・この間に承認したものは「実行待ち」になり、終わってから動きます",
  maintenance: { from: "2026-11-09T17:00:00Z", to: "2026-11-09T18:00:00Z" },
  impact: "画面・分身の実行・PC とのつながり",
  updates: [],
  reach: { workspaces: 48, members: 312 },
  ...o,
});

type Reply = { status: number; body: unknown } | "abort";
export type NoticeKey = "list" | "one" | "create" | "update" | "publish" | "incident";
export interface NoticesMock {
  calls: string[];
  /** 一覧の口に来た問い合わせの値（並びのまま） */
  listQueries: URLSearchParams[];
  bodies: Partial<Record<NoticeKey, unknown[]>>;
  on: Record<NoticeKey, (req: Request) => Reply>;
}
const ROUTES: readonly [NoticeKey, string, RegExp][] = [
  ["publish", "POST", /^\/api\/v1\/ops\/notices\/[^/]+\/publish$/],
  ["incident", "POST", /^\/api\/v1\/ops\/notices\/[^/]+\/updates$/],
  ["update", "PATCH", /^\/api\/v1\/ops\/notices\/[^/]+$/],
  ["one", "GET", /^\/api\/v1\/ops\/notices\/[^/]+$/],
  ["create", "POST", /^\/api\/v1\/ops\/notices$/],
  ["list", "GET", /^\/api\/v1\/ops\/notices$/],
];

/** mockOps（ops-mock.ts）を呼んだ後に呼ぶ */
export async function mockNotices(page: Page): Promise<NoticesMock> {
  const m: NoticesMock = {
    calls: [],
    listQueries: [],
    bodies: {},
    on: {
      list: () => ({ status: 200, body: { data: NOTICES_A } }),
      one: () => ({ status: 200, body: { data: incidentOf() } }),
      create: () => ({ status: 501, body: { code: "NOT_IMPLEMENTED" } }),
      update: () => ({ status: 501, body: { code: "NOT_IMPLEMENTED" } }),
      publish: () => ({ status: 501, body: { code: "NOT_IMPLEMENTED" } }),
      incident: () => ({ status: 501, body: { code: "NOT_IMPLEMENTED" } }),
    },
  };
  await page.route(/\/api\/v1\/ops\/notices/, async (route: Route, req: Request) => {
    const u = new URL(req.url());
    const hit = ROUTES.find(([, method, rx]) => method === req.method() && rx.test(u.pathname));
    if (!hit) return route.fallback();
    const [key] = hit;
    m.calls.push(`${req.method()} ${u.pathname}${u.search}`);
    if (key === "list") m.listQueries.push(u.searchParams);
    if (req.method() !== "GET") (m.bodies[key] ??= []).push(req.postDataJSON() as unknown);
    const r = m.on[key](req);
    if (r === "abort") return route.abort("failed");
    await route.fulfill({
      status: r.status,
      headers: { "access-control-allow-origin": "*" },
      contentType: "application/json",
      body: JSON.stringify(r.body),
    });
  });
  return m;
}
