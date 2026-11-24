"use client";
// 左のメニューの保存した条件の差し込み口（K-599 が置く・K-479 が本物にする）。Shell の belowGroups（グループの行の全部の下）に入る。
//   この葉では何も出さない（口を呼ばず・状態を持たない）
import type { ReactNode } from "react";

/** 本物にする葉（K-479）が true にする */
export const READY = false;

export interface SavedViewSlotProps {
  /** ログイン済みのとき true（ログイン前に口を呼ばない） */
  enabled: boolean;
}

/** この葉では何も出さない（本物にする葉が props を読む） */
export const SavedViewSlot: (props: SavedViewSlotProps) => ReactNode = () => null;
