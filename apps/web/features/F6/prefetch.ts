// 詳細の本体が詳細と同時に呼ぶ先読みの口（持ち主は K-382 だけ・後ろの葉は触らない）。区画ごとの先読みを毎回同じ順に呼ぶ。自分では口を呼ばない。
import { usePrefetchDecisions } from "./decisions/prefetch";
import { usePrefetchThread } from "./thread/prefetch";

export function usePrefetchDetail(id: string, enabled: boolean): void {
  usePrefetchThread(id, enabled);
  usePrefetchDecisions(id, enabled);
}
