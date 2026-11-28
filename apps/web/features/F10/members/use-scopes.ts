"use client";
// グループの一覧を読む（K-806・口 listScopes。K-804 が答えの行に 10 の鍵を足し、上のグループが先・兄弟は position の順で返す）。
//   直す・並びの小窓を開くたびに 1 回読む（自分では読み始めない・reload を入れ物が呼ぶ）
import { useQuery } from "@tanstack/react-query";
import { call, type CallErr } from "@/lib/api/call";
import type { GroupTone } from "./group-dialogs";

export interface ScopeRow {
  id: string;
  name: string;
  ticket_prefix: string;
  color: GroupTone;
  parent_id: string | null;
  layer: { id: string; label: string } | null;
  position: number;
  managers: { id: string; name: string }[];
  member_count: number;
}

const TONES: readonly GroupTone[] = ["teal", "plum", "indigo", "amber", "coral", "sage"];

/** 口の答え → 行（足りない鍵は空で埋める・色が 6 つの外なら teal） */
export function scopesOf(rows: readonly Partial<ScopeRow>[] | null | undefined): ScopeRow[] {
  return (rows ?? [])
    .filter((r): r is Partial<ScopeRow> & { id: string } => Boolean(r.id))
    .map((r) => ({
      id: r.id,
      name: r.name ?? "",
      ticket_prefix: r.ticket_prefix ?? "",
      color: TONES.includes(r.color as GroupTone) ? (r.color as GroupTone) : "teal",
      parent_id: r.parent_id ?? null,
      layer: r.layer ?? null,
      position: r.position ?? 0,
      managers: r.managers ?? [],
      member_count: r.member_count ?? 0,
    }));
}

/** 並びの対象（PM の決め 2026-11-25）：会社のいちばん上のグループ（上が空の最初の 1 つ）の子を、位置の順に。
 *  いちばん上そのものは並べない（画面から足すグループは全部その下に入る・D-154.31）。上が違う深いグループは出さない（K806-UI-019） */
export function siblingsOf(rows: readonly ScopeRow[]): ScopeRow[] {
  const root = rows.find((r) => r.parent_id === null);
  if (!root) return [];
  return rows.filter((r) => r.parent_id === root.id).sort((a, b) => a.position - b.position);
}

export function useScopes() {
  const q = useQuery<ScopeRow[], CallErr>({
    queryKey: ["k806", "scopes"],
    queryFn: async () => {
      const r = await call("listScopes", { screenId: "members" });
      if (!r.ok) throw r;
      return scopesOf(r.data as unknown as Partial<ScopeRow>[]);
    },
    enabled: false,
    retry: false,
  });
  return {
    scopes: q.data ?? [],
    failed: q.isError,
    /** 読み直して、読めた行を返す（読めなければ null） */
    reload: async (): Promise<ScopeRow[] | null> => {
      const r = await q.refetch();
      return r.isSuccess ? r.data : null;
    },
  };
}
