// 会社の項目の値の整えと確かめ（K-569・純粋な関数）。値の形は更新の口 K-564・作る口 K-437 と同じ：
//   文字＝前後の空白を落とした文字／数＝数／日付＝YYYY-MM-DD／1 つ選ぶ＝選択肢の id／複数選ぶ＝選択肢の並びの id の並び／チェック＝真偽
//   必須のチェックは付いていないと必須を満たさない（D-150.51）。口が最後の砦で、ここは口に届く前に止められる物を止める

export type FieldType = "short_text" | "long_text" | "number" | "date" | "select" | "multi_select" | "check";

export interface FieldOption {
  id: string;
  name: string;
  position: number;
}

/** 会社の項目のマスタの 1 行（K-563 の TicketField・鍵 7） */
export interface TicketField {
  id: string;
  name: string;
  field_type: FieldType;
  required: boolean;
  description: string | null;
  options: FieldOption[];
  position: number;
}

/** 画面が持つ値（文字の欄は打った字のまま持ち、送るときに整える） */
export type FieldValue = string | number | boolean | string[] | null;

/** 作る面の既定の行の値のうち、確かめに使う物（K-442 の作る面も同じ鍵で渡す） */
export interface CoreCheck {
  priority?: FieldValue;
  priority_reason?: FieldValue;
  estimate?: FieldValue;
}

const NUMBER_RE = /^-?\d+(\.\d+)?$/;

/** 数の字を数にする：NFKC で全角を半角に・前後の空白とカンマを落とす。数でなければ null（空も null） */
export function parseNumber(text: string): number | null {
  const t = text.normalize("NFKC").trim().replace(/,/g, "");
  if (!NUMBER_RE.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const asText = (v: FieldValue): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const isBlankText = (v: FieldValue): boolean => asText(v).trim() === "";

/** 型ごとの「空」。必須のチェックの false は空（D-150.51） */
export function isEmpty(f: TicketField, v: FieldValue | undefined): boolean {
  if (v === undefined || v === null) return true;
  switch (f.field_type) {
    case "multi_select":
      return !Array.isArray(v) || v.length === 0;
    case "check":
      return v !== true;
    case "number":
      return typeof v === "number" ? false : isBlankText(v);
    default:
      return isBlankText(v);
  }
}

const NEED: Record<FieldType, string> = {
  short_text: "を書いてください",
  long_text: "を書いてください",
  number: "を入れてください",
  date: "を選んでください",
  select: "を選んでください",
  multi_select: "を選んでください",
  check: "にチェックを付けてください",
};

/** 必須が空のときの言い方（型で違う） */
export const needText = (f: TicketField): string => `${f.name}${NEED[f.field_type]}`;
/** 数の欄に数でない字があるときの言い方 */
export const notNumberText = (name: string): string => `${name}は数で入れてください`;

/** 数の欄の字が数でない（空は数でないに数えない） */
const badNumber = (v: FieldValue | undefined): boolean =>
  typeof v === "string" && v.trim() !== "" && parseNumber(v) === null;

/** 1 つの項目の誤りの文（無ければ null） */
export function checkField(f: TicketField, v: FieldValue | undefined): string | null {
  if (f.field_type === "number" && badNumber(v)) return notNumberText(f.name);
  if (f.required && isEmpty(f, v)) return needText(f);
  return null;
}

/** 送る前の確かめ：項目の id（と既定の行の鍵）→ 誤りの文。誤りが無ければ空 */
export function checkFields(
  master: readonly TicketField[],
  values: Readonly<Record<string, FieldValue>>,
  core?: CoreCheck,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of master) {
    const e = checkField(f, values[f.id]);
    if (e) out[f.id] = e;
  }
  if (core) {
    if (core.priority === "high" && isBlankText(core.priority_reason ?? null))
      out.priority_reason = "優先度を高にする理由を書いてください";
    if (badNumber(core.estimate)) out.estimate = notNumberText("予定時間");
  }
  return out;
}

/** 1 つの項目の送る値（空は null）。文字は前後の空白を落とす・数は数に・複数選ぶは選択肢の並びに */
export function toValue(f: TicketField, v: FieldValue | undefined): FieldValue {
  if (v === undefined || v === null) return null;
  switch (f.field_type) {
    case "number": {
      if (typeof v === "number") return v;
      return parseNumber(asText(v));
    }
    case "check":
      return v === true;
    case "multi_select": {
      if (!Array.isArray(v) || v.length === 0) return null;
      const chosen = new Set(v);
      const ordered = [...f.options].sort((a, b) => a.position - b.position).filter((o) => chosen.has(o.id));
      return ordered.length === 0 ? null : ordered.map((o) => o.id);
    }
    default: {
      const t = asText(v).trim();
      return t === "" ? null : t;
    }
  }
}

/** 作る口に渡す fields：今出ている項目の分だけ。空と付けていないチェックは入れない */
export function toPayload(
  master: readonly TicketField[],
  values: Readonly<Record<string, FieldValue>>,
): Record<string, FieldValue> {
  const out: Record<string, FieldValue> = {};
  for (const f of master) {
    const v = toValue(f, values[f.id]);
    if (v === null || v === false) continue;
    out[f.id] = v;
  }
  return out;
}
