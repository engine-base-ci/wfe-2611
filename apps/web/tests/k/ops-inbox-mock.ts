// 運営の受信箱の画面（/ops/support・K-976）の試験の道具と答えの見本（K-976 が持ち込む・ブラウザの試験と画面の外の試験の両方が読む）。
//   ops-mock.ts（K-965：運営のログインと外枠）の後ろに、受信箱の口の差し替えを足す（後に足した route が先に効く）。
//   答えの形は 11_tickets/K-948.md（listOpsInquiries の 1 行 10 欄・getOpsInquiry の 13 欄・OpsInquiryMessage の 6 欄）。
//   字・数は下絵（features/F12/ops2/ops2-sample.ts の INBOX_ROWS・views-inbox.tsx）と同じになる値。固定の待ちは使わない
import type { Page, Request, Route } from "@playwright/test";
import { uid } from "./ops-answers";

export interface InqRowA {
  id: string;
  title: string;
  topic: "usage" | "trouble" | "billing" | "other";
  state: "open" | "waiting" | "later" | "done";
  workspace: { id: string; name: string };
  asker: { name: string };
  owner: { member_id: string; name: string } | null;
  later_until: string | null;
  created_at: string;
  last_message_at: string;
}
export interface InqMsgA {
  id: string;
  kind: "customer" | "reply" | "note";
  author_name: string;
  body: string;
  attachments: { id: string; name: string; size: number }[];
  created_at: string;
}
export const ME = uid(0x9a1);
export const SANO = uid(0x9a2);
/** 下絵 oq-inbox の「自分」の 3 行（今は 2026-11-02 10:00 日本時間の前提で、届いた時刻の字は画面が作る） */
export const INBOX_A: InqRowA[] = [
  row(0x9761, "承認したのに動かない", "trouble", "open", "ミナト企画", "湊 さくら", "2026-11-02T00:40:00Z"),
  row(0x9762, "請求書の宛名を変えたい", "billing", "waiting", "北村デザイン", "北村 透", "2026-11-01T05:00:00Z"),
  row(0x9763, "人数の上限を一時的に増やせるか", "billing", "open", "オオタ物流", "太田 誠", "2026-10-30T02:00:00Z"),
];
function row(
  n: number,
  title: string,
  topic: InqRowA["topic"],
  state: InqRowA["state"],
  ws: string,
  who: string,
  at: string,
): InqRowA {
  return {
    id: uid(n),
    title,
    topic,
    state,
    workspace: { id: uid(n + 0x100), name: ws },
    asker: { name: who },
    owner: { member_id: ME, name: "高本" },
    later_until: null,
    created_at: at,
    last_message_at: at,
  };
}
/** 下絵 oq-inbox-thread の 1 件（顧客の内容・社内メモ） */
export const detailOf = (o: Partial<InqRowA> = {}) => ({
  ...INBOX_A[0]!,
  ...o,
  messages: [
    msg(
      1,
      "customer",
      "湊 さくら",
      "請求書を送るチケットを承認したのですが、30 分たっても「実行待ち」のままです。PC はつけています。",
      "2026-11-02T00:40:00Z",
    ),
    msg(
      2,
      "note",
      "高本",
      "中を見る（見るだけ）で実行の記録を確認。GMAIL_WORK の期限切れで止まっている。本人に預け直してもらえば動く",
      "2026-11-02T00:58:00Z",
    ),
  ] as InqMsgA[],
  context: { path: "/tickets/KN-212", at: "2026-11-02T00:38:00Z", browser: "Chrome 130", pc: true },
  workspace_status: { plan_name: "チーム", members: 8, pc: "connected", stuck_runs: 3, overdue: 0 },
});
function msg(n: number, kind: InqMsgA["kind"], author: string, body: string, at: string): InqMsgA {
  return { id: uid(0x9770 + n), kind, author_name: author, body, attachments: [], created_at: at };
}

type Reply = { status: number; body: unknown } | "abort";
export type InboxKey = "list" | "one" | "update" | "reply" | "note";
export interface InboxMock {
  calls: string[];
  /** 一覧の口に来た問い合わせの値（並びのまま） */
  listQueries: URLSearchParams[];
  bodies: Partial<Record<InboxKey, unknown[]>>;
  on: Record<InboxKey, (req: Request) => Reply>;
}
const ROUTES: readonly [InboxKey, string, RegExp][] = [
  ["reply", "POST", /^\/api\/v1\/ops\/inquiries\/[^/]+\/replies$/],
  ["note", "POST", /^\/api\/v1\/ops\/inquiries\/[^/]+\/notes$/],
  ["update", "PATCH", /^\/api\/v1\/ops\/inquiries\/[^/]+$/],
  ["one", "GET", /^\/api\/v1\/ops\/inquiries\/[^/]+$/],
  ["list", "GET", /^\/api\/v1\/ops\/inquiries$/],
];

/** mockOps（ops-mock.ts）を呼んだ後に呼ぶ */
export async function mockInbox(page: Page): Promise<InboxMock> {
  const m: InboxMock = {
    calls: [],
    listQueries: [],
    bodies: {},
    on: {
      list: () => ({ status: 200, body: { data: INBOX_A } }),
      one: () => ({ status: 200, body: { data: detailOf() } }),
      update: () => ({ status: 501, body: { code: "NOT_IMPLEMENTED" } }),
      reply: () => ({ status: 501, body: { code: "NOT_IMPLEMENTED" } }),
      note: () => ({ status: 501, body: { code: "NOT_IMPLEMENTED" } }),
    },
  };
  await page.route(/\/api\/v1\/ops\/inquiries/, async (route: Route, req: Request) => {
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
