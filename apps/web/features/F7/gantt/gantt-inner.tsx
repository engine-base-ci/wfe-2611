"use client";
// svar-gantt（@svar-ui/react-gantt v2・MIT・D-079）の実体。ブラウザ専用なので SSR に載せない（gantt-chart.tsx が next/dynamic で読む。
//   本線の components/views/gantt-inner.tsx と同じ作り）。左の表は 件名・担当者・状態、棒は状態の色（正本のトークン）、土日と今日は列の色で示す。
//   見た目は gantt.css が svar の変数（--wx-*）を正本のトークンに置き換える。棒の中身と節目の旗は taskTemplate で描く。
//   下絵では読むだけ（readonly）。葉が readonly を外し、update-task で期限を動かす確かめ（MoveImpactDialog）につなぐ
import { Gantt, Willow, type IApi, type IColumnConfig, type IScaleConfig, type ITask } from "@svar-ui/react-gantt";
import "@svar-ui/react-gantt/all.css";
import { useCallback, useMemo } from "react";
import { STAGE_TONE } from "../overview/head";
import { GanttBar } from "./gantt-bar";
import "../overview/tones.css";
import "./gantt.css";

export type GanttScale = "day" | "week" | "month";

const year = (d: Date): string => `${d.getFullYear()}年`;
const monthYear = (d: Date): string => `${d.getFullYear()}年${d.getMonth() + 1}月`;
const SCALES: Record<GanttScale, IScaleConfig[]> = {
  day: [
    { unit: "month", step: 1, format: monthYear },
    { unit: "day", step: 1, format: (d: Date) => String(d.getDate()) },
  ],
  week: [
    { unit: "month", step: 1, format: monthYear },
    { unit: "week", step: 1, format: (d: Date) => `${d.getMonth() + 1}/${d.getDate()}` },
  ],
  month: [
    { unit: "year", step: 1, format: year },
    { unit: "month", step: 1, format: (d: Date) => `${d.getMonth() + 1}月` },
  ],
};
const CELL_WIDTH: Record<GanttScale, number> = { day: 32, week: 72, month: 96 };

function StageCell({ row }: { row: Record<string, unknown> }) {
  const name = typeof row["stage"] === "string" ? row["stage"] : "";
  if (!name) return null;
  return (
    <span className="k-f7-gantt-stage" data-f7-tone={STAGE_TONE[name] ?? "neutral"}>
      {name}
    </span>
  );
}

const COLUMNS: IColumnConfig[] = [
  { id: "text", header: "件名", flexgrow: 1 },
  { id: "owner", header: "担当者", width: 72 },
  { id: "stage", header: "状態", width: 72, cell: StageCell },
];

export interface GanttInnerProps {
  tasks: ITask[];
  scale: GanttScale;
  /** 見える範囲（end はその日を含まない次の日の 0 時） */
  start: Date;
  end: Date;
  today: Date;
  readonly: boolean;
  /** 棒を動かした（つかんで離した）とき。葉が確かめの小窓につなぐ */
  onMove?: (id: number, start: Date, end: Date) => void;
}

const sameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export default function GanttInner({ tasks, scale, start, end, today, readonly, onMove }: GanttInnerProps) {
  const scales = useMemo(() => SCALES[scale], [scale]);
  const highlightTime = useCallback(
    (date: Date, unit: "day" | "hour"): string => {
      if (unit !== "day") return "";
      if (sameDay(date, today)) return "k-f7-gantt-today";
      return date.getDay() === 0 || date.getDay() === 6 ? "wx-weekend" : "";
    },
    [today],
  );
  const init = useCallback(
    (api: IApi) => {
      if (!onMove) return;
      api.on("update-task", (e) => {
        const t = e.task;
        if (!e.inProgress && t?.start && t.end) onMove(Number(e.id), t.start, t.end);
      });
    },
    [onMove],
  );
  return (
    <Willow fonts={false}>
      <Gantt
        tasks={tasks}
        links={[]}
        scales={scales}
        columns={COLUMNS}
        start={start}
        end={end}
        lengthUnit={scale}
        cellWidth={CELL_WIDTH[scale]}
        cellHeight={36}
        scaleHeight={28}
        readonly={readonly}
        taskTemplate={GanttBar}
        highlightTime={highlightTime}
        init={init}
      />
    </Willow>
  );
}
