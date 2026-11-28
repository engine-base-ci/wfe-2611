"use client";
// 配るもの › ひな形・操作の口を読む（K-994）。読む口 2 本は 1 つずつの鍵で 1 回（StrictMode でも 1 回・retry しない）。
//   印は顧客の画面と同じ Bearer（call・K-946 と同じ取り方）。401 は顧客のログインへ送らない（keepOn401・運営のログインへ移すのは画面）。
//   答えの形は K-992・K-1010（契約の型が追いつくまで templates-shape.ts の読む欄だけを持つ）
import { useQuery } from "@tanstack/react-query";
import { call, type CallErr } from "@/lib/api/call";
import type { OpsOperation, OpsTemplateRow } from "./templates-shape";
import type { Read } from "./use-ops-plans";

const SCREEN = "ops-skills";
export const TEMPLATES_KEY = ["k994", "templates"] as const;
export const OPERATIONS_KEY = ["k994", "operations"] as const;

type Raw = { ok: true; data: unknown } | CallErr;
async function readList<T>(job: () => Promise<Raw>): Promise<Read<T[]>> {
  let r: Raw;
  try {
    r = await job();
  } catch {
    return { kind: "failed" }; // 網が切れた
  }
  if (r.ok) return Array.isArray(r.data) ? { kind: "ok", data: r.data as T[] } : { kind: "failed" };
  if (r.status === 401) return { kind: "login" };
  if (r.status === 403) return { kind: "forbidden" };
  return { kind: "failed" };
}
const opts = { screenId: SCREEN, keepOn401: true } as const;

export const fetchTemplates = () => readList<OpsTemplateRow>(() => call("listOpsTemplates", opts));
export const fetchOperations = () => readList<OpsOperation>(() => call("listOperations", opts));

const once = { retry: false, refetchOnWindowFocus: false } as const;
export const useOpsTemplates = () => useQuery({ queryKey: TEMPLATES_KEY, queryFn: fetchTemplates, ...once });
export const useOpsOperations = () => useQuery({ queryKey: OPERATIONS_KEY, queryFn: fetchOperations, ...once });
