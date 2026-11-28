// 運営の 1 社の画面（/ops/tenants/<id>・K-971）の、口の答え → 部品の値と、URL の tab の読み書き。
//   画面の外の純粋な関数（@/ を読まない）。答えの形は 11_tickets/K-1006.md・K-1005.md の「画面が使う答えの形」。
//   字は下絵（ops-sample.ts・tenant-tabs.tsx）が正。時刻の字は日本時間（Asia/Tokyo）

// ---------------------------------------------------------------- 口の答えの形（使う欄だけ）
export interface WsDetail {
  id: string;
  name: string;
  plan_name: string | null;
  state: string;
  stop: { reason_key?: string; stop_on: string | null; stopped_at: string | null } | null;
  admin: { name: string } | null;
  /** 会社の生きているメンバーの数（K-1006・K-966）。頭の人数とメンバーのタブの数 */
  members?: { count: number } | null;
  /** 済んでいない問い合わせの数（K-1006・K-966）。タブ「問い合わせ N」 */
  inquiries?: { open: number } | null;
  pc: { connected: number; total: number } | null;
  runs_month: { count: number } | null;
  stuck_runs: { count_7d: number; prev_week: number } | null;
  files: { bytes: number } | null;
  recent: readonly { at: string; label: string; detail: string | null }[];
}
export interface WsMember {
  member_id: string;
  name: string;
  email: string | null;
  role_label: string;
  last_seen_at: string | null;
  pc: string;
  login_methods: readonly string[];
  verified: boolean;
}
export interface WsInvoice {
  id: string;
  month: string;
  amount_total: number;
  issued_on: string;
  due_on: string;
  state: string;
  paid_on?: string | null;
}
export interface WsBilling {
  plan: { name: string; price_monthly: number; since: string | null } | null;
  members: { count: number; limit: number | null };
  invoices: readonly WsInvoice[];
}
export interface WsInquiry {
  id: string;
  title: string;
  topic: string;
  asker_name: string;
  owner_name: string | null;
  state: string;
  created_at: string;
}
export interface WsAudit {
  at: string;
  actor_name: string;
  action: string;
  action_label: string;
  target_label: string | null;
  reason: string | null;
}

// ---------------------------------------------------------------- 字の道具
const NONE = "—";
const JST_MS = 9 * 60 * 60 * 1000;
const GB = 1024 ** 3;
const pad2 = (n: number) => String(n).padStart(2, "0");
/** 3 桁ごとのコンマ（地域の設定に依らない） */
const comma = (n: number) => String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const yen = (n: number) => `¥${comma(n)}`;
const jst = (iso: string): Date | null => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t + JST_MS) : null;
};
/** 日本時間の MM/DD HH:mm（読めなければ —） */
export function mdHm(iso: string | null | undefined): string {
  const d = iso ? jst(iso) : null;
  if (!d) return NONE;
  return `${pad2(d.getUTCMonth() + 1)}/${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}
/** 日付（YYYY-MM-DD）か日時の MM/DD（日時は日本時間） */
function md(v: string | null | undefined): string | null {
  if (!v) return null;
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (day) return `${day[2]}/${day[3]}`;
  const d = jst(v);
  return d ? `${pad2(d.getUTCMonth() + 1)}/${pad2(d.getUTCDate())}` : null;
}
const head = (s: string) => Array.from(s)[0] ?? "";
/** 会社の印の字：頭の会社の種類（合同会社・株式会社 など）を除いた最初の 1 字（下絵「合同会社ミナト企画」→「ミ」） */
const CORP_FORM =
  /^(?:株式会社|合同会社|有限会社|合資会社|合名会社|一般社団法人|一般財団法人|[(（]株[)）]|[(（]同[)）]|[(（]有[)）])\s*/;
const markOf = (name: string) => head(name.replace(CORP_FORM, "")) || head(name);

// ---------------------------------------------------------------- 頭・いまの状態・右の情報
export type FrameTone = "success" | "warning" | "danger";
export interface FrameView {
  name: string;
  mark: string;
  status: string;
  tone: FrameTone;
  sub: string;
  stopped: boolean;
}
export function frameView(ws: WsDetail): FrameView {
  const base = { name: ws.name, mark: markOf(ws.name), sub: subOf(ws) };
  if (ws.state === "stopped") {
    const since = md(ws.stop?.stop_on) ?? md(ws.stop?.stopped_at);
    return { ...base, status: since ? `止めている（${since}〜）` : "止めている", tone: "danger", stopped: true };
  }
  if (ws.state === "closing") return { ...base, status: "やめる手続き中", tone: "warning", stopped: false };
  return { ...base, status: "使っている", tone: "success", stopped: false };
}
function subOf(ws: WsDetail): string {
  const parts = [ws.plan_name ?? NONE];
  // 人数は members.count（PC の数ではない・PM の決め 2026-11-25）
  if (ws.members) parts.push(`${ws.members.count} 人`);
  return parts.join(" ・ ");
}

export interface StatView {
  label: string;
  value: string;
  sub?: string;
  tone?: "warn";
}
export interface RecentView {
  at: string;
  text: string;
  detail?: string;
}
export function statusView(ws: WsDetail): { stats: StatView[]; recent: RecentView[] } {
  const stuck = ws.stuck_runs;
  const stats: StatView[] = [
    { label: "PC がつながる人", value: ws.pc ? `${ws.pc.connected} / ${ws.pc.total}` : NONE },
    { label: "今月の実行", value: ws.runs_month ? comma(ws.runs_month.count) : NONE },
    stuck
      ? {
          label: "止まった実行",
          value: String(stuck.count_7d),
          sub: `この 7 日 ・ 先週は ${stuck.prev_week}`,
          ...(stuck.count_7d >= 1 ? { tone: "warn" as const } : {}),
        }
      : { label: "止まった実行", value: NONE },
    { label: "ファイル", value: ws.files ? `${(ws.files.bytes / GB).toFixed(1)} GB` : NONE },
  ];
  const recent = ws.recent.map((r) => ({
    at: mdHm(r.at),
    text: r.label,
    ...(r.detail ? { detail: r.detail } : {}),
  }));
  return { stats, recent };
}

/** 右の「ワークスペースの情報」の 4 行（下絵の WS_INFO と同じ並び） */
export function infoView(ws: WsDetail): [string, string][] {
  return [
    ["名前", ws.name],
    ["管理者", ws.admin?.name ?? NONE],
    ["プラン", ws.plan_name ?? NONE],
    ["状態", frameView(ws).status],
  ];
}

// ---------------------------------------------------------------- タブ
export const TENANT_TABS = ["status", "members", "billing", "inquiries", "log"] as const;
export type WsTab = (typeof TENANT_TABS)[number];
export function tabOf(v: string | null | undefined): WsTab {
  return (TENANT_TABS as readonly string[]).includes(v ?? "") ? (v as WsTab) : "status";
}
export function tabSearch(tab: WsTab): string {
  return tab === "status" ? "" : `?tab=${tab}`;
}
/** タブの字（数つき）。数は 1 社の答えの members.count と inquiries.open（タブを開く前から出す）。0 なら数を付けない */
export function tabLabels(ws: WsDetail): Record<WsTab, string> {
  const counted = (label: string, n: number | null | undefined) => (n ? `${label} ${n}` : label);
  return {
    status: "いまの状態",
    members: counted("メンバー", ws.members?.count),
    billing: "プランと請求",
    inquiries: counted("問い合わせ", ws.inquiries?.open),
    log: "記録",
  };
}
/** タブを開けるできること（caps）。無いタブは口を呼ばず見る権限がない形 */
const TAB_CAP: Record<WsTab, string | null> = {
  status: null,
  members: "inquiry",
  billing: "money",
  inquiries: "inquiry",
  log: null,
};
export function canSeeTab(tab: WsTab, caps: readonly string[]): boolean {
  const need = TAB_CAP[tab];
  return need === null || caps.includes(need);
}

// ---------------------------------------------------------------- メンバー
const PC_TEXT: Record<string, string> = {
  connected: "つながっている",
  paired: "切れている",
  never: "まだつないでいない",
  none: "—（分身なし）",
};
function loginText(methods: readonly string[]): string {
  const parts: string[] = [];
  if (methods.includes("passkey")) parts.push("パスキー");
  if (methods.includes("password")) parts.push(methods.includes("two_factor") ? "パスワード＋2 段階" : "パスワード");
  return parts.length > 0 ? parts.join(" ・ ") : NONE;
}
export interface MemberView {
  initial: string;
  name: string;
  mail: string;
  role: string;
  last: string;
  pc: string;
  login: string;
  canResend: boolean;
  id: string;
}
export function memberView(m: WsMember): MemberView {
  return {
    initial: head(m.name),
    name: m.name,
    mail: m.email ?? NONE,
    role: m.role_label,
    last: mdHm(m.last_seen_at),
    pc: PC_TEXT[m.pc] ?? NONE,
    login: loginText(m.login_methods),
    canResend: !m.verified,
    id: m.member_id,
  };
}

// ---------------------------------------------------------------- プランと請求
export type BillTone = "warning" | "success" | "danger";
export interface BillView {
  month: string;
  amount: string;
  issued: string;
  due: string;
  state: string;
  tone: BillTone;
  paid: string | null;
}
export interface BillingView {
  plan: string;
  since: string | null;
  price: string;
  people: string;
  peoplePct: number | null;
  bills: BillView[];
}
const BILL_STATE: Record<string, [string, BillTone]> = {
  unpaid: ["お支払い待ち", "warning"],
  paid: ["払われた", "success"],
  overdue: ["期限を過ぎた", "danger"],
};
function billView(i: WsInvoice): BillView {
  const [state, tone] = BILL_STATE[i.state] ?? BILL_STATE["unpaid"]!;
  const month = /^\d{4}-(\d{2})$/.exec(i.month);
  return {
    month: month ? `${Number(month[1])} 月分` : i.month,
    amount: yen(i.amount_total),
    issued: md(i.issued_on) ?? NONE,
    due: md(i.due_on) ?? NONE,
    state,
    tone,
    paid: i.state === "paid" ? md(i.paid_on) : null,
  };
}
export function billingView(b: WsBilling): BillingView {
  const { count, limit } = b.members;
  const since = b.plan?.since ? /^\d{4}-(\d{2})-(\d{2})/.exec(b.plan.since) : null;
  return {
    plan: b.plan?.name ?? NONE,
    since: since ? `${since[1]}-${since[2]} から` : null,
    price: b.plan ? yen(b.plan.price_monthly) : NONE,
    people: limit === null ? String(count) : `${count} / ${limit}`,
    peoplePct: limit ? Math.round((count / limit) * 100) : null,
    bills: b.invoices.map(billView),
  };
}

// ---------------------------------------------------------------- 問い合わせ
const TOPIC: Record<string, string> = {
  usage: "使い方",
  trouble: "うまく動かない",
  billing: "お金・プラン",
  other: "ほか",
};
const INQ_STATE: Record<string, string> = { open: "進行中", waiting: "返事待ち", later: "後で", done: "済み" };
export interface InquiryView {
  id: string;
  title: string;
  kind: string;
  who: string;
  owner: string;
  state: string;
  done: boolean;
  at: string;
  href: string;
}
export function inquiryView(q: WsInquiry): InquiryView {
  return {
    id: q.id,
    title: q.title,
    kind: TOPIC[q.topic] ?? TOPIC["other"]!,
    who: q.asker_name,
    owner: q.owner_name ?? NONE,
    state: INQ_STATE[q.state] ?? NONE,
    done: q.state === "done",
    at: mdHm(q.created_at),
    href: `/ops/support?id=${encodeURIComponent(q.id)}`,
  };
}

// ---------------------------------------------------------------- 記録
export interface AuditView {
  at: string;
  who: string;
  text: string;
  detail?: string;
}
export function auditView(a: WsAudit): AuditView {
  const target = a.target_label && a.action !== "peek.open" ? `（${a.target_label}）` : "";
  return {
    at: mdHm(a.at),
    who: a.actor_name,
    text: `が ${a.action_label}${target}`,
    ...(a.reason ? { detail: `理由：${a.reason}` } : {}),
  };
}
