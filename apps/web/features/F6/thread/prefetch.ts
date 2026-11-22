// やり取りの先読み（K-392）：詳細を開いたとき、詳細の答えを待たずに最初の 20 件を 1 回読み始める。
//   読み方は use-timeline.ts の timelineQuery と同じ鍵・同じ器なので、後で useTimeline が付いても 2 回目の口を呼ばない。
//   名前と引数は K-382 の置いた形のまま（F6 の prefetch.ts の usePrefetchDetail がこれを呼ぶ）。
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { timelineQuery } from "./use-timeline";

export function usePrefetchThread(id: string, enabled: boolean): void {
  const qc = useQueryClient();
  useEffect(() => {
    if (enabled) void qc.prefetchQuery(timelineQuery(id));
  }, [qc, id, enabled]);
}
