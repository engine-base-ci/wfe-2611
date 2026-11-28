// 記録を読む（K-825・口 listAuditEvents は K-823・K-850）。絞りごとに 1 回（StrictMode でも 1 回・自分では読み直さない）。
//   続きは next_cursor を cursor に付けて読み、下に足す。絞りを外して戻ったときは読み直す（使わなくなった答えはすぐ捨てる）。
//   口が断ったときは CallErr ごと投げ、入れ物が 403・503 などを出し分ける
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { call, type CallErr } from "@/lib/api/call";
import { queryOf, type AuditAnswer, type AuditFilters } from "./audit-shape";

export const SCREEN = "audit";

/** 読めなかったときの答え */
export class AuditLoadError extends Error {
  constructor(readonly result: Pick<CallErr, "status" | "kind" | "code">) {
    super(`listAuditEvents ${result.status} ${result.code}`);
  }
}

async function readPage(f: AuditFilters, cursor: string | null): Promise<AuditAnswer> {
  const query = { ...queryOf(f), ...(cursor ? { cursor } : {}) };
  const r = await call("listAuditEvents", { query, screenId: SCREEN });
  if (!r.ok) throw new AuditLoadError(r);
  return r.data as unknown as AuditAnswer;
}

/** enabled が false の間（役を読んでいる・閲覧のみ）は口を呼ばない */
export function useAudit(f: AuditFilters, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ["k825", "audit", f.kind, f.q, f.member, f.ticket] as const,
    queryFn: ({ pageParam }) => readPage(f, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last: AuditAnswer) => last.next_cursor ?? undefined,
    enabled,
    // 絞りを変えた間は前の並びを出したまま（形を崩さない）
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

/** 口の 403（権限が無い・外された直後） */
export const isForbidden = (e: unknown): boolean => e instanceof AuditLoadError && e.result.status === 403;
