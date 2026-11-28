"use client";
// カレンダーの読み（K-481）：月の範囲と、期限が決まっていないもの。どちらも一覧の口 listTickets（K-473）を呼ぶだけ。
//   月：view=all・scope_id・assignee_id・due_from／due_to＝格子の最初と最後の日・sort=due_on・limit=100 を、next_cursor が無くなるまで読む（読み切るまで格子を出さない）。
//   期限なし：view=all・scope_id・due=none・done=false・limit=50 を 1 回（月・担当者を替えても読み直さない。「もう一度」か、期限なしの行を動かした後だけ）。
//   問い合わせの鍵ごとに覚えるので、遅れて届いた前の月の答えで今の月を描かない
import { useQuery } from "@tanstack/react-query";
import { errorCodeOf } from "@/components/k";
import { call } from "@/lib/api/call";
import type { ListItem } from "@/features/F4/ticket-list/use-ticket-list";
import { gridRange } from "./month";

const MONTH_LIMIT = 100;
const NONE_LIMIT = 50;
/** 自分で読み直す（窓に戻った・つながり直したで勝手に読まない・失敗を勝手にやり直さない） */
const OWN = { retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false } as const;

export interface CalendarQuery {
  scopeId: string | null;
  year: number;
  month: number;
  /** 担当者の絞り（人の id・null はすべて） */
  assignee: string | null;
}

export type ReadState<T> = { state: "loading" } | { state: "error"; code: string } | ({ state: "ok" } & T);

export interface CalendarData {
  month: ReadState<{ rows: readonly ListItem[] }>;
  none: ReadState<{ rows: readonly ListItem[]; more: boolean }>;
  reloadMonth: () => void;
  reloadNone: () => void;
}

/** 口の断りを番号にして投げる（読む側は番号で文を引く） */
class ReadError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

const listOf = (data: unknown): ListItem[] => (Array.isArray(data) ? (data as ListItem[]) : []);
const nextOf = (meta: Record<string, unknown>): string | null =>
  typeof meta["next_cursor"] === "string" && meta["next_cursor"] ? meta["next_cursor"] : null;

async function readMonth(q: CalendarQuery): Promise<ListItem[]> {
  const { from, to } = gridRange(q.year, q.month);
  const base = {
    view: "all",
    ...(q.scopeId ? { scope_id: q.scopeId } : {}),
    ...(q.assignee ? { assignee_id: q.assignee } : {}),
    due_from: from,
    due_to: to,
    sort: "due_on",
    limit: MONTH_LIMIT,
  };
  const rows: ListItem[] = [];
  let cursor: string | null = null;
  do {
    const r = await call("listTickets", { query: cursor ? { ...base, cursor } : base, screenId: "tickets" });
    if (!r.ok) throw new ReadError(errorCodeOf(r));
    rows.push(...listOf(r.data));
    cursor = nextOf(r.meta);
  } while (cursor);
  return rows;
}

async function readNone(scopeId: string | null): Promise<{ rows: ListItem[]; more: boolean }> {
  const r = await call("listTickets", {
    query: { view: "all", ...(scopeId ? { scope_id: scopeId } : {}), due: "none", done: "false", limit: NONE_LIMIT },
    screenId: "tickets",
  });
  if (!r.ok) throw new ReadError(errorCodeOf(r));
  return { rows: listOf(r.data), more: nextOf(r.meta) !== null };
}

const codeOf = (e: unknown): string =>
  e instanceof ReadError ? e.code : errorCodeOf({ kind: "failed", code: "", status: 0 });

export function useCalendarData(q: CalendarQuery): CalendarData {
  const { from, to } = gridRange(q.year, q.month);
  const month = useQuery({
    queryKey: ["f7-calendar", "month", q.scopeId, from, to, q.assignee],
    queryFn: () => readMonth(q),
    ...OWN,
    // 前に見た月へ戻ったときは読み直す（覚えた答えを先に出し、裏で読み直す・K481-UI-003）。全体の既定の 5 秒は使わない
    staleTime: 0,
  });
  const none = useQuery({
    queryKey: ["f7-calendar", "none", q.scopeId],
    queryFn: () => readNone(q.scopeId),
    ...OWN,
  });
  return {
    month: month.data
      ? { state: "ok", rows: month.data }
      : month.isError
        ? { state: "error", code: codeOf(month.error) }
        : { state: "loading" },
    none: none.data
      ? { state: "ok", rows: none.data.rows, more: none.data.more }
      : none.isError
        ? { state: "error", code: codeOf(none.error) }
        : { state: "loading" },
    reloadMonth: () => void month.refetch(),
    reloadNone: () => void none.refetch(),
  };
}
