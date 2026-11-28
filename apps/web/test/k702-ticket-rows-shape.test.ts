// K-702「やり取りの『このチケットで守る物』『AI が開いたページ』『守れていなかった決まり』の行」の単体の試験（画面の外の、決まった形だけ）：
//   やり取りの変更の 1 行（ticket_messages の kind change）の changes を読んで、どの行か・中身・開く先・畳むかを決める（ticket-rows-shape.ts）。ブラウザ・口は使わない。
//   行の形の正は口の葉 K-698（knowledge_open）・K-699（guard_list）・K-700（knowledge_breach）。
//   行 ID は 11_tickets/K-702.md の表。テストはチケットを作る人が書き、実装する人は変えない
import { describe, expect, it } from "vitest";
import {
  guardCounts,
  isExpanded,
  knowledgeFieldOf,
  pageHref,
  readBreach,
  readGuard,
  readOpened,
} from "../features/F9/knowledge/ticket-rows-shape";

const ID1 = "0193c5a0-0000-7000-8000-00000000a001";
const ID2 = "0193c5a0-0000-7000-8000-00000000a002";
const ID3 = "0193c5a0-0000-7000-8000-00000000a003";

describe("K702-UN", () => {
  it("K702-UN-001 knowledgeFieldOf：changes の最初の 1 要素の field が guard_list・knowledge_open・knowledge_breach のどれかなら、その名前。それ以外・空・配列でない・field が文字でないものは null（段 5・段 7 の欄と取り違えない）", () => {
    expect(knowledgeFieldOf([{ field: "guard_list" }])).toBe("guard_list");
    expect(knowledgeFieldOf([{ field: "knowledge_open" }])).toBe("knowledge_open");
    expect(knowledgeFieldOf([{ field: "knowledge_breach" }])).toBe("knowledge_breach");
    expect(knowledgeFieldOf([{ field: "test_spec" }])).toBeNull();
    expect(knowledgeFieldOf([{ field: "stage" }, { field: "guard_list" }])).toBeNull();
    expect(knowledgeFieldOf([])).toBeNull();
    expect(knowledgeFieldOf(null)).toBeNull();
    expect(knowledgeFieldOf({ field: "guard_list" })).toBeNull();
    expect(knowledgeFieldOf([{ field: 3 }])).toBeNull();
    expect(knowledgeFieldOf([null])).toBeNull();
  });

  it("K702-UN-002 readGuard：must と opened の各行から id・title・place が全部文字の物だけを読む（形の違う行は捨てる）・配列でない鍵は空・object でなければ null。元の値を書き換えない", () => {
    const change = {
      field: "guard_list",
      from: null,
      to: "2",
      note: null,
      must: [
        { id: ID1, title: "請求書の送り方", place: "会社 › 経理" },
        { id: ID2, title: "メールの書き方" },
        { id: 3, title: "数の id", place: "会社" },
        null,
      ],
      opened: [{ id: ID3, title: "単価の表", place: "会社 › 経理" }],
    };
    const before = JSON.stringify(change);
    expect(readGuard(change)).toEqual({
      must: [{ id: ID1, title: "請求書の送り方", place: "会社 › 経理" }],
      opened: [{ id: ID3, title: "単価の表", place: "会社 › 経理" }],
    });
    expect(JSON.stringify(change)).toBe(before);
    expect(readGuard({ field: "guard_list", must: "x", opened: null })).toEqual({ must: [], opened: [] });
    expect(readGuard({ field: "guard_list" })).toEqual({ must: [], opened: [] });
    expect(readGuard(null)).toBeNull();
    expect(readGuard("guard_list")).toBeNull();
  });

  it("K702-UN-003 readOpened：to が題名・note が場所・page_id がページ。note が無ければ場所は空の字・page_id が文字でなければ null・題名が文字でなければ行ごと null", () => {
    expect(
      readOpened({ field: "knowledge_open", from: null, to: "単価の表", note: "会社 › 経理", page_id: ID1 }),
    ).toEqual({
      page_id: ID1,
      title: "単価の表",
      place: "会社 › 経理",
    });
    expect(readOpened({ field: "knowledge_open", from: null, to: "単価の表", note: null, page_id: ID1 })).toEqual({
      page_id: ID1,
      title: "単価の表",
      place: "",
    });
    expect(readOpened({ field: "knowledge_open", to: "題", note: "場所" })).toEqual({
      page_id: null,
      title: "題",
      place: "場所",
    });
    expect(readOpened({ field: "knowledge_open", to: null, note: "場所", page_id: ID1 })).toBeNull();
    expect(readOpened(undefined)).toBeNull();
  });

  it("K702-UN-004 readBreach：from が出来事の種類（ai_unchecked・human_unchecked・ai_self_reported の 3 つだけ）・to が題名・note が理由（無ければ空の字）。知らない種類・題名が文字でない行は null", () => {
    for (const kind of ["ai_unchecked", "human_unchecked", "ai_self_reported"] as const)
      expect(
        readBreach({ field: "knowledge_breach", from: kind, to: "メールの書き方", note: null, page_id: ID1 }),
      ).toEqual({
        kind,
        title: "メールの書き方",
        note: "",
        page_id: ID1,
      });
    expect(
      readBreach({
        field: "knowledge_breach",
        from: "ai_self_reported",
        to: "メールの書き方",
        note: "件名に【請求書】が無い",
      }),
    ).toEqual({ kind: "ai_self_reported", title: "メールの書き方", note: "件名に【請求書】が無い", page_id: null });
    expect(readBreach({ field: "knowledge_breach", from: "other", to: "題", note: null })).toBeNull();
    expect(readBreach({ field: "knowledge_breach", from: null, to: "題", note: null })).toBeNull();
    expect(readBreach({ field: "knowledge_breach", from: "ai_unchecked", to: 5, note: null })).toBeNull();
    expect(readBreach(0)).toBeNull();
  });

  it("K702-UN-005 pageHref：uuid の形のときだけ /knowledge/<id>（小文字に直す）・それ以外（文字・javascript:・空・数・null・パスを含む字）は null で、リンクにしない", () => {
    expect(pageHref(ID1)).toBe(`/knowledge/${ID1}`);
    expect(pageHref(ID1.toUpperCase())).toBe(`/knowledge/${ID1}`);
    for (const bad of ["abc", "javascript:alert(1)", "", `${ID1}/../x`, `${ID1}?a=1`, 7, null, undefined, {}])
      expect(pageHref(bad), String(bad)).toBeNull();
  });

  it("K702-UN-006 guardCounts・isExpanded：畳んだ 1 行の字は「必ず守る N・開いたページ M」（個数は並びの長さ）。広げるのは並びのいちばん後ろの行だけ（後ろに 1 行でもあれば畳む）", () => {
    expect(guardCounts({ must: [1, 2, 3], opened: [1, 2] })).toBe("必ず守る 3・開いたページ 2");
    expect(guardCounts({ must: [], opened: [] })).toBe("必ず守る 0・開いたページ 0");
    expect(isExpanded(4, 5)).toBe(true);
    expect(isExpanded(3, 5)).toBe(false);
    expect(isExpanded(0, 1)).toBe(true);
    expect(isExpanded(0, 2)).toBe(false);
  });
});
