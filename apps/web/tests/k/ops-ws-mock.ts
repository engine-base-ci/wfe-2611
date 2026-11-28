// 運営の 1 社の画面（/ops/tenants/<id>・K-971 のタブ・K-972 の小窓）の画面の試験の道具（K-971 が持ち込む）：
//   ops-mock.ts（K-965：運営のログインと外枠・一覧の口）の後ろに、1 社の口の差し替えを足す（Playwright は後に足した route が先に効く）。
//   口ごとの答えは on.<鍵> を差し替える。書く口の既定は 501（その葉が差し替える）。呼ばれた口は calls に「METHOD 道」で残る。
//   答えの形は 11_tickets/K-1006.md・K-1005.md（違えば ops-ws-answers.ts だけを合わせる）。固定の待ちは使わない
import type { Page, Request, Route } from "@playwright/test";
import { WS_AUDIT, WS_INQUIRIES, WS_MEMBERS, wsBillingOf, wsOf } from "./ops-ws-answers";

export type Reply = { status: number; body: unknown } | "abort";
export type WsKey =
  | "ws"
  | "members"
  | "billing"
  | "inquiries"
  | "audit"
  | "resend"
  | "plan"
  | "peekOpen"
  | "peekClose"
  | "stop"
  | "resume"
  | "notice";
export interface WsMock {
  calls: string[];
  /** 書く口に来た体（鍵ごと・来た順） */
  bodies: Partial<Record<WsKey, unknown[]>>;
  on: Record<WsKey, (req: Request) => Reply>;
}

const NOT_YET: Reply = { status: 501, body: { code: "NOT_IMPLEMENTED" } };
const ROUTES: readonly [WsKey, string, RegExp][] = [
  ["resend", "POST", /^\/api\/v1\/ops\/workspaces\/[^/]+\/members\/[^/]+\/resend-verification$/],
  ["members", "GET", /^\/api\/v1\/ops\/workspaces\/[^/]+\/members$/],
  ["billing", "GET", /^\/api\/v1\/ops\/workspaces\/[^/]+\/billing$/],
  ["inquiries", "GET", /^\/api\/v1\/ops\/workspaces\/[^/]+\/inquiries$/],
  ["audit", "GET", /^\/api\/v1\/ops\/workspaces\/[^/]+\/audit$/],
  ["plan", "POST", /^\/api\/v1\/ops\/workspaces\/[^/]+\/plan$/],
  ["peekOpen", "POST", /^\/api\/v1\/ops\/workspaces\/[^/]+\/peeks$/],
  ["stop", "POST", /^\/api\/v1\/ops\/workspaces\/[^/]+\/stop$/],
  ["resume", "POST", /^\/api\/v1\/ops\/workspaces\/[^/]+\/resume$/],
  ["notice", "POST", /^\/api\/v1\/ops\/workspaces\/[^/]+\/notices$/],
  ["peekClose", "DELETE", /^\/api\/v1\/ops\/peeks\/[^/]+$/],
  ["ws", "GET", /^\/api\/v1\/ops\/workspaces\/[^/]+$/],
];

/** mockOps（ops-mock.ts）を呼んだ後に呼ぶ */
export async function mockWs(page: Page): Promise<WsMock> {
  const m: WsMock = {
    calls: [],
    bodies: {},
    on: {
      ws: () => ({ status: 200, body: { data: wsOf() } }),
      members: () => ({ status: 200, body: { data: WS_MEMBERS } }),
      billing: () => ({ status: 200, body: { data: wsBillingOf() } }),
      inquiries: () => ({ status: 200, body: { data: WS_INQUIRIES } }),
      audit: () => ({ status: 200, body: { data: WS_AUDIT } }),
      resend: () => NOT_YET,
      plan: () => NOT_YET,
      peekOpen: () => NOT_YET,
      peekClose: () => NOT_YET,
      stop: () => NOT_YET,
      resume: () => NOT_YET,
      notice: () => NOT_YET,
    },
  };
  await page.route(/\/api\/v1\/ops\/(workspaces\/[^/?]+|peeks\/)/, async (route: Route, req: Request) => {
    const p = new URL(req.url()).pathname;
    const hit = ROUTES.find(([, method, rx]) => method === req.method() && rx.test(p));
    if (!hit) return route.fallback();
    const [key] = hit;
    m.calls.push(`${req.method()} ${p}`);
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

/** 呼ばれた回数（「METHOD 道の頭」で数える） */
export const count = (m: WsMock, prefix: string): number => m.calls.filter((c) => c.startsWith(prefix)).length;
