import { Suspense } from "react";
import { WsTenantScreen } from "@/features/F12/ops/ws-tenant-screen";

// 運営の 1 社の画面（/ops/tenants/<id>・K-971）。入れ物（layout・運営の外枠）は K-946。URL の tab を読むので Suspense で包む
export default async function OpsTenantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={null}>
      <WsTenantScreen id={id} />
    </Suspense>
  );
}
