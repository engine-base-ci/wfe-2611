"use client";
// 外枠の鈴の差し込み口（K-599 が置く・K-467 が本物にする）。この葉では何も出さない：鈴は今のとおりグレーで押せない。
//   useNoticeSlot は Shell に渡す props（shellProps）と Shell の中に置く箱（node）を返す。口を呼ばず・状態を持たない
import type { ReactNode } from "react";

/** 本物にする葉（K-467）が true にする */
export const READY = false;

export interface NoticeSlotInput {
  /** まだ読んでいない知らせの数（K-466 が getShell の値に替える） */
  unread: number | undefined;
  /** ログイン済みのとき true（ログイン前に口を呼ばない） */
  enabled: boolean;
}
export interface NoticeSlotState {
  shellProps: { onNotices?: () => void; bellExpanded?: boolean };
  node: ReactNode;
}

const EMPTY: NoticeSlotState = { shellProps: {}, node: null };

/** この葉では何も返さない（本物にする葉が input を読む） */
export const useNoticeSlot: (input: NoticeSlotInput) => NoticeSlotState = () => EMPTY;

export function NoticeSlot({ slot }: { slot: NoticeSlotState }): ReactNode {
  return slot.node;
}
