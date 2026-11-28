// 分身の部屋のやったこと（K-756・ai-activity・/ai/done）。外枠と頭は RoomFrame（K-755）、中身は RoomDoneView（apps/web/features/F5/room/）。
//   札と期間は道の問い合わせに残す（useSearchParams を読むので Suspense で包む）
import { Suspense } from "react";
import { DoneLoading } from "@/features/F5/room/done";
import { RoomDoneView } from "@/features/F5/room/room-done";
import { RoomFrame } from "@/features/F5/room/room-frame";

export default function RoomDonePage() {
  return (
    <RoomFrame tab="done">
      <Suspense fallback={<DoneLoading />}>
        <RoomDoneView />
      </Suspense>
    </RoomFrame>
  );
}
