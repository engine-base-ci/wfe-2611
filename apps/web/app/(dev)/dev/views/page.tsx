"use client";
import { useState } from "react";
import { Timeline, ViewSwitch, type TimelineItem, type ViewItem } from "@/components/views";
import { Pill, Section } from "@/components/ui";

// 見え方の見本（T-US-06）：タイムライン（3 段・棒を押すと詳細）とリスト／カンバン／カレンダー
const d = (m: number, day: number) => new Date(2026, m - 1, day);
const items: TimelineItem[] = [
  { id: "g1", label: "目標：受注 10 件", level: "goal", start: d(10, 1), end: d(12, 31), progress: 0.6 },
  {
    id: "m1",
    label: "施策：既存客への追い提案",
    level: "measure",
    start: d(10, 5),
    end: d(11, 15),
    progress: 0.8,
    parentId: "g1",
  },
  {
    id: "m2",
    label: "施策：紹介の仕組み",
    level: "measure",
    start: d(11, 1),
    end: d(12, 20),
    progress: 0.2,
    parentId: "g1",
  },
  {
    id: "v1",
    label: "検証：追い提案の返信率",
    level: "verification",
    start: d(11, 10),
    end: d(11, 20),
    parentId: "m1",
  },
];
const list: ViewItem[] = [
  { id: "t1", title: "セイコー様 追いメール", status: "todo", date: d(9, 17), meta: "見込み 20 分" },
  { id: "t2", title: "京蟻 請求書", status: "doing", date: d(9, 18), meta: "見込み 10 分" },
  { id: "t3", title: "○○社 提案書", status: "done", date: d(9, 16), meta: "実 45 分" },
];
export default function DevViews() {
  const [sel, setSel] = useState<string | null>(null);
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Section title="タイムライン">
        <Timeline
          items={items}
          links={[{ id: "l1", from: "m1", to: "v1" }]}
          selectedId={sel}
          onSelect={setSel}
          renderDetail={(it) => (
            <div data-timeline-detail>
              <h3 className="text-h3 font-bold">{it.label}</h3>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
                <dt className="text-[var(--on-sv)]">期間</dt>
                <dd className="num">
                  {it.start.toLocaleDateString("ja-JP")} 〜 {it.end.toLocaleDateString("ja-JP")}
                </dd>
                <dt className="text-[var(--on-sv)]">進み</dt>
                <dd className="num">{Math.round((it.progress ?? 0) * 100)}%</dd>
              </dl>
            </div>
          )}
        />
      </Section>
      <Section title="見え方の切替">
        <ViewSwitch
          items={list}
          statuses={[
            { key: "todo", label: "これから" },
            { key: "doing", label: "作業中" },
            { key: "done", label: "終わった" },
          ]}
          renderRow={(i) => (
            <>
              <span className="flex-1 truncate">{i.title}</span>
              <span className="text-[12px] text-[var(--on-sv)]">{i.meta}</span>
              <Pill tone={i.status === "done" ? "success" : i.status === "doing" ? "progress" : "neutral"}>
                {i.status}
              </Pill>
            </>
          )}
        />
      </Section>
    </main>
  );
}
