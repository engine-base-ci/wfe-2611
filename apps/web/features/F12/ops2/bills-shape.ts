// 運営の請求の画面（/ops/billing・K-984）の答え → 部品の値。純粋な関数だけ（@/ を読まない・日本時間で数える）。
//   答えの形は 11_tickets/K-1005.md（listOpsInvoices の 1 行・issueOpsInvoices の下書き）。字は下絵（views-bills.tsx・ops2-sample.ts）が正。
//   月と状態は URL に持つ（month・state）。既定の月は日本の先月・状態は すべて。既定の値は URL に書かない

/** 請求の状態（D-156.29 の 3 つ） */
export type BillState = "unpaid" | "paid" | "overdue";
/** 札で選ぶ状態（all はすべて） */
export type BillFilter = BillState | "all";
export type BillTone = "success" | "warning" | "danger" | "neutral";

/** 1 枚の請求書への入金（打ち消しの行は並べない・取り消した入金は reversed） */
export interface BillPayment {
  id: string;
  paid_on: string;
  amount: number;
  payer_name?: string | null;
  reversed: boolean;
}
/** 一覧の口の 1 行（使う欄だけ） */
export interface BillAnswer {
  id: string;
  workspace: { id: string; name: string };
  plan_name: string | null;
  month: string;
  amount_total: number;
  state: BillState;
  paid_total: number;
  difference: number;
  due_on: string;
  can_record_payment: boolean;
  payments?: readonly BillPayment[];
}
/** まとめて出す口の下書き（dry_run）の答え（使う欄だけ） */
export interface BillDraft {
  month: string;
  count: number;
  total: number;
}

export interface BillRowView {
  id: string;
  ws: string;
  plan: string;
  amount: string;
  state: string;
  tone: BillTone;
  paid: string;
  canPay: boolean;
  /** 期限から 7 日以上の行だけ（1 社の画面へ・止めるのは人） */
  stopHref: string | null;
}
export interface BillChipView {
  key: BillFilter;
  label: string;
  count: number;
}
export interface BillStatView {
  label: string;
  value: string;
  sub: string;
  tone?: "danger";
}
export interface BillsQuery {
  month: string;
  state: BillFilter;
}
export interface MonthOption {
  value: string;
  label: string;
}
export interface IssueView {
  title: string;
  count: string;
  total: string;
  due: string;
}
export interface PaymentView {
  id: string;
  paidOn: string;
  amount: string;
  payer: string;
  reversed: boolean;
}
export interface PayView {
  target: string;
  payments: PaymentView[];
  diff: string;
  alert: boolean;
}
export interface PayForm {
  amount: string;
  paidOn: string;
  payer: string;
}
export interface PayBody {
  amount: number;
  paid_on: string;
  payer_name?: string;
}
export interface ReverseBody {
  amount: number;
  paid_on: string;
  reverses_payment_id: string;
}

/** 止める案を出す日数（期限の翌日を 1 日目に数える・D-156.65） */
export const STOP_AFTER_DAYS = 7;
/** 月の選び肢の数 */
export const MONTH_COUNT = 12;
const JST_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const STATES: readonly BillState[] = ["unpaid", "paid", "overdue"];
const MONTH_RX = /^(\d{4})-(\d{2})$/;
const DATE_RX = /^(\d{4})-(\d{2})-(\d{2})$/;

const comma = (n: number): string => String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
/** 「¥16,500」 */
export const yen = (n: number): string => `${n < 0 ? "-" : ""}¥${comma(Math.abs(n))}`;
/** 「¥ 104,500」（上の数・確かめの合計） */
const yenWide = (n: number): string => `¥ ${comma(n)}`;
const pad = (n: number): string => String(n).padStart(2, "0");

/** 日本の今日（年・月・日） */
function jstToday(now: Date): { y: number; m: number; d: number } {
  const t = new Date(now.getTime() + JST_MS);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}
/** 「YYYY-MM」→ 年と月（読めなければ null） */
function monthParts(month: string): { y: number; m: number } | null {
  const g = MONTH_RX.exec(month);
  if (!g) return null;
  const m = Number(g[2]);
  return m >= 1 && m <= 12 ? { y: Number(g[1]), m } : null;
}
const monthKey = (y: number, m: number): string => `${y}-${pad(m)}`;
/** 月を n か月ずらす */
function shift(y: number, m: number, n: number): { y: number; m: number } {
  const i = y * 12 + (m - 1) + n;
  return { y: Math.floor(i / 12), m: (i % 12) + 1 };
}
/** 「9 月分」（読めなければ月の字のまま） */
const monthLabel = (month: string): string => {
  const p = monthParts(month);
  return p ? `${p.m} 月分` : month;
};
/** 「YYYY-MM-DD」→「MM/DD」 */
const mmdd = (date: string): string => {
  const g = DATE_RX.exec(date);
  return g ? `${g[2]}/${g[3]}` : date;
};
/** その月の翌月の末日（「MM/DD」） */
function nextMonthEnd(month: string): string {
  const p = monthParts(month);
  if (!p) return "";
  const n = shift(p.y, p.m, 1);
  const last = new Date(Date.UTC(n.y, n.m, 0)).getUTCDate();
  return `${pad(n.m)}/${pad(last)}`;
}
/** 期限の日から日本の今日までの日数（期限の翌日が 1） */
function daysPast(due: string, now: Date): number {
  const g = DATE_RX.exec(due);
  if (!g) return 0;
  const t = jstToday(now);
  const dueMs = Date.UTC(Number(g[1]), Number(g[2]) - 1, Number(g[3]));
  return Math.round((Date.UTC(t.y, t.m - 1, t.d) - dueMs) / DAY_MS);
}
/** 日本の今日（「YYYY-MM-DD」） */
export function todayJst(now: Date): string {
  const t = jstToday(now);
  return `${t.y}-${pad(t.m)}-${pad(t.d)}`;
}
/** 日本の先月（「YYYY-MM」） */
export function lastMonth(now: Date): string {
  const t = jstToday(now);
  const p = shift(t.y, t.m, -1);
  return monthKey(p.y, p.m);
}

/** 一覧の 1 行 → 部品の 1 行 */
export function billRowView(row: BillAnswer, now: Date): BillRowView {
  const m = monthLabel(row.month);
  const past = daysPast(row.due_on, now);
  const state =
    row.state === "overdue"
      ? `${m} 期限を過ぎた ${past} 日`
      : row.state === "unpaid"
        ? `${m} お支払い待ち ・ 期限 ${mmdd(row.due_on)}`
        : `${m} 払われた`;
  const tone: BillTone = row.state === "overdue" ? "danger" : row.state === "unpaid" ? "warning" : "success";
  const paid =
    row.paid_total === 0
      ? "—"
      : row.difference === 0 || row.state === "paid"
        ? yen(row.paid_total)
        : `${yen(row.paid_total)}（差 ${yen(Math.abs(row.difference))}）`;
  return {
    id: row.id,
    ws: row.workspace.name,
    plan: row.plan_name ?? "—",
    amount: yen(row.amount_total),
    state,
    tone,
    paid,
    canPay: row.can_record_payment,
    stopHref:
      row.state === "overdue" && past >= STOP_AFTER_DAYS
        ? `/ops/tenants/${encodeURIComponent(row.workspace.id)}`
        : null,
  };
}

const CHIP_LABELS: Record<BillFilter, string> = {
  all: "すべて",
  unpaid: "お支払い待ち",
  paid: "払われた",
  overdue: "期限を過ぎた（前の月の分）",
};

/** 札 4 つと上の数 3 つ（month は選んだ月） */
export function statsView(
  rows: readonly BillAnswer[],
  month: string,
): { chips: BillChipView[]; stats: BillStatView[] } {
  const of = (s: BillState) => rows.filter((r) => r.state === s);
  const chips: BillChipView[] = (["all", ...STATES] as const).map((key) => ({
    key,
    label: CHIP_LABELS[key],
    count: key === "all" ? rows.length : of(key).length,
  }));
  const inMonth = rows.filter((r) => r.month === month);
  const overdue = of("overdue");
  const overdueSum = overdue.reduce((s, r) => s + r.amount_total, 0);
  return {
    chips,
    stats: [
      {
        label: monthLabel(month),
        value: yenWide(inMonth.reduce((s, r) => s + r.amount_total, 0)),
        sub: `税込 ・ ${inMonth.length} 件 ・ 無料は請求なし`,
      },
      {
        label: "お支払い待ち",
        value: `${of("unpaid").length} 件`,
        sub: `期限 ${nextMonthEnd(month)} ・ 払われた ${of("paid").length} 件`,
      },
      {
        label: "期限を過ぎた",
        value: yenWide(overdueSum),
        sub: overdue.length > 0 ? `${overdue.length} 件 ・ 前の月の分` : "0 件",
        tone: "danger",
      },
    ],
  };
}

/** 先月から 12 か月（新しい順）。去年の月は年つき */
export function monthOptions(now: Date): MonthOption[] {
  const t = jstToday(now);
  return Array.from({ length: MONTH_COUNT }, (_, i) => {
    const p = shift(t.y, t.m, -1 - i);
    return { value: monthKey(p.y, p.m), label: p.y === t.y ? `${p.m} 月分` : `${p.m} 月分（${p.y} 年）` };
  });
}

/** URL の値 → 月と状態（知らない値は既定） */
export function billsQuery(params: URLSearchParams, now: Date): BillsQuery {
  const month = params.get("month") ?? "";
  const state = params.get("state") ?? "";
  const ok = monthOptions(now).some((o) => o.value === month);
  return {
    month: ok ? month : lastMonth(now),
    state: (STATES as readonly string[]).includes(state) ? (state as BillState) : "all",
  };
}

/** 月と状態 → URL の問い合わせ（既定は書かない・順は month・state） */
export function billsSearch(q: BillsQuery, now: Date): string {
  const parts = [
    ...(q.month !== lastMonth(now) ? [`month=${encodeURIComponent(q.month)}`] : []),
    ...(q.state !== "all" ? [`state=${encodeURIComponent(q.state)}`] : []),
  ];
  return parts.length > 0 ? `?${parts.join("&")}` : "";
}

/** 一覧の口に付ける問い合わせ（既定でない値だけ） */
export function listQueryOf(q: BillsQuery, now: Date): { month?: string; state?: BillState } {
  return {
    ...(q.month !== lastMonth(now) ? { month: q.month } : {}),
    ...(q.state !== "all" ? { state: q.state } : {}),
  };
}

/** ［<先月> 月分をまとめて出す］のボタンの字 */
export const issueLabelOf = (now: Date): string => `${monthLabel(lastMonth(now))}をまとめて出す`;

/** 確かめの小窓の字 */
export function issueView(draft: BillDraft): IssueView {
  return {
    title: `${monthLabel(draft.month)}の請求書をまとめて出す`,
    count: `${draft.count} 件`,
    total: yenWide(draft.total),
    due: `期限 ${nextMonthEnd(draft.month)}`,
  };
}

/** 額の字 → 整数の円（「¥」「,」と空白を外す。読めなければ null） */
function amountOf(text: string): number | null {
  const s = text.replace(/[¥,\s]/g, "");
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : null;
}

/** 入金の小窓の字（amountText は書いている額） */
export function payView(row: BillAnswer, amountText: string): PayView {
  const rest = row.amount_total - row.paid_total;
  const d = rest - (amountOf(amountText) ?? 0);
  const keep = "差を残して「お支払い待ち」のままにします";
  return {
    target: `${row.workspace.name} ・ ${monthLabel(row.month)} ${yen(row.amount_total)}（期限 ${mmdd(row.due_on)}）`,
    payments: (row.payments ?? []).map((p) => ({
      id: p.id,
      paidOn: mmdd(p.paid_on),
      amount: yen(p.amount),
      payer: p.payer_name ? p.payer_name : "—",
      reversed: p.reversed,
    })),
    diff:
      d === 0
        ? "差 ¥0 ・ 請求額と同じ → 払われた にする"
        : d > 0
          ? `差 ${yen(d)} ・ 請求額より足りません。${keep}`
          : `差 ${yen(-d)} ・ 請求額より多いです。${keep}`,
    alert: d !== 0,
  };
}

/** 記録する体（額は 1 以上の整数・入金日は YYYY-MM-DD・名義は空なら入れない。読めなければ null） */
export function payBody(form: PayForm): PayBody | null {
  const amount = amountOf(form.amount);
  if (amount === null || amount < 1) return null;
  if (!DATE_RX.test(form.paidOn)) return null;
  const payer = form.payer.trim();
  return { amount, paid_on: form.paidOn, ...(payer ? { payer_name: payer } : {}) };
}

/** 取り消しの体（元の額・今日（日本）・取り消す入金） */
export function reverseBody(payment: BillPayment, now: Date): ReverseBody {
  return { amount: payment.amount, paid_on: todayJst(now), reverses_payment_id: payment.id };
}

/** 入金の小窓を開いたときの欄（額は残り・入金日は今日） */
export function payFormOf(row: BillAnswer, now: Date): PayForm {
  const rest = Math.max(row.amount_total - row.paid_total, 0);
  return { amount: String(rest), paidOn: todayJst(now), payer: "" };
}

const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
/** 一覧の 1 行の形か（形が違えば読めない扱い） */
export function isBillAnswer(v: unknown): v is BillAnswer {
  if (!isObj(v) || !isObj(v["workspace"])) return false;
  return (
    typeof v["id"] === "string" &&
    typeof v["workspace"]["id"] === "string" &&
    typeof v["workspace"]["name"] === "string" &&
    typeof v["month"] === "string" &&
    typeof v["amount_total"] === "number" &&
    typeof v["paid_total"] === "number" &&
    typeof v["difference"] === "number" &&
    typeof v["due_on"] === "string" &&
    (STATES as readonly unknown[]).includes(v["state"])
  );
}
/** 下書きの形か */
export function isBillDraft(v: unknown): v is BillDraft {
  return isObj(v) && typeof v["month"] === "string" && typeof v["count"] === "number" && typeof v["total"] === "number";
}
