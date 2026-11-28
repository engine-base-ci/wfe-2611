"use client";
// タイムライン（T-US-06・D-079）：svar-gantt（@svar-ui/react-gantt）。目標・施策・検証の 3 段、棒＝期間、線＝前後関係。
// 棒を押すと右に詳細。1023 以下は一覧と詳細を切り替える
import dynamic from "next/dynamic";
import type { ILink, ITask } from "@svar-ui/react-gantt";
import { ChevronLeft } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import "./views.css";

const GanttInner = dynamic(() => import("./gantt-inner"), {
  ssr: false,
  loading: () => <div className="p-6 text-[13px] text-[var(--on-sv)]">読み込み中</div>,
});

export type TimelineLevel = "goal" | "measure" | "verification";
export interface TimelineItem {
  id: string;
  label: string;
  level: TimelineLevel;
  start: Date;
  end: Date;
  progress?: number;
  parentId?: string;
}
export interface TimelineLink {
  id: string;
  from: string;
  to: string;
}
const DAY = 86_400_000;

export function Timeline({
  items,
  links = [],
  renderDetail,
  selectedId,
  onSelect,
}: {
  items: TimelineItem[];
  links?: TimelineLink[];
  renderDetail: (item: TimelineItem) => ReactNode;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
}) {
  const [inner, setInner] = useState<string | null>(selectedId ?? null);
  useEffect(() => setInner(selectedId ?? null), [selectedId]);
  const pick = (id: string | null) => {
    setInner(id);
    onSelect?.(id);
  };
  const sel = items.find((i) => i.id === inner) ?? null;
  // svar の store は id が数値・最上位の parent が 0 の木を前提にする。文字列 id を数値に写して、選んだら戻す
  const num = new Map(items.map((it, k) => [it.id, k + 1] as const));
  const back = new Map(items.map((it, k) => [k + 1, it.id] as const));
  const tasks = items.map((i) => ({
    id: num.get(i.id)!,
    text: i.label,
    start: i.start,
    end: i.end,
    duration: Math.max(1, Math.round((i.end.getTime() - i.start.getTime()) / DAY)),
    progress: Math.round((i.progress ?? 0) * 100),
    type: i.level === "goal" ? "summary" : "task",
    parent: i.parentId ? (num.get(i.parentId) ?? 0) : 0,
    // open は子を持つ行だけ（子の無い行に付けると store が null を辿って落ちる）
    ...(items.some((c) => c.parentId === i.id) ? { open: true } : {}),
  })) as unknown as ITask[];
  const glinks = links.map((l, k) => ({
    id: k + 1,
    source: num.get(l.from) ?? 0,
    target: num.get(l.to) ?? 0,
    type: "e2s",
  })) as unknown as ILink[];
  return (
    <div className={cn("timeline grid gap-0 border-t border-[var(--line)]", sel && "has-detail")} data-timeline>
      <div className="timeline-chart min-w-0 overflow-x-auto">
        <GanttInner tasks={tasks} links={glinks} onSelect={(id) => pick(id ? (back.get(Number(id)) ?? null) : null)} />
      </div>
      <aside
        className="timeline-detail border-l border-[var(--line)] bg-[var(--card)] p-5"
        aria-label="選んだ 1 件"
        hidden={!sel}
      >
        <button type="button" className="btn btn-g btn-sm timeline-back mb-3 lg:hidden" onClick={() => pick(null)}>
          <ChevronLeft className="size-4" /> 一覧へ
        </button>
        {sel ? renderDetail(sel) : null}
      </aside>
    </div>
  );
}
