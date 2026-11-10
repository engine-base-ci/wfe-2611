"use client";
// AI に任せる（K-62）の読み直し。実行の一覧（listTicketRuns）と今の実行の 1 件（getActionRun）を @tanstack/react-query で読む。
//   3 秒ごとの読み直しは、今の実行が待っている・動いている・確認待ちの間だけ。それ以外は読みに行かない（K62-UI-017）
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
}
/** 走っている（終わっていない）実行の状態 */
export const ACTIVE = new Set(["queued", "running", "asking"]);
const POLL_MS = 3_000;

export const isActive = (r: Pick<RunView, "status"> | null | undefined): boolean => !!r && ACTIVE.has(r.status);

export function useRuns(ticketId: string) {
  const qc = useQueryClient();
  /** 任せた・別のタブで走っていた実行（答えの run_id）。一覧に出る前から、その実行を読む */
  const [pinned, setPinned] = useState<string | null>(null);
  const runKey = (id: string | null) => ["k62", "run", id] as const;
  const listKey = ["k62", "runs", ticketId] as const;
  const runs = useQuery({
    queryKey: listKey,
    queryFn: async (): Promise<RunView[]> => {
      const r = await call("listTicketRuns", { params: { id: ticketId }, screenId: "tickets" });
      if (!r.ok) throw new Error(r.code);
      return r.data as unknown as RunView[];
    },
    retry: false,
    refetchInterval: (q) => (isActive(q.state.data?.[0]) ? POLL_MS : false),
  });
  const currentId = pinned ?? runs.data?.[0]?.id ?? null;
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
    /** 任せた後・別のタブの実行に替わったとき：その実行を読み、一覧も読み直す */
    follow: async (runId: string) => {
      setPinned(runId);
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
