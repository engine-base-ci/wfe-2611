// K-709「チケットの設定の「項目」」の単体の試験（画面の外の、決まった形だけ）：
//   口の答え → 部品の値・保存の差分・入力の確かめ・選ぶ物の並べ直し・足す／消すの差し込み口（fields-shape.ts・fields-slots.ts）。ブラウザ・口は使わない。
//   行 ID は 11_tickets/K-709.md の表。テストはチケットを作る人が書き、実装する人は変えない
import { describe, expect, it } from "vitest";
import {
  addOption,
  fieldDraftOf,
  fieldPatch,
  fieldProblems,
  moveOption,
  removeOption,
  shapeFields,
  typeKey,
  typeLabel,
} from "../features/F9/settings/fields-shape";
import { isInertField } from "../features/F9/settings/fields-slots";

type FieldIn = Parameters<typeof shapeFields>[0][number];
const KINDS = [{ id: "k1" }, { id: "k2" }, { id: "k3" }];
const ALL = KINDS.map((k) => k.id);
const field = (over: Partial<FieldIn> = {}): FieldIn =>
  ({
    id: "f1",
    name: "PJコード",
    field_type: "select",
    required: true,
    description: "どの案件か",
    options: [
      { id: "o2", name: "社内", position: 2 },
      { id: "o1", name: "セイコー", position: 1 },
    ],
    position: 10,
    kind_ids: ["k1", "k2"],
    all_kinds: false,
    value_count: 3,
    ...over,
  }) as FieldIn;

describe("K709-UN", () => {
  it("K709-UN-001 shapeFields：position の昇順・型は字（1 行・複数行・数・日付・1 つ選ぶ・複数選ぶ・チェック）・選ぶ物は並びの順の名前（選ぶ型だけ）・説明は null が空の字・all_kinds は今ある全部の種別に出る", () => {
    const rows = shapeFields(
      [
        field({ id: "b", position: 30, field_type: "check", options: [], description: null }),
        field({ id: "a", position: 10 }),
        field({ id: "c", position: 20, kind_ids: [], all_kinds: true, field_type: "long_text", options: [] }),
      ],
      KINDS,
    );
    expect(rows.map((r) => r.id)).toEqual(["a", "c", "b"]);
    expect(rows.map((r) => r.type)).toEqual(["1 つ選ぶ", "複数行", "チェック"]);
    expect(rows[0]!.options).toEqual(["セイコー", "社内"]);
    expect(rows[1]!.options).toBeUndefined();
    expect(rows[2]!.desc).toBe("");
    expect(rows[1]!.kinds).toEqual(ALL);
    expect(rows[0]!.kinds).toEqual(["k1", "k2"]);
    const labels = ["short_text", "long_text", "number", "date", "select", "multi_select", "check"].map(typeLabel);
    expect(labels).toEqual(["1 行", "複数行", "数", "日付", "1 つ選ぶ", "複数選ぶ", "チェック"]);
    expect(labels.map(typeKey)).toEqual([
      "short_text",
      "long_text",
      "number",
      "date",
      "select",
      "multi_select",
      "check",
    ]);
  });

  it("K709-UN-002 fieldPatch：変えた欄だけ・何も変えなければ空・説明は空の字が null・種別は今ある全部のままなら含めず、変えたら全部の種別の並びで返す・選ぶ物は id を引き継ぎ新しい物は id なし", () => {
    const base = field();
    const d = fieldDraftOf(base, ALL);
    expect(fieldPatch(base, d, ALL)).toEqual({});
    expect(fieldPatch(base, { ...d, name: "　案件　" }, ALL)).toEqual({ name: "案件" });
    expect(fieldPatch(base, { ...d, required: false }, ALL)).toEqual({ required: false });
    expect(fieldPatch(base, { ...d, description: "" }, ALL)).toEqual({ description: null });
    expect(fieldPatch(base, { ...d, description: "　" }, ALL)).toEqual({ description: null });
    expect(fieldPatch(base, { ...d, kindIds: ["k3", "k1"] }, ALL)).toEqual({ kind_ids: ["k1", "k3"] });
    expect(
      fieldPatch(
        base,
        { ...d, options: [{ id: "o1", name: "セイコー" }, { id: "o2", name: "社内" }, { name: "新規" }] },
        ALL,
      ),
    ).toEqual({
      options: [{ id: "o1", name: "セイコー" }, { id: "o2", name: "社内" }, { name: "新規" }],
    });
    expect(
      fieldPatch(
        base,
        {
          ...d,
          options: [
            { id: "o2", name: "社内" },
            { id: "o1", name: "セイコー" },
          ],
        },
        ALL,
      ),
    ).toEqual({
      options: [
        { id: "o2", name: "社内" },
        { id: "o1", name: "セイコー" },
      ],
    });
    const all = field({ kind_ids: [], all_kinds: true });
    expect(fieldPatch(all, fieldDraftOf(all, ALL), ALL)).toEqual({});
    expect(fieldPatch(all, { ...fieldDraftOf(all, ALL), kindIds: ["k1"] }, ALL)).toEqual({ kind_ids: ["k1"] });
  });

  it("K709-UN-003 fieldPatch の型：型を変えたら field_type を返す・選ぶ型でなくす時は options を送らない・新しい型が選ぶ型なら options を必ず一緒に送る（選ぶ型どうしの変更も今の選ぶ物を id つきで）", () => {
    const num = field({ id: "n", field_type: "number", options: [], value_count: 0 });
    const dn = fieldDraftOf(num, ALL);
    expect(fieldPatch(num, { ...dn, type: "date" }, ALL)).toEqual({ field_type: "date" });
    expect(fieldPatch(num, { ...dn, type: "select", options: [{ name: "A" }, { name: "B" }] }, ALL)).toEqual({
      field_type: "select",
      options: [{ name: "A" }, { name: "B" }],
    });
    const sel = field();
    expect(fieldPatch(sel, { ...fieldDraftOf(sel, ALL), type: "short_text" }, ALL)).toEqual({
      field_type: "short_text",
    });
    expect(fieldPatch(sel, { ...fieldDraftOf(sel, ALL), type: "multi_select" }, ALL)).toEqual({
      field_type: "multi_select",
      options: [
        { id: "o1", name: "セイコー" },
        { id: "o2", name: "社内" },
      ],
    });
  });

  it("K709-UN-004 fieldProblems：名前（空・40 字まで）・選ぶ型で選ぶ物が 0 か空の名前か重なり・種別が 0 の問題の文。ほかの型は選ぶ物を見ない", () => {
    const d = fieldDraftOf(field(), ALL);
    expect(fieldProblems(d)).toEqual({});
    expect(fieldProblems({ ...d, name: "" }).name).toBe("名前を入れてください");
    expect(fieldProblems({ ...d, name: "あ".repeat(41) }).name).toBe("名前は 40 字までです");
    expect(fieldProblems({ ...d, options: [] }).options).toBe("選ぶ物を 1 つ以上入れてください");
    expect(fieldProblems({ ...d, options: [{ name: "A" }, { name: "　" }] }).options).toBe(
      "選ぶ物の名前を入れてください",
    );
    expect(fieldProblems({ ...d, options: [{ name: "A" }, { name: "A" }] }).options).toBe("同じ名前の選ぶ物があります");
    expect(fieldProblems({ ...d, options: [{ name: "あ".repeat(41) }] }).options).toBe("選ぶ物の名前は 40 字までです");
    expect(fieldProblems({ ...d, type: "number", options: [] })).toEqual({});
    expect(fieldProblems({ ...d, kindIds: [] }).kinds).toBe("出す種別を 1 つ以上選んでください");
  });

  it("K709-UN-005 選ぶ物の並べ直し：addOption は末尾に空の物・removeOption・moveOption は範囲の外と同じ場所を無視（元の配列を変えない）・isInertField（まとめた差し込み）は動きが無い操作を真にする", () => {
    const o = [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
      { id: "c", name: "C" },
    ];
    expect(addOption(o).map((x) => x.name)).toEqual(["A", "B", "C", ""]);
    expect(addOption(o)[3]!.id).toBeUndefined();
    expect(removeOption(o, 1).map((x) => x.name)).toEqual(["A", "C"]);
    expect(moveOption(o, 2, 0).map((x) => x.name)).toEqual(["C", "A", "B"]);
    expect(moveOption(o, 0, 1).map((x) => x.name)).toEqual(["B", "A", "C"]);
    expect(moveOption(o, 0, 0)).toEqual(o);
    expect(moveOption(o, 0, 9)).toEqual(o);
    expect(o.map((x) => x.name)).toEqual(["A", "B", "C"]);
    expect(isInertField({}, "add")).toBe(true);
    expect(isInertField({}, "delete")).toBe(true);
    expect(isInertField({ add: () => undefined }, "add")).toBe(false);
    expect(isInertField({ add: () => undefined }, "delete")).toBe(true);
  });
});
