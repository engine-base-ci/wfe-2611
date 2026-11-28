"use client";
// 分身の部屋の読み（K-755）：getMyClone・getCloneNow・getCloneGrowth を 1 回ずつ（ONCE）。3 本は同時に始める（直列にしない）。
//   頭の読み（clone-me）は外枠とようす・話す（K-762）・やったこと（K-756）が同じ鍵で分け合う（二重に読まない）。
//   答えの形は 11_tickets/K-753.md・K-754.md の「答えの形」（契約の型はその葉が替える。ここでは答えの形の名前どおりに受ける）
import { useQuery } from "@tanstack/react-query";
import { ONCE } from "@/features/F4/create-ticket/ticket-shell";
import { call } from "@/lib/api/call";
import { getToken } from "@/lib/api/client";
import type { NextState } from "./room-words";

export type ClonePcState = "none" | "live" | "asleep";
export interface ClonePc {
  state: ClonePcState;
  label: string | null;
}
export interface CloneMe {
  name: string;
  full_name: string;
  /** YYYY-MM-DD */
  since: string;
  pc: ClonePc;
}
export interface CloneCurrent {
  ticket_id: string;
  ticket_number: string;
  title: string;
  started_at: string;
  progress: string | null;
}
export interface CloneNext {
  ticket_id: string;
  ticket_number: string;
  title: string;
  state: NextState;
}
export interface CloneNowAnswer {
  pc: ClonePc;
  current: CloneCurrent | null;
  next: CloneNext[];
  waiting_approvals: number;
  stopped: number;
}
export interface CloneGrowthAnswer {
  assigned: number;
  pass_rate: number | null;
  pass_rate_last_week: number | null;
  work_seconds: number;
}

export const CLONE_ME_KEY = ["k755", "clone-me"] as const;
export const CLONE_NOW_KEY = ["k755", "clone-now"] as const;
export const CLONE_GROWTH_KEY = ["k755", "clone-growth"] as const;
const SCREEN = "ai-activity";

class CloneReadError extends Error {}

async function read<T>(op: "getMyClone" | "getCloneNow" | "getCloneGrowth"): Promise<T> {
  const r = await call(op, { screenId: SCREEN });
  if (!r.ok) throw new CloneReadError(r.code);
  return r.data as unknown as T;
}

const signedIn = (): boolean => typeof window !== "undefined" && Boolean(getToken());

export function useCloneMe() {
  return useQuery({ queryKey: CLONE_ME_KEY, enabled: signedIn(), ...ONCE, queryFn: () => read<CloneMe>("getMyClone") });
}
export function useCloneNow() {
  return useQuery({
    queryKey: CLONE_NOW_KEY,
    enabled: signedIn(),
    ...ONCE,
    queryFn: () => read<CloneNowAnswer>("getCloneNow"),
  });
}
export function useCloneGrowth() {
  return useQuery({
    queryKey: CLONE_GROWTH_KEY,
    enabled: signedIn(),
    ...ONCE,
    queryFn: () => read<CloneGrowthAnswer>("getCloneGrowth"),
  });
}
