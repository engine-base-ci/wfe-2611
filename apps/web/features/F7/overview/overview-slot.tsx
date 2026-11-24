"use client";
// 一覧の差し込み口：概要（K-600 が入れる・本物にするのは K-480）。一覧の画面（list-page.tsx）が ?view=overview のとき、一覧の本体の代わりにこれを描く。
//   K-480 で本物にした（READY を true・中身は overview-view.tsx）。
//   viewReady は見え方のタブと ?view= の読みが使う（概要・カレンダー・ガントの区画の READY を読む）
import { READY as CALENDAR_READY } from "../calendar/calendar-slot";
import { READY as GANTT_READY } from "../gantt/gantt-slot";
import { OverviewView } from "./overview-view";

/** この区画が本物になったか（K-480 が true にした） */
export const READY: boolean = true;

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

/** 概要の本文（K-480：getScopeOverview を 1 回読んで描く） */
export function OverviewSlot({ scopeId }: OverviewSlotProps) {
  return <OverviewView scopeId={scopeId} />;
}
