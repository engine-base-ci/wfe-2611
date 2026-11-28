"use client";
// 探す口（search）の読み（K-471）。打つのをやめて 200 ミリ秒たった字で口を 1 回呼ぶ（打つたびには呼ばない）。
//   同じ字の答えは 60 秒使い回す。鍵は字ごとなので、遅れて届いた前の字の答えは別の鍵に入るだけで、いまの字の結果を書き換えない。
//   探した字は保存しない・ログに出さない
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { errorCodeOf } from "@/components/k/error-of";
import { call } from "@/lib/api/call";
import { isHit, type ApiHit } from "./search-hit-view";

/** 打つのをやめてから口を呼ぶまでの間 */
export const SEARCH_DELAY_MS = 200;
/** 同じ字の答えを使い回す長さ */
export const SEARCH_STALE_MS = 60_000;
/** 口に送る字の上限（口の q の上限と同じ） */
export const SEARCH_MAX_CHARS = 100;
/** 種類ごとの上限（口の limit） */
const SEARCH_LIMIT = 5;

/** 値が変わってから ms たったら返す（その間に変われば数え直す） */
export function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** 口に送る字：前後の空白を取って 100 字まで */
export const queryOf = (q: string): string => q.trim().slice(0, SEARCH_MAX_CHARS);

async function readSearch(q: string): Promise<ApiHit[]> {
  const r = await call("search", { query: { q, limit: SEARCH_LIMIT }, screenId: "tickets" });
  if (!r.ok) throw new Error(errorCodeOf(r));
  return (Array.isArray(r.data) ? (r.data as unknown[]) : []).filter(isHit);
}

export interface SearchRead {
  /** 口に送った字（空なら口を呼んでいない） */
  q: string;
  hits: ApiHit[] | undefined;
  failed: boolean;
  retry: () => void;
}

/** q は打った字のまま（間をおくのはここ） */
export function useSearch(query: string): SearchRead {
  const q = queryOf(useDebounced(query, SEARCH_DELAY_MS));
  const r = useQuery({
    queryKey: ["f7-search", q],
    queryFn: () => readSearch(q),
    enabled: q !== "",
    staleTime: SEARCH_STALE_MS,
    retry: false,
  });
  return {
    q,
    hits: r.data,
    failed: r.isError,
    retry: () => {
      void r.refetch();
    },
  };
}
