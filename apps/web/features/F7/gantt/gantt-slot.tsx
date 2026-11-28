"use client";
// 一覧の差し込み口：ガント（K-600 が入れた・本物にしたのは K-482）。一覧の画面（list-page.tsx）が ?view=gantt のとき、一覧の本体の代わりにこれを描く。
//   中身は gantt-view.tsx（棒の口・動かす確かめ・開始・期限が無いもの・保留の出し方・スマホは出さない）
import { GanttView } from "./gantt-view";

/** この区画が本物になったか（K-482） */
export const READY: boolean = true;

export interface GanttSlotProps {
  /** 今のグループ（?scope=<id>）。無ければ null（すべてのグループ） */
  scopeId: string | null;
}

export function GanttSlot({ scopeId }: GanttSlotProps) {
  return <GanttView scopeId={scopeId} />;
}
