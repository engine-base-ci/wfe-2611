// 運営の 1 社の画面（K-971・K-972）の試験が使う口の答えの見本（K-971 が持ち込む・ブラウザの試験と画面の外の試験の両方が読む）。
//   形は 11_tickets/K-1006.md（getOpsWorkspace・listOpsWorkspaceMembers・listOpsWorkspaceInquiries・listOpsWorkspaceAudit）と
//   K-1005.md（getOpsWorkspaceBilling）の「画面が使う答えの形」。字・数は下絵（features/F12/ops/ops-sample.ts・tenant-tabs.tsx）と同じになる値。
//   Playwright を読まない（vitest の画面の外の試験からも読むため）。テストはチケットを作る人が書き、実装する人は変えない
import { uid } from "./ops-answers";

export const WS_ID = uid(0x971);

export interface WsDetailA {
  id: string;
  name: string;
  plan_name: string | null;
  state: "active" | "stopped" | "closing";
  stop: { reason_key: string; stop_on: string | null; stopped_at: string | null; noticed_at: string | null } | null;
  admin: { name: string };
  /** 会社の生きているメンバーの数（一覧の members.count と同じ・2026-11-25 に K-1006 に足した） */
  members: { count: number };
  /** 済んでいない問い合わせの数（タブ「問い合わせ N」・2026-11-25 に K-1006 に足した） */
  inquiries: { open: number };
  pc: { connected: number; total: number } | null;
  runs_month: { count: number };
  stuck_runs: { count_7d: number; prev_week: number };
  files: { bytes: number };
  recent: { at: string; label: string; detail: string | null }[];
  /** reason＝開いたときの理由の字（帯「理由：…」・2026-11-25 に K-1006 に足した） */
  peek: { id: string; expires_at: string; reason: string | null } | null;
}
/** 下絵 op-ws の頭と「いまの状態」のタブと同じ値 */
export const wsOf = (o: Partial<WsDetailA> = {}): WsDetailA => ({
  id: WS_ID,
  name: "合同会社ミナト企画",
  plan_name: "チーム",
  state: "active",
  stop: null,
  admin: { name: "湊 さくら" },
  members: { count: 8 },
  inquiries: { open: 1 },
  pc: { connected: 6, total: 8 },
  runs_month: { count: 1284 },
  stuck_runs: { count_7d: 3, prev_week: 0 },
  files: { bytes: 2_254_857_830 },
  recent: [
    {
      at: "2026-11-02T00:40:00Z",
      label: "問い合わせ「承認したのに動かない」が届いた",
      detail: "湊 さくら ・ 担当 高本",
    },
    { at: "2026-11-01T00:00:00Z", label: "10 月分の請求書を出した ¥16,500", detail: "期限 11/30" },
    { at: "2026-10-28T06:20:00Z", label: "9 月分の入金を記録した", detail: "佐野" },
    { at: "2026-10-15T01:00:00Z", label: "メンバーが 1 人増えた（8 人）", detail: null },
  ],
  peek: null,
  ...o,
});

export interface WsMemberA {
  member_id: string;
  name: string;
  email: string | null;
  role_label: string;
  last_seen_at: string | null;
  pc: "connected" | "paired" | "never" | "none";
  login_methods: string[];
  verified: boolean;
}
/** 下絵 op-ws-members の 5 行（メールは下絵の字のまま） */
export const WS_MEMBERS: WsMemberA[] = [
  m(1, "湊 さくら", "minato@minato-kikaku.example", "管理者", "2026-11-02T00:31:00Z", "connected", ["passkey"], true),
  m(2, "吉田 健", "yoshida@…", "マネージャー", "2026-11-01T23:50:00Z", "connected", ["passkey"], true),
  m(3, "山本 由美", "yamamoto@…", "メンバー", "2026-10-30T09:02:00Z", "never", ["password", "two_factor"], false),
  m(4, "木下 翔", "kinoshita@…", "メンバー", "2026-10-12T01:15:00Z", "never", ["password", "two_factor"], false),
  m(5, "小池 真理", "koike@…", "閲覧のみ", "2026-11-01T04:40:00Z", "none", ["passkey"], true),
];
function m(
  n: number,
  name: string,
  email: string,
  role_label: string,
  last_seen_at: string,
  pc: WsMemberA["pc"],
  login_methods: string[],
  verified: boolean,
): WsMemberA {
  return { member_id: uid(0x9710 + n), name, email, role_label, last_seen_at, pc, login_methods, verified };
}

export interface WsInvoiceA {
  id: string;
  month: string;
  amount_total: number;
  issued_on: string;
  due_on: string;
  state: "unpaid" | "paid" | "overdue";
  paid_on?: string;
}
export interface WsBillingA {
  plan: { plan_key: string; name: string; price_monthly: number; since: string };
  members: { count: number; limit: number | null };
  payment_terms: string;
  invoices: WsInvoiceA[];
}
/** 下絵 op-ws-billing のプランと請求書 4 行 */
export const wsBillingOf = (): WsBillingA => ({
  plan: { plan_key: "team", name: "チーム", price_monthly: 15000, since: "2026-04-03" },
  members: { count: 8, limit: 10 },
  payment_terms: "請求書払い ・ 月末締め 翌月 1 日に出す ・ 月末払い",
  invoices: [
    {
      id: uid(0x9721),
      month: "2026-10",
      amount_total: 16500,
      issued_on: "2026-11-01",
      due_on: "2026-11-30",
      state: "unpaid",
    },
    inv(0x9722, "2026-09", "2026-10-01", "2026-10-31", "2026-10-28"),
    inv(0x9723, "2026-08", "2026-09-01", "2026-09-30", "2026-09-29"),
    inv(0x9724, "2026-07", "2026-08-01", "2026-08-31", "2026-08-27"),
  ],
});
function inv(n: number, month: string, issued: string, due: string, paid: string): WsInvoiceA {
  return { id: uid(n), month, amount_total: 16500, issued_on: issued, due_on: due, state: "paid", paid_on: paid };
}

export interface WsInquiryA {
  id: string;
  title: string;
  topic: "usage" | "trouble" | "billing" | "other";
  asker_name: string;
  owner_name: string | null;
  state: "open" | "waiting" | "later" | "done";
  created_at: string;
}
/** 下絵 op-ws-inquiries の 3 行 */
export const WS_INQUIRIES: WsInquiryA[] = [
  {
    id: uid(0x9731),
    title: "承認したのに動かない",
    topic: "trouble",
    asker_name: "湊 さくら",
    owner_name: "高本",
    state: "open",
    created_at: "2026-11-02T00:40:00Z",
  },
  {
    id: uid(0x9732),
    title: "請求書の宛名を経理に変えたい",
    topic: "billing",
    asker_name: "湊 さくら",
    owner_name: "佐野",
    state: "done",
    created_at: "2026-10-20T01:00:00Z",
  },
  {
    id: uid(0x9733),
    title: "メンバーを 2 人増やしたい",
    topic: "billing",
    asker_name: "吉田 健",
    owner_name: "佐野",
    state: "done",
    created_at: "2026-10-14T01:00:00Z",
  },
];

export interface WsAuditA {
  id: string;
  at: string;
  actor_name: string;
  action: string;
  action_label: string;
  target_label: string | null;
  reason: string | null;
}
/** 下絵 op-ws-log の 4 行（運営の人の操作だけ） */
export const WS_AUDIT: WsAuditA[] = [
  {
    id: uid(0x9741),
    at: "2026-11-02T01:12:00Z",
    actor_name: "高本",
    action: "peek.open",
    action_label: "中を見た",
    target_label: null,
    reason: "問い合わせ「承認したのに動かない」",
  },
  {
    id: uid(0x9742),
    at: "2026-11-02T00:58:00Z",
    actor_name: "高本",
    action: "inquiry.take",
    action_label: "問い合わせを持った",
    target_label: "承認したのに動かない",
    reason: null,
  },
  {
    id: uid(0x9743),
    at: "2026-10-28T06:20:00Z",
    actor_name: "佐野",
    action: "payment.record",
    action_label: "入金を記録した",
    target_label: "9 月分 ¥16,500",
    reason: null,
  },
  {
    id: uid(0x9744),
    at: "2026-04-03T02:05:00Z",
    actor_name: "高本",
    action: "plan.change",
    action_label: "代わりにプランを変えた",
    target_label: "無料 → チーム",
    reason: "問い合わせ「プランを上げたい」",
  },
];
