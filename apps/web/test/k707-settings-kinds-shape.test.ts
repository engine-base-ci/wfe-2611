// K-707「チケットの設定の画面の入れ物と種別」の単体の試験（画面の外の、決まった形だけ）：
//   口の答え → 部品の値と保存の差分（kinds-shape.ts）・タブの決め方（settings-tabs.ts）。ブラウザ・口は使わない。
//   行 ID は 11_tickets/K-707.md の表。テストはチケットを作る人が書き、実装する人は変えない
import { describe, expect, it } from "vitest";
import {
  isEmptyDoc,
  kindDraftOf,
  kindPatch,
  nameProblem,
  pickKind,
  shapeKinds,
} from "../features/F9/settings/kinds-shape";
import { isInertTab, tabOf } from "../features/F9/settings/settings-tabs";

type KindIn = Parameters<typeof shapeKinds>[0][number];
const doc = (...content: unknown[]) => ({ type: "doc" as const, content });
const para = (text?: string) => ({ type: "paragraph", ...(text ? { content: [{ type: "text", text }] } : {}) });
const kind = (over: Partial<KindIn> = {}): KindIn =>
  ({
    id: "k1",
    name: "請求",
    color: "#112233",
    color_key: "teal",
    position: 20,
    is_builtin: false,
    body_template: doc(para("書く")),
    fields: [],
    ...over,
  }) as KindIn;

describe("K707-UN", () => {
  it("K707-UN-001 shapeKinds：並びは position の昇順・色は color_key（無い・知らない鍵は indigo）・ひな形は null と空の文書（段落だけで字が無い）が「なし」", () => {
    const rows = shapeKinds([
      kind({ id: "b", name: "B", position: 30, color_key: "nonsense", body_template: null }),
      kind({ id: "a", name: "A", position: 10, color_key: "plum" }),
      kind({
        id: "c",
        name: "C",
        position: 20,
        color_key: undefined as unknown as string,
        body_template: doc(para(), para()),
      }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(["a", "c", "b"]);
    expect(rows.map((r) => r.tone)).toEqual(["plum", "indigo", "indigo"]);
    expect(rows.map((r) => r.hasTemplate)).toEqual([true, false, false]);
    expect(isEmptyDoc(doc())).toBe(true);
    expect(isEmptyDoc(doc(para("あ")))).toBe(false);
  });

  it("K707-UN-002 kindPatch：変えた欄だけ返す（変えていなければ空）・名前は前後の空白（全角も）を落として比べる・ひな形は文書が同じなら含めず、空にしたら null", () => {
    const base = kind();
    const same = kindDraftOf(base);
    expect(kindPatch(base, same)).toEqual({});
    expect(kindPatch(base, { ...same, name: "　請求　" })).toEqual({});
    expect(kindPatch(base, { ...same, name: "　請求書　" })).toEqual({ name: "請求書" });
    expect(kindPatch(base, { ...same, tone: "coral" })).toEqual({ color_key: "coral" });
    expect(kindPatch(base, { ...same, template: doc(para("別の字")) })).toEqual({ body_template: doc(para("別の字")) });
    expect(kindPatch(base, { ...same, template: doc(para()) })).toEqual({ body_template: null });
    expect(
      kindPatch(kind({ body_template: null }), { ...kindDraftOf(kind({ body_template: null })), template: doc() }),
    ).toEqual({});
    expect(kindPatch(base, { name: "新", tone: "sage", template: null })).toEqual({
      name: "新",
      color_key: "sage",
      body_template: null,
    });
  });

  it("K707-UN-003 nameProblem：空・全角空白だけは「名前を入れてください」・41 字は「名前は 40 字までです」・40 字は null・字は文字（絵文字 1 つは 1 字）で数える", () => {
    expect(nameProblem("", 40)).toBe("名前を入れてください");
    expect(nameProblem("　 　", 40)).toBe("名前を入れてください");
    expect(nameProblem("あ".repeat(41), 40)).toBe("名前は 40 字までです");
    expect(nameProblem("あ".repeat(40), 40)).toBeNull();
    expect(nameProblem("😀".repeat(40), 40)).toBeNull();
    expect(nameProblem("　" + "あ".repeat(40) + "　", 40)).toBeNull();
  });

  it("K707-UN-004 tabOf・pickKind：タブは kinds・stages・fields 以外（無い・知らない値）なら kinds・選ぶ種別は id が合う物（無い・知らない id なら先頭・種別が 0 なら undefined）", () => {
    expect(["stages", "fields", "kinds", "x", undefined].map((v) => tabOf(v))).toEqual([
      "stages",
      "fields",
      "kinds",
      "kinds",
      "kinds",
    ]);
    const rows = shapeKinds([kind({ id: "a", position: 1 }), kind({ id: "b", position: 2 })]);
    expect(pickKind(rows, "b")?.id).toBe("b");
    expect(pickKind(rows, "zzz")?.id).toBe("a");
    expect(pickKind(rows, undefined)?.id).toBe("a");
    expect(pickKind([], "a")).toBeUndefined();
  });

  it("K707-UN-005 isInertTab：種別はいつも動く・状態と項目は後ろの葉が入れた物（登録がある）だけ動き、無ければ押せない形", () => {
    const X = () => null;
    expect(isInertTab({}, "kinds")).toBe(false);
    expect(isInertTab({}, "stages")).toBe(true);
    expect(isInertTab({}, "fields")).toBe(true);
    expect(isInertTab({ stages: X }, "stages")).toBe(false);
    expect(isInertTab({ stages: X }, "fields")).toBe(true);
    expect(isInertTab({ stages: X, fields: X }, "fields")).toBe(false);
  });
});
