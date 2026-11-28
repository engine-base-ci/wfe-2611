// 運営の請求の画面（/ops/billing・K-984）の試験の道具と答えの見本（K-984 が持ち込む・ブラウザの試験と画面の外の試験の両方が読む）。
//   ops-mock.ts（K-965：運営のログインと外枠）の後ろに、請求の口の差し替えを足す（後に足した route が先に効く）。
//   答えの形は 11_tickets/K-1005.md（listOpsInvoices の 1 行 11 欄（入金の並び payments を含む・D-156.44）・issueOpsInvoices の 4 欄と 1 行 6 欄・recordPayment は 1 行）。
//   今は 2026-11-09 10:00（日本時間）に止める（NOW・page.clock）。字・数は下絵（features/F12/ops2/ops2-sample.ts の BILL_ROWS・views-bills.tsx）
//   と同じになる値。固定の待ちは使わない
import type { Page, Request, Route } from "@playwright/test";
import { uid } from "./ops-answers";

/** 今（日本の 2026-11-09 10:00） */
export const NOW = new Date("2026-11-09T01:00:00Z");
export interface BillRowA {
  id: string;
  workspace: { id: string; name: string };
  plan_name: string | null;
  month: string;
  amount_total: number;
  state: "unpaid" | "paid" | "overdue";
  paid_total: number;
  difference: number;
  due_on: string;
  can_record_payment: boolean;
  payments: { id: string; paid_on: string; amount: number; payer_name?: string; reversed: boolean }[];
}
function bill(
  n: number,
  ws: string,
  plan: string,
  month: string,
  amount: number,
  state: BillRowA["state"],
  due: string,
  paid = 0,
  payments: BillRowA["payments"] = [],
): BillRowA {
  return {
    id: uid(0x9840 + n),
    workspace: { id: uid(0x9850 + n), name: ws },
    plan_name: plan,
    month,
    amount_total: amount,
    state,
    paid_total: paid,
    difference: amount - paid,
    due_on: due,
    can_record_payment: state !== "paid",
    payments,
  };
}
/** 北村デザイン事務所の 9 月分に入れて取り消した入金（下絵 oq-pay の「これまでの入金」の 1 行） */
export const KITA_PAY = {
  id: uid(0x9861),
  paid_on: "2026-11-01",
  amount: 16_500,
  payer_name: "キタムラデザイン",
  reversed: true,
};
/** 下絵 oq-bills の 5 行（期限を過ぎた物が上） */
export const BILLS_A: BillRowA[] = [
  bill(1, "北村デザイン事務所", "チーム", "2026-09", 16_500, "overdue", "2026-10-31", 0, [KITA_PAY]),
  bill(2, "株式会社ハル製作所", "チーム", "2026-08", 33_000, "overdue", "2026-09-30"),
  bill(3, "合同会社ミナト企画", "チーム", "2026-10", 16_500, "unpaid", "2026-11-30"),
  bill(4, "株式会社サクラ会計", "ビジネス", "2026-10", 44_000, "paid", "2026-11-30", 44_000),
  bill(5, "株式会社オオタ物流", "ビジネス", "2026-10", 44_000, "paid", "2026-11-30", 44_000),
];
/** 下絵 oq-bills-issue の下書き（10 月分・46 件・合計 ¥1,207,800） */
export const DRAFT_A = {
  month: "2026-10",
  count: 46,
  total: 1_207_800,
  lines: [
    {
      workspace: { id: uid(0x9853), name: "合同会社ミナト企画" },
      plan_name: "チーム",
      amount: 15_000,
      tax: 1_500,
      prorated: 0,
      total: 16_500,
    },
  ],
};
/** 入金を記録した後の 1 行（北村デザイン事務所・同じ額） */
export const paidOf = (r: BillRowA, amount: number): BillRowA => ({
  ...r,
  paid_total: r.paid_total + amount,
  difference: r.amount_total - r.paid_total - amount,
  state: r.paid_total + amount === r.amount_total ? "paid" : r.state,
  can_record_payment: r.paid_total + amount !== r.amount_total,
});

type Reply = { status: number; body: unknown } | "abort";
export type BillsKey = "list" | "issue" | "pay";
export interface BillsMock {
  calls: string[];
  /** 一覧の口に来た問い合わせの値（並びのまま） */
  listQueries: URLSearchParams[];
  bodies: Partial<Record<BillsKey, unknown[]>>;
  on: Record<BillsKey, (req: Request) => Reply>;
}
const ROUTES: readonly [BillsKey, string, RegExp][] = [
  ["issue", "POST", /^\/api\/v1\/ops\/invoices\/issue$/],
  ["pay", "POST", /^\/api\/v1\/ops\/invoices\/[^/]+\/payments$/],
  ["list", "GET", /^\/api\/v1\/ops\/invoices$/],
];

/** mockOps（ops-mock.ts）を呼んだ後に呼ぶ。本人確認の取り直しの口（getMySecurity・stepUp）もここで差し替える */
export async function mockBills(page: Page): Promise<BillsMock> {
  const m: BillsMock = {
    calls: [],
    listQueries: [],
    bodies: {},
    on: {
      list: () => ({ status: 200, body: { data: BILLS_A } }),
      issue: () => ({ status: 201, body: { data: DRAFT_A } }),
      pay: () => ({ status: 501, body: { code: "NOT_IMPLEMENTED" } }),
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
  await page.route(/\/api\/v1\/ops\/invoices/, async (route: Route, req: Request) => {
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

/** 呼ばれた回数（「METHOD 道の頭」で数える） */
export const count = (m: BillsMock, prefix: string): number => m.calls.filter((c) => c.startsWith(prefix)).length;
