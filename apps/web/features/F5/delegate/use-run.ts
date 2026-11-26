"use client";
// AI に任せる（K-62）の読み直し。実行の一覧（listTicketRuns）と今の実行の 1 件（getActionRun）を @tanstack/react-query で読む。
//   3 秒ごとの読み直しは、今の実行が待っている・動いている・確認待ちの間だけ。それ以外は読みに行かない（K62-UI-017）
//   今の実行は一覧の先頭（いちばん新しい実行）。任せた直後だけ、一覧に出る前の実行を答えの run_id で読む（K63-UI-064〜067）
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { call } from "@/lib/api/call";

export interface RunView {
  id: string;
  ticket_id: string;
  phase: "make" | "execute" | null;
  status: string;
  by: { member_id: string; display_name: string } | null;
  pc: string | null;
  silent: boolean;
  last_event_at: string | null;
  progress: string | null;
  stopped_reason: string | null;
  return_reason: string | null;
  started_at: string | null;
  finished_at: string | null;
  checks: { state: string } | null;
  /** 止まった理由の種類（K-485 が実行の記録に足す・古い答えには無い） */
  reason_kind?: string | null;
  /** 止まった実行を人が引き取った時刻（K-485 が足す・古い答えには無い） */
  taken_over_at?: string | null;
}
/** 走っている（終わっていない）実行の状態 */
export const ACTIVE = new Set(["queued", "running", "asking"]);
const POLL_MS = 3_000;

export const isActive = (r: Pick<RunView, "status"> | null | undefined): boolean => !!r && ACTIVE.has(r.status);

interface Pinned {
  id: string;
  /** 任せたときの一覧の先頭（無ければ null） */
  headWas: string | null;
}
/** 任せた実行をまだ id で読むか：一覧にその id が無く、一覧の先頭が任せたときのままの間だけ */
function isPinned(pinned: Pinned | null, list: RunView[] | undefined): boolean {
  if (!pinned) return false;
  if (list?.some((x) => x.id === pinned.id)) return false;
  return (list?.[0]?.id ?? null) === pinned.headWas;
}

/** 実行の一覧の問い合わせ（詳細の最初の読み込みと、AI に任せるの帯の「今の実行を引く」で分け合う・口は 1 本・K-235） */
export const runsKey = (ticketId: string) => ["k62", "runs", ticketId] as const;
async function readRuns(ticketId: string): Promise<RunView[]> {
  const r = await call("listTicketRuns", { params: { id: ticketId }, screenId: "tickets" });
  if (!r.ok) throw new Error(r.code);
  return r.data as unknown as RunView[];
}
/** 実行の一覧を今読み直す（同じ問い合わせの器を新しくする）。読めなければ null */
export const fetchRuns = (qc: QueryClient, ticketId: string): Promise<RunView[] | null> =>
  qc
    .fetchQuery({ queryKey: runsKey(ticketId), queryFn: () => readRuns(ticketId), retry: false, staleTime: 0 })
    .catch(() => null);

/** 詳細の実行の一覧と今の実行。enabled は詳細と同時に最初に読むか（道の id で引けるので詳細の答えを待たない・K-235） */
export function useRuns(ticketId: string, enabled = true) {
  const qc = useQueryClient();
  /** 任せた・別のタブで走っていた実行（答えの run_id）と、そのときの一覧の先頭。一覧に出るまでの間だけ、その実行を読む */
  const [pinned, setPinned] = useState<Pinned | null>(null);
  const runKey = (id: string | null) => ["k62", "run", id] as const;
  const listKey = runsKey(ticketId);
  const runs = useQuery({
    queryKey: listKey,
    queryFn: () => readRuns(ticketId),
    enabled,
    retry: false,
    // 先頭が走っている間と、任せた実行がまだ一覧に出ていない間（読み直しが失敗しても次で追いつく・K63-UI-072）
    refetchInterval: (q) => (isActive(q.state.data?.[0]) || pinned !== null ? POLL_MS : false),
  });
  const headId = runs.data?.[0]?.id ?? null;
  const stillPinned = isPinned(pinned, runs.data);
  // 一覧に出た・一覧の先頭が別の実行に替わった：手放す（承認・差し戻しの後の新しい実行を、古い id で隠さない）
  if (pinned && !stillPinned) setPinned(null);
  const currentId = stillPinned && pinned ? pinned.id : headId;
  const run = useQuery({
    queryKey: runKey(currentId),
    enabled: currentId !== null,
    queryFn: async (): Promise<RunView> => {
      const r = await call("getActionRun", { params: { id: currentId! }, screenId: "tickets" });
      if (!r.ok) throw new Error(r.code);
      return r.data as unknown as RunView;
    },
    retry: false,
    refetchInterval: (q) => (isActive(q.state.data) ? POLL_MS : false),
  });
  const current = run.data ?? runs.data?.find((x) => x.id === currentId) ?? null;
  return {
    runs: runs.data ?? null,
    current,
    /** 実行の様子が分かっているか：一覧を 1 回は読み終え、任せた実行が一覧に出ていて、今の実行の中身が届いている（K63-UI-069〜071） */
    known: runs.data !== undefined && !stillPinned && (currentId === null || current !== null),
    /** 任せた後・別のタブの実行に替わったとき：その実行を読み、一覧も読み直す */
    follow: async (runId: string) => {
      setPinned({ id: runId, headWas: headId });
      await qc.invalidateQueries({ queryKey: listKey });
    },
    reload: async () => {
      await qc.invalidateQueries({ queryKey: ["k62"] });
    },
  };
}

/** 日本時間の「11/7 10:00」 */
const JST = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
export const jst = (iso: string | null): string => (iso ? JST.format(new Date(iso)) : "—");
