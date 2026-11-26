"use client";
// 絞りの選びに出す名前（K-478）：人（listMembers）・種別（listTicketKinds）・段（listTicketStages）。
//   人と種別は /tickets の呼んでよい口（速さの台帳）で、問い合わせの鍵を分け合って 1 回だけ読む（口を増やさない）。
//   段は台帳に無いので開いたときは読まない。enabled が真になるか load() を呼んだとき 1 回だけ読み、以後は覚える
import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { call } from "@/lib/api/call";

export interface NameItem {
  id: string;
  name: string;
}
export interface StageItem extends NameItem {
  key: string | null;
}

const ONCE = { retry: false, staleTime: Infinity, refetchOnWindowFocus: false, refetchOnReconnect: false } as const;
export const MEMBERS_KEY = ["list-names", "members"] as const;
export const KINDS_KEY = ["list-names", "kinds"] as const;
export const STAGES_KEY = ["list-names", "stages"] as const;

const rowsOf = (data: unknown): Record<string, unknown>[] =>
  Array.isArray(data) ? (data as Record<string, unknown>[]) : [];

async function readMembers(): Promise<NameItem[]> {
  const r = await call("listMembers", { query: { limit: 200 }, screenId: "tickets" });
  if (!r.ok) throw new Error(r.code);
  // 担当者に選べるのは、抜けていない・止められていない人だけ（作る面と同じ）
  return rowsOf(r.data)
    .filter((m) => !m["deleted_at"] && !m["suspended_at"] && (m["kind_id"] ?? "human") === "human")
    .map((m) => ({ id: String(m["id"]), name: String(m["display_name"] ?? "") }));
}

async function readKinds(): Promise<NameItem[]> {
  const r = await call("listTicketKinds", { screenId: "tickets" });
  if (!r.ok) throw new Error(r.code);
  return rowsOf(r.data).map((k) => ({ id: String(k["id"]), name: String(k["name"] ?? "") }));
}

async function readStages(): Promise<StageItem[]> {
  const r = await call("listTicketStages", { screenId: "tickets" });
  if (!r.ok) throw new Error(r.code);
  return rowsOf(r.data).map((s) => ({
    id: String(s["id"]),
    name: String(s["name"] ?? ""),
    key: typeof s["key"] === "string" ? s["key"] : null,
  }));
}

/** 人と種別の名前。読めないあいだ・読めなかったときは空（選びは「すべて」だけ）。enabled を省くと読む（K-479 の保存の小窓の呼び方） */
export function useListNames(enabled = true): { people: readonly NameItem[]; kinds: readonly NameItem[] } {
  const people = useQuery({ queryKey: MEMBERS_KEY, queryFn: readMembers, enabled, ...ONCE });
  const kinds = useQuery({ queryKey: KINDS_KEY, queryFn: readKinds, enabled, ...ONCE });
  return { people: people.data ?? [], kinds: kinds.data ?? [] };
}

/** 段の名前。読む前・読んでいる間は null */
export function useStageNames(enabled: boolean): { stages: readonly StageItem[] | null; load: () => void } {
  const [asked, setAsked] = useState(false);
  const q = useQuery({ queryKey: STAGES_KEY, queryFn: readStages, enabled: enabled || asked, ...ONCE });
  const load = useCallback(() => setAsked(true), []);
  return { stages: q.data ?? null, load };
}
