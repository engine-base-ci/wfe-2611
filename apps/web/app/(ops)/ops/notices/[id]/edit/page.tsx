import { NoticeWriteScreen } from "@/features/F12/ops2/notice-write-screen";

// 運営のお知らせを書き直す（/ops/notices/<id>/edit・K-1015）。入れ物（layout・運営の外枠）は K-946
export default async function OpsNoticeEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <NoticeWriteScreen id={id} />;
}
