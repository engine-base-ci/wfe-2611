"use client";
// 請求書の型の口を読む・書く（K-1108）。読む口は getOpsInvoiceTemplate（GET /api/v1/ops/invoice-template・鍵 ["k1108","invoice-template"]）を 1 回
//   （StrictMode でも同じ鍵で 1 回・retry しない・窓に戻っても読み直さない）。書く口は updateOpsInvoiceTemplate（PUT・本人確認の取り直しが要る）。
//   印は顧客の画面と同じ Bearer（call・K-946 と同じ取り方）。401 は顧客のログインへ送らない（keepOn401・運営のログインへ移すのは画面）。
//   口の形は K-1107（契約の型が追いつくまで読む欄だけを持つ）
import { useQuery } from "@tanstack/react-query";
import { call, type CallErr } from "@/lib/api/call";
import { isInvoiceTemplate, type InvoiceTemplateAnswer, type InvoiceTemplateBody } from "./invoice-template-shape";

const SCREEN = "ops-billing";
export const INVOICE_TEMPLATE_KEY = ["k1108", "invoice-template"] as const;
const opts = { screenId: SCREEN, keepOn401: true } as const;

/** 読む口の結果：読めた／入り直し（401）／権限が無い（403）／それ以外の失敗（503・網の切れ・形が違う） */
export type TemplateRead =
  { kind: "ok"; data: InvoiceTemplateAnswer } | { kind: "login" } | { kind: "forbidden" } | { kind: "failed" };

type Raw = { ok: true; data: unknown } | CallErr;

export async function fetchInvoiceTemplate(): Promise<TemplateRead> {
  let r: Raw;
  try {
    r = (await call("getOpsInvoiceTemplate", opts)) as Raw;
  } catch {
    return { kind: "failed" }; // 網が切れた
  }
  if (r.ok) return isInvoiceTemplate(r.data) ? { kind: "ok", data: r.data } : { kind: "failed" };
  if (r.status === 401) return { kind: "login" };
  if (r.status === 403) return { kind: "forbidden" };
  return { kind: "failed" };
}

export function useInvoiceTemplate(enabled: boolean) {
  return useQuery({
    queryKey: INVOICE_TEMPLATE_KEY,
    queryFn: fetchInvoiceTemplate,
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

/** 書く口の結果（網の切れは呼ぶ側の catch） */
export type TemplateWrite = { ok: true; data: unknown } | CallErr;
export const saveInvoiceTemplate = async (body: InvoiceTemplateBody): Promise<TemplateWrite> =>
  (await call("updateOpsInvoiceTemplate", { ...opts, body: body as never })) as TemplateWrite;

/** 取り直しの小窓の形（パスワードの有る無し・2 段階）・K-984 と同じ */
export async function stepUpShape(): Promise<{ withCode: boolean; withPasskey: boolean }> {
  const s = await call("getMySecurity", opts).catch(() => null);
  const sec = (s?.ok ? s.data : {}) as { two_factor?: unknown; has_password?: unknown };
  return { withCode: sec.two_factor === true, withPasskey: sec.has_password === false };
}

/** 外枠の答え（K-946 の useOpsShell の data）から operator.caps を拾う。拾えなければ null（分からない＝口の 403 で見分ける） */
export function capsOf(shell: unknown): string[] | null {
  const o = shell as { data?: { operator?: { caps?: unknown } }; operator?: { caps?: unknown } } | undefined;
  const caps = o?.data?.operator?.caps ?? o?.operator?.caps;
  return Array.isArray(caps) ? caps.filter((c): c is string => typeof c === "string") : null;
}
