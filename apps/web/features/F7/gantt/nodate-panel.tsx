"use client";
// ガントの「開始・期限が無いもの」の小窓（K-482・キャンバス GtNoDate）。NoDateTray の gantt 型と同じ CSS の名前で、行ごとの「日を入れる」を押せる形にする。
//   つかんでガントの日へ落とす操作と、その案内の字は作らない（svar に外から落とす口が無い）。カレンダーの右の列（no-date-tray.tsx）は K-481 の物なので触らない
import { GripVertical } from "lucide-react";
import { Button } from "@/components/k";
import "../../F4/ticket-list/ticket-list.css";
import "../overview/tones.css";
import "../overview/overview.css";
import "../calendar/calendar.css";

export interface NoDateRow {
  id: string;
  number: string;
  title: string;
}

export interface NoDatePanelProps {
  rows: readonly NoDateRow[];
  /** 読んだ行のほかにもまだある（「N 件以上」） */
  more: boolean;
  onSetDue: (row: NoDateRow) => void;
}

export function NoDatePanel({ rows, more, onSetDue }: NoDatePanelProps) {
  return (
    <section className="k-f7-calendar-tray-panel" role="dialog" aria-label="開始・期限が無いもの">
      <h2 className="k-f7-calendar-tray-panel-title">
        開始・期限が無い {rows.length} 件{more ? "以上" : ""}
      </h2>
      <ul className="k-f7-calendar-tray-list">
        {rows.map((n) => (
          <li key={n.id} className="k-f7-calendar-tray-row">
            <span className="k-f7-calendar-grip" aria-hidden="true">
              <GripVertical size={14} />
            </span>
            <span className="k-f7-calendar-tray-row-main">
              <span className="k-list-dim">{n.number}</span> {n.title}
            </span>
            <Button variant="outlined" size="sm" aria-label={`${n.number} に日を入れる`} onClick={() => onSetDue(n)}>
              日を入れる
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
