// 作る面の下書きの形と読み方（K-442・D-128.138）。純粋な関数だけ（@/ を読まない・単体の試験が直に読む）。
//   本文は 1 枚の木と、触ったか・ひな形を消したか（create-body の BodyState）。会社の項目は 項目の id → 値・確認項目は文の並び。
//   古い形の鍵 sections（区画の入力）は読み捨てる（本文に入れない）。形の違う欄はその欄だけ捨て、残りは残す
import type { Doc } from "@kaname/contracts";

export type DraftFieldValue = string | number | boolean | string[] | null;

export interface DraftBody {
  scope_id?: string | null;
  kind_id?: string | null;
  title?: string;
  assignee_member_id?: string | null;
  due_on?: string;
  start_on?: string;
  priority?: "mid" | "high";
  priority_reason?: string;
  parent_ticket_id?: string | null;
  /** 予定時間（時間の字のまま。作るとき分に直す） */
  estimate?: string;
  body?: { doc: Doc; edited: boolean; dismissed: boolean };
  fields?: Record<string, DraftFieldValue>;
  specs?: string[];
  notify_member_ids?: string[];
}

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v);
const isStrList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");
const isDoc = (v: unknown): v is Doc => isObj(v) && v["type"] === "doc" && Array.isArray(v["content"]);
const isFieldValue = (v: unknown): v is DraftFieldValue =>
  v === null || ["string", "number", "boolean"].includes(typeof v) || isStrList(v);

/** 文字か null の欄 */
const ID_KEYS = ["scope_id", "kind_id", "assignee_member_id", "parent_ticket_id"] as const;
/** 文字の欄 */
const TEXT_KEYS = ["title", "due_on", "start_on", "priority_reason", "estimate"] as const;

function readBodyPart(v: unknown): DraftBody["body"] | undefined {
  if (!isObj(v) || !isDoc(v["doc"])) return undefined;
  return { doc: v["doc"], edited: v["edited"] === true, dismissed: v["dismissed"] === true };
}

function readFields(v: unknown): DraftBody["fields"] | undefined {
  if (!isObj(v)) return undefined;
  return Object.fromEntries(Object.entries(v).filter(([, x]) => isFieldValue(x))) as Record<string, DraftFieldValue>;
}

/** サーバーか写しから読んだ下書きの中身を、今の形にする（読めない物は無いのと同じ） */
export function readDraftBody(raw: unknown): DraftBody {
  if (!isObj(raw)) return {};
  const out: Record<string, unknown> = {};
  for (const k of ID_KEYS) {
    const v = raw[k];
    if (typeof v === "string" || v === null) out[k] = v;
  }
  for (const k of TEXT_KEYS) if (typeof raw[k] === "string") out[k] = raw[k];
  if (raw["priority"] === "mid" || raw["priority"] === "high") out["priority"] = raw["priority"];
  const body = readBodyPart(raw["body"]);
  if (body) out["body"] = body;
  const fields = readFields(raw["fields"]);
  if (fields) out["fields"] = fields;
  if (isStrList(raw["specs"])) out["specs"] = [...raw["specs"]];
  if (isStrList(raw["notify_member_ids"])) out["notify_member_ids"] = [...raw["notify_member_ids"]];
  return out as DraftBody;
}
