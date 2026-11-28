"use client";
// 題の行の「完了にする」（K-572・下絵 v2 のとおり題の行に出す・2026-11-22 のまとめ役の決め X8）。
//   出し分けは今の帯と同じ（canCompleteNow：段が作業中・承認待ちが無い・走っている実行が無い・口の can.complete・実行の様子が分かってから）。
//   押すと use-complete.ts の流れ（確認項目を 1 回読む → 小窓か、そのまま完了）。小窓と赤い知らせは帯（band.tsx）が同じ store から出す。
//   読んでいる・送っている間は押せない形（aria-disabled・焦点はボタンに残す＝小窓を閉じると焦点がここへ戻る）
import { Button } from "@/components/k";
import type { ActsProps } from "@/features/F4/create-ticket/detail-types";
import { canCompleteNow } from "./band";
import { docOf, useComplete } from "./use-complete";

export function CompleteAct({ ticketId, ticket, run, runKnown, onChanged }: ActsProps) {
  const c = useComplete({ ticketId, doc: docOf(ticket), onChanged });
  if (!canCompleteNow(ticket, run, runKnown)) return null;
  const waiting = c.state.phase === "reading" || (c.state.phase === "sending" && !c.state.dialog);
  return (
    <Button
      aria-disabled={waiting || undefined}
      aria-busy={waiting || undefined}
      onClick={() => {
        if (!waiting) void c.start();
      }}
    >
      完了にする
    </Button>
  );
}
