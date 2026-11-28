import { Suspense } from "react";
import { BillsScreen } from "@/features/F12/ops2/bills-screen";

// 運営の請求（K-984）。入れ物（layout・運営の外枠）は K-946。URL の月と状態を読むので Suspense で包む
export default function OpsBillingPage() {
  return (
    <Suspense fallback={null}>
      <BillsScreen />
    </Suspense>
  );
}
