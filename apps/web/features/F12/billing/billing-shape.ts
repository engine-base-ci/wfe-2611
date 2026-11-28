// 請求書の画面（K-960）：口の答え（getBilling・K-1005 の「画面が使う答えの形」）→ 部品（views.tsx の Bills）の値と、請求先の欄の確かめ。
//   画面の外の純粋な関数（@/ を読まない・単体の試験 apps/web/test/k960-billing-shape.test.ts）。
//   字は下絵が正。2 件以上の注意・欄の誤りの字は下絵に無く、代表の答え 2026-11-23（D-156.70）の案のまま

export type InvoiceState = "unpaid" | "paid" | "overdue";
export interface InvoiceIn {
  id: string;
  /** YYYY-MM */
  month: string;
  /** 税込の円 */
  amount_total: number;
  issued_on: string;
  due_on: string;
  state: InvoiceState;
  paid_on?: string | null;
}
export interface ContactIn {
  company: string;
  attn: string;
  email: string;
}
export interface BillingIn {
  terms: string;
  payee: { lines: string[] };
  contact: ContactIn;
  invoices: InvoiceIn[];
  overdue: { count: number; amount_total: number } | null;
  free: boolean;
  can_edit_contact: boolean;
}

/** 部品の請求書の 1 行（views.tsx の BillView と同じ形・id は画面が足す） */
export interface BillRow {
  month: string;
  amount: string;
  issued: string;
  due: string;
  state: "お支払い待ち" | "払われた" | "期限を過ぎた";
  paid?: string;
}

const STATE_TEXT: Record<InvoiceState, BillRow["state"]> = {
  unpaid: "お支払い待ち",
  paid: "払われた",
  overdue: "期限を過ぎた",
};
const YEN = new Intl.NumberFormat("ja-JP");

/** 円の字（¥16,500） */
export const yen = (n: number): string => `¥${YEN.format(n)}`;
/** YYYY-MM →「10 月分」（0 埋めしない） */
export const monthText = (ym: string): string => `${Number(ym.slice(5, 7))} 月分`;
/** YYYY-MM-DD →「MM/DD」 */
export const mmdd = (d: string): string => `${d.slice(5, 7)}/${d.slice(8, 10)}`;

export function billView(inv: InvoiceIn): BillRow {
  return {
    month: monthText(inv.month),
    amount: yen(inv.amount_total),
    issued: mmdd(inv.issued_on),
    due: mmdd(inv.due_on),
    state: STATE_TEXT[inv.state],
    ...(inv.state === "paid" && inv.paid_on ? { paid: mmdd(inv.paid_on) } : {}),
  };
}

const ASK = "振込のご確認をお願いします。";

/** 期限を過ぎた注意の本文。無ければ undefined */
export function overdueText(b: BillingIn): string | undefined {
  const o = b.overdue;
  if (!o || o.count <= 0) return undefined;
  const one = o.count === 1 ? b.invoices.find((i) => i.state === "overdue") : undefined;
  if (one)
    return `${monthText(one.month)}（${yen(one.amount_total)}）の期限（${mmdd(one.due_on)}）を過ぎています。${ASK}`;
  return `期限を過ぎた請求が ${o.count} 件（合計 ${yen(o.amount_total)}）あります。${ASK}`;
}

/** 支払い条件（見出しの副題） */
export const termsText = (b: BillingIn): string => (b.free ? "無料のプラン ・ 請求書は出ません" : b.terms);

/** 請求先の欄の上限（契約 K-1005 と同じ 1〜100 字） */
export const CONTACT_MAX = 100;
const EMAIL_SHAPE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const EMPTY_TEXT: Record<keyof ContactIn, string> = {
  company: "会社名を書いてください",
  attn: "宛名を書いてください",
  email: "メールを書いてください",
};

/** 請求先の 3 欄を確かめる。前後の空白を落とした値と、欄ごとの字（誤りが無ければ空） */
export function contactErrors(v: ContactIn): {
  values: ContactIn;
  errors: Partial<Record<keyof ContactIn, string>>;
} {
  const values: ContactIn = { company: v.company.trim(), attn: v.attn.trim(), email: v.email.trim() };
  const errors: Partial<Record<keyof ContactIn, string>> = {};
  for (const k of ["company", "attn", "email"] as const) {
    const s = values[k];
    if (s === "") errors[k] = EMPTY_TEXT[k];
    else if (Array.from(s).length > CONTACT_MAX) errors[k] = `${CONTACT_MAX} 字までにしてください`;
    else if (k === "email" && !EMAIL_SHAPE.test(s)) errors[k] = "メールの形が違います";
  }
  return { values, errors };
}
