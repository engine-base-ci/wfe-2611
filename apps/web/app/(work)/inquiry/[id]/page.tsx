// 問い合わせ 1 件のやり取り（K-1007・道 /inquiry/[id]）。中身は apps/web/features/F12/help/thread-screen.tsx
import { ThreadScreen } from "@/features/F12/help/thread-screen";

export default async function Inquiry({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ThreadScreen id={id} />;
}
