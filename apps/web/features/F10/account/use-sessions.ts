"use client";
// ログインと安全の「入っている端末」（K-842）：口 listMySessions を 1 回読む（StrictMode でも 1 回・切ったあとだけ読み直す）。
//   切る 2 口（revokeMySession・revokeOtherSessions）は答えの種類にして返す（取り直し・断り・網の切れは呼ぶ側が出し分ける）
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useCallback } from "react";
import { call, type CallErr } from "@/lib/api/call";
import type { SessionsAnswer } from "./sessions-shape";

export const SESSIONS_KEY = ["k842", "sessions"] as const;
export const SESSIONS_SCREEN = "account";

/** 読めなかった（口の断り・網の切れ＝err が null） */
export class SessionsReadError extends Error {
  constructor(readonly err: CallErr | null) {
    super(err?.code ?? "network");
  }
}

async function readSessions(): Promise<SessionsAnswer> {
  let r;
  try {
    r = await call("listMySessions", { screenId: SESSIONS_SCREEN });
  } catch {
    throw new SessionsReadError(null);
  }
  if (!r.ok) throw new SessionsReadError(r);
  const data = r.data as unknown as Partial<SessionsAnswer> | null;
  return { sessions: data?.sessions ?? [], events: data?.events ?? [] };
}

/** enabled が偽の間は読まない（ログインを確かめてから並べて始める） */
export function useSessions(enabled = true): UseQueryResult<SessionsAnswer, SessionsReadError> {
  return useQuery<SessionsAnswer, SessionsReadError>({
    queryKey: SESSIONS_KEY,
    queryFn: readSessions,
    enabled,
    retry: false,
    // 読めなかった後に、同じ鍵を読む 2 つ目の部品（区画）が後から付いても読み直さない（既定の retryOnMount は真で、
    //   画面の外枠が先に読んで 503 → 区画が付いた時に黙ってもう 1 回読み、「もう一度読む」を押す前に一覧が出ていた・K842-UI-014）
    retryOnMount: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export type RevokeResult =
  | { kind: "ok"; revoked: number }
  | { kind: "step_up"; err: CallErr }
  | { kind: "unauthenticated" }
  | { kind: "not_found" }
  | { kind: "conflict"; err: CallErr }
  | { kind: "down" }
  | { kind: "failed"; err: CallErr }
  | { kind: "offline" };

function resultOf(r: CallErr): RevokeResult {
  if (r.kind === "step_up") return { kind: "step_up", err: r };
  if (r.kind === "unauthenticated") return { kind: "unauthenticated" };
  if (r.kind === "not_found") return { kind: "not_found" };
  if (r.kind === "conflict") return { kind: "conflict", err: r };
  if (r.status === 503) return { kind: "down" };
  return { kind: "failed", err: r };
}

/** 1 つ切る（401 は呼ぶ側が入り直しへ送る） */
export async function revokeOne(id: string): Promise<RevokeResult> {
  try {
    const r = await call("revokeMySession", { params: { id }, screenId: SESSIONS_SCREEN, keepOn401: true });
    return r.ok ? { kind: "ok", revoked: 1 } : resultOf(r);
  } catch {
    return { kind: "offline" };
  }
}

/** この端末以外をすべて切る（答えの revoked＝切った数） */
export async function revokeOthers(fallback: number): Promise<RevokeResult> {
  try {
    const r = await call("revokeOtherSessions", { body: {}, screenId: SESSIONS_SCREEN, keepOn401: true });
    if (!r.ok) return resultOf(r);
    const n = (r.data as unknown as { revoked?: unknown } | null)?.revoked;
    return { kind: "ok", revoked: typeof n === "number" ? n : fallback };
  } catch {
    return { kind: "offline" };
  }
}

/** 一覧の読み直し（切ると安全の記録も増えるので、答えで差し替えず読み直す） */
export function useReloadSessions(): () => Promise<void> {
  const qc = useQueryClient();
  return useCallback(() => qc.invalidateQueries({ queryKey: SESSIONS_KEY }), [qc]);
}
