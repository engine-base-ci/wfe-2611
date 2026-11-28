// ゲストの場所の見せてもらったチケット /portal/tickets/:id（K-913）。中身は apps/web/features/F11/portal/work-page.tsx
import { PortalWorkPage } from "@/features/F11/portal/work-page";

export default async function PortalTicket({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PortalWorkPage id={id} />;
}
