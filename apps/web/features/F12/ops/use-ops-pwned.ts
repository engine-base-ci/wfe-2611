"use client";
// 照合が使えなかった登録の口を読む・書く（K-1019）。一覧は小窓が開いている間だけ（enabled）・鍵 ["k1019","pwned"]。
//   確かめたは 1 行ずつ（会社の id か確定前の pending）。どれも retry しない。外枠の数は入れ物（K-946）の鍵を書き換える（読み直さない）
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ackOpsPwned, fetchOpsPwned } from "@/lib/ops-pwned-api";
import { OPS_SHELL_KEY } from "./use-ops-shell";
import {
  ackOf,
  pwnedRowsOf,
  pwnedRowView,
  withPwnedCount,
  type OpsPwnedAckAnswer,
  type OpsPwnedRowAnswer,
} from "./pwned-shape";

export const PWNED_KEY = ["k1019", "pwned"] as const;

/** 読めなかった・書けなかった（conflict はもう確かめてあった 409） */
export class PwnedError extends Error {
  constructor(readonly kind: "conflict" | "failed") {
    super(`ops pwned ${kind}`);
  }
}

export function useOpsPwned(enabled: boolean) {
  return useQuery({
    queryKey: PWNED_KEY,
    queryFn: async (): Promise<OpsPwnedRowAnswer[]> => {
      const r = await fetchOpsPwned();
      const rows = r.kind === "ok" ? pwnedRowsOf(r.data) : null;
      if (!rows) throw new PwnedError("failed"); // 形が違うのもふつうの 0 件に見せない（G-15）
      return rows;
    },
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

/** 確かめた。成功したらその行を一覧の鍵から外し、外枠の数を答えの remaining に置き換える */
export function useAckOpsPwned() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<OpsPwnedAckAnswer> => {
      const r = await ackOpsPwned(id);
      if (r.kind === "conflict") throw new PwnedError("conflict");
      const ack = r.kind === "ok" ? ackOf(r.data) : null;
      if (!ack) throw new PwnedError("failed");
      return ack;
    },
    retry: false,
    onSuccess: (ack, id) => {
      qc.setQueryData<OpsPwnedRowAnswer[]>(PWNED_KEY, (rows) => rows?.filter((row) => pwnedRowView(row).id !== id));
      qc.setQueryData<{ kind?: string; data?: unknown }>(OPS_SHELL_KEY, (shell) =>
        shell?.kind === "ok" ? withPwnedCount(shell, ack.remaining) : shell,
      );
    },
    onError: (e) => {
      if (e instanceof PwnedError && e.kind === "conflict") void qc.invalidateQueries({ queryKey: PWNED_KEY });
    },
  });
}
