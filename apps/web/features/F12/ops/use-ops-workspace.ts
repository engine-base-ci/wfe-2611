"use client";
// 運営の 1 社の画面の口を読む（K-971）。1 社は getOpsWorkspace（鍵 ["k971","ws",id]）。
//   タブの口（メンバー・プランと請求・問い合わせ・記録）は開いたタブのときだけ（enabled）・鍵 ["k971",<口>,id]。
//   どれも retry しない・窓に戻っても読み直さない（React Query の同じ鍵で StrictMode でも 1 回）。
//   外枠の答え（caps）は入れ物（K-946）と同じ鍵で、ここからは読み直さない（K-965 と同じ形）
import { useQuery } from "@tanstack/react-query";
import { call } from "@/lib/api/call";
import { fetchOpsShell } from "@/lib/ops-shell-api";
import { OPS_SHELL_KEY } from "./use-ops-shell";
import type { WsAudit, WsBilling, WsDetail, WsInquiry, WsMember } from "./ws-tenant-shape";

const SCREEN = "ops-tenant";

/** 読めなかった理由（404 は見つからない・ほかは読めなかった） */
export class WsReadError extends Error {
  constructor(readonly status: number) {
    super(`ops workspace read failed: ${status}`);
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const isArr = (v: unknown): v is unknown[] => Array.isArray(v);

/** 口を呼び、data を確かめて返す（網の切れ・失敗・形の違いは WsReadError） */
type Answer = { ok: true; data: unknown } | { ok: false; status: number };
async function read<T>(run: () => Promise<Answer>, ok: (d: unknown) => boolean): Promise<T> {
  let r: Answer;
  try {
    r = await run();
  } catch {
    throw new WsReadError(0); // 網が切れた
  }
  if (!r.ok) throw new WsReadError(r.status);
  if (!ok(r.data)) throw new WsReadError(-1); // 形が違う
  return r.data as T;
}

const NO_REFETCH = { retry: false, refetchOnWindowFocus: false } as const;
export const wsKey = (id: string) => ["k971", "ws", id] as const;
export type WsTabApi = "members" | "billing" | "inquiries" | "audit";
export const wsTabKey = (api: WsTabApi, id: string) => ["k971", api, id] as const;

/** 外枠の答え（入れ物が読んだ物をそのまま使う） */
export function useOpsShellCaps() {
  return useQuery({
    queryKey: OPS_SHELL_KEY,
    queryFn: fetchOpsShell,
    retry: false,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

/** 外枠の答えの operator.caps（読めなければ空＝できることが無い） */
export function capsOf(data: unknown): string[] {
  const d = data as { kind?: string; data?: { operator?: { caps?: unknown } } } | undefined;
  const caps = d?.kind === "ok" ? d.data?.operator?.caps : undefined;
  return Array.isArray(caps) ? caps.filter((c): c is string => typeof c === "string") : [];
}

export function useOpsWorkspace(id: string) {
  return useQuery({
    queryKey: wsKey(id),
    queryFn: () =>
      read<WsDetail>(
        () => call("getOpsWorkspace", { params: { id }, screenId: SCREEN }),
        (d) => isObj(d) && typeof d["name"] === "string" && isArr(d["recent"]),
      ),
    ...NO_REFETCH,
  });
}

export function useWsMembers(id: string, enabled: boolean) {
  return useQuery({
    queryKey: wsTabKey("members", id),
    queryFn: () => read<WsMember[]>(() => call("listOpsWorkspaceMembers", { params: { id }, screenId: SCREEN }), isArr),
    enabled,
    ...NO_REFETCH,
  });
}

export function useWsBilling(id: string, enabled: boolean) {
  return useQuery({
    queryKey: wsTabKey("billing", id),
    queryFn: () =>
      read<WsBilling>(
        () => call("getOpsWorkspaceBilling", { params: { id }, screenId: SCREEN }),
        (d) => isObj(d) && isObj(d["members"]) && isArr(d["invoices"]),
      ),
    enabled,
    ...NO_REFETCH,
  });
}

export function useWsInquiries(id: string, enabled: boolean) {
  return useQuery({
    queryKey: wsTabKey("inquiries", id),
    queryFn: () =>
      read<WsInquiry[]>(() => call("listOpsWorkspaceInquiries", { params: { id }, screenId: SCREEN }), isArr),
    enabled,
    ...NO_REFETCH,
  });
}

export function useWsAudit(id: string, enabled: boolean) {
  return useQuery({
    queryKey: wsTabKey("audit", id),
    queryFn: () => read<WsAudit[]>(() => call("listOpsWorkspaceAudit", { params: { id }, screenId: SCREEN }), isArr),
    enabled,
    ...NO_REFETCH,
  });
}

/** 本人確認のメールの送り直し（resendOpsVerification・体 {}）の結果 */
export type ResendOutcome = { kind: "sent" } | { kind: "refused"; code: string } | { kind: "failed" };
export async function resendVerification(id: string, mid: string): Promise<ResendOutcome> {
  try {
    const r = await call("resendOpsVerification", { params: { id, mid }, body: {}, screenId: SCREEN });
    if (r.ok) return { kind: "sent" };
    return r.status === 409 ? { kind: "refused", code: r.code } : { kind: "failed" };
  } catch {
    return { kind: "failed" }; // 網が切れた
  }
}
