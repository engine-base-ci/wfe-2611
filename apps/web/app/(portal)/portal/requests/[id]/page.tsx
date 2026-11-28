// ゲストの場所の依頼のやり取り /portal/requests/:id（K-912）。中身は apps/web/features/F11/portal/request-page.tsx
import { RequestPage } from "@/features/F11/portal/request-page";

export default async function PortalRequest({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RequestPage id={id} />;
}
