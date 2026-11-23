"use client";
// カレンダー（キャンバス Calendar・D-125.13・K-481）：月の格子と上の道具。値を受け取って描くだけ。
//   格子は表（日〜土）。1 日に 2 件まで出し、残りは「ほか N 件」。日の数字か「ほか N 件」を押すと日の小窓（DayDialog）が開く。
//   今日は線で囲み、数字を濃く。日曜は赤・土曜は青（キャンバスのとおり）。期限切れは淡い赤の面。
//   スマホ（767 以下・絵無し・案）：件名を出さず、種別の色の点だけを並べ、「ほか N 件」は「+N」。日を押すと小窓で見る
import type { ReactNode } from "react";
import "../../F4/ticket-list/ticket-list.css";
import "../overview/tones.css";
import "./calendar.css";
import { WEEKDAYS, type CalCell } from "./month";

export interface CalendarCellProps {
  cell: CalCell;
  onOpenDay?: (cell: CalCell) => void;
}

export function CalendarCell({ cell, onOpenDay }: CalendarCellProps) {
  const open = () => onOpenDay?.(cell);
  return (
    <td
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
}

export function CalendarGrid({ monthLabel, span, basis, assignee, cells, onOpenDay, tray }: CalendarGridProps) {
  const weeks: CalCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return (
    <div className="k-list-body">
      <section className="k-list-main" aria-labelledby="tickets-title">
        <div className="k-f7-calendar-card">
          <div className="k-f7-calendar-tools" role="group" aria-label="カレンダーの道具">
            <span className="k-f7-calendar-nav">
              <button type="button" className="k-list-tool" aria-label="前の月">
                ‹
              </button>
              <b>{monthLabel}</b>
              <button type="button" className="k-list-tool" aria-label="次の月">
                ›
              </button>
            </span>
            <button type="button" className="k-list-tool">
              今日
            </button>
            <span className="k-f7-calendar-seg" role="group" aria-label="月か週か">
              {(["月", "週"] as const).map((s) => (
                <button key={s} type="button" aria-pressed={s === span}>
                  {s}
                </button>
              ))}
            </span>
            <span className="k-f7-calendar-pickers">
              <label>
                並べる日付
                <select className="k-f7-calendar-select" defaultValue={basis}>
                  <option>期限</option>
                  <option>開始日〜期限</option>
                </select>
              </label>
              <label>
                担当者
                <select className="k-f7-calendar-select" defaultValue={assignee}>
                  <option>すべて</option>
                </select>
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
                    <CalendarCell key={c.key} cell={c} {...(onOpenDay ? { onOpenDay } : {})} />
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
