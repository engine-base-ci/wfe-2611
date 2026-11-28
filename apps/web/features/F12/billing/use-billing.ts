// 請求書の画面（K-960・画面 billing）の読む口と書く口。読むのは 1 画面 1 回（StrictMode でも二重にしない・窓に戻っても読み直さない）。
//   読めないとき：403 は「見られない」、ほか（503・網の切れ・形が違う）は「読めなかった」（ふつうに見せない・G-15）
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { call, type CallResult } from "@/lib/api/call";
import { ONCE } from "@/features/F4/create-ticket/ticket-shell";
import type { BillingIn, ContactIn } from "./billing-shape";

export const SCREEN = "billing";
export const BILLING_KEY = ["k960", "billing"] as const;

/** 読めなかった理由（403 は見られない・ほかは読めなかった） */
export class BillingReadError extends Error {
  constructor(readonly forbidden: boolean) {
    super(forbidden ? "forbidden" : "load_failed");
  }
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
/** 答えの形を確かめる（違えば読めなかったとして扱う） */
function billingOf(v: unknown): BillingIn {
  if (!isObj(v) || typeof v["terms"] !== "string" || !Array.isArray(v["invoices"]) || !isObj(v["contact"]))
    throw new BillingReadError(false);
  if (!isObj(v["payee"]) || !Array.isArray(v["payee"]["lines"])) throw new BillingReadError(false);
  return v as unknown as BillingIn;
}

export function useBilling() {
  return useQuery({
    queryKey: BILLING_KEY,
    ...ONCE,
    queryFn: async (): Promise<BillingIn> => {
      let r: CallResult<"getBilling">;
      try {
        r = await call("getBilling", { screenId: SCREEN });
      } catch {
        throw new BillingReadError(false);
      }
      if (!r.ok) throw new BillingReadError(r.status === 403);
      return billingOf(r.data);
    },
  });
}

/** 請求先を変える。成功なら読み直す（1 回）。断りはそのまま返す（呼ぶ側が欄の字か alert にする） */
export function useSaveContact() {
  const qc = useQueryClient();
  return async (body: ContactIn): Promise<{ ok: true } | { ok: false; fields: Record<string, string> }> => {
    let r: CallResult<"updateBillingContact">;
    try {
      r = await call("updateBillingContact", { body, screenId: SCREEN });
    } catch {
      return { ok: false, fields: {} };
    }
    if (!r.ok) return { ok: false, fields: r.status === 422 ? r.fields : {} };
    await qc.invalidateQueries({ queryKey: BILLING_KEY });
    return { ok: true };
  };
}
