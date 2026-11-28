// K-957「帯と画面いっぱいの形」の単体の試験（画面の外の、決まった形だけ）：getServiceStatusForMember の bands・components・maintenance_now と
//   お知らせの答え → 帯の部品の値・どの帯を出すか・画面いっぱいの形にするか（features/F12/help/bands-shape.ts）。ブラウザ・口は使わない。
//   行 ID は 11_tickets/K-957.md の表。テストはチケットを作る人が書き、実装する人は変えない
import { describe, expect, it } from "vitest";
import { bandView, downView, gateOf, pickBand } from "../features/F12/help/bands-shape";

type Band = Parameters<typeof pickBand>[0][number];
type Status = Parameters<typeof gateOf>[0];
type Notice = NonNullable<Parameters<typeof bandView>[1]>;
const inc = (over: Partial<Band> = {}): Band => ({
  kind: "incident",
  notice_id: "n1",
  title: "分身の実行が遅れています",
  state: "identified",
  from: "2025-11-02T00:40:00Z",
  closable: true,
  more: 0,
  ...over,
});
const mnt = (over: Partial<Band> = {}): Band => ({
  kind: "maintenance",
  notice_id: "n2",
  title: "11/10（月）2:00〜3:00 メンテナンス",
  from: "2025-11-09T17:00:00Z",
  to: "2025-11-09T18:00:00Z",
  closable: true,
  more: 0,
  ...over,
});
const notice = (over: Partial<Notice> = {}): Notice =>
  ({
    id: "n1",
    kind: "incident",
    title: "分身の実行が遅れています",
    body: "送る順番の仕組みを入れ替えています\n中身",
    state: "identified",
    published_at: "2025-11-02T01:20:00Z",
    unread: true,
    maintenance: null,
    updates: [],
    ...over,
  }) as Notice;
const status = (over: Partial<Status> = {}): Status => ({
  components: [{ key: "web", label: "画面", state: "normal" }],
  bands: [],
  maintenance_now: null,
  ...over,
});

describe("K-957 帯の読み替え", () => {
  it("K957-UN-001 帯の字：障害は「<題>（MM/DD HH:MM〜）」・状態の字・2 行目は最新の続報の本文（無ければ本文の 1 行目）／メンテは時間「11/10（月）2:00〜3:00」と影響（無ければ本文の 1 行目）", () => {
    expect(bandView(inc(), notice())).toEqual({
      kind: "incident",
      title: "分身の実行が遅れています（11/02 09:40〜）",
      state: "原因が分かった",
      note: "送る順番の仕組みを入れ替えています",
      href: "/notices/n1",
    });
    const withUpdate = notice({
      updates: [
        { state: "investigating", body: "調べています", at: "2025-11-02T00:45:00Z" },
        { state: "identified", body: "データは消えていません", at: "2025-11-02T01:30:00Z" },
      ],
    });
    expect(bandView(inc(), withUpdate).note).toBe("データは消えていません");
    expect(bandView(inc(), undefined).note).toBe("");
    expect(bandView(inc({ note: "帯の 2 行目の字" }), withUpdate).note).toBe("帯の 2 行目の字");
    expect(
      bandView(mnt(), notice({ id: "n2", kind: "maintenance", body: "この間は使えません\n中身", maintenance: null })),
    ).toEqual({
      kind: "maintenance",
      window: "11/10（月）2:00〜3:00",
      impact: "この間は使えません",
      href: "/notices/n2",
    });
    expect(
      bandView(
        mnt(),
        notice({ id: "n2", kind: "maintenance", maintenance: { from: "x", to: "y", impact: "使えません（影響）" } }),
      ),
    ).toMatchObject({ impact: "使えません（影響）" });
  });

  it("K957-UN-002 出す帯：並びの頭の 1 つ（閉じた物は飛ばす）と「ほか N 件」＝残りの帯の数＋出す帯の more・閉じられない帯は閉じた印を見ない・無ければ null", () => {
    expect(pickBand([inc(), mnt()], new Set())).toEqual({ band: inc(), others: 1 });
    expect(pickBand([inc({ more: 2 }), mnt()], new Set())).toEqual({ band: inc({ more: 2 }), others: 3 });
    expect(pickBand([inc(), mnt()], new Set(["n1"]))).toEqual({ band: mnt(), others: 0 });
    expect(pickBand([inc({ closable: false }), mnt()], new Set(["n1"]))).toEqual({
      band: inc({ closable: false }),
      others: 1,
    });
    expect(pickBand([], new Set())).toBeNull();
    expect(pickBand([mnt()], new Set(["n2"]))).toBeNull();
  });

  it("K957-UN-003 画面いっぱいの形：maintenance_now があればメンテ中・画面（key web）が down なら障害・どちらでもなければ null（メンテ中が先）", () => {
    expect(gateOf(status())).toBeNull();
    expect(gateOf(status({ maintenance_now: { from: "2025-11-09T17:00:00Z", to: "2025-11-09T18:00:00Z" } }))).toEqual({
      kind: "maintenance",
      window: "11/10（月）2:00〜3:00",
    });
    expect(gateOf(status({ components: [{ key: "web", label: "画面", state: "down" }], bands: [inc()] }))).toEqual({
      kind: "down",
    });
    expect(gateOf(status({ components: [{ key: "runs", label: "分身の実行", state: "down" }] }))).toBeNull();
    expect(
      gateOf(
        status({
          components: [{ key: "web", label: "画面", state: "down" }],
          maintenance_now: { from: "2025-11-09T17:00:00Z", to: "2025-11-09T18:00:00Z" },
        }),
      )?.kind,
    ).toBe("maintenance");
  });

  it("K957-UN-004 障害の画面の字：更新は最新の続報の時刻（無ければ始まり）・いまの様子は最新の続報の本文・始まり HH:MM・障害の番号は帯の ref（D-156.45・無ければ notice_id の頭 8 字を大文字）", () => {
    const n = notice({
      id: "0193c5a0-0000-7000-8000-000000005001",
      updates: [{ state: "identified", body: "チケットの保存が遅くなっている", at: "2025-11-02T01:42:00Z" }],
    });
    expect(downView(inc({ from: "2025-11-02T01:38:00Z", notice_id: n.id }), n)).toEqual({
      updated: "10:42",
      note: "チケットの保存が遅くなっている",
      since: "10:38",
      no: "0193C5A0",
    });
    expect(downView(inc({ from: "2025-11-02T01:38:00Z" }), undefined)).toEqual({
      updated: "10:38",
      note: "",
      since: "10:38",
      no: "N1",
    });
    expect(downView(inc({ from: "2025-11-02T01:38:00Z", ref: "INC-2511-03" }), undefined).no).toBe("INC-2511-03");
  });
});
