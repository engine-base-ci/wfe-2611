// 一覧の絞りの欄の表（K-478）。URL の問い合わせ（= 一覧の口 listTickets にそのまま足す欄）の名前と、条件の行 → 欄の直し方。
//   欄の名前は K-472・K-473・K-600 の表だけ（FILTER_KEYS）。札・かんたん・並び・条件はこの集まりの中だけで書く。
//   保存した条件を開く葉（K-479）も同じ表を読む（欄の名前の写しを別に持たない）
import type { ListExtra } from "@/features/F4/ticket-list/use-ticket-list";

/** 一覧の口の絞りの欄（K-472 の 13 欄・K-473 が足す due・delegated・approving・並び sort・fields） */
export const FILTER_KEYS = [
  "assignee_id",
  "stage_id",
  "kind_id",
  "client_id",
  "done",
  "due_from",
  "due_to",
  "start_from",
  "start_to",
  "overdue",
  "fire",
  "parent",
  "sort",
  "fields",
  "due",
  "delegated",
  "approving",
] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

/** 日本時間の今日（YYYY-MM-DD） */
export const todayJst = (now: Date = new Date()): string =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(now);

const DAY_MS = 86_400_000;
const isoOf = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** today を含む週（月曜〜日曜）。weeks＝先の週の数（来週は 1） */
export function weekOf(today: string, weeks = 0): { from: string; to: string } {
  const d = Date.parse(`${today}T00:00:00Z`);
  const back = (new Date(d).getUTCDay() + 6) % 7;
  const mon = d - back * DAY_MS + weeks * 7 * DAY_MS;
  return { from: isoOf(mon), to: isoOf(mon + 6 * DAY_MS) };
}

/** 組から欄を外す（新しい組を返す） */
export function without(extra: ListExtra, keys: readonly string[]): Record<string, string> {
  const drop = new Set(keys);
  return Object.fromEntries(Object.entries(extra).filter(([k]) => !drop.has(k)));
}

/** 組の値を替える（空の値は欄を外す・新しい組を返す） */
export function withParams(extra: ListExtra, next: Readonly<Record<string, string | null>>): Record<string, string> {
  const out: Record<string, string> = { ...extra };
  for (const [k, v] of Object.entries(next)) {
    if (v === null || v === "") delete out[k];
    else out[k] = v;
  }
  return out;
}

// ---------------------------------------------------------------- 条件を組む（詳しく）の行
export type CondField = "assignee" | "stage" | "kind" | "due";
export const COND_FIELDS: readonly { value: CondField; label: string }[] = [
  { value: "assignee", label: "担当者" },
  { value: "stage", label: "状態" },
  { value: "kind", label: "種別" },
  { value: "due", label: "期限" },
];
/** 項目ごとの言い方（口が AND と 1 つの値だけなので、言い方は少ない） */
export const COND_OPS: Record<CondField, readonly string[]> = {
  assignee: ["が"],
  stage: ["が", "でない"],
  kind: ["が"],
  due: ["は"],
};
/** 状態「でない」で選べる値（完了だけ・口に done=false がある） */
export const NOT_DONE = "done";
export const DUE_VALUES = [
  { value: "today", label: "今日" },
  { value: "week", label: "今週" },
  { value: "next", label: "来週" },
  { value: "range", label: "範囲を決める" },
] as const;

export interface CondRow {
  /** 行の印（足すたびに増える） */
  id: number;
  field: CondField | "";
  op: string;
  /** 人・段・種別の id、期限は DUE_VALUES の value、状態「でない」は NOT_DONE */
  value: string;
  /** 期限の範囲（YYYY-MM-DD） */
  from: string;
  to: string;
}

export const COND_ERROR = {
  value: "値を選んでください",
  range: "期限の始めは終わりより前にしてください",
} as const;

/** 行の誤り（無ければ null）。誤りのある行があるときは口に飛ばさない */
export function rowError(r: CondRow): string | null {
  if (r.field === "" || r.value === "") return COND_ERROR.value;
  if (r.field === "due" && r.value === "range") {
    if (!r.from || !r.to) return COND_ERROR.value;
    if (r.from > r.to) return COND_ERROR.range;
  }
  return null;
}

/** 条件の行が書く欄（担当者・状態・種別・期限）。「この条件で見る」は、この欄を全部替える */
export const COND_KEYS: readonly FilterKey[] = ["assignee_id", "stage_id", "kind_id", "done", "due_from", "due_to"];

function dueParams(r: CondRow, today: string): Record<string, string> {
  if (r.value === "today") return { due_from: today, due_to: today };
  if (r.value === "week") {
    const w = weekOf(today);
    return { due_from: w.from, due_to: w.to };
  }
  if (r.value === "next") {
    const w = weekOf(today, 1);
    return { due_from: w.from, due_to: w.to };
  }
  return { due_from: r.from, due_to: r.to };
}

/** 条件の行 → 欄（全部 AND。同じ欄を 2 行が書けば後の行） */
export function paramsOf(rows: readonly CondRow[], today: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rows) {
    if (r.field === "assignee") out["assignee_id"] = r.value;
    else if (r.field === "kind") out["kind_id"] = r.value;
    else if (r.field === "stage" && r.op === "でない") out["done"] = "false";
    else if (r.field === "stage") out["stage_id"] = r.value;
    else if (r.field === "due") Object.assign(out, dueParams(r, today));
  }
  return out;
}
