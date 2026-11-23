"use client";
// ガントの棒の中身（svar-gantt の taskTemplate）。子は番号を状態の色で、親は細い帯（色は棒そのもの）、節目は旗（MilestoneFlag）。
//   期限切れは赤い線で囲み、完了は薄く。色は正本の状態の色（tones.css）だけ
import type { ITask } from "@svar-ui/react-gantt";
import { STAGE_TONE } from "../overview/head";
import { MilestoneFlag } from "./milestone-flag";
import "../overview/tones.css";
import "./gantt.css";

export function GanttBar({ data }: { data: ITask }) {
  if (data.type === "milestone") {
    return (
      <div className="wx-text-out">
        <MilestoneFlag name={typeof data.text === "string" ? data.text : ""} />
      </div>
    );
  }
  if (data.type === "summary") return <div className="k-f7-gantt-bar" data-kind="parent" />;
  const stage = typeof data["stage"] === "string" ? data["stage"] : "";
  return (
    <div
      className="k-f7-gantt-bar"
      data-f7-tone={STAGE_TONE[stage] ?? "neutral"}
      data-late={data["late"] ? "true" : undefined}
      data-done={stage === "完了" ? "true" : undefined}
    >
      {typeof data["number"] === "string" ? data["number"] : ""}
    </div>
  );
}
