// K-1008「止める日の帯・止められた画面・中を見られている間の帯」の単体の試験（画面の外の、決まった形だけ）：
//   bands の stop・peek → 部品の値・止められた画面にするか（features/F12/help/bands-shape.ts に K-1008 が足す関数）。ブラウザ・口は使わない。
//   行 ID は 11_tickets/K-1008.md の表。テストはチケットを作る人が書き、実装する人は変えない
import { describe, expect, it } from "vitest";
import { gateOf, peekView, type pickBand, stopView } from "../features/F12/help/bands-shape";

type Band = Parameters<typeof pickBand>[0][number];
type Status = Parameters<typeof gateOf>[0];
const NOW = Date.parse("2025-11-22T03:00:00Z");
const stop = (from: string, over: Partial<Band> = {}): Band => ({
  kind: "stop",
  title: "お支払いの確認が取れないため",
  from,
  closable: false,
  more: 0,
  ...over,
});
const status = (bands: Band[]): Status => ({
  components: [{ key: "web", label: "画面", state: "normal" }],
  bands,
  maintenance_now: null,
});

describe("K-1008 止める・中を見るの読み替え", () => {
  it("K1008-UN-001 止める日の帯：止める日が先なら「止める日」（M/D・日本時間）と理由・止めた後なら止められた画面の「止めた日」と理由", () => {
    expect(stopView(stop("2025-11-28T15:00:00Z"), NOW)).toEqual({
      mode: "soon",
      day: "11/29",
      reason: "お支払いの確認が取れないため",
    });
    expect(stopView(stop("2025-11-19T15:00:00Z"), NOW)).toEqual({
      mode: "stopped",
      since: "11/20",
      reason: "お支払いの確認が取れないため",
    });
    expect(stopView(stop("2025-11-22T03:00:00Z"), NOW).mode).toBe("stopped");
  });

  it("K1008-UN-002 止められた画面にする：止めた後の stop の帯があれば、困ったとき・お知らせと問い合わせの道（/notices・/inquiry とその下）のほかは止められた画面・メンテ中が先", () => {
    const s = status([stop("2025-11-19T15:00:00Z")]);
    expect(gateOf(s, NOW, "/tickets")).toEqual({
      kind: "stopped",
      since: "11/20",
      reason: "お支払いの確認が取れないため",
    });
    for (const p of ["/notices", "/notices/abc", "/inquiry", "/inquiry/abc"]) expect(gateOf(s, NOW, p), p).toBeNull();
    expect(gateOf(s, NOW, "/inquiryx")?.kind).toBe("stopped");
    expect(gateOf(status([stop("2025-11-28T15:00:00Z")]), NOW, "/tickets")).toBeNull();
    expect(
      gateOf({ ...s, maintenance_now: { from: "2025-11-22T02:00:00Z", to: "2025-11-22T04:00:00Z" } }, NOW, "/tickets")
        ?.kind,
    ).toBe("maintenance");
  });

  it("K1008-UN-003 中を見られている間の帯：見ている先・理由・残りの分（切り上げ・0 より下は 0）・閉じる id・運営の側（side ops）", () => {
    const peek: Band = {
      kind: "peek",
      notice_id: "g1",
      title: "合同会社ミナト企画 ・ 湊 さくら さん",
      state: "問い合わせ「承認したのに動かない」",
      to: new Date(NOW + 51 * 60_000 + 1).toISOString(),
      closable: false,
      more: 0,
    };
    expect(peekView(peek, NOW)).toEqual({
      side: "ops",
      id: "g1",
      who: "合同会社ミナト企画 ・ 湊 さくら さん",
      reason: "問い合わせ「承認したのに動かない」",
      rest: "52 分",
    });
    expect(peekView({ ...peek, to: new Date(NOW - 1000).toISOString() }, NOW).rest).toBe("0 分");
  });

  it("K1008-UN-004 顧客の側の「運営が中を見ています」の帯：notice_id が null の peek は side customer・id null・who は題の字・理由と残りの分は同じ読み方（D-156.50）", () => {
    const peek: Band = {
      kind: "peek",
      notice_id: null,
      title: "運営が中を見ています",
      state: "問い合わせ「承認したのに動かない」",
      to: new Date(NOW + 51 * 60_000 + 1).toISOString(),
      closable: false,
      more: 0,
    };
    expect(peekView(peek, NOW)).toEqual({
      side: "customer",
      id: null,
      who: "運営が中を見ています",
      reason: "問い合わせ「承認したのに動かない」",
      rest: "52 分",
    });
  });
});
