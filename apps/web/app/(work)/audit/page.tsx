// 記録（K-825・画面 audit）。中身は apps/web/features/F10/ws/audit-screen.tsx（D-148.1）。(work)＝はじめの設定の門の外：PC をつないでいなくても開く。
//   絞りは URL（?kind・q・member・ticket）が状態。入れ物が読む（useSearchParams）ので、読み終えるまでの間を Suspense で受ける
import { Suspense } from "react";
import { Loading } from "@/components/k";
import { AuditScreen } from "@/features/F10/ws/audit-screen";

export default function Audit() {
  return (
    <Suspense fallback={<Loading />}>
      <AuditScreen />
    </Suspense>
  );
}
