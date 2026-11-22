"use client";
// 段・保留・予定・実績の差し込み口の先（まだ・K-395 が本物にする）。この葉では今の要素をそのまま返すか null。口を呼ばない。
import type { ReactNode } from "react";
import type { BandSlotProps, SlotTicket } from "@/features/F4/create-ticket/detail-slots";

interface Wrap {
  ticket: SlotTicket;
  children: ReactNode;
}

/** 頭の行の段の札（children＝今の段の札） */
export function StageSlot({ children }: Wrap): ReactNode {
  return <>{children}</>;
}

/** 題名の下の帯の入れ物の中・渡しの帯の後（保留の帯） */
export function HoldBandSlot(_props: BandSlotProps): ReactNode {
  void _props;
  return null;
}

/** 「日付と時間」の「実績」の値 */
export function ActualTimeSlot({ children }: Wrap): ReactNode {
  return <>{children}</>;
}

/** 「日付と時間」の「予定」の値 */
export function EstimateSlot({ children }: Wrap): ReactNode {
  return <>{children}</>;
}
