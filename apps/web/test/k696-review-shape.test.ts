// K-696「管理 › 見直すページ」の単体の試験（画面の外の、決まった形だけ）：
//   口の答え（3 つの並び）→ 部品の行・AI が最後に開いた日の字（日本時間）・ページを開く道（書き方を直すは ?edit=1）・50 件の注記・空の字・書き始める条件
//   行 ID は 11_tickets/K-696.md の表。テストはチケットを作る人が書き、実装する人は変えない
import { describe, expect, it } from "vitest";
import {
  REVIEW_LIMIT,
  capNote,
  lastOpenedText,
  reviewEmptyText,
  reviewPageHref,
  reviewRows,
  startsEditing,
} from "../features/F9/knowledge/review-shape";

type Answer = Parameters<typeof reviewRows>[0];
const ANSWER: Answer = {
  unused: [
    { id: "u1", title: "年賀状の送り先", place: "会社 › お客さま対応", last_opened_at: "2025-12-20T03:00:00Z" },
    { id: "u2", title: "旧：見積書のひな形（2024）", place: "営業 › 見積もり", last_opened_at: null },
  ],
  conflicts: [
    {
      id: "p1:p2",
      upper: { id: "p1", title: "請求書の送り方", place: "会社 › 経理" },
      lower: { id: "p2", title: "見積書の出し方", place: "営業 › 見積もり" },
      point: "支払期日：会社は「月末締め」、営業は「翌々月 10 日払い」と書いてあります",
    },
  ],
  broken: [
    { id: "b1", title: "メールの書き方", place: "会社", count: 7, how: "いちばん多い：件名に【 】が無い（5 回）" },
  ],
};

describe("K696-UN", () => {
  it("K696-UN-001 lastOpenedText：日本時間の「yyyy/mm/dd」（UTC の日付をまたぐ時刻も）・1 度も開かれていない（null）は「1 度も無い」・字は「AI が最後に開いた：…」", () => {
    expect(lastOpenedText("2025-12-20T03:00:00Z")).toBe("AI が最後に開いた：2025/12/20");
    expect(lastOpenedText("2026-06-01T15:30:00Z")).toBe("AI が最後に開いた：2026/06/02");
    expect(lastOpenedText("2026-12-31T14:59:59Z")).toBe("AI が最後に開いた：2026/12/31");
    expect(lastOpenedText("2026-12-31T15:00:00Z")).toBe("AI が最後に開いた：2027/01/01");
    expect(lastOpenedText(null)).toBe("AI が最後に開いた：1 度も無い");
  });

  it("K696-UN-002 reviewRows：口の鍵から部品の行へ組み替える（lastOpened・upperPlace・lowerPlace・count・how）。元の答えを書き換えず、空の並びは空のまま。食い違いの組は行の id から上下のページを引ける", () => {
    const before = JSON.stringify(ANSWER);
    const r = reviewRows(ANSWER);
    expect(r.unused).toEqual([
      { id: "u1", title: "年賀状の送り先", place: "会社 › お客さま対応", lastOpened: "AI が最後に開いた：2025/12/20" },
      {
        id: "u2",
        title: "旧：見積書のひな形（2024）",
        place: "営業 › 見積もり",
        lastOpened: "AI が最後に開いた：1 度も無い",
      },
    ]);
    expect(r.conflicts).toEqual([
      {
        id: "p1:p2",
        upper: "請求書の送り方",
        upperPlace: "会社 › 経理",
        lower: "見積書の出し方",
        lowerPlace: "営業 › 見積もり",
        point: "支払期日：会社は「月末締め」、営業は「翌々月 10 日払い」と書いてあります",
      },
    ]);
    expect(r.broken).toEqual([
      { id: "b1", title: "メールの書き方", place: "会社", count: 7, how: "いちばん多い：件名に【 】が無い（5 回）" },
    ]);
    expect(r.pairs["p1:p2"]).toEqual({ upperId: "p1", lowerId: "p2" });
    expect(JSON.stringify(ANSWER), "元の答えを書き換えない").toBe(before);
    expect(reviewRows({ unused: [], conflicts: [], broken: [] })).toMatchObject({
      unused: [],
      conflicts: [],
      broken: [],
      pairs: {},
    });
  });

  it("K696-UN-003 reviewPageHref・capNote・startsEditing・reviewEmptyText：開く道は /knowledge/<id>・書き方を直すは ?edit=1・50 件ちょうどの並びだけに注記・書き始めるのは edit=1 で書ける人だけ・空の字は一覧ごと", () => {
    expect(reviewPageHref("p1")).toBe("/knowledge/p1");
    expect(reviewPageHref("p1", true)).toBe("/knowledge/p1?edit=1");
    expect(REVIEW_LIMIT).toBe(50);
    expect(capNote(49)).toBeNull();
    expect(capNote(50)).toBe("多い順に 50 件まで出しています。");
    expect(capNote(0)).toBeNull();
    expect(startsEditing("?edit=1", true)).toBe(true);
    expect(startsEditing("?edit=1", false)).toBe(false);
    expect(startsEditing("?edit=0", true)).toBe(false);
    expect(startsEditing("", true)).toBe(false);
    expect(startsEditing("?x=1&edit=1", true)).toBe(true);
    expect(reviewEmptyText("unused")).toBe("使われていないページはありません");
    expect(reviewEmptyText("conflicts")).toBe("食い違っているページはありません");
    expect(reviewEmptyText("broken")).toBe("よく破られる決まりはありません");
  });
});
