// 設定の「プランと支払い」（K-962・画面 company-settings）の読む口。1 画面 1 回（StrictMode でも二重にしない・窓に戻っても読み直さない）。
//   変えた後と 409 の後だけ読み直す（呼ぶ側が reload）。読めないとき：403 は「見られない」（押せない形）、ほかは「読めなかった」
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { call, type CallResult } from "@/lib/api/call";
import { ONCE } from "@/features/F4/create-ticket/ticket-shell";
import type { PlanIn, PlansMeta } from "./plan-shape";

export const PLAN_SCREEN = "company-settings";
export const PLANS_KEY = ["k962", "plans"] as const;

export interface PlansAnswer {
  plans: PlanIn[];
  meta: PlansMeta;
}

/** 読めなかった理由（403 は見られない・ほかは読めなかった） */
export class PlansReadError extends Error {
  constructor(readonly forbidden: boolean) {
    super(forbidden ? "forbidden" : "load_failed");
  }
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const isPlan = (x: unknown): x is PlanIn =>
  isObj(x) &&
  typeof x["plan_key"] === "string" &&
  typeof x["name"] === "string" &&
  typeof x["member_limit"] === "number";

/** 答えの形を確かめる（違えば読めなかったとして扱う） */
function plansOf(data: unknown, meta: Record<string, unknown>): PlansAnswer {
  if (!Array.isArray(data) || !data.every(isPlan)) throw new PlansReadError(false);
  if (typeof meta["members"] !== "number") throw new PlansReadError(false);
  const limit = typeof meta["member_limit"] === "number" ? meta["member_limit"] : 0;
  return { plans: data, meta: { members: meta["members"], member_limit: limit } };
}

/** 読む。設定の画面の頭で設定の読みと並べて先に呼ぶ（同じ鍵なので PlanRow の読みと合わせて 1 回・直列にしない） */
export function usePlans(enabled = true) {
  return useQuery({
    queryKey: PLANS_KEY,
    ...ONCE,
    enabled,
    queryFn: async (): Promise<PlansAnswer> => {
      let r: CallResult<"listWorkspacePlans">;
      try {
        r = await call("listWorkspacePlans", { screenId: PLAN_SCREEN });
      } catch {
        throw new PlansReadError(false);
      }
      if (!r.ok) throw new PlansReadError(r.status === 403);
      return plansOf(r.data, r.meta);
    },
  });
}

/** 読み直す（1 回）。読み直した答えを返す（409 の後に、選んだプランがまだ選べるかを見る） */
export function useReloadPlans() {
  const qc = useQueryClient();
  return async (): Promise<PlansAnswer | undefined> => {
    await qc.invalidateQueries({ queryKey: PLANS_KEY });
    return qc.getQueryData<PlansAnswer>(PLANS_KEY);
  };
}
