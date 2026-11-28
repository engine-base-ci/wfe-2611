// 承認待ち（K-161・approvals）。自分が決めるものだけを期限で区切って並べる。中身は apps/web/features/F5/approve-complete/（D-128.130）。
//   チケットの画面（K-60）と同じ (work)＝はじめの設定の門の外。チケットを見られる人は承認待ちも見られる（D-131.6）
//   札と並べ替えを道（?kind・?sort）から読む（K-749・useSearchParams）。useSearchParams は Suspense の中でしか使えない（本番ビルドの prerender で落ちる）
import { Suspense } from "react";
import { ApprovalsPage } from "@/features/F5/approve-complete/queue";

export default function Approvals() {
  return (
    <Suspense fallback={null}>
      <ApprovalsPage />
    </Suspense>
  );
}
