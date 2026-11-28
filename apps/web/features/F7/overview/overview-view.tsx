"use client";
// 概要の画面（K-480・行為 A58・D-128.10）：グループの状態の内訳・最近の更新・節目（0 件）・空の枠（残りの量・分類ごと）。
//   口は getScopeOverview を 1 回だけ（一覧の口は呼ばない）。更新の種類の札は手元で絞る（口を呼び直さない）。書かない
import { useState } from "react";
import { Empty, ErrorState, Loading } from "@/components/k";
import { PAGE_ERROR } from "@/components/k/error-of";
import { feedDaysOf, filtersOf, statusOf, type FeedFilter } from "./overview-data";
import { OverviewPanels } from "./panels";
import { useScopeOverview } from "./use-scope-overview";

export function OverviewView({ scopeId }: { scopeId: string | null }) {
  const { read, retry } = useScopeOverview(scopeId);
  const [filter, setFilter] = useState<FeedFilter>("all");

  if (read.state === "idle")
    return (
      <div className="k-list-body">
        <Empty title="グループを選ぶと、概要が見られます" />
      </div>
    );
  if (read.state === "loading")
    return (
      <div className="k-list-body">
        <Loading />
      </div>
    );
  if (read.state === "error")
    return (
      <div className="k-list-body">
        <ErrorState code={read.code} acts={read.code === PAGE_ERROR.notFound ? ["/tickets"] : [retry]} />
      </div>
    );
  const now = Date.now();
  return (
    <OverviewPanels
      feed={{ filters: filtersOf(filter, setFilter), days: feedDaysOf(read.data.recent, now, filter) }}
      status={statusOf(read.data.stages, read.data.total)}
      milestones={[]}
    />
  );
}
