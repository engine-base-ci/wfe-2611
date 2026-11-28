// チケットの設定「種別」の口（K-707・口は K-704）：読む useKinds と、書く 3 つ（直す・足す・消す）。
//   読むのは 1 画面 1 回（StrictMode でも 1 回・窓に戻っても読み直さない）。書いて通ったら invalidate で 1 回読み直す（別 GET で画面と答えを合わせる）。
//   書く口の答えは「通った／断られた（CallErr）／網が切れた（null）」の 3 つで返し、出し分けは画面が決める
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { Ops } from "@kaname/contracts";
import { call, type CallErr } from "@/lib/api/call";
import type { KindAnswer, KindPatch, ToneKey } from "./kinds-shape";

export const KINDS_KEY = ["k707", "kinds"] as const;
export const SCREEN = "masters";

/** 読めなかったときの Error（result は口の断り・網の切れは null） */
export type KindsLoadError = Error & { result: CallErr | null };

export function useKinds() {
  return useQuery<KindAnswer[], KindsLoadError>({
    queryKey: KINDS_KEY,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<KindAnswer[]> => {
      let r;
      try {
        r = await call("listTicketKinds", { screenId: SCREEN });
      } catch {
        throw Object.assign(new Error("network"), { result: null });
      }
      if (!r.ok) throw Object.assign(new Error(r.code), { result: r });
      return (r.data ?? []) as unknown as KindAnswer[];
    },
  });
}

export type WriteOutcome<T> = { ok: true; data: T } | { ok: false; err: CallErr | null };

/** 書く口を呼び、通ったら種別を読み直す */
function useWrite<A extends unknown[], T>(run: (...a: A) => Promise<{ ok: true; data: T } | CallErr>) {
  const qc = useQueryClient();
  return useCallback(
    async (...a: A): Promise<WriteOutcome<T>> => {
      let r;
      try {
        r = await run(...a);
      } catch {
        return { ok: false, err: null };
      }
      if (!r.ok) {
        if (r.status === 404) void qc.invalidateQueries({ queryKey: KINDS_KEY });
        return { ok: false, err: r };
      }
      await qc.invalidateQueries({ queryKey: KINDS_KEY });
      return { ok: true, data: r.data };
    },
    // run は下の 3 つの決まった関数（呼ぶたびに作り直さない）
    [qc],
  );
}

export const useSaveKind = () =>
  useWrite(async (id: string, body: KindPatch) =>
    call("updateTicketKind", { params: { id }, body: body as Ops["updateTicketKind"]["body"], screenId: SCREEN }),
  );

export const useCreateKind = () =>
  useWrite(async (name: string, colorKey: ToneKey) =>
    call("createTicketKind", { body: { name, color_key: colorKey }, screenId: SCREEN }),
  );

export const useDeleteKind = () =>
  useWrite(async (id: string) => call("deleteTicketKind", { params: { id }, screenId: SCREEN }));
