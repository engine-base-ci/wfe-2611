"use client";
// 続けて裁く（K-752・D-153.12）の並びと 1 件の詳細と、決めた数。
//   並び：開いたときに承認待ちの口を AI の成果物だけ（kind=artifact）・今の並べ替え・limit 200 で 1 回だけ読む（続きは読まない・G-16）。
//   開いた後に増えた承認待ちは入れない（開いたときの並びで回る）。閉じると捨て、開き直すと読み直す（gcTime 0）。
//   詳細：今の 1 件と次の 1 件だけを読む（先読み 1 件・鍵 ["k752", "detail", id]）。
//   層を閉じると ["k752"] の問い合わせを全部捨てる（詳細へ移って成果物を直し、開き直したときに前の版の字を出さない）。
//   決めた物（承認・差し戻し・止める）と飛ばした物は id ごとに持ち、数はそこから出す（同じ数を 2 か所に持たない）
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { call } from "@/lib/api/call";
import type { QueueRow } from "@/features/F5/approve-complete/queue";

export const FOCUS_LIMIT = 200;
const SCREEN = "approvals";

class FocusReadError extends Error {}

export interface FocusDetail {
  artifact_version: { version: number; text: string } | null;
  irreversible: boolean;
  cautions: string[];
}

async function readList(sort: string): Promise<QueueRow[]> {
  const r = await call("listApprovalQueue", {
    query: { kind: "artifact", sort, limit: String(FOCUS_LIMIT) },
    screenId: SCREEN,
  });
  if (!r.ok) throw new FocusReadError(r.code);
  const rows = r.data as unknown as QueueRow[];
  return rows.filter((row) => row.kind === "artifact").slice(0, FOCUS_LIMIT);
}

/** 開いたときの並び（1 回だけ読む） */
export function useFocusList(sort: string) {
  return useQuery({
    queryKey: ["k752", "list", sort],
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: () => readList(sort),
  });
}

const detailKey = (id: string) => ["k752", "detail", id] as const;

async function readDetail(id: string): Promise<FocusDetail> {
  const r = await call("getApproval", { params: { id }, screenId: SCREEN });
  if (!r.ok) throw new FocusReadError(r.code);
  const d = r.data as unknown as Partial<FocusDetail>;
  return {
    artifact_version: d.artifact_version ?? null,
    irreversible: d.irreversible !== false, // 答えに無ければ取り消せない側に倒す
    cautions: Array.isArray(d.cautions) ? d.cautions : [],
  };
}

const detailOptions = (id: string) => ({
  queryKey: detailKey(id),
  retry: false as const,
  staleTime: Infinity,
  refetchOnWindowFocus: false,
  queryFn: () => readDetail(id),
});

/** 今の 1 件の詳細と、次の 1 件の先読み */
export function useFocusDetail(id: string | null, nextId: string | null) {
  const qc = useQueryClient();
  const q = useQuery({ ...detailOptions(id ?? ""), enabled: id !== null });
  useEffect(() => {
    if (nextId) void qc.prefetchQuery(detailOptions(nextId));
  }, [qc, nextId]);
  return q;
}

/** 層が外れたら、この層が読んだ物（並び・詳細）を捨てる。開発の二度がけ（外してすぐ付け直す）では捨てない */
export function useFocusDrop() {
  const qc = useQueryClient();
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      setTimeout(() => {
        if (!mounted.current) qc.removeQueries({ queryKey: ["k752"] });
      }, 0);
    };
  }, [qc]);
}

export type Decision = "approved" | "returned" | "stopped";
export interface FocusTally {
  approved: number;
  returned: number;
  skipped: number;
}

/** どこを見ているか・決めた物・飛ばした物 */
export function useFocusRun(rows: readonly QueueRow[]) {
  const [index, setIndex] = useState(0);
  const [decided, setDecided] = useState<Readonly<Record<string, Decision>>>({});
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set());
  const done = index >= rows.length;
  const current = done ? null : (rows[index] ?? null);
  const values = Object.values(decided);
  const tally: FocusTally = {
    approved: values.filter((d) => d === "approved").length,
    returned: values.filter((d) => d === "returned").length,
    skipped: [...skipped].filter((id) => !(id in decided)).length,
  };
  return {
    index,
    done,
    current,
    nextRows: rows.slice(index + 1, index + 3),
    decisionOf: (id: string): Decision | null => decided[id] ?? null,
    tally,
    /** 次の 1 件へ（最後の後は終わりの面） */
    advance: () => setIndex((i) => Math.min(i + 1, rows.length)),
    next: () => setIndex((i) => (i < rows.length - 1 ? i + 1 : i)),
    prev: () => setIndex((i) => (i > 0 && i < rows.length ? i - 1 : i)),
    skip: (id: string) => {
      setSkipped((s) => new Set([...s, id]));
      setIndex((i) => Math.min(i + 1, rows.length));
    },
    decide: (id: string, d: Decision) => {
      setDecided((m) => ({ ...m, [id]: d }));
      setIndex((i) => Math.min(i + 1, rows.length));
    },
  };
}
