"use client";
// 運営の請求の口を読む・書く（K-984）。一覧は listOpsInvoices（K-983）を月と状態ごとの 1 つの鍵で 1 回（StrictMode でも 1 回・retry しない）。
//   既定でない month・state だけを問い合わせに付ける。外枠の答え（caps と請求の数）は入れ物（K-946）と同じ鍵で、ここからは読み直さない。
//   書く口は issueOpsInvoices（K-981・K-1013・K-1109）と recordPayment（K-982）。印は顧客の画面と同じ Bearer（call）。
//   401 は顧客のログインへ送らない（keepOn401・運営のログインへ移すのは画面）
import { useQuery } from "@tanstack/react-query";
import { call, type CallErr } from "@/lib/api/call";
export { useOpsShellData } from "@/features/F12/ops/use-ops-workspaces";
import { isBillAnswer, isBillDraft, type BillAnswer, type BillDraft, type BillState } from "./bills-shape";

const SCREEN = "ops-billing";
const opts = { screenId: SCREEN, keepOn401: true } as const;
export const BILLS_KEY = ["k984", "list"] as const;
export const billsKey = (month: string, state: string) => [...BILLS_KEY, month, state] as const;

/** 一覧の口の結果：読めた／入り直し／権限が無い（403）／それ以外の失敗（503・網の切れ・形が違う） */
export type BillsRead =
  { kind: "ok"; rows: BillAnswer[] } | { kind: "login" } | { kind: "forbidden" } | { kind: "failed" };

export async function fetchBills(query: { month?: string; state?: BillState }): Promise<BillsRead> {
  let r: Awaited<ReturnType<typeof call<"listOpsInvoices">>>;
  try {
    r = await call("listOpsInvoices", { ...opts, query });
  } catch {
    return { kind: "failed" }; // 網が切れた
  }
  if (r.ok) {
    const d = r.data as unknown;
    return Array.isArray(d) && d.every(isBillAnswer) ? { kind: "ok", rows: d } : { kind: "failed" };
  }
  if (r.status === 401) return { kind: "login" };
  if (r.status === 403) return { kind: "forbidden" };
  return { kind: "failed" };
}

const once = { retry: false, refetchOnWindowFocus: false } as const;

/** 一覧（enabled は caps に money があるときだけ） */
export function useOpsBills(
  key: { month: string; state: string },
  query: { month?: string; state?: BillState },
  enabled: boolean,
) {
  return useQuery({
    queryKey: billsKey(key.month, key.state),
    queryFn: () => fetchBills(query),
    enabled,
    ...once,
  });
}

/** 外枠の答えの operator.caps（読めなければ空＝できることが無い） */
export function capsOf(data: unknown): string[] {
  const d = data as { kind?: string; data?: { operator?: { caps?: unknown } } } | undefined;
  const caps = d?.kind === "ok" ? d.data?.operator?.caps : undefined;
  return Array.isArray(caps) ? caps.filter((c): c is string => typeof c === "string") : [];
}

/** 書く口の結果：できた（data と meta）／断られた */
export type BillWrite<T> = { ok: true; data: T; meta: Record<string, unknown> } | { ok: false; err: CallErr };

type Raw = { ok: true; data: unknown; meta: Record<string, unknown> } | CallErr;
async function write<T>(job: () => Promise<Raw>, shape: (d: unknown) => d is T): Promise<BillWrite<T>> {
  const r = await job();
  if (!r.ok) return { ok: false, err: r };
  if (!shape(r.data)) throw new Error("ops invoices: unexpected answer shape"); // 形が違う＝読めない扱い（画面が赤い箱を出す）
  return { ok: true, data: r.data, meta: r.meta };
}

/** まとめて出す（dry_run なら下書きだけ） */
export const issueInvoices = (body: { month: string; dry_run?: true }) =>
  write<BillDraft>(() => call("issueOpsInvoices", { ...opts, body: body as never }), isBillDraft);

/** 入金を記録する・取り消す（答えは 1 行） */
export const recordPayment = (id: string, body: object) =>
  write<BillAnswer>(() => call("recordPayment", { ...opts, params: { id }, body: body as never }), isBillAnswer);

/** 取り直しの小窓の形（パスワードの有る無し・2 段階） */
export async function stepUpShape(): Promise<{ withCode: boolean; withPasskey: boolean }> {
  const s = await call("getMySecurity", opts).catch(() => null);
  const sec = s?.ok ? s.data : {};
  return { withCode: sec.two_factor === true, withPasskey: sec.has_password === false };
}
