"use client";
// 書き込みから決定にする入口の入れ物（まだ・K-392 が受ける物を広げ、K-398 が中身）。この葉では誰も描かない。
import type { SlotTicket } from "@/features/F4/create-ticket/detail-slots";

export function FromMessageAction(_props: { ticket: SlotTicket; messageId: string }): null {
  void _props;
  return null;
}
