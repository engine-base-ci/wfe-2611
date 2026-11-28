// 会社が足す項目の答えの形（K-563・D-150.36・D-150.37）。読む口（list.ts）と、値を書く口（K-564・K-437）が同じ形で使う。
//   TicketField = { id, name, field_type, required, description, options, position }（鍵ちょうど 7）。
//   options は選ぶ型（select・multi_select）だけ [{ id, name, position }] を position の順に持ち、ほかの型は []。
//   会社の id・作った人・時刻は出さない

/** 項目の型（D-150.37）。選ぶ型は SELECT_TYPES */
export const FIELD_TYPES = [
  "short_text",
  "long_text",
  "number",
  "money",
  "date",
  "select",
  "multi_select",
  "check",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];
export const SELECT_TYPES: readonly string[] = ["select", "multi_select"];

export interface FieldOption {
  id: string;
  name: string;
  position: number;
}

/** custom_fields の行（読む文の列） */
export interface CustomFieldRow {
  id: string;
  name: string;
  field_type: string;
  required: boolean;
  description: string | null;
  options: unknown;
  position: number;
}

export interface TicketField {
  id: string;
  name: string;
  field_type: string;
  required: boolean;
  description: string | null;
  options: FieldOption[];
  position: number;
}

const asOption = (o: unknown): FieldOption | null => {
  if (typeof o !== "object" || o === null) return null;
  const r = o as Record<string, unknown>;
  if (typeof r["id"] !== "string" || typeof r["name"] !== "string") return null;
  return { id: r["id"], name: r["name"], position: typeof r["position"] === "number" ? r["position"] : 0 };
};

/** 選択肢を position の順（同じなら今の並び）に整える。選ぶ型でなければ [] */
export function toOptions(fieldType: string, options: unknown): FieldOption[] {
  if (!SELECT_TYPES.includes(fieldType) || !Array.isArray(options)) return [];
  return options
    .map(asOption)
    .filter((o): o is FieldOption => o !== null)
    .map((o, i) => ({ o, i }))
    .sort((a, b) => a.o.position - b.o.position || a.i - b.i)
    .map(({ o }) => ({ id: o.id, name: o.name, position: o.position }));
}

export function toTicketField(row: CustomFieldRow): TicketField {
  return {
    id: row.id,
    name: row.name,
    field_type: row.field_type,
    required: row.required,
    description: row.description ?? null,
    options: toOptions(row.field_type, row.options),
    position: row.position,
  };
}
