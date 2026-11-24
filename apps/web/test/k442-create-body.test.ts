// K-442「作る面を新しい並びに」のうち、画面を使わない道具の単体試験：本文の持ち方（ひな形・薄い節・種別を変えたとき）・下書きの読み方・作る口の断りを置く欄の決め方。
//   行 ID は 11_tickets/K-442.md の行の表（K442-UN-001〜004）。画面の動きは k442-create-body.spec.ts（K442-UI-…）。
//   実装はまだ無いので、読み込みは試験の中（動的 import）で行う（まだ無い道具を import の時点で読んで準備を落とさない）。
//   文書の木は K-561 の形（type・attrs・content）。薄い節は attrs.ghost が true（K-561・K-567）。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const BODY = "../features/F4/create-ticket/create-body";
const SHAPE = "../features/F4/create-ticket/draft-shape";
const ERRS = "../features/F4/create-ticket/create-errors";

type Json = Record<string, unknown>;
type Doc = { type: "doc"; content: Json[] };
interface BodyState {
  doc: Doc;
  edited: boolean;
  dismissed: boolean;
}
interface Kind {
  id: string;
  name: string;
  body_template?: Doc | null;
}
type BodyLib = {
  stripGhost: (d: Doc) => Doc;
  initialBody: (k: Kind | undefined) => BodyState;
  onBodyEdit: (s: BodyState, d: Doc) => BodyState;
  dismissTemplate: (s: BodyState) => BodyState;
  bodyOnKindChange: (s: BodyState, next: Kind | undefined) => BodyState;
  toCreateBody: (s: BodyState) => { doc: Doc };
};
type Shape = { readDraftBody: (raw: unknown) => Json };
interface MasterField {
  id: string;
  name: string;
  field_type: string;
  required: boolean;
  options: { id: string; name: string }[];
}
type Placed = { fields: Record<string, string>; box: string | null };
type Errs = {
  placeCreateError: (
    r: { kind: string; status: number; code: string; fields: Record<string, string> },
    ctx: { master: MasterField[]; values: Record<string, unknown> },
  ) => Placed;
};
const body = async (): Promise<BodyLib> => (await import(/* @vite-ignore */ BODY)) as BodyLib;
const shape = async (): Promise<Shape> => (await import(/* @vite-ignore */ SHAPE)) as Shape;
const errs = async (): Promise<Errs> => (await import(/* @vite-ignore */ ERRS)) as Errs;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const CATALOG = (
  JSON.parse(readFileSync(join(ROOT, "07_qa/test-specs/errors.json"), "utf8")) as {
    errors: { id: string; message: string }[];
  }
).errors;
const msg = (id: string): string => CATALOG.find((e) => e.id === id)?.message ?? `(${id} が errors.json に無い)`;

const txt = (text: string): Json => ({ type: "text", text });
const real = (text: string): Json => ({ type: "paragraph", content: [txt(text)] });
const ghostP = (text: string): Json => ({ type: "paragraph", attrs: { ghost: true }, content: [txt(text)] });
const ghostH = (text: string): Json => ({ type: "heading", attrs: { level: 2, ghost: true }, content: [txt(text)] });
const doc = (...content: Json[]): Doc => ({ type: "doc", content });
const EMPTY: Doc = doc();
const TPL_TASK = doc(ghostH("目的"), ghostP("このチケットで何を実現したいかを書きます"));
const TPL_ISSUE = doc(ghostH("起きていること"), ghostP("いま何が起きているかを書きます"));
const TASK: Kind = { id: "k-task", name: "タスク", body_template: TPL_TASK };
const ISSUE: Kind = { id: "k-issue", name: "課題", body_template: TPL_ISSUE };
const PLAIN: Kind = { id: "k-plain", name: "ひな形なし", body_template: null };

describe("本文の持ち方（K-442）", () => {
  it("K442-UN-001 薄い節の取り除き：attrs.ghost が true の節だけ取り除く。書いた節は残り、全部薄ければ空の木。渡した木は変えない", async () => {
    const { stripGhost, toCreateBody, initialBody } = await body();
    const mixed = doc(
      ghostH("目的"),
      real("月末の請求を出す"),
      ghostP("どうなれば終わりかを書きます"),
      real("先方が受け取った"),
    );
    const frozen = JSON.stringify(mixed);
    expect(stripGhost(mixed)).toEqual(doc(real("月末の請求を出す"), real("先方が受け取った")));
    expect(JSON.stringify(mixed), "渡した木を変えない").toBe(frozen);
    expect(stripGhost(TPL_TASK)).toEqual(EMPTY);
    expect(stripGhost(EMPTY)).toEqual(EMPTY);
    // 作る口に送る本文は、薄い節を落とした木だけ（text は付けない・口が doc から作る）
    expect(toCreateBody({ doc: mixed, edited: true, dismissed: false })).toEqual({
      doc: doc(real("月末の請求を出す"), real("先方が受け取った")),
    });
    expect(toCreateBody(initialBody(TASK))).toEqual({ doc: EMPTY });
    expect(Object.keys(toCreateBody(initialBody(TASK)))).toEqual(["doc"]);
  });

  it("K442-UN-002 種別を変えたとき：まだ触っていなければ新しい種別のひな形（無ければ空）に入れ替わる。書いた後・ひな形を消した後は今の本文のまま", async () => {
    const { initialBody, onBodyEdit, dismissTemplate, bodyOnKindChange } = await body();
    const first = initialBody(TASK);
    expect(first).toEqual({ doc: TPL_TASK, edited: false, dismissed: false });
    expect(initialBody(PLAIN).doc).toEqual(EMPTY);
    expect(initialBody(undefined).doc).toEqual(EMPTY);
    // 触っていない：新しい種別のひな形に入れ替わる・ひな形が無い種別なら空
    expect(bodyOnKindChange(first, ISSUE)).toEqual({ doc: TPL_ISSUE, edited: false, dismissed: false });
    expect(bodyOnKindChange(first, PLAIN).doc).toEqual(EMPTY);
    // 書いた：残す。書いたことは種別を変えても変わらない
    const written = onBodyEdit(first, doc(real("月末の請求を出す"), ghostP("どうなれば終わりかを書きます")));
    expect(written.edited).toBe(true);
    expect(bodyOnKindChange(written, ISSUE)).toEqual(written);
    // ひな形を消した：薄い節だけ消え、書いた字は残る。以後は種別を変えてもひな形を入れない
    const dismissed = dismissTemplate(written);
    expect(dismissed.dismissed).toBe(true);
    expect(dismissed.doc).toEqual(doc(real("月末の請求を出す")));
    expect(bodyOnKindChange(dismissed, ISSUE)).toEqual(dismissed);
    const blank = dismissTemplate(first);
    expect(blank).toEqual({ doc: EMPTY, edited: false, dismissed: true });
    expect(bodyOnKindChange(blank, ISSUE).doc, "消したあとに別の種別を選んでもひな形は戻らない").toEqual(EMPTY);
  });
});

describe("下書きの読み方（K-442）", () => {
  it("K442-UN-003 新しい形（本文の木・項目・確認項目）はそのまま読み、古い鍵 sections と形の違う物は無いのと同じ", async () => {
    const { readDraftBody } = await shape();
    const good = {
      kind_id: "k1",
      title: "請求書",
      priority: "high",
      priority_reason: "先方の締めが早い",
      body: { doc: doc(real("書いた")), edited: true, dismissed: false },
      fields: { "6f000000-0000-4000-8000-000000000001": "2026-12-15", "6f000000-0000-4000-8000-000000000007": true },
      specs: ["請求書が宛先に届いている", "支払期日が 12/15 になっている"],
      notify_member_ids: ["m3"],
    };
    expect(readDraftBody(good)).toMatchObject(good);
    // 古い形（区画の入力）は読み捨てる：sections は返さず、ほかの欄はそのまま
    const old = readDraftBody({ title: "前の下書き", sections: { purpose: "書きかけの目的" }, notify_member_ids: [] });
    expect(old).not.toHaveProperty("sections");
    expect(old).toMatchObject({ title: "前の下書き" });
    // 形の違う物：本文が木でない・項目が配列・確認項目が文字の並びでない・知らせる人が文字の並びでない は、その欄だけ捨てる（ほかは残す）
    const bad = readDraftBody({
      title: "残る",
      body: "文字列",
      fields: ["x"],
      specs: [1, "文"],
      notify_member_ids: "m1",
      priority: "最高",
      due_on: 20261201,
    });
    expect(bad).toMatchObject({ title: "残る" });
    for (const k of ["body", "fields", "specs", "notify_member_ids", "priority", "due_on"])
      expect(bad, k).not.toHaveProperty(k);
    expect(readDraftBody(null)).toEqual({});
    expect(readDraftBody([1, 2])).toEqual({});
  });
});

describe("作る口の断りを置く欄（K-442）", () => {
  const F = (n: number): string => `6f000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const O = (f: number, names: string[]) =>
    names.map((name, i) => ({ id: `7f000000-0000-4000-0000-${String(f * 100 + i).padStart(12, "0")}`, name }));
  const MASTER: MasterField[] = [
    { id: F(1), name: "支払期日", field_type: "date", required: true, options: [] },
    { id: F(2), name: "PJコード", field_type: "select", required: true, options: O(2, ["SK-11", "SK-12"]) },
    { id: F(3), name: "請求額", field_type: "number", required: false, options: [] },
    { id: F(6), name: "送る書類", field_type: "multi_select", required: false, options: O(6, ["請求書", "明細"]) },
  ];
  const err = (status: number, code: string, fields: Record<string, string> = {}) => ({
    kind: status === 409 ? "conflict" : status === 404 ? "not_found" : status === 422 ? "invalid" : "failed",
    status,
    code,
    fields,
  });

  it("K442-UN-004 断りの置き場：期限・開始＝期限の欄／親の深さ・見えない選び先＝赤い箱／会社の項目の 409＝番号とマスタから決めた項目の欄（決められなければ赤い箱）／422＝欄つきはその欄・無い欄は赤い箱", async () => {
    const { placeCreateError } = await errs();
    const ctx = (values: Record<string, unknown>) => ({ master: MASTER, values });
    // 期限と開始日：409・欄なしの番号を、画面が期限の欄の下に置く（正本の文）
    expect(placeCreateError(err(409, "E-VAL-012"), ctx({}))).toEqual({
      fields: { due_on: msg("E-VAL-012") },
      box: null,
    });
    expect(placeCreateError(err(409, "E-VAL-028"), ctx({}))).toEqual({
      fields: { due_on: msg("E-VAL-028") },
      box: null,
    });
    // 親が 3 段を超える（409）・選べない選び先（404）：欄は特定できないので赤い箱（番号）
    expect(placeCreateError(err(409, "E-VAL-015"), ctx({}))).toEqual({ fields: {}, box: "E-VAL-015" });
    expect(placeCreateError(err(404, "E-PAGE-001"), ctx({}))).toEqual({ fields: {}, box: "E-PAGE-001" });
    // 会社の項目：004（必須が空）＝必須で空の項目すべて
    expect(placeCreateError(err(409, "E-FLD-004"), ctx({ [F(2)]: "" }))).toEqual({
      fields: { [F(1)]: msg("E-FLD-004"), [F(2)]: msg("E-FLD-004") },
      box: null,
    });
    // 002（選択肢に無い）＝選択肢に無い id を持つ選ぶ項目。複数選ぶも見る
    const stale = "7f000000-0000-4000-0000-999999999999";
    expect(
      placeCreateError(
        err(409, "E-FLD-002"),
        ctx({ [F(1)]: "2026-12-15", [F(2)]: stale, [F(6)]: [O(6, ["請求書"])[0]!.id, stale] }),
      ),
    ).toEqual({
      fields: { [F(2)]: msg("E-FLD-002"), [F(6)]: msg("E-FLD-002") },
      box: null,
    });
    // 003（型に合わない）＝数の項目に文字・日付の項目に日付でない字
    expect(placeCreateError(err(409, "E-FLD-003"), ctx({ [F(1)]: "来週", [F(3)]: "高い" }))).toEqual({
      fields: { [F(1)]: msg("E-FLD-003"), [F(3)]: msg("E-FLD-003") },
      box: null,
    });
    // 001（その種別に出ない）や、当たる項目が無いとき：赤い箱（番号）。書いた物は残る
    expect(
      placeCreateError(err(409, "E-FLD-001"), ctx({ [F(1)]: "2026-12-15", [F(2)]: O(2, ["SK-11"])[0]!.id })),
    ).toEqual({
      fields: {},
      box: "E-FLD-001",
    });
    expect(
      placeCreateError(err(409, "E-FLD-002"), ctx({ [F(1)]: "2026-12-15", [F(2)]: O(2, ["SK-11"])[0]!.id })),
    ).toEqual({
      fields: {},
      box: "E-FLD-002",
    });
    // 422：欄つき（題名・開始日・理由・担当者・親）はその欄。本文の木・確認項目・項目の値の誤りは赤い箱
    const p = placeCreateError(
      err(422, "E-VAL-001", {
        title: "題名を入れてください",
        priority_reason: "理由を書いてください",
        "body.doc.content.0": "木の形が違います",
        "specs.1": "確かめることを書いてください",
      }),
      ctx({}),
    );
    expect(p.fields).toEqual({ title: "題名を入れてください", priority_reason: "理由を書いてください" });
    expect(p.box, "欄の無い鍵があれば、赤い箱にも出す").toBe("E-VAL-001");
    // 作る口はもう E-VAL-014 を出さない（404 E-PAGE-001・K-437）。正本から消えている（K-437 から移した・PM 2026-11-24）
    expect(CATALOG.some((e) => e.id === "E-VAL-014")).toBe(false);
    expect(
      placeCreateError(err(422, "E-VAL-001", { title: "題名を入れてください" }), ctx({})).box,
      "全部が欄に置けたら赤い箱は出さない",
    ).toBeNull();
  });
});
