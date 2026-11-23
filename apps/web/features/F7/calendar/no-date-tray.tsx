"use client";
// 期限が決まっていないもの（キャンバス Calendar の右の列・GtNoDate の小窓）。カレンダーとガントで同じ部品を使う。
//   calendar：右の列。カレンダーの日へつかんで置くと期限が決まる。gantt：ツールバーの下に開く小窓。「日を入れる」で期限を決める（つかんで落とす案内は出さない・落とす操作は作らない）。
//   つかむ・日を入れるは本番の葉が動かす。ここは並べるだけ
import { GripVertical } from "lucide-react";
import { Button } from "@/components/k";
import "../../F4/ticket-list/ticket-list.css";
import "../overview/tones.css";
import "../overview/overview.css";
import "./calendar.css";

export interface NoDateItem {
  number: string;
  title: string;
}

export interface NoDateTrayProps {
  variant: "calendar" | "gantt";
  items: readonly NoDateItem[];
}

export function NoDateTray({ variant, items }: NoDateTrayProps) {
  if (variant === "calendar") {
    return (
      <aside className="k-list-side" aria-label="期限が決まっていないもの">
        <section className="k-f7-overview-box">
          <h2 className="k-f7-overview-box-title">
            期限が決まっていない
            <span className="k-f7-overview-box-aside">{items.length} 件</span>
          </h2>
          <p className="k-f7-calendar-tray-hint">カレンダーに置くと期限が決まる</p>
          <ul className="k-f7-calendar-tray-list">
            {items.map((n) => (
              <li key={n.number} className="k-f7-calendar-tray-item" draggable>
                <span className="k-list-dim">{n.number}</span>
                <span>{n.title}</span>
              </li>
            ))}
          </ul>
        </section>
      </aside>
    );
  }
  return (
    <section className="k-f7-calendar-tray-panel" role="dialog" aria-label="開始・期限が無いもの">
      <h2 className="k-f7-calendar-tray-panel-title">開始・期限が無い {items.length} 件</h2>
      <ul className="k-f7-calendar-tray-list">
        {items.map((n) => (
          <li key={n.number} className="k-f7-calendar-tray-row">
            <span className="k-f7-calendar-grip" aria-hidden="true">
              <GripVertical size={14} />
            </span>
            <span className="k-f7-calendar-tray-row-main">
              <span className="k-list-dim">{n.number}</span> {n.title}
            </span>
            <Button variant="outlined" size="sm" aria-label={`${n.number} に日を入れる`}>
              日を入れる
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
