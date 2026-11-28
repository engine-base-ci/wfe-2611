"use client";
// 差し込み口の先：止める（持ち主の葉 K-734）。器 slots.tsx と帯のファイルは触らない。
//   作る段・承認の後の実行の［止める］＝StopRunAct・人が止めた実行の箱＝StoppedBox・承認の帯の［止める］＝StopApprovalAct（features/F5/stop/）
import type { ReactNode } from "react";
import { StopApprovalAct } from "@/features/F5/stop/stop-approval";
import { StopRunAct } from "@/features/F5/stop/stop-run";
import { StoppedBox } from "@/features/F5/stop/stopped-box";
import type { RunStoppedProps, StopApprovalActProps, StopRunActProps } from "../slots";

export function StopRunActFill(props: StopRunActProps): ReactNode {
  return <StopRunAct {...props} />;
}
export function RunStoppedFill(props: RunStoppedProps): ReactNode {
  return <StoppedBox {...props} />;
}
export function StopApprovalActFill(props: StopApprovalActProps): ReactNode {
  return <StopApprovalAct {...props} />;
}
