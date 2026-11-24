"use client";
// svar-gantt（@svar-ui/react-gantt v2・MIT・D-079）の実体。ブラウザ専用なので SSR に載せない（gantt-chart.tsx が next/dynamic で読む。
//   本線の components/views/gantt-inner.tsx と同じ作り）。左の表は 件名・担当者・状態、棒は状態の色（正本のトークン）、土日と今日は列の色で示す。
//   見た目は gantt.css が svar の変数（--wx-*）を正本のトークンに置き換える。棒の中身と節目の旗は taskTemplate で描く。
//   棒を動かす（K-482）：つかんで離したときの update-task を api.intercept で取り、onMove（動かした端と日数）を呼んで false を返す（店の値は替えない）。
//   つかんでいる間の drag-task は見た目（$x・$w）だけを替えるので、最初の位置を覚えておき、取り消したら drag-task で元の位置に戻す
import { Gantt, Willow, type IApi, type IColumnConfig, type IScaleConfig, type ITask } from "@svar-ui/react-gantt";
import "@svar-ui/react-gantt/all.css";
import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { STAGE_TONE } from "../overview/head";
import { GanttBar } from "./gantt-bar";
import { readLen } from "./read-len";
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
/** セルの幅の正本の名前（日・週・月）。左の表の列の幅は週のセルと同じ名前を使う（値が同じ 72・名前を増やさない） */
const CELL_WIDTH_TOKEN: Record<GanttScale, string> = {
  day: "--k-c-gantt-cell-day-width",
  week: "--k-c-gantt-cell-week-width",
  month: "--k-c-gantt-cell-month-width",
};
const COLUMN_WIDTH_TOKEN = "--k-c-gantt-cell-week-width";

/** 正本から読んだ数（読めない物は入れない＝svar の既定） */
interface GanttLens {
  cellWidth?: number;
  cellHeight?: number;
  scaleHeight?: number;
  columnWidth?: number;
}
function readLens(scale: GanttScale): GanttLens {
  const lens: [keyof GanttLens, number | undefined][] = [
    ["cellWidth", readLen(CELL_WIDTH_TOKEN[scale])],
    ["cellHeight", readLen("--k-c-gantt-row-height")],
    ["scaleHeight", readLen("--k-c-gantt-scale-height")],
    ["columnWidth", readLen(COLUMN_WIDTH_TOKEN)],
  ];
  return Object.fromEntries(lens.filter(([, v]) => v !== undefined)) as GanttLens;
}

function StageCell({ row }: { row: Record<string, unknown> }) {
  const name = typeof row["stage"] === "string" ? row["stage"] : "";
  if (!name) return null;
  return (
    <span className="k-f7-gantt-stage" data-f7-tone={STAGE_TONE[name] ?? "neutral"}>
      {name}
    </span>
  );
}

const columnsOf = (width: number | undefined): IColumnConfig[] => [
  { id: "text", header: "件名", flexgrow: 1 },
  { id: "owner", header: "担当者", ...(width ? { width } : {}) },
  { id: "stage", header: "状態", ...(width ? { width } : {}), cell: StageCell },
];

export interface GanttInnerProps {
  tasks: ITask[];
  scale: GanttScale;
  /** 見える範囲（end はその日を含まない次の日の 0 時） */
  start: Date;
  end: Date;
  today: Date;
  readonly: boolean;
  /** 棒を動かした（つかんで離した）とき。edge は動かした端（move＝棒ごと・start＝左の端・end＝右の端）、diff は目盛りの数（日・週・月） */
  onMove?: (id: number, move: GanttMove) => void;
}

export interface GanttMove {
  edge: "move" | "start" | "end";
  diff: number;
}

interface Place {
  left: number;
  width: number;
}
const edgeOf = (task: Partial<ITask>): GanttMove["edge"] =>
  task.start && task.end ? "move" : task.start ? "start" : "end";

const sameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export default function GanttInner({ tasks, scale, start, end, today, readonly, onMove }: GanttInnerProps) {
  const scales = useMemo(() => SCALES[scale], [scale]);
  const [lens, setLens] = useState<GanttLens | null>(null);
  useLayoutEffect(() => setLens(readLens(scale)), [scale]);
  const columns = useMemo(() => columnsOf(lens?.columnWidth), [lens]);
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
      const first = new Map<number, Place>();
      api.intercept("drag-task", (e) => {
        const id = Number(e.id);
        const t = api.getTask(e.id) as (ITask & { $x?: number; $w?: number }) | undefined;
        if (e.inProgress && !first.has(id) && t && typeof t.$x === "number" && typeof t.$w === "number")
          first.set(id, { left: t.$x, width: t.$w });
        if (!e.inProgress) first.delete(id);
        return true;
      });
      api.intercept("update-task", (e) => {
        if (e.inProgress || typeof e.diff !== "number" || !e.diff || !e.task) return true;
        const id = Number(e.id);
        const back = first.get(id);
        first.delete(id);
        if (back) api.exec("drag-task", { id: e.id, left: back.left, width: back.width, inProgress: false });
        onMove(id, { edge: edgeOf(e.task), diff: e.diff });
        return false;
      });
    },
    [onMove],
  );
  // 正本の数を読むまで描かない（読む前に既定の数で描くと、読んだ後に大きさが変わる）
  if (!lens) return null;
  return (
    <Willow fonts={false}>
      <Gantt
        tasks={tasks}
        links={[]}
        scales={scales}
        columns={columns}
        start={start}
        end={end}
        lengthUnit={scale}
        {...(lens.cellWidth ? { cellWidth: lens.cellWidth } : {})}
        {...(lens.cellHeight ? { cellHeight: lens.cellHeight } : {})}
        {...(lens.scaleHeight ? { scaleHeight: lens.scaleHeight } : {})}
        readonly={readonly}
        taskTemplate={GanttBar}
        highlightTime={highlightTime}
        init={init}
      />
    </Willow>
  );
}
