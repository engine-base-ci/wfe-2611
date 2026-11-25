"use client";
// 詳細の「期限を変える」の差し込み口（K-599 が置く・K-484 が本物にする）。この葉では中身（今のボタン）をそのまま返す
import type { ReactNode } from "react";
import type { SlotTicket } from "@/features/F4/create-ticket/detail-slots";

/** 本物にする葉（K-484）が true にする */
export const READY = false;

export interface DueSlotProps {
  ticket: SlotTicket;
  children: ReactNode;
}

export function DueSlot({ children }: DueSlotProps): ReactNode {
  return children;
}
