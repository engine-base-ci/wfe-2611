// 設定の「プランと支払い」（K-962）：口の答え（listWorkspacePlans の data と meta・K-1005 の PlanChoice に K-961 が足した 4 欄）→ 部品（views.tsx の PriceChange・PlanDialog・PlanConfirm）の値。
//   画面の外の純粋な関数（@/ を読まない・単体の試験 apps/web/test/k962-plan-shape.test.ts）。字は下絵が正。
//   次の請求は日本時間の来月 1 日（D-125.125 の「翌月 1 日に出す」）。日割りの金額は口の答えを出すだけで、画面では計算しない
import { mmdd, yen } from "./billing-shape";

export type PlanKey = "free" | "team" | "business";
export interface PlanIn {
  plan_key: PlanKey;
  name: string;
  price_monthly: number;
  member_limit: number;
  current: boolean;
  can_choose: boolean;
  reason?: string;
  /** YYYY-MM-DD（下げると変わる日） */
  effective_from: string;
  summary: string;
  recommended: boolean;
  /** 上げるときの今月の残り日数分（上げられる行だけ） */
  upgrade: { days: number; amount: number; invoice_on: string } | null;
  /** 値段・人数が変わる予定（いまのプランの行だけ） */
  upcoming: { price_monthly: number; member_limit: number; from_month: string; noticed_on: string } | null;
}
export interface PlansMeta {
  /** 社内の人の数（ゲストは数えない・D-156.51。口の値のまま出す） */
  members: number;
  member_limit: number;
}

/** 部品の 1 行（views.tsx の PlanView と同じ形） */
export interface PlanRowView {
  id: string;
  name: string;
  price: string;
  limit: string;
  current?: boolean;
  recommended?: boolean;
}

const JST_MS = 9 * 60 * 60 * 1000;
const pad2 = (n: number): string => String(n).padStart(2, "0");

/** 日本時間の来月 1 日（「MM/DD」） */
export function nextBillText(now: number): string {
  const jst = new Date(now + JST_MS);
  return `${pad2(((jst.getUTCMonth() + 1) % 12) + 1)}/01`;
}

export const currentOf = (plans: readonly PlanIn[]): PlanIn | undefined => plans.find((p) => p.current);

/** 設定の 1 行の字（無料は次の請求を書かない） */
export function planRowLine(plans: readonly PlanIn[], meta: PlansMeta, now: number): { name: string; line: string } {
  const c = currentOf(plans);
  if (!c) return { name: "", line: "" };
  const base = `${c.name} ・ ${c.member_limit} 人まで ・ いま ${meta.members} 人`;
  return {
    name: c.name,
    line: c.price_monthly > 0 ? `${base} ・ 次の請求 ${nextBillText(now)} ${yen(c.price_monthly)}` : base,
  };
}

/** 小窓のプランの並び */
export function planViews(plans: readonly PlanIn[]): PlanRowView[] {
  return plans.map((p) => ({
    id: p.plan_key,
    name: p.name,
    price: p.price_monthly === 0 ? yen(0) : `${yen(p.price_monthly)} ／月`,
    limit: p.summary ? `${p.member_limit} 人まで ・ ${p.summary}` : `${p.member_limit} 人まで`,
    ...(p.current ? { current: true } : {}),
    ...(p.recommended ? { recommended: true } : {}),
  }));
}

/** 値段が変わるお知らせの字（予定が無ければ null） */
export function changeText(plan: PlanIn): { change: string; noticeDate: string } | null {
  const u = plan.upcoming;
  if (!u) return null;
  const year = Number(u.from_month.slice(0, 4));
  const month = Number(u.from_month.slice(5, 7));
  const verb = u.member_limit > plan.member_limit ? "広がる" : "変わる";
  return {
    change: `${year} 年 ${month} 月分から ${yen(u.price_monthly)}（税別）・ 人数は ${u.member_limit} 人まで に${verb}。それまでは今のまま`,
    noticeDate: mmdd(u.noticed_on),
  };
}

export type ConfirmView =
  | { mode: "up"; plan: string; days: number; amount: string; due: string }
  | { mode: "down"; plan: string; from: string };

/** 確かめの字：上げる（残りの日数・金額・請求書の日）／下げる（変わる日） */
export function confirmView(plan: PlanIn): ConfirmView {
  const u = plan.upgrade;
  return u
    ? { mode: "up", plan: plan.name, days: u.days, amount: yen(u.amount), due: mmdd(u.invoice_on) }
    : { mode: "down", plan: plan.name, from: mmdd(plan.effective_from) };
}
