// 会社の側の「ひな形がこう変わります」（K-1016・画面 masters・道 /settings/template-updates）の読む口と選ぶ口（K-993）。
//   読むのは 1 画面 1 回（StrictMode でも二重にしない・窓に戻っても読み直さない）。選んだら同じ鍵を 1 回読み直す。
//   読めないとき：403 は「見えない」、ほか（503・網の切れ・形が違う）は「読めなかった」（ふつうに見せない・G-15）
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { call, type CallArgs, type CallErr, type CallResult } from "@/lib/api/call";
import { ONCE } from "@/features/F4/create-ticket/ticket-shell";
import { updateOf, type KindTemplateUpdateIn } from "./template-update-shape";
import type { TemplateChoice } from "./views-skills";

export const SCREEN = "masters";
export const UPDATES_KEY = ["k1016", "updates"] as const;

/** 読めなかった理由（403 は見えない・ほかは読めなかった） */
export class UpdatesReadError extends Error {
  constructor(readonly forbidden: boolean) {
    super(forbidden ? "forbidden" : "load_failed");
  }
}

/** 答えの並びの形を確かめる（1 つでも違えば読めなかったとして扱う） */
function updatesOf(v: unknown): KindTemplateUpdateIn[] {
  if (!Array.isArray(v)) throw new UpdatesReadError(false);
  const rows = v.map(updateOf);
  if (rows.some((r) => r === null)) throw new UpdatesReadError(false);
  return rows as KindTemplateUpdateIn[];
}

export function useTemplateUpdates() {
  return useQuery({
    queryKey: UPDATES_KEY,
    ...ONCE,
    queryFn: async (): Promise<KindTemplateUpdateIn[]> => {
      let r: CallResult<"listKindTemplateUpdates">;
      try {
        r = await call("listKindTemplateUpdates", { screenId: SCREEN });
      } catch {
        throw new UpdatesReadError(false);
      }
      if (!r.ok) throw new UpdatesReadError(r.status === 403);
      return updatesOf(r.data);
    },
  });
}

export type ApplyResult = { ok: true } | { ok: false; err: Pick<CallErr, "kind" | "code" | "status"> | null };

/** 選ぶ（{ choice }）。成功でも断り（409 など）でも一覧を 1 回読み直す。網の切れは err なし */
export function useApplyUpdate() {
  const qc = useQueryClient();
  return async (id: string, choice: TemplateChoice): Promise<ApplyResult> => {
    // 契約の体の型は区画の表の前の形のまま（K-993 は { choice } だけを受ける）
    const body = { choice } as unknown as CallArgs<"applyKindTemplateUpdate">["body"];
    let r: CallResult<"applyKindTemplateUpdate">;
    try {
      r = await call("applyKindTemplateUpdate", { params: { id }, body, screenId: SCREEN });
    } catch {
      return { ok: false, err: null };
    }
    await qc.invalidateQueries({ queryKey: UPDATES_KEY });
    return r.ok ? { ok: true } : { ok: false, err: r };
  };
}
