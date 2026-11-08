// 承認待ち（K-63・approvals）。自分が決めるものだけを期限で区切って並べる。中身は apps/web/features/F5/approve-complete/（D-128.130）。
//   はじめの設定の門（RequireSetup）の外に置く：承認する人は PC をつないでいなくても承認できる（実行は任せた人の PC・D-128.176）
import { ApprovalsPage } from "@/features/F5/approve-complete/queue";

export default function Approvals() {
  return <ApprovalsPage />;
}
