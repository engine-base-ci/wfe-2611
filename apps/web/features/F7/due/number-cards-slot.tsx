"use client";
// 一覧の差し込み口：自分に関わるものの数の札（K-600 が入れる・本物にするのは K-478）。list-page.tsx の MineCards を包む。
//   入れた時点では中身（今の札）をそのまま返す。本物にする葉が、children の代わりに押せる札（due/number-cards.tsx の NumberCards）を描く
import type { ReactNode } from "react";
import type { Counts, ListExtra } from "@/features/F4/ticket-list/use-ticket-list";

/** この区画が本物になったか（K-478 が true にする） */
export const READY: boolean = false;

export interface NumberCardsSlotProps {
  /** URL の絞りの組（一覧の口の問い合わせにそのまま足す欄） */
  extra: ListExtra;
  /** 絞りの組を替える（URL を替えて読み直す） */
  onExtra: (next: ListExtra) => void;
  /** 一覧の答えの meta.counts（無ければ null） */
  counts: Counts | null;
  children?: ReactNode;
}

export function NumberCardsSlot({ children }: NumberCardsSlotProps) {
  return <>{children}</>;
}
