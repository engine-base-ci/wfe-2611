"use client";
// 止まった箱ぜんたいの差し込み口（K-599 が置く・K-486 が理由ごとの帯にする）。この葉では中身（今の止まった箱）をそのまま返す
import type { ReactNode } from "react";
import type { SlotTicket } from "@/features/F4/create-ticket/detail-slots";
import type { RunView } from "@/features/F5/delegate/use-run";

/** 本物にする葉（K-486）が true にする */
export const READY = false;

export interface StoppedHandSlotProps {
  ticket: SlotTicket;
  /** 今の実行ぜんたい（reason_kind・taken_over_at を含む） */
  run: RunView;
  /** 前からの「AI に任せる」 */
  delegate: { run: () => void; busy: boolean; disabled: boolean };
  /** 実行の一覧・今の実行と詳細を順に読み直す（K-486 が書き込みの後に呼ぶ） */
  onChanged: () => Promise<void>;
  children: ReactNode;
}

export function StoppedHandSlot({ children }: StoppedHandSlotProps): ReactNode {
  return children;
}
