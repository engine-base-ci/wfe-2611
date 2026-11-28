// K-720「項目を足す・消す（小窓つき）」の単体の試験（画面の外の、決まった形だけ）：
//   足す小窓の初めの値・足す口の体・消す確かめの注意の文・差し込み口の小窓の合わせ方（field-edit-shape.ts・fields-slots.ts）。ブラウザ・口は使わない。
//   行 ID は 11_tickets/K-720.md の表。テストはチケットを作る人が書き、実装する人は変えない
import { describe, expect, it } from "vitest";
import { deleteCaution, fieldCreateBody, newFieldDraft } from "../features/F9/settings/field-edit-shape";
import { isInertField, mergeFieldSlots } from "../features/F9/settings/fields-slots";

const KINDS = [{ id: "k1" }, { id: "k2" }, { id: "k3" }];
const ALL = KINDS.map((k) => k.id);

describe("K720-UN", () => {
  it("K720-UN-001 newFieldDraft：名前は空・型は 1 行・必須は外れ・説明は空・今ある全部の種別にチェック・選ぶ物は空の 1 行（選ぶ型に替えたときの用意）", () => {
    const d = newFieldDraft(ALL);
    expect(d.name).toBe("");
    expect(d.type).toBe("short_text");
    expect(d.required).toBe(false);
    expect(d.description).toBe("");
    expect(d.kindIds).toEqual(ALL);
    expect(d.options).toEqual([{ name: "" }]);
    d.kindIds.push("zzz");
    expect(newFieldDraft(ALL).kindIds).toEqual(ALL);
  });

  it("K720-UN-002 fieldCreateBody：名前は前後の空白（全角も）を落とす・種別は全部の種別の並びの順・必須は必ず送る・説明は空なら送らない・選ぶ物は選ぶ型のときだけ（名前だけ・id なし・空白を落とす）", () => {
    const base = { ...newFieldDraft(ALL), name: "　取引先の区分　" };
    expect(fieldCreateBody(base, ALL)).toEqual({
      name: "取引先の区分",
      field_type: "short_text",
      kind_ids: ["k1", "k2", "k3"],
      required: false,
    });
    expect(fieldCreateBody({ ...base, kindIds: ["k3", "k1"], required: true, description: " 見立て " }, ALL)).toEqual({
      name: "取引先の区分",
      field_type: "short_text",
      kind_ids: ["k1", "k3"],
      required: true,
      description: "見立て",
    });
    expect(fieldCreateBody({ ...base, description: "　" }, ALL)).not.toHaveProperty("description");
    const sel = { ...base, type: "select" as const, options: [{ name: " 既存 " }, { name: "新規" }] };
    expect(fieldCreateBody(sel, ALL)["options"]).toEqual([{ name: "既存" }, { name: "新規" }]);
    expect(fieldCreateBody({ ...sel, type: "multi_select" }, ALL)["options"]).toEqual([
      { name: "既存" },
      { name: "新規" },
    ]);
    expect(fieldCreateBody({ ...sel, type: "number" }, ALL)).not.toHaveProperty("options");
    expect(fieldCreateBody({ ...sel, type: "check" }, ALL)).not.toHaveProperty("options");
  });

  it("K720-UN-003 deleteCaution：値が入っているときは「N 件のチケットに入っている値が見えなくなります。」と「消すと元に戻せません。」の 2 行・値が 0 件のときは後ろの 1 行だけ", () => {
    expect(deleteCaution(3)).toEqual(["3 件のチケットに入っている値が見えなくなります。", "消すと元に戻せません。"]);
    expect(deleteCaution(1200)[0]).toBe("1200 件のチケットに入っている値が見えなくなります。");
    expect(deleteCaution(0)).toEqual(["消すと元に戻せません。"]);
  });

  it("K720-UN-004 mergeFieldSlots の小窓：差し込みの小窓（overlay）は先に出した物が 1 つだけ残る・無ければ無い。足す・消すの動きは今までどおりまとまる", () => {
    const ctx = {
      fields: [],
      kinds: [],
      selectedId: undefined,
      select: () => undefined,
      reload: () => undefined,
      notify: () => undefined,
    };
    const none = mergeFieldSlots([], ctx as never);
    expect(none.overlay ?? null).toBeNull();
    expect(isInertField(none, "add")).toBe(true);
    const m = mergeFieldSlots(
      [() => ({ add: () => undefined, overlay: "A" }), () => ({ delete: () => undefined, overlay: "B" })],
      ctx as never,
    );
    expect(m.overlay).toBe("A");
    expect(isInertField(m, "add")).toBe(false);
    expect(isInertField(m, "delete")).toBe(false);
  });
});
