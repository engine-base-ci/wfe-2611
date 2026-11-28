"use client";
// 節目の旗（キャンバス Gantt：⚑ の印と節目の名前・橙）。節目の終わりの日に立つ（D-125.64）。ガントの棒の並びの中の 1 行として出す。
import "../overview/tones.css";
import "./gantt.css";

export function MilestoneFlag({ name }: { name: string }) {
  return (
    <span className="k-f7-gantt-flag">
      <span aria-hidden="true">⚑</span> {name}
    </span>
  );
}
