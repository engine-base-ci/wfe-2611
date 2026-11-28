"use client";
// 配るもの › プランの口を読む・書く（K-991）。読む口 4 本は 1 つずつの鍵で 1 回（StrictMode でも 1 回・retry しない）。
//   1 件の案の頁は listPlanProposals から id で拾う（1 件の口は持たない）。印は顧客の画面と同じ Bearer（call・K-946 と同じ取り方）。
//   401 は顧客のログインへ送らない（keepOn401・運営のログインへ移すのは画面）。答えの形は K-987・K-989・K-1104（契約の型が追いつくまで読む欄だけを持つ）
import { useQuery } from "@tanstack/react-query";
import { call, type CallErr } from "@/lib/api/call";
import type { PlanHistoryRow, PlanImpact, PlanOps, PlanProposal } from "./plans-shape";

const SCREEN = "ops-skills";
export const PLANS_KEY = ["k991", "plans"] as const;
export const PROPOSALS_KEY = ["k991", "proposals"] as const;
export const impactKey = (id: string) => ["k991", "impact", id] as const;
export const historyKey = (plan: string | null) => ["k991", "history", plan] as const;
export const ME_KEY = ["k991", "me"] as const;

/** 読む口の結果：読めた／入り直し／権限が無い（403）／それ以外の失敗（503・網の切れ・形が違う） */
export type Read<T> = { kind: "ok"; data: T } | { kind: "login" } | { kind: "forbidden" } | { kind: "failed" };

type Raw = { ok: true; data: unknown } | CallErr;
async function read<T>(job: () => Promise<Raw>, ok: (d: unknown) => d is T): Promise<Read<T>> {
  let r: Raw;
  try {
    r = await job();
  } catch {
    return { kind: "failed" }; // 網が切れた
  }
  if (r.ok) return ok(r.data) ? { kind: "ok", data: r.data } : { kind: "failed" };
  if (r.status === 401) return { kind: "login" };
  if (r.status === 403) return { kind: "forbidden" };
  return { kind: "failed" };
}
const isList = <T>(d: unknown): d is T[] => Array.isArray(d);
const isObj = <T>(d: unknown): d is T => d !== null && typeof d === "object" && !Array.isArray(d);
const opts = { screenId: SCREEN, keepOn401: true } as const;
const LIMIT = 100;

export const fetchPlans = () => read<PlanOps[]>(() => call("listOpsPlans", opts), isList);
export const fetchProposals = () =>
  read<PlanProposal[]>(() => call("listPlanProposals", { ...opts, query: { limit: LIMIT } }), isList);
export const fetchImpact = (id: string) =>
  read<PlanImpact>(() => call("getPlanProposalImpact", { ...opts, params: { id } }), isObj);
export const fetchHistory = (plan: string | null) =>
  read<PlanHistoryRow[]>(
    () => call("listPlanHistory", { ...opts, query: { limit: LIMIT, ...(plan ? { plan_key: plan } : {}) } as never }),
    isList,
  );
/** 自分（運営の外枠の口の operator・K-1006）。自分の案かを見るためだけに読む */
export async function fetchMe(): Promise<string | null> {
  const r = await call("getOpsShell", opts).catch(() => null);
  if (!r?.ok) return null;
  const op = (r.data as { operator?: { member_id?: unknown } } | undefined)?.operator;
  return typeof op?.member_id === "string" ? op.member_id : null;
}

const once = { retry: false, refetchOnWindowFocus: false } as const;
export const useOpsPlans = () => useQuery({ queryKey: PLANS_KEY, queryFn: fetchPlans, ...once });
export const usePlanProposals = (enabled = true) =>
  useQuery({ queryKey: PROPOSALS_KEY, queryFn: fetchProposals, enabled, ...once });
export const usePlanImpact = (id: string | null) =>
  useQuery({
    queryKey: impactKey(id ?? ""),
    queryFn: () => fetchImpact(id ?? ""),
    enabled: id !== null,
    ...once,
  });
export const usePlanHistory = (plan: string | null) =>
  useQuery({ queryKey: historyKey(plan), queryFn: () => fetchHistory(plan), ...once });
export const useMe = (enabled = true) =>
  useQuery({ queryKey: ME_KEY, queryFn: fetchMe, staleTime: Infinity, enabled, ...once });

/** 案の入力（K-988 の作る・直す）。trial_days は今の版と違うときだけ送る（K-1104） */
export interface ProposalInput {
  plan_key?: string;
  price_monthly?: number;
  member_limit?: number;
  existing_policy?: string;
  notice_days?: number;
  new_from?: string | null;
  trial_days?: number;
  reason?: string;
}
const w = (body: unknown) => ({ ...opts, body: body as never });
export const createProposal = (body: ProposalInput) => call("createPlanProposal", w(body));
export const updateProposal = (id: string, body: ProposalInput) =>
  call("updatePlanProposal", { ...w(body), params: { id } });
export const submitProposal = (id: string) => call("submitPlanProposal", { ...w({}), params: { id } });
export const decideProposal = (id: string, notice_body: string) =>
  call("decidePlanProposal", { ...w({ notice_body }), params: { id } });
export const returnProposal = (id: string, reason: string) =>
  call("returnPlanProposal", { ...w({ reason }), params: { id } });

/** 取り直しの小窓の形（パスワードの有る無し・2 段階）・K-984 と同じ */
export async function stepUpShape(): Promise<{ withCode: boolean; withPasskey: boolean }> {
  const s = await call("getMySecurity", opts).catch(() => null);
  const sec = s?.ok ? s.data : {};
  return { withCode: sec.two_factor === true, withPasskey: sec.has_password === false };
}

/** 決めた・差し戻した後に一覧で出す知らせ（頁を移っても 1 回だけ読む・道に字を載せない） */
let flash: string | null = null;
export const setFlash = (text: string) => {
  flash = text;
};
export const peekFlash = (): string | null => flash;
export const clearFlash = () => {
  flash = null;
};
