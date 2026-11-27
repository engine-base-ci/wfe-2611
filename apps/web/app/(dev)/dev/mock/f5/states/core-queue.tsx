"use client";
// 段 6 core の下絵（承認待ちの側）：確認の列・札と並べ替え・決めた履歴・続けて裁く・まとめて承認（全部／選んだもの）。
import type { ReactNode } from "react";
import { Callout, Toaster } from "@/components/k";
import { ApproveConfirmMore, BulkConfirm, UndoConfirm } from "@/features/F5/more/dialogs";
import {
  CHIPS_ALL,
  FilteredEmpty,
  FocusDone,
  FocusView,
  HIST_DAYS,
  HistorySheet,
  QROWS,
  QUEUE_NOTE,
  BulkBar,
  QueueCards,
  QueueTable,
  QueueTools,
  type ChipView,
  type QRow,
} from "@/features/F5/more/queue";
import type { Theme } from "@/lib/theme";
import { QueuePage } from "./core-page";

const on = (label: string): readonly ChipView[] => CHIPS_ALL.map((c) => ({ ...c, on: c.label === label }));
const handed: readonly QRow[] = QROWS.filter((r) => r.kind === "渡された");

const PICKED = ["EG-128", "EG-127"] as const;

interface CardProps {
  rows?: readonly QRow[];
  chips?: readonly ChipView[];
  sortOpen?: boolean;
  picked?: readonly string[];
}
function Card({ rows = QROWS, chips = CHIPS_ALL, sortOpen = false, picked = [] }: CardProps) {
  return (
    <section className="k-ap-card k-more-qcard" aria-label="承認待ちの一覧">
      <QueueTools chips={chips} sortOpen={sortOpen} />
      <QueueTable rows={rows} picked={picked} />
      <QueueCards rows={rows} picked={picked} />
      <p className="k-ap-note k-more-qnote">{QUEUE_NOTE}</p>
    </section>
  );
}

export function queueView(id: string, theme: Theme): ReactNode | null {
  const page = (body: ReactNode, dialog?: ReactNode, total = 9) => (
    <QueuePage theme={theme} total={total} dialog={dialog}>
      {body}
    </QueuePage>
  );
  switch (id) {
    case "checks-queue-column":
    case "queue-filter-all":
      return page(<Card />);
    case "queue-filter-sort":
      return page(<Card sortOpen />);
    case "queue-filter-picked":
      return page(<Card rows={handed} chips={on("渡された")} />, undefined, 3);
    case "queue-filter-empty":
      return page(<FilteredEmpty label="渡された" />);
    case "history-list":
      return page(<Card />, <HistorySheet days={HIST_DAYS} />);
    case "history-empty":
      return page(<Card />, <HistorySheet days={[]} empty />);
    case "history-undo-confirm":
      return page(
        <Card />,
        <>
          <HistorySheet days={HIST_DAYS} />
          <UndoConfirm />
        </>,
      );
    case "history-undo-late":
      return page(
        <>
          <Callout tone="danger">
            もう実行が始まっているので、取り消せません。差し戻しの書き込みで知らせてください
          </Callout>
          <Card />
        </>,
        <HistorySheet days={HIST_DAYS} />,
      );
    case "focus-card":
      return (
        <Toaster>
          <FocusView />
        </Toaster>
      );
    case "focus-confirm":
      return (
        <Toaster>
          <FocusView />
          <ApproveConfirmMore pending={["送る前に PDF を目で見る"]} picked={[false]} />
        </Toaster>
      );
    case "focus-done":
      return (
        <Toaster>
          <FocusDone />
        </Toaster>
      );
    case "bulk-select":
      return page(
        <>
          <BulkBar count={PICKED.length} />
          <Card picked={PICKED} />
          <BulkBar count={PICKED.length} at="mobile" />
        </>,
      );
    case "bulk-confirm-all":
      return page(<Card />, <BulkConfirm scope="all" />);
    case "bulk-confirm-selected":
    case "bulk-mobile":
      return page(
        <>
          <BulkBar count={PICKED.length} />
          <Card picked={PICKED} />
          <BulkBar count={PICKED.length} at="mobile" />
        </>,
        <BulkConfirm scope="selected" />,
      );
    case "bulk-running":
      return page(
        <>
          <BulkBar count={PICKED.length} />
          <Card picked={PICKED} />
          <BulkBar count={PICKED.length} at="mobile" />
        </>,
        <BulkConfirm scope="selected" busy />,
      );
    case "bulk-done":
      return page(
        <>
          <Callout tone="info">
            2 件を承認しました。実行は 1 件ずつ順に始まります（EG-128・EG-127）。決めた履歴から確かめられます
          </Callout>
          <Card rows={QROWS.filter((r) => !PICKED.includes(r.number as (typeof PICKED)[number]))} />
        </>,
        undefined,
        7,
      );
    case "bulk-partial":
      return page(
        <>
          <Callout tone="warn">
            1 件は承認できませんでした：EG-127 発注ナビ 応募文を出す は、先にほかの人が決めていました。EG-128
            は承認しました
          </Callout>
          <Card rows={QROWS.filter((r) => r.number !== "EG-128" && r.number !== "EG-127")} />
        </>,
        undefined,
        8,
      );
    default:
      return null;
  }
}
