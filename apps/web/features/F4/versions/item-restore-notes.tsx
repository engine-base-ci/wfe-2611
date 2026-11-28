"use client";
// 戻せなかった項目の並び（K-579）。下絵 f4v2-versions-items-restored の SkippedList（features/F4/doc/detail-views.tsx）と同じ class と字。
//   1 行は「項目名：訳」（訳が null なら項目名だけ）。口が返した順。戻せた項目の並びは作らない（差分で見える）
import type { ReactNode } from "react";
import type { Skipped } from "./item-restore";

const NAME = "戻せなかった項目";

export const skippedLine = (s: Skipped): string => (s.why === null ? s.name : `${s.name}：${s.why}`);

export function SkippedList({ items }: { items: readonly Skipped[] }): ReactNode {
  if (items.length === 0) return null;
  return (
    <div className="k-f4d-skipwrap">
      <p className="k-f4d-sub">{NAME}</p>
      <ul className="k-f4d-skipped" aria-label={NAME}>
        {items.map((s, i) => (
          <li key={`${i}-${s.name}`}>{skippedLine(s)}</li>
        ))}
      </ul>
    </div>
  );
}
