// チケットの設定「項目」の形（K-709）：口 listTicketFieldMaster の答え → 部品の値（FieldsPanel の FieldRow）と、
//   右の欄で直している値（FieldDraft）・保存の差分の体（fieldPatch）・入力の確かめ（fieldProblems）・選ぶ物の並べ直し。
//   画面の外の純粋な関数（@/ を読まない・単体の試験 k709-settings-fields-shape.test.ts が見る）。元の配列・物は変えない
import { nameProblem } from "./kinds-shape";

/** 項目の名前と選ぶ物の名前の上限（口 K-717 と同じ 40 字） */
const NAME_MAX = 40;

/** 型の鍵（口の field_type）と、画面に出す字 */
export const FIELD_TYPE_KEYS = [
  "short_text",
  "long_text",
  "number",
  "money",
  "date",
  "select",
  "multi_select",
  "check",
] as const;
export type FieldTypeKey = (typeof FIELD_TYPE_KEYS)[number];
export type FieldTypeLabel = "1 行" | "複数行" | "数" | "金額" | "日付" | "1 つ選ぶ" | "複数選ぶ" | "チェック";
const LABELS: Record<FieldTypeKey, FieldTypeLabel> = {
  short_text: "1 行",
  long_text: "複数行",
  number: "数",
  money: "金額",
  date: "日付",
  select: "1 つ選ぶ",
  multi_select: "複数選ぶ",
  check: "チェック",
};
const isTypeKey = (v: string): v is FieldTypeKey => (FIELD_TYPE_KEYS as readonly string[]).includes(v);

/** 型の鍵 → 字（知らない鍵は「1 行」） */
export const typeLabel = (key: string): FieldTypeLabel => (isTypeKey(key) ? LABELS[key] : LABELS.short_text);
/** 字 → 型の鍵（知らない字は short_text） */
export const typeKey = (label: string): FieldTypeKey =>
  FIELD_TYPE_KEYS.find((k) => LABELS[k] === label) ?? "short_text";
/** 選ぶ型（1 つ選ぶ・複数選ぶ）か */
export const isChoiceType = (key: string): boolean => key === "select" || key === "multi_select";
/** 型の欄の選び肢（並びは下絵のとおり） */
export const FIELD_TYPE_OPTIONS: readonly { value: FieldTypeKey; label: FieldTypeLabel }[] = FIELD_TYPE_KEYS.map(
  (k) => ({ value: k, label: LABELS[k] }),
);

/** 選ぶ物の答えの 1 件 */
export interface OptionAnswer {
  id: string;
  name: string;
  position?: number;
}

/** 口の答えの 1 件（契約 TicketFieldSetting の、この画面が読む所） */
export interface FieldAnswer {
  id: string;
  name: string;
  field_type: string;
  required?: boolean;
  description?: string | null;
  options?: readonly OptionAnswer[];
  position?: number;
  kind_ids?: readonly string[];
  all_kinds?: boolean;
  value_count?: number;
}

/** 一覧と右の欄の値（views.tsx の FieldRow と同じ形） */
export interface FieldRowShape {
  id: string;
  name: string;
  type: FieldTypeLabel;
  required: boolean;
  desc: string;
  kinds: readonly string[];
  options?: readonly string[];
}

/** 右の欄の選ぶ物（既存は id つき・新しく足した物は id なし） */
export interface FieldOption {
  id?: string;
  name: string;
}

/** 右の欄で直している値 */
export interface FieldDraft {
  name: string;
  type: string;
  options: FieldOption[];
  required: boolean;
  description: string;
  kindIds: string[];
}

/** 保存の体（変えた欄だけ） */
export interface FieldPatch {
  name?: string;
  field_type?: string;
  required?: boolean;
  description?: string | null;
  options?: FieldOption[];
  kind_ids?: string[];
}

/** 入力の問題の文（欄ごと） */
export interface FieldProblems {
  name?: string;
  options?: string;
  kinds?: string;
}

/** 前後の空白（全角・タブ・改行も）を落とす */
const trimText = (s: string): string => s.replace(/^\s+|\s+$/g, "");
const byPosition = <T extends { position?: number }>(xs: readonly T[]): T[] =>
  [...xs].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
const optionsOf = (f: FieldAnswer): FieldOption[] =>
  byPosition(f.options ?? []).map((o) => ({ id: o.id, name: o.name }));
const kindsOf = (f: FieldAnswer, allKindIds: readonly string[]): string[] =>
  f.all_kinds ? [...allKindIds] : [...(f.kind_ids ?? [])];

export function shapeFields(answer: readonly FieldAnswer[], kinds: readonly { id: string }[]): FieldRowShape[] {
  const all = kinds.map((k) => k.id);
  return byPosition(answer).map((f) => ({
    id: f.id,
    name: f.name,
    type: typeLabel(f.field_type),
    required: f.required === true,
    desc: f.description ?? "",
    kinds: kindsOf(f, all),
    ...(isChoiceType(f.field_type) ? { options: optionsOf(f).map((o) => o.name) } : {}),
  }));
}

export const fieldDraftOf = (field: FieldAnswer, allKindIds: readonly string[]): FieldDraft => ({
  name: field.name,
  type: field.field_type,
  options: optionsOf(field),
  required: field.required === true,
  description: field.description ?? "",
  kindIds: kindsOf(field, allKindIds),
});

const descOf = (v: string | null | undefined): string | null => {
  const t = trimText(v ?? "");
  return t === "" ? null : t;
};
const sameSet = (a: readonly string[], b: readonly string[]): boolean => {
  const sa = new Set(a);
  const sb = new Set(b);
  return sa.size === sb.size && [...sa].every((x) => sb.has(x));
};
const cleanOptions = (os: readonly FieldOption[]): FieldOption[] =>
  os.map((o) => (o.id ? { id: o.id, name: trimText(o.name) } : { name: trimText(o.name) }));
const sameOptions = (a: readonly FieldOption[], b: readonly FieldOption[]): boolean =>
  a.length === b.length && a.every((o, i) => o.id === b[i]!.id && o.name === b[i]!.name);

export function fieldPatch(base: FieldAnswer, draft: FieldDraft, allKindIds: readonly string[]): FieldPatch {
  const name = trimText(draft.name);
  const typeChanged = draft.type !== base.field_type;
  const description = descOf(draft.description);
  const baseKinds = kindsOf(base, allKindIds);
  const kindsChanged = !sameSet(draft.kindIds, baseKinds);
  const options = cleanOptions(draft.options);
  // 新しい型が選ぶ型なら、型を変えたとき（選ぶ型どうしも）は選ぶ物を必ず一緒に送る（K-717 の契約）
  const sendOptions = isChoiceType(draft.type) && (typeChanged || !sameOptions(options, cleanOptions(optionsOf(base))));
  return {
    ...(name !== trimText(base.name) ? { name } : {}),
    ...(typeChanged ? { field_type: draft.type } : {}),
    ...(draft.required !== (base.required === true) ? { required: draft.required } : {}),
    ...(description !== descOf(base.description) ? { description } : {}),
    ...(sendOptions ? { options } : {}),
    ...(kindsChanged ? { kind_ids: allKindIds.filter((id) => draft.kindIds.includes(id)) } : {}),
  };
}

function optionsProblem(options: readonly FieldOption[]): string | undefined {
  const names = options.map((o) => trimText(o.name));
  if (names.length === 0) return "選ぶ物を 1 つ以上入れてください";
  if (names.some((n) => n === "")) return "選ぶ物の名前を入れてください";
  if (names.some((n) => Array.from(n).length > NAME_MAX)) return `選ぶ物の名前は ${NAME_MAX} 字までです`;
  if (new Set(names).size !== names.length) return "同じ名前の選ぶ物があります";
  return undefined;
}

export function fieldProblems(draft: FieldDraft): FieldProblems {
  const name = nameProblem(draft.name, NAME_MAX);
  const options = isChoiceType(draft.type) ? optionsProblem(draft.options) : undefined;
  return {
    ...(name ? { name } : {}),
    ...(options ? { options } : {}),
    ...(draft.kindIds.length === 0 ? { kinds: "出す種別を 1 つ以上選んでください" } : {}),
  };
}

/** 末尾に空の選ぶ物を足す（id なし） */
export const addOption = (options: readonly FieldOption[]): FieldOption[] => [...options, { name: "" }];
/** i 番目の選ぶ物を外す */
export const removeOption = (options: readonly FieldOption[], i: number): FieldOption[] =>
  options.filter((_, j) => j !== i);
/** from 番目を to 番目へ動かす（範囲の外・同じ場所は元のまま） */
export function moveOption<T>(options: readonly T[], from: number, to: number): readonly T[] {
  const n = options.length;
  if (from === to || from < 0 || to < 0 || from >= n || to >= n) return options;
  const next = [...options];
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x!);
  return next;
}
