"use client";
// ガントの棒と「開始・期限が無いもの」の読み（K-482）。口は一覧の listTickets だけ（K-473 の欄）。
//   読みは react-query（開発の二重の描きでも 1 回・同じ問い合わせを二重にしない）。
//   棒：view=all・scope_id・assignee_id・due_from＝見える範囲の最初の日・fields=start_on・sort=due_on・limit=100 を next_cursor が無くなるまで。
//     範囲・目盛り・担当者が替わったら読み直す。呼び出しごとの印で、遅れて届いた前の答えでは描かない。
//   期限なし：view=all・scope_id・due=none・done=false・limit=50 を 1 回（範囲を替えても読み直さない。「もう一度」と日を入れた後だけ）。
//   見える範囲（日本時間の暦）：日＝今日の週の月曜の 1 週前から 36 日・週＝今日の月曜の 4 週前から 20 週・月＝今月の 2 か月前から 12 か月。
//     「前へ」「次へ」は 日＝28 日・週＝8 週・月＝6 か月ずつ。enabled が偽（スマホ）なら何も読まない
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { PAGE_ERROR, errorCodeOf } from "@/components/k";
import { call } from "@/lib/api/call";
import { addDays } from "../due/due-dates";
import type { GanttScale } from "./gantt-inner";
import { shiftBy } from "./use-move-bars";

const BAR_LIMIT = 100;
const NONE_LIMIT = 50;
/** 目盛りごとの範囲の長さと送りの幅（日） */
const SPAN: Readonly<Record<GanttScale, { lead: number; length: number; step: number }>> = {
  day: { lead: 7, length: 36, step: 28 },
  week: { lead: 28, length: 140, step: 56 },
  month: { lead: 2, length: 12, step: 6 },
};

export type Row = Record<string, unknown>;
export interface Range {
  /** 最初の日と最後の日（どちらも含む・YYYY-MM-DD） */
  from: string;
  to: string;
}
export type LoadState = "loading" | "ok" | "error";

const weekday = (ymd: string): number => new Date(`${ymd}T00:00:00Z`).getUTCDay();
const mondayOf = (ymd: string): string => addDays(ymd, -((weekday(ymd) + 6) % 7));

/** 見える範囲（offset は「前へ」「次へ」を押した数・今日なら 0） */
export function rangeOf(scale: GanttScale, today: string, offset: number): Range {
  const s = SPAN[scale];
  if (scale === "month") {
    const first = `${today.slice(0, 7)}-01`;
    const from = shiftBy(first, offset * s.step - s.lead, "month");
    return { from, to: addDays(shiftBy(from, s.length, "month"), -1) };
  }
  const from = addDays(mondayOf(today), offset * s.step - s.lead);
  return { from, to: addDays(from, s.length - 1) };
}

const rowsOf = (data: unknown): Row[] => (Array.isArray(data) ? (data as Row[]) : []);
const cursorOf = (meta: Record<string, unknown>): string | null =>
  typeof meta["next_cursor"] === "string" && meta["next_cursor"] ? meta["next_cursor"] : null;

export interface GanttDataArgs {
  scopeId: string | null;
  range: Range;
  /** 担当者の id（空は「すべて」） */
  assignee: string;
  enabled: boolean;
}

export interface GanttData {
  state: LoadState;
  code: string;
  rows: readonly Row[];
  none: { state: LoadState; rows: readonly Row[]; more: boolean };
  /** 棒の口を読み直す */
  reload: () => void;
  /** 「もう一度」：棒も期限なしも読み直す */
  retry: () => void;
  /** 日を入れた行を期限なしから外す（口を呼ばない） */
  dropNone: (id: string) => void;
}

const ONCE = { retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false, staleTime: Infinity } as const;

async function readBars(scopeId: string | null, assignee: string, from: string): Promise<Row[]> {
  const out: Row[] = [];
  let cursor: string | null = null;
  do {
    const res = await call("listTickets", {
      query: {
        view: "all",
        ...(scopeId ? { scope_id: scopeId } : {}),
        ...(assignee ? { assignee_id: assignee } : {}),
        due_from: from,
        fields: "start_on",
        sort: "due_on",
        limit: BAR_LIMIT,
        ...(cursor ? { cursor } : {}),
      },
      screenId: "tickets",
    });
    if (!res.ok) throw new BarsError(errorCodeOf(res));
    out.push(...rowsOf(res.data));
    cursor = cursorOf(res.meta);
  } while (cursor);
  return out;
}

async function readNone(scopeId: string | null): Promise<{ rows: Row[]; more: boolean }> {
  const res = await call("listTickets", {
    query: { view: "all", ...(scopeId ? { scope_id: scopeId } : {}), due: "none", done: "false", limit: NONE_LIMIT },
    screenId: "tickets",
  });
  if (!res.ok) throw new BarsError(errorCodeOf(res));
  return { rows: rowsOf(res.data), more: cursorOf(res.meta) !== null };
}

class BarsError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export function useGanttData({ scopeId, range, assignee, enabled }: GanttDataArgs): GanttData {
  // 鍵ごとに答えを持つので、遅れて届いた前の範囲の答えは今の範囲に描かれない。読んでいる間は前の範囲の行を残す（範囲の外は画面が落とす）
  const bars = useQuery({
    queryKey: ["f7-gantt", "bars", scopeId, assignee, range.from],
    queryFn: () => readBars(scopeId, assignee, range.from),
    enabled,
    placeholderData: keepPreviousData,
    ...ONCE,
    // 前に見た範囲へ戻ったときも読み直す（「今日」で最初の範囲に戻すと口がもう一度飛ぶ）
    staleTime: 0,
  });
  const none = useQuery({
    queryKey: ["f7-gantt", "none", scopeId],
    queryFn: () => readNone(scopeId),
    enabled,
    ...ONCE,
  });
  const [dropped, setDropped] = useState<ReadonlySet<string>>(new Set());
  const { refetch: refetchBars } = bars;
  const { refetch: refetchNone } = none;
  const reload = useCallback(() => void refetchBars(), [refetchBars]);
  const retry = useCallback(() => {
    void refetchBars();
    void refetchNone();
  }, [refetchBars, refetchNone]);
  const dropNone = useCallback((id: string) => setDropped((s) => new Set([...s, id])), []);
  const state: LoadState = bars.isError ? "error" : bars.data ? "ok" : "loading";
  const code = bars.error instanceof BarsError ? bars.error.code : PAGE_ERROR.loadFailed;
  const noneRows = (none.data?.rows ?? []).filter((r) => !dropped.has(String(r["id"])));
  return {
    state,
    code,
    rows: bars.data ?? [],
    none: {
      state: none.isError ? "error" : none.data ? "ok" : "loading",
      rows: noneRows,
      more: none.data?.more ?? false,
    },
    reload,
    retry,
    dropNone,
  };
}
