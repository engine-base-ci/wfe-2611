"use client";
// 一覧の差し込み口：表の期限セルの印（K-600 が入れる・本物にするのは K-478）。list-table.tsx の期限セルの炎を包む。
//   入れた時点では中身（今の炎）をそのまま返す（印を二重に描かない）
import type { ReactNode } from "react";
import type { ListItem } from "@/features/F4/ticket-list/use-ticket-list";

/** この区画が本物になったか（K-478 が true にする） */
export const READY: boolean = false;

export interface DueMarkSlotProps {
  row: ListItem;
  children?: ReactNode;
}

export function DueMarkSlot({ children }: DueMarkSlotProps) {
  return <>{children}</>;
}
