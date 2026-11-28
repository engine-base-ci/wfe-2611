// K-1007「鈴の文」の単体の試験（画面の外の、決まった形だけ）：お知らせの 1 行（K-461 の答えの形）→ 鈴の行の文（段 8 の K-467 の features/F7/notice/notice-text.ts）。
//   段 13 の鈴の種類の文は、押した先の画面の葉が文の表に 1 行足す（D-156.73・D-156.41 を改めた。種類の行は口の葉 K-975 が kinds.ts に足す）。params の欄は足さず、文は決まった字。
//   ブラウザ・口は使わない。行 ID は 11_tickets/K-1007.md の表。テストはチケットを作る人が書き、実装する人は変えない
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

describe("K-1007 鈴の文", () => {
  it("K1007-UN-004 inquiry.replied の行の文は「運営から問い合わせに返事がありました」・行き先は /notices（返事の本文を出さない）", () => {
    const item = noticeItemOf(row("inquiry.replied", "/notices"), NOW);
    expect(item.text).toBe("運営から問い合わせに返事がありました");
    expect(item.href).toBe("/notices");
  });
});
