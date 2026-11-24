"use client";
// カレンダーの画面（K-481・D-125.13）：月の格子・日の小窓・期限が決まっていない右の列・日を動かす（理由が必須・D-151.11）。
//   部品（CalendarGrid・DayDialog・NoDateTray・buildMonthCells）に、一覧の口の答えと動きを渡すだけ。見た目の規則は部品の CSS のまま。
//   日を動かすのは 2 つの道：日の小窓の「日を動かす」（キーボード・スマホも同じ道）と、項目をつかんで日のセルへ落とす。どちらも同じ editor が開く。
//   落とした時点では口に何も送らない（理由を入れて「動かす」を押すと送る）
import { useMemo, useState } from "react";
import { ErrorState, Loading, errorText, PAGE_ERROR } from "@/components/k";
import type { ListItem } from "@/features/F4/ticket-list/use-ticket-list";
import { useListNames } from "../saved/use-list-names";
import { jstToday, monthOf, shiftMonth, type MonthView } from "../due/due-dates";
import { KIND_TONE, STAGE_TONE } from "../overview/head";
import { ViewEmpty } from "../overview/view-empty";
import { CalendarGrid } from "./calendar-grid";
import { DayDialog, type DayItem } from "./day-dialog";
import { buildMonthCells, dayTitle, ymdOfKey, type CalCell, type CalItem } from "./month";
import { NoDateTray } from "./no-date-tray";
import { useCalendarData } from "./use-calendar-data";
import { useMoveDue } from "./use-move-due";

export interface CalendarViewProps {
  scopeId: string | null;
}

const hrefOf = (r: ListItem) => `/tickets/${encodeURIComponent(r.id)}`;
const calItem = (r: ListItem): CalItem => ({
  number: r.number,
  title: r.title,
  kindTone: KIND_TONE[r.kind?.name ?? ""] ?? "teal",
  late: r.overdue,
  href: hrefOf(r),
});
const dayItem = (r: ListItem): DayItem => ({
  number: r.number,
  title: r.title,
  kindTone: KIND_TONE[r.kind?.name ?? ""] ?? "teal",
  stage: r.stage?.name ?? "",
  stageTone: STAGE_TONE[r.stage?.name ?? ""] ?? "neutral",
  owner: r.assignee?.display_name ?? "",
  href: hrefOf(r),
});
const dateOf = (ymd: string): Date =>
  new Date(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)));

/** 月の行を、その月の日（1〜）ごとに分ける */
function byDayOf(rows: readonly ListItem[], m: MonthView): Record<number, CalItem[]> {
  const out: Record<number, CalItem[]> = {};
  const head = `${m.year}-${String(m.month).padStart(2, "0")}-`;
  for (const r of rows) {
    if (!r.due_on?.startsWith(head)) continue;
    const d = Number(r.due_on.slice(8, 10));
    out[d] = [...(out[d] ?? []), calItem(r)];
  }
  return out;
}

export function CalendarView({ scopeId }: CalendarViewProps) {
  const today = jstToday(new Date());
  const [month, setMonth] = useState<MonthView>(() => monthOf(today));
  // 一度格子を出したら、空になっても格子を出したまま（空の画面は最初に開いたときだけ。
  //   月・担当者を替えた後も、日を動かしてその月が 0 件になった後も、格子と月の移動を残す）
  const [gridShown, setGridShown] = useState(false);
  const [assignee, setAssignee] = useState("");
  /** 開いている日の小窓（YYYY-MM-DD） */
  const [day, setDay] = useState<string | null>(null);
  /** 期限が決まっていない行を日へ落としたとき、その日の小窓に足して出す行 */
  const [dropped, setDropped] = useState<ListItem | null>(null);
  const { people } = useListNames(true);
  const data = useCalendarData({ scopeId, year: month.year, month: month.month, assignee: assignee || null });

  const monthRows = useMemo(() => (data.month.state === "ok" ? data.month.rows : []), [data.month]);
  const noneRows = useMemo(() => (data.none.state === "ok" ? data.none.rows : []), [data.none]);
  const find = (number: string) =>
    monthRows.find((r) => r.number === number) ?? noneRows.find((r) => r.number === number) ?? null;

  const move = useMoveDue({
    onMoved: (noDate) => {
      setDropped(null);
      data.reloadMonth();
      if (noDate) data.reloadNone();
    },
    onStale: data.reloadMonth,
  });

  const go = (m: MonthView) => setMonth(m);
  const openDay = (ymd: string) => {
    setDropped(null);
    move.cancel();
    setDay(ymd);
  };
  const closeDay = () => {
    move.cancel();
    setDropped(null);
    setDay(null);
  };
  const onMoveOpen = (number: string) => {
    const r = find(number);
    if (r) move.open({ id: r.id, number: r.number, due: r.due_on });
  };
  // つかんだ番号は運ぶ物（dataTransfer）に入る。画面で覚える物は無い
  const onDragItem = () => undefined;
  const onDropOn = (cell: CalCell, number: string) => {
    const r = find(number);
    if (!r) return;
    const to = ymdOfKey(cell.key);
    if (r.due_on === to) return;
    move.cancel();
    if (r.due_on === null) {
      setDropped(r);
      setDay(to);
    } else {
      setDropped(null);
      setDay(r.due_on);
    }
    move.open({ id: r.id, number: r.number, due: r.due_on }, to);
  };

  if (data.month.state === "error") {
    return (
      <div className="k-list-body">
        <ErrorState code={data.month.code} acts={[data.reloadMonth]} />
      </div>
    );
  }
  if (data.month.state === "loading" || (!gridShown && monthRows.length === 0 && data.none.state === "loading")) {
    return (
      <div className="k-list-body">
        <Loading />
      </div>
    );
  }
  if (!gridShown && monthRows.length === 0 && data.none.state === "ok" && noneRows.length === 0) {
    return <ViewEmpty view="calendar" />;
  }
  // 格子を出した印（前の描画の情報を持つ形・次の描画から空の画面に戻さない）
  if (!gridShown) setGridShown(true);

  const cells = buildMonthCells({
    year: month.year,
    month: month.month,
    today: dateOf(today),
    byDay: byDayOf(monthRows, month),
  }).map((c) => (day && ymdOfKey(c.key) === day ? { ...c, selected: true } : c));
  const dayRows = day ? monthRows.filter((r) => r.due_on === day) : [];
  const items = [...dayRows, ...(dropped ? [dropped] : [])].map(dayItem);
  const d = move.draft;

  return (
    <>
      <CalendarGrid
        monthLabel={`${month.year}年 ${month.month}月`}
        span="月"
        basis="期限"
        assignee="すべて"
        cells={cells}
        onOpenDay={(c) => openDay(ymdOfKey(c.key))}
        onPrev={() => go(shiftMonth(month, -1))}
        onNext={() => go(shiftMonth(month, 1))}
        onToday={() => go(monthOf(today))}
        onDragItem={onDragItem}
        onDropOn={onDropOn}
        people={people}
        assigneeId={assignee}
        onAssignee={setAssignee}
        tray={
          <NoDateTray
            variant="calendar"
            items={noneRows.map((r) => ({ number: r.number, title: r.title }))}
            more={data.none.state === "ok" && data.none.more}
            failed={
              data.none.state === "error"
                ? { text: errorText(PAGE_ERROR.loadFailed).title, onRetry: data.reloadNone }
                : undefined
            }
            onDragItem={onDragItem}
          />
        }
      />
      {day ? (
        <DayDialog
          open
          onOpenChange={(o) => (o ? null : closeDay())}
          title={dayTitle(day)}
          items={items}
          {...(d
            ? {
                moving: {
                  number: d.number,
                  to: d.to,
                  reason: d.reason,
                  reasonError: d.reasonError ?? null,
                  toError: d.toError ?? null,
                  notice: d.notice ?? null,
                  busy: move.busy,
                  submitDisabled: move.submitDisabled,
                },
              }
            : {})}
          acts={{
            onMoveOpen,
            onTo: move.setTo,
            onReason: move.setReason,
            onSubmit: move.submit,
            onCancel: move.cancel,
          }}
        />
      ) : null}
    </>
  );
}
