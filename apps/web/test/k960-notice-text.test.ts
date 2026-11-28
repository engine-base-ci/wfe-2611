// K-960「鈴の文」の単体の試験（画面の外の、決まった形だけ）：お知らせの 1 行（K-461 の答えの形）→ 鈴の行の文（段 8 の K-467 の features/F7/notice/notice-text.ts）。
//   段 13 の鈴の種類の文は、押した先の画面の葉が文の表に 1 行足す（D-156.73・D-156.41 を改めた。種類の行は口の葉 K-959・K-981・K-983 が kinds.ts に足す）。params の欄は足さず、文は決まった字。
//   ブラウザ・口は使わない。行 ID は 11_tickets/K-960.md の表。テストはチケットを作る人が書き、実装する人は変えない
import { describe, expect, it } from "vitest";
import { noticeItemOf } from "../features/F7/notice/notice-text";

type Row = Parameters<typeof noticeItemOf>[0];
const NOW = new Date("2026-12-10T03:00:00Z");
const row = (kind: string, href: string | null): Row =>
  ({
    id: "11111111-1111-4111-8111-111111111111",
    kind,
    tag: "setting",
    href,
    ticket_id: null,
    number: null,
    title: null,
    actor: null,
    params: {},
    read: false,
    read_at: null,
    created_at: "2026-12-10T02:00:00Z",
  }) as unknown as Row;

describe("K-960 鈴の文", () => {
  it("K960-UN-004 billing.contact_changed の行の文は「請求先が変わりました」・行き先は /billing（汎用の文にしない・中身の字を出さない）", () => {
    const item = noticeItemOf(row("billing.contact_changed", "/billing"), NOW);
    expect(item.text).toBe("請求先が変わりました");
    expect(item.href).toBe("/billing");
  });
  it("K960-UN-005 billing.invoice_issued の行の文は「新しい請求書が届きました」・行き先は /billing（月・額・期限は params に通らないので文に出さない）", () => {
    const item = noticeItemOf(row("billing.invoice_issued", "/billing"), NOW);
    expect(item.text).toBe("新しい請求書が届きました");
    expect(item.href).toBe("/billing");
  });
  it("K960-UN-006 billing.overdue は「お支払いの期限を過ぎた請求書があります」・billing.overdue_week は「お支払いの期限から 1 週間たった請求書があります。このままだと止めることがあります」・どちらも行き先は /billing", () => {
    const item = noticeItemOf(row("billing.overdue", "/billing"), NOW);
    expect(item.text).toBe("お支払いの期限を過ぎた請求書があります");
    expect(item.href).toBe("/billing");
    const week = noticeItemOf(row("billing.overdue_week", "/billing"), NOW);
    expect(week.text).toBe("お支払いの期限から 1 週間たった請求書があります。このままだと止めることがあります");
    expect(week.href).toBe("/billing");
  });
});
