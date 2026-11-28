// 配るもの › プランの画面（K-991）の、口の答え → 部品の値。画面の外の純粋な関数（@/ を読まない・単体の試験 k991-plans-shape.test.ts）。
//   答えの形は 11_tickets/K-987.md（PlanOps・PlanProposal・PlanHistoryRow）・K-989.md（影響）・K-1104.md（trial_days）。字は下絵（views-plans.tsx）が正。
//   時刻は日本時間で出す

export interface PlanFact {
  label: string;
  value: string;
}
export interface PlanOpenProposal {
  id: string;
  state: string;
  to_version: number;
  price_monthly: number;
  proposer_name?: string;
}
/** listOpsPlans の 1 行（K-987・trial_days は K-1104 が足す今の版の無料期間） */
export interface PlanOps {
  plan_key: string;
  name: string;
  version: number;
  price_monthly: number;
  member_limit: number;
  facts: readonly PlanFact[];
  places: number;
  trial_days?: number;
  proposal: PlanOpenProposal | null;
}
export interface PlanValues {
  price_monthly?: number;
  member_limit?: number;
  trial_days?: number;
}
export interface PlanPerson {
  member_id: string;
  name: string;
}
/** listPlanProposals の 1 行（K-987 の 20 欄） */
export interface PlanProposal {
  id: string;
  plan_key: string;
  plan_name: string;
  from_version: number;
  to_version: number;
  before: PlanValues;
  changes: PlanValues;
  existing_policy: string;
  notice_days: number | null;
  new_from: string | null;
  reason: string;
  state: string;
  proposer: PlanPerson;
  decider: PlanPerson | null;
  return_reason: string | null;
  created_at: string;
  submitted_at: string | null;
  decided_at: string | null;
  can_edit: boolean;
  can_decide: boolean;
}
export interface ImpactWorkspace {
  workspace: { id: string; name: string };
  members: number;
  now_price: number;
  after_price: number | null;
  from_month: string | null;
  stopped: boolean;
}
/** getPlanProposalImpact（K-989） */
export interface PlanImpact {
  customers: number;
  stopped: number;
  monthly_revenue_diff: number;
  immediate: boolean;
  existing_from: string | null;
  new_from: string | null;
  by_workspace: readonly ImpactWorkspace[];
}
export interface FromTo {
  from: number;
  to: number;
}
/** listPlanHistory の 1 行（K-987 の 9 欄） */
export interface PlanHistoryRow {
  id: string;
  at: string;
  actor_name: string;
  action: string;
  plan_name: string;
  to_version: number;
  reason: string | null;
  price: FromTo | null;
  members: FromTo | null;
}

/** 部品 PlanBox の値（views-plans.tsx） */
export interface PlanBoxView {
  name: string;
  ver: string;
  places: number;
  price: string;
  rows: (readonly [string, string])[];
  proposal?: string;
}
export interface StatView {
  label: string;
  value: string;
  sub?: string;
}
export interface ImpactRowView {
  key: string;
  ws: string;
  people: string;
  now: string;
  after: string;
}
export interface ImpactView {
  label: string;
  stats: StatView[];
  rows: ImpactRowView[];
  rest: string | null;
}
export interface HistoryItemView {
  at: string;
  who: string;
  text: string;
  detail?: string;
}

const NUM = new Intl.NumberFormat("ja-JP");
export const yen = (n: number): string => `¥${NUM.format(n)}`;
export const trialText = (days: number): string => (days > 0 ? `${days} 日` : "なし");
/** 名前の姓（空白の前） */
export const familyName = (name: string): string => name.trim().split(/\s+/)[0] ?? name;

const JST = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Tokyo",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
/** 時刻 → 「MM/DD HH:mm」（日本時間） */
export function jstStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const part = (t: string) => JST.formatToParts(d).find((p) => p.type === t)?.value ?? "";
  return `${part("month")}/${part("day")} ${part("hour")}:${part("minute")}`;
}
/** 日（YYYY-MM-DD）→ 「MM/DD」 */
export const monthDay = (date: string): string => {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(date);
  return m ? `${m[1]}/${m[2]}` : date;
};
const ym = (month: string): { y: string; m: number } | null => {
  const r = /^(\d{4})-(\d{2})/.exec(month);
  return r ? { y: r[1]!, m: Number(r[2]) } : null;
};
/** 月（YYYY-MM）→ 「YYYY 年 M 月分」 */
export const monthLabel = (month: string): string => {
  const v = ym(month);
  return v ? `${v.y} 年 ${v.m} 月分` : month;
};
/** 月（YYYY-MM）の前の月 → 「YYYY 年 M 月分」 */
export const prevMonthLabel = (month: string): string => {
  const v = ym(month);
  if (!v) return month;
  return v.m === 1 ? `${Number(v.y) - 1} 年 12 月分` : `${v.y} 年 ${v.m - 1} 月分`;
};

const proposalText = (p: PlanOpenProposal): string | null => {
  const head = `v${p.to_version} ${yen(p.price_monthly)}`;
  if (p.state === "waiting") return `${head} ・ 決める人を待っている`;
  if (p.state === "draft") return `${head} ・ 下書き`;
  return null;
};

/** いまのプランの箱（値段のあるプランだけ無料期間の行） */
export function planBox(p: PlanOps): PlanBoxView {
  const rows: (readonly [string, string])[] = p.facts.map((f) => [f.label, f.value] as const);
  if (p.price_monthly > 0) rows.push(["無料期間", trialText(p.trial_days ?? 0)]);
  const proposal = p.proposal ? proposalText(p.proposal) : null;
  return {
    name: p.name,
    ver: `v${p.version}`,
    places: p.places,
    price: yen(p.price_monthly),
    rows,
    ...(proposal ? { proposal } : {}),
  };
}

const IMPACT_SHOWN = 4;
/** 影響の区画（上の数 3 つ・先の 4 行・残りの数） */
export function impactView(i: PlanImpact, plan: { price_monthly: number; name?: string }): ImpactView {
  const label = `いまの${plan.name ?? "チーム"}の顧客`;
  const diff = i.monthly_revenue_diff;
  const stats: StatView[] = [
    {
      label,
      value: `${i.customers} か所`,
      ...(i.stopped > 0 ? { sub: `止めている ${i.stopped} を含む` } : {}),
    },
    {
      label: "月の売上（税別）",
      value: `${diff < 0 ? "-" : "+"} ${yen(Math.abs(diff))}`,
      sub: i.existing_from ? `${monthLabel(i.existing_from)}から` : "変わらない",
    },
    {
      label: "新しく入る人",
      value: i.new_from ? `${monthDay(i.new_from)} から` : "決めたらすぐ",
      sub: `${yen(plan.price_monthly)} で始まる`,
    },
  ];
  const rows = i.by_workspace.slice(0, IMPACT_SHOWN).map((w) => {
    const v = w.from_month ? ym(w.from_month) : null;
    return {
      key: w.workspace.id,
      ws: w.workspace.name,
      people: `${w.members} 人`,
      now: w.stopped ? "止めている" : yen(w.now_price),
      after: w.stopped ? "再開した月〜" : `${v ? `${v.y}/${v.m}〜 ` : ""}${yen(w.after_price ?? w.now_price)}`,
    };
  });
  const left = i.by_workspace.length - IMPACT_SHOWN;
  return { label, stats, rows, rest: left > 0 ? `ほか ${left} か所も同じ` : null };
}

const whenOf = (p: PlanProposal): string => jstStamp(p.submitted_at ?? p.created_at);
/** 決める人の画面の見出しの 2 行目 */
export function reviewHead(p: PlanProposal, me: string | null): string {
  const who = familyName(p.proposer.name);
  const lead = me !== null && p.proposer.member_id === me ? "自分が作った案" : "決める人を待っている";
  return `${lead} ・ ${who} ・ ${whenOf(p)} に回した`;
}

export interface ReviewFacts {
  price: readonly [string, string] | null;
  members: readonly [string, string] | null;
  trial: string;
  existing: string;
  newcomer: string;
}
const pair = (a: number | undefined, b: number | undefined, f: (n: number) => string) =>
  a === undefined || b === undefined ? null : ([f(a), f(b)] as const);
/** 決める人の画面の「変わること」 */
export function reviewFacts(p: PlanProposal, impact: PlanImpact | null, plan: { trial_days?: number }): ReviewFacts {
  const nowTrial = plan.trial_days ?? 0;
  const t = p.changes.trial_days;
  const trial =
    t === undefined
      ? `${trialText(nowTrial)}（変えない）`
      : `${trialText(p.before.trial_days ?? nowTrial)} → ${trialText(t)}`;
  const from = impact?.existing_from;
  const existing =
    p.existing_policy === "keep"
      ? "ずっと今の値段のまま"
      : `お知らせから ${p.notice_days ?? 90} 日たった最初の月${from ? `（${monthLabel(from)}）` : ""}から`;
  return {
    price: pair(p.before.price_monthly, p.changes.price_monthly, yen),
    members: pair(p.before.member_limit, p.changes.member_limit, (n) => `${n} 人まで`),
    trial,
    existing,
    newcomer: p.new_from ? `${monthDay(p.new_from)} から` : "決めたらすぐ",
  };
}

const ACTION_TEXT: Record<string, (plan: string) => string> = {
  "plan.propose": (x) => `が ${x} の案を作った`,
  "plan.update": (x) => `が ${x} の案を直した`,
  "plan.submit": (x) => `が ${x} の案を直して、決める人に回した`,
  "plan.return": (x) => `が ${x} の案を差し戻した`,
  "plan.decide": (x) => `が ${x} を決めた`,
};
/** 値段の記録の 1 行（部品 Feed） */
export function historyItem(r: PlanHistoryRow): HistoryItemView {
  const plan = `${r.plan_name} v${r.to_version}`;
  const text = (ACTION_TEXT[r.action] ?? ((x: string) => `が ${x} を変えた`))(plan);
  const parts = [
    r.price ? `値段 ${yen(r.price.from)} → ${yen(r.price.to)}` : null,
    r.members ? `人数 ${r.members.from} → ${r.members.to} 人` : null,
    r.reason ? `理由：${r.reason}` : null,
  ].filter((s): s is string => s !== null);
  return {
    at: jstStamp(r.at),
    who: familyName(r.actor_name),
    text,
    ...(parts.length > 0 ? { detail: parts.join(" ・ ") } : {}),
  };
}

/** 決めたら出るお知らせの既定の文（下絵 oq-plan-review の字の形） */
export function defaultNotice(p: PlanProposal, impact: PlanImpact | null): string {
  const price = p.changes.price_monthly;
  const from = impact?.existing_from;
  const when = p.existing_policy === "keep" || !from ? "" : `${monthLabel(from)}から`;
  const lines: string[] = [];
  if (price !== undefined) lines.push(`${p.plan_name}プランの料金を ${when}月 ${yen(price)}（税別）に改めます。`);
  const a = p.before.member_limit;
  const b = p.changes.member_limit;
  if (a !== undefined && b !== undefined && a !== b)
    lines.push(
      `${lines.length > 0 ? "あわせて" : `${p.plan_name}プランの`}人数の上限を ${a} 人から ${b} 人に${b > a ? "広げます" : "改めます"}。`,
    );
  if (p.existing_policy === "keep") lines.push("いまお使いの方は今の料金のままです。");
  else if (when) lines.push("それまでは今の料金のままです。");
  lines.push("ご不明な点は「困ったとき・お知らせ」からお問い合わせください。");
  return lines.join("");
}

/** 決めると起きること（下絵 oq-plan-review の番号の箇条） */
export function decideSteps(p: PlanProposal, impact: PlanImpact | null): string[] {
  const from = impact?.existing_from ?? null;
  const price = p.changes.price_monthly;
  const steps: string[] = [];
  steps.push(
    p.existing_policy === "keep" || !from
      ? `${p.plan_name} v${p.to_version} ができる（v${p.from_version} は残り、いまの顧客は v${p.from_version} のまま）`
      : `${p.plan_name} v${p.to_version} ができる（v${p.from_version} は残り、いまの顧客は ${prevMonthLabel(from)}まで v${p.from_version}）`,
  );
  steps.push(
    `いまの顧客 ${impact?.customers ?? 0} か所の管理者にお知らせが出る（文は下で直せる）。設定の「プランと支払い」にも変わる日と値段が出る`,
  );
  const priceText = price !== undefined ? ` ${yen(price)}` : "";
  steps.push(
    `${p.new_from ? `${monthDay(p.new_from)} から` : "決めたらすぐ"}、新しく入る人と「プランを変える」で${p.plan_name}を選ぶ人は${priceText}`,
  );
  if (p.existing_policy !== "keep" && from && price !== undefined)
    steps.push(`${monthLabel(from)}の請求書から ${yen(price)}（下書きの段で運営が確かめる）`);
  return steps;
}
