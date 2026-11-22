"use client";
// 右のパネルのタブと題名の下の差し込み口の先（まだ・K-392 が本物にする）。この葉では今の要素をそのまま返すか null。口を呼ばない。
import type { ReactNode } from "react";
import type { SlotTicket } from "@/features/F4/create-ticket/detail-slots";

/** 右のパネルのタブと中身（attrs＝今の属性の中身・children＝今のタブと中身） */
export function PanelTabsSlot({ children }: { ticket: SlotTicket; children: ReactNode; attrs: ReactNode }): ReactNode {
  return <>{children}</>;
}

/** 題名の行のすぐ下（スマホの「やり取り N ↓」の飛び先） */
export function TitleSlot(_props: { ticket: SlotTicket }): ReactNode {
  void _props;
  return null;
}
