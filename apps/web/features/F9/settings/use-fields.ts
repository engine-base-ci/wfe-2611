// チケットの設定「項目」の口（K-709・読むのは K-706 の listTicketFieldMaster・直すのは K-717 の updateTicketField）。
//   読むのは 1 画面 1 回（StrictMode でも 1 回・窓に戻っても読み直さない）。種別は K-707 の useKinds を同じ段で同時に読む（直列にしない）。
//   書いて通ったら invalidate で 1 回読み直す（別 GET で画面と答えを合わせる）。404（開いている間に消された）も読み直す。
//   書く口の答えは「通った／断られた（CallErr）／網が切れた（null）」の 3 つで返し、出し分けは画面が決める
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { Ops } from "@kaname/contracts";
import { call, type CallErr } from "@/lib/api/call";
import type { FieldAnswer, FieldPatch } from "./fields-shape";

export const FIELDS_KEY = ["k709", "fields"] as const;
const SCREEN = "masters";

/** 読めなかったときの Error（result は口の断り・網の切れは null） */
export type FieldsLoadError = Error & { result: CallErr | null };

export function useFieldMaster() {
  return useQuery<FieldAnswer[], FieldsLoadError>({
    queryKey: FIELDS_KEY,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<FieldAnswer[]> => {
      let r;
      try {
        r = await call("listTicketFieldMaster", { screenId: SCREEN });
      } catch {
        throw Object.assign(new Error("network"), { result: null });
      }
      if (!r.ok) throw Object.assign(new Error(r.code), { result: r });
      return (r.data ?? []) as unknown as FieldAnswer[];
    },
  });
}

export type SaveOutcome = { ok: true } | { ok: false; err: CallErr | null };

/** 項目を直す口を呼び、通ったら（404 のときも）項目を読み直す */
export function useSaveField() {
  const qc = useQueryClient();
  return useCallback(
    async (id: string, body: FieldPatch): Promise<SaveOutcome> => {
      let r;
      try {
        r = await call("updateTicketField", {
          params: { id },
          body: body as unknown as Ops["updateTicketField"]["body"],
          screenId: SCREEN,
        });
      } catch {
        return { ok: false, err: null };
      }
      if (!r.ok) {
        if (r.status === 404) void qc.invalidateQueries({ queryKey: FIELDS_KEY });
        return { ok: false, err: r };
      }
      await qc.invalidateQueries({ queryKey: FIELDS_KEY });
      return { ok: true };
    },
    [qc],
  );
}
