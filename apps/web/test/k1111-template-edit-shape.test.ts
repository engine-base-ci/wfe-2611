// K-1111「ひな形の新しい版の中身を直す頁」の画面の外の試験：今の版の items と直し（Edits）→ 出す items・差の字・下書きの戻し・足す鍵
//   （features/F12/ops2/template-edit-shape.ts）。純粋な関数だけ（ブラウザ・口は使わない）。
//   行 ID は 11_tickets/K-1111.md の表。テストはチケットを作る人が書き、実装する人は変えない
import { describe, expect, it } from "vitest";
import { diffLines, itemsOf, loadDraft, newKey, reasonOf, type Edits } from "../features/F12/ops2/template-edit-shape";

const doc = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
const CURRENT = [
  { key: "task", name: "タスク", color_key: "teal", body_template: doc("やること・期限・確かめること") },
  { key: "qa", name: "QA", color_key: "lavender", body_template: doc("確かめる所") },
  { key: "issue", name: "課題", color_key: "amber", body_template: doc("困っていること") },
  { key: "meeting", name: "会議", color_key: "indigo", body_template: doc("議題") },
  { key: "memo", name: "メモ", color_key: "sage", body_template: doc("書いておくこと") },
];
const EDITS: Edits = {
  base: 3,
  changes: {
    qa: { kind: "edit", item: { ...CURRENT[1]!, body_template: doc("確かめる所・再現の手順・期待") } },
    issue: { kind: "edit", item: { ...CURRENT[2]!, body_template: doc("困っていること・影響・次の手") } },
    meeting: { kind: "edit", item: { ...CURRENT[3]!, body_template: doc("議題・決めたこと・議事録のリンク") } },
    memo: { kind: "delete" },
  },
  added: [{ key: "x_estimate", name: "見積", color_key: "plum", body_template: doc("範囲・金額・期限") }],
};

describe("K-1111 直す形", () => {
  it("K1111-UN-001 itemsOf：今の版の並びのまま・消した物を外す・直した物を置き換える・足した物を最後に", () => {
    const items = itemsOf(CURRENT, EDITS);
    expect(items.map((i) => i.key)).toEqual(["task", "qa", "issue", "meeting", "x_estimate"]);
    expect(items[1]).toEqual({ ...CURRENT[1], body_template: doc("確かめる所・再現の手順・期待") });
    expect(items[0]).toEqual(CURRENT[0]);
    expect(itemsOf(CURRENT, { base: 3, changes: {}, added: [] })).toEqual(CURRENT);
  });

  it("K1111-UN-002 diffLines：足す・直す・消すの 3 行（無い種類は行が無い）・理由は「／」でつなぎ 500 字で切る", () => {
    const lines = diffLines("種別", CURRENT, EDITS);
    expect(lines).toEqual([
      "足す：種別「見積」",
      "直す：種別「QA」「課題」「会議」",
      "消す：種別「メモ」（使っているワークスペースの「メモ」はそのまま残る）",
    ]);
    expect(diffLines("種別", CURRENT, { base: 3, changes: { memo: { kind: "delete" } }, added: [] })).toEqual([
      "消す：種別「メモ」（使っているワークスペースの「メモ」はそのまま残る）",
    ]);
    expect(diffLines("種別", CURRENT, { base: 3, changes: {}, added: [] })).toEqual([]);
    const many: Edits = {
      base: 3,
      changes: {},
      added: Array.from({ length: 80 }, (_, i) => ({
        key: `x${i}`,
        name: `とても長い種別の名前 ${i}`,
        color_key: "teal",
        body_template: null,
      })),
    };
    const reason = reasonOf(diffLines("種別", CURRENT, many));
    expect(reason.length).toBe(500);
    expect(reasonOf(lines)).toBe(lines.join("／"));
  });

  it("K1111-UN-003 loadDraft：base が今の版と同じなら戻す・違う・壊れた JSON・空なら null", () => {
    const raw = JSON.stringify({ edits: EDITS, saved_at: "2026-11-05T05:20:00Z", by: "佐野" });
    expect(loadDraft(raw, 3)).toEqual({ edits: EDITS, saved_at: "2026-11-05T05:20:00Z", by: "佐野" });
    expect(loadDraft(raw, 4)).toBeNull();
    expect(loadDraft("{壊れた", 3)).toBeNull();
    expect(loadDraft(null, 3)).toBeNull();
  });

  it("K1111-UN-004 newKey：英小文字で始まる 40 字までの鍵・今の版と足した物の鍵と重ならない（100 回作って全部ちがう）", () => {
    const taken = new Set(CURRENT.map((c) => c.key));
    for (let i = 0; i < 100; i++) {
      const k = newKey(taken);
      expect(k).toMatch(/^[a-z][a-z0-9_]{0,39}$/);
      expect(taken.has(k)).toBe(false);
      taken.add(k);
    }
    expect(taken.size).toBe(CURRENT.length + 100);
  });
});
