"use client";
// 詳細の題名の行の「…」（ほかの操作）の差し込み口（K-599 が置く・K-590 が本物にする）。この葉では中身（今のボタン）をそのまま返す
import type { ReactNode } from "react";
import type { SlotTicket } from "@/features/F4/create-ticket/detail-slots";

/** 本物にする葉（K-590）が true にする */
export const READY = false;

export interface MoreMenuSlotProps {
  /** 無い呼び方（下絵）もある */
  ticket?: SlotTicket;
  children: ReactNode;
}

export function MoreMenuSlot({ children }: MoreMenuSlotProps): ReactNode {
  return children;
}
