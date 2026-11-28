import { Suspense } from "react";
import { NoticesScreen } from "@/features/F12/ops2/notices-screen";

// 運営のお知らせの一覧（K-980）。入れ物（layout・運営の外枠）は K-946。URL の札を読むので Suspense で包む
export default function OpsNoticesPage() {
  return (
    <Suspense fallback={null}>
      <NoticesScreen />
    </Suspense>
  );
}
