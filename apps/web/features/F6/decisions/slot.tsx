"use client";
// 本文の区画の差し込み口の先（まだ・K-397 が決定ログの区画の描き分けを入れる）。この葉では今の区画をそのまま返す。口を呼ばない。
import type { ReactNode } from "react";
import type { SlotTicket } from "@/features/F4/create-ticket/detail-slots";

interface SlotSection {
  key: string;
  label: string;
  body: { text?: string } | null;
  version: number;
}

/** 本文の区画の 1 つずつ（children＝今の section.k-section） */
export function SectionSlot({
  children,
}: {
  ticket: SlotTicket;
  children: ReactNode;
  section: SlotSection;
}): ReactNode {
  return <>{children}</>;
}
