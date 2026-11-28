// K-692「上の棚に上げる」の単体の試験（画面の外の、決まった形だけ）：
//   上げる先のフォルダの選び・承認する人の字・帯の字・頼む体・ひとことの確かめ・帯の動きの差し込み（raise-shape.ts・page-slots.ts）。ブラウザ・口は使わない。
//   行 ID は 11_tickets/K-692.md の表。テストはチケットを作る人が書き、実装する人は変えない
import { describe, expect, it } from "vitest";
import { isInert, mergeSlots } from "../features/F9/knowledge/page-slots";
import {
  approverText,
  bandAt,
  bandWho,
  messageProblem,
  raiseBody,
  raiseDoneText,
  raiseFolderChoices,
} from "../features/F9/knowledge/raise-shape";

const folder = (id: string, name: string, children: unknown[] = []) => ({ kind: "folder", id, name, children });
const page = (id: string, title: string) => ({ kind: "page", id, title, must: false, mark: null });
const TREE = {
  company_name: "ENGINE BASE",
  company_nodes: [folder("c1", "経理", [folder("c2", "請求")]), page("p0", "メール")],
  groups: [
    {
      id: "g1",
      name: "営業",
      nodes: [folder("a1", "見積もり", [folder("a2", "古い"), page("p1", "見積書")]), page("p2", "訪問")],
    },
    { id: "g2", name: "受託開発", nodes: [folder("d1", "開発")] },
  ],
} as unknown as Parameters<typeof raiseFolderChoices>[0];

describe("K692-UN", () => {
  it("K692-UN-001 raiseFolderChoices：先頭は棚の直下（root・「営業（いちばん上）」「会社（いちばん上）」）・上げる先の棚のフォルダだけを木の順に・入れ子は「見積もり › 古い」・別のグループや会社のフォルダは出さない", () => {
    expect(raiseFolderChoices(TREE, { shelf: "group", shelf_name: "営業", group_id: "g1" })).toEqual([
      { value: "root", label: "営業（いちばん上）" },
      { value: "a1", label: "見積もり" },
      { value: "a2", label: "見積もり › 古い" },
    ]);
    expect(raiseFolderChoices(TREE, { shelf: "company", shelf_name: "会社", group_id: null })).toEqual([
      { value: "root", label: "会社（いちばん上）" },
      { value: "c1", label: "経理" },
      { value: "c2", label: "経理 › 請求" },
    ]);
    expect(raiseFolderChoices(TREE, { shelf: "group", shelf_name: "営業", group_id: "無い" })).toEqual([
      { value: "root", label: "営業（いちばん上）" },
    ]);
  });

  it("K692-UN-002 approverText・bandWho・bandAt：承認する人は「佐藤 花子さん（営業のマネージャー）」（複数は「・」でつなぐ・会社は管理者・0 人は「ほかにいません」）・帯の相手は同じ形・日時は日本時間の「月/日 時:分」", () => {
    expect(approverText(["佐藤 花子"], "group", "営業")).toBe("佐藤 花子さん（営業のマネージャー）");
    expect(approverText(["佐藤 花子", "田中 美咲"], "group", "営業")).toBe(
      "佐藤 花子さん・田中 美咲さん（営業のマネージャー）",
    );
    expect(approverText(["高本 聖斗"], "company", "会社")).toBe("高本 聖斗さん（管理者）");
    expect(approverText([], "group", "営業")).toBe("ほかにいません");
    expect(bandWho({ who_name: "佐藤 花子", to_name: "営業" })).toBe("佐藤 花子さん（営業のマネージャー）");
    expect(bandWho({ who_name: "高本 聖斗", to_name: "会社" })).toBe("高本 聖斗さん（管理者）");
    expect(bandAt("2026-11-21T07:20:00Z")).toBe("11/21 16:20");
    expect(bandAt("2026-11-30T16:05:00Z")).toBe("12/1 01:05");
  });

  it("K692-UN-003 raiseBody・messageProblem・raiseDoneText：グループは自分の棚のページのときだけ送る・棚の直下は folder_id を送らない・ひとことは前後の空白を落とし空なら送らない・1,000 字を超えると問題の文・答えの state でお知らせの文が変わる", () => {
    expect(raiseBody({ groupId: "g1", folder: "a1", message: " 営業に上げたい " })).toEqual({
      group_id: "g1",
      folder_id: "a1",
      message: "営業に上げたい",
    });
    expect(raiseBody({ groupId: null, folder: "root", message: "　" })).toEqual({});
    expect(messageProblem("あ".repeat(1000))).toBeNull();
    expect(messageProblem("あ".repeat(1001))).toBe("ひとことは 1,000 字までです");
    expect(messageProblem("")).toBeNull();
    expect(raiseDoneText("pending", "営業")).toBe("上げるのを頼みました。承認されるとページが移ります");
    expect(raiseDoneText("approved", "営業")).toBe("ページを営業の棚に上げました");
  });

  it("K692-UN-004 mergeSlots の帯の動き（bands）：取り下げる・消す・直してもう一度頼むの動きが 1 つにまとまる（同じ操作は先の物）・無い操作は押せない形（isInert の band）", () => {
    const calls: string[] = [];
    const none = mergeSlots([]);
    expect(none.bands).toEqual({});
    expect(isInert(none, "band", "withdraw")).toBe(true);
    const m = mergeSlots([
      { bands: { withdraw: () => calls.push("a") } },
      { bands: { withdraw: () => calls.push("b"), dismiss: () => calls.push("c") } },
    ]);
    expect(isInert(m, "band", "withdraw")).toBe(false);
    expect(isInert(m, "band", "dismiss")).toBe(false);
    expect(isInert(m, "band", "redo")).toBe(true);
    m.bands["withdraw"]?.("id");
    m.bands["dismiss"]?.("id");
    expect(calls).toEqual(["a", "c"]);
  });
});
