"use client";
// 見え方の切替（D-079.3・D-068.9）：同じデータを リスト／カンバン／カレンダー で。別のデータ・別の部品を作らない（D-071）
import { CalendarDays, Columns3, List } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ViewKind = "list" | "kanban" | "calendar";
export interface ViewItem {
  id: string;
  title: string;
  status: string;
  date?: Date | null;
  meta?: string;
}
const LABEL: Record<ViewKind, { label: string; icon: ReactNode }> = {
  list: { label: "リスト", icon: <List className="size-4" /> },
  kanban: { label: "カンバン", icon: <Columns3 className="size-4" /> },
  calendar: { label: "カレンダー", icon: <CalendarDays className="size-4" /> },
};
export function ViewSwitch({
  items,
  statuses,
  renderRow,
  initial = "list",
  onOpen,
}: {
  items: ViewItem[];
  statuses: { key: string; label: string }[];
  renderRow: (i: ViewItem) => ReactNode;
  initial?: ViewKind;
  onOpen?: (id: string) => void;
}) {
  const [view, setView] = useState<ViewKind>(initial);
  return (
    <div data-viewswitch>
      <div
        role="tablist"
        aria-label="見え方"
        className="mb-3 inline-flex rounded-[var(--r-md)] border border-[var(--line)] p-0.5"
      >
        {(Object.keys(LABEL) as ViewKind[]).map((k) => (
          <button
            key={k}
            role="tab"
            type="button"
            aria-selected={view === k}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[4px] px-2.5 py-1.5 text-[12.5px] font-semibold text-[var(--on-sv)]",
              view === k && "bg-[var(--primary-c)] text-[var(--on-primary-c)]",
            )}
            onClick={() => setView(k)}
          >
            {LABEL[k].icon}
            {LABEL[k].label}
          </button>
        ))}
      </div>
      {view === "list" ? (
        <ul className="divide-y divide-[var(--line-soft)] border-t border-[var(--line)]" data-view="list">
          {items.map((i) => (
            <li
              key={i.id}
              className="flex min-h-12 cursor-pointer items-center gap-3 px-1 py-2 hover:bg-[var(--surface)]"
              onClick={() => onOpen?.(i.id)}
            >
              {renderRow(i)}
            </li>
          ))}
        </ul>
      ) : null}
      {view === "kanban" ? (
        <div className="grid gap-3 overflow-x-auto md:grid-cols-3" data-view="kanban">
          {statuses.map((s) => (
            <section key={s.key} className="min-w-0 rounded-[var(--r-md)] bg-[var(--sv)] p-2">
              <h3 className="mb-2 px-1 text-[12px] font-semibold tracking-[0.05em] text-[var(--on-sv)]">
                {s.label} <span className="num">{items.filter((i) => i.status === s.key).length}</span>
              </h3>
              <div className="flex flex-col gap-2">
                {items
                  .filter((i) => i.status === s.key)
                  .map((i) => (
                    <div
                      key={i.id}
                      className="cursor-pointer rounded-[var(--r-md)] bg-[var(--card)] p-2.5 text-[13px] shadow-[0_0_0_1px_var(--line)]"
                      onClick={() => onOpen?.(i.id)}
                    >
                      {renderRow(i)}
                    </div>
                  ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}
      {view === "calendar" ? (
        <CalendarView items={items} renderRow={renderRow} {...(onOpen ? { onOpen } : {})} />
      ) : null}
    </div>
  );
}
function CalendarView({
  items,
  renderRow,
  onOpen,
}: {
  items: ViewItem[];
  renderRow: (i: ViewItem) => ReactNode;
  onOpen?: (id: string) => void;
}) {
  const dated = items.filter((i) => i.date);
  const base = dated[0]?.date ?? new Date();
  const y = base.getFullYear();
  const m = base.getMonth();
  const first = new Date(y, m, 1);
  const days = new Date(y, m + 1, 0).getDate();
  const lead = first.getDay();
  const cells = Array.from({ length: lead + days }, (_, i) => (i < lead ? null : i - lead + 1));
  return (
    <div data-view="calendar">
      <div className="mb-2 text-[13px] font-semibold">
        {y}年{m + 1}月
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--line)] text-[12px]">
        {["日", "月", "火", "水", "木", "金", "土"].map((d) => (
          <div key={d} className="bg-[var(--sv)] px-1 py-1 text-center font-semibold text-[var(--on-sv)]">
            {d}
          </div>
        ))}
        {cells.map((d, i) => (
          <div key={i} className="min-h-16 bg-[var(--card)] p-1">
            {d ? <div className="num text-[11px] text-[var(--on-sv)]">{d}</div> : null}
            {d
              ? dated
                  .filter((it) => it.date!.getFullYear() === y && it.date!.getMonth() === m && it.date!.getDate() === d)
                  .map((it) => (
                    <div
                      key={it.id}
                      className="mt-0.5 cursor-pointer truncate rounded-[3px] bg-[var(--primary-c)] px-1 text-[11px] text-[var(--on-primary-c)]"
                      onClick={() => onOpen?.(it.id)}
                    >
                      {renderRow(it)}
                    </div>
                  ))
              : null}
          </div>
        ))}
      </div>
    </div>
  );
}
