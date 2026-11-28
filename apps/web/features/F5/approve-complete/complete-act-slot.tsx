"use client";
// 題の行の差し込み口 CompleteActSlot（K-571・create-ticket/detail-entry-slots.tsx）の先。中身は K-572 の「完了にする」（complete-act.tsx）。
//   名前と props（ActsProps）は K-571 が決めた物のまま変えない
import type { ActsProps } from "@/features/F4/create-ticket/detail-types";
import { CompleteAct } from "./complete-act";

export function CompleteActSlotFill(props: ActsProps) {
  return <CompleteAct {...props} />;
}
