"use client";
// 一覧の差し込み口：概要（K-600 が入れる・本物にするのは K-480）。一覧の画面（list-page.tsx）が ?view=overview のとき、一覧の本体の代わりにこれを描く。
//   入れた時点では何も出さない（READY が false の間は tickets-page.tsx が ?view=overview を mine に落とすので、ここには来ない）。
//   viewReady は見え方のタブと ?view= の読みが使う（概要・カレンダー・ガントの区画の READY を読む）
import { READY as CALENDAR_READY } from "../calendar/calendar-slot";
import { READY as GANTT_READY } from "../gantt/gantt-slot";

/** この区画が本物になったか（K-480 が true にする） */
export const READY: boolean = false;

export type F7View = "overview" | "calendar" | "gantt";

/** その見え方の区画が本物になったか（false の間はタブを押せない形・?view= は mine に落とす） */
export function viewReady(view: F7View): boolean {
  if (view === "overview") return READY;
  if (view === "calendar") return CALENDAR_READY;
  return GANTT_READY;
}

export interface OverviewSlotProps {
  /** 今のグループ（?scope=<id>）。無ければ null（すべてのグループ） */
  scopeId: string | null;
}

/** 入れた時点では何も描かない（本物にする葉が中身を描く） */
export function OverviewSlot(props: OverviewSlotProps): null {
  void props;
  return null;
}
