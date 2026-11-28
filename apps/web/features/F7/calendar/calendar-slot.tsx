"use client";
// 一覧の差し込み口：カレンダー（K-600 が入れ、K-481 が本物にした）。一覧の画面（list-page.tsx）が ?view=calendar のとき、一覧の本体の代わりにこれを描く
import { CalendarView } from "./calendar-view";

/** この区画が本物になったか（K-481） */
export const READY: boolean = true;

export interface CalendarSlotProps {
  /** 今のグループ（?scope=<id>）。無ければ null（すべてのグループ） */
  scopeId: string | null;
}

export function CalendarSlot({ scopeId }: CalendarSlotProps) {
  return <CalendarView scopeId={scopeId} />;
}
