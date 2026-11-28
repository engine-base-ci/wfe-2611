"use client";
// 自分の設定（K-839）：口 getMe を 1 回読む（StrictMode でも 1 回・開き直すまで読み直さない）。
//   書いた答えは setQueryData で差し替える（読み直さない）。K-840・K-841 は reloadMe（読み直し）と replaceMe（差し替え）を使う
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { call, type CallErr } from "@/lib/api/call";
import type { MeAnswer } from "./me-shape";

export const ME_KEY = ["k839", "me"] as const;
export const ME_SCREEN = "account";

/** 読めなかった（口の断り・網の切れ） */
export class MeReadError extends Error {
  constructor(readonly err: CallErr | null) {
    super(err?.code ?? "network");
  }
}

async function readMe(): Promise<MeAnswer> {
  let r;
  try {
    r = await call("getMe", { screenId: ME_SCREEN });
  } catch {
    throw new MeReadError(null);
  }
  if (!r.ok) throw new MeReadError(r);
  return r.data as unknown as MeAnswer;
}

export function useMe(): UseQueryResult<MeAnswer, MeReadError> {
  return useQuery<MeAnswer, MeReadError>({
    queryKey: ME_KEY,
    queryFn: readMe,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

/** 答えの差し替え（fn は今の答えから次の答えを作る）と読み直し */
export function useMeCache(): {
  replaceMe: (fn: (now: MeAnswer) => MeAnswer) => void;
  reloadMe: () => Promise<void>;
} {
  const qc = useQueryClient();
  return {
    replaceMe: (fn) => qc.setQueryData<MeAnswer>(ME_KEY, (now) => (now ? fn(now) : now)),
    reloadMe: () => qc.invalidateQueries({ queryKey: ME_KEY }),
  };
}
