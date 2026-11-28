// K-703「確認項目の出どころの印（ナレッジ：ページの名前）と『まだ完了にできません』の小窓」の単体の試験（画面の外の、決まった形だけ）：
//   確認項目の行（listTestSpecs の 1 行）から「完了を止める行」「注意だけの行」「印」を決め、完了を止める 409 の体から残りの行を読み、小窓に渡す行を作る（spec-guard-shape.ts）。
//   ブラウザ・口は使わない。行の形の正は口の葉 K-434（listTestSpecs）・K-701（409 E-KNW-240・source_page）。
//   行 ID は 11_tickets/K-703.md の表。テストはチケットを作る人が書き、実装する人は変えない
import { describe, expect, it } from "vitest";
import {
  blockingOf,
  cautionCount,
  dialogRows,
  leftFromConflict,
  specMark,
} from "../features/F9/knowledge/spec-guard-shape";

const P1 = "0193c5a0-0000-7000-8000-00000000a001";
const P2 = "0193c5a0-0000-7000-8000-00000000a004";
const row = (o: Record<string, unknown>) => ({
  id: "s",
  title: "文",
  checked: false,
  source: "manual",
  ...o,
});
const KR = (id: string, page: string, title: string, checked = false) =>
  row({ id, title: `『${title}』を守った`, checked, source: "knowledge", source_page: { id: page, title } });

describe("K703-UN", () => {
  it("K703-UN-001 blockingOf：完了を止めるのは、出どころ knowledge・source_page がある・チェックが無い行だけ（チェック済み・人が足した行・source_page が無い／null の knowledge の行は止めない）。並びは元の順・元の配列を変えない", () => {
    const rows = [
      KR("a", P1, "請求書の送り方"),
      KR("b", P2, "外に出す前の確かめ", true),
      row({ id: "c", source: "manual" }),
      row({ id: "d", source: "knowledge", source_page: null }),
      row({ id: "e", source: "knowledge" }),
      KR("f", P2, "外に出す前の確かめ"),
    ];
    const before = JSON.stringify(rows);
    expect(blockingOf(rows).map((r) => r.id)).toEqual(["a", "f"]);
    expect(blockingOf(rows)[0]).toEqual({
      id: "a",
      text: "『請求書の送り方』を守った",
      from: "請求書の送り方",
      pageId: P1,
    });
    expect(blockingOf([])).toEqual([]);
    expect(JSON.stringify(rows)).toBe(before);
  });

  it("K703-UN-002 cautionCount：注意だけの数は、チェックの無い『人が足した行』（出どころが knowledge でない行）の数。knowledge の行はチェックが無くても数えない（止める行か、必ず守るから外れた行）", () => {
    const rows = [
      KR("a", P1, "請求書の送り方"),
      row({ id: "m1" }),
      row({ id: "m2", checked: true }),
      row({ id: "m3", source: "manual" }),
      row({ id: "k0", source: "knowledge", source_page: null }),
    ];
    expect(cautionCount(rows)).toBe(2);
    expect(cautionCount([])).toBe(0);
    expect(cautionCount([KR("a", P1, "x")])).toBe(0);
  });

  it("K703-UN-003 leftFromConflict：409 の体が code E-KNW-240 で detail.left の行（id・title・page_id・page_title が全部文字）を 1 行以上読めるとき、止める行の並びにする。形の違う行は捨て、code が違う・detail が無い・読める行が 0 なら null（小窓にせず今までの赤い知らせに任せる）", () => {
    const ok = {
      error: "conflict",
      code: "E-KNW-240",
      detail: {
        left: [
          { id: "a", title: "『請求書の送り方』を守った", page_id: P1, page_title: "請求書の送り方" },
          { id: "b", title: 3, page_id: P2, page_title: "壊れた行" },
          { id: "c", title: "『外に出す前の確かめ』を守った", page_id: P2, page_title: "外に出す前の確かめ" },
        ],
      },
    };
    expect(leftFromConflict(ok)).toEqual([
      { id: "a", text: "『請求書の送り方』を守った", from: "請求書の送り方", pageId: P1 },
      { id: "c", text: "『外に出す前の確かめ』を守った", from: "外に出す前の確かめ", pageId: P2 },
    ]);
    expect(leftFromConflict({ ...ok, code: "E-CONF-016" })).toBeNull();
    expect(leftFromConflict({ error: "conflict", code: "E-KNW-240" })).toBeNull();
    expect(leftFromConflict({ error: "conflict", code: "E-KNW-240", detail: { left: [] } })).toBeNull();
    expect(leftFromConflict({ error: "conflict", code: "E-KNW-240", detail: { left: "x" } })).toBeNull();
    expect(leftFromConflict(null)).toBeNull();
    expect(leftFromConflict("E-KNW-240")).toBeNull();
  });

  it("K703-UN-004 dialogRows：小窓に渡す行は、止める行（出どころの題名つき）→ 人が足したチェックの無い行の順・どれも done=false・id と文は元のまま。止める行が 0 なら空（小窓を作らない）", () => {
    const blocking = blockingOf([KR("a", P1, "請求書の送り方"), KR("f", P2, "外に出す前の確かめ")]);
    const rows = [row({ id: "m1", title: "先月と同じ書式になっている" }), row({ id: "m2", checked: true })];
    expect(dialogRows(blocking, rows)).toEqual([
      { id: "a", text: "『請求書の送り方』を守った", done: false, from: "請求書の送り方" },
      { id: "f", text: "『外に出す前の確かめ』を守った", done: false, from: "外に出す前の確かめ" },
      { id: "m1", text: "先月と同じ書式になっている", done: false },
    ]);
    expect(dialogRows([], rows)).toEqual([]);
  });

  it("K703-UN-005 specMark：出どころ knowledge で source_page の id・title が文字の行だけ、印の字『ナレッジ：<題名>』とページの道（uuid の形なら /knowledge/<id>・そうでなければ道なし＝字だけ）。manual・source_page が無い／null・形が違う行は null", () => {
    expect(specMark(KR("a", P1, "請求書の送り方"))).toEqual({
      label: "ナレッジ：請求書の送り方",
      href: `/knowledge/${P1}`,
    });
    expect(specMark(row({ source: "knowledge", source_page: { id: "not-uuid", title: "題" } }))).toEqual({
      label: "ナレッジ：題",
      href: null,
    });
    expect(specMark(row({ source: "manual", source_page: { id: P1, title: "題" } }))).toBeNull();
    expect(specMark(row({ source: "knowledge", source_page: null }))).toBeNull();
    expect(specMark(row({ source: "knowledge" }))).toBeNull();
    expect(specMark(row({ source: "knowledge", source_page: { id: P1, title: 3 } }))).toBeNull();
  });
});
