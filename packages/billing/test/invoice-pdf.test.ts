// K-1013 請求書の PDF の中身（packages/billing/src/invoice-pdf.ts の純粋な関数）。DB・置き場・口は使わない。
//   テストの名前の頭の行 ID（K1013-UN-…）は 11_tickets/K-1013.md の表の行に 1 対 1 で結ぶ。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//   中身（D-156.31・D-156.59：普通の請求書と同じ項目）：請求書・宛名・請求の月・出した日・期限・明細（プランの値段・消費税 10%・日割り）・合計・振込先・
//   出す側（会社名・住所・登録番号・連絡先）・備考
import { describe, expect, it } from "vitest";
import { invoicePdfLines, renderInvoicePdf, type InvoicePdfInput } from "../src/invoice-pdf.js";

const BASE: InvoicePdfInput = {
  invoiceId: "0f000000-0000-4000-8000-000000000001",
  month: "2026-10",
  issuedOn: "2026-11-01",
  dueOn: "2026-11-30",
  workspaceName: "合同会社ミナト企画",
  contact: { company: "合同会社ミナト企画", attn: "経理部 湊 さくら", email: "keiri@example.test" },
  planName: "チーム",
  amount: 15000,
  tax: 1500,
  prorated: 9900,
  total: 26400,
  payeeLines: ["試験銀行 本店 普通 0000000", "カ）シケン"],
  invoiceNo: "T0000000000000",
  issuer: {
    name: "試験の運営",
    address: "東京都千代田区試験町 1-1",
    contact: "billing@example.test",
    note: "お振込手数料はご負担ください",
  },
};

describe("K-1013 請求書の PDF の中身", () => {
  it("K1013-UN-001 字の並び：請求書・宛名（会社名 御中・宛名 様）・請求の月・出した日・期限・明細 3 行・合計・振込先・出す側（会社名・住所・登録番号・連絡先）・備考", () => {
    expect(invoicePdfLines(BASE)).toEqual([
      "請求書",
      "合同会社ミナト企画 御中",
      "経理部 湊 さくら 様",
      "2026 年 10 月分",
      "発行日 2026/11/01",
      "お支払い期限 2026/11/30",
      "チーム（月額） ¥15,000",
      "消費税（10%） ¥1,500",
      "プランを上げた日割り ¥9,900",
      "合計（税込） ¥26,400",
      "お振込先",
      "試験銀行 本店 普通 0000000",
      "カ）シケン",
      "試験の運営",
      "東京都千代田区試験町 1-1",
      "登録番号 T0000000000000",
      "連絡先 billing@example.test",
      "備考 お振込手数料はご負担ください",
    ]);
  });

  it("K1013-UN-002 日割りが 0 なら日割りの行を出さない。宛名が空なら宛名の行を出さない。振込先が空なら「お振込先は別にお知らせします」", () => {
    const l = invoicePdfLines({
      ...BASE,
      prorated: 0,
      total: 16500,
      contact: { company: "合同会社ミナト企画", attn: "", email: "" },
      payeeLines: [],
    });
    expect(l).not.toContain("プランを上げた日割り ¥0");
    expect(l.filter((x) => x.endsWith(" 様"))).toEqual([]);
    expect(l).toContain("合計（税込） ¥16,500");
    expect(l).toContain("お振込先は別にお知らせします");
  });

  it("K1013-UN-003 登録番号が空なら登録番号の行を出さない。月は 0 埋めしない（2019-08 → 2019 年 8 月分）", () => {
    const l = invoicePdfLines({ ...BASE, invoiceNo: "", month: "2019-08" });
    expect(l.some((x) => x.startsWith("登録番号"))).toBe(false);
    expect(l).toContain("2019 年 8 月分");
  });

  it("K1013-UN-005 出す側の住所・連絡先・備考が空なら、その行を出さない（会社名の行は残す）", () => {
    const l = invoicePdfLines({ ...BASE, issuer: { name: "試験の運営", address: "", contact: "", note: "" } });
    expect(l).toContain("試験の運営");
    expect(l.some((x) => x === "" || x.startsWith("連絡先") || x.startsWith("備考"))).toBe(false);
    expect(l).not.toContain("東京都千代田区試験町 1-1");
  });

  it("K1013-UN-004 PDF の中身：%PDF- で始まり、日本語の字の書体を埋め込み（FontFile）、1MB より小さい", async () => {
    const bytes = await renderInvoicePdf(BASE);
    const head = Buffer.from(bytes.slice(0, 5)).toString("latin1");
    expect(head).toBe("%PDF-");
    expect(Buffer.from(bytes).toString("latin1")).toMatch(/FontFile/);
    expect(bytes.byteLength).toBeLessThan(1024 * 1024);
  });
});
