import { Suspense } from "react";
import { InboxScreen } from "@/features/F12/ops2/inbox-screen";

// 運営の受信箱（/ops/support・K-976）。入れ物（layout・運営の外枠）は K-946。URL の箱・種類・1 件を読むので Suspense で包む
export default function OpsSupportPage() {
  return (
    <Suspense fallback={null}>
      <InboxScreen />
    </Suspense>
  );
}
