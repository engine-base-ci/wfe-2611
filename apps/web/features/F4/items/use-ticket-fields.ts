"use client";
// 会社の項目のマスタを読む道具（K-569）。種別の口 listTicketKinds（K-560）の答えの各種別の fields から読み、
//   listTicketFields（K-563）は呼ばない（作る面の口の数を増やさない・2026-11-22 のまとめ役の決め）。
//   種別の口は頁の中で 1 回だけ読んで共有する（鍵 ["ticket_kinds"]・K-442 の種別の欄も同じ道具）。失敗で自動に読み直さず、「読み直す」で 1 回
import { useQuery } from "@tanstack/react-query";
import { call } from "@/lib/api/call";
import type { TicketField } from "./field-values";

export interface KindWithFields {
  id: string;
  name: string;
  fields: TicketField[];
}

export const TICKET_KINDS_KEY = ["ticket_kinds"] as const;

class KindsError extends Error {
  constructor(readonly status: number) {
    super(`ticket_kinds ${status}`);
  }
}

async function readKinds(): Promise<KindWithFields[]> {
  const r = await call("listTicketKinds", { screenId: "tickets" });
  if (!r.ok) throw new KindsError(r.status);
  return (r.data as unknown as KindWithFields[]).map((k) => ({
    id: k.id,
    name: k.name,
    fields: Array.isArray(k.fields) ? k.fields : [],
  }));
}

export type FieldsState = "loading" | "ok" | "error";

/** 種別の口を 1 回読む（読み直しは retry() で 1 回） */
export function useTicketKinds() {
  const q = useQuery({
    queryKey: TICKET_KINDS_KEY,
    queryFn: readKinds,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  // 読んでいる間（最初と、失敗の後の読み直し）は loading。読めなければ error
  const state: FieldsState = q.data ? "ok" : q.isFetching ? "loading" : q.isError ? "error" : "loading";
  return { kinds: q.data ?? [], state, retry: () => void q.refetch() };
}

/** その種別の会社の項目（答えの並びのまま） */
export function useTicketFields(kindId: string | null) {
  const { kinds, state, retry } = useTicketKinds();
  const fields = kinds.find((k) => k.id === kindId)?.fields ?? [];
  return { fields, state, retry };
}
