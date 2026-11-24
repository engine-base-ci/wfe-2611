"use client";
// 一覧の差し込み口：ガント（K-600 が入れる・本物にするのは K-482）。一覧の画面（list-page.tsx）が ?view=gantt のとき、一覧の本体の代わりにこれを描く。
//   入れた時点では何も出さない（READY が false の間は tickets-page.tsx が ?view=gantt を mine に落とすので、ここには来ない）

/** この区画が本物になったか（K-482 が true にする） */
export const READY: boolean = false;

export interface GanttSlotProps {
  /** 今のグループ（?scope=<id>）。無ければ null（すべてのグループ） */
  scopeId: string | null;
}

/** 入れた時点では何も描かない（本物にする葉が中身を描く） */
export function GanttSlot(props: GanttSlotProps): null {
  void props;
  return null;
}
