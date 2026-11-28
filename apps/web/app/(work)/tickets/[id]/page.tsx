// チケットの詳細（K-60 では読むだけ）。中身は apps/web/features/F4/create-ticket/ticket-detail.tsx
import { TicketDetail } from "@/features/F4/create-ticket/ticket-detail";

export default async function Ticket({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TicketDetail id={id} />;
}
