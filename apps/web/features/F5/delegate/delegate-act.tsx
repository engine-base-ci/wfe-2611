"use client";
// 題の行の「AI に任せる」（K-573・下絵 v2 のとおり題の行に出す・2026-11-22 のまとめ役の決め X8）。F5 の帯からはボタンを外した（帯は状態の知らせだけ）。
//   出し分けは前の帯と同じ：口の can.delegate・走っている実行が無い・段が承認待ちでも完了でもない。
//   「完了にする」が出ている間は outlined（主ボタンは 1 つ・K-62 の決め answer=5cf21973b39f・canCompleteNow と同じ判定）。
//   押すと use-delegate.ts の流れ（確認項目がちょうど 0 件なら小窓・そうでなければ空の体で任せる）。小窓と知らせは帯（delegate-band.tsx）が同じ store から出す。
//   答えを待つ間・429 の待つ間は押せない形。帯の props に無い値（確認項目を使わない理由・対象の行）は、この部品が詳細の答えから store に載せる
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Button } from "@/components/k";
import type { ActsProps } from "@/features/F4/create-ticket/detail-types";
import { canCompleteNow, targetLine } from "@/features/F5/approve-complete/band";
import { delegateFlow, useDelegateState } from "./use-delegate";
import { isActive } from "./use-run";

const CLOSED_STAGES = new Set(["awaiting_approval", "done"]);

export function DelegateAct({ ticketId, ticket, run, runKnown, onRun, onChanged }: ActsProps) {
  const qc = useQueryClient();
  const s = useDelegateState(ticketId);
  const noSpecReason = ticket.no_spec_reason ?? null;
  const target = targetLine(ticket.ticket.number, ticket.ticket.title);
  useEffect(() => delegateFlow.publish(ticketId, { noSpecReason, target }), [ticketId, noSpecReason, target]);
  const closed = CLOSED_STAGES.has(ticket.stage?.key ?? "");
  if (ticket.can?.delegate !== true || isActive(run) || closed) return null;
  return (
    <Button
      variant={canCompleteNow(ticket, run, runKnown) ? "outlined" : "primary"}
      loading={s.busy && !s.dialog}
      disabled={s.waitUntil !== null}
      onClick={() => void delegateFlow.start({ ticketId, specCount: ticket.spec_count, qc, onRun, onChanged })}
    >
      AI に任せる
    </Button>
  );
}
