// K-694「管理 › 承認待ち」の単体の試験（画面の外の、決まった形だけ）：
//   口の答え → 一覧の行・日本時間の字・似たページの注意・管理の道と面の読み方・断る理由の確かめ・お知らせの字・行を消す（approvals-shape.ts）。ブラウザ・口は使わない。
//   行 ID は 11_tickets/K-694.md の表。テストはチケットを作る人が書き、実装する人は変えない
import { describe, expect, it } from "vitest";
import {
  adminHref,
  adminState,
  approvalAt,
  approvalItems,
  approveDoneText,
  declineProblem,
  isListReady,
  removeApproval,
  similarText,
} from "../features/F9/knowledge/approvals-shape";

type Answer = Parameters<typeof approvalItems>[0][number];
const ROW: Answer = {
  id: "r1",
  kind: "raise",
  from_name: "鈴木 一郎",
  from_shelf_name: "鈴木さんの「自分」",
  to_shelf_name: "営業",
  title: "値引きを頼まれたときの返し方",
  desc: "その場で返してよい範囲。",
  message: "営業の棚に上げたいです",
  requested_at: "2026-11-21T07:20:00Z",
  similar: { page_id: "p9", title: "値引きの決まり", place: "営業 › 見積もり" },
  body: { doc: { type: "doc", content: [] }, text: "" },
};

describe("K694-UN", () => {
  it("K694-UN-001 approvalAt・similarText・approvalItems：日本時間の「月/日 時:分」（UTC の日付をまたぐ時刻も）・似たページの注意の字・口の鍵（from_name・from_shelf_name・to_shelf_name・desc・requested_at・message・similar・body）から部品の行（from・fromShelf・toShelf・at・message・similar）への組み替え（ひとこと無しは message を持たず、似たページ無しは similar を持たない）", () => {
    expect(approvalAt("2026-11-21T07:20:00Z")).toBe("11/21 16:20");
    expect(approvalAt("2026-11-21T16:05:00Z")).toBe("11/22 01:05");
    expect(approvalAt("2026-12-31T15:00:00Z")).toBe("1/1 00:00");
    expect(similarText({ page_id: "p9", title: "値引きの決まり", place: "営業 › 見積もり" })).toBe(
      "営業 › 見積もり の「値引きの決まり」と似ています。先に並べて確かめてください。",
    );
    const [a, b] = approvalItems([ROW, { ...ROW, id: "r2", kind: "share", message: null, similar: null, body: null }]);
    expect(a).toMatchObject({
      id: "r1",
      kind: "raise",
      from: "鈴木 一郎",
      fromShelf: "鈴木さんの「自分」",
      toShelf: "営業",
      title: "値引きを頼まれたときの返し方",
      desc: "その場で返してよい範囲。",
      message: "営業の棚に上げたいです",
      at: "11/21 16:20",
      similar: "営業 › 見積もり の「値引きの決まり」と似ています。先に並べて確かめてください。",
    });
    expect(b).toMatchObject({ id: "r2", kind: "share" });
    expect("message" in b!).toBe(false);
    expect("similar" in b!).toBe(false);
  });

  it("K694-UN-002 adminState・adminHref：管理の道 /knowledge?view=admin&list=<一覧> と、道の読み方（view が admin のときだけ管理の面・list が review のときだけ見直すページ・それ以外は木の面と承認待ち）", () => {
    expect(adminHref("approvals")).toBe("/knowledge?view=admin&list=approvals");
    expect(adminHref("review")).toBe("/knowledge?view=admin&list=review");
    expect(adminState({ view: "admin", list: "approvals" })).toEqual({ view: "admin", list: "approvals" });
    expect(adminState({ view: "admin", list: "review" })).toEqual({ view: "admin", list: "review" });
    expect(adminState({ view: "admin", list: "zzz" })).toEqual({ view: "admin", list: "approvals" });
    expect(adminState({ view: "admin", list: null })).toEqual({ view: "admin", list: "approvals" });
    expect(adminState({ view: "zzz", list: "review" })).toEqual({ view: "pages", list: "review" });
    expect(adminState({ view: null, list: null })).toEqual({ view: "pages", list: "approvals" });
    expect(isListReady("approvals", ["approvals"])).toBe(true);
    expect(isListReady("review", ["approvals"])).toBe(false);
    expect(isListReady("review", ["approvals", "review"])).toBe(true);
  });

  it("K694-UN-003 declineProblem・approveDoneText・removeApproval：断る理由の確かめ（空白だけ＝全角の空白も「理由を入れてください」・1,000 字を超えたら「理由は 1,000 字までです」・コードポイントで数える・ちょうど 1,000 字は通る）・承認のお知らせの字・行を消す（新しい並びを返し元は変えない）", () => {
    expect(declineProblem("")).toBe("理由を入れてください");
    expect(declineProblem(" 　\n ")).toBe("理由を入れてください");
    expect(declineProblem("あ".repeat(1000))).toBeNull();
    expect(declineProblem("あ".repeat(1001))).toBe("理由は 1,000 字までです");
    expect(declineProblem("𠮷".repeat(1000))).toBeNull();
    expect(declineProblem("𠮷".repeat(1001))).toBe("理由は 1,000 字までです");
    expect(declineProblem("似たページがあります")).toBeNull();
    expect(approveDoneText("請求書の送り方")).toBe("「請求書の送り方」を承認しました。");
    const list = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const next = removeApproval(list, "b");
    expect(next.map((x) => x.id)).toEqual(["a", "c"]);
    expect(list.map((x) => x.id)).toEqual(["a", "b", "c"]);
    expect(removeApproval(list, "zz")).toEqual(list);
  });
});
