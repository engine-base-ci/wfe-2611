"use client";
// 運営の人の口を読む・書く（K-986）。一覧は listOpsMembers（K-985）を 1 つの鍵で 1 回（StrictMode でも 1 回）。
//   書く口は addOpsMember（K-985）・updateOpsMemberCaps・removeOpsMember（K-1009）。印は顧客の画面と同じ Bearer（call）。
//   401 は顧客のログインへ送らない（keepOn401・入れ物と同じく運営のログインへ移す）
import { useQuery } from "@tanstack/react-query";
import { call, type CallResult } from "@/lib/api/call";
import { rowsOf, type OpsMemberRow } from "./team-shape";

const SCREEN = "ops-team";
export const TEAM_KEY = ["k986", "team"] as const;

/** 一覧の口の結果：読めた／入り直し／権限が無い（403）／それ以外の失敗（503・網の切れ・形が違う） */
export type TeamListResult =
  { kind: "ok"; rows: OpsMemberRow[] } | { kind: "login" } | { kind: "forbidden" } | { kind: "failed" };

export async function fetchTeam(): Promise<TeamListResult> {
  let r: CallResult<"listOpsMembers">;
  try {
    r = await call("listOpsMembers", { screenId: SCREEN, keepOn401: true });
  } catch {
    return { kind: "failed" }; // 網が切れた
  }
  if (r.ok) {
    const rows = rowsOf(r.data as unknown);
    return rows ? { kind: "ok", rows } : { kind: "failed" };
  }
  if (r.status === 401) return { kind: "login" };
  if (r.status === 403) return { kind: "forbidden" };
  return { kind: "failed" };
}

export function useOpsTeam() {
  return useQuery({ queryKey: TEAM_KEY, queryFn: fetchTeam, retry: false, refetchOnWindowFocus: false });
}

export const addMember = (body: { email: string; caps: string[] }) =>
  call("addOpsMember", { body: body as never, screenId: SCREEN, keepOn401: true });

export const updateCaps = (id: string, caps: string[]) =>
  call("updateOpsMemberCaps", { params: { id }, body: { caps } as never, screenId: SCREEN, keepOn401: true });

export const removeMember = (id: string) =>
  call("removeOpsMember", { params: { id }, screenId: SCREEN, keepOn401: true });

/** 取り直しの小窓の形（パスワードの有る無し・2 段階） */
export async function stepUpShape(): Promise<{ withCode: boolean; withPasskey: boolean }> {
  const s = await call("getMySecurity", { screenId: SCREEN, keepOn401: true }).catch(() => null);
  const sec = s?.ok ? s.data : {};
  return { withCode: sec.two_factor === true, withPasskey: sec.has_password === false };
}
