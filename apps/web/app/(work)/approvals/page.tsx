// 承認待ち（K-161・approvals）。自分が決めるものだけを期限で区切って並べる。中身は apps/web/features/F5/approve-complete/（D-128.130）。
//   チケットの画面（K-60）と同じ (work)＝はじめの設定の門の外。チケットを見られる人は承認待ちも見られる（D-131.6）
import { ApprovalsPage } from "@/features/F5/approve-complete/queue";

export default function Approvals() {
  return <ApprovalsPage />;
}
