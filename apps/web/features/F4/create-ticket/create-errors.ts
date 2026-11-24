// 作る口が断ったときに、どの欄の下・赤い箱に出すかを決める（K-442・決めは前の K-431 と控え帳の引き継ぎ）。
//   409 E-VAL-012・028（期限・開始）→ 期限の欄の下／409 E-VAL-015（親の深さ）・404（選べない選び先）→ 赤い箱／
//   409 E-FLD-002〜004（会社の項目）→ 口は欄を付けないので、今の項目のマスタと送った値から当たる項目を決めて、その欄の下（002 は手元で選択肢に在れば値の入った選ぶ項目。当たらなければ赤い箱）／
//   E-FLD-001（その種別に出ない）→ 赤い箱／422 → 欄つきはその欄の下・置けない鍵（本文の木・確認項目・項目の値）が 1 つでもあれば赤い箱にも番号。
//   文は正本（errors.json → @kaname/errors/catalog）から引く。読み直さない
import { CATALOG } from "@kaname/errors/catalog";
import { PAGE_ERROR } from "@/components/k/error-of";
import { isEmpty, parseNumber, type FieldValue, type TicketField } from "@/features/F4/items/field-values";

export interface CreateErrorInput {
  kind: string;
  status: number;
  code: string;
  fields: Record<string, string>;
}
export interface PlacedError {
  /** 欄の鍵 → 文（欄の鍵は due_on・start_on・title・priority_reason・assignee_member_id・parent_ticket_id・会社の項目の id） */
  fields: Record<string, string>;
  /** 赤い箱に出す番号（無ければ null） */
  box: string | null;
}
type MasterLike = Pick<TicketField, "id" | "field_type" | "required"> & {
  name?: string;
  options: readonly { id: string }[];
};
export interface PlaceContext {
  master: readonly MasterLike[];
  values: Readonly<Record<string, unknown>>;
}

/** 422 の欄の鍵のうち、画面に欄がある物 */
const FIELD_KEYS = new Set([
  "title",
  "start_on",
  "due_on",
  "priority_reason",
  "assignee_member_id",
  "parent_ticket_id",
]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const textOf = (code: string): string => CATALOG[code]?.message ?? code;

/** 選ぶ項目で、選択肢に無い id を持つか */
function staleChoice(f: MasterLike, v: unknown): boolean {
  if (f.field_type !== "select" && f.field_type !== "multi_select") return false;
  const ids = new Set(f.options.map((o) => o.id));
  const chosen = Array.isArray(v) ? v : typeof v === "string" && v !== "" ? [v] : [];
  return chosen.some((x) => typeof x !== "string" || !ids.has(x));
}

/** 型に合わない値（数の項目に数でない字・日付の項目に日付でない字） */
function wrongType(f: MasterLike, v: unknown): boolean {
  if (typeof v !== "string" || v.trim() === "") return false;
  if (f.field_type === "number") return parseNumber(v) === null;
  if (f.field_type === "date") return !DATE_RE.test(v.trim());
  return false;
}

const FIELD_RULES: Record<string, (f: MasterLike, v: unknown) => boolean> = {
  "E-FLD-004": (f, v) => f.required && isEmpty(f as TicketField, v as FieldValue | undefined),
  "E-FLD-002": staleChoice,
  "E-FLD-003": wrongType,
};

/** 値の入った選ぶ項目（手元のマスタでは選択肢に在るが、サーバーの側で使えなくなった値の当たり先） */
function chosenChoice(f: MasterLike, v: unknown): boolean {
  if (f.field_type !== "select" && f.field_type !== "multi_select") return false;
  return Array.isArray(v) ? v.length > 0 : typeof v === "string" && v !== "";
}

function hitsOf(rule: (f: MasterLike, v: unknown) => boolean, ctx: PlaceContext): MasterLike[] {
  return ctx.master.filter((f) => rule(f, ctx.values[f.id]));
}

function placeFieldCode(code: string, ctx: PlaceContext): PlacedError {
  const rule = FIELD_RULES[code];
  if (!rule) return { fields: {}, box: code };
  // 002：手元で選択肢に無い値が無ければ、値の入った選ぶ項目に置く（代表の決め answer=a2c6993d3b1f）。当てられないときだけ赤い箱
  const direct = hitsOf(rule, ctx);
  const hit = direct.length === 0 && code === "E-FLD-002" ? hitsOf(chosenChoice, ctx) : direct;
  if (hit.length === 0) return { fields: {}, box: code };
  return { fields: Object.fromEntries(hit.map((f) => [f.id, textOf(code)])), box: null };
}

function placeInvalid(r: CreateErrorInput): PlacedError {
  const entries = Object.entries(r.fields);
  const placed = entries.filter(([k]) => FIELD_KEYS.has(k));
  const left = entries.length - placed.length;
  return { fields: Object.fromEntries(placed), box: left > 0 || entries.length === 0 ? r.code : null };
}

/** 作る口の断り → 欄の下の文と赤い箱の番号 */
export function placeCreateError(r: CreateErrorInput, ctx: PlaceContext): PlacedError {
  if (r.status === 404) return { fields: {}, box: r.code.startsWith("E-") ? r.code : PAGE_ERROR.notFound };
  if (r.status === 422) return placeInvalid(r);
  if (r.code === "E-VAL-012" || r.code === "E-VAL-028") return { fields: { due_on: textOf(r.code) }, box: null };
  if (r.code.startsWith("E-FLD-")) return placeFieldCode(r.code, ctx);
  return { fields: {}, box: r.code.startsWith("E-") ? r.code : PAGE_ERROR.loadFailed };
}
