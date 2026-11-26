"use client";
// 一覧の差し込み口：カレンダー（K-600 が入れる・本物にするのは K-481）。一覧の画面（list-page.tsx）が ?view=calendar のとき、一覧の本体の代わりにこれを描く。
//   入れた時点では何も出さない（READY が false の間は tickets-page.tsx が ?view=calendar を mine に落とすので、ここには来ない）

/** この区画が本物になったか（K-481 が true にする） */
export const READY: boolean = false;

export interface CalendarSlotProps {
  /** 今のグループ（?scope=<id>）。無ければ null（すべてのグループ） */
  scopeId: string | null;
}

/** 入れた時点では何も描かない（本物にする葉が中身を描く） */
export function CalendarSlot(props: CalendarSlotProps): null {
  void props;
  return null;
}
