"use client";
// 層の一覧を読む（K-805・口 listLayers・K-803 が足す）。グループを足す小窓の「層 ▾」が使う。
//   小窓を開くたびに 1 回読む（自分では読み始めない・reload を入れ物が呼ぶ）。読めないとき（503 など）は層 ▾ に「＋ 層を足す」だけを出す
import { useQuery } from "@tanstack/react-query";
import { call, type CallErr } from "@/lib/api/call";

export interface LayerItem {
  id: string;
  label: string;
}

interface LayerRow {
  id?: string;
  label?: string;
  order_no?: number;
}

/** 口の答え → 層の並び（order_no の順・id と名前が無い行は捨てる） */
export function layersOf(rows: readonly LayerRow[] | null | undefined): LayerItem[] {
  return [...(rows ?? [])]
    .filter((r): r is Required<Pick<LayerRow, "id" | "label">> & LayerRow => Boolean(r.id && r.label))
    .sort((a, b) => (a.order_no ?? 0) - (b.order_no ?? 0))
    .map((r) => ({ id: r.id, label: r.label }));
}

export function useLayers() {
  const q = useQuery<LayerItem[], CallErr>({
    queryKey: ["k805", "layers"],
    queryFn: async () => {
      const r = await call("listLayers", { screenId: "members" });
      if (!r.ok) throw r;
      return layersOf(r.data as unknown as LayerRow[]);
    },
    enabled: false,
    retry: false,
  });
  return {
    layers: q.data ?? [],
    /** 最後に読んだ回が落ちた（層 ▾ は「＋ 層を足す」だけ） */
    failed: q.isError,
    reload: () => q.refetch(),
  };
}
