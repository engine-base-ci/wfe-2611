"use client";
// 詳細の右のパネルの「親」の行の中身の先（K-571 が中身の無い形で先に置く・K-443 が親の小窓つきの行に替える）。
//   今は読むだけ：答えの parent の札（番号と題名・見えない親は番号だけ）か空
import type { ReactNode } from "react";
import type { EntryProps } from "@/features/F4/create-ticket/detail-types";

interface ParentOf {
  number?: string;
  title?: string | null;
}

export function ParentRowSlotFill({ ticket }: EntryProps): ReactNode {
  const p = (ticket.detail as { parent?: ParentOf | null }).parent ?? null;
  if (!p?.number) return "";
  return p.title ? `${p.number} ${p.title}` : p.number;
}
