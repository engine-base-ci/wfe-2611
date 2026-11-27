// 月のカレンダーの格子（日曜はじまり）を作る。口を呼ばない・日付の計算だけ（日本時間でなく、渡された Date の暦をそのまま使う）。
import type { Tone } from "../overview/head";

export interface CalItem {
  number: string;
  title: string;
  /** 種別の色の段（タスク teal・QA danger・課題 warning・会議 tertiary） */
  kindTone: Tone;
  /** 期限切れ（淡い赤の面） */
  late?: boolean;
  href?: string;
}

export interface CalCell {
  key: string;
  /** 格子に出す日の数字 */
  label: string;
  /** 読み上げ：「11月2日（月）」 */
  ariaDate: string;
  /** 曜日（0＝日曜） */
  dow: number;
  /** この月の日か（前後の月の日は淡く出す） */
  inMonth: boolean;
  today: boolean;
  /** 小窓を開いている日（日付の丸の外に細い輪） */
  selected?: boolean;
  /** 格子に出す分（先頭から決めた件数まで） */
  items: readonly CalItem[];
  /** 出し切れない件数（「ほか N 件」） */
  more: number;
}

export const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;
/** 1 日に格子へ出す件数（キャンバス Calendar：2 件まで） */
export const CAL_SHOWN = 2;

export interface MonthInput {
  year: number;
  /** 1〜12 */
  month: number;
  today: Date;
  /** その月の日（1〜）ごとの予定 */
  byDay: Readonly<Record<number, readonly CalItem[]>>;
}

export function buildMonthCells({ year, month, today, byDay }: MonthInput): CalCell[] {
  const first = new Date(year, month - 1, 1);
  const days = new Date(year, month, 0).getDate();
  const total = Math.ceil((first.getDay() + days) / 7) * 7;
  const cells: CalCell[] = [];
  for (let i = 0; i < total; i++) {
    const d = new Date(year, month - 1, 1 - first.getDay() + i);
    const inMonth = d.getMonth() === month - 1;
    const all = inMonth ? (byDay[d.getDate()] ?? []) : [];
    cells.push({
      key: `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`,
      label: String(d.getDate()),
      ariaDate: `${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAYS[d.getDay()]}）`,
      dow: d.getDay(),
      inMonth,
      today:
        d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate(),
      items: all.slice(0, CAL_SHOWN),
      more: Math.max(0, all.length - CAL_SHOWN),
    });
  }
  return cells;
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const ymdOf = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** 格子の最初と最後の日（YYYY-MM-DD・前後の月の日も含む）。月の口の due_from・due_to に使う（K-481） */
export function gridRange(year: number, month: number): { from: string; to: string } {
  const first = new Date(year, month - 1, 1);
  const days = new Date(year, month, 0).getDate();
  const total = Math.ceil((first.getDay() + days) / 7) * 7;
  const start = new Date(year, month - 1, 1 - first.getDay());
  const end = new Date(year, month - 1, 1 - first.getDay() + total - 1);
  return { from: ymdOf(start), to: ymdOf(end) };
}

/** セルの鍵（「2026-11-5」）→ YYYY-MM-DD */
export function ymdOfKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return `${y}-${pad2(m ?? 1)}-${pad2(d ?? 1)}`;
}

/** YYYY-MM-DD → 小窓の題「11/5（木）」 */
export function dayTitle(ymd: string): string {
  const d = new Date(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)));
  return `${d.getMonth() + 1}/${d.getDate()}（${WEEKDAYS[d.getDay()]}）`;
}
