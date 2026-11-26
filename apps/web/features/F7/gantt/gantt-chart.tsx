"use client";
// ガント（キャンバス Gantt・D-079・K-482）：上の道具・凡例・svar-gantt の本体。値を受け取って描くだけ（口を呼ばない）。
//   本体（svar-gantt）はブラウザ専用なので next/dynamic で読む。棒の並びは親の下に子（行の parentId）。節目の旗は 1 行として並べる。
//   「開始・期限が無い N 件」のボタンを押すと、すぐ下に小窓（NoDateTray の gantt 型）が開く。
//   スマホ（767 以下）はガントを出さない（キャンバス MobileList のとおり）。直接開いたときは一言（案）を出し、横に溢れさせない。
import dynamic from "next/dynamic";
import type { ITask } from "@svar-ui/react-gantt";
import { useMemo, type ReactNode } from "react";
import "../../F4/ticket-list/ticket-list.css";
import { STAGE_TONE } from "../overview/head";
import "../overview/tones.css";
import "./gantt.css";
import type { GanttScale } from "./gantt-inner";

const GanttInner = dynamic(() => import("./gantt-inner"), {
  ssr: false,
  loading: () => <div className="k-f7-gantt-loading">読み込んでいます…</div>,
});

export type { GanttScale } from "./gantt-inner";

export interface GanttRow {
  id: string;
  /** 「EG-126」（親・節目は無し） */
  number?: string;
  /** 件名の字（「EG-126 更新の見積を作る」「【親】…」） */
  title: string;
  owner: string;
  /** 状態の名前（STAGE_TONE の鍵） */
  stage: string;
  kind: "task" | "parent" | "milestone";
  parentId?: string;
  /** 開始（節目はその日） */
  start: Date;
  /** 最後の日（その日を含む。節目は無し） */
  end?: Date;
  /** 期限切れ（棒を赤い線で囲む） */
  late?: boolean;
}

const DAY = 86_400_000;
const STAGES = ["未着手", "作業中", "確認中", "承認待ち", "実行中", "完了", "保留"] as const;
const SCALE_LABEL: Readonly<Record<GanttScale, string>> = { day: "日", week: "週", month: "月" };

/** 行 → svar の行（id は数値・最上位の parent は 0・子を持つ行だけ open） */
export function toTasks(rows: readonly GanttRow[]): ITask[] {
  const num = new Map(rows.map((r, i) => [r.id, i + 1] as const));
  return rows.map((r) => {
    const base = {
      id: num.get(r.id) ?? 0,
      text: r.title,
      owner: r.owner,
      stage: r.stage,
      number: r.number ?? "",
      late: Boolean(r.late),
      parent: r.parentId ? (num.get(r.parentId) ?? 0) : 0,
      progress: 0,
    };
    if (r.kind === "milestone") return { ...base, type: "milestone", start: r.start } as ITask;
    const end = new Date((r.end ?? r.start).getTime() + DAY);
    return {
      ...base,
      type: r.kind === "parent" ? "summary" : "task",
      start: r.start,
      end,
      duration: Math.max(1, Math.round((end.getTime() - r.start.getTime()) / DAY)),
      ...(rows.some((c) => c.parentId === r.id) ? { open: true } : {}),
    } as ITask;
  });
}

export interface GanttChartProps {
  rows: readonly GanttRow[];
  scale: GanttScale;
  /** 見える範囲（最初の日と最後の日・どちらも含む） */
  range: { start: Date; end: Date };
  today: Date;
  /** まとめ方（親子・担当者・節目） */
  groupBy: "親子" | "担当者" | "節目";
  assignee: string;
  /** 開始・期限が無い件数 */
  noDateCount: number;
  noDateOpen?: boolean;
  /** ボタンの下に開く小窓（NoDateTray の gantt 型） */
  tray?: ReactNode;
  /** 表の下に出す案内（保留を指したときの出し方など） */
  hint?: ReactNode;
  readonly?: boolean;
  onMove?: (id: string, start: Date, end: Date) => void;
}

export function GanttChart(p: GanttChartProps) {
  const tasks = useMemo(() => toTasks(p.rows), [p.rows]);
  const back = useMemo(() => new Map(p.rows.map((r, i) => [i + 1, r.id] as const)), [p.rows]);
  const end = useMemo(() => new Date(p.range.end.getTime() + DAY), [p.range.end]);
  const onMove = p.onMove;
  const moved = useMemo(
    () =>
      onMove
        ? (id: number, s: Date, e: Date) => {
            const row = back.get(id);
            if (row) onMove(row, s, e);
          }
        : undefined,
    [onMove, back],
  );
  return (
    <div className="k-list-body">
      <section className="k-list-main" aria-labelledby="tickets-title">
        <div className="k-f7-gantt-card">
          <div className="k-f7-gantt-tools" role="group" aria-label="ガントの道具">
            <button type="button" className="k-list-tool">
              今日
            </button>
            <span className="k-f7-gantt-nav">
              <button type="button" className="k-list-tool" aria-label="前へ">
                ‹
              </button>
              <button type="button" className="k-list-tool" aria-label="次へ">
                ›
              </button>
            </span>
            <span className="k-f7-gantt-seg" role="group" aria-label="目盛り">
              {(Object.keys(SCALE_LABEL) as GanttScale[]).map((s) => (
                <button key={s} type="button" aria-pressed={s === p.scale}>
                  {SCALE_LABEL[s]}
                </button>
              ))}
            </span>
            <label className="k-f7-gantt-pick">
              まとめ方
              <select className="k-f7-gantt-select" defaultValue={p.groupBy}>
                <option>親子</option>
                <option>担当者</option>
                <option>節目</option>
              </select>
            </label>
            <label className="k-f7-gantt-pick">
              担当者
              <select className="k-f7-gantt-select" defaultValue={p.assignee}>
                <option>すべて</option>
              </select>
            </label>
            <span className="k-f7-gantt-anchor">
              <button
                type="button"
                className="k-list-tool"
                aria-expanded={p.noDateOpen ?? false}
                aria-haspopup="dialog"
              >
                開始・期限が無い {p.noDateCount} 件
              </button>
              <button
                type="button"
                className="k-list-tool"
                aria-disabled="true"
                tabIndex={-1}
                title="表示設定（準備中）"
              >
                表示設定
              </button>
              {p.noDateOpen ? p.tray : null}
            </span>
          </div>
          <ul className="k-f7-gantt-legend" aria-label="状態の色">
            {STAGES.map((s) => (
              <li key={s}>
                <span className="k-f7-gantt-swatch" data-f7-tone={STAGE_TONE[s] ?? "neutral"} aria-hidden="true" />
                {s}
              </li>
            ))}
            <li>
              <span className="k-f7-gantt-swatch" data-late="true" aria-hidden="true" />
              期限切れ
            </li>
          </ul>
          <div className="k-f7-gantt-body">
            <GanttInner
              tasks={tasks}
              scale={p.scale}
              start={p.range.start}
              end={end}
              today={p.today}
              readonly={p.readonly ?? true}
              {...(moved ? { onMove: moved } : {})}
            />
          </div>
          <p className="k-f7-gantt-phone-note">スマホではガントを出しません。カレンダーか一覧で見てください</p>
          {p.hint ? <div className="k-f7-gantt-hint">{p.hint}</div> : null}
        </div>
      </section>
    </div>
  );
}
