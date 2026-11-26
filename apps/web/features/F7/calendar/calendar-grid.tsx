"use client";
// カレンダー（キャンバス Calendar・D-125.13・K-481）：月の格子と上の道具。値を受け取って描くだけ。
//   格子は表（日〜土）。1 日に 2 件まで出し、残りは「ほか N 件」。日の数字か「ほか N 件」を押すと日の小窓（DayDialog）が開く。
//   今日は線で囲み、数字を濃く。日曜は赤・土曜は青（キャンバスのとおり）。期限切れは淡い赤の面。
//   スマホ（767 以下・絵無し・案）：件名を出さず、種別の色の点だけを並べ、「ほか N 件」は「+N」。日を押すと小窓で見る
import type { DragEvent, ReactNode } from "react";
import "../../F4/ticket-list/ticket-list.css";
import "../overview/tones.css";
import "./calendar.css";
import { WEEKDAYS, type CalCell } from "./month";

/** つかんだ物を運ぶ型（HTML5 のドラッグ＆ドロップ・番号だけを運ぶ） */
export const DRAG_TYPE = "text/plain";

export interface CalendarCellProps {
  cell: CalCell;
  onOpenDay?: (cell: CalCell) => void;
  /** 項目をつかんだ（番号） */
  onDragItem?: (number: string, e: DragEvent) => void;
  /** このセルへ落とした（運んだ番号） */
  onDropOn?: (cell: CalCell, number: string) => void;
}

export function CalendarCell({ cell, onOpenDay, onDragItem, onDropOn }: CalendarCellProps) {
  const open = () => onOpenDay?.(cell);
  const drop = onDropOn
    ? {
        onDragOver: (e: DragEvent) => e.preventDefault(),
        onDrop: (e: DragEvent) => {
          e.preventDefault();
          const n = e.dataTransfer.getData(DRAG_TYPE);
          if (n) onDropOn(cell, n);
        },
      }
    : {};
  return (
    <td
      {...drop}
      className="k-f7-calendar-cell"
      data-out={!cell.inMonth || undefined}
      data-today={cell.today || undefined}
      data-selected={cell.selected || undefined}
      data-dow={cell.dow}
    >
      <button type="button" className="k-f7-calendar-date" aria-label={`${cell.ariaDate}を開く`} onClick={open}>
        {cell.label}
      </button>
      {cell.items.length ? (
        <ul className="k-f7-calendar-items">
          {cell.items.map((i) => (
            <li key={i.number}>
              <a
                className="k-f7-calendar-item"
                href={i.href ?? "#"}
                data-late={i.late || undefined}
                title={`${i.number} ${i.title}`}
                {...(onDragItem
                  ? {
                      draggable: true,
                      onDragStart: (e: DragEvent) => {
                        e.dataTransfer.setData(DRAG_TYPE, i.number);
                        onDragItem(i.number, e);
                      },
                    }
                  : {})}
              >
                <span className="k-f7-calendar-dot" data-f7-tone={i.kindTone} aria-hidden="true" />
                <span className="k-f7-calendar-item-text">
                  {i.number} {i.title}
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      {cell.more ? (
        <button type="button" className="k-f7-calendar-more" onClick={open}>
          <span data-form="long">ほか {cell.more} 件</span>
          <span data-form="short">+{cell.more}</span>
        </button>
      ) : null}
    </td>
  );
}

export interface CalendarGridProps {
  /** 「2026年 11月」 */
  monthLabel: string;
  /** 月か週か */
  span: "月" | "週";
  /** 並べる日付 */
  basis: "期限" | "開始日〜期限";
  /** 担当者の絞り（「すべて」） */
  assignee: string;
  cells: readonly CalCell[];
  onOpenDay?: (cell: CalCell) => void;
  /** 右の列（NoDateTray） */
  tray?: ReactNode;
  onPrev?: () => void;
  onNext?: () => void;
  onToday?: () => void;
  onDragItem?: (number: string, e: DragEvent) => void;
  onDropOn?: (cell: CalCell, number: string) => void;
  /** 担当者の選び（人。渡せば選べる・value は人の id・"" はすべて） */
  people?: readonly { id: string; name: string }[];
  assigneeId?: string;
  onAssignee?: (id: string) => void;
}

export function CalendarGrid({
  monthLabel,
  span,
  basis,
  assignee,
  cells,
  onOpenDay,
  tray,
  onPrev,
  onNext,
  onToday,
  onDragItem,
  onDropOn,
  people,
  assigneeId,
  onAssignee,
}: CalendarGridProps) {
  const cellActs = {
    ...(onOpenDay ? { onOpenDay } : {}),
    ...(onDragItem ? { onDragItem } : {}),
    ...(onDropOn ? { onDropOn } : {}),
  };
  const weeks: CalCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return (
    <div className="k-list-body">
      <section className="k-list-main" aria-labelledby="tickets-title">
        <div className="k-f7-calendar-card">
          <div className="k-f7-calendar-tools" role="group" aria-label="カレンダーの道具">
            <span className="k-f7-calendar-nav">
              <button
                type="button"
                className="k-list-tool"
                aria-label="前の月"
                {...(onPrev ? { onClick: onPrev } : {})}
              >
                ‹
              </button>
              <b>{monthLabel}</b>
              <button
                type="button"
                className="k-list-tool"
                aria-label="次の月"
                {...(onNext ? { onClick: onNext } : {})}
              >
                ›
              </button>
            </span>
            <button type="button" className="k-list-tool" {...(onToday ? { onClick: onToday } : {})}>
              今日
            </button>
            <span className="k-f7-calendar-seg" role="group" aria-label="月か週か">
              {/* 週はまだ作らない（押せない形・D-145.9） */}
              {(["月", "週"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={s === span}
                  {...(s === "週" ? { className: "k-list-off", "aria-disabled": true } : {})}
                >
                  {s}
                </button>
              ))}
            </span>
            <span className="k-f7-calendar-pickers">
              <label>
                並べる日付
                <select className="k-f7-calendar-select" defaultValue={basis}>
                  <option>期限</option>
                  {/* 開始日の棒はまだ出さない（選べない形） */}
                  <option disabled>開始日〜期限</option>
                </select>
              </label>
              <label>
                担当者
                {people && onAssignee ? (
                  <select
                    className="k-f7-calendar-select"
                    value={assigneeId ?? ""}
                    onChange={(e) => onAssignee(e.target.value)}
                  >
                    <option value="">すべて</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select className="k-f7-calendar-select" defaultValue={assignee}>
                    <option>すべて</option>
                  </select>
                )}
              </label>
            </span>
          </div>
          <table className="k-f7-calendar-table" aria-label={monthLabel}>
            <thead>
              <tr>
                {WEEKDAYS.map((w, i) => (
                  <th key={w} scope="col" data-dow={i}>
                    {w}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => (
                <tr key={w[0]?.key}>
                  {w.map((c) => (
                    <CalendarCell key={c.key} cell={c} {...cellActs} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {tray}
    </div>
  );
}
