// 請求書・請求先・プランを変える（段 13・領域 user：K-960・K-962）の画面の試験の道具（K-960 が持ち込む・K-962 も使う）：
//   利用者の請求とプランの口を網の手前で差し替える。答えの形は 11_tickets/K-1005.md の「画面が使う答えの形」（違えばこの 1 枚だけを合わせる）。
//   PlanChoice の summary・recommended・upgrade・upcoming は K-962 がまとめ役に足すよう頼んだ欄（K-962.md の申し送り）。
//   名前・字・数は下絵（app/(dev)/dev/mock/f12-user/render.tsx の見本）と同じにする（モックとの突き合わせのため）。
//   本人確認の取り直し（getMySecurity・stepUp）も受ける（K-363 の試験と同じ形）。本人の Bridge（127.0.0.1:38617）は届かせない。
//   固定の待ちは使わない（答えは hold() で止め、返した関数を呼ぶと答える）。テストはチケットを作る人が書き、実装する人は変えない
import type { Page, Request, Route } from "@playwright/test";

export const uid = (n: number): string => `0193c5a0-0000-7000-8000-${String(n).padStart(12, "0")}`;
export const INV_OCT = uid(0x9001);
export const INV_SEP = uid(0x9002);
export const INV_AUG = uid(0x9003);
/** PDF の短い期限の署名 URL（偽の置き場） */
export const PDF_URL = "https://files.k960.test/invoices/2025-10.pdf";

// ---------------------------------------------------------------- 口の答えの形（K-1005）
export interface InvoiceA {
  id: string;
  month: string;
  amount_total: number;
  issued_on: string;
  due_on: string;
  state: "unpaid" | "paid" | "overdue";
  paid_on?: string;
}
export interface BillingA {
  terms: string;
  payee: { lines: string[] };
  contact: { company: string; attn: string; email: string };
  invoices: InvoiceA[];
  overdue: { count: number; amount_total: number } | null;
  free: boolean;
  can_edit_contact: boolean;
}
export interface PlanA {
  plan_key: "free" | "team" | "business";
  name: string;
  price_monthly: number;
  member_limit: number;
  current: boolean;
  can_choose: boolean;
  reason?: string;
  effective_from: string;
  /** プランの 1 行の説明（K-962 が足すよう頼んだ欄） */
  summary: string;
  /** おすすめの印（同） */
  recommended: boolean;
  /** 上げるときの今月の残り日数分（同・上げられる行だけ） */
  upgrade: { days: number; amount: number; invoice_on: string } | null;
  /** 値段・人数が変わる予定（同・いまのプランの行だけ） */
  upcoming: { price_monthly: number; member_limit: number; from_month: string; noticed_on: string } | null;
}

export const billingTaka = (): BillingA => ({
  terms: "請求書払い ・ 月末締め 翌月 1 日に出す ・ 月末払い",
  payee: { lines: ["〇〇銀行 本店 普通 1234567", "カ）エンジンベース", "振込手数料はご負担ください（仮）"] },
  contact: { company: "株式会社ENGINE BASE", attn: "経理 ご担当", email: "keiri@engine-base.example" },
  invoices: [
    {
      id: INV_OCT,
      month: "2025-10",
      amount_total: 16500,
      issued_on: "2025-11-01",
      due_on: "2025-11-30",
      state: "unpaid",
    },
    {
      id: INV_SEP,
      month: "2025-09",
      amount_total: 16500,
      issued_on: "2025-10-01",
      due_on: "2025-10-31",
      state: "paid",
      paid_on: "2025-10-28",
    },
    {
      id: INV_AUG,
      month: "2025-08",
      amount_total: 16500,
      issued_on: "2025-09-01",
      due_on: "2025-09-30",
      state: "paid",
      paid_on: "2025-09-29",
    },
  ],
  overdue: null,
  free: false,
  can_edit_contact: true,
});
export const billingOverdue = (): BillingA => {
  const b = billingTaka();
  return {
    ...b,
    invoices: [{ ...b.invoices[0]!, state: "overdue", due_on: "2025-10-31" }, ...b.invoices.slice(1)],
    overdue: { count: 1, amount_total: 16500 },
  };
};
export const billingFree = (): BillingA => ({ ...billingTaka(), invoices: [], free: true });

export const plansTaka = (): PlanA[] => [
  {
    plan_key: "free",
    name: "無料",
    price_monthly: 0,
    member_limit: 3,
    current: false,
    can_choose: false,
    reason: "members_over_limit",
    effective_from: "2025-12-01",
    summary: "チケット・承認・ナレッジ",
    recommended: false,
    upgrade: null,
    upcoming: null,
  },
  {
    plan_key: "team",
    name: "チーム",
    price_monthly: 15000,
    member_limit: 10,
    current: true,
    can_choose: false,
    effective_from: "2025-11-01",
    summary: "＋ ゲストを招く",
    recommended: false,
    upgrade: null,
    upcoming: null,
  },
  {
    plan_key: "business",
    name: "ビジネス",
    price_monthly: 40000,
    member_limit: 30,
    current: false,
    can_choose: true,
    effective_from: "2025-11-22",
    summary: "＋ ゲストのグループ",
    recommended: true,
    upgrade: { days: 9, amount: 7200, invoice_on: "2025-12-01" },
    upcoming: null,
  },
];
/** 値段が変わる予定がある（ub-price-change の見本） */
export const plansPriceChange = (): PlanA[] =>
  plansTaka().map((p) =>
    p.current
      ? { ...p, upcoming: { price_monthly: 18000, member_limit: 12, from_month: "2027-02", noticed_on: "2025-11-05" } }
      : p,
  );

// ---------------------------------------------------------------- 差し替え
export type BOp = "billing" | "pdf" | "contact" | "plans" | "plan" | "security" | "stepUp";
export interface Reply {
  status: number;
  body: unknown;
}
export interface Call {
  op: BOp;
  id: string | undefined;
  body: Record<string, unknown>;
}
export interface BMock {
  billing: BillingA;
  plans: PlanA[];
  members: number;
  calls: Call[];
  count: (op: BOp) => number;
  last: (op: BOp) => Call | undefined;
  /** 次の回だけ、この答え（"network" は網が切れる）で答える */
  script: (op: BOp, ...replies: (Reply | "network")[]) => void;
  /** この口の答えを止める（返した関数を呼ぶと答える） */
  hold: (op: BOp) => () => void;
}
/** 口が断る答え。404・409 は欄・details を付けない（控え帳） */
export const err = (status: number, code: string): Reply => ({ status, body: { error: code.toLowerCase(), code } });
/** 422 の欄ごとの理由（K-144 の形） */
export const invalid = (field: string, message: string): Reply => ({
  status: 422,
  body: { error: "validation_error", code: "VALIDATION_ERROR", details: [{ field, message }] },
});

const API =
  /\/api\/v1\/(workspace\/(billing|billing-contact|plans|plan)|invoices\/[^/]+\/pdf|me\/security|auth\/step-up)(\?|$)/;

export async function mockBilling(
  page: Page,
  init: { billing?: BillingA; plans?: PlanA[]; members?: number; password?: boolean } = {},
): Promise<BMock> {
  const scripted = new Map<BOp, (Reply | "network")[]>();
  const gates = new Map<BOp, Promise<void>>();
  const mk: BMock = {
    billing: init.billing ?? billingTaka(),
    plans: init.plans ?? plansTaka(),
    members: init.members ?? 5,
    calls: [],
    count: (op) => mk.calls.filter((c) => c.op === op).length,
    last: (op) => [...mk.calls].reverse().find((c) => c.op === op),
    script: (op, ...r) => scripted.set(op, [...(scripted.get(op) ?? []), ...r]),
    hold: (op) => {
      let open = (): void => undefined;
      gates.set(op, new Promise<void>((r) => (open = r)));
      return () => {
        open();
        gates.delete(op);
      };
    },
  };
  const ok = (data: unknown, meta?: unknown, status = 200): Reply => ({
    status,
    body: meta === undefined ? { data } : { data, meta },
  });
  const answer = async (op: BOp, route: Route, req: Request, id: string | undefined, def: () => Reply) => {
    const buf = req.postDataBuffer();
    const body = buf?.length ? (JSON.parse(buf.toString("utf8")) as Record<string, unknown>) : {};
    mk.calls.push({ op, id, body });
    const gate = gates.get(op);
    if (gate) await gate;
    const next = scripted.get(op)?.shift();
    if (next === "network") return route.abort("failed");
    const r = next ?? def();
    return route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
  };
  await page.route(/127\.0\.0\.1:38617/, (r) => r.fulfill({ status: 404, body: "" }));
  await page.route(/files\.k960\.test/, (r) =>
    r.fulfill({ status: 200, contentType: "application/pdf", body: "%PDF-1.4" }),
  );
  await page.route(API, async (route: Route, req: Request) => {
    const p = new URL(req.url()).pathname.replace("/api/v1", "");
    const m = req.method();
    if (p === "/workspace/billing" && m === "GET")
      return answer("billing", route, req, undefined, () => ok(mk.billing));
    if (p.startsWith("/invoices/") && m === "GET") {
      const id = p.split("/")[2];
      return answer("pdf", route, req, id, () =>
        mk.billing.invoices.some((i) => i.id === id)
          ? ok({ url: PDF_URL, expires_at: "2025-11-12T00:05:00Z" })
          : err(404, "NOT_FOUND"),
      );
    }
    if (p === "/workspace/billing-contact" && m === "PATCH")
      return answer("contact", route, req, undefined, () => {
        const b = mk.calls.at(-1)!.body as BillingA["contact"];
        mk.billing = { ...mk.billing, contact: { company: b.company, attn: b.attn, email: b.email } };
        return ok(mk.billing.contact);
      });
    if (p === "/workspace/plans" && m === "GET")
      return answer("plans", route, req, undefined, () =>
        ok(mk.plans, { members: mk.members, member_limit: mk.plans.find((x) => x.current)?.member_limit ?? 0 }),
      );
    if (p === "/workspace/plan" && m === "POST")
      return answer("plan", route, req, undefined, () => {
        const key = String(mk.calls.at(-1)!.body["plan_key"]);
        const to = mk.plans.find((x) => x.plan_key === key);
        if (!to) return err(404, "NOT_FOUND");
        mk.plans = mk.plans.map((x) => ({ ...x, current: x.plan_key === key, upgrade: null }));
        return ok({
          plan_key: key,
          effective_from: to.effective_from,
          prorated_amount: to.upgrade?.amount ?? 0,
          next_invoice_on: "2025-12-01",
        });
      });
    if (p === "/me/security" && m === "GET")
      return answer("security", route, req, undefined, () =>
        ok({ has_password: init.password ?? true, two_factor: false, two_factor_required: false, mfa_pending: false }),
      );
    if (p === "/auth/step-up" && m === "POST")
      return answer("stepUp", route, req, undefined, () =>
        ok({ step_up_at: new Date().toISOString() }, undefined, 201),
      );
    return route.fallback();
  });
  return mk;
}
