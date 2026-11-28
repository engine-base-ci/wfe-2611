"use client";
// 詳細の右のパネルの「親」の行の中身の先（K-571 が中身の無い形で先に置く・K-443 が親の小窓つきの行に替える）。
//   札は getTicket の parent から（番号と題名・見えない親は番号だけ）。決める・外す・変えるは updateTicket の 1 回
import type { ReactNode } from "react";
import type { EntryProps } from "@/features/F4/create-ticket/detail-types";
import { ParentRow } from "./parent-field";

export function ParentRowSlotFill({ ticket }: EntryProps): ReactNode {
  return <ParentRow ticket={ticket} />;
}
