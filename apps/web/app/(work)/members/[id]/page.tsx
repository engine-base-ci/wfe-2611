// メンバーの 1 人（K-819・画面 member-detail）。中身は apps/web/features/F10/member/member-page.tsx
import { MemberDetailPage } from "@/features/F10/member/member-page";

export default async function Member({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MemberDetailPage id={id} />;
}
