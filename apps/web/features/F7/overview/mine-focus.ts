// 自分に関わるものの札・絞りの札 ↔ 一覧の口の欄の表（K-478）。札と絞りの札は同じ絞り（同時に 1 つ・もう一度押すと外れる）。
//   AI・承認の札は完了を数えない数（K-474 の ai・approve）と同じ集まりにするため done=false を重ねる。今日は日本時間。
//   並び（sort）は絞りとは別に残す。保存した条件を開く葉（K-479）も同じ表を読む
import type { Counts, ListExtra } from "@/features/F4/ticket-list/use-ticket-list";
import { FILTER_KEYS, without } from "../saved/filter-params";

export type FocusKey = "all" | "overdue" | "today" | "assigned" | "ai" | "approve";

export interface Focus {
  key: FocusKey;
  params: (today: string, me: string) => Record<string, string>;
}

export const FOCUS: readonly Focus[] = [
  { key: "all", params: () => ({}) },
  { key: "overdue", params: () => ({ overdue: "true" }) },
  { key: "today", params: (today) => ({ due_from: today, due_to: today, done: "false" }) },
  { key: "assigned", params: (_t, me) => ({ assignee_id: me, done: "false" }) },
  { key: "ai", params: () => ({ delegated: "true", done: "false" }) },
  { key: "approve", params: () => ({ approving: "true", done: "false" }) },
];

/** 札の key → 数（meta.counts の鍵）。all は数を持たない */
export const COUNT_OF: Readonly<Record<Exclude<FocusKey, "all">, keyof Counts>> = {
  overdue: "overdue",
  today: "today",
  assigned: "assigned",
  ai: "ai",
  approve: "approve",
};

/** 絞りとは別に残す欄（並び） */
const KEEP = ["sort"] as const;
const FOCUS_KEYS = FILTER_KEYS.filter((k) => !(KEEP as readonly string[]).includes(k));

const same = (a: Readonly<Record<string, string>>, b: Readonly<Record<string, string>>): boolean => {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
};

/** 今の組がどの札か（欄が表の 1 つと完全に同じならその key・欄が無ければ all・どれでもなければ null） */
export function focusOf(extra: ListExtra, today: string, me: string): FocusKey | null {
  const now = without(extra, KEEP);
  for (const f of FOCUS) {
    if (f.key === "assigned" && !me) continue;
    if (same(now, f.params(today, me))) return f.key;
  }
  return null;
}

/** 札を押した後の組（絞りの欄を全部替え、並びは残す） */
export function extraFor(extra: ListExtra, key: FocusKey, today: string, me: string): Record<string, string> {
  const f = FOCUS.find((x) => x.key === key);
  return { ...without(extra, FOCUS_KEYS), ...(f ? f.params(today, me) : {}) };
}
