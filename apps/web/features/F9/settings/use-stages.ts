// チケットの設定「状態」の口（K-708・口は K-705）：読む useStages と、書く 4 つ（直す・足す・消す・並べる）。
//   読むのは 1 画面 1 回（StrictMode でも 1 回・窓に戻っても読み直さない）。タブの入れ物が外れたら答えを捨てる（戻ると新しく読む）。
//   書いて通ったら invalidate で 1 回読み直す。並べ替えは押した直後に答えを書き換え（見える変化）、失敗したら元に戻す。
//   書く口の答えは「通った／断られた（CallErr）／網が切れた（null）」の 3 つで返し、出し分けは画面が決める
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import type { Ops } from "@kaname/contracts";
import { call, type CallErr } from "@/lib/api/call";
import type { ToneKey } from "./kinds-shape";
import { reorderedAnswer, type StageAnswer, type StagePatch } from "./stages-shape";
import { SCREEN, type KindsLoadError, type WriteOutcome } from "./use-kinds";

export const STAGES_KEY = ["k708", "stages"] as const;

/** いま出ている状態の欄の数（StrictMode の付け外しで捨てないよう、外れきってから捨てる） */
let mounted = 0;

export function useStages() {
  const qc = useQueryClient();
  // タブを離れたら捨てる（戻ったときに読み直す・窓に戻っただけでは読み直さない）
  useEffect(() => {
    mounted += 1;
    return () => {
      mounted -= 1;
      setTimeout(() => {
        if (mounted === 0) qc.removeQueries({ queryKey: STAGES_KEY });
      }, 0);
    };
  }, [qc]);
  return useQuery<StageAnswer[], KindsLoadError>({
    queryKey: STAGES_KEY,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<StageAnswer[]> => {
      let r;
      try {
        r = await call("listTicketStages", { screenId: SCREEN });
      } catch {
        throw Object.assign(new Error("network"), { result: null });
      }
      if (!r.ok) throw Object.assign(new Error(r.code), { result: r });
      return (r.data ?? []) as unknown as StageAnswer[];
    },
  });
}

/** 書く口を呼び、通ったら状態を読み直す（404 は断られても読み直す：開いている間に消された） */
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
        if (r.status === 404) await qc.invalidateQueries({ queryKey: STAGES_KEY });
        return { ok: false, err: r };
      }
      await qc.invalidateQueries({ queryKey: STAGES_KEY });
      return { ok: true, data: r.data };
    },
    // run は下の決まった関数（呼ぶたびに作り直さない）
    [qc],
  );
}

export const useSaveStage = () =>
  useWrite(async (id: string, body: StagePatch) =>
    call("updateTicketStage", { params: { id }, body: body as Ops["updateTicketStage"]["body"], screenId: SCREEN }),
  );

export const useCreateStage = () =>
  useWrite(async (name: string, colorKey: ToneKey) =>
    call("createTicketStage", { body: { name, color_key: colorKey }, screenId: SCREEN }),
  );

export const useDeleteStage = () =>
  useWrite(async (id: string) => call("deleteTicketStage", { params: { id }, screenId: SCREEN }));

/** 読み直す断り（並びが古い・止まっている・もう無い）：409・503・404。網の切れ・403 は戻すだけ */
const rereadAfter = (err: CallErr | null): boolean =>
  err !== null && (err.status === 409 || err.status === 503 || err.status === 404);

/** 並べ替え：押した直後に並びを替えて見せ、口を 1 回。失敗したら元の並びに戻す */
export function useReorderStages() {
  const qc = useQueryClient();
  return useCallback(
    async (ids: readonly string[]): Promise<WriteOutcome<unknown>> => {
      const before = qc.getQueryData<StageAnswer[]>(STAGES_KEY);
      if (before) qc.setQueryData<StageAnswer[]>(STAGES_KEY, reorderedAnswer(before, ids));
      let r;
      try {
        r = await call("reorderTicketStages", { body: { stage_ids: [...ids] }, screenId: SCREEN });
      } catch {
        r = null;
      }
      if (r && r.ok) {
        await qc.invalidateQueries({ queryKey: STAGES_KEY });
        return { ok: true, data: r.data };
      }
      if (before) qc.setQueryData<StageAnswer[]>(STAGES_KEY, before);
      if (rereadAfter(r)) await qc.invalidateQueries({ queryKey: STAGES_KEY });
      return { ok: false, err: r };
    },
    [qc],
  );
}
