"use client";
// 一覧の差し込み口：自分に関わるものの絞りの行（K-600 が入れる・本物にするのは K-478）。list-page.tsx の MineFilter を包む。
//   入れた時点では中身（今の絞りの行）をそのまま返す。本物にする葉が、children の代わりに押せる絞りの札（due/number-cards.tsx の MineChips）を描く
import type { ReactNode } from "react";
import type { Columns } from "@/features/F4/ticket-list/list-columns";
import type { Counts, ListExtra, ListItem } from "@/features/F4/ticket-list/use-ticket-list";

/** この区画が本物になったか（K-478 が true にする） */
export const READY: boolean = false;

export interface MineChipsSlotProps {
  columns: Columns;
  /** 本人の名前 */
  name: string;
  /** URL の絞りの組（一覧の口の問い合わせにそのまま足す欄） */
  extra: ListExtra;
  /** 絞りの組を替える（URL を替えて読み直す） */
  onExtra: (next: ListExtra) => void;
  /** 一覧の答えの meta.counts（無ければ null） */
  counts: Counts | null;
  /** 今の行 */
  rows: readonly ListItem[];
  children?: ReactNode;
}

export function MineChipsSlot({ children }: MineChipsSlotProps) {
  return <>{children}</>;
}
