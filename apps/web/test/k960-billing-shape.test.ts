// K-960「請求書の画面（/billing）・請求先を変える小窓・見られない」の単体の試験（画面の外の、決まった形だけ）：
//   口の答え（getBilling）→ 部品の値（features/F12/billing/billing-shape.ts）と、請求先の欄の確かめ。ブラウザ・口は使わない。
//   行 ID は 11_tickets/K-960.md の表。テストはチケットを作る人が書き、実装する人は変えない
import { describe, expect, it } from "vitest";
import { billView, contactErrors, overdueText, termsText } from "../features/F12/billing/billing-shape";

type BillingIn = Parameters<typeof overdueText>[0];
type InvoiceIn = Parameters<typeof billView>[0];
const inv = (over: Partial<InvoiceIn> = {}): InvoiceIn =>
  ({
    id: "i1",
    month: "2025-10",
    amount_total: 16500,
    issued_on: "2025-11-01",
    due_on: "2025-11-30",
    state: "unpaid",
    ...over,
  }) as InvoiceIn;
const billing = (over: Partial<BillingIn> = {}): BillingIn =>
  ({
    terms: "請求書払い ・ 月末締め 翌月 1 日に出す ・ 月末払い",
    payee: { lines: [] },
    contact: { company: "株式会社ENGINE BASE", attn: "経理 ご担当", email: "keiri@engine-base.example" },
    invoices: [inv()],
    overdue: null,
    free: false,
    can_edit_contact: true,
    ...over,
  }) as BillingIn;

describe("K-960 答え → 部品の値", () => {
  it("K960-UN-001 請求書の 1 行：月は「10 月分」・金額は円の 3 けた区切り・日付は MM/DD・状態 3 つの字・入金の日は払われたときだけ", () => {
    expect(billView(inv())).toEqual({
      month: "10 月分",
      amount: "¥16,500",
      issued: "11/01",
      due: "11/30",
      state: "お支払い待ち",
    });
    expect(billView(inv({ month: "2025-09", state: "paid", paid_on: "2025-10-28" }))).toEqual({
      month: "9 月分",
      amount: "¥16,500",
      issued: "11/01",
      due: "11/30",
      state: "払われた",
      paid: "10/28",
    });
    expect(billView(inv({ state: "overdue", amount_total: 1234567 })).state).toBe("期限を過ぎた");
    expect(billView(inv({ amount_total: 1234567 })).amount).toBe("¥1,234,567");
    expect(billView(inv({ amount_total: 0 })).amount).toBe("¥0");
  });

  it("K960-UN-002 期限を過ぎた注意と支払い条件：1 件ならその月と金額と期限・2 件以上は件数と合計・無ければ出さない。無料は「無料のプラン ・ 請求書は出ません」", () => {
    const one = billing({
      invoices: [inv({ state: "overdue", due_on: "2025-10-31" }), inv({ id: "i2", month: "2025-09", state: "paid" })],
      overdue: { count: 1, amount_total: 16500 },
    });
    expect(overdueText(one)).toBe("10 月分（¥16,500）の期限（10/31）を過ぎています。振込のご確認をお願いします。");
    const two = billing({
      invoices: [inv({ state: "overdue" }), inv({ id: "i2", month: "2025-09", state: "overdue", amount_total: 15000 })],
      overdue: { count: 2, amount_total: 31500 },
    });
    expect(overdueText(two)).toBe("期限を過ぎた請求が 2 件（合計 ¥31,500）あります。振込のご確認をお願いします。");
    expect(overdueText(billing())).toBeUndefined();
    expect(termsText(billing())).toBe("請求書払い ・ 月末締め 翌月 1 日に出す ・ 月末払い");
    expect(termsText(billing({ free: true, invoices: [] }))).toBe("無料のプラン ・ 請求書は出ません");
  });

  it("K960-UN-003 請求先の欄の確かめ：前後の空白を落とし、会社名・宛名・メールの空・101 字・メールの形を欄ごとの字で返す。正しければ欄の誤りは 0", () => {
    expect(contactErrors({ company: " 株式会社A ", attn: "経理", email: "a@b.example" })).toEqual({
      values: { company: "株式会社A", attn: "経理", email: "a@b.example" },
      errors: {},
    });
    expect(contactErrors({ company: "  ", attn: "", email: "" }).errors).toEqual({
      company: "会社名を書いてください",
      attn: "宛名を書いてください",
      email: "メールを書いてください",
    });
    const long = "あ".repeat(101);
    expect(contactErrors({ company: long, attn: long, email: "a@b.example" }).errors).toEqual({
      company: "100 字までにしてください",
      attn: "100 字までにしてください",
    });
    expect(contactErrors({ company: "A", attn: "B", email: "keiri@" }).errors).toEqual({
      email: "メールの形が違います",
    });
    expect(contactErrors({ company: "A", attn: "B", email: "a b@c.example" }).errors).toEqual({
      email: "メールの形が違います",
    });
  });
});
