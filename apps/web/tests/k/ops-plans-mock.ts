// 配るもの › プランの画面（/ops/skills/plans・K-991）の試験の道具と答えの見本（K-991 が持ち込む・ブラウザの試験と画面の外の試験の両方が読む）。
//   ops-mock.ts（K-965：運営のログインと外枠）の後ろに、プランの口と本人確認の取り直しの口の差し替えを足す（後に足した route が先に効く）。
//   答えの形は 11_tickets/K-987.md（PlanOps・PlanProposal・PlanHistoryRow）と K-989.md（影響の 7 欄）。
//   字・数は下絵（features/F12/ops2/views-plans.tsx・ops2-sample.ts の IMPACT_ROWS）と同じになる値。今は 2026-11-09 10:00（日本時間）に止める。固定の待ちは使わない
import type { Page, Request, Route } from "@playwright/test";
import { uid } from "./ops-answers";

export const NOW = new Date("2026-11-09T01:00:00Z");
export const ME = { member_id: uid(0x9910), name: "高本 聖斗" };
export const SANO = { member_id: uid(0x9911), name: "佐野 美穂" };
export const PROPOSAL_ID = uid(0x9920);

// 中身の行は人数と使えるものだけ（分身の実行の回数とファイルの量はプランで分けない・D-156.63）
const facts = (members: number, uses: string) => [
  { label: "人数", value: `${members} 人まで` },
  { label: "使えるもの", value: uses },
];
/** 下絵 oq-plans の 3 つの箱。trial_days は今の版の無料期間（日・K-1104 が listOpsPlans に足す） */
export const PLANS_A = [
  {
    plan_key: "free",
    name: "無料",
    version: 1,
    price_monthly: 0,
    member_limit: 3,
    places: 21,
    trial_days: 0,
    proposal: null,
    facts: facts(3, "チケット・承認・ナレッジ"),
  },
  {
    plan_key: "team",
    name: "チーム",
    version: 1,
    price_monthly: 15000,
    member_limit: 10,
    places: 19,
    trial_days: 0,
    proposal: { id: PROPOSAL_ID, state: "waiting", to_version: 2, price_monthly: 18000, proposer_name: SANO.name },
    facts: facts(10, "＋ ゲストを招く"),
  },
  {
    plan_key: "business",
    name: "ビジネス",
    version: 1,
    price_monthly: 40000,
    member_limit: 30,
    places: 8,
    trial_days: 0,
    proposal: null,
    facts: facts(30, "＋ ゲストのグループ"),
  },
];
/** 下絵 oq-plan-edit・oq-plan-review の案（佐野が作り、11/04 16:40 に回した） */
export const proposalOf = (o: Partial<Record<string, unknown>> = {}) => ({
  id: PROPOSAL_ID,
  plan_key: "team",
  plan_name: "チーム",
  from_version: 1,
  to_version: 2,
  before: { price_monthly: 15000, member_limit: 10 },
  changes: { price_monthly: 18000, member_limit: 12 },
  existing_policy: "after_days",
  notice_days: 90,
  new_from: "2026-12-01",
  reason: "チームの使われ方が増え、人数の上限に当たる会社が多いため。人数を 12 人まで広げ、値段を見直す",
  state: "waiting",
  proposer: SANO,
  decider: null,
  return_reason: null,
  created_at: "2026-11-04T02:20:00Z",
  submitted_at: "2026-11-04T07:40:00Z",
  decided_at: null,
  can_edit: false,
  can_decide: true,
  ...o,
});
const ws = (n: number, name: string, members: number, stopped = false) => ({
  workspace: { id: uid(0x9930 + n), name },
  members,
  now_price: 15000,
  after_price: stopped ? null : 18000,
  from_month: stopped ? null : "2027-02",
  stopped,
});
/** 下絵の影響（19 か所・止めている 1・+ ¥57,000・2027 年 2 月分から・12/01 から） */
export const IMPACT_A = {
  customers: 19,
  stopped: 1,
  monthly_revenue_diff: 57000,
  immediate: false,
  existing_from: "2027-02",
  new_from: "2026-12-01",
  by_workspace: [
    ws(1, "ミナト企画", 8),
    ws(2, "ENGINE BASE", 5),
    ws(3, "北村デザイン", 4),
    ws(4, "ハル製作所", 6, true),
    ...Array.from({ length: 15 }, (_, i) => ws(10 + i, `ワークスペース ${i + 1}`, 3)),
  ],
};
const hist = (
  n: number,
  at: string,
  who: string,
  action: string,
  plan: string,
  ver: number,
  o: Record<string, unknown> = {},
) => ({
  id: uid(0x9940 + n),
  at,
  actor_name: who,
  action,
  plan_name: plan,
  to_version: ver,
  reason: null,
  price: null,
  members: null,
  ...o,
});
/** 下絵 oq-plan-log の 5 行（新しい順） */
export const HISTORY_A = [
  hist(1, "2026-11-04T07:40:00Z", SANO.name, "plan.submit", "チーム", 2, {
    price: { from: 20000, to: 18000 },
    members: { from: 10, to: 12 },
  }),
  hist(2, "2026-11-04T06:10:00Z", ME.name, "plan.return", "チーム", 2, {
    reason: "上げ幅が大きい。人数の上限を広げるなら考える",
  }),
  hist(3, "2026-11-04T02:20:00Z", SANO.name, "plan.propose", "チーム", 2, { price: { from: 15000, to: 20000 } }),
  hist(4, "2026-10-14T00:30:00Z", ME.name, "plan.decide", "ビジネス", 1, {}),
  hist(5, "2026-04-01T01:00:00Z", ME.name, "plan.decide", "無料・チーム・ビジネス", 1, {}),
];

type Reply = { status: number; body: unknown } | "abort";
export type PlansKey = "plans" | "proposals" | "history" | "impact" | "create" | "update" | "submit" | "decide" | "ret";
export interface PlansMock {
  calls: string[];
  queries: URLSearchParams[];
  bodies: Partial<Record<PlansKey, unknown[]>>;
  on: Record<PlansKey, (req: Request) => Reply>;
}
const ROUTES: readonly [PlansKey, string, RegExp][] = [
  ["impact", "GET", /^\/api\/v1\/ops\/plan_proposals\/[^/]+\/impact$/],
  ["submit", "POST", /^\/api\/v1\/ops\/plan_proposals\/[^/]+\/submit$/],
  ["decide", "POST", /^\/api\/v1\/ops\/plan_proposals\/[^/]+\/decide$/],
  ["ret", "POST", /^\/api\/v1\/ops\/plan_proposals\/[^/]+\/return$/],
  ["update", "PATCH", /^\/api\/v1\/ops\/plan_proposals\/[^/]+$/],
  ["create", "POST", /^\/api\/v1\/ops\/plan_proposals$/],
  ["proposals", "GET", /^\/api\/v1\/ops\/plan_proposals$/],
  ["plans", "GET", /^\/api\/v1\/ops\/plans$/],
  ["history", "GET", /^\/api\/v1\/ops\/plan_history$/],
];

/** mockOps（ops-mock.ts）を呼んだ後に呼ぶ。本人確認の取り直しの口もここで差し替える */
export async function mockPlans(page: Page): Promise<PlansMock> {
  const m: PlansMock = {
    calls: [],
    queries: [],
    bodies: {},
    on: {
      plans: () => ({ status: 200, body: { data: PLANS_A } }),
      proposals: () => ({ status: 200, body: { data: [proposalOf()] } }),
      history: () => ({ status: 200, body: { data: HISTORY_A } }),
      impact: () => ({ status: 200, body: { data: IMPACT_A } }),
      create: () => ({
        status: 201,
        body: { data: proposalOf({ state: "draft", can_edit: true, can_decide: false, submitted_at: null }) },
      }),
      update: () => ({
        status: 200,
        body: { data: proposalOf({ state: "draft", can_edit: true, can_decide: false }) },
      }),
      submit: () => ({ status: 200, body: { data: proposalOf() } }),
      decide: () => ({ status: 200, body: { data: proposalOf({ state: "decided", can_decide: false, decider: ME }) } }),
      ret: () => ({ status: 200, body: { data: proposalOf({ state: "returned", can_decide: false, decider: ME }) } }),
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
  await page.route(/\/api\/v1\/ops\/(plans|plan_proposals|plan_history)/, async (route: Route, req: Request) => {
    const u = new URL(req.url());
    const hit = ROUTES.find(([, method, rx]) => method === req.method() && rx.test(u.pathname));
    if (!hit) return route.fallback();
    const [key] = hit;
    m.calls.push(`${req.method()} ${u.pathname}${u.search}`);
    if (req.method() === "GET") m.queries.push(u.searchParams);
    else (m.bodies[key] ??= []).push(req.postDataJSON() as unknown);
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
export const count = (m: PlansMock, prefix: string): number => m.calls.filter((c) => c.startsWith(prefix)).length;
