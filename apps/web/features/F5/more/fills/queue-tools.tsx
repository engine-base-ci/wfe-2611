"use client";
// 差し込み口の先：札と並べ替え・空の画面・問い合わせの足し（持ち主の葉 K-749。器 slots.tsx と承認待ちのファイルは触らない）。
//   札と並べ替えの本物は features/F5/queue-tools/queue-tools.tsx。押した札と並べ替えは道（?kind=…&sort=…）に残す（D-153.10・D-153.30）
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { queueKey } from "@/features/F5/approve-complete/queue";
import {
  FilteredEmptyView,
  QueueChips,
  SortBox,
  queueQueryOf,
  useQueueParams,
} from "@/features/F5/queue-tools/queue-tools";
import type { QueueEmptyProps, QueueToolsProps } from "../slots";

export interface QueueQuery {
  query: Record<string, string>;
  key: readonly string[];
}

/** 承認待ちの問い合わせに足す物（queue.tsx の readPage と問い合わせの鍵が読む）。道の kind・sort の決まった値だけ */
export function useQueueQuery(): QueueQuery {
  const { kind, sort } = useQueueParams();
  return queueQueryOf(kind, sort);
}

export function QueueToolsFill({ total, layout, end }: QueueToolsProps): ReactNode {
  if (layout === "card")
    return (
      <>
        <QueueChips total={total} layout="card" />
        {/* スマホは並べ替えを出さない（K749-UI-014 の行）。まとめて承認と決めた履歴は表と同じに出す（K751-UI-014・K-769） */}
        {end ? <div className="k-ap-tools-end">{end}</div> : null}
      </>
    );
  return (
    <>
      <QueueChips total={total} layout="table" />
      <div className="k-ap-tools-end">
        <SortBox />
        {end}
      </div>
    </>
  );
}

/** 道に札（kind）があるときだけ、絞って 0 件の形に替える。札が無いときは受けた空の画面のまま */
export function QueueEmptyFill({ empty }: QueueEmptyProps): ReactNode {
  const { kind, setKind } = useQueueParams();
  const qc = useQueryClient();
  if (!kind) return <>{empty}</>;
  // すべてに戻すときは、前に読んだ「すべて」の答えをそのまま使わず読み直す（絞った間に変わっているかもしれない・K749-UI-009）
  const reset = () => {
    setKind(null);
    void qc.invalidateQueries({ queryKey: queueKey });
  };
  return <FilteredEmptyView kind={kind} onReset={reset} />;
}
