// 運営の人の画面（/ops/team・K-986）の試験の道具と答えの見本（K-986 が持ち込む・ブラウザの試験と画面の外の試験の両方が読む）。
//   ops-mock.ts（K-965：運営のログインと外枠）の後ろに、運営の人の口と本人確認の取り直しの口の差し替えを足す（後に足した route が先に効く）。
//   答えの形は 11_tickets/K-985.md（OpsMemberRow の 8 欄・addOpsMember の meta.mail_sent）と K-1009.md（外すの 3 欄・409 の detail.cap）。
//   名前・字は下絵（features/F12/ops/ops-sample.ts の TEAM・views-team.tsx）と同じにする（モックとの突き合わせのため）。固定の待ちは使わない
import type { Page, Request, Route } from "@playwright/test";
import { uid } from "./ops-answers";

export const CAPS = [
  "inquiry",
  "peek",
  "money",
  "stop",
  "notice",
  "distribute",
  "plan_propose",
  "plan_decide",
  "ops_people",
] as const;
export interface OpsMemberA {
  member_id: string;
  name: string;
  email: string;
  caps: string[];
  has_passkey: boolean;
  setup_pending: boolean;
  is_self: boolean;
  locked_caps: string[];
}
const pick = (flags: readonly boolean[]): string[] => CAPS.filter((_, i) => flags[i] === true);
/** 下絵 op-team の 3 人（高本は自分・運営の人と値段を決めるの最後の 1 人） */
export const TEAM_A: OpsMemberA[] = [
  {
    member_id: uid(0x9861),
    name: "高本 聖斗",
    email: "takamoto@kaname.example",
    caps: [...CAPS],
    has_passkey: true,
    setup_pending: false,
    is_self: true,
    locked_caps: ["plan_decide", "ops_people"],
  },
  {
    member_id: uid(0x9862),
    name: "佐野 美穂",
    email: "sano@kaname.example",
    caps: pick([true, true, true, false, true, false, true, false, false]),
    has_passkey: true,
    setup_pending: false,
    is_self: false,
    locked_caps: [],
  },
  {
    member_id: uid(0x9863),
    name: "木村 直人",
    email: "kimura@kaname.example",
    caps: pick([false, false, true, false, false, false, true, false, false]),
    has_passkey: true,
    setup_pending: false,
    is_self: false,
    locked_caps: [],
  },
];

type Reply = { status: number; body: unknown } | "abort";
export type TeamKey = "list" | "add" | "edit" | "remove";
export interface TeamMock {
  calls: string[];
  bodies: Partial<Record<TeamKey, unknown[]>>;
  on: Record<TeamKey, (req: Request) => Reply>;
}
const ROUTES: readonly [TeamKey, string, RegExp][] = [
  ["add", "POST", /^\/api\/v1\/ops\/members$/],
  ["edit", "PATCH", /^\/api\/v1\/ops\/members\/[^/]+$/],
  ["remove", "DELETE", /^\/api\/v1\/ops\/members\/[^/]+$/],
  ["list", "GET", /^\/api\/v1\/ops\/members$/],
];

/** mockOps（ops-mock.ts）を呼んだ後に呼ぶ。本人確認の取り直しの口（getMySecurity・stepUp）もここで差し替える */
export async function mockTeam(page: Page): Promise<TeamMock> {
  const m: TeamMock = {
    calls: [],
    bodies: {},
    on: {
      list: () => ({ status: 200, body: { data: TEAM_A } }),
      add: (req) => {
        const b = req.postDataJSON() as { email: string; caps: string[] };
        return {
          status: 201,
          body: {
            data: {
              member_id: uid(0x9869),
              name: b.email.split("@")[0],
              email: b.email,
              caps: b.caps,
              has_passkey: false,
              setup_pending: true,
              is_self: false,
              locked_caps: [],
            },
            meta: { mail_sent: true },
          },
        };
      },
      edit: (req) => ({
        status: 200,
        body: { data: { ...TEAM_A[1]!, caps: (req.postDataJSON() as { caps: string[] }).caps } },
      }),
      remove: () => ({
        status: 200,
        body: { data: { member_id: TEAM_A[1]!.member_id, removed_at: "2026-11-09T01:00:00Z", released_inquiries: 0 } },
      }),
    },
  };
  await page.route(/\/api\/v1\/(me\/security|auth\/step-up)$/, async (route: Route, req: Request) => {
    const p = new URL(req.url()).pathname;
    m.calls.push(`${req.method()} ${p}`);
    const body = p.endsWith("/me/security")
      ? { data: { has_password: false, two_factor: false, two_factor_required: false, mfa_pending: false } }
      : { data: { step_up_at: new Date().toISOString() } };
    await route.fulfill({
      status: p.endsWith("/me/security") ? 200 : 201,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await page.route(/\/api\/v1\/ops\/members/, async (route: Route, req: Request) => {
    const u = new URL(req.url());
    const hit = ROUTES.find(([, method, rx]) => method === req.method() && rx.test(u.pathname));
    if (!hit) return route.fallback();
    const [key] = hit;
    m.calls.push(`${req.method()} ${u.pathname}`);
    if (req.method() === "POST" || req.method() === "PATCH") (m.bodies[key] ??= []).push(req.postDataJSON() as unknown);
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
export const count = (m: TeamMock, prefix: string): number => m.calls.filter((c) => c.startsWith(prefix)).length;
