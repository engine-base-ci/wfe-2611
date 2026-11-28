// 詳細（/tickets/:id）の新しい形の試験の道具（K-571 が持つ）。口は網の手前で差し替える：
//   GET /api/v1/tickets/:id        → K-560 の答え（body・fields・spec_count・spec_unchecked・no_spec_reason・parent・child_count・link_count・results。sections は前の形の物だけ）
//   GET /api/v1/tickets/:id/runs   → []
//   GET /api/v1/shell              → 外枠の口 getShell の答え（グループは営業 EG・K-466。外枠とグループの行はここから読む）
//   GET /api/v1/tickets/:id/decisions → 決定ログの区画の口（K-397・listTicketDecisions）。答えの results.decisions を口の形にして返す
//   ほか外枠の口（me・scopes・approvals/queue・bridge/devices）は最小の答え。本人の Bridge（127.0.0.1:38617）は届かせない。
//   詳細の画面が呼んだ口を数える（口の数の行）。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { expect, type Page, type Request, type Route } from "@playwright/test";
import { shellReply } from "./shell-answer";

export const WS = "aaaaaaaa-0000-4000-8000-000000000001";
export const ME = "11111111-0000-4000-8000-000000000001";
export const SCOPE = "22222222-0000-4000-8000-000000000001";
export const TID = "0193c5a0-0000-7000-8000-00000000c571";
const API_RE = /\/api\/(v1|auth-ext|auth)\//;

type Json = Record<string, unknown>;
const t = (text: string, marks?: Json[]): Json => ({ type: "text", text, ...(marks ? { marks } : {}) });
export const P = (text: string): Json => ({ type: "paragraph", content: [t(text)] });
export const H2 = (text: string): Json => ({ type: "heading", attrs: { level: 2 }, content: [t(text)] });
export const GHOST = (text: string): Json => ({ type: "paragraph", attrs: { ghost: true }, content: [t(text)] });
export const TASKS = (items: [string, boolean][]): Json => ({
  type: "taskList",
  content: items.map(([text, checked]) => ({ type: "taskItem", attrs: { checked }, content: [P(text)] })),
});
export const TABLE: Json = {
  type: "table",
  content: [
    {
      type: "tableRow",
      content: [
        { type: "tableHeader", content: [P("項目")] },
        { type: "tableHeader", content: [P("金額")] },
      ],
    },
    {
      type: "tableRow",
      content: [
        { type: "tableCell", content: [P("保守費")] },
        { type: "tableCell", content: [P("80,000 円")] },
      ],
    },
  ],
};
export const doc = (...content: Json[]) => ({ type: "doc", content });
export const EMPTY = doc();
/** 下絵 f4v2-detail-new の本文（見出し・段落・チェックの箱・表） */
export const FREE = doc(
  H2("目的"),
  P("セイコー商事に 11 月分の請求を間違いなく届ける。"),
  H2("実施事項"),
  TASKS([
    ["明細を集める", true],
    ["請求書を作って佐藤さんに確かめてもらう", false],
  ]),
  TABLE,
);

export type FieldType = "short_text" | "long_text" | "number" | "date" | "select" | "multi_select" | "check";
export interface DetailField {
  id: string;
  name: string;
  field_type: FieldType;
  required: boolean;
  description: string | null;
  options: { id: string; name: string; position: number }[];
  position: number;
  value: unknown;
}
const fid = (n: number): string => `6f000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const fieldOf = (
  n: number,
  name: string,
  field_type: FieldType,
  value: unknown,
  options: string[] = [],
): DetailField => ({
  id: fid(n),
  name,
  field_type,
  required: false,
  description: null,
  options: options.map((o, i) => ({
    id: `7f000000-0000-4000-${String(n).padStart(4, "0")}-${String(i + 1).padStart(12, "0")}`,
    name: o,
    position: i + 1,
  })),
  position: n,
  value,
});
/** 下絵 f4v2-detail-new の会社の項目（日付 1 つ＋そのほか 3 つ） */
export const COMPANY: DetailField[] = [
  fieldOf(1, "支払期日", "date", "2026-12-15"),
  fieldOf(2, "PJコード", "select", null, ["SK-2026-11", "SK-2026-12"]),
  fieldOf(3, "請求額", "number", 95000),
  fieldOf(4, "分類", "select", null, ["請求", "問い合わせ"]),
];

export interface DetailAnswer {
  body: { doc: unknown; text: string; version: number };
  /** 前の形（K-575 まで残る区画の並び）。新しい形では空 */
  sections: { key: string; label: string; body: { text: string } | null; version: number }[];
  fields: DetailField[];
  spec_count: number;
  spec_unchecked: number;
  no_spec_reason: string | null;
  parent: null;
  child_count: number;
  link_count: number;
  results: Json;
  completed: { at: string; by: string } | null;
  /** 承認待ちの承認（F5 の帯が読む）と、見ている人ができること */
  approval?: Json | null;
  can?: Json | null;
}
export const answer = (o: Partial<DetailAnswer> = {}): DetailAnswer => ({
  body: { doc: FREE, text: "目的", version: 3 },
  sections: [],
  fields: COMPANY,
  spec_count: 3,
  spec_unchecked: 1,
  no_spec_reason: null,
  parent: null,
  child_count: 0,
  link_count: 0,
  results: {},
  completed: null,
  ...o,
});
/** 下絵 f4v2-detail-worked の結果の場所（成果物・決定ログ・申し送り） */
export const RESULTS = {
  artifacts: { text: "請求書.pdf（184 KB）", version: 1, updated_at: "2026-11-21T00:12:00Z" },
  decisions: [
    {
      id: "d1",
      text: "追加対応は 2 件を明細に分けて載せる",
      reason: null,
      decided_at: "2026-11-21T00:05:00Z",
      decided_by_name: "高本",
    },
    {
      id: "d2",
      text: "支払期日は先方の締めに合わせて 12/15 にする",
      reason: null,
      decided_at: "2026-11-21T00:08:00Z",
      decided_by_name: null,
    },
  ],
  handoff: {
    text: "宛先の経理担当が変わっていないか、送る前に佐藤さんが目で確かめてください",
    by_name: "高本",
    at: "2026-11-21T00:20:00Z",
  },
};

/** 答えの results.decisions の 1 行（決定ログの区画の口の形に直して返す） */
interface DecisionIn {
  id: string;
  text: string;
  reason: string | null;
  decided_at: string;
  decided_by_name: string | null;
}

export interface DetailMock {
  /** 詳細の答え。書き換えると次の読み込みに効く */
  a: DetailAnswer;
  /** 詳細・先読みの口に飛んだ要求（"METHOD path"・飛んだ順） */
  seen: string[];
  status: number;
}
export async function mockDetail(page: Page, o: Partial<DetailAnswer> & { status?: number } = {}): Promise<DetailMock> {
  const { status, ...rest } = o;
  const m: DetailMock = { a: answer(rest), seen: [], status: status ?? 200 };
  await page.addInitScript((tok) => window.localStorage.setItem("kaname.token", tok), `tok-${WS}`);
  await page.route(/127\.0\.0\.1:38617/, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(API_RE, async (route: Route, req: Request) => {
    const p = new URL(req.url()).pathname;
    m.seen.push(`${req.method()} ${p}`);
    const ok = (data: unknown, meta: Json = {}) => ({ status: 200, body: { data, meta } });
    let r: { status: number; body: unknown } = { status: 404, body: { error: "not_found", code: "E-PAGE-001" } };
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
    else if (p === "/api/v1/scopes")
      r = ok([{ id: SCOPE, name: "営業", tenant_id: WS, ticket_prefix: "EG" }], { limit: 200, writable: [SCOPE] });
    else if (p === "/api/v1/shell") r = shellReply();
    else if (p === `/api/v1/tickets/${TID}/decisions`)
      r = ok(
        ((m.a.results as { decisions?: DecisionIn[] } | undefined)?.decisions ?? []).map((d) => ({
          id: d.id,
          text: d.text,
          reason: d.reason,
          decided_by: d.decided_by_name ? { id: ME, display_name: d.decided_by_name } : null,
          decided_note: null,
          decided_at: d.decided_at,
          source: null,
          revises_id: null,
          superseded_by_id: null,
          cancelled: null,
        })),
        { can_write: true },
      );
    else if (p === "/api/v1/approvals/queue") r = ok([], { limit: 1, counts: { total: 0 }, cursor: null });
    else if (p === "/api/v1/bridge/devices") r = ok([]);
    else if (p === `/api/v1/tickets/${TID}`)
      r =
        m.status !== 200
          ? {
              status: m.status,
              body: {
                error: m.status === 404 ? "not_found" : "forbidden",
                code: m.status === 404 ? "E-PAGE-001" : "FORBIDDEN",
              },
            }
          : ok({
              ticket: {
                id: TID,
                number: "EG-571",
                title: "セイコー商事の 11 月分の請求書を送る",
                due_on: "2026-12-01",
                start_on: "2026-11-21",
                priority: "mid",
                scope_id: SCOPE,
                created_at: "2026-11-21T00:00:00Z",
              },
              kind: { name: "タスク" },
              stage: { name: "未着手", key: "todo" },
              assignee: { display_name: "高本" },
              ...m.a,
            });
    else if (p === `/api/v1/tickets/${TID}/runs`) r = ok([]);
    await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
  });
  return m;
}

export const WIDTHS = [375, 768, 1440] as const;
export async function openDetail(page: Page, width = 1440): Promise<void> {
  await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
  const res = await page.goto(`/tickets/${TID}`);
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "セイコー商事の 11 月分の請求書を送る" })).toBeVisible();
}
export const panel = (page: Page) => page.getByRole("complementary", { name: "チケットのパネル" });
export const bodyRegion = (page: Page) => page.getByRole("region", { name: "本文", exact: true });
export const overflowX = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
