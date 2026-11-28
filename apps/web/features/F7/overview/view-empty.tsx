"use client";
// カレンダー・ガントに出すチケットが無いとき（絵無し・案）。共通の「空」の型（components/k の Empty）のまま、見え方ごとの文だけ替える
import type { ReactNode } from "react";
import { Empty } from "@/components/k";

export type EmptyView = "calendar" | "gantt";

const TEXT: Readonly<Record<EmptyView, { title: string; body: string }>> = {
  calendar: {
    title: "カレンダーに出すチケットがありません",
    body: "期限が決まったチケットが、その日に並びます",
  },
  gantt: {
    title: "ガントに出すチケットがありません",
    body: "開始日と期限が決まったチケットが、棒になって並びます",
  },
};

export function ViewEmpty({ view, action }: { view: EmptyView; action?: ReactNode }) {
  const t = TEXT[view];
  return (
    <div className="k-f7-overview-empty">
      <Empty title={t.title} {...(action ? { action } : {})}>
        <p>{t.body}</p>
      </Empty>
    </div>
  );
}
