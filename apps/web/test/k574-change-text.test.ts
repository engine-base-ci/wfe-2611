// K-574「やり取りの更新の行の文（段 5 の分）」の純粋な部分の試験。行 ID は 11_tickets/K-574.md の行の表（K574-UN-001〜008）。
//   文は「〈名前〉が」の後ろだけを返す（名前と「が」は段 7 の流れの部品が付ける）。知らない欄は null（段 7 の字に落とす）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { describe, expect, it } from "vitest";
import { stage5ChangeText, type ChangeCtx, type ChangeEntry } from "@/features/F4/thread-lines/change-text";

const FID = "6f000000-0000-4000-8000-000000000001";
const ctx: ChangeCtx = { fieldName: (id: string) => (id === FID ? "部署" : null) };
const t = (c: ChangeEntry, x: ChangeCtx = ctx) => stage5ChangeText(c, x);
const spec = (from: unknown, to: unknown, note?: string): ChangeEntry =>
  ({ field: "test_spec", from, to, ...(note === undefined ? {} : { note }) }) as ChangeEntry;

describe("K-574 更新の行の文", () => {
  it("K574-UN-001 確認項目の 5 つの動き：足した・チェックを付けた・外した・文を直した・行を外した", () => {
    expect(t(spec(null, "承認する人が中身を見る"))).toBe("確認項目を足しました：承認する人が中身を見る");
    expect(t(spec(false, true, "PDF の合計が請求額と合う"))).toBe(
      "確認項目『PDF の合計が請求額と合う』にチェックを付けました",
    );
    expect(t(spec(true, false, "PDF の合計が請求額と合う"))).toBe(
      "確認項目『PDF の合計が請求額と合う』のチェックを外しました",
    );
    expect(t(spec("宛名を確かめる", "請求書の宛名を確かめる"))).toBe("確認項目『請求書の宛名を確かめる』を直しました");
    expect(t(spec("宛名を確かめる", null))).toBe("確認項目『宛名を確かめる』を外しました");
  });
  it("K574-UN-002 本文の 2 つの動き：直した・版 N に戻した（note の「版 N に戻した」から）。note が形違いなら「直した」", () => {
    expect(t({ field: "body", from: 3, to: 4 })).toBe("本文を直しました");
    expect(t({ field: "body", from: 3, to: 4, note: "版 1 に戻した" })).toBe("本文を版 1 に戻しました");
    expect(t({ field: "body", from: 3, to: 4, note: "なにか別の字" })).toBe("本文を直しました");
  });
  it("K574-UN-003 会社の項目：「〈名前〉を a → b に変えました」・空は（空）・チェックの字はそのまま・40 字で切って「…」", () => {
    expect(t({ field: `field:${FID}`, from: "営業", to: "開発" })).toBe("部署を 営業 → 開発 に変えました");
    expect(t({ field: `field:${FID}`, from: null, to: "開発" })).toBe("部署を （空） → 開発 に変えました");
    expect(t({ field: `field:${FID}`, from: "営業", to: null })).toBe("部署を 営業 → （空） に変えました");
    expect(t({ field: `field:${FID}`, from: "チェックなし", to: "チェックあり" })).toBe(
      "部署を チェックなし → チェックあり に変えました",
    );
    const long = "あ".repeat(60);
    expect(t({ field: `field:${FID}`, from: null, to: long })).toBe(`部署を （空） → ${"あ".repeat(40)}… に変えました`);
    expect(t({ field: `field:${FID}`, from: null, to: "あ".repeat(40) })).toBe(
      `部署を （空） → ${"あ".repeat(40)} に変えました`,
    );
  });
  it("K574-UN-004 名前が引けない項目（消された・詳細に無い）は「会社の項目」の字で出す", () => {
    expect(t({ field: "field:6f000000-0000-4000-8000-0000000000ff", from: "a", to: "b" })).toBe(
      "会社の項目を a → b に変えました",
    );
  });
  it("K574-UN-005 固定の欄（担当者・期限・開始日・優先度・予定時間・親）は書く側の字のまま「〈欄〉を a → b に変えました」。段 7 の欄・知らない欄は null（段 7 の字に落とす）", () => {
    expect(t({ field: "assignee", from: "佐藤", to: "高本" })).toBe("担当者を 佐藤 → 高本 に変えました");
    expect(t({ field: "due_on", from: "11/27", to: "12/01" })).toBe("期限を 11/27 → 12/01 に変えました");
    expect(t({ field: "start_on", from: null, to: "11/21" })).toBe("開始日を （空） → 11/21 に変えました");
    expect(t({ field: "priority", from: "中", to: "高" })).toBe("優先度を 中 → 高 に変えました");
    expect(t({ field: "estimate_minutes", from: "1 時間", to: "2 時間" })).toBe(
      "予定時間を 1 時間 → 2 時間 に変えました",
    );
    expect(t({ field: "parent", from: null, to: "EG-100" })).toBe("親を （空） → EG-100 に変えました");
    for (const f of ["stage", "actual_minutes", "hold_reason", "resume_condition", "decision", "なにか新しい欄"])
      expect(t({ field: f, from: "a", to: "b" })).toBeNull();
  });
  it("K574-UN-006 壊れた値でも落ちない：from・to が数・真偽・object・配列でも字にして返す（object は「（読めない値）」）。test_spec で文が無いチェックは文なしの形", () => {
    expect(t({ field: `field:${FID}`, from: 3, to: true })).toBe("部署を 3 → true に変えました");
    expect(t({ field: `field:${FID}`, from: { a: 1 }, to: ["x"] })).toBe(
      "部署を （読めない値） → （読めない値） に変えました",
    );
    expect(t(spec(false, true))).toBe("確認項目にチェックを付けました");
    expect(t(spec("true", "false", "文"))).toBe("確認項目『文』のチェックを外しました");
  });
  it("K574-UN-007 規則の表に足せる：extra の規則（ほかの葉が足す見本の規則）が先に当たり、当たらなければ段 5 の規則・それも無ければ null", () => {
    const extra = [
      {
        id: "restore-items",
        match: (c: ChangeEntry) => c.field === "items",
        text: () => "項目を版 2 の値に戻しました",
      },
    ];
    expect(stage5ChangeText({ field: "items", from: null, to: null }, ctx, extra)).toBe("項目を版 2 の値に戻しました");
    expect(stage5ChangeText({ field: "body", from: 1, to: 2 }, ctx, extra)).toBe("本文を直しました");
    expect(stage5ChangeText({ field: "zzz", from: 1, to: 2 }, ctx, extra)).toBeNull();
  });
  it("K574-UN-008 項目を戻したまとめの行（K-576 が書く item_restore）：from の版の番号で「項目を版 N の形に戻しました」・番号でなければ「項目を戻しました」・値の字を入れない", () => {
    expect(t({ field: "item_restore", from: "2", to: "5", note: "点 2 の形に戻した" })).toBe(
      "項目を版 2 の形に戻しました",
    );
    expect(t({ field: "item_restore", from: "12", to: "13", note: "点 12 の形に戻した" })).toBe(
      "項目を版 12 の形に戻しました",
    );
    expect(t({ field: "item_restore", from: null, to: "5" })).toBe("項目を戻しました");
    expect(t({ field: "item_restore", from: "あ", to: "5", note: "<b>x</b>" })).toBe("項目を戻しました");
  });
});
